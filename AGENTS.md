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
- (Superseded 2026-10-16) Event detail is docked above the plot area, never floating over the chart.
- 玉衡终端 keeps the homepage trend-first. Its event timeline, filters, and autoplay controls live inside the Settings secondary surface instead of occupying a homepage panel.
- 玉衡终端 typography should pair classical Chinese display faces for titles with restrained Song-style body copy and tabular sans-serif numerals; motion stays subtle, glassy, and historically inflected.
- 玉衡终端的图表节点采用二维最近距离范围吸附与轻微滞回，光标无需精确压中小点；吸附后显示命中反馈，详情在图表上方的停靠栏里显示（2026-10-16 起不再跟随光标浮在图上）。
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

- 滚动条：全站不用原生滚动条（含横向）。用户要求用现成工业化方案：竖向滚动用 OverlayScrollbars（页面在 body 上初始化，内部滚动区用 bits.jsx 的 <Scroll>），自定义发光主题 os-theme-glow，滚动时出现、停下淡出、悬停加粗可拖；横向滚动区（data-hscroll）没有滚动条，滚轮转横向、鼠标可拖、两侧渐隐。
- 字体：标题、人名、引文用自托管思源宋体（Noto Serif SC，OFL，按字频切 12 片 unicode-range），西文和数字用自托管 Inter（tabular-nums）。改了数据或界面文字后跑 python pipeline/fonts.py，test:ui 会查有没有字没覆盖。
- 玻璃：只在导航/控件/浮层用（顶栏分段、搜索框、对比栏、下拉框、角色卡、完整卡），清透 + 少量模糊 + 计算高光边 + 跟手镜面光（.lg）；内容卡片（图表、阅读面板、板块、时间条）只做跟手聚光和一段亮边（.spot）。光标状态用 data-spot-on 属性，不用 class（React 重渲染会冲掉）。
- 角色页默认是头像卡片墙（?layout=list 切回列表，列表才有右侧简要角色卡）。用户要求卡片交互用现成的工业级动画库：用 Motion（原 Framer Motion）——光标停留约 0.15 秒卡片弹簧翻面，背面是简介、峰值/后世评价、领域印章；倾斜也是弹簧。触屏第一下翻面、第二下打开。点开时头像以共享元素转场飞进完整角色卡。走势 ⇄ 角色切页用 View Transitions。
- 图表上的节点详情不再浮在图上（用户：卡片挡住 K 线很怪）：宽屏停靠在绘图区上方的保留带右侧（layout top 100），手机在图下方；光标离开时显示固定节点。
- 看盘动效：价格线带同色柔光，后世评价端点是呼吸的「现价点」，切 K 线时蜡烛从左到右长出，顶部读数变化时按涨跌闪底色。
- 小字（10-19，用户要求小字更高级）：中文界面字改用自托管思源黑体（HMS Sans，同样分片），不再落到微软雅黑；13px 以下的字收进 src/v3/type.css 的几种角色（元信息 12 / 数字年份 12 等宽 / 栏目标签 11 宽字距 / 出处图例 11.5），中文最小 11.5px，小字不用最浅灰。
- 动效参数：进场 power3/expo.out、不回弹；按压 scale .97；浮层轻微超调；全部尊重减少动态效果。

## 2026-10-19 外壳改版（用户：全站质感提升，尽量玻璃拟态，排版和操作逻辑更清楚直接；授权直接做完）

- 导航：吸顶玻璃导航栏（src/v3/chrome.css 的 .v3-bar），停在顶部时透明，滚动后显出玻璃。中间是「走势 / 角色」玻璃胶囊，右侧是「搜索人物 Ctrl K」、分享和主题切换。手机上导航不吸顶，页面切换单独占一行。
- ⌘K 搜索面板（src/v3/Command.jsx）：任何页面都可用（走势页也可以按 /）。
  - 回车：看这个人的走势。
  - ⇧回车：和主图上的人对比。
  - Ctrl/⌘回车：打开 TA 的角色卡。
  - 空输入时列出页面切换、主题、复制链接和后世评价最高的 8 个人。
  - 输入法选字时按回车不触发。
- 走势页：一句话标题，下面是两张「行情卡」（头像 + 名字 + 实时读数），第二格为空时就是「加一个人对比」。
- 角色页：
  - 去掉标题上方的小标签和渐变字。
  - 搜索、排序和排布合成一条玻璃筛选条，滚动时吸顶。
  - 对比栏显示三步：挑人 → 再挑一个 → 同图对比。
  - 结果为空时说明原因，并给「清空筛选」。
- 液态玻璃（src/v3/liquid.js，移植自「穿越 K 线」）：
  - 每个玻璃控件按尺寸生成凸透镜位移贴图，边缘把背后的内容折进来，只在 Chromium 上生效。
  - 高光朝向光标。
  - 按下时从触点亮起，旁边的玻璃也会跟着亮。
  - 面积超过 32 万像素的玻璃不做折射。
  - 状态写在 data 属性上，不用 class。
  - 背景是缓慢漂移的品牌色光，给玻璃一点可以折射的东西。
- 规矩（依据 impeccable 的质量底线，test:ui 会检查）：
  - 不用侧边彩色竖条、渐变字、标题上方的小标签。
  - 图标只用 Lucide，不用 ⇄ ↗ ▲ × 这类字符冒充。
  - 内容卡片是实底加细线，不叠大阴影。
  - 缓动不回弹。
  - 文字选中色、光标颜色、表单强调色都跟随主题。
- 头像：缺图的人先查维基数据和英文维基上的自由许可图，找不到再到百度百科词条配图里人工挑，带水印的不用。对应脚本：
  - pipeline/set-commons-portrait.mjs
  - pipeline/set-baike-portraits.mjs
  - work/baike-dl.mjs

## 2026-10-19 朝代字体（用户：加古风，按人物所处年代用不同字体，但不能用甲骨文这类读不动的）

- 分组和字体在 src/v3/eras.json，前端用 src/v3/eras.js 的 eraOf / eraFonts。人物相关的容器都标 data-era，CSS 在 chrome.css 的「朝代字体」一节。

  | 组 | 包含朝代 | 人名字体 | 正文字体 |
  | --- | --- | --- | --- |
  | 古拙 | 先秦、秦汉 | 马善政毛笔楷书 | 霞鹜文楷 |
  | 魏晋 | 三国、魏晋南北朝 | 志莽行书 | 霞鹜文楷 |
  | 唐 | 隋唐、五代 | 霞鹜文楷中粗 | 霞鹜文楷 |
  | 宋 | 宋、辽金西夏、元 | 站酷小薇（宋风标题字） | 霞鹜新致宋 |
  | 明 | 明、清 | 霞鹜新致宋（明朝体） | 霞鹜新致宋 |
  | 近现代 | 近现代 | 思源宋体 | 思源宋体 |

- 正文字体覆盖：简介、完整卡、阅读面板、K 线详情栏、事件条，以及图上的节点卡片（画布用 eraFonts，并主动 document.fonts.load）。
- 行书只用在 ≥18px 的人名上。下拉、搜索、对比栏这些小字号处，魏晋人名换成楷书。K 线左上的数据行人名保持黑体。
- 字体都可再分发：马善政、志莽行书、站酷小薇、文楷是 OFL 1.1，新致宋是 IPA 1.0。
- 子集化后改名 HMS ×××，许可证放在 public/fonts/era/。源文件在 E:\Claude local\fonts-src。
- 数据改了以后重跑 python pipeline/era-fonts.py，test:ui 会检查每个人名的字有没有覆盖到。

## 2026-10-09 头像与简介

- 头像与简介来自维基百科：头像只用 Wikimedia Commons 上公有领域 / CC 许可的图片，必须带作者与许可证署名；简介按 CC BY-SA 4.0 标注出处和版本。素材管线：npm run v2:portraits（fetch-portraits.mjs → roles.py），之后跑 client-index。
