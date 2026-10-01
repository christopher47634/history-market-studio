// 跨人物一致性复核：同一类职位 / 处境的事件，不同人的档内分应该接近。
// 按标题和概要里的关键词归类，列出偏离同类中位数 8 分以上的事件，供人工裁定。
// 用法：node pipeline/audit-consistency.mjs [--modern]
import { figuresV2 } from "../src/v2/all.js";

const modernOnly = process.argv.includes("--modern");
const GROUPS = {
  留学: /留学|赴美|赴法|赴日|赴英|东渡/, 院士: /院士|学部委员/, 大学校长: /大学.*校长|校长/, 部长: /部长|总长/,
  总理: /总理/, 副主席: /副主席/, 委员长: /委员长/, 总司令: /总司令/, 研究所所长: /所长/, 院长: /院长/,
  进士: /进士/, 中举: /中举|举人/, 秀才: /秀才/, 被捕入狱: /被捕|入狱|下狱/, 流亡: /流亡/, 下放批斗: /下放|批斗|打倒|受冲击|右派/,
  病逝前病重: /病重|确诊|癌/, 回国: /^回国|归国|回国$/,
};
const rows = [];
for (const f of figuresV2) for (const e of f.events) {
  const hay = `${e.title} ${e.summary ?? ""}`;
  for (const [g, re] of Object.entries(GROUPS)) if (re.test(e.title) || (g === "下放批斗" && re.test(hay))) rows.push({ g, f, e, modern: f.born.year >= 1780 });
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
let flagged = 0;
for (const g of Object.keys(GROUPS)) {
  const list = rows.filter((r) => r.g === g);
  if (list.length < 3) continue;
  // 同类比较只在相近的时代内做：近现代和古代的「校长」「部长」不是一回事。
  const pool = list.filter((r) => r.modern);
  if (pool.length < 3) continue;
  const m = median(pool.map((r) => r.e.tierScore));
  const mp = median(pool.map((r) => r.e.crisisPenalty));
  const out = pool.filter((r) => Math.abs(r.e.tierScore - m) > 8 || Math.abs(r.e.crisisPenalty - mp) > 20);
  console.log(`\n【${g}】近现代 ${pool.length} 条，档内分中位数 ${m}，折损中位数 ${mp}`);
  for (const r of out) { flagged++; console.log(`  ⚠ ${r.f.name} ${r.e.year}「${r.e.title}」${r.e.tier} ${r.e.tierScore} − ${r.e.crisis} ${r.e.crisisPenalty}`); }
  if (!modernOnly) for (const r of pool.filter((x) => !out.includes(x))) console.log(`    ${r.f.name} ${r.e.year}「${r.e.title}」${r.e.tierScore}/${r.e.crisisPenalty}`);
}
console.log(`\n共标出 ${flagged} 条需要裁定`);
