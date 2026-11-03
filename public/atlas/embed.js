// 历史行情局嵌入桥（本站新增文件）：带 ?embed=1 打开时，把江山时序变成走势图背后的纯疆域底图。
// 走势页用不带 allow-same-origin 的沙箱 iframe 打开它，浏览器把地图放进单独的进程，重画疆域不占走势图的主线程；
// 两边只靠 postMessage 说话：页面发 { type: "atlas:year", year }，这里回 { type: "atlas:ready" }。
(() => {
  if (!/[?&]embed=1\b/.test(location.search)) return;
  const CSS = `#nav-bar,#chronicle-pane,#scrubber-dock,#map-search-box,#canvas-br-dock,#act-toggle-pane,#gesture-guide,#milestone-balloon,#map-key,#hover-tip,#genealogy-card,#journey-card,#challenge-card{display:none!important}
#atlas-shell,#workspace-body,#viewport-frame,#atlas-svg{height:100vh!important}
*,*::before,*::after{animation:none!important}#workspace-body{display:block!important}#viewport-frame{width:100vw!important}#atlas-svg{width:100vw!important}`;
  const HIDDEN_LAYERS = ["chk-prefectures", "chk-settlements", "chk-milestones", "chk-corridors"];
  const VIEW = { cx: 540, cy: 385, w: 1000 }; // 中原居中；宽画布两侧由中亚、日本海自然填满
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  let api = null;
  let pending = null;
  let first = true;
  // 疆域换代时交叉淡化：先把旧的政权和邻国层复制一份叠在上面，新疆域画好后让旧的 650ms 淡出，
  // 不再一帧硬切。光标连着扫过好几个朝代时，上一份还没淡完就直接撤掉，只留一层在淡。
  let ghosts = [];
  const crossfade = () => {
    ghosts.forEach((g) => g.remove());
    ghosts = ["grp-neighbors", "grp-polities"].map((id) => document.getElementById(id)).filter(Boolean).map((g) => {
      const copy = g.cloneNode(true);
      copy.removeAttribute("id");
      copy.style.pointerEvents = "none";
      g.after(copy);
      return copy;
    });
    const mine = ghosts;
    // 等新疆域落进 DOM（同一朝代换快照要先取快照数据）再开始淡。
    requestAnimationFrame(() => requestAnimationFrame(() => {
      mine.forEach((g) => {
        const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "cubic-bezier(0.165, 0.84, 0.44, 1)", fill: "forwards" });
        a.onfinish = () => { g.remove(); ghosts = ghosts.filter((x) => x !== g); };
      });
    }));
  };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = (year) => {
    if (!api) { pending = year; return; }
    if (first) { first = false; api.locate({ year }); api.frame(VIEW); return; }
    const ghostsBefore = !calm && document.getElementById("grp-polities")?.childElementCount;
    if (ghostsBefore) crossfade();
    if (!api.showYear(year) && ghostsBefore) { ghosts.forEach((g) => g.remove()); ghosts = []; } // 疆域没变：不用淡
  };
  addEventListener("message", (e) => {
    if (e.source !== parent || !e.data || e.data.type !== "atlas:year") return;
    const y = Number(e.data.year);
    if (Number.isFinite(y)) show(y);
  });
  const wait = () => {
    if (!window.atlasAPI) { setTimeout(wait, 50); return; }
    for (const id of HIDDEN_LAYERS) { const c = document.getElementById(id); if (c && c.checked) c.click(); }
    document.getElementById("atlas-svg")?.setAttribute("preserveAspectRatio", "xMidYMid slice"); // 比例对不上时裁边，不留空白
    dispatchEvent(new Event("resize"));
    api = window.atlasAPI;
    if (pending != null) show(pending);
    parent.postMessage({ type: "atlas:ready" }, "*");
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", wait); else wait();
})();
