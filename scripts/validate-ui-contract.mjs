// v3 界面契约：静态检查关键约定 + 用真实数据跑一遍缩放分层的纯函数。
import { readFileSync } from "node:fs";
import { figureV2ById } from "../src/v2/all.js";
import { buildScene, LEVELS, levelOf, visibleNodes, labelBudget, candles, readingOrder } from "../src/v3/scene.js";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const fail = (message) => { throw new Error(message); };

const app = read("src/v3/App.jsx");
const chart = read("src/v3/LifeChart.jsx");
const reader = read("src/v3/Reader.jsx");
const bits = read("src/v3/bits.jsx");
const css = read("src/v3/app.css");

// 缩放分层：三层，阈值由大到小，跨度越小细节越多。
if (LEVELS.map((l) => l.label).join() !== "全景,章节,细读") fail("缩放层级必须是 全景 / 章节 / 细读");
if (levelOf(80).key !== "overview" || levelOf(20).key !== "chapter" || levelOf(6).key !== "detail") fail("缩放层级阈值不对");
const scene = buildScene([figureV2ById.zhouenlai]);
const p = scene.people[0];
const whole = [scene.lifeStart, scene.endX];
const counts = LEVELS.map((l) => visibleNodes(p, l, whole, labelBudget(l, 1000, 1)));
if (counts[0].dots.some((n) => n.kind === "sub")) fail("全景不应画细节小事");
if (!(counts[0].labels.length <= 6)) fail("全景标签不应超过 6 个");
if (!(counts[2].dots.length > counts[0].dots.length)) fail("细读应比全景显示更多节点");
if (candles(p, LEVELS[0]).length >= candles(p, LEVELS[1]).length) fail("K 线在放大后应从阶段级变为事件级");
const narrow = [1935, 1943];
if (visibleNodes(p, LEVELS[2], narrow, 20).labels.some((n) => n.x < narrow[0] || n.x > narrow[1])) fail("视窗外的节点不应挂标签");
if (readingOrder(scene).some((n, i, a) => i && n.x < a[i - 1].x)) fail("阅读顺序没有按时间排");
if (figureV2ById.zhouenlai.events.length + 1 < 16) fail("近现代人物节点应充足（周恩来至少 16 个）");

// 图表：标签避让、各层标签内容不同、滚轮缩放、吸附与双击细读。
if (!/labelLayout:\s*\{\s*hideOverlap:\s*true/.test(chart)) fail("节点标签缺少避让");
if (!chart.includes('level.key === "overview"') || !chart.includes("{q|「")) fail("各层标签内容没有区分（细读层应带原文）");
if (!/zoomOnMouseWheel:\s*true/.test(chart) || !chart.includes('filterMode: "none"')) fail("缺少滚轮缩放或会截断线条");
if (!chart.includes('zr.on("mousemove"') || !chart.includes('zr.on("dblclick"') || !chart.includes("nearest(")) fail("缺少节点吸附、点击固定或双击细读");
if (!chart.includes("红涨绿跌")) fail("K 线配色约定缺少说明");

// 阅读：依据分三类，百科不冒充原文；键盘逐个翻看。
if (!bits.includes("百科") || !bits.includes("史书原文") || !bits.includes("概括")) fail("依据徽标没有区分原文 / 百科 / 概括");
if (!reader.includes("不冒充原文")) fail("概括类节点缺少说明");
if (!app.includes('"ArrowLeft"') || !app.includes('"ArrowRight"') || !app.includes('"Escape"')) fail("缺少键盘翻看或回全景");
if (!app.includes("当时的势") || !app.includes("后世评价")) fail("读数没有区分当时的势与后世评价");

// 主题与可用性：两套主题都定义全部色值；不用纯黑纯白；有移动端、减少动态效果、键盘焦点。
for (const theme of ["jade", "cinnabar"]) {
  const block = css.slice(css.indexOf(`[data-theme="${theme}"]`));
  for (const token of ["--bg", "--surface", "--ink", "--ink-2", "--ink-3", "--accent", "--p0", "--p1", "--up", "--down"]) if (!block.includes(`${token}:`)) fail(`${theme} 主题缺少 ${token}`);
}
if (/#fff\b|#ffffff|#000\b|#000000/i.test(css)) fail("不使用纯白或纯黑");
if (!css.includes("@media (max-width: 720px)") || !css.includes("prefers-reduced-motion") || !css.includes(":focus-visible")) fail("缺少移动端、减少动态效果或键盘焦点样式");
if (!bits.includes('role="radiogroup"') || !bits.includes("aria-checked")) fail("分段选择器缺少无障碍语义");

console.log("ui contract validation passed: three zoom levels, label avoidance, evidence badges, two themes, keyboard and mobile rules verified");
