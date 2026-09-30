import * as OpenCC from "opencc-js";

const t2s = OpenCC.Converter({ from: "tw", to: "cn" });

// 版面类模板整个删掉；{{a|文天祥}}、{{YL|咸淳九年}}、{{w|贛州}} 这类行内模板保留显示文字（最后一个位置参数）。
const DROP_TEMPLATE = /^(header2?|textquality|pd-|footer|wikipedia|defaultsort|other versions|.*作品$)/i;

function stripTemplates(text) {
  let prev;
  do {
    prev = text;
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const [name, ...args] = body.split("|");
      if (DROP_TEMPLATE.test(name.trim())) return "";
      const positional = args.filter((arg) => !/^\s*[\w-]+\s*=/.test(arg));
      return positional.length ? positional.at(-1).trim() : "";
    });
  } while (text !== prev);
  return text;
}

export function wikitextToPlain(raw) {
  let text = raw.replace(/<!--[\s\S]*?-->/g, "");
  // 繁简转换标记：-{徵}- 取原字；-{zh-hans:征;zh-hant:徵}- 取繁体一项。
  text = text.replace(/-\{([^{}]*)\}-/g, (_, body) => {
    const variants = Object.fromEntries(body.split(";").map((p) => p.split(":")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
    return variants["zh-hant"] ?? variants["zh-tw"] ?? Object.values(variants)[0] ?? body;
  });
  text = text.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "");
  text = stripTemplates(text);
  text = text.replace(/\[\[(?:File|Image|文件|图像|Category|分類|分类):[^\]]*\]\]/gi, "");
  text = text.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
  text = text.replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1");
  text = text.replace(/'''?/g, "").replace(/<[^>]+>/g, "").replace(/__[A-Z]+__/g, "");
  text = text.replace(/^\s*=+\s*(.*?)\s*=+\s*$/gm, "【$1】");
  text = text.replace(/^[:*#;]+\s*/gm, "").replace(/&nbsp;/g, " ");
  return text.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

const NEXT_BIO = /^[一-鿿]{2,3}，字/;
const KIN = /^[父子弟兄孫孙妻女祖從从族]/;

// 从多人合传里截出传主一段：从 start 原文开始，到 end 原文、下一个【标题】或下一位「某某，字」开头的传为止。
// 找不到 start 返回 null，由调用方保留整卷。
export function sliceSection(plain, { start, end }) {
  const from = plain.indexOf(start);
  if (from < 0) return null;
  const rest = plain.slice(from);
  let stop = end ? rest.indexOf(end, start.length) : -1;
  if (stop < 0) {
    const lines = rest.split("\n");
    let offset = lines[0].length + 1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("【") || (NEXT_BIO.test(line) && !KIN.test(line))) { stop = offset; break; }
      offset += line.length + 1;
    }
  }
  return stop < 0 ? rest : rest.slice(0, stop);
}

export const toSimplified = (text) => t2s(text);

// 引文核验用：统一简体、去掉标点空白和常见异体差异。
export function normalizeForMatch(text) {
  return toSimplified(text)
    .replace(/[\s，。、；：？！「」『』“”‘’（）《》〈〉【】…—\-·,.;:?!()"'\[\]]/g, "")
    .replace(/[於]/g, "于").replace(/[爲為]/g, "为");
}

export function quoteFound(quote, sources) {
  const q = normalizeForMatch(quote);
  if (q.length < 4) return false;
  return sources.some((s) => normalizeForMatch(s).includes(q));
}

// 按关键词在原文里找整句：从 cursor 往后找（传记按时间顺序写），找不到再从头找一次。
// 句子太长时只取命中处前后的分句，控制在约 50 字。返回 { text, pos } 或 null。
export function findSentence(source, keys, cursor = 0) {
  if (!source) return null;
  const sentences = [...source.matchAll(/[^。！？\n]+[。！？]?/g)].map((m) => ({ text: m[0].trim().replace(/^[」』”’）\s]+/, ""), pos: m.index }));
  const ordered = [...keys].sort((a, b) => b.length - a.length);
  for (const from of [cursor, 0]) {
    for (const key of ordered) {
      const k = normalizeForMatch(key);
      if (k.length < 2) continue;
      const hit = sentences.find((s) => s.pos >= from && normalizeForMatch(s.text).includes(k));
      if (hit) return { text: trimAround(hit.text, key), pos: hit.pos, fromStart: from === 0 && cursor > 0 };
    }
  }
  return null;
}

function trimAround(sentence, key) {
  if (sentence.length <= 50) return sentence;
  const clauses = sentence.split(/(?<=[，；：])/);
  const k = normalizeForMatch(key);
  let i = clauses.findIndex((c) => normalizeForMatch(c).includes(k));
  if (i < 0) i = 0;
  let out = clauses[i];
  let lo = i, hi = i;
  while (out.length < 36 && (lo > 0 || hi < clauses.length - 1)) {
    if (hi < clauses.length - 1) out += clauses[++hi];
    if (out.length < 36 && lo > 0) out = clauses[--lo] + out;
  }
  return out.replace(/[，；：]$/, "");
}
