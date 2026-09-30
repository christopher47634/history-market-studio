// 把 Claude 手写的紧凑格式（data/v2/authoring/*.txt）展开成 data/v2/drafts/<id>.json。
//
// 格式（每人一段，# 开头为注释）：
//   @id|生年|生年确定性(确/估)|卒年|一句话主线
//   年|类型(s阶段/b子事件)|标题|档|档内分|危局|折损|发生了什么|为什么是这个分|引句关键词1/关键词2
//   !保留率|终章标题|理由|引句关键词
//   ~年|身后事件|分数|理由
//   =后世档|分数|褒贬|理由
// 档：共=天下共主 主=一方之主 臣=重臣主帅 名=方面名家 成=成名 初=初起 布=布衣
// 危局：平=平稳 挫=受挫 败=大败 绝=绝境
// 后世档：塑=文明塑造者 定=时代定义者 家=一代名家 重=重要人物 影=有影响 局=局部
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";

const TIER = { 共: "天下共主", 主: "一方之主", 臣: "重臣主帅", 名: "方面名家", 成: "成名", 初: "初起", 布: "布衣" };
const CRISIS = { 平: "平稳", 挫: "受挫", 败: "大败", 绝: "绝境" };
const LEGACY = { 塑: "文明塑造者", 定: "时代定义者", 家: "一代名家", 重: "重要人物", 影: "有影响", 局: "局部" };
const DATA = new URL("../data/v2/", import.meta.url);
// 档位名由分数决定（区间不重叠），只有出生事件写「布」时保留布衣。危局名由折损决定。
const band = (table, value) => Object.entries(table).find(([, [lo, hi]]) => value >= lo && value <= hi)?.[0];
const TIER_BANDS = { 天下共主: [95, 100], 一方之主: [85, 94], 重臣主帅: [70, 84], 方面名家: [55, 69], 成名: [40, 54], 初起: [25, 39], 布衣: [0, 24] };
const CRISIS_BANDS = { 平稳: [0, 0], 受挫: [5, 15], 大败: [20, 35], 绝境: [40, 60] };
const LEGACY_BANDS = { 文明塑造者: [95, 100], 时代定义者: [85, 94], 一代名家: [75, 84], 重要人物: [60, 74], 有影响: [45, 59], 局部: [0, 44] };
const tierOf = (code, score) => (code === "布" && score <= 35 ? "布衣" : band(TIER_BANDS, score) ?? TIER[code] ?? code);
const quote = (keys) => (keys && keys.trim() ? { find: keys.split("/").map((k) => k.trim()).filter(Boolean), source: 0 } : null);

export function parse(text) {
  const out = [];
  let cur = null;
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const f = line.slice(1).split("|").map((x) => x.trim());
    const where = `第 ${n + 1} 行`;
    if (line.startsWith("@")) {
      const [id, born, cert, died, thesis] = f;
      cur = { id, author: "claude", born: { year: parseInt(born, 10), certainty: cert === "估" || born.endsWith("?") ? "估计" : "确知" }, died: { year: parseInt(died, 10), certainty: died.endsWith("?") ? "估计" : "确知" }, thesis, events: [], posthumous: [] };
      out.push(cur);
    } else if (!cur) throw new Error(`${where}：在 @ 之前出现内容`);
    else if (line.startsWith("!")) {
      const [ret, title, reason, keys] = f;
      cur.finale = { year: cur.died.year, title, retention: +ret, reason, quote: quote(keys) };
    } else if (line.startsWith("~")) {
      const [year, title, score, rationale] = f;
      cur.posthumous.push({ year: +year, title, score: +score, rationale });
    } else if (line.startsWith("=")) {
      const [tier, score, label, rationale] = f;
      cur.legacy = { tier: band(LEGACY_BANDS, +score) ?? LEGACY[tier] ?? tier, score: +score, label, rationale };
    } else {
      const [year, kind, title, tier, ts, crisis, pen, summary, rationale, keys] = line.split("|").map((x) => x.trim());
      const yearCertainty = year.endsWith("?") ? "估计" : "确知";
      cur.events.push({
        year: parseInt(year, 10), yearCertainty, kind: kind === "b" ? "sub" : "stage", title,
        tier: tierOf(tier, +ts), tierScore: +ts, crisis: band(CRISIS_BANDS, +pen) ?? CRISIS[crisis] ?? crisis, crisisPenalty: +pen,
        summary, rationale, quote: quote(keys),
      });
    }
  });
  return out;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/").split("/").pop() ?? "")) {
  await mkdir(new URL("drafts/", DATA), { recursive: true });
  const files = (await readdir(new URL("authoring/", DATA))).filter((f) => f.endsWith(".txt"));
  let n = 0;
  for (const file of files) {
    for (const draft of parse(await readFile(new URL(`authoring/${file}`, DATA), "utf8"))) {
      await writeFile(new URL(`drafts/${draft.id}.json`, DATA), JSON.stringify(draft, null, 2));
      n++;
    }
  }
  console.log(`展开 ${n} 人（${files.length} 个文件）`);
}
