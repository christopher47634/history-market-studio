// 走势图的背景舆图：光标在谁的线上、滑到哪一年，背景就换成那一年的中国疆域。
// 地图是自托管的开源项目「江山时序」（public/atlas，GPL-3.0），同源 iframe 里直接调它的 window.atlasAPI。
// 它只是底色：不接鼠标，滤镜和遮罩压暗压淡，保证折线、节点和标签照旧好读（见 app.css 的 .v3-atlas）。
import { useEffect, useRef, useState } from "react";

const FIRST = -403; // 江山时序从三家分晋开始
const LAST = 2026;
// 只留疆域：州郡、城池、大事气泡、交通线和地图自带的面板都收起来。
const EMBED_CSS = `#nav-bar,#chronicle-pane,#scrubber-dock,#map-search-box,#canvas-br-dock,#act-toggle-pane,#gesture-guide,#milestone-balloon,#map-key,#hover-tip,#genealogy-card,#journey-card,#challenge-card{display:none!important}
#atlas-shell,#workspace-body,#viewport-frame,#atlas-svg{height:100vh!important}`;
const HIDDEN_LAYERS = ["chk-prefectures", "chk-settlements", "chk-milestones", "chk-corridors"];
const VIEW = { x: 110, y: 120, w: 800 }; // 西到葱岭、东到日本列岛

const yearText = (y) => (y < 0 ? `前 ${-y}` : `${y}`);

export function AtlasBackdrop({ year }) {
  const frame = useRef(null);
  const api = useRef(null);
  const shown = useRef(null);
  const [ready, setReady] = useState(false);

  const onLoad = () => {
    const win = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!win || !doc) return;
    const style = doc.createElement("style");
    style.textContent = EMBED_CSS;
    doc.head.appendChild(style);
    // atlasAPI 在地图脚本的 DOMContentLoaded 里才挂上，等它出现。
    let tries = 0;
    const wait = () => {
      if (!win.atlasAPI) { if (++tries < 100) setTimeout(wait, 50); return; }
      for (const id of HIDDEN_LAYERS) { const c = doc.getElementById(id); if (c?.checked) c.click(); }
      win.dispatchEvent(new win.Event("resize"));
      api.current = win.atlasAPI;
      shown.current = null;
      setReady(true);
    };
    wait();
  };

  const target = year == null ? null : Math.max(FIRST, Math.min(LAST, Math.round(year)));

  // 光标扫得快时每帧最多切一次，年份没变不重画。
  useEffect(() => {
    if (!ready || target == null || target === shown.current) return;
    const raf = requestAnimationFrame(() => {
      const a = api.current;
      if (!a) return;
      const first = shown.current == null;
      shown.current = target;
      a.locate({ year: target });
      if (first) a.frame(VIEW);
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, target]);

  const early = year != null && year < FIRST;
  return (
    <div className={`v3-atlas${ready ? " is-ready" : ""}`} aria-hidden="true">
      <iframe ref={frame} src="/atlas/index.html?year=-221" title="江山时序历史地图" loading="lazy" tabIndex={-1} onLoad={onLoad} />
      {ready && target != null && (
        <p className="v3-atlas__stamp">
          {early ? <>舆图始于前 403 年</> : <>{yearText(target)} 年疆域</>}
        </p>
      )}
    </div>
  );
}
