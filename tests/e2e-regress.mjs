// 回归用例：随机测试抓到过的崩溃，按原样复现，防止复发。用法：node tests/e2e-regress.mjs [baseUrl]
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:4174";
const p = await launch({ width: 1440, height: 900 });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log(`✓ ${name}`); } catch (e) { failed++; console.log(`✗ ${name}：${e.message}`); } };
const click = (sel, text) => p.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${text ? `e.textContent.includes(${JSON.stringify(text)})` : "true"}); if (!el) throw new Error('找不到 ' + ${JSON.stringify(sel + " " + (text ?? ""))}); el.click(); })()`);

await step("10-20：K 线模式下固定在第二个人的事件上，再切成「只看一个人」，页面不崩溃", async () => {
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 4500);
  await click(".v3-seg button", "K 线"); await p.sleep(600);
  await click(".v3-strip button", "会稽起兵"); await p.sleep(500); // 项羽（第二个人）的事件
  assert.ok(await p.eval(`document.querySelector('.v3-dock')?.textContent.includes('项羽')`), "前提：详情栏应固定在项羽的事件上");
  await p.eval(`document.querySelectorAll('.v3-picker__btn')[1].click()`); await p.sleep(600);
  await click(".v3-picker__clear"); await p.sleep(1500);
  assert.ok(!(await p.eval(`!!document.querySelector('.v3-fail')`)), "切成一个人后出现了错误页");
  assert.equal(p.consoleErrors.length, 0, p.consoleErrors.join("\n").slice(0, 300));
  assert.ok(await p.eval(`!!document.querySelector('.v3-chart-canvas canvas')`), "图表没了");
});

await p.close();
if (failed) { console.log(`\n${failed} 项没通过`); process.exit(1); }
console.log("\n回归用例全部通过");
