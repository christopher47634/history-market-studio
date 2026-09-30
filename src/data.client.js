// 浏览器端的 data.js（vite.config 用别名替换）：
// 只内置 300 人的轻量索引；选中某人时再按需加载他的完整数据（每人一个小分包）。
// Node 端脚本和 API 服务仍然使用 data.js 的全量数据。
import index from "./v2/index.generated.js";
import { toLegacyFigure, buildComparisonV2 } from "./v2/engine.js";

export const dynastyOrder = ["先秦", "秦汉", "三国", "魏晋南北朝", "隋唐", "五代十国", "宋", "辽金西夏", "元", "明", "清", "近现代"];

export const figures = index.map((f) => ({ ...f, events: [], light: true }));
export const figureById = Object.fromEntries(figures.map((f) => [f.id, f]));

const details = import.meta.glob("../data/v2/client/*.json", { import: "default" });
const cache = new Map();

// 取某人的完整数据（旧界面结构 + v2）。同一人只加载一次。
export function loadFigure(id) {
  const light = figureById[id];
  if (!light) return Promise.reject(new Error(`未知人物：${id}`));
  if (!cache.has(id)) {
    const loader = details[`../data/v2/client/${id}.json`];
    cache.set(id, loader().then((v2) => toLegacyFigure(v2, light)).catch((err) => { cache.delete(id); throw err; }));
  }
  return cache.get(id);
}

export function getPairColors(left, right) {
  if (left.color.toLowerCase() !== right.color.toLowerCase()) return [left.color, right.color];
  const alternate = left.color.toLowerCase() === "#c15d50" ? "#3f8f9d" : "#c15d50";
  return [left.color, alternate];
}

export const formatYear = (year) => (year < 0 ? `前${Math.abs(year)}` : `${year}`);
export const formatAge = (age) => `${Number.isInteger(age) ? age : age.toFixed(1)}岁`;

export function buildComparison(left, right, axis) {
  if (!left.v2 || !right.v2) throw new Error("buildComparison 需要已加载完整数据的人物（先调用 loadFigure）");
  return buildComparisonV2(left, right, axis);
}

export function toCandles(points) {
  return points.map((point, index) => {
    const open = index ? points[index - 1].value : Math.max(0, point.value - 3);
    const close = point.value;
    const spread = Math.max(3, Math.round(Math.abs(close - open) * 0.18) + 2);
    return { ...point, value: [open, close, Math.max(0, Math.min(open, close) - spread), Math.min(100, Math.max(open, close) + spread)] };
  });
}

export function getTurningPoints(comparison, left, right) {
  const candidates = [];
  comparison.rawAxis.forEach((raw, index) => {
    const le = comparison.left[index].event;
    const re = comparison.right[index].event;
    if (le) candidates.push({ ...le, figure: left, axisLabel: comparison.axis[index], score: comparison.left[index].value });
    if (re) candidates.push({ ...re, figure: right, axisLabel: comparison.axis[index], score: comparison.right[index].value });
  });
  return candidates.sort((a, b) => a.age - b.age).filter((item, index, arr) => {
    if (index === 0 || index === arr.length - 1) return true;
    return Math.abs(item.delta) >= 12 || index % 3 === 0;
  }).slice(0, 8);
}
