// 人生走势图：连续时间轴 + 滚轮缩放分层（全景 / 章节 / 细读）+ 折线 / K 线。
// 图表本身只负责画和吸附；卡片、阅读面板、层级按钮在 React 里。
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import echarts from "./echarts.js";
import { LEVELS, LEVEL_SPAN, levelOf, visibleNodes, labelBudget, candles, nearest } from "./scene.js";

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
const yearText = (scene, n) => (n.year < 0 ? `前${-n.year}` : `${n.year}`) + (scene.axis === "age" || n.age == null ? "" : ` · ${n.age}岁`);

function labelFor(scene, level, n, T) {
  const delta = n.kind === "sub" ? "" : n.delta > 0 ? `{up|+${n.delta}}` : n.delta < 0 ? `{down|${n.delta}}` : "";
  if (level.key === "overview") return `{t|${clip(n.event.title, 9)}}\n{m|${n.year < 0 ? `前${-n.year}` : n.year}}`;
  if (level.key === "chapter") return `{t|${clip(n.event.title, 11)}}\n{m|${yearText(scene, n)}}  ${delta}`;
  const quote = n.event.quote?.t ?? n.event.quote?.textSimplified;
  return [`{t|${clip(n.event.title, 14)}}`, `{m|${yearText(scene, n)} · 势 ${n.score}}  ${delta}`, quote ? `{q|「${clip(quote, 17)}」}` : null].filter(Boolean).join("\n");
}

export function buildOption({ scene, mode, level, window, T, width, pinned, first }) {
  const pair = scene.people.length > 1;
  const budget = labelBudget(level, width, scene.people.length);
  const span = window[1] - window[0];
  const series = [];
  const rich = {
    t: { fontSize: 12, fontWeight: 500, color: T.ink, fontFamily: T.sans, lineHeight: 17 },
    m: { fontSize: 10.5, color: T.ink3, fontFamily: T.mono, lineHeight: 15 },
    up: { fontSize: 10.5, color: T.up, fontFamily: T.mono, fontWeight: 600 },
    down: { fontSize: 10.5, color: T.down, fontFamily: T.mono, fontWeight: 600 },
    q: { fontSize: 11, color: T.ink2, fontFamily: T.serif, lineHeight: 17 },
  };
  scene.people.forEach((p, slot) => {
    const c = T.p[slot];
    const { dots, labels } = visibleNodes(p, level, window, budget);
    const labeled = new Set(labels.map((n) => n.id));
    const kMode = mode === "k";
    series.push({
      // 全景只连阶段事件；放大后连上每个事件（含细节），走势跟着变细。
      id: `life-${slot}`, type: "line", data: (level.key === "overview" ? p.main : p.nodes).map((n) => [n.x, n.score]), smooth: 0.28, smoothMonotone: "x",
      symbol: "none", z: 3, silent: true,
      lineStyle: { color: c, width: kMode ? 1.2 : 2.2, opacity: kMode ? 0.4 : 1, cap: "round" },
      areaStyle: kMode ? undefined : { opacity: pair ? 0.1 : 0.18, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(c, 1) }, { offset: 1, color: alpha(c, 0) }]) },
      animationDuration: first ? 1200 : 0, animationEasing: "cubicOut",
      ...(slot === 0 ? {
        markArea: { silent: true, itemStyle: { color: T.grid, opacity: 0.55 }, label: { color: T.ink3, fontFamily: T.mono, fontSize: 10.5, position: "insideTop", distance: 8 }, data: [[{ xAxis: scene.lifeEnd + 0.01, name: "身后 · 声望" }, { xAxis: scene.endX }]] },
        markLine: {
          silent: true, symbol: "none", animation: false,
          data: level.key === "overview" ? [] : TIER_LINES.map(([y, name]) => ({ yAxis: y, name })),
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
      const data = candles(p, level).filter((k) => k.x1 >= window[0] - 1 && k.x0 <= window[1] + 1).map((k) => [k.x0, k.x1, k.x, k.open, k.close, k.low, k.high, slot, k.node.kind === "sub" ? 1 : 0]);
      series.push({
        id: `k-${slot}`, type: "custom", z: 4, silent: true, data, animationDurationUpdate: 300,
        renderItem: (params, api) => {
          const [x0, x1, x, open, close, low, high, s, isSub] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => api.value(i));
          const px0 = api.coord([x0, 0])[0], px1 = api.coord([x1, 0])[0];
          const w = Math.max(3, Math.min(level.key === "overview" ? (pair ? 14 : 22) : 16, (px1 - px0) * (level.key === "overview" ? 0.78 : 0.5)));
          const cx = api.coord([x, 0])[0] + (pair ? (s ? 1 : -1) * w * 0.3 : 0);
          const [, yo] = api.coord([x, open]); const [, yc] = api.coord([x, close]);
          const [, yl] = api.coord([x, low]); const [, yh] = api.coord([x, high]);
          const rising = close >= open;
          // 单人：红涨绿跌；两人：本人颜色，涨实心、跌空心。
          const color = pair ? T.p[s] : rising ? T.up : T.down;
          const fill = pair ? (rising ? color : T.surface) : color;
          const top = Math.min(yo, yc), h = Math.max(1.5, Math.abs(yo - yc));
          return {
            type: "group", children: [
              { type: "line", shape: { x1: cx, y1: yh, x2: cx, y2: yl }, style: { stroke: color, lineWidth: 1, opacity: isSub ? 0.6 : 1 } },
              { type: "rect", shape: { x: cx - w / 2, y: top, width: w, height: h, r: Math.min(2, w / 4) }, style: { fill, stroke: color, lineWidth: 1.2, opacity: isSub ? 0.65 : 1 } },
            ],
          };
        },
      });
    }
    series.push({
      id: `dots-${slot}`, type: "scatter", z: 6, silent: true,
      data: dots.map((n) => ({
        value: [n.x, n.score], id: n.id,
        symbolSize: n.kind === "sub" ? 5 : n.kind === "finale" ? 9 : 7.5,
        itemStyle: { color: n.kind === "sub" ? c : T.surface, borderColor: c, borderWidth: n.kind === "sub" ? 0 : 1.8, opacity: n.kind === "sub" ? 0.7 : 1 },
        label: {
          show: labeled.has(n.id), formatter: labelFor(scene, level, n, T), rich,
          position: n.score < 20 ? "top" : n.score > 90 ? "bottom" : n.delta < 0 || (pair && slot === 1 && n.delta === 0) ? "bottom" : "top", distance: 9, align: "center",
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
  const pin = pinned ? [{ value: [pinned.x, pinned.score] }] : [];
  series.push({
    id: "pin", type: "effectScatter", z: 7, silent: true, data: pin, symbolSize: 11,
    rippleEffect: { brushType: "stroke", scale: 2.6, period: 3.2 },
    itemStyle: { color: pinned ? T.p[pinned.slot] : T.accent },
  });
  const step = niceStep(span);
  return {
    backgroundColor: "transparent",
    animationDurationUpdate: 420, animationEasingUpdate: "cubicInOut",
    textStyle: { fontFamily: T.sans },
    grid: width < 520 ? { left: 32, right: 46, top: 60, bottom: 60 } : { left: 44, right: 72, top: 66, bottom: 64 },
    tooltip: { show: true, trigger: "axis", showContent: false },
    axisPointer: { lineStyle: { color: T.ink3, width: 1, type: [3, 3] } },
    xAxis: {
      type: "value", min: scene.lifeStart - 1, max: scene.endX + 0.5, interval: step,
      axisLine: { lineStyle: { color: T.line } }, axisTick: { show: false },
      axisLabel: { color: T.ink3, fontFamily: T.mono, fontSize: 11, formatter: (x) => scene.formatX(x), hideOverlap: true, margin: 12 },
      splitLine: { show: level.key !== "overview", lineStyle: { color: T.grid, width: 1 } },
      axisPointer: { show: true, snap: false, label: { show: true, formatter: ({ value }) => scene.formatX(value), backgroundColor: T.ink, color: T.bg, fontFamily: T.mono, fontSize: 11, padding: [3, 6], borderRadius: 4 } },
    },
    yAxis: {
      type: "value", min: 0, max: 100, interval: 25,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: T.ink3, fontFamily: T.mono, fontSize: 11 },
      splitLine: { lineStyle: { color: T.grid, type: [2, 4] } },
    },
    dataZoom: [
      { id: "inside", type: "inside", xAxisIndex: 0, filterMode: "none", minValueSpan: 4, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false, preventDefaultMouseMove: true },
      {
        id: "slider", type: "slider", xAxisIndex: 0, filterMode: "none", height: 22, bottom: 14, left: width < 520 ? 32 : 44, right: width < 520 ? 46 : 72, showDetail: false, brushSelect: false,
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

export const LifeChart = forwardRef(function LifeChart({ scene, mode, theme, pinned, onHover, onPin, onView, initialWindow }, ref) {
  const box = useRef(null);
  const chart = useRef(null);
  const state = useRef({ window: null, level: null, dots: [], first: true });
  const [ready, setReady] = useState(false);

  const range = () => [scene.lifeStart - 1, scene.endX + 0.5];
  const render = (first = false) => {
    const c = chart.current;
    if (!c) return;
    const T = readTokens(box.current);
    const { window } = state.current;
    const level = levelOf(Math.min(window[1], scene.lifeEnd + 2) - window[0]);
    state.current.level = level;
    state.current.dots = scene.people.flatMap((p) => [...visibleNodes(p, level, window, 99).dots, ...p.posthumous]);
    const option = buildOption({ scene, mode, level, window, T, width: c.getWidth(), pinned, first });
    option.dataZoom[0].startValue = option.dataZoom[1].startValue = window[0];
    option.dataZoom[0].endValue = option.dataZoom[1].endValue = window[1];
    c.setOption(option, { replaceMerge: ["series"], lazyUpdate: false });
    onView?.({ level, window, span: window[1] - window[0] });
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
    let timer = 0;
    const onZoom = () => {
      const dz = c.getOption().dataZoom[0];
      const [lo, hi] = range();
      const w = [lo + ((hi - lo) * dz.start) / 100, lo + ((hi - lo) * dz.end) / 100];
      state.current.window = w;
      clearTimeout(timer);
      timer = setTimeout(() => render(), 70);
    };
    const toPixel = (n) => c.convertToPixel({ gridIndex: 0 }, [n.x, n.score]);
    const pick = (e) => nearest(state.current.dots, [e.offsetX, e.offsetY], toPixel);
    const move = (e) => {
      const n = pick(e);
      onHover?.(n ? { node: n, pixel: toPixel(n) } : null);
      box.current.style.cursor = n ? "pointer" : "grab";
    };
    const click = (e) => { const n = pick(e); if (n) onPin?.(n); };
    const dbl = (e) => { const n = pick(e); if (n) api.focus(n); };
    const out = () => onHover?.(null);
    c.on("datazoom", onZoom);
    const zr = c.getZr();
    zr.on("mousemove", move); zr.on("click", click); zr.on("dblclick", dbl); zr.on("globalout", out);
    return () => { clearTimeout(timer); c.off("datazoom", onZoom); zr.off("mousemove", move); zr.off("click", click); zr.off("dblclick", dbl); zr.off("globalout", out); };
  }, [ready, scene, mode, onHover, onPin]);

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

  return <div ref={box} className="v3-chart-canvas" role="img" aria-label="人生走势图：滚轮缩放，拖动平移，点击节点查看详情" />;
});

export { LEVELS };
