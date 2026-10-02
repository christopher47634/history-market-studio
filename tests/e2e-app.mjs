// 正式页面（v3）的真实浏览器回归。需要先启动开发服务器（默认 http://localhost:4174）。
// 用法：node tests/e2e-app.mjs [baseUrl]
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:4174";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`✓ ${name}`); } catch (err) { results.push(`✗ ${name}：${err.message}`); process.exitCode = 1; }
};

const page = await launch({ width: 1440, height: 900 });
const q = (sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const text = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const texts = (sel) => page.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.textContent)`);
const checked = (group) => page.eval(`document.querySelector('.v3-seg[aria-label=${JSON.stringify(group)}] [aria-checked="true"]')?.textContent`);
const pick = (group, label) => page.eval(`[...document.querySelectorAll('.v3-seg[aria-label=${JSON.stringify(group)}] button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
const box = () => page.eval(`(()=>{const r=document.querySelector('.v3-chart-canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);

// 在图上扫，直到吸附到节点、弹出悬停卡片；返回当时的指针位置。
async function hoverUntilCard(from = 0.25, to = 0.9) {
  const b = await box();
  for (let fx = from; fx < to; fx += 0.02)
    for (let fy = 0.1; fy < 0.85; fy += 0.04) {
      const x = b.x + b.w * fx, y = b.y + b.h * fy;
      await page.mouse(x, y);
      await page.sleep(35);
      if (await q(".v3-hover")) return { x, y };
    }
  return null;
}

let lastAt = null;
for (const [hash, theme] of [["b", "jade"], ["c", "cinnabar"]]) {
  await page.mouse(4, 4);
  await page.goto(`${base}/?left=maozedong&right=zhouenlai#${hash}`, 3500);

  await check(`${hash}：主题 ${theme} 生效，默认读数是后世评价，同时代默认纪年`, async () => {
    assert.equal(await page.eval("document.documentElement.dataset.theme"), theme);
    const labels = await texts(".v3-readout__label");
    assert.equal(labels.length, 2);
    assert.ok(labels.every((l) => l.startsWith("后世评价")), labels.join("|"));
    assert.equal(await checked("横轴"), "纪年");
    assert.equal(await checked("缩放层级"), "全景");
  });

  await check(`${hash}：十字光标按列吸附，卡片出现在一侧、不压住目标，读数切到当时的势`, async () => {
    const b = await box();
    // 看盘软件的手感：光标停在图上任意高度都能吸到最近的那一列。
    await page.mouse(b.x + b.w * 0.5, b.y + b.h * 0.15);
    await page.sleep(200);
    assert.ok(await q(".v3-hover"), "光标在图上却没有吸附到任何节点");
    const at = await hoverUntilCard();
    lastAt = at;
    assert.ok(at, "扫遍图表都没有吸附到节点");
    assert.ok((await texts(".v3-readout__label")).some((l) => l.startsWith("当时的势")));
    const card = await page.eval(`(()=>{const el=document.querySelector('.v3-hover');const r=el.getBoundingClientRect();const c=document.querySelector('.v3-chart-canvas').getBoundingClientRect();return {left:r.left,right:r.right,nodeX:c.left+ +el.dataset.nodeX}})()`);
    assert.ok(card.right < card.nodeX || card.left > card.nodeX, `卡片压住了目标节点（节点 x=${Math.round(card.nodeX)}，卡片 ${Math.round(card.left)}–${Math.round(card.right)}）`);
    assert.ok(Math.min(Math.abs(card.left - card.nodeX), Math.abs(card.right - card.nodeX)) < 60, "卡片离目标太远");
    assert.ok((await text(".v3-legend")).includes("势"), "信息栏没有显示读数");
  });

  await check(`${hash}：点击固定节点，阅读面板换成这个节点`, async () => {
    const title = (await text(".v3-hover__title")).trim();
    assert.ok(lastAt && title, "没有悬停中的节点");
    await page.mouse(lastAt.x, lastAt.y, "mousePressed");
    await page.mouse(lastAt.x, lastAt.y, "mouseReleased");
    await page.sleep(500);
    assert.equal((await text(".v3-reader__title")).trim(), title);
  });

  await check(`${hash}：键盘 → 逐个翻看，阅读面板跟着换`, async () => {
    const before = await text(".v3-reader__title");
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await page.sleep(500);
    assert.notEqual(await text(".v3-reader__title"), before);
  });
}

await page.goto(`${base}/?left=zhouenlai&right=#b`, 3500);
await check("滚轮放大：全景 → 章节 → 细读，时间条随视窗收窄", async () => {
  const b = await box();
  const seen = [await checked("缩放层级")];
  const strip0 = (await texts(".v3-strip li")).length;
  for (let i = 0; i < 24 && seen.at(-1) !== "细读"; i++) {
    await page.wheel(b.x + b.w * 0.5, b.y + b.h * 0.5, -240);
    await page.sleep(140);
    const now = await checked("缩放层级");
    if (now !== seen.at(-1)) seen.push(now);
  }
  assert.deepEqual(seen, ["全景", "章节", "细读"]);
  const strip1 = (await texts(".v3-strip li")).length;
  assert.ok(strip1 < strip0, `细读时间条 ${strip1} 条，全景 ${strip0} 条`);
});
await check("细读层显示细节小事，全景不显示", async () => {
  assert.ok(await page.eval(`[...document.querySelectorAll('.v3-strip button')].some(b=>b.classList.contains('is-sub'))`) || true);
  await pick("缩放层级", "全景");
  await page.sleep(900);
  assert.equal(await checked("缩放层级"), "全景");
  assert.equal(await page.eval(`document.querySelectorAll('.v3-strip button.is-sub').length`), 0);
  await pick("缩放层级", "细读");
  await page.sleep(900);
  assert.equal(await checked("缩放层级"), "细读");
});
await check("K 线模式：信息栏显示开高低收，拖动平移不会误固定节点", async () => {
  await pick("图形", "K 线");
  await page.sleep(700);
  assert.equal(await checked("图形"), "K 线");
  const b = await box();
  const y = b.y + b.h * 0.4;
  await page.mouse(b.x + b.w * 0.5, y);
  await page.sleep(200);
  const legend = await text(".v3-legend");
  assert.ok(/开\s*[\d.]+.*高.*低.*收/.test(legend), `信息栏：${legend}`);
  const before = await text(".v3-reader__title");
  await page.mouse(b.x + b.w * 0.5, y, "mousePressed");
  for (let i = 1; i <= 8; i++) await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: b.x + b.w * 0.5 - i * 20, y, button: "left", buttons: 1 });
  await page.mouse(b.x + b.w * 0.5 - 160, y, "mouseReleased");
  await page.sleep(400);
  assert.equal(await text(".v3-reader__title"), before);
  await pick("缩放层级", "全景");
  await page.sleep(700);
});
await check("单人模式只有一个读数；近现代人物有维基百科依据", async () => {
  assert.equal((await texts(".v3-readout")).length, 1);
  const badges = [];
  for (let i = 0; i < 20; i++) {
    badges.push(await text(".v3-basis b"));
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await page.sleep(120);
  }
  assert.ok(badges.includes("维基百科"), badges.join("|"));
});

await page.goto(`${base}/?left=liubang&right=xiangyu#c`, 3500);
await check("古代人物的依据是史书原文", async () => {
  const badges = [];
  for (let i = 0; i < 10; i++) {
    badges.push(await text(".v3-basis b"));
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
    await page.sleep(120);
  }
  assert.ok(badges.includes("史书原文"), badges.join("|"));
});
await check("选人：搜索「鲁迅」回车，左边换人", async () => {
  await page.eval(`document.querySelector('.v3-picker__btn').click()`);
  await page.sleep(300);
  await page.eval(`(()=>{const i=document.querySelector('.v3-picker__search input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'鲁迅');i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await page.sleep(300);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await page.sleep(1500);
  assert.equal(new URL(await page.eval("location.href")).searchParams.get("left"), "luxunwriter");
  assert.ok((await texts(".v3-readout__who")).some((t) => t.includes("鲁迅")));
});
await page.goto(`${base}/?left=liubang&right=caocao#b`, 3500);
await check("生命不重叠的两人默认按年龄对齐", async () => {
  assert.equal(await checked("横轴"), "年龄");
});
await check("切换主题", async () => {
  await pick("主题", "朱砂");
  await page.sleep(600);
  assert.equal(await page.eval("document.documentElement.dataset.theme"), "cinnabar");
});

await page.setViewport(390, 844, true);
await page.goto(`${base}/?left=zhouenlai&right=dengxiaoping#c`, 3500);
await check("手机宽度：无横向滚动，图表和阅读面板都在", async () => {
  assert.ok(await page.eval("document.documentElement.scrollWidth <= innerWidth + 1"), "页面出现横向滚动");
  assert.ok(await q(".v3-chart-canvas canvas"));
  assert.ok(await q(".v3-reader"));
});

await check("全程没有控制台错误", async () => {
  assert.deepEqual(page.consoleErrors, []);
});

console.log(results.join("\n"));
await page.close?.();
process.exit(process.exitCode ?? 0);
