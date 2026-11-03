// 为缺原文引句的事件推荐候选句：在原文里、介于前后已核验引句之间的范围内，
// 按与「标题 + 概要」共有的双字词数量打分，每个事件给出最多 2 条候选，供人工判断。
// 用法：node pipeline/suggest-quotes.mjs [id...] > work/quote-suggestions.tsv
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ALL } from "./registry.mjs";
import { toSimplified } from "./text.mjs";

const DATA = new URL("../data/v2/", import.meta.url);
const STOP = new Set(["之后", "以为", "于是", "不能", "天下", "所以", "其后", "以后", "此时", "一个", "成为", "因为", "没有", "开始", "由于", "自己", "他的", "我们"]);
const bigrams = (s) => {
  const t = toSimplified(s || "").replace(/[^一-鿿]/g, "");
  const b = new Set();
  for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); if (!STOP.has(g)) b.add(g); }
  return b;
};

const picksFile = new URL("quote-picks.json", DATA);
const picks = existsSync(picksFile) ? JSON.parse(await readFile(picksFile, "utf8")) : {};
const wanted = process.argv.slice(2);
const out = ["id\t序号\t事件\t概要\t候选1\t分1\t候选2\t分2"];

for (const person of ALL.filter((p) => p.ws?.length && (!wanted.length || wanted.includes(p.id)))) {
  const file = new URL(`figures/${person.id}.json`, DATA);
  if (!existsSync(file)) continue;
  const fig = JSON.parse(await readFile(file, "utf8"));
  const src = existsSync(new URL(`sources/${person.id}/primary-0.txt`, DATA)) ? await readFile(new URL(`sources/${person.id}/primary-0.txt`, DATA), "utf8") : "";
  if (!src) continue;
  const sentences = [...src.matchAll(/[^。！？\n]+[。！？]?/g)].map((m) => ({ text: m[0].trim(), pos: m.index, grams: bigrams(m[0]) })).filter((s) => s.text.length >= 6);
  const all = [...fig.events.map((e, i) => ({ e, i })), { e: { ...fig.finale, summary: fig.finale.reason }, i: "终章" }];
  // 已核验引句在原文中的位置，用来夹出每个事件的搜索范围。
  const posOf = (q) => { const hit = sentences.find((s) => toSimplified(s.text).includes(q.textSimplified.slice(0, 8))); return hit?.pos; };
  const anchors = all.map(({ e }) => (e.quote ? posOf(e.quote) : undefined));
  all.forEach(({ e, i }, k) => {
    if (e.quote || picks[person.id]?.[e.title]) return;
    const lo = anchors.slice(0, k).filter((x) => x !== undefined).at(-1) ?? 0;
    const hi = anchors.slice(k + 1).find((x) => x !== undefined) ?? Infinity;
    const want = bigrams(`${e.title} ${e.summary ?? ""}`);
    const scored = sentences.filter((s) => s.pos >= lo && s.pos <= hi).map((s) => ({ s, score: [...want].filter((g) => s.grams.has(g)).length })).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 2);
    if (!scored.length) return;
    const clip = (t) => t.replace(/\t/g, " ").slice(0, 70);
    out.push([person.id, i, e.title, clip(e.summary ?? ""), clip(scored[0].s.text), scored[0].score, clip(scored[1]?.s.text ?? ""), scored[1]?.score ?? ""].join("\t"));
  });
}
console.log(out.join("\n"));
