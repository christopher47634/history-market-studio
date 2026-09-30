// v2 实验页的真实浏览器回归测试。需要先启动开发服务器（默认 http://localhost:4174）。
// 用法：node tests/e2e-lab.mjs [baseUrl]
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = (process.argv[2] ?? "http://localhost:4174") + "/lab.html";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`✓ ${name}`); } catch (err) { results.push(`✗ ${name}：${err.message}`); process.exitCode = 1; }
};

const page = await launch({ width: 1440, height: 1000 });
const chartBox = () => page.eval(`(()=>{const r=document.querySelector('.v2chart').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
const click = (text) => page.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const reads = () => page.eval(`[...document.querySelectorAll('.v2read')].map(e=>e.querySelector('.v2read__label').textContent)`);
const kState = () => page.eval(`document.querySelector('.v2chart').dataset.kLevel`);

await page.goto(`${base}?left=liubang&right=xiangyu`, 1800);

await check("同时代默认公元纪年轴", async () => {
  const pressed = await page.eval(`[...document.querySelectorAll('.v2seg button')].find(b=>b.textContent==='公元纪年').getAttribute('aria-pressed')`);
  assert.equal(pressed, "true");
});

await check("光标不在图上显示后世评价，在图上显示当时的势", async () => {
  assert.deepEqual(await reads(), ["后世评价", "后世评价"]);
  const b = await chartBox();
  await page.mouse(b.x + b.w * 0.66, b.y + b.h * 0.5);
  await page.sleep(300);
  assert.deepEqual(await reads(), ["当时的势", "当时的势"]);
  await page.mouse(5, 5);
  await page.sleep(300);
  assert.deepEqual(await reads(), ["后世评价", "后世评价"]);
});

await check("K 线滚轮放大切到事件级，缩回切回阶段级", async () => {
  await click("K 线");
  await page.sleep(700);
  assert.equal(await kState(), "stage");
  const b = await chartBox();
  for (let i = 0; i < 8; i++) { await page.wheel(b.x + b.w * 0.7, b.y + b.h * 0.5, -240); await page.sleep(150); }
  assert.equal(await kState(), "event");
  for (let i = 0; i < 12; i++) { await page.wheel(b.x + b.w * 0.7, b.y + b.h * 0.5, 240); await page.sleep(150); }
  assert.equal(await kState(), "stage");
});

await page.goto(`${base}?left=qinst&right=lshimin`, 1800);
await check("跨时代只能用年龄轴", async () => {
  const s = await page.eval(`(()=>{const bs=[...document.querySelectorAll('.v2seg button')];return {year:bs.find(b=>b.textContent==='公元纪年').disabled,age:bs.find(b=>b.textContent==='年龄').getAttribute('aria-pressed')}})()`);
  assert.deepEqual(s, { year: true, age: "true" });
});

await page.setViewport(390, 844, true);
await page.goto(`${base}?left=liubang&right=xiangyu`, 1800);
await check("手机宽度无横向溢出", async () => {
  assert.equal(await page.eval(`document.documentElement.scrollWidth - innerWidth`), 0);
});

await check("控制台零报错", async () => assert.deepEqual(page.consoleErrors, []));
await page.close();
console.log(results.join("\n"));
