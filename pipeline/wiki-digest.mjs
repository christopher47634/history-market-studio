// 近现代人物补节点用：把维基条目按年份摘成一行一句，方便挑事件和引句关键词。
// 用法：node pipeline/wiki-digest.mjs <id> [每年最多几句=3]
import { readFileSync } from "node:fs";

const [id, perYear = "3"] = process.argv.slice(2);
const text = readFileSync(new URL(`../data/v2/sources/${id}/wiki.txt`, import.meta.url), "utf8");
const stop = text.search(/\n==+\s*(参考|參考|注释|註釋|外部链接|外部連結|延伸阅读|参见|參見|相关条目)/);
const body = stop > 0 ? text.slice(0, stop) : text;
const sentences = [...body.matchAll(/[^。！？\n]+[。！？]?/g)].map((m) => m[0].trim()).filter((s) => s.length >= 8 && !s.startsWith("="));
const byYear = new Map();
sentences.forEach((s, i) => {
  const m = s.match(/(1[6-9]\d\d|20[0-2]\d)年/);
  if (!m) return;
  const list = byYear.get(m[1]) ?? [];
  if (list.length < +perYear) list.push(`${i}|${s.slice(0, 90)}`);
  byYear.set(m[1], list);
});
for (const [year, list] of [...byYear].sort((a, b) => a[0] - b[0])) for (const line of list) console.log(`${year} ${line}`);
