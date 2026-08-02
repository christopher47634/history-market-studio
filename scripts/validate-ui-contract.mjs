import { readFileSync, readdirSync } from "node:fs";

const root=new URL("..",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const fail=(message)=>{throw new Error(message)};

const app=read("src/App.jsx");
const chart=read("src/components/LifeMarketChart.jsx");
const picker=read("src/components/ComparisonPicker.jsx");
const catalogSearch=read("src/components/CatalogSearch.jsx");
const floatingCard=read("src/components/floatingEventCard.js");
const historicalCitation=read("src/components/HistoricalCitation.jsx");
const settings=read("src/components/SettingsPanel.jsx");
const terminal=read("src/versions/BTerminal.jsx");
const scroll=read("src/versions/CScroll.jsx");
const styles=read("src/styles.css");
const polish=read("src/apple-polish.css");
const trajectoryModel=read("src/trajectoryModel.js");
const jsxFiles=[...readdirSync(new URL("src/components",root)),...readdirSync(new URL("src/versions",root))]
  .filter((name)=>name.endsWith(".jsx"));

if(!app.includes('useState(viewFromHash)')||!app.includes('"hashchange"'))fail("版本路由没有与浏览器历史同步");
if(!terminal.includes('useState("line")')||!scroll.includes('useState("line")'))fail("B/C 没有默认使用双线主视图");
if(!terminal.includes("LifeMarketChart")||!scroll.includes("LifeMarketChart"))fail("B/C 没有共享年龄行情图引擎");
if((chart.match(/type:\s*"candlestick"/g)||[]).length!==2)fail("主 K 线与同步 K 线必须各自保持一组单人物序列");
if(!chart.includes('getCandleView(candleFigure'))fail("K 线没有绑定单人物细粒度行情");
if(!/type:\s*"solid"/.test(chart)||/type:\s*index\s*\?\s*"dashed"/.test(chart)||!/endLabel:\s*\{\s*show:\s*true/.test(chart)||!chart.includes("comparison.maxAge"))fail("双线没有保持高级实线、线尾姓名或年龄轴辨识");
if(!/useCoarsePointer:\s*true/.test(chart)||!/zr\.on\("mousemove",\s*onMove\)/.test(chart)||!/zr\.on\("click",\s*onClick\)/.test(chart)||!/const radius\s*=\s*forced\s*\?\s*76/.test(chart)||!/symbolSize:[\s\S]{0,80}params\.data\.event\s*\?\s*4\.5\s*:\s*0/.test(chart))fail("精细节点缺少范围吸附、移动端点击或小尺寸视觉规则");
if(!/symbolSize:[\s\S]{0,80}params\.data\.event\s*\?\s*26\s*:\s*0/.test(chart)||!/itemStyle:\s*\{\s*opacity:\s*0\s*\}/.test(chart))fail("小节点缺少独立的透明点击热区");
if(!picker.includes('aria-haspopup="dialog"')||!picker.includes('aria-label={`${label}搜索`}'))fail("人物搜索缺少可访问标签");
if(!picker.includes("historyPeriods")||!picker.includes("figureDomains")||!picker.includes("indexSorts")||!picker.includes('aria-label="人物排序方式"'))fail("对比人物下拉缺少分期、朝代、领域或排序索引");
if(!catalogSearch.includes("filterFigures")||!catalogSearch.includes("historyPeriods")||!catalogSearch.includes("figureDomains")||!catalogSearch.includes("catalog-index__results"))fail("全局人物搜索没有接入科学分类索引");
if(!/createPortal\(menu,\s*document\.body\)/.test(picker)||!styles.includes('.person-select__menu--portal')||!/z-index:\s*10000\s*!important/.test(styles))fail("玉衡人物下拉菜单没有进入页面顶层");
if(!chart.includes("onEventAnchor")||!terminal.includes("onEventAnchor={anchorDetail}")||!scroll.includes("onEventAnchor={anchorDetail}"))fail("外部事件入口没有统一回写走势点锚点");
if(!chart.includes("life-pointer-probe")||!chart.includes("life-pointer-tether")||!styles.includes("snap-lock-in"))fail("图表缺少接近、吸附与锁定三阶段指向反馈");
if(!terminal.includes("createPortal(")||!scroll.includes("createPortal(")||!styles.includes("event-float-card--anchor"))fail("事件卡片没有进入顶层或缺少节点连接方向");
if(!chart.includes("const clientX = bounds.left + match.x")||!chart.includes("const clientY = bounds.top + match.y")||!floatingCard.includes("pointer?.snapX")||!floatingCard.includes('"below"')||!floatingCard.includes('"above"')||!styles.includes("--anchor-gap"))fail("事件卡片没有严格跟踪吸附点或缺少视口避让");
if(!picker.includes("document.startViewTransition")||!picker.includes('aria-live="polite"')||!picker.includes('role="tooltip"')||!picker.includes('event.key !== "Escape"'))fail("交换控件缺少原子动效、状态播报或键盘提示逻辑");
if(!/aria-pressed=\{mode\s*===\s*"line"\}/.test(terminal)||!/aria-pressed=\{mode\s*===\s*"line"\}/.test(scroll))fail("图表模式缺少可访问选中状态");
if(!settings.includes('onView("b")')||!settings.includes('onView("c")')||terminal.includes("onView(")||scroll.includes("onView("))fail("B/C 版本切换没有收进设置二级界面");
if(!/@media\s*\(max-width:\s*560px\)/.test(styles)||!/:where\(\s*button,\s*a,\s*input\s*\):focus-visible/.test(styles))fail("移动端或键盘焦点样式缺失");
if(!styles.includes("dark-history-map.webp")||!styles.includes("qin-han-scroll.webp"))fail("两版参考图背景资产没有接入优化后的 WebP");
if(!/scrollbar-width:\s*none/.test(styles)||!/backdrop-filter:\s*blur\(24px\)/.test(styles))fail("页面滚动条或玻璃拟态弹框规则缺失");
if(jsxFiles.some((name)=>name==="CursorAura.jsx"))fail("中央光标波纹组件仍然存在");

if(/displayEvents\.slice\(0,\s*7\)/.test(scroll)||!scroll.includes("displayEvents.map"))fail("C scroll rail must render the full event list");
if(!scroll.includes("onPreviewLeft")||!scroll.includes("onPreviewRight")||!scroll.includes("railPreviewId"))fail("C scroll rail must preview the hovered A/B figure");
if(!chart.includes('? snapTarget.label')||!chart.includes(': `已吸附 · ${snapTarget.label}`'))fail("Candlestick snap label must omit the line-mode prefix");
if(!picker.includes("onMouseMove={() => onPreview?.(value)}")||!picker.includes("onPreviewEnd?.(value)"))fail("A/B rail preview must resist selector boundary races");
if(!scroll.includes("railFollow")||!scroll.includes('behavior: "smooth"')||!scroll.includes("railEventRefs"))fail("Chart events must center their matching history-rail entry");
if(!scroll.includes("toggleRail")||!scroll.includes("railHoverGuardRef")||!scroll.includes('aria-expanded={!railCollapsed}'))fail("History rail collapse and reopen controls must remain stable");
if(!polish.includes('url("/assets/qin-han-scroll.webp")')||!polish.includes(".zhusha-workbench.is-rail-collapsed .zhusha-collapse span"))fail("The scroll view must retain its mountain layer and discoverable reopen handle");
if(!terminal.includes('<HistoricalCitation event={active} tone="jade" />')||!scroll.includes('<HistoricalCitation event={active} tone="paper" />'))fail("B/C 悬浮卡片没有共享史书原文组件");
if(!historicalCitation.includes("citation.kind")||!historicalCitation.includes("citation.quote")||!historicalCitation.includes("出处 ·"))fail("史书引文组件缺少原文类型、正文或出处链接");
if(!polish.includes("--history-body-font")||!polish.includes("--history-kaiti-font")||!polish.includes(".historical-citation blockquote"))fail("两套主题没有建立宋体正文与小号楷体引文层级");
if(!terminal.includes("历史综合势能对比")||!scroll.includes("历史综合势能（0—100）")||!terminal.includes("active.trajectory.continuity"))fail("两套主题没有说明死亡不归零的历史综合势能口径");
if(!trajectoryModel.includes("legacy-retention-v1")||!trajectoryModel.includes("minimumRetention: 0.8")||!chart.includes("历史综合势能"))fail("尾端保留模型或图表口径没有统一接入");

console.log("ui contract validation passed: point-anchored cards, scientific figure index, line-first and accessibility rules verified");
