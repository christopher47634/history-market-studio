// 角色卡素材：从中文维基百科取每人的头像和条目导语，存到本站（访客不必直连维基）。
// - 头像只用维基共享资源（Commons）上的自由版权图片（公有领域 / CC0 / CC BY / CC BY-SA），
//   记下作者和许可证用于署名；中文维基本地上传的合理使用图片不用。
// - 导语取条目开头（简体），记下版本号，出处链接用 oldid 固定版本。
// 输出：public/portraits/<id>.<ext>，data/v2/portraits.json。可断点续跑；指定 id 时强制重抓。
// 用法：node pipeline/fetch-portraits.mjs [id...]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ALL } from "./registry.mjs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/v2/portraits.json", ROOT);
const IMG = new URL("public/portraits/", ROOT);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : {};
const wanted = process.argv.slice(2);
await mkdir(IMG, { recursive: true });

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (res.status === 429) throw new Error("429");
      return await res.json();
    } catch (err) { if (i >= 6) throw err; await sleep(8000 * i); }
  }
}
const stripHtml = (s = "") => {
  const t = s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const half = t.length / 2; // 维基元数据常把作者名重复两遍（链接文字 + 隐藏文字）
  return Number.isInteger(half) && t.slice(0, half) === t.slice(half) ? t.slice(0, half) : t;
};
const FREE = /^(public domain|pd|cc0|cc[ -]by(-sa)?([ -][\d.]+)?)/i;

// 每人的条目名：近现代人物用登记过的维基条目，其余用人名（会自动跟随重定向）。
const { figures } = await import("../src/data.js");
const titleOf = Object.fromEntries(ALL.map((p) => [p.id, p.ws.find((w) => w.site === "wp")?.title]).filter(([, t]) => t));
// 人名是消歧义页的，手工指定条目（已核对生卒年和事迹）。
const TITLE_FIX = { chenping: "陈平 (汉朝)", liubo: "刘伯温", yangsu: "楊素", bayan: "伯顏 (八鄰部)" };
const todo = figures.filter((f) => (wanted.length ? wanted.includes(f.id) : !store[f.id] || store[f.id].miss)).map((f) => ({ id: f.id, name: f.name, title: TITLE_FIX[f.id] ?? titleOf[f.id] ?? f.name }));
console.log(`待取 ${todo.length} 人`);

for (let at = 0; at < todo.length; at += 20) {
  const batch = todo.slice(at, at + 20);
  const data = await api("zh.wikipedia.org", {
    action: "query", redirects: "1", variant: "zh-cn", titles: batch.map((b) => b.title).join("|"),
    prop: "extracts|pageimages|pageprops|revisions", exintro: "1", explaintext: "1", exlimit: "20",
    piprop: "name", ppprop: "disambiguation", rvprop: "ids|timestamp",
  });
  // 请求的条目名 → 最终页面（经过规范化和重定向）。
  const follow = (t) => {
    for (const n of data.query.normalized ?? []) if (n.from === t) t = n.to;
    for (const r of data.query.redirects ?? []) if (r.from === t) t = r.to;
    return data.query.pages.find((p) => p.title === t);
  };
  const files = [];
  for (const b of batch) {
    const page = follow(b.title);
    if (!page || page.missing || page.pageprops?.disambiguation !== undefined || !page.extract) { console.log(`✗ ${b.name}：「${b.title}」没有可用条目`); store[b.id] = { miss: true }; continue; }
    const extract = page.extract.replace(/\s*\n+\s*/g, "\n").trim();
    store[b.id] = { title: page.title, revid: page.revisions?.[0]?.revid, date: page.revisions?.[0]?.timestamp?.slice(0, 10), extract: extract.slice(0, 900) };
    if (page.pageimage) files.push({ id: b.id, file: page.pageimage });
  }
  // 头像：到 Commons 查许可证和缩略图；Commons 上没有的（本地合理使用图）跳过。
  if (files.length) {
    const info = await api("commons.wikimedia.org", { action: "query", titles: files.map((f) => `File:${f.file}`).join("|"), prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "320" });
    for (const f of files) {
      const page = info.query.pages.find((p) => p.title.replace(/^File:/, "").replace(/ /g, "_") === f.file.replace(/ /g, "_"));
      const ii = page?.imageinfo?.[0];
      const meta = ii?.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value);
      if (!ii || page.missing || !FREE.test(license)) { console.log(`· ${store[f.id].title}：头像不是 Commons 自由图片（${license || "非 Commons"}），不用`); continue; }
      const ext = (ii.thumburl.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
      const res = await fetch(ii.thumburl, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.log(`· ${store[f.id].title}：缩略图下载失败 ${res.status}`); continue; }
      await writeFile(new URL(`${f.id}.${ext}`, IMG), Buffer.from(await res.arrayBuffer()));
      store[f.id].img = {
        src: `portraits/${f.id}.${ext}`, w: ii.thumbwidth, h: ii.thumbheight,
        file: page.title, page: ii.descriptionurl, license, artist: stripHtml(meta.Artist?.value).slice(0, 120) || "佚名",
      };
      await sleep(600);
    }
  }
  await writeFile(OUT, JSON.stringify(store, null, 1));
  const done = Object.values(store);
  console.log(`… ${Math.min(at + 20, todo.length)}/${todo.length}　有条目 ${done.filter((x) => !x.miss).length}，有头像 ${done.filter((x) => x.img).length}`);
  await sleep(3000);
}
