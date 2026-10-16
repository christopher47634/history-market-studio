// 指针光：一处监听、每帧最多写一次（做法同「穿越 K 线」的 Interact）。
// - .spot：光标下的卡片拿到 --sx / --sy（像素）和 --px / --py（0–1），并打上 data-spot-on（用属性不用 class：React 重渲染会整个改写 className），CSS 用它画跟手的聚光和一段被照亮的边。
// - .tilt：在 .spot 之上再按光标位置微微倾斜（最多约 5°），离开时弹回。
// 只在精确指针（鼠标）且没开「减少动态效果」时启用；触屏和减少动效下全部静止。
export function installPointer() {
  if (typeof window === "undefined" || document.documentElement.dataset.pointer) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  document.documentElement.dataset.pointer = "on";
  let hot = null, next = null, box = null, x = 0, y = 0, raf = 0;
  const invalidate = () => { box = null; };
  const frame = () => {
    raf = 0;
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
    if (card !== next) box = null;
    next = card;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  addEventListener("scroll", invalidate, { passive: true, capture: true });
  addEventListener("resize", invalidate);
  document.documentElement.addEventListener("pointerleave", () => { next = null; if (!raf) raf = requestAnimationFrame(frame); });
}
