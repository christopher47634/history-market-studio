// 搜索回归：每次改人物数据或搜索规则都跑。用户 10-19 报：搜「变法」出来齐白石、没有王安石。
import test from "node:test";
import assert from "node:assert/strict";
import figures from "../src/v2/index.generated.js";
import { searchFigures, isStrong } from "../src/v3/search.js";
import { TERMS } from "../src/v3/search-terms.js";

const names = (q, n = 10) => (searchFigures(figures, q) ?? []).slice(0, n).map((r) => r.f.name);
const strong = (q) => (searchFigures(figures, q) ?? []).filter(isStrong).map((r) => r.f.name);

test("每个人都在搜索词表里", () => {
  assert.deepEqual(figures.filter((f) => !TERMS[f.id]).map((f) => f.id), []);
});

test("变法：主角在前，齐白石的画风「衰年变法」只算弱命中", () => {
  const top = names("变法", 5);
  for (const n of ["商鞅", "王安石", "吴起", "梁启超", "康有为"]) assert.ok(top.includes(n), `变法前五没有${n}：${top}`);
  assert.ok(!strong("变法").includes("齐白石"));
  assert.ok(names("改革", 12).includes("王安石"));
  assert.ok(names("新政", 3).includes("范仲淹"));
});

test("姓名、别名、拼音都能直达", () => {
  for (const [q, n] of [["王安石", "王安石"], ["孔明", "诸葛亮"], ["东坡", "苏轼"], ["关公", "关羽"], ["诗仙", "李白"], ["医圣", "张仲景"], ["wanganshi", "王安石"], ["唐伯虎", "唐寅"], ["金兀术", "完颜宗弼"], ["纪晓岚", "纪昀"]]) {
    assert.equal(names(q, 1)[0], n, `搜「${q}」第一个应是${n}`);
  }
});

test("长查询不会因为包含短词误命中", () => {
  assert.deepEqual(names("王安石变法", 1), ["王安石"]);
  assert.ok(!strong("王安石变法").includes("商鞅"));
  assert.deepEqual(strong("戊戌变法").sort(), ["康有为", "梁启超"].sort());
});

test("单字：朝代与类别", () => {
  assert.equal(names("唐", 1)[0], "唐寅");
  assert.ok(names("唐", 20).includes("李世民"));
  const xz = searchFigures(figures, "唐").find((r) => r.f.name === "玄奘");
  assert.ok(!xz.why.includes("大唐西域记"), "单字不该命中「大唐西域记」");
  for (const n of ["李清照", "辛弃疾", "柳永"]) assert.ok(names("词", 6).includes(n));
});

test("多个词必须都命中", () => {
  assert.ok(names("宋 词", 6).every((n) => ["李清照", "辛弃疾", "柳永", "晏殊", "苏轼", "李煜"].includes(n)));
  assert.equal(names("赤壁 孔明", 1)[0], "诸葛亮");
});
