// 抓取样板人物的原文（维基文库）和年表参考（中文维基），缓存到 data/v2/sources/<id>/。
// 用法：node pipeline/fetch-sources.mjs [id...]
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { SAMPLE } from "./registry.mjs";
import { wikitextToPlain, sliceSection } from "./text.mjs";

const ROOT = new URL("../data/v2/sources/", import.meta.url);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };

async function get(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (res.status === 429 && i < tries) { await new Promise((r) => setTimeout(r, 8000 * i)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function wsRaw(title, hops = 0) {
  const raw = await get(`https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`);
  const redirect = raw.match(/^#(?:REDIRECT|重定向)\s*\[\[([^\]]+)\]\]/i);
  return redirect && hops < 3 ? wsRaw(redirect[1], hops + 1) : raw;
}

async function wikiExtract(title) {
  const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&variant=zh-cn&titles=${encodeURIComponent(title)}`;
  const data = JSON.parse(await get(url));
  const page = Object.values(data.query.pages)[0];
  return page.extract || "";
}

const wanted = process.argv.slice(2);
const report = [];
for (const person of SAMPLE.filter((p) => !wanted.length || wanted.includes(p.id))) {
  const dir = new URL(`${person.id}/`, ROOT);
  await mkdir(dir, { recursive: true });
  const entry = { id: person.id, name: person.name, primary: [], wiki: 0, problems: [] };
  for (const [index, ref] of person.ws.entries()) {
    const file = new URL(`primary-${index}.txt`, dir);
    let text;
    if (existsSync(file)) text = await readFile(file, "utf8");
    else {
      try {
        let plain = wikitextToPlain(await wsRaw(ref.title));
        if (ref.section) {
          const cut = sliceSection(plain, ref.section);
          if (!cut) entry.problems.push(`${ref.title} 里没找到「${ref.section.start}」开头，保留全卷`);
          else plain = cut;
        }
        text = plain;
        await writeFile(file, text);
      } catch (err) {
        entry.problems.push(`${ref.title} 抓取失败：${err.message}`);
        continue;
      }
    }
    if (text.length < 200) entry.problems.push(`${ref.title} 正文过短（${text.length} 字）`);
    entry.primary.push({ title: ref.title, label: ref.label, chars: text.length });
  }
  const wikiFile = new URL("wiki.txt", dir);
  if (!existsSync(wikiFile)) await new Promise((r) => setTimeout(r, 1500));
  try {
    const wiki = existsSync(wikiFile) ? await readFile(wikiFile, "utf8") : await wikiExtract(person.wiki);
    if (!existsSync(wikiFile)) await writeFile(wikiFile, wiki);
    entry.wiki = wiki.length;
    if (wiki.length < 500) entry.problems.push(`维基条目「${person.wiki}」过短`);
  } catch (err) {
    entry.problems.push(`维基条目抓取失败：${err.message}`);
  }
  report.push(entry);
  console.log(`${person.name.padEnd(4, "　")} 原文 ${entry.primary.map((p) => p.chars).join("+") || 0} 字  维基 ${entry.wiki} 字${entry.problems.length ? "  ⚠ " + entry.problems.join("；") : ""}`);
}
await writeFile(new URL("_fetch-report.json", ROOT), JSON.stringify(report, null, 2));
