// 光效滚动条：全站隐藏原生滚动条，换成一道会发光的细光束。
// - 页面本身和带 data-glow 的竖向滚动区各有一条：滚动时亮起、停下约一秒后淡出；光标靠近右缘也会亮。
//   滚得快时光束顺着方向拉长一点（像拖尾），拖动光束可以滚动，点轨道跳到那里。
// - 竖向滚动区顺带做 Claude 式的边缘渐隐：没到顶 / 没到底的一侧用遮罩羽化（CSS 读 data-fade-top / data-fade-bottom）。
// - 带 data-hscroll 的横向滚动区（事件时间条、手机上的板块行）没有任何滚动条：
//   竖向滚轮转成横向滚动，鼠标可按住拖动，左右两侧同样按位置渐隐。
// 光束挂在 body 上、position: fixed，所以不受滚动区自己的 overflow / 层叠上下文影响。

const rails = new Map(); // 滚动元素 → { rail, thumb, last, v, idle, size }
const PAGE = typeof document !== "undefined" ? document.scrollingElement || document.documentElement : null;
let raf = 0;
let near = null; // 光标正贴近的那条光束
let drag = null;

function railFor(el) {
  let r = rails.get(el);
  if (r) return r;
  const rail = document.createElement("div");
  rail.className = `gs-rail${el === PAGE ? " is-page" : ""}`;
  rail.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("i");
  thumb.className = "gs-thumb";
  rail.append(thumb);
  document.body.append(rail);
  r = { rail, thumb, last: el.scrollTop, v: 0, idle: 0, box: null, size: 0, max: 0 };
  if (el !== PAGE) { r.ro = new ResizeObserver(schedule); r.ro.observe(el); }
  rails.set(el, r);
  rail.addEventListener("pointerdown", (e) => grab(e, el, r));
  return r;
}

function drop(el) {
  const r = rails.get(el);
  if (!r) return;
  r.rail.remove();
  r.ro?.disconnect();
  rails.delete(el);
}

// 一帧里统一量位置、写样式：先全部读，再全部写，避免读写交替逼浏览器反复重排。
function frame() {
  raf = 0;
  const reads = [];
  for (const [el, r] of rails) {
    if (el !== PAGE && !el.isConnected) { reads.push([el, r, null]); continue; }
    const page = el === PAGE;
    const box = page ? { top: 0, bottom: innerHeight, right: innerWidth, height: innerHeight } : el.getBoundingClientRect();
    reads.push([el, r, { box, top: el.scrollTop, sh: el.scrollHeight, ch: page ? innerHeight : el.clientHeight }]);
  }
  for (const [el, r, m] of reads) {
    if (!m) { drop(el); continue; }
    const { box, top, sh, ch } = m;
    const max = Math.max(0, sh - ch);
    r.max = max;
    const page = el === PAGE;
    if (!page) {
      el.toggleAttribute("data-fade-top", top > 2);
      el.toggleAttribute("data-fade-bottom", top < max - 2);
    }
    if (max < 4 || box.height < 60) { r.rail.classList.remove("is-on", "is-near"); r.rail.style.display = "none"; continue; }
    r.rail.style.display = "";
    const inset = page ? 6 : 10;
    const h = box.height - inset * 2;
    const size = Math.max(page ? 44 : 28, (h * ch) / sh);
    const y = ((h - size) * top) / max;
    const v = top - r.last;
    r.last = top;
    // 速度只在真动的时候更新，停下后由 CSS 过渡把拖尾收回去。
    if (Math.abs(v) > 0.5) r.v = v;
    const stretch = 1 + Math.min(0.45, Math.abs(r.v) / 90);
    r.rail.style.transform = `translate3d(${Math.round(box.right - (page ? 12 : 11))}px, ${Math.round(box.top + inset)}px, 0)`;
    r.rail.style.height = `${h}px`;
    r.thumb.style.height = `${size}px`;
    r.thumb.style.transform = `translate3d(0, ${y}px, 0) scaleY(${stretch.toFixed(3)})`;
    r.thumb.style.transformOrigin = r.v >= 0 ? "50% 100%" : "50% 0%";
    r.size = size;
    r.h = h;
  }
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };

// 滚动时亮起；停下 1 秒后熄灭（拖动中、光标贴着时不熄）。拖尾在停下 120ms 后收回。
function wake(el) {
  const r = rails.get(el);
  if (!r) return;
  r.rail.classList.add("is-on");
  clearTimeout(r.idle);
  clearTimeout(r.calm);
  r.calm = setTimeout(() => { r.v = 0; schedule(); }, 120);
  r.idle = setTimeout(() => { if (drag?.el !== el && near !== el) r.rail.classList.remove("is-on"); }, 1100);
}

function grab(e, el, r) {
  if (e.button !== 0) return;
  e.preventDefault();
  const onThumb = e.target === r.thumb;
  const railTop = r.rail.getBoundingClientRect().top;
  if (!onThumb) {
    // 点轨道：把光束中心移到点击处。
    const want = ((e.clientY - railTop - r.size / 2) / Math.max(1, r.h - r.size)) * r.max;
    el.scrollTo({ top: want, behavior: "smooth" });
    return;
  }
  drag = { el, r, y: e.clientY, top: el.scrollTop };
  r.rail.classList.add("is-drag");
  r.rail.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const k = r.max / Math.max(1, r.h - r.size);
    el.scrollTop = drag.top + (ev.clientY - drag.y) * k;
  };
  const up = () => {
    r.rail.classList.remove("is-drag");
    r.rail.removeEventListener("pointermove", move);
    drag = null;
    wake(el);
  };
  r.rail.addEventListener("pointermove", move);
  r.rail.addEventListener("pointerup", up, { once: true });
  r.rail.addEventListener("pointercancel", up, { once: true });
}

// 光标贴近某条光束（右缘 18px 内）时让它亮着、变粗，方便抓。
function pointer(e) {
  if (e.pointerType !== "mouse" || drag) return;
  let hit = null;
  for (const [el, r] of rails) {
    if (r.rail.style.display === "none") continue;
    const b = r.rail.getBoundingClientRect();
    if (e.clientX >= b.left - 14 && e.clientX <= b.right + 6 && e.clientY >= b.top && e.clientY <= b.bottom) { hit = el; break; }
  }
  if (hit === near) return;
  if (near) { const r = rails.get(near); r?.rail.classList.remove("is-near"); if (r) wake(near); }
  near = hit;
  if (hit) { const r = rails.get(hit); r.rail.classList.add("is-near", "is-on"); clearTimeout(r.idle); }
}

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
  const list = root.matches("[data-glow], [data-hscroll]") ? [root] : [];
  list.push(...root.querySelectorAll("[data-glow], [data-hscroll]"));
  for (const el of list) {
    if (el.hasAttribute("data-glow")) { railFor(el); schedule(); }
    if (el.hasAttribute("data-hscroll")) hscroll(el);
  }
}

export function installGlowScroll() {
  if (!PAGE || document.documentElement.dataset.glowScroll) return;
  document.documentElement.dataset.glowScroll = "on";
  railFor(PAGE);
  scan(document.body);
  new MutationObserver((records) => {
    let removed = false;
    for (const rec of records) {
      rec.addedNodes.forEach(scan);
      if (rec.removedNodes.length) removed = true;
    }
    if (removed) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener("scroll", (e) => {
    const el = e.target === document ? PAGE : e.target;
    if (rails.has(el)) wake(el);
    schedule();
  }, { passive: true, capture: true });
  addEventListener("resize", schedule);
  addEventListener("pointermove", pointer, { passive: true });
  new ResizeObserver(schedule).observe(document.body);
  schedule();
}
