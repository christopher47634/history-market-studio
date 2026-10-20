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

## 2026-10-19 交互层（用户：查字体排版和光标交互、有没有遮挡，所有按钮和可交互内容统一提升质感）

- 统一规则在 src/v3/interact.css（最后加载），参照 Radix / Linear / Geist 的状态规范：每个可交互元素都有静止、悬停、按下、键盘聚焦四态；悬停只在 (hover: hover) 设备生效；移入 .14s、移出 .32s；聚焦是双层环（底色环 + 强调色环 + 柔光），不用浏览器虚线。
- 分段控件未选中的格子悬停时字变亮并浮出 6% 底；列表行（下拉、⌘K）当前行强调色底 + 头像放大；输入框聚焦时放大镜变强调色、筛选条整条亮边；链接下划线从左往右长出；品牌标识悬停时折线重画。
- 磁吸：pointer.js 让图标按钮、主按钮、关闭/交换/加入对比按钮被光标吸过去最多 3px。
- 走势页详情栏不再固定 84px（简介第二行被切），按内容长高、最高 112px；绘图区上方保留带 122px（e2e 按这个数校验）。
- 卡片墙：卡片高度只由正面决定，背面绝对定位铺满，简介占剩余空间、底部渐隐；背面不再重复走势小图；年代和年份分两行写全。
- 板块代表人物最多两行，只在人名之间换行；对比栏空格在手机上用短提示。
- 中文小字统一不小于 11.5px。
- 审计脚本：node work/audit-ui.mjs（每个可交互元素查遮挡、截断、四态、点击区大小）。

## 2026-10-19 搜索（用户：搜「变法」出来齐白石、没有王安石，要求严格修正）

- 三处搜索（⌘K、人物下拉、角色页筛选）共用 src/v3/search.js，不再各自做「事件标题里有没有这个词」。
- 按字段分权计分：姓名 > 别名（字号谥号俗称）> 拼音 id > 代表（以什么闻名，含本人名字的更核心）> 朝代 > 领域 > 总评 > 生平事件标题。多个词都要命中。
- 词表在 src/v3/search-terms.js：300 人每人「别名 / 代表」两栏，只收公认说法；某个词只是生平里顺带出现（齐白石「衰年变法」是画风），不进代表。概念近义词（变法 ⇄ 新法 / 新政 / 维新 / 改革）打折计分。
- 单字只认整词和朝代（「唐」不命中「大唐西域记」）；常用单字类别（诗、词、画、曲）在概念表里展开。
- ⌘K 结果写出命中原因，分「最相关」和「生平里提到」两组；角色页有搜索词且是默认排序时按相关度排。
- 加人或改数据：给新人补词表，跑 npm run test:search（会查每个 id 都在表里，并锁住「变法」等回归用例），再跑 python pipeline/fonts.py。

## 2026-10-19 迷你走势配色（用户定）

- 卡片墙、列表、角色卡上的迷你走势分两段各自上色：实线是生前，去世时的势比出生时高为红、低为绿；虚线是身后，后世评价比去世时的势高为红、低为绿；相等为中性灰。红涨绿跌（A 股习惯），只按评分客观比较。逻辑在 RolesView.jsx 的 Spark。

## 2026-10-20 头像 / 简介加载（用户：角色卡和头像不见了）

- 头像和简介在 src/v2/roles.generated.js，按需下载。原来下载失败一次就记成空表、永不重试，整站退成姓氏字章，看起来像头像被删了。图片文件本身一直都在（public/portraits 299 张都在 git 里，来源记录在 data/v2/portraits.json）。
- 现在：失败不缓存，1s/2s/4s 重试三次，网络恢复或页面回到前台再试。浏览器会缓存失败的 import()，所以数据文件按 ?url 原样发布，重试时在地址后加 ?retry=n 才能真去网络取。
- 下载中显示微光骨架（.v3-ava--loading / .v3-tile__media.is-loading），只有数据到了而这个人确实没头像才显示字章。
- 旧页面跨发布（线上首页已换新版本）时自动刷新一次（每会话一次）；偶发网络失败不刷新。验证脚本 node work/roles-fail.mjs <base> <失败次数>。
- 单张头像（10-20 用户截图老子、孔子裂图）：Avatar 失败后隔 1.5s / 4s 换地址（?r=n）重试，三次都失败才退字章；图片下载完才打 data-ok，之前用 CSS content 换成底色块，任何时候都不露浏览器裂图图标。
- 离线缓存 public/sw.js（只在线上注册）：规则见下一节「健壮性」（10-20 已收紧：只缓存带哈希的文件）。
- 卡片背面的领域印章改横排小章，数字格恢复全宽，「后世评价」不再折行。

## 2026-10-20 健壮性（用户：要求完全没有 bug，别再出现头像不见这类问题）

- 一条总规矩：任何按需下载的东西，失败都不能被缓存成「永久失败」，必须自动重试、给出可点的重试、并且不露裂图或空白。已覆盖：头像数据（people.jsx）、单张头像（Avatar）、每人的数据文件（data.client.js 用 fetch 重试 3 次，错误页带「重试」按钮，换人或点重试都会清掉旧错误）、主程序脚本（public/boot-watch.js 在骨架屏上提示并给重新载入）。
- 每人的 JSON 必须是独立文件：vite.config 把 JSON 排除出内联（assetsInlineLimit），否则小文件变成 data: 地址，被 CSP 的 connect-src 拦住。test:production 会数够 300 个。
- 字体文件名带内容哈希（pipeline/fonts.py、era-fonts.py 的 put()），所以 vercel.json 可以给 /fonts 一年不可变缓存；fonts.py 会同步 index.html 的预加载链接。千万别改回同名文件，否则浏览器缓存里的旧分片配新的 unicode-range 会缺字。
- 离线缓存 public/sw.js：只缓存文件名带哈希的 /fonts、/assets（缓存优先），头像用条件请求后台更新；改规则把 VERSION 加一。
- 新增三套测试：npm run test:faults（对每类资源注入网络故障，要先起预览服务）、npm run test:monkey（随机点按/按键/滚动/改窗口，每步查崩溃、报错、横向溢出；参数：步数 种子）、以及原有的 test:app / test:cross。改动加载逻辑后三套都要跑。
- 随机测试抓到的真崩溃（10-20）：K 线模式下固定在第二个人的事件上，再切成「只看一个人」，详情栏去读已经不在图上的第二个人 → 白屏。修法：App.jsx 的 onChart() 只认属于图上现在这些人的节点，所有用固定节点的地方统一用 pin；scene.js 的 candleOf 也容忍人不存在。用例锁在 tests/e2e-regress.mjs（去掉修复时会失败）。以后随机测试再抓到什么，都照这样加一条回归用例。

## 2026-10-20 动效重做（用户：调研交互动画还能不能优化，按我的想法重来）

- 原则（web.dev / Shopify 的动画性能指引）：只动 transform 和 opacity，不动布局属性，主线程留给交互；全部尊重「减少动态效果」。
- 卡片墙重排（FLIP，RolesView.jsx 的 useFlip）：搜索让卡片位置变了，留下来的卡片从旧位置滑到新位置（460ms、expo 缓出），只做屏幕上下一屏内的卡；换板块 / 时代 / 排序仍是整块重新进场。
- 滚动进场（interact.css）：卡片墙往下滚时卡片进入屏幕才升起显现，用 CSS 滚动驱动动画（animation-timeline: view()），跑在合成线程；Firefox / Safari 暂不支持时整段忽略，卡片照常显示。
- 退场：⌘K 面板（180ms）和选人下拉（160ms）关闭时先播收起再卸载，不再瞬间消失。下拉的位置要等退场播完才清（在 Picker 的 leaving 计时里），否则退场那一帧没有位置可画。
- 验证：npm run test:motion（重排、退场、滚动进场、减少动态效果时全关）；npm run test:regress（随机测试抓到过的崩溃）。
