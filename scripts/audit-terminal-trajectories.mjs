// v2 轨迹审计：画出来的曲线必须精确落在每个事件的分数上；终章相对最后一个阶段最多回撤 20%，不归零；
// 身后线终点等于后世评价。对全部 300 人逐一核对。
import { figures, figureById, buildComparison } from "../src/data.js";

const fail = (message) => {
  throw new Error(message);
};

const partner = figureById.liubang;
let checked = 0;
let minRetention = 1;
for (const figure of figures) {
  const life = figure.events.filter((event) => !event.posthumous);
  const finale = life.at(-1);
  const lastStage = life.at(-2);
  if (finale.kind !== "finale") fail(`${figure.name}: 缺少终章`);
  if (finale.score <= 0) fail(`${figure.name}: 死亡被处理为归零`);
  const retention = finale.score / lastStage.score;
  minRetention = Math.min(minRetention, retention);
  if (retention < 0.8 - 1e-6) fail(`${figure.name}: 终章回撤 ${(100 - retention * 100).toFixed(1)}%，超过 20%`);

  const other = figure.id === partner.id ? figureById.xiangyu : partner;
  const comparison = buildComparison(figure, other, "age");
  const points = comparison.left;
  for (const event of life) {
    const point = points.find((p) => p.event?.title === event.title);
    if (!point) fail(`${figure.name}/${event.title}: 节点没有出现在曲线上`);
    if (Math.abs(point.value - event.score) > 0.05) fail(`${figure.name}/${event.title}: 曲线取值 ${point.value} ≠ 事件分数 ${event.score}`);
  }
  const tail = comparison.leftTail.filter((p) => p.value !== null);
  if (Math.abs(tail.at(-1).value - figure.legacy.score) > 0.05) fail(`${figure.name}: 身后线终点 ${tail.at(-1).value} ≠ 后世评价 ${figure.legacy.score}`);
  checked++;
}

console.log(`trajectory audit passed: ${checked} figures, curve lands on every event, minimum terminal retention ${(minRetention * 100).toFixed(1)}%, posthumous line ends at legacy score`);
