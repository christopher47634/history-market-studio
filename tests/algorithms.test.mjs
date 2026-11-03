// 算法层单测（node:test，零依赖）：转折点选取、横轴步长、空事件防护、API 畸形路径。
import test from "node:test";
import assert from "node:assert/strict";
import { figureById, buildComparison, getTurningPoints } from "../src/data.js";
import { interpolateTrajectoryScore } from "../src/trajectoryModel.js";
import { getCandleView, buildMicroCandles } from "../src/marketEngine.js";
import { handleHistoryApi } from "../src/server/historyApi.js";

const liubang = figureById.liubang;
const xiangyu = figureById.xiangyu;

test("getTurningPoints 按 |delta| 选取，且不只覆盖前半生", () => {
  const comparison = buildComparison(liubang, xiangyu, "age");
  const points = getTurningPoints(comparison, liubang, xiangyu);
  assert.ok(points.length > 0 && points.length <= 8);
  const longer = Math.max(liubang.lifeSpan, xiangyu.lifeSpan);
  const maxAge = Math.max(...points.map((p) => p.age));
  assert.ok(maxAge >= longer * 0.6, `最大年龄 ${maxAge} 应 ≥ ${longer * 0.6}`);
  // 展示按年龄升序
  for (let i = 1; i < points.length; i++) assert.ok(points[i].age >= points[i - 1].age);
  // 被选中的最小 |delta| 不应小于任何落选项
  const all = [];
  comparison.rawAxis.forEach((_, i) => {
    if (comparison.left[i].event) all.push(comparison.left[i].event);
    if (comparison.right[i].event) all.push(comparison.right[i].event);
  });
  const chosen = new Set(points.map((p) => p.title + p.year));
  const minChosen = Math.min(...points.map((p) => Math.abs(p.delta)));
  const dropped = all.filter((e) => !chosen.has(e.title + e.year));
  for (const e of dropped) assert.ok(Math.abs(e.delta) <= minChosen + 1e-9);
});

test("年龄轴步长精确为 0.25", () => {
  const { rawAxis } = buildComparison(liubang, xiangyu, "age");
  assert.equal(rawAxis[1], 0.25);
  assert.equal(rawAxis[3], 0.75);
});

test("空事件不抛异常", () => {
  assert.doesNotThrow(() => interpolateTrajectoryScore([], 10));
  assert.doesNotThrow(() => getCandleView({ events: [], lifeSpan: 30 }));
  assert.doesNotThrow(() => buildMicroCandles({ id: "x", events: [], lifeSpan: 30 }));
});

test("畸形百分号编码返回 4xx，超长 q 返回 400", async () => {
  const bad = await handleHistoryApi(new Request("http://x.test/api/figures/%E0%A4%A"));
  assert.ok(bad.status >= 400 && bad.status < 500);
  const long = await handleHistoryApi(new Request("http://x.test/api/figures?q=" + "a".repeat(65)));
  assert.equal(long.status, 400);
  const ok = await handleHistoryApi(new Request("http://x.test/api/figures?q=" + encodeURIComponent("刘邦") + "&compact=1"));
  assert.equal(ok.status, 200);
});
