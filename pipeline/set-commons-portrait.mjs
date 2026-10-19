// 指定某人的头像为 Wikimedia Commons 上的某个文件（核对许可证，只收公有领域 / CC0 / CC BY / CC BY-SA）。
// 用法：node pipeline/set-commons-portrait.mjs <人物id> "File:xxx.jpg"   之后跑 python pipeline/roles.py
import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/v2/portraits.json", ROOT);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const strip = (s = "") => {
  const t = s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const half = t.length / 2; // 元数据常把作者名重复两遍
  return Number.isInteger(half) && t.slice(0, half) === t.slice(half) ? t.slice(0, half) : t;
};
const [id, file] = process.argv.slice(2);
if (!id || !file) throw new Error("用法：node pipeline/set-commons-portrait.mjs <人物id> \"File:xxx.jpg\"");
const store = JSON.parse(await readFile(OUT, "utf8"));
if (!store[id]) throw new Error(`没有这个人物：${id}`);
const q = new URLSearchParams({ action: "query", format: "json", formatversion: "2", titles: file, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "320" });
const page = (await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: UA }).then((r) => r.json())).query.pages[0];
const ii = page?.imageinfo?.[0];
if (!ii) throw new Error(`Commons 上没有 ${file}`);
const license = strip(ii.extmetadata.LicenseShortName?.value);
if (!/^(public domain|pd|cc0|cc[ -]by(-sa)?([ -][\d.]+)?)/i.test(license)) throw new Error(`${file} 不是自由许可（${license}）`);
const res = await fetch(ii.thumburl, { headers: UA });
if (!res.ok) throw new Error(`下载失败 ${res.status}`);
const ext = /png/.test(res.headers.get("content-type") ?? "") ? "png" : "jpg";
for (const old of ["webp", "jpg", "png"]) { const p = new URL(`public/portraits/${id}.${old}`, ROOT); if (existsSync(p)) await unlink(p); }
await writeFile(new URL(`public/portraits/${id}.${ext}`, ROOT), Buffer.from(await res.arrayBuffer()));
store[id].img = { src: `portraits/${id}.${ext}`, file: page.title, page: ii.descriptionurl, license, artist: strip(ii.extmetadata.Artist?.value).slice(0, 120) || "佚名", source: "commons" };
await writeFile(OUT, JSON.stringify(store, null, 1));
console.log(`✓ ${id} ← ${page.title}（${license}）`);
