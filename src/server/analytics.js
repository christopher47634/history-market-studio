import { figureById, figures } from "../data.js";

const normalizeText = (value) =>
  String(value || "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN");

export const RANKING_METRICS = [
  "peak",
  "resilience",
  "alliance",
  "command",
  "legitimacy",
  "volatility",
  "drawdown",
  "retention",
  "efficiency",
];

function computeStats(figure) {
  const scores = figure.events.map((event) => Number(event.score) || 0);
  const deltas = figure.events.map((event) => Number(event.delta) || 0);

  let peakScore = 0;
  let troughScore = 100;
  let runningPeak = 0;
  let maxDrawdown = 0;
  for (const score of scores) {
    if (score > peakScore) peakScore = score;
    if (score < troughScore) troughScore = score;
    if (score > runningPeak) runningPeak = score;
    const dd = runningPeak - score;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const terminalScore = scores.length > 0 ? scores[scores.length - 1] : 0;
  const retention = peakScore > 0 ? Number(((terminalScore / peakScore) * 100).toFixed(1)) : 0;

  const meanDelta =
    deltas.length > 0 ? deltas.reduce((sum, d) => sum + d, 0) / deltas.length : 0;
  const variance =
    deltas.length > 0
      ? deltas.reduce((sum, d) => sum + (d - meanDelta) ** 2, 0) / deltas.length
      : 0;
  const volatility = Number(Math.sqrt(variance).toFixed(2));

  const span = Math.max(20, Number(figure.lifeSpan) || 50);
  const efficiency = Number(((peakScore / span) * 100).toFixed(2));

  const m = figure.metrics || {};
  return {
    peak: Number(peakScore.toFixed(1)),
    trough: Number(troughScore.toFixed(1)),
    terminal: Number(terminalScore.toFixed(1)),
    drawdown: Number(maxDrawdown.toFixed(1)),
    retention,
    volatility,
    efficiency,
    alliance: Number(m.alliance) || 0,
    command: Number(m.command) || 0,
    legitimacy: Number(m.legitimacy) || 0,
    resilience: Number(m.resilience) || 0,
    eventCount: figure.events.length,
    positiveEvents: deltas.filter((d) => d > 0).length,
    negativeEvents: deltas.filter((d) => d < 0).length,
  };
}

function featureVector(stats) {
  return [
    stats.alliance,
    stats.command,
    stats.legitimacy,
    stats.resilience,
    stats.peak,
    stats.retention,
    Math.min(100, stats.volatility * 2.5),
  ];
}

const DIMENSION_LABELS = [
  ["alliance", "联盟协作"],
  ["command", "军事/执行统御"],
  ["legitimacy", "制度合法性"],
  ["resilience", "逆境韧性"],
];

const ANALYTICS_ENTRIES = figures.map((figure) => {
  const stats = computeStats(figure);
  return {
    figure,
    stats,
    vector: featureVector(stats),
    period: normalizeText(figure.period),
    dynasty: normalizeText(figure.dynasty),
    domain: normalizeText(figure.domain),
  };
});

export const ANALYTICS_BY_ID = new Map(
  ANALYTICS_ENTRIES.map((entry) => [entry.figure.id, entry]),
);

const toSummary = (entry) => ({
  id: entry.figure.id,
  name: entry.figure.name,
  courtesy: entry.figure.courtesy,
  dynasty: entry.figure.dynasty,
  period: entry.figure.period,
  domain: entry.figure.domain,
  lifeSpan: entry.figure.lifeSpan,
  thesis: entry.figure.thesis,
  stats: entry.stats,
});

export function getRankings({
  metric = "peak",
  order = "desc",
  domain = "",
  period = "",
  dynasty = "",
  offset = 0,
  limit = 20,
}) {
  const normDomain = normalizeText(domain);
  const normPeriod = normalizeText(period);
  const normDynasty = normalizeText(dynasty);

  const filtered = ANALYTICS_ENTRIES.filter(
    (entry) =>
      (!normDomain || entry.domain === normDomain) &&
      (!normPeriod || entry.period === normPeriod) &&
      (!normDynasty || entry.dynasty === normDynasty),
  );

  const dir = order === "asc" ? 1 : -1;
  const sorted = [...filtered].sort(
    (a, b) =>
      dir * (a.stats[metric] - b.stats[metric]) ||
      b.stats.peak - a.stats.peak ||
      a.figure.id.localeCompare(b.figure.id),
  );

  const page = sorted.slice(offset, offset + limit).map((entry, idx) => ({
    rank: offset + idx + 1,
    metricValue: entry.stats[metric],
    ...toSummary(entry),
  }));

  return {
    metric,
    order,
    total: sorted.length,
    returned: page.length,
    offset,
    limit,
    hasMore: offset + page.length < sorted.length,
    items: page,
  };
}

function similarityScore(vecA, vecB) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  let sqDiff = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
    sqDiff += (vecA[i] - vecB[i]) ** 2;
  }
  const cosine = magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
  const maxDist = Math.sqrt(vecA.length * 100 * 100);
  const proximity = 1 - Math.sqrt(sqDiff) / maxDist;
  return Number(((0.55 * cosine + 0.45 * proximity) * 100).toFixed(2));
}

function describeOverlap(a, b) {
  const traits = [];
  for (const [key, label] of DIMENSION_LABELS) {
    if (Math.abs(a.stats[key] - b.stats[key]) <= 8 && a.stats[key] >= 75) {
      traits.push(`高${label}接近`);
    }
  }
  if (Math.abs(a.stats.retention - b.stats.retention) <= 6) {
    traits.push("终局留存曲线相近");
  }
  if (Math.abs(a.stats.volatility - b.stats.volatility) <= 4) {
    traits.push("人生波动率接近");
  }
  if (a.figure.domain === b.figure.domain) {
    traits.push(`同属${a.figure.domain}领域`);
  }
  return traits.slice(0, 4);
}

export function getPeerFigures(figureId, { limit = 5, crossDynasty = false } = {}) {
  const target = ANALYTICS_BY_ID.get(figureId);
  if (!target || !figureById[figureId]) return null;

  const candidates = ANALYTICS_ENTRIES.filter((entry) => {
    if (entry.figure.id === figureId) return false;
    if (crossDynasty && entry.dynasty === target.dynasty) return false;
    return true;
  });

  const scored = candidates
    .map((entry) => ({
      similarity: similarityScore(target.vector, entry.vector),
      sharedTraits: describeOverlap(target, entry),
      ...toSummary(entry),
    }))
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
    .slice(0, limit);

  return {
    target: toSummary(target),
    crossDynasty,
    peers: scored,
  };
}
