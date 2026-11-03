// data/v2/client/*.json 的结构校验（纯函数，无副作用）。
// 项目没有 TypeScript，这里把 docs/v2/scoring-standard.md 的口径写成可执行约束：
// 字段类型、枚举值、档位分数区间、势 = 档分 − 折损、终章保留率、后世评价档位。
// validateClientFigures 一次收集全部问题，返回 { errors, warnings }，不在第一个错误处抛出。

import { CRISIS, LABELS, LEGACY_TIERS, RETENTION, TIERS, capFor } from "../../pipeline/rubric.mjs";

export const CERTAINTY = ["确知", "估计"];
export const EVENT_KINDS = ["stage", "sub"];
export const EVIDENCE = ["原文", "百科", "概括"];
export const LEGACY_LABELS = LABELS;
// 区间直接沿用 pipeline/rubric.mjs（起草算分用的同一份），文档与代码只有一个来源。
// 布衣档含出生分（按家世：皇族约 35、官宦约 25、平民约 12、贫寒约 8）。
export const TIER_RANGES = TIERS;
export const CRISIS_RANGES = CRISIS;
export const LEGACY_RANGES = LEGACY_TIERS;
export const RETENTION_RANGE = RETENTION;
export const MIN_SCORE = 2;
export { capFor };

const EPS = 0.051;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const within = (v, [lo, hi]) => isNum(v) && v >= lo - 1e-9 && v <= hi + 1e-9;

// 史料记载的年龄按公元纪年差计算；跨公元前后时没有公元 0 年，允许差 1。
const ageMatches = (born, year, age) => {
  const diff = year - born;
  return age === diff || (born < 0 && year > 0 && age === diff - 1);
};

function checkQuote(at, item, report) {
  if (item.evidence === "原文") {
    if (!item.quote || !isStr(item.quote.t)) report.error(`${at}: 标为「原文」却没有引句 quote.t`);
    else if (!Number.isInteger(item.quote.s) || item.quote.s < 0) report.error(`${at}: quote.s 不是非负整数的来源下标`);
  } else if (item.quote != null && !isStr(item.quote.t)) {
    report.error(`${at}: quote 存在但没有正文`);
  }
}

function checkEvent(fig, event, index, prevStage, report) {
  const at = `${fig.name}/${event?.title ?? `#${index}`}`;
  if (!event || typeof event !== "object") return report.error(`${fig.name}: 事件 #${index} 不是对象`);
  for (const key of ["title", "rationale", "summary"]) if (!isStr(event[key])) report.error(`${at}: 缺少 ${key}`);
  if (!EVENT_KINDS.includes(event.kind)) report.error(`${at}: kind 无效 "${event.kind}"`);
  if (!CERTAINTY.includes(event.yearCertainty)) report.error(`${at}: yearCertainty 无效 "${event.yearCertainty}"`);
  if (!EVIDENCE.includes(event.evidence)) report.error(`${at}: evidence 无效 "${event.evidence}"`);
  if (!isNum(event.year)) report.error(`${at}: year 不是数字`);
  if (!isNum(event.age) || event.age < 0 || event.age > fig.lifeSpan) report.error(`${at}: age ${event.age} 超出 0-${fig.lifeSpan}`);
  else if (isNum(event.year) && !ageMatches(fig.born.year, event.year, event.age))
    report.error(`${at}: age ${event.age} 与 year ${event.year} − 生年 ${fig.born.year} 不一致`);

  const tierRange = TIER_RANGES[event.tier];
  const crisisRange = CRISIS_RANGES[event.crisis];
  if (!tierRange) report.error(`${at}: 权位档无效 "${event.tier}"`);
  else if (!within(event.tierScore, tierRange) && !(event.tierScore === 100 && capFor(fig.id) === 100)) report.error(`${at}: 档分 ${event.tierScore} 不在「${event.tier}」${tierRange.join("–")}`);
  if (!crisisRange) report.error(`${at}: 危局无效 "${event.crisis}"`);
  else if (!within(event.crisisPenalty, crisisRange))
    report.error(`${at}: 折损 ${event.crisisPenalty} 不在「${event.crisis}」${crisisRange.join("–")}`);
  if (isNum(event.tierScore) && isNum(event.crisisPenalty)) {
    const expected = Math.max(MIN_SCORE, event.tierScore - event.crisisPenalty);
    if (Math.abs(event.score - expected) > EPS) report.error(`${at}: 势 ${event.score} ≠ max(${MIN_SCORE}, 档分 ${event.tierScore} − 折损 ${event.crisisPenalty})`);
  }
  if (!within(event.score, [0, capFor(fig.id)])) report.error(`${at}: 势 ${event.score} 越界或超过封顶`);
  if (event.kind === "stage" && prevStage && isNum(event.delta) && Math.abs(event.delta - (event.score - prevStage.score)) > EPS)
    report.warn(`${at}: delta ${event.delta} 与相邻阶段差 ${event.score - prevStage.score} 不符`);
  checkQuote(at, event, report);
}

export function validateClientFigure(fig, report) {
  const name = fig?.name ?? fig?.id ?? "(未命名)";
  if (!fig || typeof fig !== "object") return report.error("存在非对象的人物条目");
  for (const key of ["id", "name", "thesis"]) if (!isStr(fig[key])) report.error(`${name}: 缺少必填字段 ${key}`);
  if (isStr(fig.id) && !/^[a-z][a-z0-9_-]*$/.test(fig.id)) report.error(`${name}: id "${fig.id}" 不是小写字母数字`);
  for (const key of ["born", "died"]) {
    if (!isNum(fig[key]?.year)) return report.error(`${name}: ${key}.year 不是数字`);
    if (!CERTAINTY.includes(fig[key].certainty)) report.error(`${name}: ${key}.certainty 无效 "${fig[key].certainty}"`);
  }
  if (fig.born.year >= fig.died.year) report.error(`${name}: 生年不早于卒年`);
  if (!ageMatches(fig.born.year, fig.died.year, fig.lifeSpan)) report.error(`${name}: lifeSpan ${fig.lifeSpan} 与生卒年不一致`);
  if (fig.lifeSpan > 110) report.warn(`${name}: 寿命 ${fig.lifeSpan} 岁，请人工复核`);

  if (!Array.isArray(fig.sources)) report.error(`${name}: sources 不是数组`);
  else if (!fig.sources.length) report.warn(`${name}: 没有来源链接，全部节点只能是「概括」`);
  else fig.sources.forEach((s, i) => {
    if (!isStr(s?.label)) report.error(`${name}: sources[${i}] 缺少 label`);
    if (!s?.url?.startsWith?.("https://")) report.error(`${name}: sources[${i}].url 必须是 https 链接`);
  });

  if (!Array.isArray(fig.events) || !fig.events.length) return report.error(`${name}: events 为空`);
  let prevStage = null;
  let prevYear = -Infinity;
  fig.events.forEach((event, i) => {
    checkEvent(fig, event, i, prevStage, report);
    if (event?.kind === "stage") {
      if (event.year < prevYear) report.error(`${name}: 阶段事件未按年份排序（${event.title}）`);
      prevYear = event.year;
      prevStage = event;
    }
    if (isNum(event?.quote?.s) && Array.isArray(fig.sources) && event.quote.s >= fig.sources.length && fig.sources.length)
      report.error(`${name}/${event.title}: quote.s 指向不存在的来源`);
  });
  const stages = fig.events.filter((e) => e.kind === "stage");
  if (stages.length < 3) report.error(`${name}: 阶段事件少于 3 个`);

  const fin = fig.finale;
  if (!fin || typeof fin !== "object") report.error(`${name}: 缺少终章 finale`);
  else {
    const at = `${name}/终章`;
    if (!isStr(fin.title) || !isStr(fin.reason)) report.error(`${at}: 缺少 title 或 reason`);
    if (fin.year !== fig.died.year) report.error(`${at}: 年份 ${fin.year} 不等于卒年 ${fig.died.year}`);
    if (!within(fin.retention, RETENTION_RANGE)) report.error(`${at}: 保留率 ${fin.retention} 不在 0.80–1.00`);
    const last = stages.at(-1);
    if (last && isNum(fin.retention) && Math.abs(fin.score - last.score * fin.retention) > 0.15)
      report.error(`${at}: 终章 ${fin.score} ≠ 前一阶段 ${last.score} × 保留率 ${fin.retention}`);
    if (!EVIDENCE.includes(fin.evidence)) report.error(`${at}: evidence 无效 "${fin.evidence}"`);
    if (typeof fin.verified !== "boolean") report.error(`${at}: verified 不是布尔值`);
    checkQuote(at, fin, report);
  }

  const leg = fig.legacy;
  const cap = capFor(fig.id);
  if (!leg) report.error(`${name}: 缺少后世评价 legacy`);
  else {
    if (!LEGACY_LABELS.includes(leg.label)) report.error(`${name}: 褒贬标签无效 "${leg.label}"`);
    if (!isStr(leg.rationale)) report.error(`${name}: 后世评价缺少理由`);
    const range = LEGACY_RANGES[leg.tier];
    if (!range) report.error(`${name}: 后世评价档位无效 "${leg.tier}"`);
    else if (!within(leg.score, range) && !(leg.score === 100 && cap === 100))
      report.error(`${name}: 后世评价 ${leg.score} 不在「${leg.tier}」${range.join("–")}`);
    if (leg.score > cap) report.error(`${name}: 后世评价 ${leg.score} 超过封顶 ${cap}`);
  }

  if (!Array.isArray(fig.posthumous) || !fig.posthumous.length) report.error(`${name}: 身后声望线为空`);
  else {
    let prev = fig.died.year;
    for (const p of fig.posthumous) {
      if (!isStr(p.title) || typeof p.inferred !== "boolean") report.error(`${name}/身后 ${p.title}: 缺少 title 或 inferred`);
      if (!isStr(p.rationale)) report.warn(`${name}/身后 ${p.title}: 缺少理由 rationale`);
      if (!within(p.score, [0, cap])) report.error(`${name}/身后 ${p.title}: 分数 ${p.score} 越界`);
      if (p.year < prev) report.error(`${name}/身后 ${p.title}: 年份未排序或早于卒年`);
      prev = p.year;
    }
    const end = fig.posthumous.at(-1);
    if (leg && Math.abs(end.score - leg.score) > EPS) report.error(`${name}: 身后声望线终点 ${end.score} ≠ 后世评价 ${leg.score}`);
  }

  // 与 pipeline/build.mjs 一致：峰值取全部阶段加终章，谷值不计出生节点。
  if (fig.peak && stages.length) {
    const max = Math.max(...stages.map((e) => e.score), fin?.score ?? -Infinity);
    if (Math.abs(fig.peak.score - max) > EPS) report.warn(`${name}: peak ${fig.peak.score} 不是阶段与终章的最高分 ${max}`);
  }
  if (fig.trough && stages.length > 1) {
    const min = Math.min(...stages.slice(1).map((e) => e.score));
    if (Math.abs(fig.trough.score - min) > EPS) report.warn(`${name}: trough ${fig.trough.score} 不是阶段最低分 ${min}`);
  }
}

export function validateClientFigures(figures) {
  const errors = [];
  const warnings = [];
  const report = { error: (m) => errors.push(m), warn: (m) => warnings.push(m) };
  const ids = new Set();
  const names = new Set();
  for (const fig of figures) {
    if (ids.has(fig?.id)) report.error(`人物 id 重复: ${fig.id}`);
    if (names.has(fig?.name)) report.error(`人物姓名重复: ${fig.name}`);
    ids.add(fig?.id);
    names.add(fig?.name);
    validateClientFigure(fig, report);
  }
  return { errors, warnings };
}
