// 把 data/v2/drafts/<id>.json（模型或人工起草）算分、校验，输出 data/v2/figures/<id>.json 和审核报告。
// 用法：node pipeline/build.mjs [id...]
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { SAMPLE } from "./registry.mjs";
import { TIERS, CRISIS, LEGACY_TIERS, LABELS, RETENTION, GAP_YEARS, ANCHORS, capFor, eventScore } from "./rubric.mjs";
import { quoteFound, toSimplified, findSentence } from "./text.mjs";
import { ALL } from "./registry.mjs";

const DATA = new URL("../data/v2/", import.meta.url);
const TODAY = 2026;
const wsUrl = (title) => `https://zh.wikisource.org/wiki/${encodeURIComponent(title)}`;
// 公元前没有 0 年：前 1 年的下一年是 1 年。
const ageAt = (born, year) => year - born - (born < 0 && year > 0 ? 1 : 0);
const inBand = ([lo, hi], value) => Number.isFinite(value) && value >= lo && value <= hi;

async function loadSources(person) {
  const texts = [];
  for (const index of person.ws.keys()) {
    const file = new URL(`sources/${person.id}/primary-${index}.txt`, DATA);
    texts.push(existsSync(file) ? await readFile(file, "utf8") : "");
  }
  return texts;
}

export function buildFigure(person, draft, sources, rescore = null) {
  const errors = [];
  const warnings = [];
  const cap = capFor(person.id);
  const born = draft.born.year;
  const died = draft.died.year;
  const srcLabel = (i) => person.ws[i]?.label ?? "未知来源";

  const cursors = sources.map(() => 0);
  const checkQuote = (quote, where) => {
    // 关键词式引文：到原文里找出整句，逐字照抄。
    if (quote?.find && !quote.text) {
      // 一个人可能挂多卷原文（本纪分卷、合传全卷）：先搜指定卷，找不到再依次搜其余各卷。
      const order = [quote.source ?? 0, ...sources.map((_, i) => i).filter((i) => i !== (quote.source ?? 0))];
      let hit = null, idx = order[0];
      for (const i of order) { hit = findSentence(sources[i], quote.find, cursors[i]); if (hit) { idx = i; break; } }
      if (!hit) { warnings.push(`${where}：原文里找不到关键词 ${quote.find.join("/")}，记为「概括」`); return { evidence: "概括", quote: null, verified: false }; }
      if (hit.fromStart) warnings.push(`${where}：关键词在前文命中，可能对应的不是这件事——「${hit.text.slice(0, 20)}」`);
      cursors[idx] = hit.pos;
      quote = { ...quote, source: idx, text: hit.text };
    }
    if (!quote?.text) return { evidence: "概括", quote: null, verified: false };
    if (!person.ws[quote.source]) { errors.push(`${where}：引文来源编号 ${quote.source} 不存在`); return { evidence: "概括", quote: null, verified: false }; }
    if (quoteFound(quote.text, [sources[quote.source]])) {
      return { evidence: "原文", verified: true, quote: { text: quote.text, textSimplified: toSimplified(quote.text), source: srcLabel(quote.source), url: wsUrl(person.ws[quote.source].title) } };
    }
    warnings.push(`${where}：引文在原文里找不到，已降为「概括」——「${quote.text.slice(0, 24)}」`);
    return { evidence: "概括", quote: null, verified: false, rejectedQuote: quote.text };
  };

  let lastYear = -Infinity;
  let lastStage = null;
  const events = draft.events.map((event, index) => {
    const where = `第 ${index + 1} 个事件「${event.title}」`;
    if (!TIERS[event.tier]) errors.push(`${where}：档位「${event.tier}」不在标准里`);
    else if (!inBand(TIERS[event.tier], event.tierScore) && !(person.id === "maozedong" && event.tierScore === 100)) errors.push(`${where}：档内分 ${event.tierScore} 超出「${event.tier}」${TIERS[event.tier].join("–")}`);
    if (!CRISIS[event.crisis]) errors.push(`${where}：危局「${event.crisis}」不在标准里`);
    else if (!inBand(CRISIS[event.crisis], event.crisisPenalty ?? 0)) errors.push(`${where}：折损 ${event.crisisPenalty} 超出「${event.crisis}」${CRISIS[event.crisis].join("–")}`);
    if (event.year < lastYear) errors.push(`${where}：年份 ${event.year} 早于上一个事件`);
    if (event.year < born || event.year > died) errors.push(`${where}：年份 ${event.year} 不在生卒年内`);
    if (!event.rationale) errors.push(`${where}：缺打分理由`);
    if (!["stage", "sub"].includes(event.kind)) errors.push(`${where}：kind 只能是 stage 或 sub`);
    lastYear = Math.max(lastYear, event.year);
    const score = eventScore(event, person.id);
    const { evidence, quote, verified, rejectedQuote } = checkQuote(event.quote, where);
    const built = {
      year: event.year, age: ageAt(born, event.year), yearCertainty: event.yearCertainty ?? "确知", kind: event.kind,
      title: event.title, tier: event.tier, tierScore: event.tierScore, crisis: event.crisis, crisisPenalty: event.crisisPenalty ?? 0,
      score, delta: event.kind === "stage" && lastStage ? +(score - lastStage.score).toFixed(1) : 0,
      rationale: event.adjudication ?? event.rationale, summary: event.summary, evidence, quote, verified, ...(rejectedQuote ? { rejectedQuote } : {}),
      ...(event.adjudication ? { adjudicated: true, draftRationale: event.rationale } : {}),
    };
    if (event.kind === "stage") lastStage = built;
    return built;
  });

  const stages = events.filter((e) => e.kind === "stage");
  if (stages.length < 4) errors.push(`阶段事件只有 ${stages.length} 个，至少要 4 个`);

  // 终章：承接最后一个阶段事件，按保留率回撤，最多 20%。
  const f = draft.finale;
  if (!inBand(RETENTION, f.retention)) errors.push(`终章保留率 ${f.retention} 不在 0.80–1.00`);
  const prev = stages.at(-1)?.score ?? 0;
  const finaleQuote = checkQuote(f.quote, "终章");
  const finale = {
    year: died, age: ageAt(born, died), title: f.title, retention: f.retention, reason: f.reason,
    score: Math.min(cap, +(prev * f.retention).toFixed(1)), evidence: finaleQuote.evidence, quote: finaleQuote.quote, verified: finaleQuote.verified,
  };

  // 身后声望线：终章 → 身后事件 → 今日 = 后世评价。
  const legacy = draft.legacy;
  if (!LEGACY_TIERS[legacy.tier]) errors.push(`后世评价档位「${legacy.tier}」不在标准里`);
  else if (!inBand(LEGACY_TIERS[legacy.tier], legacy.score) && !(person.id === "maozedong" && legacy.score === 100)) errors.push(`后世评价 ${legacy.score} 超出「${legacy.tier}」`);
  if (!LABELS.includes(legacy.label)) errors.push(`褒贬标签「${legacy.label}」只能是 ${LABELS.join("、")}`);
  let postYear = died;
  const posthumous = (draft.posthumous || []).map((p) => {
    if (p.year < postYear) errors.push(`身后事件「${p.title}」年份倒序`);
    if (p.score > cap) errors.push(`身后事件「${p.title}」分数 ${p.score} 超过封顶 ${cap}`);
    postYear = p.year;
    if (!p.jumpReason && p.year - died <= 10 && Math.abs(p.score - (stages.at(-1)?.score ?? 0) * f.retention) > 15) warnings.push(`身后跳变：「${p.title}」去世 ${p.year - died} 年内就到 ${p.score}，需确认当时确有此评价`);
    return { year: p.year, title: p.title, score: p.score, rationale: p.rationale, inferred: false, ...(p.jumpReason ? { jumpReason: p.jumpReason } : {}) };
  });
  posthumous.push({ year: TODAY, title: "今日评价", score: legacy.score, rationale: legacy.rationale, inferred: posthumous.length === 0 });

  // 史料空白：15 岁以后相邻阶段事件相隔超过 GAP_YEARS 年。
  const gaps = [];
  for (let i = 1; i < stages.length; i++) {
    const a = stages[i - 1], b = stages[i];
    if (b.age >= 15 && b.year - a.year > GAP_YEARS) gaps.push({ fromAge: a.age, toAge: b.age, years: b.year - a.year });
  }
  const tail = died - (stages.at(-1)?.year ?? died);
  if (tail > GAP_YEARS) gaps.push({ fromAge: stages.at(-1).age, toAge: finale.age, years: tail });
  for (const g of gaps) warnings.push(`史料空白：${g.fromAge}–${g.toAge} 岁（${g.years} 年）没有阶段事件`);

  const all = [...stages, finale];
  const peak = all.reduce((best, e) => (e.score > best.score ? e : best));
  const trough = stages.slice(1).reduce((worst, e) => (e.score < worst.score ? e : worst), stages[1] ?? stages[0]);

  const anchor = ANCHORS[person.id];
  if (anchor) {
    const off = (label, got, want) => Math.abs(got - want) > 2 && errors.push(`锚点偏差：${label} ${got}，标准表是 ${want}`);
    off("生前峰值", peak.score, anchor.peak);
    off("终章", finale.score, anchor.finale);
    off("后世评价", legacy.score, anchor.legacy);
  }

  // 盲打分复核：同一事件两次相差超过 8 分的标出来。
  for (const r of rescore?.scores ?? []) {
    const e = events[r.index];
    if (!e) continue;
    const again = eventScore(r, person.id);
    if (Math.abs(again - e.score) > 8) warnings.push(`复核分歧：「${e.title}」起草 ${e.score}，复核 ${again}（${r.tier}/${r.crisis}）`);
  }

  const quoted = [...events, finale].filter((e) => e.quote || e.rejectedQuote);
  return {
    figure: {
      id: person.id, name: person.name, born: draft.born, died: draft.died, lifeSpan: ageAt(born, died), thesis: draft.thesis,
      sources: person.ws.map((w) => ({ label: w.label, url: wsUrl(w.title) })),
      events, finale, posthumous, legacy,
      peak: { title: peak.title, age: peak.age, score: peak.score },
      trough: trough ? { title: trough.title, age: trough.age, score: trough.score } : null,
      gaps,
      quality: { quotesVerified: quoted.filter((e) => e.verified).length, quotesClaimed: quoted.length, author: draft.author },
    },
    errors, warnings,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();

async function main() {
const wanted = process.argv.slice(2);
await mkdir(new URL("figures/", DATA), { recursive: true });
const picksFile = new URL("quote-picks.json", DATA);
const quotePicks = existsSync(picksFile) ? JSON.parse(await readFile(picksFile, "utf8")) : {};
const adjFile = new URL("adjudications.json", DATA);
const adjudications = existsSync(adjFile) ? JSON.parse(await readFile(adjFile, "utf8")) : {};
const drafts = (await readdir(new URL("drafts/", DATA))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const built = [];
for (const id of drafts.filter((d) => !wanted.length || wanted.includes(d))) {
  const person = ALL.find((p) => p.id === id);
  if (!person) { console.log(`✗ ${id}：不在样板登记表里`); continue; }
  const draft = JSON.parse(await readFile(new URL(`drafts/${id}.json`, DATA), "utf8"));
  // 裁定：起草与复核分歧的事件，按 adjudications.json 覆盖档位和危局，并从复核比对里剔除。
  const ruling = adjudications[id] ?? {};
  for (const [index, [tier, tierScore, crisis, crisisPenalty, reason]] of Object.entries(ruling)) {
    const event = draft.events[+index];
    if (!event) { console.log(`   ⚠ ${id} 裁定的第 ${index} 个事件不存在`); continue; }
    Object.assign(event, { tier, tierScore, crisis, crisisPenalty, adjudication: reason });
  }
  // 人工审定的原文关键词（quote-picks.json）：覆盖对应事件的引文查找。
  for (const [title, phrase] of Object.entries(quotePicks[id] ?? {})) {
    const target = title === "终章" ? draft.finale : draft.events.find((e) => e.title === title);
    if (!target) { console.log(`   ⚠ ${id} 审定关键词的事件「${title}」不存在`); continue; }
    target.quote = { find: [phrase], source: 0 };
  }
  const rescoreFile = new URL(`rescore/${id}.json`, DATA);
  const rescore = existsSync(rescoreFile) ? JSON.parse(await readFile(rescoreFile, "utf8")) : null;
  if (rescore) rescore.scores = rescore.scores.filter((r) => !(String(r.index) in ruling));
  for (const [index, [score, reason]] of Object.entries(adjudications._身后?.[id] ?? {})) {
    const p = draft.posthumous?.[+index];
    if (!p) { console.log(`   ⚠ ${id} 身后裁定的第 ${index} 条不存在`); continue; }
    if (score != null) p.score = score;
    p.jumpReason = reason;
  }
  const { figure, errors, warnings } = buildFigure(person, draft, await loadSources(person), rescore);
  built.push({ figure, errors, warnings });
  if (!errors.length) await writeFile(new URL(`figures/${id}.json`, DATA), JSON.stringify(figure, null, 2));
  const q = figure.quality;
  console.log(`${errors.length ? "✗" : "✓"} ${person.name}  峰值 ${figure.peak.score}（${figure.peak.title}）终章 ${figure.finale.score}  后世 ${figure.legacy.score}  引文 ${q.quotesVerified}/${q.quotesClaimed}  空白段 ${figure.gaps.length}`);
  for (const e of errors) console.log(`   错误：${e}`);
  for (const w of warnings) console.log(`   提示：${w}`);
}

// 跨人物：同名事件年份要一致（如鸿门宴、垓下）。
const byTitle = new Map();
for (const { figure } of built) for (const e of figure.events) {
  const key = e.title.replace(/[之的]/g, "");
  (byTitle.get(key) ?? byTitle.set(key, []).get(key)).push({ name: figure.name, year: e.year, born: figure.born.year, died: figure.died.year });
}
for (const [title, list] of byTitle) {
  // 只比生命有重叠的人，「进士及第」这类通用标题跨时代不算同一事件。
  const overlapping = list.filter((x) => list.some((y) => y !== x && x.born <= y.died && y.born <= x.died));
  const years = new Set(overlapping.map((x) => x.year));
  const spread = years.size ? Math.max(...years) - Math.min(...years) : 0;
  // 相差 5 年以内才像同一事件被记错了年份；差得更多只是同名的不同事件。
  if (overlapping.length > 1 && years.size > 1 && spread <= 5) console.log(`跨人物提示：「${title}」年份不一致 ${overlapping.map((x) => `${x.name} ${x.year}`).join("，")}`);
}

const report = built.map(({ figure, errors, warnings }) => ({ id: figure.id, name: figure.name, ok: !errors.length, errors, warnings }));
if (!wanted.length) {
  await writeBundle();
  const { writeClientIndex } = await import("./client-index.mjs");
  await writeClientIndex();
}
await writeFile(new URL("report.json", DATA), JSON.stringify(report, null, 2));
const failed = report.filter((r) => !r.ok).length;
console.log(`\n共 ${report.length} 人，通过 ${report.length - failed}，未通过 ${failed}`);
process.exitCode = failed ? 1 : 0;
}

// 前端和服务端共用的数据包：把所有通过校验的人物合成一个 JS 模块（去掉只供审核用的字段）。
async function writeBundle() {
  const files = (await readdir(new URL("figures/", DATA))).filter((f) => f.endsWith(".json")).sort();
  const strip = (e) => { const { draftRationale, rejectedQuote, ...rest } = e; return rest; };
  const all = [];
  for (const f of files) {
    const fig = JSON.parse(await readFile(new URL(`figures/${f}`, DATA), "utf8"));
    all.push({ ...fig, events: fig.events.map(strip) });
  }
  const out = new URL("../src/v2/figures.generated.js", import.meta.url);
  await writeFile(out, `// 由 pipeline/build.mjs 生成，勿手改。
export default ${JSON.stringify(all)};
`);
  console.log(`数据包：${all.length} 人 → src/v2/figures.generated.js`);
}
