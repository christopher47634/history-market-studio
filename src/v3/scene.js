// v3 图表场景：把一到两个人物（v2 数据）换算成连续横轴上的点、K 线和标注，
// 并按当前可见跨度决定显示哪一层细节（全景 / 章节 / 细读）。纯函数，Node 端可测。
import { lifePoints, afterPoints, axisLayout, livesOverlap, formatYear, TODAY } from "../v2/model.js";

// 缩放层级：按可见窗口跨多少年划分。阈值取阅读习惯——
// 全景看一生的起落（只标几件大事），章节看十几到几十年（标出每个阶段），细读看十年以内（连小事和引文一起看）。
export const LEVELS = [
  { key: "overview", label: "全景", hint: "一生起落，只标大事", minSpan: 40 },
  { key: "chapter", label: "章节", hint: "逐个阶段，标出每一步", minSpan: 12 },
  { key: "detail", label: "细读", hint: "逐年细节，连小事和原文", minSpan: 0 },
];
export const levelOf = (span) => LEVELS.find((l) => span >= l.minSpan) ?? LEVELS.at(-1);
// 点击层级按钮时用的目标跨度。
export const LEVEL_SPAN = { overview: Infinity, chapter: 24, detail: 8 };

const ageAt = (born, year) => year - born - (born < 0 && year > 0 ? 1 : 0);

// 场景：横轴 x 在生前是纪年（或年龄），身后段按对数压缩到右侧一截。
export function buildScene(figures, axisChoice) {
  const list = figures.filter(Boolean);
  const axis = list.length === 1 ? axisChoice ?? "year" : axisChoice ?? (livesOverlap(list[0], list[1]) ? "year" : "age");
  const L = axisLayout(list, axis);
  const lastDeath = Math.max(...list.map((f) => f.died.year));
  const people = list.map((f, slot) => {
    const life = lifePoints(f);
    const xOfYear = (year) => (axis === "year" ? year : ageAt(f.born.year, year));
    // 生前节点：阶段事件和终章在主线上；子事件是主线旁的小点。
    const main = life.map((p, i) => ({
      id: `${f.id}:${i}`, figure: f, slot, kind: p.kind === "finale" ? "finale" : "stage",
      x: axis === "year" ? p.t : p.ageT, year: p.year, age: p.age, score: p.score,
      delta: i ? +(p.score - life[i - 1].score).toFixed(1) : 0, event: p.event,
    }));
    const subs = f.events.filter((e) => e.kind === "sub").map((e, i) => ({
      id: `${f.id}:s${i}`, figure: f, slot, kind: "sub", x: xOfYear(e.year) + 0.5, year: e.year, age: e.age, score: e.score, delta: 0, event: e,
    }));
    const tail = afterPoints(f).map((p, i) => ({
      id: `${f.id}:p${i}`, figure: f, slot, kind: i ? "posthumous" : "anchor",
      x: L.afterX(f, p.year), year: p.year, age: null, score: p.score, delta: 0, event: p.event,
    }));
    const nodes = [...main, ...subs].sort((a, b) => a.x - b.x);
    rankImportance(main);
    for (const s of subs) s.importance = 0;
    return { figure: f, slot, main, subs, tail, nodes, posthumous: tail.slice(1) };
  });
  const lifeStart = Math.min(...people.map((p) => p.main[0].x));
  const toYear = (x) => (x <= L.lifeEnd ? Math.floor(x) : Math.min(TODAY, Math.round(lastDeath + Math.expm1(((x - L.lifeEnd) / (L.endX - L.lifeEnd)) * Math.log1p(TODAY - lastDeath)))));
  const formatX = (x) => {
    if (x > L.lifeEnd + 1e-6) return axis === "year" ? formatYear(toYear(x)) : "身后";
    return axis === "year" ? formatYear(Math.floor(x)) : `${Math.floor(x)}岁`;
  };
  return { axis, people, lifeStart, lifeEnd: L.lifeEnd, endX: L.endX, formatX, toYear, span: L.lifeEnd - lifeStart };
}

// 重要度：势的变化幅度为主，峰值、谷底、终章另加分。全景里只给最重要的几件大事挂标签。
function rankImportance(main) {
  const peak = main.reduce((a, b) => (b.score > a.score ? b : a));
  const trough = main.slice(1, -1).reduce((a, b) => (b.score < a.score ? b : a), main[1] ?? main[0]);
  main.forEach((n, i) => {
    n.importance = Math.abs(n.delta) + (n === peak ? 40 : 0) + (n === trough && Math.abs(n.delta) > 8 ? 18 : 0) + (n.kind === "finale" ? 22 : 0) + (i === 0 ? -100 : 0);
  });
}

// 某一层要显示的节点：返回 { dots, labels }。
// labelBudget = 这一层、这个宽度下每人最多挂几个标签（其余只画点）。
export function visibleNodes(person, level, window, labelBudget) {
  const inView = (n) => n.x >= window[0] - 0.5 && n.x <= window[1] + 0.5;
  const main = person.main.filter(inView);
  const subs = level.key === "overview" ? [] : person.subs.filter(inView);
  const dots = [...main, ...subs];
  // 贴着视窗左右边缘的节点不挂标签，免得标签被裁掉一半。
  const margin = (window[1] - window[0]) * 0.05;
  const inner = (n) => n.x >= window[0] + margin && n.x <= window[1] - margin * 1.6;
  const pool = (level.key === "detail" ? dots : main).filter(inner);
  const labeled = pool.sort((a, b) => b.importance - a.importance || a.x - b.x).slice(0, labelBudget);
  const keep = new Set(labeled.map((n) => n.id));
  return { dots, labels: dots.filter((n) => keep.has(n.id)) };
}

// 每人的标签预算：按图宽估算（每个标签约占 120px），细读层放宽。
export function labelBudget(level, widthPx, peopleCount) {
  const base = Math.max(3, Math.floor(widthPx / 120 / peopleCount));
  return level.key === "overview" ? Math.min(6, base) : level.key === "chapter" ? Math.min(14, base + 2) : base + 6;
}

// K 线。全景：一根 = 一个人生阶段（上一个阶段事件 → 这个阶段事件），影线取阶段内子事件的高低；
// 章节 / 细读：一根 = 一个事件（含子事件），开盘是前一个事件的势。不虚构盘中波动。
// 每根都画在收盘那件事的时间点上（x = 收盘节点），和标签、十字光标对齐；x0 记下这一段从哪年开始。
export function candles(person, level) {
  if (level.key === "overview") {
    return person.main.slice(1).map((n, i) => {
      const prev = person.main[i];
      const inside = person.subs.filter((s) => s.x > prev.x && s.x <= n.x + 0.6);
      const all = [prev.score, n.score, ...inside.map((s) => s.score)];
      return { id: n.id, x0: prev.x, x1: n.x, x: n.x, open: prev.score, close: n.score, low: Math.min(...all), high: Math.max(...all), node: n, subs: inside };
    });
  }
  const seq = person.nodes;
  return seq.slice(1).map((n, i) => {
    const prev = seq[i];
    return { id: n.id, x0: prev.x, x1: n.x, x: n.x, open: prev.score, close: n.score, low: Math.min(prev.score, n.score), high: Math.max(prev.score, n.score), node: n, subs: [] };
  });
}

// 光标吸附（看盘软件的十字光标）：按列吸附，横向离得最近的节点胜出，不必压中小点。
// 两人同图时竖直距离也算一部分，用来在同一年的两个人之间挑；prev 是上一次吸附的节点，
// 新候选要明显更近（hold 像素）才换过去，免得在两根 K 线中间来回跳。
export function nearest(nodes, px, toPixel, { yWeight = 0.02, prev = null, hold = 4 } = {}) {
  let best = null, bestD = Infinity, prevD = Infinity;
  for (const n of nodes) {
    const [x, y] = toPixel(n);
    const d = Math.abs(x - px[0]) + Math.abs(y - px[1]) * yWeight;
    if (n === prev) prevD = d;
    if (d < bestD) { best = n; bestD = d; }
  }
  return prev && best !== prev && prevD - bestD < hold ? prev : best;
}

// 当前层级下某个节点对应的那根 K 线（没有就返回 null，比如全景里的细节小事）。
export function candleOf(person, level, node) {
  return node ? candles(person, level).find((k) => k.node.id === node.id) ?? null : null;
}

// 某人在横坐标 x 处的势（沿图上画出的那条线线性取值）；还没出生返回 null。
// 用于两人同图时，光标停在一个人身上，另一个人显示「同期」读数。
export function valueAt(person, x, level) {
  const line = [...(level.key === "overview" ? person.main : person.nodes), ...person.tail.slice(1)];
  if (x < line[0].x) return null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (x <= b.x) return +(a.score + ((b.score - a.score) * (x - a.x)) / (b.x - a.x || 1)).toFixed(1);
  }
  return line.at(-1).score;
}

// 纵轴范围：全景固定 0–100、每 25 一格（跨人物可比）；放大后按视窗里的数据自动适配（看盘软件的做法），
// 上下留一点余量，按跨度挑 5 / 10 / 20 的整刻度，至少跨 20。返回 [下限, 上限, 刻度]。
export function yRange(people, level, window) {
  if (level.key === "overview") return [0, 100, 25];
  const vals = people.flatMap((p) => [...p.nodes, ...p.tail].filter((n) => n.x >= window[0] - 1 && n.x <= window[1] + 1).map((n) => n.score));
  people.forEach((p) => {
    // 视窗边缘外的第一个点也算上，线条从画面外伸进来时不会被截掉。
    const before = p.nodes.filter((n) => n.x < window[0]).at(-1);
    const after = [...p.nodes, ...p.tail].find((n) => n.x > window[1]);
    if (before) vals.push(before.score);
    if (after) vals.push(after.score);
  });
  if (!vals.length) return [0, 100, 25];
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(3, (max - min) * 0.15);
  const raw = Math.max(20, max - min + pad * 2);
  const step = raw <= 30 ? 5 : raw <= 60 ? 10 : 20;
  let lo = Math.max(0, Math.floor((min - pad) / step) * step);
  let hi = Math.min(100, Math.ceil((max + pad) / step) * step);
  while (hi - lo < 20) { if (hi < 100) hi += step; else lo -= step; }
  return [Math.max(0, lo), hi, step];
}

// 阅读顺序：两人的全部生前节点按时间排好，供左右键逐个翻看和底部时间条使用。
export function readingOrder(scene) {
  return scene.people.flatMap((p) => p.nodes).sort((a, b) => a.x - b.x || a.slot - b.slot);
}
