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
