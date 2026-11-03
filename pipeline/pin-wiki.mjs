// 把近现代人物引用的维基条目固定到一个版本：同一次请求里取正文和版本号，
// 正文写回 sources/<id>/wiki.txt，版本号记进 data/v2/wiki-revisions.json。
// 引用链接用 oldid 永久链接，以后条目改了也能打开当时核对的那一版。
// 用法：node pipeline/pin-wiki.mjs [id...]
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ALL } from "./registry.mjs";

const DATA = new URL("../data/v2/", import.meta.url);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const file = new URL("wiki-revisions.json", DATA);
const pins = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
const wanted = process.argv.slice(2);

// 默认只补还没固定的；指定 id 时强制重抓。
for (const person of ALL.filter((p) => p.ws.some((w) => w.site === "wp") && (wanted.length ? wanted.includes(p.id) : !pins[p.id]))) {
  const title = person.ws.find((w) => w.site === "wp").title;
  const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts|revisions&rvprop=ids|timestamp&explaintext=1&redirects=1&format=json&variant=zh-cn&titles=${encodeURIComponent(title)}`;
  let data;
  for (let i = 1; ; i++) {
    try { data = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })).json(); break; }
    catch (err) { if (i >= 6) throw err; await new Promise((r) => setTimeout(r, 15000 * i)); }
  }
  const page = Object.values(data.query.pages)[0];
  const rev = page.revisions?.[0];
  if (!page.extract || !rev) { console.log(`✗ ${person.name}：取不到「${title}」`); continue; }
  await writeFile(new URL(`sources/${person.id}/wiki.txt`, DATA), page.extract);
  pins[person.id] = { title: page.title, revid: rev.revid, timestamp: rev.timestamp };
  await writeFile(file, JSON.stringify(pins, null, 1));
  console.log(`✓ ${person.name}  ${page.title}  oldid=${rev.revid}  ${rev.timestamp.slice(0, 10)}  ${page.extract.length} 字`);
  await new Promise((r) => setTimeout(r, 4000));
}
