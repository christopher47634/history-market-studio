// 人生走势图：连续时间轴 + 滚轮缩放分层（全景 / 章节 / 细读）+ 折线 / K 线。
// 交互照看盘软件做：十字光标按列吸附（不必压中小点）、横线吸到当时的势、两条轴上各有读数牌，
// K 线下面带一个涨跌副图；放大后纵轴随视窗自动适配。卡片、信息栏、阅读面板在 React 里。
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import echarts from "./echarts.js";
import { LEVELS, LEVEL_SPAN, levelOf, visibleNodes, labelBudget, candles, nearest, yRange } from "./scene.js";

const TIER_LINES = [[95, "天下共主"], [85, "一方之主"], [70, "重臣主帅"], [55, "方面名家"], [40, "成名"], [25, "初起"]];

function readTokens(el) {
  const cs = getComputedStyle(el);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"), line: v("--line"), grid: v("--grid"), surface: v("--surface"),
    bg: v("--bg"), accent: v("--accent"), up: v("--up"), down: v("--down"), p: [v("--p0"), v("--p1")],
    mono: v("--font-mono"), sans: v("--font-sans"), serif: v("--font-serif"),
  };
}

// 画布不认 color-mix，这里把 #rrggbb 换成带透明度的 rgba。
const alpha = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const niceStep = (span) => (span > 400 ? 100 : span > 160 ? 50 : span > 70 ? 20 : span > 32 ? 10 : span > 14 ? 5 : span > 6 ? 2 : 1);
const yearOnly = (y) => (y < 0 ? `前${-y}` : `${y}`);
const yearText = (scene, n) => yearOnly(n.year) + (scene.axis === "age" || n.age == null ? "" : ` · ${n.age}岁`);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// 图的几何：主图 + （K 线模式）涨跌副图。横轴刻度挂在最底下那个图上。
export function layout(width, mode) {
  const narrow = width < 520;
  const left = narrow ? 32 : 44, right = narrow ? 46 : 72, top = narrow ? 60 : 66, bottom = narrow ? 60 : 64;
  const sub = mode === "k" ? (narrow ? 44 : 58) : 0;
  return { left, right, top, bottom, sub, gap: sub ? 10 : 0, mainBottom: bottom + sub + (sub ? 10 : 0) };
}

function labelFor(scene, level, n) {
  const delta = n.kind === "sub" ? "" : n.delta > 0 ? `{up|+${n.delta}}` : n.delta < 0 ? `{down|${n.delta}}` : "";
  if (level.key === "overview") return `{t|${clip(n.event.title, 9)}}\n{m|${yearOnly(n.year)}}`;
  if (level.key === "chapter") return `{t|${clip(n.event.title, 11)}}\n{m|${yearText(scene, n)}}  ${delta}`;
  const quote = n.event.quote?.t ?? n.event.quote?.textSimplified;
  return [`{t|${clip(n.event.title, 14)}}`, `{m|${yearText(scene, n)} · 势 ${n.score}}  ${delta}`, quote ? `{q|「${clip(quote, 17)}」}` : null].filter(Boolean).join("\n");
}

// 视窗里每根 K 线的宽度：先按相邻两根的中位间距定一个统一宽度（看盘软件的蜡烛等宽），
// 挤的地方再按本根左右的空隙缩窄，保证不叠在一起；两人同一年都有事件时左右并排。
function sizeCandles(lists, window, plotW) {
  const ppu = plotW / Math.max(1e-6, window[1] - window[0]);
  const all = lists.flatMap((l, slot) => l.map((k) => ({ k, slot }))).sort((a, b) => a.k.x - b.k.x);
  const xs = [...new Set(all.map((a) => +a.k.x.toFixed(3)))];
  const gaps = xs.slice(1).map((x, i) => (x - xs[i]) * ppu);
  const base = Math.max(3, Math.min(16, (median(gaps) || 40) * 0.6));
  const sized = new Map();
  for (const { k, slot } of all) {
    const i = xs.indexOf(+k.x.toFixed(3));
    const room = Math.min(i > 0 ? (xs[i] - xs[i - 1]) * ppu : Infinity, i < xs.length - 1 ? (xs[i + 1] - xs[i]) * ppu : Infinity);
    const shared = all.some((o) => o.slot !== slot && Math.abs(o.k.x - k.x) < 0.3);
    let w = Math.max(2, Math.min(base, room * 0.78));
    if (shared) w = Math.max(2, w * 0.5);
    sized.set(k, { w, off: shared ? (slot ? 1 : -1) * (w * 0.5 + 1) : 0 });
  }
  return { sized, base, ppu };
}

export function buildOption({ scene, mode, level, window, T, width, pinned, first }) {
  const pair = scene.people.length > 1;
  const kMode = mode === "k";
  const G = layout(width, mode);
  const budget = labelBudget(level, width, scene.people.length);
  const span = window[1] - window[0];
  const [ylo, yhi, ystep] = yRange(scene.people, level, window);
  const yspan = yhi - ylo;
  const series = [];
  const rich = {
    t: { fontSize: 12, fontWeight: 500, color: T.ink, fontFamily: T.sans, lineHeight: 17 },
    m: { fontSize: 10.5, color: T.ink3, fontFamily: T.mono, lineHeight: 15 },
    up: { fontSize: 10.5, color: T.up, fontFamily: T.mono, fontWeight: 600 },
    down: { fontSize: 10.5, color: T.down, fontFamily: T.mono, fontWeight: 600 },
    q: { fontSize: 11, color: T.ink2, fontFamily: T.serif, lineHeight: 17 },
  };
  const visibleK = scene.people.map((p) => (kMode ? candles(p, level).filter((k) => k.x >= window[0] - 1 && k.x <= window[1] + 1) : []));
  const { sized, base } = sizeCandles(visibleK, window, width - G.left - G.right);
  const colorOf = (slot, rising) => (pair ? T.p[slot] : rising ? T.up : T.down);

  scene.people.forEach((p, slot) => {
    const c = T.p[slot];
    const { dots, labels } = visibleNodes(p, level, window, budget);
    const labeled = new Set(labels.map((n) => n.id));
    series.push({
      // 全景只连阶段事件；放大后连上每个事件（含细节），走势跟着变细。K 线模式下蜡烛本身就是走势，线隐去。
      id: `life-${slot}`, type: "line", data: (level.key === "overview" ? p.main : p.nodes).map((n) => [n.x, n.score]), smooth: kMode ? 0 : 0.28, smoothMonotone: "x",
      symbol: "none", z: 3, silent: true,
      lineStyle: { color: c, width: 2.2, opacity: kMode ? 0 : 1, cap: "round" },
      areaStyle: kMode ? undefined : { opacity: pair ? 0.1 : 0.18, origin: "start", color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(c, 1) }, { offset: 1, color: alpha(c, 0) }]) },
      animationDuration: first ? 1200 : 0, animationEasing: "cubicOut",
      ...(slot === 0 ? {
        markArea: { silent: true, itemStyle: { color: T.grid, opacity: 0.55 }, label: { color: T.ink3, fontFamily: T.mono, fontSize: 10.5, position: "insideTop", distance: 8 }, data: [[{ xAxis: scene.lifeEnd + 0.01, name: "身后 · 声望" }, { xAxis: scene.endX }]] },
        markLine: {
          silent: true, symbol: "none", animation: false,
          data: level.key === "overview" ? [] : TIER_LINES.filter(([y]) => y > ylo + yspan * 0.04 && y < yhi - yspan * 0.04).map(([y, name]) => ({ yAxis: y, name })),
          lineStyle: { color: T.line, type: [2, 4], width: 1 },
          label: { formatter: "{b}", position: "insideEndTop", color: T.ink3, fontSize: 10, fontFamily: T.sans },
        },
      } : {}),
    });
    series.push({
      id: `tail-${slot}`, type: "line", data: p.tail.map((n) => [n.x, n.score]), smooth: 0.2, symbol: "none", z: 2, silent: true,
      lineStyle: { color: c, width: 1.4, type: [4, 4], opacity: 0.75 },
      endLabel: { show: true, formatter: `后世 ${p.figure.legacy.score}`, color: c, fontFamily: T.mono, fontSize: 11, distance: 6 },
      animationDuration: first ? 1500 : 0,
    });
    if (kMode) {
      const data = visibleK[slot].map((k) => { const s = sized.get(k); return [k.x, k.open, k.close, k.low, k.high, slot, k.node.kind === "sub" ? 1 : 0, s.w, s.off]; });
      series.push({
        id: `k-${slot}`, type: "custom", z: 4, silent: true, data, animationDurationUpdate: 260, clip: true,
        renderItem: (params, api) => {
          const [x, open, close, low, high, s, isSub, w, off] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => api.value(i));
          const cx = Math.round(api.coord([x, 0])[0] + off) + 0.5;
          const yo = api.coord([x, open])[1], yc = api.coord([x, close])[1];
          const yl = api.coord([x, low])[1], yh = api.coord([x, high])[1];
          const rising = close >= open;
          // 单人：红涨绿跌；两人：本人颜色，涨实心、跌空心。平盘画成一道横线（十字星）。
          const color = colorOf(s, rising);
          const fill = pair ? (rising ? color : T.surface) : color;
          const top = Math.min(yo, yc), h = Math.max(1, Math.abs(yo - yc));
          const op = isSub ? 0.62 : 1;
          return {
            type: "group", children: [
              { type: "line", shape: { x1: cx, y1: yh, x2: cx, y2: yl }, style: { stroke: color, lineWidth: 1, opacity: op } },
              { type: "rect", shape: { x: Math.round(cx - w / 2), y: top, width: Math.round(w), height: h, r: w > 6 ? 1.5 : 0 }, style: { fill, stroke: color, lineWidth: pair && !rising ? 1.2 : 0.8, opacity: op } },
            ],
          };
        },
      });
      // 副图：每根 K 线的涨跌幅度（|收 − 开|），像看盘软件的成交量柱一样从底部长起，颜色分涨跌。
      series.push({
        id: `vol-${slot}`, type: "custom", xAxisIndex: 1, yAxisIndex: 1, z: 4, silent: true, clip: true, animationDurationUpdate: 260,
        data: data.map((d) => [d[0], +(d[2] - d[1]).toFixed(1), d[5], d[6], d[7], d[8]]),
        renderItem: (params, api) => {
          const [x, delta, s, isSub, w, off] = [0, 1, 2, 3, 4, 5].map((i) => api.value(i));
          const cx = Math.round(api.coord([x, 0])[0] + off) + 0.5;
          const y0 = api.coord([x, 0])[1], y1 = api.coord([x, Math.abs(delta)])[1];
          const color = colorOf(s, delta >= 0);
          return { type: "rect", shape: { x: Math.round(cx - w / 2), y: Math.min(y0, y1), width: Math.round(w), height: Math.max(1, Math.abs(y1 - y0)) }, style: { fill: alpha(color, isSub ? 0.4 : 0.72) } };
        },
      });
    }
    // K 线模式下节点圆点隐去（蜡烛本身就是节点），只留标签。
    series.push({
      id: `dots-${slot}`, type: "scatter", z: 6, silent: true,
      data: dots.map((n) => ({
        value: [n.x, n.score], id: n.id,
        symbolSize: kMode ? 0 : n.kind === "sub" ? 5 : n.kind === "finale" ? 9 : 7.5,
        itemStyle: { color: n.kind === "sub" ? c : T.surface, borderColor: c, borderWidth: n.kind === "sub" ? 0 : 1.8, opacity: n.kind === "sub" ? 0.7 : 1 },
        label: {
          show: labeled.has(n.id), formatter: labelFor(scene, level, n), rich,
          position: n.score > yhi - yspan * 0.14 ? "bottom" : n.score < ylo + yspan * 0.18 ? "top" : n.delta < 0 || (pair && slot === 1 && n.delta === 0) ? "bottom" : "top",
          distance: kMode ? 12 : 9, align: "center",
          backgroundColor: T.surface, borderColor: T.line, borderWidth: 1, borderRadius: 7, padding: [4, 7, 3, 7],
          shadowColor: "rgba(0,0,0,0.08)", shadowBlur: 8, shadowOffsetY: 2,
        },
      })),
      labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
      animationDurationUpdate: 380,
    });
    series.push({
      id: `post-${slot}`, type: "scatter", z: 5, silent: true, symbolSize: 5,
      data: p.posthumous.map((n) => ({ value: [n.x, n.score], itemStyle: { color: c, opacity: 0.8 } })),
    });
  });

  // 视窗内的最高、最低（单人 K 线）：看盘软件在影线端点标出数值。
  const ext = [];
  if (kMode && !pair && visibleK[0].length > 1) {
    const ks = visibleK[0].filter((k) => k.x >= window[0] && k.x <= window[1]);
    if (ks.length > 1) {
      const hi = ks.reduce((a, b) => (b.high > a.high ? b : a)), lo = ks.reduce((a, b) => (b.low < a.low ? b : a));
      const mid = (window[0] + window[1]) / 2;
      const mark = (k, v, pos) => ({ value: [k.x, v], label: { formatter: k.x > mid ? `${v} ─` : `─ ${v}`, position: k.x > mid ? "left" : "right", verticalAlign: pos } });
      ext.push(mark(hi, hi.high, "bottom"));
      if (lo !== hi || lo.low !== hi.high) ext.push(mark(lo, lo.low, "top"));
    }
  }
  series.push({
    id: "ext", type: "scatter", z: 6, silent: true, symbolSize: 0, data: ext,
    label: { show: true, color: T.ink2, fontFamily: T.mono, fontSize: 10.5, distance: 2 + base / 2 },
  });

  const pin = pinned ? [{ value: [pinned.x, pinned.score] }] : [];
  series.push({
    id: "pin", type: "effectScatter", z: 7, silent: true, data: pin, symbolSize: kMode ? 8 : 11,
    rippleEffect: { brushType: "stroke", scale: 2.6, period: 3.2 },
    itemStyle: { color: pinned ? T.p[pinned.slot] : T.accent },
  });

  const vols = series.filter((s) => s.id.startsWith("vol-")).flatMap((s) => s.data.map((d) => Math.abs(d[1])));
  const volMax = Math.max(5, ...vols) * 1.1;
  const step = niceStep(span);
  const xBase = { type: "value", min: scene.lifeStart - 1, max: scene.endX + 0.5, interval: step, axisTick: { show: false } };
  const xLabel = { color: T.ink3, fontFamily: T.mono, fontSize: 11, formatter: (x) => scene.formatX(x), hideOverlap: true, margin: 12 };
  return {
    meta: { colW: kMode ? Math.round(base + 8) : 0 },
    backgroundColor: "transparent",
    animationDurationUpdate: 420, animationEasingUpdate: "cubicInOut",
    textStyle: { fontFamily: T.sans },
    grid: [
      { left: G.left, right: G.right, top: G.top, bottom: G.mainBottom },
      { left: G.left, right: G.right, bottom: G.bottom, height: Math.max(1, G.sub), show: false },
    ],
    xAxis: [
      {
        ...xBase, gridIndex: 0,
        axisLine: { lineStyle: { color: T.line } },
        axisLabel: { ...xLabel, show: !kMode },
        splitLine: { show: level.key !== "overview", lineStyle: { color: T.grid, width: 1 } },
      },
      {
        ...xBase, gridIndex: 1, show: kMode,
        axisLine: { onZero: false, lineStyle: { color: T.line } }, axisLabel: xLabel,
        splitLine: { show: level.key !== "overview", lineStyle: { color: T.grid, width: 1 } },
      },
    ],
    yAxis: [
      {
        type: "value", gridIndex: 0, min: ylo, max: yhi, interval: ystep,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: T.ink3, fontFamily: T.mono, fontSize: 11 },
        splitLine: { lineStyle: { color: T.grid, type: [2, 4] } },
      },
      {
        type: "value", gridIndex: 1, show: kMode, min: 0, max: volMax, interval: volMax,
        name: "涨跌幅度", nameLocation: "end", nameGap: -12, nameTextStyle: { color: T.ink3, fontSize: 10.5, fontFamily: T.sans, align: "left", padding: [0, 0, 0, 6] },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { id: "inside", type: "inside", xAxisIndex: [0, 1], filterMode: "none", minValueSpan: 4, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false, preventDefaultMouseMove: true },
      {
        id: "slider", type: "slider", xAxisIndex: [0, 1], filterMode: "none", height: 22, bottom: 14, left: G.left, right: G.right, showDetail: false, brushSelect: false,
        borderColor: "transparent", backgroundColor: T.grid, fillerColor: alpha(T.accent, 0.16),
        dataBackground: { lineStyle: { color: T.ink3, opacity: 0.5, width: 1 }, areaStyle: { color: T.ink3, opacity: 0.08 } },
        selectedDataBackground: { lineStyle: { color: T.accent, opacity: 0.8 }, areaStyle: { color: T.accent, opacity: 0.12 } },
        handleIcon: "path://M0,0 h2 v18 h-2 Z", handleSize: "90%", handleStyle: { color: T.accent, borderColor: T.accent },
        moveHandleSize: 0, textStyle: { color: T.ink3 },
      },
    ],
    series,
  };
}

// 十字光标：直接画在 zrender 上（不走 setOption），跟手、不触发重绘整张图。
function makeCrosshair(zr) {
  const g = echarts.graphic;
  const band = new g.Rect({ silent: true, z: 1, invisible: true, shape: { x: 0, y: 0, width: 0, height: 0 } });
  const v = new g.Line({ silent: true, z: 60, invisible: true, shape: { x1: 0, y1: 0, x2: 0, y2: 0 } });
  const h = new g.Line({ silent: true, z: 60, invisible: true, shape: { x1: 0, y1: 0, x2: 0, y2: 0 } });
  const tagX = new g.Text({ silent: true, z: 61, invisible: true });
  const tagY = new g.Text({ silent: true, z: 61, invisible: true });
  const all = [band, v, h, tagX, tagY];
  all.forEach((el) => zr.add(el));
  return {
    hide() { all.forEach((el) => el.attr("invisible", true)); },
    remove() { all.forEach((el) => zr.remove(el)); },
    // at = { x, y }（节点像素），box = 主图 / 副图范围，T = 配色。
    show({ x, y, box, T, colW, xText, yText, color }) {
      const X = Math.round(x) + 0.5, Y = Math.round(y) + 0.5;
      const line = { stroke: T.ink3, lineWidth: 1, lineDash: [3, 3], opacity: 0.9 };
      v.attr({ invisible: false, shape: { x1: X, y1: box.top, x2: X, y2: box.bottom }, style: line });
      h.attr({ invisible: false, shape: { x1: box.left, y1: Y, x2: box.right, y2: Y }, style: line });
      band.attr({ invisible: !colW, shape: { x: X - colW / 2, y: box.top, width: colW, height: box.bottom - box.top }, style: { fill: alpha(T.ink3, 0.1) } });
      const tag = { fill: T.bg, font: `500 11px ${T.mono}`, padding: [3, 6], borderRadius: 4 };
      tagX.attr({ invisible: false, x: X, y: box.bottom + 5, style: { ...tag, text: xText, backgroundColor: T.ink, align: "center", verticalAlign: "top" } });
      tagY.attr({ invisible: false, x: box.left - 3, y: Y, style: { ...tag, text: yText, backgroundColor: color, align: "right", verticalAlign: "middle" } });
    },
  };
}

export const LifeChart = forwardRef(function LifeChart({ scene, mode, theme, pinned, onHover, onPin, onView, initialWindow }, ref) {
  const box = useRef(null);
  const chart = useRef(null);
  const state = useRef({ window: null, level: null, dots: [], first: true, T: null, hover: null, mouse: null, down: null, dragging: false });
  const [ready, setReady] = useState(false);

  const range = () => [scene.lifeStart - 1, scene.endX + 0.5];
  const render = (first = false) => {
    const c = chart.current;
    if (!c) return;
    const T = readTokens(box.current);
    const { window } = state.current;
    const level = levelOf(Math.min(window[1], scene.lifeEnd + 2) - window[0]);
    state.current.level = level;
    state.current.T = T;
    state.current.dots = scene.people.flatMap((p) => [...visibleNodes(p, level, window, 99).dots, ...p.posthumous]);
    const option = buildOption({ scene, mode, level, window, T, width: c.getWidth(), pinned, first });
    state.current.colW = option.meta.colW;
    delete option.meta;
    option.dataZoom[0].startValue = option.dataZoom[1].startValue = window[0];
    option.dataZoom[0].endValue = option.dataZoom[1].endValue = window[1];
    c.setOption(option, { replaceMerge: ["series"], lazyUpdate: false });
    onView?.({ level, window, span: window[1] - window[0] });
    // 缩放、平移后光标没动：按原位置重新吸附，十字光标留在原处（看盘软件的手感）。
    state.current.retrack?.();
  };

  useEffect(() => {
    const c = echarts.init(box.current, null, { renderer: "canvas" });
    chart.current = c;
    const ro = new ResizeObserver(() => { c.resize(); if (state.current.window) render(); });
    ro.observe(box.current);
    setReady(true);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, []);

  // 换人或换轴：重置视窗，主线重新画一遍。
  useEffect(() => {
    if (!ready) return;
    state.current.window = initialWindow ?? range();
    render(true);
  }, [ready, scene]);

  useEffect(() => { if (ready && state.current.window) render(); }, [mode, theme, pinned?.id]);

  useEffect(() => {
    const c = chart.current;
    if (!ready || !c) return;
    const zr = c.getZr();
    const cross = makeCrosshair(zr);
    const S = state.current;
    let timer = 0;
    const onZoom = () => {
      const dz = c.getOption().dataZoom[0];
      const [lo, hi] = range();
      S.window = [lo + ((hi - lo) * dz.start) / 100, lo + ((hi - lo) * dz.end) / 100];
      clearTimeout(timer);
      timer = setTimeout(() => render(), 70);
    };
    const toPixel = (n) => c.convertToPixel({ gridIndex: 0 }, [n.x, n.score]);
    const geo = () => {
      const G = layout(c.getWidth(), mode), H = c.getHeight();
      return { left: G.left, right: c.getWidth() - G.right, top: G.top, mainBottom: H - G.mainBottom, bottom: H - G.bottom };
    };
    const inside = ([x, y], g) => x >= g.left - 6 && x <= g.right + 6 && y >= g.top - 10 && y <= g.bottom;
    const setHover = (n) => {
      if (n === S.hover) return;
      S.hover = n;
      onHover?.(n ? { node: n, pixel: toPixel(n) } : null);
    };
    const clear = () => { cross.hide(); setHover(null); };
    const track = (px) => {
      const g = geo();
      if (!px || !inside(px, g) || S.dragging) { clear(); return; }
      const n = nearest(S.dots, px, toPixel, { yWeight: scene.people.length > 1 ? 0.35 : 0.02, prev: S.hover });
      if (!n) { clear(); return; }
      const [x, y] = toPixel(n);
      if (x < g.left - 1 || x > g.right + 1) { clear(); return; }
      const T = S.T;
      cross.show({
        x, y: Math.max(g.top, Math.min(g.mainBottom, y)), T, colW: S.colW,
        box: { left: g.left, right: g.right, top: g.top, bottom: mode === "k" ? g.bottom : g.mainBottom },
        xText: n.kind === "posthumous" || n.kind === "anchor" ? yearOnly(n.year) : yearText(scene, n),
        yText: String(n.score), color: T.p[n.slot],
      });
      setHover(n);
    };
    S.retrack = () => {
      if (!S.mouse) return;
      S.hover = null; // 视窗变了，像素位置要重新报给卡片
      track(S.mouse);
    };
    const pos = (e) => [e.offsetX, e.offsetY];
    const move = (e) => {
      S.mouse = pos(e);
      if (S.down && Math.hypot(S.mouse[0] - S.down[0], S.mouse[1] - S.down[1]) > 4) S.dragging = true;
      box.current.style.cursor = S.dragging ? "grabbing" : inside(S.mouse, geo()) ? "crosshair" : "default";
      track(S.mouse);
    };
    const down = (e) => { S.down = pos(e); S.dragging = false; };
    const up = (e) => { const was = S.dragging; S.down = null; S.dragging = false; if (was) move(e); };
    // 拖动平移松手时不算点击。
    const click = (e) => {
      if (S.dragging || (S.down && Math.hypot(e.offsetX - S.down[0], e.offsetY - S.down[1]) > 4)) return;
      track(pos(e));
      if (S.hover) onPin?.(S.hover);
    };
    const dbl = (e) => { track(pos(e)); if (S.hover) api.focus(S.hover); };
    const out = () => { S.mouse = null; S.down = null; S.dragging = false; clear(); };
    c.on("datazoom", onZoom);
    zr.on("mousemove", move); zr.on("mousedown", down); zr.on("mouseup", up); zr.on("click", click); zr.on("dblclick", dbl); zr.on("globalout", out);
    return () => {
      clearTimeout(timer); S.retrack = null; cross.remove(); S.hover = null;
      c.off("datazoom", onZoom); zr.off("mousemove", move); zr.off("mousedown", down); zr.off("mouseup", up); zr.off("click", click); zr.off("dblclick", dbl); zr.off("globalout", out);
    };
  }, [ready, scene, mode, theme, onHover, onPin]);

  const setWindow = (w) => {
    const [lo, hi] = range();
    const width = Math.min(hi - lo, w[1] - w[0]);
    let a = Math.max(lo, w[0]);
    a = Math.min(a, hi - width);
    chart.current?.dispatchAction({ type: "dataZoom", startValue: a, endValue: a + width });
  };
  const api = {
    // 以固定的节点为中心缩放；没有固定节点就以当前视窗中心为准。
    zoomToLevel(key, anchor) {
      const [lo, hi] = range();
      const w = state.current.window;
      if (key === "overview") return setWindow([lo, hi]);
      const span = LEVEL_SPAN[key];
      const inLife = anchor && anchor.x <= scene.lifeEnd;
      const center = inLife ? anchor.x : Math.min((w[0] + w[1]) / 2, scene.lifeEnd - span / 2);
      setWindow([center - span / 2, center + span / 2]);
    },
    focus(n, key = "detail") {
      const span = LEVEL_SPAN[key];
      setWindow([n.x - span / 2, n.x + span / 2]);
    },
    // 节点不在视窗里就平移过去（保持当前缩放）。
    reveal(n) {
      const w = state.current.window;
      if (n.x >= w[0] && n.x <= w[1]) return;
      const span = w[1] - w[0];
      setWindow([n.x - span / 2, n.x + span / 2]);
    },
    pixelOf(n) { return chart.current?.convertToPixel({ gridIndex: 0 }, [n.x, n.score]); },
    get level() { return state.current.level; },
  };
  useImperativeHandle(ref, () => api);

  return <div ref={box} className="v3-chart-canvas" role="img" aria-label="人生走势图：滚轮缩放，拖动平移，十字光标按列吸附，点击固定节点；完整数据见「文字版」" aria-describedby="v3-chart-summary" />;
});

export { LEVELS };
