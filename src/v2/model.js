// v2 图表模型：只用 data/v2/figures 里经过校验的数据，不生成任何假波动。
import generated from "./figures.generated.js";

export const figuresV2 = [...generated].sort((a, b) => a.born.year - b.born.year);
export const figureV2ById = Object.fromEntries(figuresV2.map((f) => [f.id, f]));

export const TODAY = 2026;
export const formatYear = (y) => (y < 0 ? `前${-y}` : `${y}`);

const stagesOf = (f) => f.events.filter((e) => e.kind === "stage");

// 生前主线：阶段事件 + 终章。相邻两点相隔超过 15 年的那一段标为史料空白。
// 同一年里有多个事件时（刘邦前 206 年入咸阳、鸿门、封汉王、还定三秦），按先后在这一年里均匀排开，
// 否则会在同一个 x 上画出竖直的针。year/age 保留原值，t/ageT 是画图用的位置。
function spreadWithinYear(pts) {
  const counts = new Map();
  pts.forEach((p) => counts.set(p.year, (counts.get(p.year) ?? 0) + 1));
  const seen = new Map();
  return pts.map((p) => {
    const i = seen.get(p.year) ?? 0;
    seen.set(p.year, i + 1);
    const frac = i / counts.get(p.year);
    return { ...p, t: p.year + frac, ageT: p.age + frac };
  });
}

const cache = new WeakMap();
export function lifePoints(f) {
  if (cache.has(f)) return cache.get(f);
  const pts = stagesOf(f).map((e) => ({ year: e.year, age: e.age, score: e.score, event: e, kind: "stage" }));
  pts.push({ year: f.finale.year, age: f.finale.age, score: f.finale.score, event: { ...f.finale, kind: "finale" }, kind: "finale" });
  const out = spreadWithinYear(pts).map((p, i, arr) => ({ ...p, gapBefore: i > 0 && p.year - arr[i - 1].year > 15 }));
  cache.set(f, out);
  return out;
}

// 身后声望线：终章 → 身后事件 → 今日（= 后世评价）。
export function afterPoints(f) {
  return [
    { year: f.finale.year, score: f.finale.score, event: null },
    ...f.posthumous.map((p) => ({ year: p.year, score: p.score, event: { ...p, kind: "posthumous" } })),
  ];
}

// 对数压缩：身后头几十年、几百年拉得开，越往后越密。
const squash = (d, total) => Math.log1p(Math.max(0, d)) / Math.log1p(total);

// 横轴布局：生前按真实纪年或年龄展开，身后部分压成右侧固定宽度的一段（到「今日」），
// 否则两千年的身后线会把生前走势挤成一条细线。
export function axisLayout(figures, axis) {
  const lives = figures.map((f) => lifePoints(f));
  const lifeStart = Math.min(...lives.map((p) => xOf(p[0], axis)));
  const lifeEnd = Math.max(...lives.map((p) => xOf(p.at(-1), axis)));
  const tail = Math.max(4, (lifeEnd - lifeStart) * 0.2);
  const endX = lifeEnd + tail;
  // 纪年轴：先按真实年份走到最后一人去世，再压缩到今日；年龄轴：从本人去世年龄起压缩。
  const lastDeathYear = Math.max(...figures.map((f) => f.died.year));
  const afterX = (f, year) => {
    if (axis === "year") {
      if (year <= lastDeathYear) return year === f.died.year ? xOf(lifePoints(f).at(-1), axis) : year;
      return lifeEnd + (endX - lifeEnd) * squash(year - lastDeathYear, TODAY - lastDeathYear);
    }
    const from = xOf(lifePoints(f).at(-1), axis);
    return from + (endX - from) * squash(year - f.died.year, TODAY - f.died.year);
  };
  return { lifeStart, lifeEnd, endX, afterX };
}

// 两人生命有重叠 → 公元纪年轴；否则年龄轴。
export const livesOverlap = (a, b) => a.born.year <= b.died.year && b.born.year <= a.died.year;
export const defaultAxis = (a, b) => (b && livesOverlap(a, b) ? "year" : "age");
export const xOf = (point, axis) => (axis === "year" ? point.t ?? point.year : point.ageT ?? point.age);

// 分段线性取值（用于比较和反超点计算，画线时 ECharts 另做单调平滑）。
export function valueAt(points, x, axis) {
  const xs = points.map((p) => xOf(p, axis));
  if (x < xs[0] || x > xs.at(-1)) return null;
  for (let i = 1; i < points.length; i++) {
    if (x <= xs[i]) {
      const span = xs[i] - xs[i - 1];
      const t = span ? (x - xs[i - 1]) / span : 1;
      return points[i - 1].score + (points[i].score - points[i - 1].score) * t;
    }
  }
  return points.at(-1).score;
}

// 反超点：两条生前线在共同区间内高低次序发生变化的位置，归因到离它最近的一个事件。
export function crossovers(a, b, axis) {
  const pa = lifePoints(a), pb = lifePoints(b);
  const lo = Math.max(xOf(pa[0], axis), xOf(pb[0], axis));
  const hi = Math.min(xOf(pa.at(-1), axis), xOf(pb.at(-1), axis));
  if (lo >= hi) return [];
  const xs = [...new Set([...pa, ...pb].map((p) => xOf(p, axis)).filter((x) => x >= lo && x <= hi))].sort((m, n) => m - n);
  const out = [];
  let prevSign = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = valueAt(pa, xs[i], axis) - valueAt(pb, xs[i], axis);
    const sign = Math.sign(Math.round(d * 10));
    if (sign && prevSign && sign !== prevSign) {
      const x0 = xs[i - 1], d0 = valueAt(pa, x0, axis) - valueAt(pb, x0, axis);
      const x = x0 + (xs[i] - x0) * (d0 / (d0 - d));
      const leader = sign > 0 ? a : b;
      const cause = [...pa, ...pb].filter((p) => p.event).reduce((best, p) => (Math.abs(xOf(p, axis) - x) < Math.abs(xOf(best, axis) - x) ? p : best));
      out.push({ x, score: valueAt(pa, x, axis), leader, trailer: leader === a ? b : a, cause: cause.event });
    }
    if (sign) prevSign = sign;
  }
  return out;
}

// K 线。
// 阶段级：一根蜡烛 = 一个人生阶段（上一个阶段事件 → 这个阶段事件），影线取阶段内子事件的最好和最坏。
// 事件级：放大后每个事件（含子事件）一根，影线就是开收，不虚构盘中波动。
export function stageCandles(f) {
  const life = lifePoints(f);
  const subs = f.events.filter((e) => e.kind === "sub");
  return life.slice(1).map((p, i) => {
    const prev = life[i];
    const inside = subs.filter((s) => s.year >= prev.year && s.year <= p.year && s.age > prev.age - 1e-9);
    const scores = [prev.score, p.score, ...inside.map((s) => s.score)];
    return { year: p.year, age: p.age, open: prev.score, close: p.score, low: Math.min(...scores), high: Math.max(...scores), event: p.event, subs: inside, from: prev.event };
  });
}

export function eventCandles(f) {
  const seq = [...f.events, { ...f.finale, kind: "finale" }];
  return seq.slice(1).map((e, i) => {
    const prev = seq[i];
    return { year: e.year, age: e.age, open: prev.score, close: e.score, low: Math.min(prev.score, e.score), high: Math.max(prev.score, e.score), event: e, subs: [], from: prev };
  });
}

// 读数：光标在点上显示当时的势，不在图上显示后世评价。
export function readout(f, hovered) {
  if (hovered && hovered.figureId === f.id && hovered.score != null) {
    return { mode: "then", value: hovered.score, label: hovered.posthumous ? "当时声望" : "当时的势", detail: hovered.title };
  }
  return { mode: "legacy", value: f.legacy.score, label: "后世评价", detail: `${f.legacy.tier} · ${f.legacy.label}` };
}
