# 历史行情局 — 双版本产品规格

## Product promise

把历史人物一生或同时代人物的势能变化，转换成可探索的“叙事指数”。指数不是史学结论，而是由权位、资源、联盟、战果、声望与生存风险构成的解释模型。

## Versions

- B / 玉衡终端：以 `design-references/yuheng-terminal-target.png` 为视觉目标的一屏深色研究终端。
- C / 朱砂长卷：以 `design-references/zhusha-scroll-target.png` 为视觉目标的一屏纸本研究界面。

## Required interactions

1. 搜索并任意选择两位人物；人物不可重复。
2. 默认以两条人物折线进行对比；人物颜色、实体芯线、柔和光晕与线尾姓名共同区分，不使用易与预测走势混淆的虚线。
3. K 线只呈现当前选择的一位人物，可在对比双方之间切换，不叠放两组蜡烛。
4. 单人物 K 线按寿命生成季度级微观 OHLC；按可视跨度自动聚合到半年 / 年度层级，宏观层级提高趋势线权重。
5. 鼠标滚轮缩放、拖拽平移、按钮复位。
6. 桌面端进入事件点的范围吸附区后，详情卡跟随真实走势点并自动选择附近空位；离开图表与卡片后关闭。手机端点按转折点打开详情。
7. B 与 C 通过设置 → 界面与主题 → 版本二级界面切换，并保留人物选择。
8. 所有人物统一使用实际年龄轴；横轴从 0 岁到较长寿人物去世年龄，较短寿人物去世后保持空值。
9. 人物搜索覆盖 300 位中国历史人物、2008 个历史节点，时间范围从先秦延伸至近现代；支持人物名、字号、时代、朝代与事件检索。
10. 所有人物的死亡节点不得机械归零。终章依据身后政策、制度、思想、作品、技术或政治遗产的延续程度量化；末点不得低于前一有效节点的 80%。
11. 人物库通过顶层 portal 呈现，不能被图表或容器裁切；支持方向键、Home、End、Enter 与 Escape，并恢复关闭前焦点。
12. 移除中央光标波纹；遵守 reduced-motion，并保证移动触控布局、点击热区与屏幕阅读语义可用。

## Acceptance budget

- Two visual refinement waves after the implementation pass.
- Hard gates: 300 人/2008 节点数据校验、终章保留率校验、来源链接审计、生产构建、Sites Worker、依赖安全审计全部通过；360px 起无横向溢出，核心控件、图表、事件卡、滚轮缩放与键盘路径均可达。
- Visual gates: hierarchy, spacing, stock semantics, glass depth, paper texture, story/chart coordination, mobile reflow.

## Source policy

- Historical milestone copy is a concise interpretive digest and is clearly labeled as a narrative model. 当前人物均关联原始/机构索引与人物辅助专页；引用摘录与编辑说明分开展示。正式史学出版仍需逐事件补做版本、卷次、页码与原文校勘。
- Technical engine: Apache ECharts 6. Motion is used for restrained interface motion.
- Generated landscape is original project artwork with no text or copied marks.
