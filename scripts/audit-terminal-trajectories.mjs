import { buildComparison, figures } from "../src/data.js";
import { terminalTrajectoryRules } from "../src/trajectoryModel.js";

const fail = (message) => {
  throw new Error(message);
};

const deathTitlePattern =
  /人生终章|卒|死|崩|薨|逝|殁|遇害|被杀|自尽|赐死|病故|病逝|牺牲|去世|身亡|就义|圆寂|陨落|自沉|自刎|处死|凌迟|车裂/;

const report = [];

for (const figure of figures) {
  const lifeEvents = figure.events
    .filter((event) => !event.posthumous)
    .sort((left, right) => left.age - right.age || left.year - right.year);
  const terminalEvents = lifeEvents.filter(
    (event) => event.trajectory?.terminal,
  );
  if (!terminalEvents.length) fail(`${figure.name}: 缺少统一终章模型`);
  if (!figure.trajectoryModel) fail(`${figure.name}: 缺少人物级轨迹模型元数据`);
  if (figure.trajectoryModel.deathResetsToZero) {
    fail(`${figure.name}: 仍把死亡处理为归零`);
  }

  for (const event of terminalEvents) {
    const trajectory = event.trajectory;
    if (event.score <= 0) fail(`${figure.name}/${event.title}: 终章仍为零`);
    if (trajectory.retention < terminalTrajectoryRules.minimumRetention - 0.001) {
      fail(
        `${figure.name}/${event.title}: 保留比例 ${trajectory.retention} 低于80%`,
      );
    }
    if (!trajectory.continuity || !trajectory.basis || !trajectory.reasons?.length) {
      fail(`${figure.name}/${event.title}: 缺少延续类型或量化依据`);
    }
    if (trajectory.ability < 0 || trajectory.ability > 100) {
      fail(`${figure.name}/${event.title}: 综合能力均值越界`);
    }
    if (/归零/.test(event.summary)) {
      fail(`${figure.name}/${event.title}: 终章叙事仍包含归零语义`);
    }
  }

  for (const event of lifeEvents.filter((item) =>
    deathTitlePattern.test(item.title),
  )) {
    if (event.score <= 0) fail(`${figure.name}/${event.title}: 死亡节点仍为零`);
  }

  const terminal = terminalEvents.at(-1);
  const comparison = buildComparison(figure, figure).left;
  const visibleEnd = comparison.filter((point) => point.value !== null).at(-1);
  if (!visibleEnd || visibleEnd.value <= 0) {
    fail(`${figure.name}: 折线显示端点仍为零或缺失`);
  }
  if (Math.abs(visibleEnd.value - terminal.score) > 0.15) {
    fail(
      `${figure.name}: 折线端点 ${visibleEnd.value} 没有落在终章量化值 ${terminal.score}`,
    );
  }

  report.push({
    figure: figure.name,
    domain: figure.domain,
    terminal: terminal.title,
    score: terminal.score,
    retention: terminal.trajectory.retention,
    continuity: terminal.trajectory.continuity,
    visibleEnd: +visibleEnd.value.toFixed(1),
  });
}

const retentions = report.map((item) => item.retention);
const continuityCounts = Object.fromEntries(
  [...new Set(report.map((item) => item.continuity))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((continuity) => [
      continuity,
      report.filter((item) => item.continuity === continuity).length,
    ]),
);

console.log(
  `terminal trajectory audit passed: ${report.length} figures, 0 death resets, minimum retention ${(
    Math.min(...retentions) * 100
  ).toFixed(1)}%`,
);
console.log(`continuity distribution: ${JSON.stringify(continuityCounts)}`);
