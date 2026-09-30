// 给某些人追加原文卷（本纪后续各卷，或合传整卷不截取），写成 primary-1.txt、primary-2.txt……并登记到 registry-full.json。
// 用法：node pipeline/add-volumes.mjs
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { wikitextToPlain, toSimplified } from "./text.mjs";

const EXTRA = {
  qianlong: ["清史稿/卷11", "清史稿/卷12", "清史稿/卷13", "清史稿/卷14", "清史稿/卷15"],
  wanyanjing: ["金史/卷10", "金史/卷11", "金史/卷12"],
  xiaowendi: ["魏書/卷7下"],
  yuwentai: ["周書/卷2"],
  zhuwen: ["舊五代史/卷2", "舊五代史/卷3", "舊五代史/卷4", "舊五代史/卷5", "舊五代史/卷6", "舊五代史/卷7"],
  licunxu: ["舊五代史/卷28", "舊五代史/卷29", "舊五代史/卷30", "舊五代史/卷31", "舊五代史/卷32", "舊五代史/卷33", "舊五代史/卷34"],
  yeluhongji: ["遼史/卷22", "遼史/卷23", "遼史/卷24", "遼史/卷25", "遼史/卷26"],
  lianpo: ["史記/卷081"], xielingyun: ["宋書/卷67"], chenghao: ["宋史/卷427"], libi: ["舊唐書/卷130"],
};
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function raw(title, hops = 0) {
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`, { headers: UA });
    if (res.status === 429) { await sleep(8000 * i); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const t = await res.text();
    const r = t.match(/^#(?:REDIRECT|重定向)\s*\[\[([^\]]+)\]\]/i);
    return r && hops < 3 ? raw(r[1], hops + 1) : t;
  }
  throw new Error("429");
}
const regFile = new URL("./registry-full.json", import.meta.url);
const reg = JSON.parse(await readFile(regFile, "utf8"));
for (const [id, titles] of Object.entries(EXTRA)) {
  const entry = reg[id];
  for (const title of titles) {
    if (entry.ws.some((w, i) => i > 0 && w.title === title)) continue;
    const i = entry.ws.length;
    try {
      const r = await raw(title);
      const text = wikitextToPlain(r);
      const m = r.match(/section\s*=\s*([^\n|]+)/);
      const sec = m ? toSimplified(wikitextToPlain(m[1]).replace(/\s+/g, " ").trim()) : "";
      await writeFile(new URL(`../data/v2/sources/${id}/primary-${i}.txt`, import.meta.url), text);
      entry.ws.push({ title, label: `《${toSimplified(title.split("/")[0])}${sec ? "·" + sec : ""}》` });
      console.log(id, title, text.length);
    } catch (err) { console.log(id, title, "失败", err.message); }
    await sleep(600);
  }
}
await writeFile(regFile, JSON.stringify(reg, null, 1));
