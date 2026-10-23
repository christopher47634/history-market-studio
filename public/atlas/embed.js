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
  const show = (year) => {
    if (!api) { pending = year; return; }
    if (first) { first = false; api.locate({ year }); api.frame(VIEW); } else api.showYear(year);
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
