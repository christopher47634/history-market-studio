// 液态玻璃（照苹果 Liquid Glass 的做法，移植自「穿越 K 线」的 GlassLayer）。让 .lg 读起来像玻璃的不是一圈彩边，而是三层：
//  1. 折射：玻璃边缘像一圈凸透镜，把背后的内容往里弯（每个尺寸生成一张位移贴图，backdrop-filter 里引用；仅 Chromium）。
//     红绿蓝三通道位移 100% / 94% / 88%，背景有边缘的地方会出现一点点色散。
//  2. 高光：边上一道白色镜面反光，朝向光源——桌面上光源就是光标（--lg-a 是光的方向）。
//  3. 照亮：按下时玻璃从按下的点亮起，光还会溢到旁边的玻璃上。
// 状态全部写在 data 属性和 CSS 变量里（不改 class：React 重新渲染会整个改写 className）。
// 面积太大的玻璃（完整角色卡这类）只做高光不做折射：大面积的位移滤镜每帧都要重算，不划算。
const SVG = "http://www.w3.org/2000/svg";
const MAX_AREA = 320000;

/** 位移贴图：R/G 通道存 x/y 偏移（128 = 不动）。边缘 bezel 宽的一圈里，越靠边往里取得越多。 */
export function lensMap(w, h, r, bezel) {
  const d = new Uint8ClampedArray(w * h * 4);
  const hw = w / 2, hh = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x + 0.5 - hw, py = y + 0.5 - hh;
      const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const out = Math.hypot(ox, oy);
      const depth = -(out + Math.min(Math.max(qx, qy), 0) - r); // 离圆角边缘往里的距离
      let dx = 0, dy = 0;
      if (depth > 0 && depth < bezel) {
        let nx = 0, ny = 0;
        if (qx > 0 && qy > 0) { nx = ox / out; ny = oy / out; } else if (qx > qy) nx = 1; else ny = 1;
        const m = Math.pow(1 - depth / bezel, 2.2);
        dx = -Math.sign(px) * nx * m;
        dy = -Math.sign(py) * ny * m;
      }
      d[i] = Math.round(128 + dx * 127);
      d[i + 1] = Math.round(128 + dy * 127);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  return d;
}
const bezelFor = (w, h) => Math.max(5, Math.min(Math.min(w, h) * 0.3, 16));

function lensFilter(id, w, h, r) {
  const bezel = bezelFor(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(lensMap(w, h, r, bezel), w, h), 0, 0);
  const S = bezel * 1.25; // feDisplacementMap 的位移 = scale × (通道值 − 0.5)
  const set = (el, a) => Object.entries(a).forEach(([k, v]) => el.setAttribute(k, String(v)));
  const f = document.createElementNS(SVG, "filter");
  set(f, { id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
  const add = (tag, a) => { const el = document.createElementNS(SVG, tag); set(el, a); f.appendChild(el); };
  add("feImage", { href: c.toDataURL(), x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" });
  const keep = ["1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"];
  [1, 0.94, 0.88].forEach((k, j) => {
    add("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: (S * k).toFixed(2), xChannelSelector: "R", yChannelSelector: "G", result: `d${j}` });
    add("feColorMatrix", { in: `d${j}`, type: "matrix", values: keep[j], result: `c${j}` });
  });
  add("feBlend", { in: "c0", in2: "c1", mode: "screen", result: "c01" });
  add("feBlend", { in: "c01", in2: "c2", mode: "screen" });
  return f;
}

const hasGlass = (n) => n instanceof Element && (n.classList.contains("lg") || !!n.querySelector(".lg"));
const glassChanged = (records) => records.some((r) => [...r.addedNodes].some(hasGlass) || [...r.removedNodes].some(hasGlass));

export function installLiquid() {
  if (typeof window === "undefined" || document.documentElement.dataset.liquid) return;
  document.documentElement.dataset.liquid = "on";
  const reduceT = matchMedia("(prefers-reduced-transparency: reduce)").matches;
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
  const refract = chromium && !reduceT;
  document.documentElement.toggleAttribute("data-refract", refract);

  // —— 折射：每种（宽 × 高 × 圆角）一张滤镜，控件变大小时重新配。空闲时再生成，不跟首屏抢主线程。
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  const defs = document.createElementNS(SVG, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  const keyOf = new WeakMap();
  const fit = (el) => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 8 || h < 8 || w * h > MAX_AREA) { el.style.removeProperty("--lg-filter"); keyOf.delete(el); return; }
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
    const key = `lgf-${w}x${h}r${Math.round(r)}`;
    if (keyOf.get(el) === key) return;
    keyOf.set(el, key);
    if (!defs.querySelector(`#${key}`)) defs.appendChild(lensFilter(key, w, h, r));
    el.style.setProperty("--lg-filter", `url(#${key})`);
  };
  const tracked = new Set();
  const ro = refract ? new ResizeObserver((es) => es.forEach((e) => fit(e.target))) : null;
  const scan = () => document.querySelectorAll(".lg").forEach((el) => {
    if (tracked.has(el)) return;
    tracked.add(el);
    if (ro) { ro.observe(el); fit(el); }
  });
  const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 600));
  let pending = 0;
  const later = () => { if (!pending) pending = idle(() => { pending = 0; scan(); }, { timeout: 1500 }); };
  later();

  // —— 高光方向 + 悬停 / 按下照亮。玻璃的位置只在滚动、缩放、增删之后重量，不每次指针移动都量。
  let boxes = null;
  const invalidate = () => { boxes = null; };
  const measure = () => (boxes ??= new Map([...document.querySelectorAll(".lg")].map((el) => [el, el.getBoundingClientRect()])));
  const lastA = new WeakMap();
  let hover = null, lit = [], raf = 0, px = innerWidth / 2, py = -200;
  const local = (el, x, y) => {
    const b = measure().get(el) ?? el.getBoundingClientRect();
    el.style.setProperty("--lx", `${(x - b.left).toFixed(0)}px`);
    el.style.setProperty("--ly", `${(y - b.top).toFixed(0)}px`);
    return b;
  };
  const aim = () => {
    raf = 0;
    measure().forEach((b, el) => {
      if (!b.width) return;
      let a = (Math.atan2(px - (b.left + b.width / 2), -(py - (b.top + b.height / 2))) * 180) / Math.PI + 180;
      const prev = lastA.get(el);
      if (prev !== undefined) a += Math.round((prev - a) / 360) * 360; // 别绕远路转一圈
      if (prev !== undefined && Math.abs(prev - a) < 0.5) return;
      lastA.set(el, a);
      el.style.setProperty("--lg-a", `${a.toFixed(1)}deg`);
    });
  };
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(aim);
    const t = e.target?.closest?.(".lg") ?? null;
    if (t !== hover) { hover?.removeAttribute("data-lg-hover"); hover = t; t?.setAttribute("data-lg-hover", ""); }
    if (t) local(t, e.clientX, e.clientY);
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    const t = e.target?.closest?.(".lg");
    if (!t) return;
    invalidate();
    const b = local(t, e.clientX, e.clientY);
    t.setAttribute("data-lg-press", "");
    lit = [t];
    measure().forEach((c, o) => {
      if (o === t || !c.width) return;
      const gap = Math.max(c.left - b.right, b.left - c.right, c.top - b.bottom, b.top - c.bottom, 0);
      if (gap < 120) { local(o, e.clientX, e.clientY); o.setAttribute("data-lg-near", ""); lit.push(o); }
    });
  }, { passive: true });
  const up = () => { lit.forEach((o) => { o.removeAttribute("data-lg-press"); o.removeAttribute("data-lg-near"); }); lit = []; };
  addEventListener("pointerup", up, { passive: true });
  addEventListener("pointercancel", up, { passive: true });
  addEventListener("scroll", invalidate, { passive: true, capture: true });
  addEventListener("resize", invalidate);
  new MutationObserver((records) => {
    if (!glassChanged(records)) return;
    invalidate();
    tracked.forEach((el) => { if (!el.isConnected) { ro?.unobserve(el); tracked.delete(el); } });
    later();
  }).observe(document.body, { childList: true, subtree: true });
  if (!fine) document.documentElement.setAttribute("data-touch", "");
}
