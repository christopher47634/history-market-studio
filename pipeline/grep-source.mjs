// 人工补引句用：在某人的原文里按关键词找整句（繁简都认）。
// 用法：node pipeline/grep-source.mjs <id> 关键词1 关键词2 ...
import { readFileSync, readdirSync } from "node:fs";
import { normalizeForMatch } from "./text.mjs";

const [id, ...keys] = process.argv.slice(2);
const dir = new URL(`../data/v2/sources/${id}/`, import.meta.url);
const src = readdirSync(dir).filter((f) => f.startsWith("primary-")).sort().map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
const sentences = [...src.matchAll(/[^。！？\n]+[。！？]?/g)].map((m) => m[0].trim());
for (const key of keys) {
  const k = normalizeForMatch(key);
  const hits = sentences.map((s, i) => [i, s]).filter(([, s]) => normalizeForMatch(s).includes(k)).slice(0, 4);
  for (const [i, s] of hits) console.log(`${id} [${key}] ${i}|${s.slice(0, 70)}`);
  if (!hits.length) console.log(`${id} [${key}] —`);
}
