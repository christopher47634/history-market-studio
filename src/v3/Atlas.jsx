// 走势图的背景舆图：光标在谁的线上、滑到哪一年，背景就换成那一年的中国疆域。
// 地图是自托管的开源项目「江山时序」（public/atlas，GPL-3.0）。iframe 用不带 allow-same-origin 的沙箱打开，
// 浏览器把它放进单独的进程，重画疆域不占走势图的主线程；年份通过 postMessage 发过去（见 public/atlas/embed.js）。
// 它只是底色：不接鼠标，滤镜和遮罩压暗压淡，保证折线、节点和标签照旧好读（见 app.css 的 .v3-atlas）。
import { useEffect, useRef, useState } from "react";

const FIRST = -403; // 江山时序从三家分晋开始
const LAST = 2026;

const yearText = (y) => (y < 0 ? `前 ${-y}` : `${y}`);

export function AtlasBackdrop({ year }) {
  const frame = useRef(null);
  const sent = useRef(null);
  const [ready, setReady] = useState(false);
  // 首屏先把走势画出来：浏览器空闲下来再开始下载地图（约 1MB 压缩后），不和人物数据、字体抢带宽。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 600));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => setMounted(true), { timeout: 2000 });
    return () => cancel(id);
  }, []);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "atlas:ready") { sent.current = null; setReady(true); }
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  const target = year == null ? null : Math.max(FIRST, Math.min(LAST, Math.round(year)));

  // 光标扫过时不跟着每个节点换图，停稳 80ms 再发；地图那边疆域阶段没变就直接跳过。
  useEffect(() => {
    if (!ready || target == null || target === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = target;
      frame.current?.contentWindow?.postMessage({ type: "atlas:year", year: target }, "*");
    }, sent.current == null ? 0 : 80);
    return () => clearTimeout(timer);
  }, [ready, target]);

  const early = year != null && year < FIRST;
  return (
    <div className={`v3-atlas${ready ? " is-ready" : ""}`} aria-hidden="true">
      {mounted && <iframe ref={frame} src="/atlas/index.html?embed=1&year=-221" sandbox="allow-scripts" title="江山时序历史地图" loading="lazy" tabIndex={-1} />}
      {ready && target != null && (
        <p className="v3-atlas__stamp">
          {early ? <>舆图始于前 403 年</> : <>{yearText(target)} 年疆域</>}
        </p>
      )}
    </div>
  );
}
