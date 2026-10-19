// v3 界面契约：静态检查关键约定 + 用真实数据跑一遍缩放分层的纯函数。
import { readFileSync } from "node:fs";
import { figureV2ById } from "../src/v2/all.js";
import { existsSync } from "node:fs";
import { buildScene, LEVELS, levelOf, visibleNodes, labelBudget, candles, readingOrder, nearest, yRange, valueAt } from "../src/v3/scene.js";

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

// 看盘交互：十字光标按列吸附（光标高度不影响单人吸附）、带滞回；放大后纵轴自适应；K 线带涨跌副图；拖动不算点击。
const px = (n) => [n.x * 10, 400 - n.score * 4];
const far = nearest(p.main, [p.main[5].x * 10 + 1, 0], px);
if (far !== p.main[5]) fail("十字光标应按列吸附：光标远离圆点也要吸到同一列的节点");
const mid = (p.main[5].x + p.main[6].x) * 5;
if (nearest(p.main, [mid + 1, 0], px, { prev: p.main[5] }) !== p.main[5]) fail("吸附缺少滞回，两列之间会来回跳");
const [lo0, hi0] = yRange(scene.people, LEVELS[0], whole);
const [lo2, hi2] = yRange(scene.people, LEVELS[2], [p.main[8].x - 4, p.main[8].x + 4]);
if (lo0 !== 0 || hi0 !== 100 || hi2 - lo2 >= 100 || hi2 - lo2 < 20) fail("全景纵轴应固定 0–100，放大后应自适应且至少跨 20");
if (valueAt(p, p.main[3].x, LEVELS[0]) !== p.main[3].score || valueAt(p, p.main[0].x - 5, LEVELS[0]) !== null) fail("同期取值应沿图上的线取，出生前为空");
if (!chart.includes("makeCrosshair") || !chart.includes('id: `vol-${slot}`') || !chart.includes("S.dragging")) fail("缺少十字光标、涨跌副图或拖动与点击的区分");
if (!app.includes("function Legend") || !app.includes("开<em>")) fail("缺少开高低收信息栏");

// 角色页：六个领域板块 + 特色板块；每个板块都有人；角色卡素材 300 人齐全，头像都有许可证和作者。
const { BOARDS, filterFigures } = await import("../src/v3/boards.js");
const { default: index } = await import("../src/v2/index.generated.js");
const { default: roles } = await import("../src/v2/roles.generated.js");
for (const b of BOARDS) if (!filterFigures(index, { board: b }).length) fail(`板块「${b.label}」没有人物`);
if (index.some((f) => !f.trend || f.trend.length < 3)) fail("索引缺少一生走势（trend），角色页画不出迷你走势");
const missing = index.filter((f) => !roles[f.id]);
if (missing.length) fail(`角色卡缺少维基简介：${missing.map((f) => f.name).join("、")}`);
for (const [id, r] of Object.entries(roles)) {
  if (!r.revid || !r.brief) fail(`角色卡 ${id} 缺少版本号或简介`);
  if (!JSON.parse(readFileSync(new URL(`../data/v2/client/${id}.json`, import.meta.url), "utf8")).wikiIntro) fail(`${id} 的按需数据包缺少完整维基导语`);
  if (r.img && (!r.img.license || !r.img.artist || !r.img.page || !existsSync(new URL(`../public/${r.img.src}`, import.meta.url)))) fail(`角色卡 ${id} 的头像缺少许可证、作者、来源页或图片文件`);
}
const rolesView = read("src/v3/RolesView.jsx");
if (!rolesView.includes("onDragStart") || !rolesView.includes("onDrop") || !rolesView.includes("BriefCard") || !rolesView.includes("FullCard")) fail("角色页缺少拖放对比、简要角色卡或完整角色卡");

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

// 材质层：不用纯黑纯白；原生滚动条全部隐藏，竖向滚动由 OverlayScrollbars（发光主题）接管，横向滚动区挂 data-hscroll。
const material = read("src/v3/material.css");
if (/#fff\b|#ffffff|#000\b|#000000/i.test(material)) fail("material.css 不使用纯白或纯黑");
if (!material.includes("scrollbar-width: none") || !material.includes("::-webkit-scrollbar") || !material.includes(".os-theme-glow")) fail("原生滚动条没有全部隐藏，或缺少 OverlayScrollbars 发光主题");
if (!material.includes("prefers-reduced-motion")) fail("材质层缺少减少动态效果的处理");
const picker = read("src/v3/Picker.jsx");
if (!picker.includes("<Scroll") || !rolesView.includes("<Scroll") || !app.includes("data-hscroll") || !bits.includes("OverlayScrollbarsComponent")) fail("滚动区没有用 OverlayScrollbars（<Scroll>），或横向滚动区缺少 data-hscroll");
for (const f of ["src/v3/glowscroll.js", "src/v3/pointer.js"]) if (!existsSync(new URL(f, root))) fail(`缺少 ${f}`);
if (!read("src/main.jsx").includes("installGlowScroll()")) fail("入口没有启用光束滚动条");

// 10-19 改版：吸顶玻璃导航 + ⌘K 搜索面板 + 液态玻璃折射；图标只用 Lucide，不用字符冒充；不用侧边彩条和渐变字。
const chrome = read("src/v3/chrome.css");
if (/#fff\b|#ffffff|#000\b|#000000/i.test(chrome)) fail("chrome.css 不使用纯白或纯黑");
if (!chrome.includes(".v3-bar") || !chrome.includes("position: sticky") || !chrome.includes(".v3-cmd__panel")) fail("缺少吸顶导航或搜索面板样式");
for (const f of ["src/v3/Command.jsx", "src/v3/liquid.js", "src/v3/icons.jsx", "src/v3/people.jsx"]) if (!existsSync(new URL(f, root))) fail(`缺少 ${f}`);
if (!app.includes("<CommandPalette") || !/metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === "k"/.test(app)) fail("没有挂上 ⌘K 搜索面板");
if (!read("src/main.jsx").includes("installLiquid()")) fail("入口没有启用液态玻璃");
if (!read("src/v3/material.css").includes("var(--lg-filter,)")) fail("玻璃的 backdrop-filter 没有接上折射滤镜");
// 键帽 <kbd>←</kbd> 里的方向键是按键名，不算冒充图标。
const ui = ["App.jsx", "RolesView.jsx", "Reader.jsx", "Picker.jsx", "Command.jsx"].map((f) => read(`src/v3/${f}`)).join("\n").replace(/<kbd>[^<]*<\/kbd>/g, "");
const glyph = ui.match(/>[^<>{}\n]*[⇄↗▲▼×→←][^<>{}\n]*</);
if (glyph) fail(`界面里还有用字符冒充的图标：${glyph[0]}`);
const allCss = [css, material, chrome, read("src/v3/type.css")].join("\n");
if (/background-clip:\s*text/.test(allCss)) fail("不用渐变字");
if (/border-left:\s*[2-9]px/.test(allCss)) fail("不用侧边彩色竖条");

// 朝代字体：每个朝代都归了组；每个人名里的字都在他那一组人名字体（或正文字体）的分片里。
const eras = JSON.parse(read("src/v3/eras.json"));
const eraCss = read("src/v3/era-fonts.css");
const eraCover = {};
for (const m of eraCss.matchAll(/font-family: "([^"]+)";[^}]*unicode-range: ([^;]+);/g)) {
  const set = (eraCover[m[1]] ??= new Set());
  for (const part of m[2].split(",")) {
    const [a, b] = part.trim().replace(/^U\+/, "").split("-").map((h) => parseInt(h, 16));
    for (let cp = a; cp <= (b ?? a); cp++) set.add(cp);
  }
}
const eraGroupOf = Object.fromEntries(Object.entries(eras.groups).flatMap(([g, v]) => v.dynasties.map((d) => [d, g])));
for (const f of index) {
  const g = eraGroupOf[f.dynasty];
  if (!g) fail(`朝代「${f.dynasty}」没有归到任何字体组（src/v3/eras.json）`);
  const { name, text } = eras.groups[g];
  if (name === "HMS Serif") continue;
  const miss = [...f.name].filter((c) => !eraCover[name]?.has(c.codePointAt(0)) && !eraCover[text]?.has(c.codePointAt(0)));
  if (miss.length) fail(`${f.name} 的「${miss.join("")}」不在 ${name} / ${text} 里，请重跑 python pipeline/era-fonts.py`);
}
for (const f of ["public/fonts/era/LICENSES.md", "public/fonts/era/OFL.txt", "public/fonts/era/IPA-LICENSE.md"]) if (!existsSync(new URL(f, root))) fail(`朝代字体缺少许可文件 ${f}`);
if (!read("src/main.jsx").includes("era-fonts.css")) fail("入口没有引入朝代字体");

// 自托管字体：页面上出现的每个汉字都要落在某个宋体分片里（数据或界面文字改了要重跑 pipeline/fonts.py）。
const fontsCss = read("src/v3/fonts.css");
const covered = new Set();
for (const m of fontsCss.matchAll(/font-family: "HMS Serif";[^}]*unicode-range: ([^;]+);/g)) {
  for (const part of m[1].split(",")) {
    const [a, b] = part.trim().replace(/^U\+/, "").split("-").map((h) => parseInt(h, 16));
    for (let cp = a; cp <= (b ?? a); cp++) covered.add(cp);
  }
}
for (const m of fontsCss.matchAll(/url\("\/fonts\/([^"]+)"\)/g)) if (!existsSync(new URL(`public/fonts/${m[1]}`, root))) fail(`字体文件不存在：${m[1]}`);
const shown = [...index.map((f) => [f.name, f.dynasty, f.thesis, f.legacy?.label, f.legacy?.tier, f.peak?.title].join("")), ...Object.values(roles).map((r) => r.brief), rolesView, app, read("src/v3/boards.js")].join("");
const uncovered = [...new Set([...shown].filter((c) => c.codePointAt(0) >= 0x2e80 && !covered.has(c.codePointAt(0))))];
if (uncovered.length) fail(`有 ${uncovered.length} 个字不在自托管宋体里（${uncovered.slice(0, 20).join("")}），请重跑 python pipeline/fonts.py`);

console.log("ui contract validation passed: three zoom levels, label avoidance, evidence badges, two themes, keyboard and mobile rules, glow scrollbars and font coverage verified");
