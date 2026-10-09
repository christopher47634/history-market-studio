// 索引页的板块：六个领域板块（按人物主领域）+ 几个按走势形态算出来的特色板块。
// 纯函数，Node 端可测。trend = 生前主线的势（出生 → 各阶段 → 终章）。

export const DOMAIN_BOARDS = [
  { id: "政治治理", label: "政治", hint: "帝王、宰辅、改革与治理" },
  { id: "军事战略", label: "军事", hint: "统帅、名将与开国征战" },
  { id: "思想学术", label: "思想", hint: "诸子、经史与学术" },
  { id: "文学艺术", label: "文艺", hint: "诗文、书画与戏曲" },
  { id: "科技实业", label: "科技·实业", hint: "科学、工程、医学与实业" },
  { id: "社会变革", label: "变革", hint: "变法、革命与启蒙" },
];

const peakOf = (t) => Math.max(...t);
// 最大回撤：从此前高点到之后低点的最大跌幅（不含终章，去世那一下不算）。
export function drawdown(trend) {
  let hi = -Infinity, dd = 0;
  for (const v of trend.slice(0, -1)) { hi = Math.max(hi, v); dd = Math.max(dd, hi - v); }
  return dd;
}
// 跌下去之后又涨回来的幅度（最大回撤之后的反弹）。
function rebound(trend) {
  const t = trend.slice(0, -1);
  let hi = -Infinity, best = 0, lowAt = -1, low = Infinity;
  t.forEach((v, i) => { hi = Math.max(hi, v); if (hi - v > best) { best = hi - v; lowAt = i; low = v; } });
  return lowAt < 0 ? 0 : Math.max(0, ...t.slice(lowAt)) - low;
}

// 特色板块：像行情软件的概念板块，用走势形态把不同领域的人归到一起。metric 用于板块内排序。
export const SPECIAL_BOARDS = [
  { id: "逆袭", label: "逆袭", hint: "起点很低（≤20），一生做到 90 以上", test: (f) => f.trend[0] <= 20 && peakOf(f.trend) >= 90, metric: (f) => peakOf(f.trend) - f.trend[0] },
  { id: "长牛", label: "长牛", hint: "一路走高，生前最大回撤不超过 5", test: (f) => drawdown(f.trend) <= 5 && peakOf(f.trend) >= 80, metric: (f) => peakOf(f.trend) },
  { id: "大起大落", label: "大起大落", hint: "生前跌过 45 以上，之后又涨回 25 以上", test: (f) => drawdown(f.trend) >= 45 && rebound(f.trend) >= 25, metric: (f) => drawdown(f.trend) },
  { id: "盛极而衰", label: "盛极而衰", hint: "终章比一生最高点低 55 以上", test: (f) => f.trend.at(-1) <= peakOf(f.trend) - 55, metric: (f) => peakOf(f.trend) - f.trend.at(-1) },
  { id: "身后封神", label: "身后封神", hint: "后世评价比生前最高的势还高 25 以上", test: (f) => f.legacy.score - peakOf(f.trend) >= 25, metric: (f) => f.legacy.score - peakOf(f.trend) },
];

export const BOARDS = [{ id: "all", label: "全部", hint: "全部人物" }, ...DOMAIN_BOARDS, ...SPECIAL_BOARDS];
export const boardById = Object.fromEntries(BOARDS.map((b) => [b.id, b]));

export function inBoard(f, board) {
  if (!board || board.id === "all") return true;
  if (board.test) return f.trend.length > 1 && board.test(f);
  return f.domain === board.id;
}

export const SORTS = [
  { value: "legacy", label: "后世评价" },
  { value: "peak", label: "峰值" },
  { value: "time", label: "时代" },
  { value: "move", label: "振幅" },
];

// 筛选 + 排序。words 已转小写、按空格切开；特色板块默认按它自己的指标排。
export function filterFigures(figures, { board, words = [], era = "all", sort = "legacy", dynastyOrder = [] }) {
  const b = typeof board === "string" ? boardById[board] : board;
  const list = figures.filter((f) => inBoard(f, b) && (era === "all" || f.dynasty === era) && words.every((w) => f.searchText.includes(w)));
  const key = {
    legacy: (f) => -f.legacy.score,
    peak: (f) => -(f.peak?.score ?? 0),
    time: (f) => dynastyOrder.indexOf(f.dynasty) * 10000 + f.born,
    move: (f) => -(peakOf(f.trend) - Math.min(...f.trend)),
    board: (f) => -(b?.metric?.(f) ?? 0),
  }[sort === "board" && !b?.metric ? "legacy" : sort];
  return list.sort((x, y) => key(x) - key(y) || x.born - y.born);
}

// 板块概览：人数、平均后世评价、领涨（后世评价最高）的三个人。
export function boardStats(figures, board) {
  const list = figures.filter((f) => inBoard(f, board));
  const avg = list.length ? Math.round(list.reduce((s, f) => s + f.legacy.score, 0) / list.length) : 0;
  const leaders = [...list].sort((a, b) => (board.metric ? board.metric(b) - board.metric(a) : b.legacy.score - a.legacy.score)).slice(0, 3);
  return { count: list.length, avg, leaders };
}
