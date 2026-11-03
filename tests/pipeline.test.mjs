import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFigure } from "../pipeline/build.mjs";
import { SAMPLE } from "../pipeline/registry.mjs";
import { quoteFound, wikitextToPlain } from "../pipeline/text.mjs";

const person = SAMPLE.find((p) => p.id === "liubang");
const gold = JSON.parse(await readFile(new URL("../data/v2/drafts/liubang.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../data/v2/sources/liubang/primary-0.txt", import.meta.url), "utf8").catch(() => null);
const clone = () => structuredClone(gold);

test("引文：繁简、标点不同也算找到，编造的找不到", () => {
  const src = "高祖，沛豐邑中陽里人，姓劉氏，字季。";
  assert.ok(quoteFound("高祖沛丰邑中阳里人", [src]));
  assert.ok(!quoteFound("高祖生于长安", [src]));
});

test("模板保留显示文字，版面模板删除", () => {
  assert.equal(wikitextToPlain("{{header|title=x}}{{a|文天祥}}，字宋瑞，{{YL|咸淳九年}}"), "文天祥，字宋瑞，咸淳九年");
});

test("刘邦标准样例全部通过", { skip: !source }, () => {
  const { errors, figure } = buildFigure(person, clone(), [source]);
  assert.deepEqual(errors, []);
  assert.equal(figure.peak.score, 97);
  assert.equal(figure.quality.quotesVerified, figure.quality.quotesClaimed);
});

test("编造的引文降为概括", { skip: !source }, () => {
  const draft = clone();
  draft.events[3].quote.text = "沛公入咸阳，秋毫无犯，天下归心。";
  const { figure, warnings } = buildFigure(person, draft, [source]);
  assert.equal(figure.events[3].evidence, "概括");
  assert.ok(warnings.some((w) => w.includes("找不到")));
});

test("档位越界、年份倒序、封顶、保留率都会报错", { skip: !source }, () => {
  const draft = clone();
  draft.events[2].tierScore = 60;          // 初起档最高 39
  draft.events[5].year = -210;             // 早于前一事件
  draft.events[11].tierScore = 100;        // 只有毛泽东能到 100
  draft.finale.retention = 0.5;            // 最多回撤 20%
  const { errors } = buildFigure(person, draft, [source]);
  assert.ok(errors.some((e) => e.includes("超出「初起」")));
  assert.ok(errors.some((e) => e.includes("早于上一个事件")));
  assert.ok(errors.some((e) => e.includes("超出「天下共主」")));
  assert.ok(errors.some((e) => e.includes("保留率")));
});

test("公元前后年龄换算没有 0 年", async () => {
  const { figure } = buildFigure({ ...person, id: "t" }, { ...clone(), born: { year: -10 }, died: { year: 20 }, events: clone().events.map((e, i) => ({ ...e, year: -10 + i * 2 })) }, [source ?? ""]);
  assert.equal(figure.lifeSpan, 29);
});
