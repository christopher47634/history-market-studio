// 人物的公共素材：角色数据（维基导语 + 头像）按需加载，头像组件全站共用。
// 角色页、走势页的行情卡、⌘K 搜索面板、选人下拉都用同一份。
import { useEffect, useState } from "react";

// 角色数据单独成包（约 160KB），第一次用到时才下载；之后各处共享同一个 Promise。
let rolesPromise = null;
let rolesCache = null;
export const loadRoles = () => (rolesPromise ??= import("../v2/roles.generated.js").then((m) => (rolesCache = m.default)).catch(() => (rolesCache = {})));
export function useRoles({ idle = false } = {}) {
  const [roles, setRoles] = useState(rolesCache);
  useEffect(() => {
    if (rolesCache) return;
    let alive = true;
    const go = () => loadRoles().then((r) => alive && setRoles(r));
    // 走势页不急着要头像：等浏览器空闲再拉，不跟图表抢首屏。
    if (idle && "requestIdleCallback" in window) { const h = requestIdleCallback(go, { timeout: 2000 }); return () => { alive = false; cancelIdleCallback(h); }; }
    go();
    return () => { alive = false; };
  }, []);
  return roles ?? {};
}

// 头像：有维基 / 百科头像用头像，没有就用姓氏字章（人物主色）。vt 是共享元素转场的名字。
export function Avatar({ f, role, size = "sm", vt, className = "" }) {
  const style = vt ? { viewTransitionName: vt } : undefined;
  return role?.img ? (
    <img className={`v3-ava v3-ava--${size} ${className}`} src={role.img.src} alt="" loading="lazy" decoding="async" width={role.img.w} height={role.img.h} draggable="false" style={style} />
  ) : (
    <span className={`v3-ava v3-ava--${size} v3-ava--mono ${className}`} style={{ "--fc": f.color, ...style }} aria-hidden="true">{f.name[0]}</span>
  );
}

const fmtYear = (y) => (y < 0 ? `前${-y}` : `${y}`);
export const lifeYears = (f) => `${fmtYear(f.born)}—${fmtYear(f.died)}`;
