// 为样板以外的人物自动定位正史传记：按朝代限定史书，在维基文库检索，取真正含「某某，字」传首的那一卷并截出本传。
// 输出 data/v2/sources/<id>/primary-0.txt、wiki.txt，以及 pipeline/registry-full.json。
// 用法：node pipeline/resolve-sources.mjs [id...]
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import * as OpenCC from "opencc-js";
import { figures } from "../src/data.js";
import { SAMPLE } from "./registry.mjs";
import { wikitextToPlain, toSimplified } from "./text.mjs";

const toTrad = OpenCC.Converter({ from: "cn", to: "tw" });
const DATA = new URL("../data/v2/sources/", import.meta.url);
const OUT = new URL("./registry-full.json", import.meta.url);
const UA = { "User-Agent": "history-market-studio/2.0 (research; christopher47634)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BOOKS = {
  先秦: ["史記"], 秦汉: ["史記", "漢書", "後漢書"], 三国: ["三國志", "後漢書"],
  魏晋南北朝: ["晉書", "宋書", "南齊書", "梁書", "陳書", "魏書", "北齊書", "周書", "南史", "北史"],
  隋唐: ["隋書", "舊唐書", "新唐書"], 五代十国: ["舊五代史", "新五代史"], 宋: ["宋史"],
  辽金西夏: ["遼史", "金史", "宋史"], 元: ["元史", "新元史"], 明: ["明史"], 清: ["清史稿"], 近现代: [],
};

// 帝王、后妃、以字号行世者：传里不以本名开头，给检索词和传首标记。
const ALIAS = {
  lvhou: { terms: ["高皇后呂氏", "高后"], books: ["漢書", "史記"] },
  liuxiu: { terms: ["世祖光武皇帝"], books: ["後漢書"] },
  wangmang: { terms: ["王莽字巨君"], books: ["漢書"] },
  suiwendi: { terms: ["高祖文皇帝"], books: ["隋書"] }, yangguang: { terms: ["煬皇帝諱廣"], books: ["隋書"] },
  liyuan: { terms: ["高祖神堯大聖大光孝皇帝"], books: ["舊唐書"] },
  zhaokuangyin: { terms: ["太祖啟運立極英武睿文神德聖功至明大孝皇帝"], books: ["宋史"] },
  kublai: { terms: ["世祖聖德神功文武皇帝"], books: ["元史"] }, zhudi: { terms: ["成祖啟天弘道"], books: ["明史"] },
  yongzheng: { terms: ["世宗敬天昌運"], books: ["清史稿"] }, qianlong: { terms: ["高宗法天隆運"], books: ["清史稿"] },
  simayan: { terms: ["武皇帝諱炎"], books: ["晉書"] }, xiaowendi: { terms: ["高祖孝文皇帝"], books: ["魏書"] },
  liuyu: { terms: ["高祖武皇帝諱裕"], books: ["宋書"] }, fujian: { terms: ["苻堅字永固"], books: ["晉書"] },
  gaohuan: { terms: ["高祖神武皇帝"], books: ["北齊書"] }, yuwentai: { terms: ["太祖文皇帝姓宇文氏"], books: ["周書"] },
  goujian: { terms: ["越王句踐"], books: ["史記"] }, qihuangong: { terms: ["桓公小白"], books: ["史記"] },
  jinwengong: { terms: ["晉文公重耳"], books: ["史記"] }, zhaowulingwang: { terms: ["武靈王"], books: ["史記"] },
  xinlingjun: { terms: ["魏公子無忌"], books: ["史記"] }, mengchangjun: { terms: ["孟嘗君名文"], books: ["史記"] },
  laozi: { terms: ["老子者"], books: ["史記"] }, zhuangzi: { terms: ["莊子者"], books: ["史記"] }, mozi: { terms: ["墨翟"], books: ["史記"] },
  mencius: { terms: ["孟軻"], books: ["史記"] }, xunzi: { terms: ["荀卿"], books: ["史記"] }, sunwu: { terms: ["孫子武者"], books: ["史記"] },
  caopi: { terms: ["文帝諱丕"], books: ["三國志"] }, liubei: { terms: ["先主姓劉"], books: ["三國志"] }, sunquan: { terms: ["孫權字仲謀"], books: ["三國志"] },
  simayi: { terms: ["宣皇帝諱懿"], books: ["晉書"] }, simazhao: { terms: ["文皇帝諱昭"], books: ["晉書"] },
  licunxu: { terms: ["莊宗光聖神閔孝皇帝"], books: ["舊五代史"] }, zhuwen: { terms: ["太祖神武元聖孝皇帝"], books: ["舊五代史"] },
  chairong: { terms: ["世宗睿武孝文皇帝"], books: ["舊五代史"] }, liyu: { terms: ["煜字重光"], books: ["新五代史"] },
  likeiyong: { terms: ["武皇諱克用"], books: ["舊五代史"] }, shijingtang: { terms: ["高祖聖文章武明德孝皇帝"], books: ["舊五代史"] },
  liuzhiyuan: { terms: ["高祖睿文聖武昭肅孝皇帝"], books: ["舊五代史"] }, guowei: { terms: ["太祖聖神恭肅文武孝皇帝"], books: ["舊五代史"] },
  lisiyuan: { terms: ["明宗聖德和武欽孝皇帝"], books: ["舊五代史"] },
  abaoji: { terms: ["太祖大聖大明神烈天皇帝"], books: ["遼史"] }, aguda: { terms: ["太祖應乾興運昭德定功仁明莊孝大聖武元皇帝"], books: ["金史"] },
  xiaochuo: { terms: ["景宗睿智皇后蕭氏"], books: ["遼史"] }, liyuanhao: { terms: ["元昊"], books: ["宋史"] },
  wanyanliang: { terms: ["海陵庶人亮"], books: ["金史"] }, yeludashi: { terms: ["耶律大石者"], books: ["遼史"] },
  yeluhongji: { terms: ["道宗孝文皇帝"], books: ["遼史"] }, wanyanjing: { terms: ["章宗憲天光運"], books: ["金史"] },
  ogedei: { terms: ["太宗英文皇帝"], books: ["元史"] }, tolui: { terms: ["睿宗仁聖景襄皇帝"], books: ["元史"] },
  cixi: { terms: ["孝欽顯皇后"], books: ["清史稿"] }, xiaozhuang: { terms: ["孝莊文皇后"], books: ["清史稿"] },
  duoergun: { terms: ["睿忠親王多爾袞"], books: ["清史稿"] },
  changsunqueen: { terms: ["文德皇后長孫氏"], books: ["舊唐書"] }, duguhuanghou: { terms: ["文獻獨孤皇后"], books: ["隋書"], title: "隋書/卷36" },
  yangguifei: { terms: ["玄宗楊貴妃"], books: ["舊唐書"] }, shangguanwaner: { terms: ["上官昭容"], books: ["舊唐書"] },
  wangzhaojun: { terms: ["王昭君"], books: ["後漢書", "漢書"] },
};

async function get(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (res.status === 429 && i < tries) { await sleep(8000 * i); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) { if (i >= tries) throw err; await sleep(1500 * i); }
  }
}

async function wsRaw(title, hops = 0) {
  const raw = await get(`https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`);
  const redirect = raw.match(/^#(?:REDIRECT|重定向)\s*\[\[([^\]]+)\]\]/i);
  return redirect && hops < 3 ? wsRaw(redirect[1], hops + 1) : raw;
}

async function search(term, book) {
  const url = `https://zh.wikisource.org/w/api.php?action=query&list=search&format=json&srlimit=6&srnamespace=0&srsearch=${encodeURIComponent(`"${term}" intitle:${book}`)}`;
  const data = JSON.parse(await get(url));
  return (data.query?.search ?? []).map((s) => s.title).filter((t) => t.startsWith(`${book}/`));
}

const sectionLabel = (raw, title) => {
  const m = raw.match(/section\s*=\s*([^\n|]+)/);
  const sec = m ? wikitextToPlain(m[1]).replace(/\s+/g, " ").trim() : "";
  return `《${toSimplified(title.split("/")[0])}${sec ? "·" + toSimplified(sec) : ""}》`;
};

const NEXT_BIO = /^[一-鿿]{2,3}，字/;
const KIN = /^[父子弟兄孫孙妻女祖從从族]/;
function cutFrom(plain, index, annal = false, max = 16000) {
  const lineStart = plain.lastIndexOf("\n", index) + 1;
  const rest = plain.slice(lineStart);
  // 本纪是整卷一个人，不按「某某，字」切。
  if (annal) return rest.slice(0, max);
  const lines = rest.split("\n");
  let offset = lines[0].length + 1;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("【") || (NEXT_BIO.test(l) && !KIN.test(l))) return rest.slice(0, offset).slice(0, max);
    offset += l.length + 1;
  }
  return rest.slice(0, max);
}

// 在一卷里找传首：扫描检索词的每一处出现，跳过「○」开头的目录行，
// 优先取段首附近、后面紧跟「，字」「字」「者」「，本名」「，」的那一处。
function locate(plain, terms) {
  let best = null;
  // 有的卷是简体录入：繁简两种写法都试。
  for (const t of [...new Set(terms.flatMap((x) => [x, toSimplified(x)]))]) {
    let i = plain.indexOf(t);
    for (let n = 0; i >= 0 && n < 300; n++, i = plain.indexOf(t, i + 1)) {
      const lineStart = plain.lastIndexOf("\n", i) + 1;
      if (plain[lineStart] === "○") continue;
      const after = plain.slice(i + t.length, i + t.length + 4);
      const atStart = i - lineStart <= 6;
      const bioLike = /^(，?字|者|，本名|本名|，)/.test(after);
      const score = (atStart ? 2 : 0) + (bioLike ? 2 : 0);
      if (!best || score > best.score) best = { index: i, score, strong: score >= 4 };
      if (score >= 4) return best;
    }
  }
  return best;
}

const PINS = Object.fromEntries(
  (existsSync(new URL("../work/pins.txt", import.meta.url)) ? readFileSync(new URL("../work/pins.txt", import.meta.url), "utf8") : "")
    .split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const [id, title, term] = l.trim().split(/\s+/); return [id, { title, terms: term ? [term] : undefined }]; }),
);

const registry = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : {};
const wanted = process.argv.slice(2);
const done = new Set(SAMPLE.map((p) => p.id));
const targets = figures.filter((f) => !done.has(f.id) && (!wanted.length || wanted.includes(f.id)));

for (const f of targets) {
  const dir = new URL(`${f.id}/`, DATA);
  await mkdir(dir, { recursive: true });
  const alias = PINS[f.id] ? { ...ALIAS[f.id], ...PINS[f.id], terms: PINS[f.id].terms ?? ALIAS[f.id]?.terms } : ALIAS[f.id];
  const trad = toTrad(f.name);
  const terms = alias?.terms ?? [trad];
  const books = alias?.books ?? BOOKS[f.dynasty] ?? [];
  const entry = { id: f.id, name: f.name, dynasty: f.dynasty, ws: [], wiki: f.name, note: "" };

  if (books.length && !existsSync(new URL("primary-0.txt", dir))) {
    let best = null;
    try {
      const candidates = [];
      if (alias?.title) candidates.push(alias.title);
      for (const book of alias?.title ? [] : books) {
        for (const t of terms.slice(0, 1)) candidates.push(...(await search(t, book)));
        await sleep(300);
        if (candidates.length >= 3) break;
      }
      for (const title of [...new Set(candidates)].slice(0, 3)) {
        const raw = await wsRaw(title);
        const plain = wikitextToPlain(raw);
        const hit = locate(plain, terms);
        if (!hit) continue;
        const lineStart = plain.lastIndexOf("\n", hit.index) + 1;
        // 传首：命中处在段落开头附近，并且是「字」「者」「諱」式或别名全称。
        const bioStart = hit.strong || (hit.index - lineStart < 12 && alias && terms[0].length >= 4);
        const score = (bioStart ? 1000 : 0) + (title.includes("紀") ? 5 : 0) - hit.index / 1e5;
        if (!best || score > best.score) best = { title, raw, plain, hit, score, bioStart };
        await sleep(300);
      }
    } catch (err) { entry.note = `检索失败：${err.message}`; }
    if (best) {
      const text = cutFrom(best.plain, best.hit.index, /纪|紀/.test(sectionLabel(best.raw, best.title)));
      await writeFile(new URL("primary-0.txt", dir), text);
      entry.ws = [{ title: best.title, label: sectionLabel(best.raw, best.title) }];
      entry.note = best.bioStart ? "" : "未找到传首，按首次出现截取，需人工确认";
    } else if (!entry.note) entry.note = "正史中未找到";
  } else if (registry[f.id]?.ws?.length) entry.ws = registry[f.id].ws;

  const wikiFile = new URL("wiki.txt", dir);
  if (!existsSync(wikiFile)) {
    try {
      await sleep(1200);
      const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&variant=zh-cn&titles=${encodeURIComponent(f.name)}`;
      const page = Object.values(JSON.parse(await get(url)).query.pages)[0];
      await writeFile(wikiFile, page.extract || "");
    } catch (err) { entry.note += `；维基失败 ${err.message}`; }
  }
  const primary = existsSync(new URL("primary-0.txt", dir)) ? await readFile(new URL("primary-0.txt", dir), "utf8") : "";
  registry[f.id] = entry;
  await writeFile(OUT, JSON.stringify(registry, null, 1));
  console.log(`${f.id}\t${f.name}\t${entry.ws[0]?.title ?? "—"}\t${primary.length}\t${primary.slice(0, 24).replace(/\n/g, " ")}\t${entry.note}`);
}
