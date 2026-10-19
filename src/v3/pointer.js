// 指针光：一处监听、每帧最多写一次（做法同「穿越 K 线」的 Interact）。
// - .spot：光标下的卡片拿到 --sx / --sy（像素）和 --px / --py（0–1），并打上 data-spot-on（用属性不用 class：React 重渲染会整个改写 className），CSS 用它画跟手的聚光和一段被照亮的边。
// - .tilt：在 .spot 之上再按光标位置微微倾斜（最多约 5°），离开时弹回。
// 只在精确指针（鼠标）且没开「减少动态效果」时启用；触屏和减少动效下全部静止。
export function installPointer() {
  if (typeof window === "undefined" || document.documentElement.dataset.pointer) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  document.documentElement.dataset.pointer = "on";
  let hot = null, next = null, box = null, x = 0, y = 0, raf = 0;
  // 磁吸：图标按钮和主按钮被光标轻轻吸过去（最多 3px），离开时缓缓回位（CSS 在 interact.css）。
  const MAGNET = ".v3-icon-btn, .v3-bar__search, .v3-tray__go, .v3-btn, .v3-full__close, .v3-tile__add, .v3-swap, .v3-cmd__acts button";
  let mag = null, magNext = null, magBox = null;
  const invalidate = () => { box = null; magBox = null; };
  const frame = () => {
    raf = 0;
    if (magNext !== mag) {
      if (mag) { mag.removeAttribute("data-magnet-on"); mag.style.removeProperty("--mgx"); mag.style.removeProperty("--mgy"); }
      mag = magNext; magBox = null;
      if (mag) { mag.setAttribute("data-magnet", ""); mag.setAttribute("data-magnet-on", ""); }
    }
    if (mag) {
      if (!magBox) magBox = mag.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (x - magBox.left - magBox.width / 2) / (magBox.width / 2)));
      const dy = Math.max(-1, Math.min(1, (y - magBox.top - magBox.height / 2) / (magBox.height / 2)));
      mag.style.setProperty("--mgx", `${(dx * 3).toFixed(1)}px`);
      mag.style.setProperty("--mgy", `${(dy * 2.5).toFixed(1)}px`);
    }
    if (next !== hot) {
      if (hot) { hot.removeAttribute("data-spot-on"); hot.style.removeProperty("--rx"); hot.style.removeProperty("--ry"); }
      hot = next;
      hot?.setAttribute("data-spot-on", "");
    }
    if (!hot) return;
    if (!box) box = hot.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (x - box.left) / box.width));
    const py = Math.min(1, Math.max(0, (y - box.top) / box.height));
    hot.style.setProperty("--sx", `${(x - box.left).toFixed(0)}px`);
    hot.style.setProperty("--sy", `${(y - box.top).toFixed(0)}px`);
    hot.style.setProperty("--px", px.toFixed(3));
    hot.style.setProperty("--py", py.toFixed(3));
    if (hot.classList.contains("tilt")) {
      const max = Number(hot.dataset.tilt || 5);
      hot.style.setProperty("--rx", `${((0.5 - py) * max).toFixed(2)}deg`);
      hot.style.setProperty("--ry", `${((px - 0.5) * max).toFixed(2)}deg`);
    }
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || calm.matches) return;
    x = e.clientX; y = e.clientY;
    const card = e.target?.closest?.(".spot") ?? null;
    const m = e.target?.closest?.(MAGNET) ?? null;
    magNext = m && !m.disabled ? m : null;
    if (card !== next) box = null;
    next = card;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  addEventListener("scroll", invalidate, { passive: true, capture: true });
  addEventListener("resize", invalidate);
  document.documentElement.addEventListener("pointerleave", () => { next = null; magNext = null; if (!raf) raf = requestAnimationFrame(frame); });
}
