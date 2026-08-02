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
