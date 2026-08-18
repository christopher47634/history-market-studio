# 设计与上线验收 · 玉衡终端 / 朱砂长卷

验收日期：2026-08-04

## 验收范围

- 保留原有两套中国历史视觉语言：玉衡终端的深玉、铜金与地图玻璃；朱砂长卷的宣纸、朱砂与水墨。
- 在原设计基础上增加 Apple 风格的材质、同心圆角、层级阴影、细腻弹性动效和移动端触控逻辑，没有重做产品结构。
- 两套界面共享 300 位人物、2008 个历史节点、实际年龄横轴、折线/K 线、人物搜索、对比状态和后端 API。

## 视觉证据

桌面端（1920 px 宽）：

- `output/playwright/b-final-1920.png`：玉衡终端完整工作台。
- `output/playwright/c-final-1920.png`：朱砂长卷完整工作台与山河背景融合。
- `output/playwright/b-keyboard-card.png`：键盘导航打开的事件玻璃卡。
- `output/playwright/c-right-person-card.png`：右侧人物节点触发后，左侧长卷同步切换。
- `output/playwright/c-terminal-follow.png`：低位终章节点触发后，左侧长卷自动滚动跟随。
- `output/playwright/b-kline-desktop.png`、`c-kline-desktop.png`：两套主题的单人物 K 线。

移动端（360 px 起）：

- `output/playwright/b-final-mobile-360.png`：玉衡终端单列响应式主视图。
- `output/playwright/c-mobile-dropdown-paper.png`：朱砂纸本主题的顶层人物库。
- `output/playwright/c-mobile-card.png`：点击节点后的触控详情浮层。

## 交互验收

- 桌面端进入 46—64 px 动态吸附范围后，卡片只依据 ECharts 的真实节点坐标定位；点击容差为 76 px，卡片靠近对应走势点且不遮住节点。
- 光标离开图表/卡片区域后，卡片在退场动画完成后自动关闭；实测 700 ms 后 DOM 中不再存在卡片。
- 移动端点击转折点打开详情，卡片自动选择可用空间并在字体加载、页面滚动或容器变形后继续跟随；实测卡片与节点保持 14 px 间距。关闭按钮与 Esc 均可退出。
- 玉衡人物库通过 `document.body` portal 渲染，实测为 `position: fixed; z-index: 10000`，不会被图表层叠上下文遮挡。
- 人物库和页面内部滚动条已视觉隐藏，同时保留滚轮、触控和键盘滚动能力；人物库支持 Arrow、Home、End、Enter 与 Escape，关闭后焦点回到触发器。
- K 线滚轮缩放已实测：从“按年 · 62 段”进入“季度 · 245 段”，页面本身没有被误滚动。
- 事件轴已并入设置，不占用玉衡首页；其播放默认关闭，避免抢夺研究者当前选择。
- 朱砂长卷会随当前吸附人物切换，并在低位事件触发时自动滚动到对应条目；收回后可以稳定重新展开。
- 从设置切换两套主题时，URL 保留 `left=liubang&right=xiangyu`，人物组合不丢失。
- 390 px 宽度下两套界面的 `scrollWidth` 均等于 `clientWidth`，无横向溢出。
- 1920、393 与 360 px 浏览器交互全过程控制台：0 error、0 warning。

## 前后端与发布验收

- `npm run build`：通过；生成客户端包与 Sites Worker。
- `npm run test:data`：通过；300 位人物、2008 个事件、361 个来源 URL 与自适应 OHLC 数据有效。
- `npm run test:trajectories`：通过；300 人终章均不归零，最低保留率为 80%。
- `npm run audit:sources`：通过；61/61 个原始或机构索引、300/300 个人物辅助专页可访问。
- `npm run test:ui`：通过；节点卡片、人物库、折线优先和无障碍契约有效。
- `npm run test:production`：通过；18 个静态资源共 1.92 MB，深链接和 PWA 元数据有效。
- `npm run test:sites`：6/6 通过；静态资源、SPA 回退、搜索/筛选/分页、ETag、API 路由与发布包装有效。
- `npm run test:production`：通过；深链接、静态资源与 PWA 元数据有效。
- `npm audit --omit=dev --audit-level=high`：0 个漏洞。
- 运行中 API 实测：健康状态正常；人物接口返回 300 人；搜索、朝代/领域筛选与分页元数据有效；错误分页返回 400；条件请求返回 304。

## 结论

两套主题均保留原来的辨识度，并已完成质感、层级、动画、响应式、节点跟随、终章量化、来源审计和前后端贯通的上线级收口。没有已知 P0、P1 或 P2 问题。

最终结果：通过。
