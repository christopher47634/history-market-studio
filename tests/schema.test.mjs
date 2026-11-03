import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIER_RANGES, validateClientFigures } from "../src/v2/clientSchema.js";

const load = (id) => JSON.parse(readFileSync(new URL(`../data/v2/client/${id}.json`, import.meta.url), "utf8"));
const errorsOf = (figure) => validateClientFigures([figure]).errors;
const firstStage = (figure) => figure.events.find((e) => e.kind === "stage" && e.tier !== "布衣");

test("锚点人物刘邦、毛泽东通过校验", () => {
  assert.deepEqual(errorsOf(load("liubang")), []);
  assert.deepEqual(errorsOf(load("maozedong")), []);
});

test("势必须等于 max(2, 档分 − 折损)", () => {
  const figure = load("liubang");
  firstStage(figure).score += 7;
  assert.ok(errorsOf(figure).some((m) => m.includes("≠ max(")));
});

test("档分超出权位档区间会报错", () => {
  const figure = load("liubang");
  const event = firstStage(figure);
  event.tierScore = TIER_RANGES[event.tier][0] - 1;
  event.score = Math.max(2, event.tierScore - event.crisisPenalty);
  assert.ok(errorsOf(figure).some((m) => m.includes(`不在「${event.tier}」`)));
});

test("非锚点人物的势与后世评价不得超过 98", () => {
  const figure = load("liubang");
  figure.legacy.score = 99;
  figure.posthumous.at(-1).score = 99;
  assert.ok(errorsOf(figure).some((m) => m.includes("超过封顶 98")));
});

test("终章 = 前一阶段 × 保留率，保留率在 0.80–1.00", () => {
  const figure = load("liubang");
  figure.finale.retention = 0.5;
  const errors = errorsOf(figure);
  assert.ok(errors.some((m) => m.includes("保留率 0.5 不在")));
  assert.ok(errors.some((m) => m.includes("≠ 前一阶段")));
});

test("标为原文的节点必须带引句", () => {
  const figure = load("liubang");
  figure.events.find((e) => e.evidence === "原文").quote = null;
  assert.ok(errorsOf(figure).some((m) => m.includes("标为「原文」却没有引句")));
});

test("身后声望线终点必须等于后世评价", () => {
  const figure = load("liubang");
  figure.posthumous.at(-1).score -= 10;
  assert.ok(errorsOf(figure).some((m) => m.includes("身后声望线终点")));
});

test("年龄与纪年不一致会报错，跨公元前后允许差 1", () => {
  const figure = load("liubang");
  firstStage(figure).age += 3;
  assert.ok(errorsOf(figure).some((m) => m.includes("不一致")));
});

test("重复 id 会报错", () => {
  const { errors } = validateClientFigures([load("liubang"), load("liubang")]);
  assert.ok(errors.some((m) => m.includes("id 重复")));
});
