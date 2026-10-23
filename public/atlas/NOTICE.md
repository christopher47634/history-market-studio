# 江山时序（jiangshan-map）自托管副本

来源：https://github.com/DeanChensj/jiangshan-map （GPL-3.0，见同目录 LICENSE；CHGIS / Hartwell 派生的州郡与战国边界仅限学术非商用）。

本站的改动：
- `index.html`：去掉原站的访问统计脚本（vercount、Cloudflare Insights）和 Google Fonts 外链。
- `js/app.js`：`window.atlasAPI` 增加 `frame({ x, y, w })`，供走势页的「当时的江山」小地图设置镜头。
