// 从 data/v2/figures 和 report.json 生成人工抽查用的审核表 docs/v2/sample-review.md。
import { readdir, readFile, writeFile } from "node:fs/promises";
import { SAMPLE } from "./registry.mjs";
import { ANCHORS } from "./rubric.mjs";

const DATA = new URL("../data/v2/", import.meta.url);
const report = JSON.parse(await readFile(new URL("report.json", DATA), "utf8"));
const files = new Set(await readdir(new URL("figures/", DATA)));
const fmtYear = (y) => (y < 0 ? `前${-y}` : `${y}`);
const cell = (s) => String(s ?? "").replace(/\|/g, "｜").replace(/\n/g, " ");

const lines = ["# 30 人样板审核表", "", "由 `node pipeline/review.mjs` 生成。每行一个事件：分数由程序按「档位 − 危局」算出；「原文」表示引句已在正史里逐字核验，「概括」表示没有可核验的原文。", ""];
const ok = report.filter((r) => r.ok);
lines.push(`通过校验 ${ok.length}/${report.length} 人。`, "");
lines.push("## 总览", "", "| 人物 | 生前峰值 | 谷值 | 终章 | 后世 | 引文核验 | 空白段 | 提示 |", "|---|---|---|---|---|---|---|---|");

const figures = [];
for (const person of SAMPLE) {
  const r = report.find((x) => x.id === person.id);
  if (!files.has(`${person.id}.json`)) { if (r) lines.push(`| ${person.name} | ✗ 未通过：${cell(r.errors.join("；"))} |||||||`); continue; }
  const f = JSON.parse(await readFile(new URL(`figures/${person.id}.json`, DATA), "utf8"));
  figures.push(f);
  const a = ANCHORS[f.id] ? "⚓ " : "";
  lines.push(`| ${a}${f.name} | ${f.peak.score} ${f.peak.title} | ${f.trough?.score ?? ""} ${f.trough?.title ?? ""} | ${f.finale.score} | ${f.legacy.score} ${f.legacy.label} | ${f.quality.quotesVerified}/${f.quality.quotesClaimed} | ${f.gaps.length} | ${r?.warnings.length ?? 0} |`);
}
lines.push("", "⚓ = 锚点人物。", "");

for (const f of figures) {
  const r = report.find((x) => x.id === f.id);
  lines.push(`## ${f.name}（${fmtYear(f.born.year)}–${fmtYear(f.died.year)}，${f.lifeSpan} 岁）`, "", f.thesis ?? "", "");
  lines.push("| 年份 | 岁 | 类型 | 事件 | 档位 − 危局 | 势 | 理由 | 依据 |", "|---|---|---|---|---|---|---|---|");
  for (const e of f.events) {
    const basis = e.quote ? `原文：${cell(e.quote.textSimplified)}（${e.quote.source}）` : e.rejectedQuote ? `概括（引句未核验通过）` : "概括";
    lines.push(`| ${fmtYear(e.year)}${e.yearCertainty === "估计" ? "?" : ""} | ${e.age} | ${e.kind === "stage" ? "阶段" : "子事件"} | ${cell(e.title)} | ${e.tier} ${e.tierScore} − ${e.crisis} ${e.crisisPenalty} | **${e.score}** | ${cell(e.rationale)} | ${basis} |`);
  }
  lines.push(`| ${fmtYear(f.finale.year)} | ${f.finale.age} | 终章 | ${cell(f.finale.title)} | 保留 ${Math.round(f.finale.retention * 100)}% | **${f.finale.score}** | ${cell(f.finale.reason)} | ${f.finale.quote ? "原文" : "概括"} |`);
  lines.push("", `身后：${f.posthumous.map((p) => `${fmtYear(p.year)} ${p.title} ${p.score}`).join(" → ")}`, "");
  lines.push(`后世评价：**${f.legacy.score}**（${f.legacy.tier}，${f.legacy.label}）${f.legacy.rationale}`, "");
  if (r?.warnings.length) lines.push("提示：", ...r.warnings.map((w) => `- ${w}`), "");
}
await writeFile(new URL("../docs/v2/sample-review.md", import.meta.url), lines.join("\n"));
console.log(`审核表已生成：${figures.length} 人`);
