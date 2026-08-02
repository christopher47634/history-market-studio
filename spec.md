# 历史行情局 — 双版本产品规格

## Product promise

把历史人物一生或同时代人物的势能变化，转换成可探索的“叙事指数”。指数不是史学结论，而是由权位、资源、联盟、战果、声望与生存风险构成的解释模型。

## Versions

- B / 玉衡终端：以 `design-references/yuheng-terminal-target.png` 为视觉目标的一屏深色研究终端。
- C / 朱砂长卷：以 `design-references/zhusha-scroll-target.png` 为视觉目标的一屏纸本研究界面。

## Required interactions

1. 搜索并任意选择两位人物；人物不可重复。
2. 默认以两条人物折线进行对比；人物颜色、实线 / 虚线与线尾姓名三重区分。
3. K 线只呈现当前选择的一位人物，可在对比双方之间切换，不叠放两组蜡烛。
4. 单人物 K 线按寿命生成季度级微观 OHLC；按可视跨度自动聚合到半年 / 年度层级，宏观层级提高趋势线权重。
5. 鼠标滚轮缩放、拖拽平移、按钮复位。
6. 悬停事件点显示年份、事件、指数变化、证据说明。
7. B 与 C 通过设置 → 界面与主题 → 版本二级界面切换，并保留人物选择。
8. 所有人物统一使用实际年龄轴；横轴从 0 岁到较长寿人物去世年龄，较短寿人物去世后保持空值。
9. 人物搜索至少覆盖 100 位中国历史人物；当前为 106 位、11 个历史阶段，每人至少 6 个故事节点。
10. 移除中央光标波纹；遵守 reduced-motion，并保证移动触控布局可用。

## Acceptance budget

- Two visual refinement waves after the implementation pass.
- Hard gates: data validation passes, production build passes, Sites worker test passes, no horizontal overflow at 390px, core controls work, chart canvas exists, event tooltip is reachable.
- Visual gates: hierarchy, spacing, stock semantics, glass depth, paper texture, story/chart coordination, mobile reflow.

## Source policy

- Historical milestone copy is a concise interpretive digest and is clearly labeled as a narrative model. Production-quality historical publication requires per-event edition, chapter and quotation review.
- Technical engine: Apache ECharts 6. Motion is used for restrained interface motion.
- Generated landscape is original project artwork with no text or copied marks.
