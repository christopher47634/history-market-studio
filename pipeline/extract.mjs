// 用 DeepSeek 起草人物数据，或对已起草的事件做一次盲打分复核。
// 用法：
//   DEEPSEEK_API_KEY=... node pipeline/extract.mjs draft [id...]     起草 → data/v2/drafts/<id>.json（已存在的跳过，加 --force 覆盖）
//   DEEPSEEK_API_KEY=... node pipeline/extract.mjs rescore [id...]   盲打分 → data/v2/rescore/<id>.json
// key 只从环境变量读，不落盘。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { SAMPLE } from "./registry.mjs";
import { ANCHORS, rubricText } from "./rubric.mjs";

const DATA = new URL("../data/v2/", import.meta.url);
const KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const MAX_PRIMARY = 60000;
const MAX_WIKI = 12000;

// 北京时间工作日 9–12、14–18 为高峰，其余半价。单价：元 / 百万 token。
function price(now = new Date()) {
  const bj = new Date(now.getTime() + 8 * 3600e3);
  const day = bj.getUTCDay(), hour = bj.getUTCHours();
  const peak = day >= 1 && day <= 5 && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18));
  return peak ? { peak, hit: 0.04, miss: 2, out: 8 } : { peak, hit: 0.02, miss: 1, out: 4 };
}

async function chat(messages) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" }, max_tokens: 32000 }),
    signal: AbortSignal.timeout(300000),
  });
  if (res.status === 402) throw new Error("DeepSeek 余额不足（402）");
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const u = data.usage || {};
  const p = price();
  const hit = u.prompt_cache_hit_tokens || 0, miss = (u.prompt_tokens || 0) - hit, out = u.completion_tokens || 0;
  const cost = (hit * p.hit + miss * p.miss + out * p.out) / 1e6;
  const choice = data.choices[0];
  const usage = { in: u.prompt_tokens, out, cost: +cost.toFixed(4), peak: p.peak };
  if (choice.finish_reason === "length") throw Object.assign(new Error(`输出被截断（${out} token），调大 max_tokens 或减少事件数`), { usage });
  return { json: JSON.parse(choice.message.content), usage: { in: u.prompt_tokens, out, cost: +cost.toFixed(4), peak: p.peak } };
}

async function logUsage(id, mode, usage) {
  const file = new URL("usage.json", DATA);
  const log = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : [];
  log.push({ at: new Date().toISOString(), id, mode, model: MODEL, ...usage });
  await writeFile(file, JSON.stringify(log, null, 2));
}

async function seedEvents(id) {
  const { figures } = await import("../src/data.js");
  const old = figures.find((f) => f.id === id);
  return old ? old.events.filter((e) => !e.posthumous).map((e) => `${e.year} ${e.title}：${e.summary ?? ""}`).join("\n") : "（无）";
}

const anchorTable = () => Object.entries(ANCHORS).map(([id, a]) => `${SAMPLE.find((p) => p.id === id)?.name ?? id}：生前峰值 ${a.peak}，终章 ${a.finale}，后世 ${a.legacy}`).join("\n");

async function draftPrompt(person) {
  const gold = await readFile(new URL("drafts/liubang.json", DATA), "utf8");
  const primary = [];
  let budget = MAX_PRIMARY;
  for (const [i, ref] of person.ws.entries()) {
    const text = (await readFile(new URL(`sources/${person.id}/primary-${i}.txt`, DATA), "utf8")).slice(0, Math.max(0, budget));
    budget -= text.length;
    primary.push(`[原文 ${i}] ${ref.label}\n${text}`);
  }
  const wiki = (await readFile(new URL(`sources/${person.id}/wiki.txt`, DATA), "utf8")).slice(0, MAX_WIKI);
  const anchor = ANCHORS[person.id];
  const system = [
    "你是中国史研究助理，为「历史行情局」按统一标准给历史人物的一生打分。只输出 JSON。",
    rubricText(),
    "【锚点人物】其他人都参照这些人落档：\n" + anchorTable(),
    "【输出格式】和下面的刘邦标准样例完全相同的字段结构：",
    gold,
    "【规则】",
    "1. events 按年份升序。kind=stage 是人生阶段节点（6–12 个，决定主曲线）；kind=sub 是阶段内的小起伏（0–6 个，只影响 K 线影线）。出生必须是第一个 stage。",
    "2. tierScore 是档内分，必须落在该档区间里；crisisPenalty 必须落在该危局区间里。分数由程序计算，你不要自己输出 score。",
    "3. quote.text 必须从【原文】里逐字复制，保持原文繁体，不超过 40 字；source 填原文编号。找不到贴切的原文就填 null，绝不编造，绝不引用维基。",
    "4. 年份用公元纪年，公元前为负数。年份不确定的 yearCertainty 填「估计」。",
    "5. finale 只给保留率和理由，不给分数。posthumous 写 0–4 个身后关键事件（平反、追封、被尊崇、被清算），分数不超过 98。",
    "6. rationale 不超过 40 字，说清为什么落这一档；summary 不超过 60 字，写发生了什么。",
    anchor ? `7. 此人是锚点：生前最高的 stage 分数必须约为 ${anchor.peak}，终章约为 ${anchor.finale}（= 最后一个 stage 分数 × 保留率），后世评价为 ${anchor.legacy}。` : "",
  ].join("\n\n");
  const user = [
    `人物：${person.name}（id: ${person.id}）`,
    `旧版数据里的事件（仅供参考，可增删改，年份以原文为准）：\n${await seedEvents(person.id)}`,
    primary.join("\n\n"),
    `[维基百科，仅作年表参考，不可引用]\n${wiki}`,
  ].join("\n\n");
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

function rescorePrompt(person, draft) {
  const list = draft.events.map((e, i) => `${i}. ${e.year} ${e.title}：${e.summary}`).join("\n");
  return [
    { role: "system", content: ["你是中国史研究助理。按下面的标准，对给定事件逐个独立打分。只输出 JSON：{\"scores\":[{\"index\":0,\"tier\":\"…\",\"tierScore\":0,\"crisis\":\"…\",\"crisisPenalty\":0}]}", rubricText(), "【锚点人物】\n" + anchorTable()].join("\n\n") },
    { role: "user", content: `人物：${person.name}，生于 ${draft.born.year}，卒于 ${draft.died.year}\n${list}` },
  ];
}

const [mode, ...rest] = process.argv.slice(2);
const force = rest.includes("--force");
const ids = rest.filter((a) => !a.startsWith("--"));
if (!["draft", "rescore"].includes(mode)) { console.log("用法：node pipeline/extract.mjs draft|rescore [id...] [--force]"); process.exit(1); }
if (!KEY) { console.log("缺少环境变量 DEEPSEEK_API_KEY"); process.exit(1); }
await mkdir(new URL("drafts/", DATA), { recursive: true });
await mkdir(new URL("rescore/", DATA), { recursive: true });

let total = 0;
for (const person of SAMPLE.filter((p) => !ids.length || ids.includes(p.id))) {
  const out = new URL(`${mode === "draft" ? "drafts" : "rescore"}/${person.id}.json`, DATA);
  if (existsSync(out) && !force) { console.log(`- ${person.name} 已存在，跳过`); continue; }
  const draftFile = new URL(`drafts/${person.id}.json`, DATA);
  if (mode === "rescore" && !existsSync(draftFile)) { console.log(`- ${person.name} 还没起草，跳过`); continue; }
  try {
    const messages = mode === "draft" ? await draftPrompt(person) : rescorePrompt(person, JSON.parse(await readFile(draftFile, "utf8")));
    const { json, usage } = await chat(messages);
    if (mode === "draft") { json.id = person.id; json.author = MODEL; }
    await writeFile(out, JSON.stringify(json, null, 2));
    await logUsage(person.id, mode, usage);
    total += usage.cost;
    console.log(`✓ ${person.name}  输入 ${usage.in} 输出 ${usage.out}  ¥${usage.cost}${usage.peak ? "（高峰价）" : ""}`);
  } catch (err) {
    if (err.usage) { await logUsage(person.id, `${mode}-failed`, err.usage); total += err.usage.cost; }
    console.log(`✗ ${person.name}：${err.message}`);
    if (err.message.includes("402")) break;
  }
}
console.log(`本次合计 ¥${total.toFixed(3)}`);
