// 正式页面（玉衡 / 朱砂）的真实浏览器回归。需要先启动开发服务器（默认 http://localhost:4174）。
// 用法：node tests/e2e-app.mjs [baseUrl]
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:4174";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`✓ ${name}`); } catch (err) { results.push(`✗ ${name}：${err.message}`); process.exitCode = 1; }
};

const THEMES = { b: { card: ".yuheng-detail-card" }, c: { card: ".zhusha-detail-card" } };
const page = await launch({ width: 1487, height: 1058 });
const q = (sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const reads = () => page.eval(`[...document.querySelectorAll('.v2-read')].map(e=>e.querySelector('small').textContent)`);
const pressed = (label) => page.eval(`[...document.querySelectorAll('.v2-axis button')].find(b=>b.textContent===${JSON.stringify(label)})?.getAttribute('aria-pressed')`);
const chartBox = () => page.eval(`(()=>{const c=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0].getBoundingClientRect();return {x:c.x,y:c.y,w:c.width,h:c.height}})()`);

// 在图上扫一遍，直到吸附到某个节点、弹出事件卡。
async function hoverUntilCard(card, from = 0.5, to = 0.95) {
  const box = await chartBox();
  for (let fx = from; fx < to; fx += 0.025)
    for (let fy = 0.06; fy < 0.72; fy += 0.045) {
      await page.mouse(box.x + box.w * fx, box.y + box.h * fy);
      await page.sleep(60);
      if (await q(card)) { await page.sleep(350); return true; }
    }
  return false;
}

for (const [view, { card }] of Object.entries(THEMES)) {
  await page.goto(`${base}/?left=liubang&right=xiangyu#${view}`, 3500);

  await check(`${view}：同时代默认纪年轴，读数默认是后世评价`, async () => {
    assert.equal(await pressed("纪年"), "true");
    assert.deepEqual(await reads(), ["后世评价", "后世评价"]);
  });

  await check(`${view}：悬停节点弹出卡片，卡片贴着节点（间距 ≤ 40px），读数切到当时`, async () => {
    assert.ok(await hoverUntilCard(card), "扫遍图表都没有吸附到节点");
    const gap = await page.eval(`(()=>{const c=document.querySelector(${JSON.stringify(card)}).getBoundingClientRect();const p=document.querySelector('.life-snap-indicator')?.getBoundingClientRect();if(!p)return -1;const px=p.left+p.width/2,py=p.top+p.height/2;const dx=Math.max(c.left-px,0,px-c.right),dy=Math.max(c.top-py,0,py-c.bottom);return Math.round(Math.hypot(dx,dy))})()`);
    assert.ok(gap >= 0 && gap <= 40, `卡片离节点 ${gap}px`);
    const labels = await reads();
    assert.ok(labels.includes("当时的势") || labels.includes("身后地位"), `读数没有切换：${labels}`);
    const text = await page.eval(`document.querySelector(${JSON.stringify(card)}).innerText`);
    assert.ok(/当时的势|身后地位|终章/.test(text), "卡片里没有打分拆解");
    assert.ok(/原文已逐字核验|内容为概括/.test(text), "卡片没有标明依据类型");
  });

  await check(`${view}：光标离开后卡片收起，读数回到后世评价`, async () => {
    await page.mouse(4, 4);
    await page.sleep(1400);
    assert.equal(await q(card), false, "卡片没有收起");
    assert.deepEqual(await reads(), ["后世评价", "后世评价"]);
  });

  await check(`${view}：切到年龄轴再切回`, async () => {
    await page.eval(`[...document.querySelectorAll('.v2-axis button')].find(b=>b.textContent==='年龄').click()`);
    await page.sleep(600);
    assert.equal(await pressed("年龄"), "true");
    await page.eval(`[...document.querySelectorAll('.v2-axis button')].find(b=>b.textContent==='纪年').click()`);
    await page.sleep(600);
    assert.equal(await pressed("纪年"), "true");
  });

  await check(`${view}：K 线默认是人生阶段`, async () => {
    await page.eval(`[...document.querySelectorAll('button')].find(b=>/K\\s*线/.test(b.textContent)).click()`);
    await page.sleep(900);
    const body = await page.eval(`document.body.innerText`);
    assert.ok(body.includes("人生阶段"), "没有显示「人生阶段」粒度");
  });

  await page.goto(`${base}/?left=liubang&right=lshimin#${view}`, 3500);
  await check(`${view}：跨时代只能用年龄轴`, async () => {
    assert.equal(await pressed("年龄"), "true");
    assert.equal(await page.eval(`[...document.querySelectorAll('.v2-axis button')].find(b=>b.textContent==='纪年').disabled`), true);
  });
}

await check("搜索事件关键词能找到人物（胡服骑射 → 赵武灵王）", async () => {
  await page.goto(`${base}/?left=liubang&right=xiangyu#b`, 3500);
  const found = await page.eval(`(async()=>{const input=document.querySelector('input[type="search"], .catalog-search input, input');input.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'胡服骑射');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,500));return document.body.innerText.includes('赵武灵王')})()`);
  assert.ok(found, "搜索结果里没有赵武灵王");
});

await page.setViewport(390, 844, true);
for (const view of Object.keys(THEMES)) {
  await page.goto(`${base}/?left=liubang&right=xiangyu#${view}`, 3500);
  await check(`${view}：390px 手机宽度无横向溢出`, async () => {
    assert.equal(await page.eval(`document.documentElement.scrollWidth - innerWidth`), 0);
  });
}

await check("全程控制台零报错", async () => assert.deepEqual(page.consoleErrors, []));
await page.close();
console.log(results.join("\n"));
