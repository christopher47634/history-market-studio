# 历史行情局

同一套历史叙事指数，两种完整体验：

- `#b` — B「玉衡终端」：贴合参考图的暗色一屏分析终端。
- `#c` — C「朱砂长卷」：贴合参考图的纸本一屏研究界面。

## 已实现

- 300 位可搜索人物、2008 个历史节点，覆盖先秦至近现代，支持按时代、朝代、领域筛选，支持人物/字号/事件搜索、任意两人交换和对比。
- 所有组合统一使用实际年龄轴：从 0 岁开始，以较长寿人物的去世年龄为终点；较短寿人物在去世处自然断线。
- 默认以双人物玻璃丝线对比为主：低透明度光晕层、1.35—1.5px 实体芯线、轻微面积层和线尾姓名共同保证辨识度。
- K 线是单人物生命行情：按寿命生成季度级 OHLC，滚轮拉远后自动聚合至半年/年度层级并强化趋势线，保留 A 股红涨绿跌语义。
- 桌面悬停、手机点按、26px 透明节点热区与 44px 粗指针吸附、滚轮/双指缩放、拖拽平移、复位和关键事件玻璃卡。
- 手机默认保持详情卡收起，让走势完整可见；选中节点后再升起详情卡并可关闭。
- 页面与弹框保留滚动能力但隐藏白色滚动条；折线、K 线趋势和节点统一采用更细的行情视觉。
- 指标统一称为「历史综合势能（0—100）」：综合人物当时可调动的资源、四项能力与身后制度、思想、作品或技术延续；死亡不归零，终章回撤不得超过前一有效节点的 20%。
- B 具备主图、同步 K 线与动态史料栏，事件轴收纳于设置；C 具备可随人物和节点自动定位的左侧历史长卷、主图和事件详卡。
- 版本切换位于齿轮设置的「界面与主题 / 版本」二级界面，切换时保留人物组合。
- 搜索菜单通过顶层 portal 呈现，支持方向键、Home、End、Enter、点击外部和 Escape；页面具备移动端重排、焦点恢复与 `prefers-reduced-motion` 降级。
- B 使用原创暗色山河星盘资产，C 使用原创水墨长卷与纸张档案资产。

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm run test:data
npm run test:trajectories
npm run test:ui
npm run build
npm run test:production
npm run test:sites
npm run audit:sources
npm audit --omit=dev --audit-level=high
```

## 数据声明

势能指数是解释性叙事模型，不是史学定论、道德评分、概率预测或可交易资产。300 位人物均关联原始/机构索引和人物辅助专页；联网审计覆盖 61/61 个来源索引与 300/300 个人物页。部分链接是典籍或馆藏的集合入口，正式史学出版仍应逐事件补充版本、卷次、页码与原文校勘。

## 开源技术参考

- [Apache ECharts](https://github.com/apache/echarts) — 主图、事件、dataZoom 与交互。
- [Motion](https://motion.dev/) — 受控界面动效。
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) — K 线密度和行情交互调研参考；因年龄类目轴、事件标记和双网格联动需求，主引擎继续使用 ECharts。

## 前后端接口

本地 Vite 与线上 Worker 使用同一份接口实现：

- `GET /api/health`：服务状态、人物与事件总量、模型版本。
- `GET /api/figures`：人物库；支持 `q`、`period`、`dynasty`、`domain`、`offset`、`limit` 与 `compact=1`，并返回分页元数据。
- `GET /api/figures/:id`：单个人物及全部事件。
- `GET /api/compare?left=liubang&right=xiangyu`：双人年龄共轴走势、颜色与关键转折；加 `candles=1&target=liubang` 返回单人蜡烛数据。
- `GET /api/index`：时代、朝代与领域筛选分面。

接口响应包含 ETag；未变化的条件请求返回 `304 Not Modified`。非法分页参数返回结构化 `400`。

页面启动时优先读取 API，接口暂时不可用则自动回退到随应用发布且经过校验的内置数据，不中断研究流程。
