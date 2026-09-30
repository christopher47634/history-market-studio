// 全量 v2 数据：Node 端脚本、API 服务和图表实验页使用。浏览器正式页面走 data.client.js 的按人懒加载。
import generated from "./figures.generated.js";

export const figuresV2 = [...generated].sort((a, b) => a.born.year - b.born.year);
export const figureV2ById = Object.fromEntries(figuresV2.map((f) => [f.id, f]));
