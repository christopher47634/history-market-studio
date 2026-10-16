// 补头像：中文维基条目首图不能用的人，依次再找
//   1. 维基数据的「图像」（P18）、英文维基的条目首图——仍然只收 Commons 上的自由版权图片；
//   2. 都没有，用百度百科词条的概述图（用户要求不留空）。百度百科图片没有标注许可，署名写明来源词条。
// 输出同 fetch-portraits.mjs：public/portraits/<id>.<ext> + data/v2/portraits.json 的 img（source 标明来源）。
// 用法：node pipeline/fill-portraits.mjs [id...]   之后跑 python pipeline/roles.py
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/v2/portraits.json", ROOT);
const IMG = new URL("public/portraits/", ROOT);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = JSON.parse(await readFile(OUT, "utf8"));
const { figures } = await import("../src/data.js");
const wanted = process.argv.slice(2);
const todo = figures.filter((f) => (wanted.length ? wanted.includes(f.id) : !store[f.id]?.img));
const FREE = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -][\d.]+)?)/i;
const stripHtml = (s = "") => {
  const t = s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const half = t.length / 2;
  return Number.isInteger(half) && t.slice(0, half) === t.slice(half) ? t.slice(0, half) : t;
};
async function json(url) {
  for (let i = 1; ; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }); if (r.status === 429) throw new Error("429"); return await r.json(); }
    catch (e) { if (i >= 4) throw e; await sleep(4000 * i); }
  }
}
const api = (host, p) => json(`https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...p })}`);

async function commons(file) {
  const info = await api("commons.wikimedia.org", { action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "320" });
  const page = info.query.pages[0];
  const ii = page?.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!ii || page.missing || !FREE.test(license)) return null;
  return { url: ii.thumburl, file: page.title, page: ii.descriptionurl, license, artist: stripHtml(meta.Artist?.value).slice(0, 120) || "佚名", source: "commons" };
}

async function fromWiki(f) {
  const title = store[f.id]?.title ?? f.name;
  const zh = await api("zh.wikipedia.org", { action: "query", redirects: "1", titles: title, prop: "pageprops|langlinks", ppprop: "wikibase_item", lllang: "en" });
  const page = zh.query.pages[0];
  const qid = page?.pageprops?.wikibase_item;
  if (qid) {
    const wd = await json(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${qid}&property=P18`);
    for (const c of wd.claims?.P18 ?? []) {
      const hit = await commons(c.mainsnak.datavalue.value);
      if (hit) return { ...hit, via: "维基数据" };
    }
  }
  const en = page?.langlinks?.[0]?.title;
  if (en) {
    const e = await api("en.wikipedia.org", { action: "query", redirects: "1", titles: en, prop: "pageimages", piprop: "name" });
    const file = e.query.pages[0]?.pageimage;
    if (file) { const hit = await commons(file); if (hit) return { ...hit, via: "英文维基" }; }
  }
  return null;
}

async function fromBaike(f) {
  const key = store[f.id]?.title?.replace(/\s*\(.*\)$/, "") ?? f.name;
  for (const k of [...new Set([f.name, key])]) {
    const card = await json(`https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?${new URLSearchParams({ scope: "103", format: "json", appid: "379020", bk_key: k, bk_length: "600" })}`).catch(() => null);
    if (card?.image) return { url: card.image, file: null, page: card.url ?? `https://baike.baidu.com/item/${encodeURIComponent(k)}`, license: "百度百科词条图片（未标注许可）", artist: "百度百科", source: "baike", via: "百度百科", title: card.title ?? k };
  }
  return null;
}

for (const f of todo) {
  let hit = await fromWiki(f).catch((e) => (console.log(`· ${f.name} 维基查询失败：${e.message}`), null));
  if (!hit) hit = await fromBaike(f).catch(() => null);
  if (!hit) { console.log(`✗ ${f.name}：哪里都没找到头像`); continue; }
  const res = await fetch(hit.url, { headers: { ...UA, ...(hit.source === "baike" ? { Referer: "https://baike.baidu.com/" } : {}) }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) { console.log(`✗ ${f.name}：下载失败 ${res.status}`); continue; }
  const type = res.headers.get("content-type") ?? "";
  const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /gif/.test(type) ? "gif" : "jpg";
  await writeFile(new URL(`${f.id}.${ext}`, IMG), Buffer.from(await res.arrayBuffer()));
  store[f.id] = { ...(store[f.id] ?? { title: f.name, extract: "" }), img: { src: `portraits/${f.id}.${ext}`, file: hit.file, page: hit.page, license: hit.license, artist: hit.artist, source: hit.source, ...(hit.title ? { pageTitle: hit.title } : {}) } };
  console.log(`✓ ${f.name}：${hit.via}${hit.file ? ` ${hit.file}（${hit.license}）` : ""}`);
  await writeFile(OUT, JSON.stringify(store, null, 1));
  await sleep(500);
}
const all = Object.values(store);
console.log(`有头像 ${all.filter((x) => x.img).length} / ${figures.length}（其中百度百科 ${all.filter((x) => x.img?.source === "baike").length}）`);
