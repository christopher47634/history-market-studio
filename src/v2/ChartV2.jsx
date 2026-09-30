import { useEffect, useMemo, useRef } from "react";
import { lifePoints, afterPoints, crossovers, stageCandles, eventCandles, valueAt, xOf, formatYear, axisLayout } from "./model.js";

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtX = (x, axis) => (axis === "year" ? formatYear(Math.round(x)) : `${Math.round(x)}岁`);

function cardHTML(e, figure, color, extra = "") {
  if (!e) return "";
  const quote = e.quote ? `<blockquote>${esc(e.quote.textSimplified)}<cite>${esc(e.quote.source)}</cite></blockquote>` : `<p class="v2tip__basis">依据：概括，无可核验原文</p>`;
  const scoreLine = e.kind === "finale"
    ? `终章 <b>${e.score}</b> · 保留 ${Math.round(e.retention * 100)}%`
    : e.kind === "posthumous" ? `身后声望 <b>${e.score}</b>`
    : `势 <b>${e.score}</b> <span>${esc(e.tier)} ${e.tierScore}${e.crisisPenalty ? ` − ${esc(e.crisis)} ${e.crisisPenalty}` : ""}</span>`;
  return `<div class="v2tip"><header><i style="background:${color}"></i>${esc(figure.name)} · ${formatYear(e.year)}${e.age != null ? ` · ${e.age}岁` : ""}</header>
    <h4>${esc(e.title)}</h4>${extra}<div class="v2tip__score">${scoreLine}</div>
    <p>${esc(e.summary ?? e.reason ?? e.rationale ?? "")}</p>${e.rationale && e.kind !== "posthumous" ? `<p class="v2tip__why">为什么是这个分：${esc(e.rationale)}</p>` : ""}${e.kind === "posthumous" ? "" : quote}</div>`;
}

export function ChartV2({ a, b, axis, mode, kFigure, colors, onHover }) {
  const el = useRef(null);
  const chart = useRef(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;

  const option = useMemo(() => (mode === "k" ? kOption(kFigure, colors[kFigure === a ? 0 : 1]) : lineOption(a, b, axis, colors)), [a, b, axis, mode, kFigure, colors]);

  useEffect(() => {
    let disposed = false, ro;
    import("../echartsRuntime.js").then(({ init }) => {
      if (disposed || !el.current) return;
      chart.current = init(el.current, null, { renderer: "canvas" });
      chart.current.setOption(option, true);
      ro = new ResizeObserver(() => chart.current?.resize());
      ro.observe(el.current);
      chart.current.on("updateAxisPointer", (ev) => {
        const x = ev.axesInfo?.[0]?.value;
        hoverRef.current?.(x == null ? null : { x, axisType: chart.current.__v2axis });
      });
      chart.current.getZr().on("globalout", () => hoverRef.current?.(null));
      // K 线放大到一定程度，从「阶段」切到「每个事件」。
      chart.current.on("datazoom", () => {
        const c = chart.current;
        if (c.__v2mode !== "k") return;
        const z = c.getOption().dataZoom[0], span = z.end - z.start;
        // 滞回：放大到 45% 以内切事件级，缩回 90% 以上才切回阶段级，避免来回跳。
        const fine = c.__v2fine ? span < 90 : span < 60;
        if (fine === c.__v2fine) return;
        c.__v2fine = fine;
        c.setOption(kOption(c.__v2k, c.__v2color, fine, { start: z.start, end: z.end }), true);
        mark(c);
      });
      syncRef.current(chart.current);
    });
    return () => { disposed = true; ro?.disconnect(); chart.current?.dispose(); chart.current = null; };
  }, []);

  const sync = (c) => {
    c.__v2axis = axis;
    c.__v2mode = mode;
    c.__v2fine = false;
    c.__v2k = kFigure;
    c.__v2color = colors[kFigure === a ? 0 : 1];
    c.setOption(option, true);
    mark(c);
  };
  // 给测试和无障碍用：当前 K 线层级和蜡烛数。
  const mark = (c) => {
    if (!el.current) return;
    el.current.dataset.mode = c.__v2mode;
    el.current.dataset.kLevel = c.__v2mode === "k" ? (c.__v2fine ? "event" : "stage") : "";
    el.current.dataset.count = c.getOption().series[0]?.data?.length ?? 0;
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => { if (chart.current) sync(chart.current); }, [option]);

  return <div className="v2chart" ref={el} role="img" aria-label={mode === "k" ? `${kFigure.name}人生阶段 K 线` : `${a.name}与${b.name}人生走势对比`} />;
}

const grid = { left: 44, right: 24, top: 28, bottom: 44 };
const axisStyle = {
  axisLine: { lineStyle: { color: "rgba(214,232,226,.18)" } },
  axisLabel: { color: "rgba(214,232,226,.55)", fontSize: 11, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" },
  splitLine: { lineStyle: { color: "rgba(214,232,226,.06)" } },
};

function lineOption(a, b, axis, colors) {
  const series = [];
  const figures = [a, b];
  const L = axisLayout(figures, axis);
  figures.forEach((f, i) => {
    const color = colors[i];
    const pts = lifePoints(f);
    // 主线：史料空白段断开，另画一条淡线补上。
    const main = [];
    const gaps = [];
    pts.forEach((p, k) => {
      if (p.gapBefore) { main.push([xOf(p, axis) - 1e-6, null]); gaps.push([[xOf(pts[k - 1], axis), pts[k - 1].score], [xOf(p, axis), p.score]]); }
      main.push({ value: [xOf(p, axis), p.score], event: p.event, fig: f.id });
    });
    series.push({
      name: f.name, type: "line", data: main, smooth: 0.35, smoothMonotone: "x", connectNulls: false, showSymbol: true, symbol: "circle",
      symbolSize: (v, p) => (p.data?.event?.kind === "finale" ? 9 : 6),
      lineStyle: { width: 2, color }, itemStyle: { color, borderColor: "#07100e", borderWidth: 1.5 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + "1f" }, { offset: 1, color: color + "00" }] } },
      emphasis: { scale: 1.8 }, z: 3,
    });
    gaps.forEach((g) => series.push({ name: `${f.name}·史料空白`, type: "line", data: g, smooth: 0.35, symbol: "none", lineStyle: { width: 1.5, color, opacity: 0.28 }, tooltip: { show: false }, silent: true, z: 2 }));
    // 身后声望线：压在右侧「身后」区段里，终点 = 后世评价。
    const after = afterPoints(f);
    series.push({
      name: `${f.name}·身后`, type: "line", data: after.map((p) => ({ value: [L.afterX(f, p.year), p.score], event: p.event, fig: f.id, posthumous: true })),
      smooth: 0.3, symbol: "circle", symbolSize: (v, p) => (p.data?.event ? 5 : 0),
      lineStyle: { width: 1.25, color, opacity: 0.45 }, itemStyle: { color, opacity: 0.6 }, z: 1,
      endLabel: { show: true, formatter: `后世 ${f.legacy.score}`, color, fontSize: 11 },
    });
  });
  const cross = crossovers(a, b, axis);
  series.push({
    name: "反超", type: "scatter", symbol: "diamond", symbolSize: 11, z: 5,
    data: cross.map((c) => ({ value: [c.x, c.score], cross: c, itemStyle: { color: colors[c.leader === a ? 0 : 1], borderColor: "#f4efe2", borderWidth: 1.5 } })),
    label: { show: true, position: "top", formatter: (p) => `${p.data.cross.leader.name}反超`, color: "#f4efe2", fontSize: 11 },
  });
  // 身后区段：浅底色 + 分界线，横轴不再按真实年数。挂在第一条主线上（空 series 不画 mark）。
  series[0].markArea = { silent: true, itemStyle: { color: "rgba(244,239,226,.035)" }, data: [[{ xAxis: L.lifeEnd }, { xAxis: L.endX }]] };
  const edge = (x, text, position) => ({ xAxis: x, label: { show: true, formatter: text, position, color: "rgba(244,239,226,.45)", fontSize: 11 } });
  series[0].markLine = {
    silent: true, symbol: "none", lineStyle: { color: "rgba(244,239,226,.16)", type: "solid" },
    data: [
      ...(axis === "age" ? figures.map((f) => ({ xAxis: f.lifeSpan, label: { show: false } })) : []),
      edge(L.lifeEnd, "身后 →", "end"),
      edge(L.endX, "今日", "end"),
    ],
  };
  const pad = (L.endX - L.lifeStart) * 0.02;
  const tick = (x) => (x > L.lifeEnd + 1e-6 ? (Math.abs(x - L.endX) < pad ? "今日" : "") : fmtX(x, axis));
  return {
    __v2mode: "line", animationDuration: 500, grid,
    xAxis: {
      type: "value", min: L.lifeStart - pad, max: L.endX + pad * 3, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: tick, showMaxLabel: false }, splitLine: { show: false },
      axisPointer: { show: true, type: "line", snap: false, triggerTooltip: false, lineStyle: { color: "rgba(244,239,226,.25)", width: 1 }, label: { show: true, backgroundColor: "#16231f", color: "#f4efe2", formatter: (p) => (p.value > L.lifeEnd ? "身后" : fmtX(p.value, axis)) } },
    },
    yAxis: { type: "value", min: 0, max: 100, interval: 20, ...axisStyle },
    tooltip: {
      trigger: "item", confine: true, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none",
      formatter: (p) => {
        if (p.data?.cross) { const c = p.data.cross; return `<div class="v2tip"><header>${fmtX(c.x, axis)} · 反超</header><h4>${esc(c.leader.name)} 超过 ${esc(c.trailer.name)}</h4><p>最近的节点：${esc(c.cause.title)}（${formatYear(c.cause.year)}）</p></div>`; }
        const f = p.data?.fig === a.id ? a : b;
        return cardHTML(p.data?.event, f, colors[f === a ? 0 : 1]);
      },
    },
    dataZoom: [{ type: "inside", xAxisIndex: 0, filterMode: "none" }],
    series,
  };
}

function kOption(f, color, fine = false, zoom) {
  const candles = fine ? eventCandles(f) : stageCandles(f);
  const up = "#e5484d", down = "#2fae6e";
  return {
    __v2mode: "k", __v2fine: fine, animationDuration: 400, grid,
    xAxis: { type: "category", data: candles.map((c) => `${c.age}岁 ${c.event.title}`), ...axisStyle, splitLine: { show: false }, axisLabel: { ...axisStyle.axisLabel, hideOverlap: true, interval: 0, formatter: (v) => { const [age, ...t] = v.split(" "); const title = t.join(" "); return `${title.length > 6 ? title.slice(0, 6) + "…" : title}
{age|${age}}`; }, rich: { age: { color: "rgba(214,232,226,.38)", fontSize: 10, padding: [3, 0, 0, 0] } }, fontFamily: "inherit" } },
    yAxis: { type: "value", min: 0, max: 100, interval: 20, ...axisStyle },
    tooltip: {
      trigger: "item", confine: true, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none",
      formatter: (p) => {
        const c = candles[p.dataIndex];
        const ohlc = `<div class="v2tip__ohlc"><span>开 <b>${c.open}</b></span><span>收 <b class="${c.close >= c.open ? "up" : "down"}">${c.close}</b></span><span>高 <b>${c.high}</b></span><span>低 <b>${c.low}</b></span></div>`;
        const subs = c.subs.length ? `<p class="v2tip__why">阶段内：${c.subs.map((s) => `${esc(s.title)} ${s.score}`).join("，")}</p>` : "";
        return cardHTML(c.event, f, color, ohlc + subs);
      },
    },
    axisPointer: { show: true, type: "line", triggerTooltip: false, lineStyle: { color: "rgba(244,239,226,.2)" }, label: { show: false } },
    dataZoom: [{ type: "inside", xAxisIndex: 0, start: zoom?.start ?? 0, end: zoom?.end ?? 100, minValueSpan: 3 }],
    series: [{
      type: "candlestick", name: f.name, barMaxWidth: 26,
      data: candles.map((c) => [c.open, c.close, c.low, c.high]),
      itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
    }, {
      type: "line", data: candles.map((c) => c.close), smooth: 0.3, symbol: "none", lineStyle: { width: 1, color, opacity: 0.5 }, tooltip: { show: false }, silent: true,
    }],
  };
}

// 给读数用：某个 x 位置上某人的当时分数（生前线或压缩后的身后线）。
export function valueForReadout(f, x, axis, figures) {
  const life = lifePoints(f);
  const v = valueAt(life, x, axis);
  if (v != null) {
    const near = life.reduce((best, p) => (Math.abs(xOf(p, axis) - x) < Math.abs(xOf(best, axis) - x) ? p : best));
    return { score: +v.toFixed(1), title: near.event.title, posthumous: false };
  }
  const L = axisLayout(figures, axis);
  const tail = afterPoints(f).map((p) => ({ score: p.score, year: L.afterX(f, p.year), age: L.afterX(f, p.year), event: p.event }));
  const s = valueAt(tail, x, axis);
  if (s == null) return null;
  const near = tail.filter((p) => p.event).reduce((best, p) => (!best || Math.abs(p.year - x) < Math.abs(best.year - x) ? p : best), null);
  return { score: +s.toFixed(1), title: near ? near.event.title : "身后", posthumous: true };
}
