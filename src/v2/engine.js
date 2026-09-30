// 把 v2 数据接到旧版玉衡 / 朱砂界面上：
// - toLegacyFigure：v2 人物 → 旧界面认识的人物结构（保留旧版的分期、领域、配色等索引字段）
// - buildComparisonV2：两人对比曲线（纪年轴 / 年龄轴，身后段对数压缩），结构与旧 buildComparison 相同
// - getCandleViewV2：阶段 K 线 / 放大后的事件 K 线，结构与旧 getCandleView 相同
import { lifePoints, afterPoints, axisLayout, livesOverlap, valueAt, xOf, formatYear, stageCandles, eventCandles, TODAY } from "./model.js";

const CERTAINTY = { 估计: "estimated", 确知: "exact" };

function legacyEvent(e, f, extra = {}) {
  const quote = e.quote;
  return {
    year: e.year,
    age: extra.age ?? e.age,
    title: e.title,
    score: e.score,
    delta: e.delta ?? 0,
    summary: e.summary ?? e.reason ?? e.rationale ?? "",
    dimension: e.tier ? `${e.tier}${e.crisis && e.crisis !== "平稳" ? " · " + e.crisis : ""}` : extra.dimension ?? "",
    rationale: e.rationale ?? e.reason ?? "",
    tier: e.tier, tierScore: e.tierScore, crisis: e.crisis, crisisPenalty: e.crisisPenalty,
    kind: extra.kind ?? e.kind,
    posthumous: Boolean(extra.posthumous),
    source: { label: quote?.source ?? f.sources[0]?.label ?? "史料概括", url: quote?.url ?? f.sources[0]?.url ?? "", type: "primary", scope: "biography" },
    evidence: { sourceType: "primary", sourceScope: "biography", dateCertainty: CERTAINTY[e.yearCertainty] ?? "exact", scoreNature: "interpretive-model", basis: quote ? "原文" : "概括" },
    citation: quote
      ? { kind: "史书原文", quote: quote.textSimplified ?? quote.text, isExcerpt: true, url: quote.url, source: quote.source }
      : { kind: "事件概括", quote: "", isExcerpt: false, note: e.rationale || e.reason || "此事件没有可逐字核验的原文，内容为概括。", url: f.sources[0]?.url ?? "", source: f.sources[0]?.label ?? "维基百科等资料概括" },
  };
}

export function toLegacyFigure(v2, old = {}) {
  const life = lifePoints(v2);
  const events = life.map((p, i) => {
    const e = p.kind === "finale" ? { ...v2.finale, kind: "finale", summary: v2.finale.reason, rationale: `保留生前 ${Math.round(v2.finale.retention * 100)}%：${v2.finale.reason}` } : p.event;
    return legacyEvent({ ...e, delta: i ? +(p.score - life[i - 1].score).toFixed(1) : 0 }, v2, { age: p.age, kind: p.kind });
  });
  const posthumous = v2.posthumous.map((p) => legacyEvent({ ...p, summary: p.rationale }, v2, { posthumous: true, kind: "posthumous", age: v2.lifeSpan, dimension: "身后" }));
  return {
    ...old,
    id: v2.id,
    name: v2.name,
    born: v2.born.year,
    died: v2.died.year,
    lifeSpan: v2.lifeSpan,
    thesis: v2.thesis ?? old.thesis,
    events: [...events, ...posthumous],
    subEvents: v2.events.filter((e) => e.kind === "sub").map((e) => legacyEvent(e, v2)),
    legacy: v2.legacy,
    peak: v2.peak,
    v2,
  };
}

const ageLabel = (x) => `${Number.isInteger(x) ? x : x.toFixed(1)}岁`;

export function buildComparisonV2(left, right, axisChoice) {
  const a = left.v2, b = right.v2;
  const axis = axisChoice === "year" && livesOverlap(a, b) ? "year" : axisChoice === "age" ? "age" : livesOverlap(a, b) ? "year" : "age";
  const L = axisLayout([a, b], axis);
  const span = L.lifeEnd - L.lifeStart;
  const step = span > 160 ? 0.5 : 0.25;
  const lifeXs = [];
  for (let x = L.lifeStart; x <= L.lifeEnd + 1e-9; x += step) lifeXs.push(+x.toFixed(3));
  const TAIL = 36;
  const tailXs = Array.from({ length: TAIL }, (_, i) => +(L.lifeEnd + ((i + 1) / TAIL) * (L.endX - L.lifeEnd)).toFixed(3));
  const rawAxis = [...lifeXs, ...tailXs];
  const lastDeath = Math.max(a.died.year, b.died.year);
  const tailYear = (x) => Math.round(lastDeath + Math.expm1(((x - L.lifeEnd) / (L.endX - L.lifeEnd)) * Math.log1p(TODAY - lastDeath)));
  const axisLabels = rawAxis.map((x, i) => (i >= lifeXs.length ? (axis === "year" ? `身后·${formatYear(tailYear(x))}` : "身后") : axis === "year" ? formatYear(Math.floor(x)) : ageLabel(x)));

  const series = (f, legacyFig) => {
    const life = lifePoints(f);
    const tail = afterPoints(f).map((p) => ({ score: p.score, year: L.afterX(f, p.year), age: L.afterX(f, p.year), event: p.event }));
    const lifeEvents = legacyFig.events.filter((e) => !e.posthumous);
    const postEvents = legacyFig.events.filter((e) => e.posthumous);
    const points = rawAxis.map((x, i) => {
      const inLife = valueAt(life, x, axis);
      const inTail = inLife == null ? valueAt(tail, x, axis) : null;
      const value = inLife ?? inTail;
      return { value: value == null ? null : +value.toFixed(1), raw: x, age: axis === "age" ? x : x - f.born.year, axisLabel: axisLabels[i], event: null, posthumous: inLife == null && inTail != null };
    });
    // 把事件放到离它最近的空格子上：左右交替找，生前事件不得越过去世那一格，身后事件不得落进生前区。
    const place = (x, event, score, posthumous) => {
      const lo = posthumous ? lifeXs.length : 0;
      const hi = posthumous ? rawAxis.length - 1 : lifeXs.length - 1;
      let near = rawAxis.reduce((best, r, i) => (Math.abs(r - x) < Math.abs(rawAxis[best] - x) ? i : best), 0);
      near = Math.min(hi, Math.max(lo, near));
      for (let d = 0; d <= 8; d++) {
        for (const idx of d ? [near + d, near - d] : [near]) {
          if (idx < lo || idx > hi || points[idx].event) continue;
          points[idx] = { ...points[idx], event, value: score, posthumous };
          return;
        }
      }
    };
    life.forEach((p, i) => place(xOf(p, axis), lifeEvents[i], p.score, false));
    // 身后事件从最近的往回放，保证「今日评价」一定落在最后一格。
    tail.slice(1).map((p, i) => [p, postEvents[i]]).reverse().forEach(([p, e]) => place(p.year, e, p.score, true));
    return points;
  };
  // 生前和身后拆成两条：身后段画得更淡。
  const split = (points) => ({
    life: points.map((p) => (p.posthumous ? { ...p, value: null } : p)),
    tail: points.map((p, i) => (p.posthumous || points[i + 1]?.posthumous ? p : { ...p, value: null, event: null })),
  });
  const ls = split(series(a, left)), rs = split(series(b, right));
  // 默认视窗：从两人中较早的第一个成年阶段事件前 3 年开始，童年与史料空白先收在视窗外，缩小即可看到。
  const firstAdult = Math.min(...[a, b].map((f) => {
    const p = lifePoints(f).find((q, i) => i > 0 && q.age >= 15) ?? lifePoints(f)[0];
    return xOf(p, axis);
  }));
  const startIdx = Math.max(0, rawAxis.findIndex((x) => x >= firstAdult - 3));
  const focus = { start: +((startIdx / (rawAxis.length - 1)) * 100).toFixed(2), end: 100 };
  return {
    sameEra: axis === "year", key: axis, step, rawAxis, axis: axisLabels, focus,
    maxAge: Math.ceil(Math.max(a.lifeSpan, b.lifeSpan)),
    range: axis === "year" ? `${formatYear(Math.min(a.born.year, b.born.year))}—${formatYear(Math.max(a.died.year, b.died.year))}` : `0—${Math.ceil(Math.max(a.lifeSpan, b.lifeSpan))} 岁`,
    left: ls.life, right: rs.life, leftTail: ls.tail, rightTail: rs.tail,
    lifeEndIndex: lifeXs.length - 1,
  };
}

export function getCandleViewV2(figure, span = 100) {
  const f = figure.v2;
  const fine = span < 55;
  const raw = fine ? eventCandles(f) : stageCandles(f);
  const byTitle = new Map([...figure.events, ...(figure.subEvents ?? [])].map((e) => [e.title, e]));
  const candles = raw.map((c) => ({ ...c, event: byTitle.get(c.event.title) ?? null }));
  return {
    granularity: { key: fine ? "micro" : "macro", label: fine ? `逐事件 · ${candles.length} 根` : `人生阶段 · ${candles.length} 根`, trendDominant: false },
    candles,
    categories: candles.map((c) => `${c.event?.title ?? ""}\n${ageLabel(c.age)}`),
    values: candles.map((c) => [c.open, c.close, c.low, c.high]),
    trend: candles.map((c) => c.close),
  };
}
