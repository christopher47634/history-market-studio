// 滚动条：用 OverlayScrollbars（MIT，成熟的覆盖式滚动条库）替换原生滚动条，主题 os-theme-glow 是一道发光的细光束：
// 滚动或光标移入时淡入，停下后淡出；光标贴上去变粗、可拖、点轨道跳转——这些行为都是库自带的。
// - 页面本身：在 body 上初始化（库对 body 有专门处理，window 的滚动 API 照常可用）。
// - 页面里的竖向滚动区（下拉列表、完整角色卡、一生节点）：用 bits.jsx 里的 <Scroll>（官方 React 组件）。
// - 横向滚动区（带 data-hscroll：事件时间条、手机上的板块行、时代筛选）：不显示任何滚动条，
//   竖向滚轮转成横向滚动，鼠标可以按住拖动，左右两侧按位置渐隐。
import { OverlayScrollbars, ClickScrollPlugin } from "overlayscrollbars";
import "overlayscrollbars/overlayscrollbars.css";

OverlayScrollbars.plugin(ClickScrollPlugin);

export const SCROLL_OPTIONS = {
  scrollbars: { theme: "os-theme-glow", autoHide: "scroll", autoHideDelay: 900, autoHideSuspend: true, clickScroll: true },
  overflow: { x: "hidden" },
  // 光标在走势图上移动时，高光、吸附、悬停卡片会不停改 class / style；这些属性变化不改变内容尺寸，
  // 不让库每次都重新量一遍布局（真正的尺寸变化由它自带的 ResizeObserver 接住）。
  update: { ignoreMutation: (m) => m.type === "attributes" },
};

// 横向滚动区：滚轮转横向、按住拖动、两侧渐隐。
function hscroll(el) {
  if (el.dataset.hscrollReady) return;
  el.dataset.hscrollReady = "1";
  const fades = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.toggleAttribute("data-fade-left", el.scrollLeft > 2);
    el.toggleAttribute("data-fade-right", el.scrollLeft < max - 2);
  };
  el.addEventListener("scroll", fades, { passive: true });
  new ResizeObserver(fades).observe(el);
  fades();
  el.addEventListener("wheel", (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    // 已经滚到头还往那边滚，就把滚轮还给页面。
    if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 32 : 1.2), behavior: Math.abs(e.deltaY) > 40 ? "smooth" : "auto" });
  }, { passive: false });
  let start = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    start = { x: e.clientX, left: el.scrollLeft, moved: false, id: e.pointerId };
  });
  el.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) < 6) return;
    if (!start.moved) { start.moved = true; el.setPointerCapture(start.id); el.classList.add("is-dragging"); }
    el.scrollLeft = start.left - dx;
  });
  const end = () => {
    if (start?.moved) {
      // 拖过就不算点击：吞掉紧接着的那次 click。
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
    }
    el.classList.remove("is-dragging");
    start = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function scan(root) {
  if (!(root instanceof Element)) return;
  if (root.matches("[data-hscroll]")) hscroll(root);
  root.querySelectorAll("[data-hscroll]").forEach(hscroll);
}

export function installGlowScroll() {
  if (typeof document === "undefined" || document.documentElement.dataset.glowScroll) return;
  document.documentElement.dataset.glowScroll = "on";
  OverlayScrollbars(document.body, { ...SCROLL_OPTIONS, overflow: { x: "hidden", y: "scroll" } });
  scan(document.body);
  new MutationObserver((records) => { for (const rec of records) rec.addedNodes.forEach(scan); }).observe(document.body, { childList: true, subtree: true });
}
