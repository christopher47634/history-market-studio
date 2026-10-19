// 人物搜索（⌘K 面板、人物下拉、角色页筛选共用一套）。
// 原来三处都是「搜索词是否出现在事件标题里」，再按后世评价排：搜「变法」时，王安石的事件写的是「新法」所以找不到，
// 齐白石因为「衰年变法」（画风转变）反而排在前面。现在按字段分权计分：
//   姓名 > 别名（字号谥号俗称） > 拼音 id > 代表（以什么闻名） > 朝代/阵营 > 领域 > 一句话总评 > 生平事件标题
// 每个词取命中最强的字段，多个词（空格分开）必须都命中，分数相加；概念词（变法 ⇄ 新法、新政、维新…）打折计入。
// 结果带一句「为什么命中」，界面上显示出来，用户看得懂为什么是这个人。
import { TERMS, CONCEPTS } from "./search-terms.js";

const norm = (s) => String(s ?? "").toLocaleLowerCase("zh-CN").trim();
const split = (s) => norm(s).split(/\s+/).filter(Boolean);

const cache = new WeakMap();
function prep(f) {
  let p = cache.get(f);
  if (p) return p;
  const [alias = "", known = ""] = TERMS[f.id] ?? [];
  const header = new Set([f.name, f.courtesy, f.camp, f.dynasty, f.era, f.periodLabel, f.domain].filter(Boolean).map(norm));
  p = {
    name: norm(f.name),
    id: norm(f.id),
    aliases: split(alias),
    // 数据里的 courtesy 有的是称号（汉高祖），有的是描述（名将改革家），不能一律当别名；称号已收进词表别名，这里只当代表的末位。
    known: [...split(known), ...(f.courtesy ? [norm(f.courtesy)] : [])],
    tags: [f.dynasty, f.era, f.camp, f.periodLabel].filter(Boolean).map(norm),
    domain: norm(f.domain),
    thesis: norm(f.thesis),
    events: split(f.searchText).filter((t) => !header.has(t)),
  };
  cache.set(f, p);
  return p;
}

// 一个词在一个人身上的最强命中：{ score, why }。concept=true 时是近义词展开，不比姓名/别名/拼音。
function hit(p, f, w, concept = false) {
  let best = { score: 0, why: "" };
  const take = (score, why) => { if (score > best.score) best = { score, why }; };
  if (!concept) {
    if (p.name === w) take(1000, "姓名");
    else if (p.name.startsWith(w)) take(800, "姓名");
    else if (p.name.includes(w)) take(600, "姓名");
    else if (p.name.length >= 2 && w.includes(p.name)) take(550, "姓名");
    for (const a of p.aliases) {
      if (a === w) take(720, `又称「${a}」`);
      else if (w.length >= 2 && a.includes(w)) take(520, `又称「${a}」`);
      else if (a.length >= 2 && w.includes(a)) take(480, `又称「${a}」`);
    }
    if (/^[a-z]+$/.test(w) && w.length >= 3) {
      if (p.id === w) take(900, "拼音");
      else if (p.id.startsWith(w)) take(700, "拼音");
    }
  }
  p.known.forEach((k, i) => {
    const own = k.includes(p.name) ? 50 : 0; // 以本人命名的（王安石变法、商鞅变法）最核心
    const pos = Math.max(0, 10 - i * 2); // 排在前面的代表更核心
    // 单字只认整词（搜「唐」不该命中「大唐西域记」）；查询里包含代表词时，代表词至少三个字（「王安石变法」不该因「变法」命中商鞅）。
    if (k === w) take(460 + own + pos, `以「${k}」闻名`);
    else if (w.length >= 2 && k.includes(w)) take(420 + own + pos, `以「${k}」闻名`);
    else if (k.length >= 3 && w.includes(k)) take(380 + own + pos, `以「${k}」闻名`);
  });
  for (const t of p.tags) {
    if (t === w) take(300, f.dynasty);
    else if (w.length >= 1 && t.includes(w)) take(260, f.dynasty);
  }
  if (w.length >= 2 && p.domain.includes(w)) take(220, f.domain);
  if (w.length >= 2 && p.thesis.includes(w)) take(150, "总评提到");
  if (w.length >= 2) for (const e of p.events) if (e.includes(w)) { take(120, `生平：${e}`); break; }
  return best;
}

function scoreWord(f, w) {
  const p = prep(f);
  let best = hit(p, f, w);
  const c = CONCEPTS[w];
  const syns = Array.isArray(c) ? c : c?.terms ?? [];
  const k = Array.isArray(c) ? 0.6 : c?.w ?? 0.6;
  for (const syn of syns) {
    const h = hit(p, f, syn, true);
    const score = Math.round(h.score * k);
    if (score > best.score) best = { score, why: h.why };
  }
  return best;
}

// 返回 [{ f, score, why }]，按相关度从高到低；同分按后世评价。空查询返回 null（调用方自己决定默认列表）。
export function searchFigures(list, q) {
  const words = split(q);
  if (!words.length) return null;
  const out = [];
  for (const f of list) {
    let score = 0, why = "", top = 0, ok = true;
    for (const w of words) {
      const h = scoreWord(f, w);
      if (!h.score) { ok = false; break; }
      score += h.score;
      if (h.score > top) { top = h.score; why = h.why; } // 显示命中最强的那个词的原因
    }
    if (ok) out.push({ f, score, why });
  }
  return out.sort((a, b) => b.score - a.score || b.f.legacy.score - a.f.legacy.score);
}

// 命中是否「强」：姓名、别名、拼音、代表（含近义词）、朝代、领域都算；只在生平事件标题或总评里提到的算弱命中，
// ⌘K 里归到「生平里提到」一组、排在后面，并写出是哪件事（例如齐白石的「衰年变法」）。
export const isStrong = (r) => !/^(生平|总评)/.test(r.why);
