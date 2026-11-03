// 人工补引句用：列出某人缺引句的事件，以及原文逐句编号（用于直接阅读挑句）。
// 用法：node pipeline/read-source.mjs <id> [最多句数]
import { readFileSync, existsSync } from "node:fs";
const [id, max = "400"] = process.argv.slice(2);
const f = JSON.parse(readFileSync(new URL(`../data/v2/figures/${id}.json`, import.meta.url), "utf8"));
const src = readFileSync(new URL(`../data/v2/sources/${id}/primary-0.txt`, import.meta.url), "utf8");
console.log(`# ${f.name} 缺引句的事件`);
[...f.events, { ...f.finale, title: "终章", summary: f.finale.reason, year: f.finale.year }].filter((e) => !e.quote).forEach((e) => console.log(`- ${e.year} ${e.title}：${e.summary ?? ""}`));
console.log(`# 原文`);
[...src.matchAll(/[^。！？\n]+[。！？]?/g)].map((m) => m[0].trim()).filter((s) => s.length > 3).slice(0, +max).forEach((s, i) => console.log(`${i}|${s.slice(0, 52)}`));
