// 人物的公共素材：角色数据（维基导语 + 头像）按需加载，头像组件全站共用。
// 角色页、走势页的行情卡、⌘K 搜索面板、选人下拉都用同一份。
import { useEffect, useState } from "react";
import rolesUrl from "../v2/roles.generated.js?url";

// 角色数据单独成包（约 150KB），第一次用到时才下载；之后各处共享同一个 Promise。
// 10-20 修：原来下载失败一次就把结果记成空表、再也不重试，整站头像和简介都退成姓氏字章，直到刷新（国内连 Vercel 偶发失败很常见）。
// 现在：失败不缓存，按 1s / 2s / 4s 重试三次；还不行就等网络恢复或页面回到前台再试；
// 若是旧页面跨了一次发布（旧文件已不在线上），自动刷新一次换成新版本。
let rolesPromise = null;
let rolesCache = null;
const subscribers = new Set();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 浏览器会把下载失败的 import() 结果缓存住，同一个地址再 import 不会重新下载；所以每次重试在地址后加一个参数，逼它真去网络再取。
// 文件本身就是 `export default {...}`，按 ?url 原样发布成带哈希的静态文件，可以直接当模块导入。
let attempt = 0;
async function importRoles() {
  let last;
  for (let i = 0; i < 4; i++) {
    try { return (await import(/* @vite-ignore */ attempt++ ? `${rolesUrl}?retry=${attempt}` : rolesUrl)).default; }
    catch (e) { last = e; if (i < 3) await wait(1000 * 2 ** i); }
  }
  throw last;
}

export const loadRoles = () => (rolesPromise ??= importRoles().then(
  (r) => { rolesCache = r; subscribers.forEach((fn) => fn(r)); return r; },
  (e) => { rolesPromise = null; reloadIfStale(); throw e; },
));

// 旧页面跨发布：线上已经没有旧版分包，只能刷新。每个会话最多自动刷新一次，免得网络真断了时来回刷。
export function reloadIfStale() {
  try {
    if (sessionStorage.getItem("hms-reloaded")) return;
    fetch(location.href, { cache: "no-store" }).then((r) => r.text()).then((html) => {
      const now = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-/.test(s));
      if (now && !html.includes(new URL(now).pathname)) { sessionStorage.setItem("hms-reloaded", "1"); location.reload(); }
    }).catch(() => {});
  } catch {}
}

if (typeof window !== "undefined") {
  const retry = () => { if (!rolesCache && subscribers.size) loadRoles().catch(() => {}); };
  addEventListener("online", retry);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) retry(); });
}

export const rolesReady = () => !!rolesCache;

export function useRoles({ idle = false } = {}) {
  const [roles, setRoles] = useState(rolesCache);
  useEffect(() => {
    if (rolesCache) { if (roles !== rolesCache) setRoles(rolesCache); return; }
    let alive = true;
    const on = (r) => alive && setRoles(r);
    subscribers.add(on);
    const go = () => loadRoles().catch(() => {});
    // 走势页不急着要头像：等浏览器空闲再拉，不跟图表抢首屏。
    let h;
    if (idle && "requestIdleCallback" in window) h = requestIdleCallback(go, { timeout: 2000 });
    else go();
    return () => { alive = false; subscribers.delete(on); if (h) cancelIdleCallback(h); };
  }, []);
  return roles ?? {};
}

// 图片真正下载完才打 data-ok；没打之前 CSS 用一层底色替换掉图片本身（interact.css），所以任何时候都不会露出浏览器的「裂图」图标。
const markLoaded = (el) => { if (el && el.complete && el.naturalWidth) el.dataset.ok = ""; };

// 头像：有维基 / 百科头像用头像；数据还在下载时显示一块微光骨架（不再先闪成姓氏字章，看起来像头像丢了）；
// 数据到了而这个人确实没有头像（目前只有耶律洪基），才用姓氏字章（人物主色）。vt 是共享元素转场的名字。
// 10-20：单张头像下载失败时浏览器会显示「裂图」。现在失败后隔 1.5s / 4s 换地址（?r=n）重试两次，
// 等待和重试期间显示骨架；三次都失败才退成字章，不再出现裂图图标。
export function Avatar({ f, role, size = "sm", vt, className = "" }) {
  const style = vt ? { viewTransitionName: vt } : undefined;
  const [fail, setFail] = useState(0);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { setFail(0); setWaiting(false); }, [role?.img?.src]);
  const onError = () => {
    if (fail >= 2) { setFail(3); return; }
    setWaiting(true);
    setTimeout(() => { setFail((n) => n + 1); setWaiting(false); }, fail ? 4000 : 1500);
  };
  if (role?.img && fail < 3 && !waiting) {
    const src = fail ? `${role.img.src}?r=${fail}` : role.img.src;
    return (
      <img key={src} className={`v3-ava v3-ava--${size} ${className}`} src={src} alt="" loading="lazy" decoding="async"
        width={role.img.w} height={role.img.h} draggable="false" style={style} onError={onError} ref={markLoaded} onLoad={(e) => { e.currentTarget.dataset.ok = ""; }} />
    );
  }
  if (!rolesCache || waiting) return <span className={`v3-ava v3-ava--${size} v3-ava--loading ${className}`} style={{ "--fc": f.color, ...style }} aria-hidden="true" />;
  return <span className={`v3-ava v3-ava--${size} v3-ava--mono ${className}`} style={{ "--fc": f.color, ...style }} aria-hidden="true">{f.name[0]}</span>;
}

const fmtYear = (y) => (y < 0 ? `前${-y}` : `${y}`);
export const lifeYears = (f) => `${fmtYear(f.born)}—${fmtYear(f.died)}`;
