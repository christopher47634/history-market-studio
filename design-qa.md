# 设计与上线验收 · 玉衡终端 / 朱砂长卷

验收日期：2026-08-02

## 验收范围

- 保留原有两套中国历史视觉语言：玉衡终端的深玉、铜金与地图玻璃；朱砂长卷的宣纸、朱砂与水墨。
- 在原设计基础上增加 Apple 风格的材质、同心圆角、层级阴影、细腻弹性动效和移动端触控逻辑，没有重做产品结构。
- 两套界面共享 150 位人物、1072 个历史节点、实际年龄横轴、折线/K 线、人物搜索、对比状态和后端 API。

## 视觉证据

桌面端（1440 × 1000）：

- `output/playwright/final-apple-b-desktop-clean.png`：玉衡终端完整工作台。
- `output/playwright/final-apple-b-desktop-card-fixed.png`：事件卡跟随真实走势点并由细线连接。
- `output/playwright/final-apple-b-settings.png`：玻璃设置中心与双主题预览。
- `output/playwright/final-apple-c-clean.png`：朱砂长卷折线主视图。
- `output/playwright/final-apple-c-card.png`：纸本玻璃事件卡。
- `output/playwright/final-apple-c-desktop-k-zoom.png`：滚轮放大后的季度级微观 K 线。

移动端（390 × 844）：

- `output/playwright/final-apple-b-mobile.png`、`final-apple-c-mobile.png`：单列响应式主视图。
- `output/playwright/final-apple-b-mobile-card.png`、`final-apple-c-mobile-card.png`：点击节点后的触控详情浮层。
- `output/playwright/final-apple-b-mobile-picker.png`、`final-apple-c-mobile-picker.png`：人物库顶层选择器。
- `output/playwright/final-apple-c-mobile-k.png`：移动端 K 线。

## 交互验收

- 桌面端进入节点吸附范围后，卡片只依据 ECharts 的节点坐标定位；卡片靠近对应走势点且不遮住节点。
- 光标离开图表/卡片区域后，卡片在退场动画完成后自动关闭；实测 700 ms 后 DOM 中不再存在卡片。
- 移动端点击转折点打开详情，卡片自动选择可用空间；关闭按钮与 Esc 均可退出。
- 玉衡人物库通过 `document.body` portal 渲染，实测为 `position: fixed; z-index: 10000`，不会被图表层叠上下文遮挡。
- 人物库和页面内部滚动条已视觉隐藏，同时保留滚轮、触控和键盘滚动能力。
- K 线滚轮缩放已实测：从“按年 · 62 段”进入“季度 · 245 段”，页面本身没有被误滚动。
- 设置内的事件轴播放能自动推进节点；事件轴不占用玉衡首页空间。
- 从设置切换两套主题时，URL 保留 `left=liubang&right=xiangyu`，人物组合不丢失。
- 390 px 宽度下两套界面的 `scrollWidth` 均等于 `clientWidth`，无横向溢出。
- 浏览器交互全过程控制台：0 error、0 warning。

## 前后端与发布验收

- `npm run build`：通过；生成客户端包与 Sites Worker。
- `npm run test:data`：通过；150 位人物、1072 个事件与自适应 OHLC 数据有效。
- `npm run test:ui`：通过；节点卡片、人物库、折线优先和无障碍契约有效。
- `npm run test:production`：通过；18 个静态资源共 1.92 MB，深链接和 PWA 元数据有效。
- `npm run test:sites`：5/5 通过；静态资源、SPA 回退、API 路由与发布包装有效。
- 运行中 API 实测：健康状态正常；人物接口返回 150 人；刘邦/项羽对比最大年龄 61；刘邦 K 线返回 62 段。

## 结论

两套主题均保留原来的辨识度，并已完成质感、层级、动画、响应式、节点跟随和前后端贯通的上线级收口。没有遗留 P0、P1 或 P2 问题。

最终结果：通过。
