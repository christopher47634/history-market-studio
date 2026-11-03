# 江山时序（jiangshan-map）自托管副本

来源：https://github.com/DeanChensj/jiangshan-map （GPL-3.0，见同目录 LICENSE；CHGIS / Hartwell 派生的州郡与战国边界仅限学术非商用）。

本站的改动：
- `index.html`：去掉原站的访问统计脚本（vercount、Cloudflare Insights）和 Google Fonts 外链；末尾加载本站的 `embed.js`（只在 `?embed=1` 时生效）。
- `embed.js`：本站新增，把地图变成走势图背景，并通过 postMessage 接收年份。
- `js/app.js`：`window.atlasAPI` 增加 `frame({ cx, cy, w })`（设置镜头）和 `showYear(year)`（疆域阶段没变就不重画），供走势图背景使用。
