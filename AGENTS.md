# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- Deliver two complete experiences in one app: B “玉衡终端” (professional historical quant terminal) and C “朱砂长卷” (editorial scrollytelling), not one merged skin.
- Both versions share custom person search, arbitrary two-person comparison, line/candlestick switching, wheel zoom, drag pan, event hover cards, and a common historical-index model.
- Default comparison is 刘邦 vs 项羽. Same-era comparisons use a historical-year axis; cross-era comparisons use a normalized life-stage axis and disclose that normalization.
- A-share color convention is red rise and green fall.
- Desktop uses enhanced inertial cursor glow; touch and reduced-motion modes disable it.
- Visual sources of truth are the selected local B and C mockups; B is dark jade glass + dense market structure, C is warm xuan-paper + sticky chart and narrative chapters.
- Event detail cards are cursor/node anchored on desktop, dismiss shortly after hover leaves, and open by tap as a bottom sheet on touch devices; never pin them over the chart by default.
- 玉衡终端 keeps the homepage trend-first. Its event timeline, filters, and autoplay controls live inside the Settings secondary surface instead of occupying a homepage panel.
- 玉衡终端 typography should pair classical Chinese display faces for titles with restrained Song-style body copy and tabular sans-serif numerals; motion stays subtle, glassy, and historically inflected.
- 玉衡终端的图表节点采用二维最近距离范围吸附与轻微滞回，光标无需精确压中小点；吸附后显示命中反馈，详情卡跟随光标附近且不得遮住目标节点。
- 玉衡终端的人物选择下拉使用 body portal 顶层浮层，不受对比栏、图表面板或页面 overflow / stacking context 裁切。

## 2026-08-02 industrialization decisions

- Both experiences use one Apple-inspired spatial system: concentric radii, restrained spring motion, strong focus states, and translucent material only on navigation/control layers. Content and charts remain visually dominant.
- B remains the dark, information-dense “玉衡终端”; C remains the warm editorial “朱砂长卷”. They must never collapse into one reskinned layout.
- Production data is available through `/api/health`, `/api/figures`, `/api/figures/:id`, and `/api/compare`. The client automatically falls back to the embedded validated dataset when the API is unavailable.
- The deployed worker bundles the same historical model used by the client and adds a restrictive security-header baseline. The local Vite server exposes the same API contract.
- Settings dialogs trap focus and restore it on close; event cards close with Escape; ECharts ARIA descriptions and a textual chart summary are required.

## 2026-10-09 chart label decision

- 图上的节点标签是透明玻璃：极薄的半透明底 + 细亮边，后面的走势线必须透出来；字靠与底色同色的描边（halo）保证可读，不能再用实心底把线挡住。

## 2026-10-09 「角色」页

- 主界面之外有第二个页面「角色」（?view=roles），顶栏「走势 / 角色」切换，浏览器返回键可来回。
- 板块：六个领域板块 + 按一生走势形态算出的特色板块（逆袭、长牛、大起大落、盛极而衰、身后封神），逻辑在 src/v3/boards.js。
- 光标停在一行 → 右侧玻璃拟态「简要角色卡」；单击 → 「完整角色卡」（手机是底部抽屉）。
- 对比：把行或角色卡拖到底部对比栏 A / B 格，或点「+」；再点「对比走势」回主图。
- 头像与简介来自维基百科（见下）。

## 2026-10-16 全站质感升级

- 滚动条：全站不用原生滚动条（含横向）。竖向滚动（页面、下拉列表、完整角色卡、一生节点）是一道会发光的细光束（src/v3/glowscroll.js，滚动时亮、停 1 秒熄、快滚有拖尾、可拖可点），滚动区两端按 Claude 的 7 档遮罩渐隐；横向滚动区（事件时间条、手机板块行、时代筛选）没有滚动条，滚轮转横向、鼠标可拖、两侧渐隐。新滚动区挂 data-glow / data-hscroll 即可。
- 字体：标题、人名、引文用自托管思源宋体（Noto Serif SC，OFL，按字频切 12 片 unicode-range），西文和数字用自托管 Inter（tabular-nums）。改了数据或界面文字后跑 python pipeline/fonts.py，test:ui 会查有没有字没覆盖。
- 玻璃：只在导航/控件/浮层用（顶栏分段、搜索框、对比栏、下拉框、角色卡、完整卡），清透 + 少量模糊 + 计算高光边 + 跟手镜面光（.lg）；内容卡片（图表、阅读面板、板块、时间条）只做跟手聚光和一段亮边（.spot）。光标状态用 data-spot-on 属性，不用 class（React 重渲染会冲掉）。
- 角色页默认是头像卡片墙（?layout=list 切回列表）；卡片悬停微倾斜 + 迷你走势重画，点开时头像以共享元素转场飞进完整角色卡。走势 ⇄ 角色切页用 View Transitions。
- 看盘动效：价格线带同色柔光，后世评价端点是呼吸的「现价点」，切 K 线时蜡烛从左到右长出，顶部读数变化时按涨跌闪底色。
- 动效参数：进场 power3/expo.out、不回弹；按压 scale .97；浮层轻微超调；全部尊重减少动态效果。

## 2026-10-09 头像与简介

- 头像与简介来自维基百科：头像只用 Wikimedia Commons 上公有领域 / CC 许可的图片，必须带作者与许可证署名；简介按 CC BY-SA 4.0 标注出处和版本。素材管线：npm run v2:portraits（fetch-portraits.mjs → roles.py），之后跑 client-index。
