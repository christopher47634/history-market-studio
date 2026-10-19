// 朝代字体：每个人按所处年代归到一组（eras.json），组决定人名用的标题字和简介 / K 线卡片用的正文字。
// DOM 里在人物相关的容器上标 data-era，CSS（chrome.css 的「朝代字体」一节）据此换字体；画布上的 K 线卡片直接用 eraFonts()。
import ERAS from "./eras.json";
import { figureById } from "../data.js";

const GROUP = Object.fromEntries(Object.entries(ERAS.groups).flatMap(([g, v]) => v.dynasties.map((d) => [d, g])));
const FALLBACK = '"HMS Serif", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif';

/** 人物（或人物 id）所属的字体组：gu / wei / tang / song / ming / jin。 */
export function eraOf(f) {
  const fig = typeof f === "string" ? figureById[f] : f;
  return GROUP[fig?.dynasty] ?? GROUP[figureById[fig?.id]?.dynasty] ?? "jin";
}

/** 画布用的字体栈：name 给人名，text 给事件标题、引文。 */
export function eraFonts(f) {
  const g = ERAS.groups[eraOf(f)];
  return { name: `"${g.name}", ${FALLBACK}`, text: `"${g.text}", ${FALLBACK}`, nameWeight: g.nameWeight };
}

export const ERA_GROUPS = ERAS.groups;
