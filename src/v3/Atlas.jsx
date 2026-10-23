// 当时的江山：光标在走势上滑到哪一年，旁边的历史地图就切到那一年的疆域。
// 地图是自托管的开源项目「江山时序」（public/atlas，GPL-3.0），同源 iframe 里直接调它的 window.atlasAPI。
import { useEffect, useRef, useState } from "react";

const FIRST = -403; // 江山时序从三家分晋开始
const LAST = 2026;
// 只留疆域：州郡、城池、大事气泡、交通线和地图自带的面板都收起来，小卡片里一眼看清政权格局。
const EMBED_CSS = `#nav-bar,#chronicle-pane,#scrubber-dock,#map-search-box,#canvas-br-dock,#act-toggle-pane,#gesture-guide,#milestone-balloon,#map-key,#hover-tip,#genealogy-card,#journey-card,#challenge-card{display:none!important}
#atlas-shell,#workspace-body,#viewport-frame,#atlas-svg{height:100vh!important}`;
const HIDDEN_LAYERS = ["chk-prefectures", "chk-settlements", "chk-milestones", "chk-corridors"];
const VIEW = { x: 190, y: 120, w: 760 }; // 西到葱岭、东到日本列岛

const yearLabel = (y) => (y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`);

export function Atlas({ year, person }) {
  const frame = useRef(null);
  const api = useRef(null);
  const shown = useRef(null);
  const [ready, setReady] = useState(false);
  const [dynasty, setDynasty] = useState("");

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

  const inRange = year != null && year >= FIRST && year <= LAST;
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
      try { setDynasty(a.inspect({ year: target, place: "洛阳" })?.dynasty?.title ?? ""); } catch { setDynasty(""); }
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, target]);

  return (
    <section className="v3-card v3-atlas" aria-label="当时的江山">
      <header className="v3-atlas__bar">
        <h2>当时的江山</h2>
        <p>{year == null ? "在走势上悬停，地图跟着年份走" : <>{yearLabel(Math.round(year))}{inRange && dynasty && <><span>·</span>{dynasty}</>}{person && <em>{person}</em>}</>}</p>
      </header>
      <div className="v3-atlas__map">
        <iframe ref={frame} src="/atlas/index.html?year=-221" title="江山时序历史地图" loading="lazy" tabIndex={-1} onLoad={onLoad} />
        {!ready && <div className="v3-atlas__veil"><span />正在展开舆图</div>}
        {ready && year != null && !inRange && <div className="v3-atlas__veil is-note">{year < FIRST ? "地图从公元前 403 年三家分晋开始，这一刻更早" : "已到今天"}</div>}
      </div>
      <p className="v3-atlas__credit">地图：<a href="https://github.com/DeanChensj/jiangshan-map" target="_blank" rel="noreferrer">江山时序</a>（GPL-3.0）· 疆域为示意</p>
    </section>
  );
}
