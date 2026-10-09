// 跨浏览器冒烟：Firefox 和 WebKit（Safari 内核），桌面 + 手机触屏各跑一遍。
// 需要先启动服务（默认 http://localhost:4174），浏览器装在 PLAYWRIGHT_BROWSERS_PATH。
// 用法：node tests/e2e-cross.mjs [baseUrl]
import assert from "node:assert/strict";
import { firefox, webkit, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:4174";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`✓ ${name}`); } catch (err) { results.push(`✗ ${name}：${err.message.split("\n")[0]}`); process.exitCode = 1; }
};

// 画布上非背景像素的比例：图真的画出来了才会有足够多的线条像素。
const inkRatio = (page) => page.evaluate(() => {
  const c = [...document.querySelectorAll(".v3-chart-canvas canvas")][0];
  const ctx = c.getContext("2d");
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let ink = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 0) ink++;
  return ink / (data.length / 16);
});
// 下拉框中心点最上层的元素必须属于弹层（不能被图表卡片盖住）。
const popOnTop = (page) => page.evaluate(() => {
  const p = document.querySelector(".v3-picker__pop");
  if (!p) return "no-pop";
  const r = p.getBoundingClientRect();
  return [[0.5, 0.5], [0.5, 0.85]].every(([fx, fy]) => p.contains(document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy))) ? "ok" : "covered";
});
const level = (page) => page.locator('.v3-seg[aria-label="缩放层级"] [aria-checked="true"]').textContent();

async function scanFor(page, selector, act) {
  const box = await page.locator(".v3-chart-canvas").boundingBox();
  for (let fx = 0.25; fx < 0.9; fx += 0.03)
    for (let fy = 0.12; fy < 0.85; fy += 0.05) {
      await act(box.x + box.width * fx, box.y + box.height * fy);
      if (await page.locator(selector).count()) return true;
    }
  return false;
}

for (const [name, engine] of [["Firefox", firefox], ["WebKit", webkit]]) {
  const browser = await engine.launch();
  const errors = [];

  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desk.on("pageerror", (e) => errors.push(e.message));
  desk.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await desk.goto(`${base}/?left=maozedong&right=zhouenlai#c`);
  await desk.waitForSelector(".v3-reader__title");
  await desk.waitForTimeout(1800);

  await check(`${name} 桌面：图表画出来了`, async () => {
    assert.ok((await inkRatio(desk)) > 0.02, "画布几乎是空的");
  });
  await check(`${name} 桌面：悬停吸附出卡片，点击固定`, async () => {
    assert.ok(await scanFor(desk, ".v3-hover", (x, y) => desk.mouse.move(x, y)), "没有吸附到节点");
    const title = (await desk.locator(".v3-hover__title").textContent()).trim();
    await desk.mouse.down(); await desk.mouse.up();
    await desk.waitForTimeout(400);
    assert.equal((await desk.locator(".v3-reader__title").textContent()).trim(), title);
  });
  await check(`${name} 桌面：滚轮放大切到章节层`, async () => {
    const box = await desk.locator(".v3-chart-canvas").boundingBox();
    await desk.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 16 && (await level(desk)) === "全景"; i++) { await desk.mouse.wheel(0, -240); await desk.waitForTimeout(150); }
    assert.notEqual(await level(desk), "全景");
  });
  await check(`${name} 桌面：人物下拉框浮在图表之上`, async () => {
    await desk.locator(".v3-picker__btn").nth(1).click();
    await desk.waitForTimeout(400);
    assert.equal(await popOnTop(desk), "ok");
    await desk.keyboard.press("Escape");
  });
  await check(`${name} 桌面：朱砂切回玉衡后图表是深色`, async () => {
    await desk.evaluate(() => { location.hash = "b"; });
    await desk.waitForTimeout(900);
    const lum = await desk.evaluate(() => {
      const c = document.querySelector(".v3-chart-canvas canvas");
      const k = c.width / c.clientWidth;
      const d = c.getContext("2d").getImageData(Math.round(c.width * 0.5), Math.round(c.height - 25 * k), 1, 1).data;
      return (d[0] + d[1] + d[2]) / 3;
    });
    assert.ok(lum < 80, `缩放条亮度 ${lum}`);
  });
  await check(`${name} 桌面：文字版表格可打开`, async () => {
    await desk.getByRole("button", { name: "文字版" }).click();
    assert.ok((await desk.locator(".v3-table tbody tr").count()) > 20);
  });

  const phone = await browser.newContext({ ...devices[name === "WebKit" ? "iPhone 13" : "Pixel 5"], ...(name === "Firefox" ? { isMobile: false } : {}) });
  const mob = await phone.newPage();
  mob.on("pageerror", (e) => errors.push(e.message));
  await mob.goto(`${base}/?left=zhouenlai&right=dengxiaoping#b`);
  await mob.waitForSelector(".v3-reader__title");
  await mob.waitForTimeout(1800);
  await check(`${name} 手机：无横向滚动，图表画出来`, async () => {
    assert.ok(await mob.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "页面出现横向滚动");
    assert.ok((await inkRatio(mob)) > 0.02, "画布几乎是空的");
  });
  await check(`${name} 手机：点按节点固定到阅读面板`, async () => {
    const before = await mob.locator(".v3-reader__title").textContent();
    const tap = (x, y) => (name === "WebKit" ? mob.touchscreen.tap(x, y) : mob.mouse.click(x, y));
    let changed = false;
    const box = await mob.locator(".v3-chart-canvas").boundingBox();
    for (let fx = 0.2; fx < 0.9 && !changed; fx += 0.05)
      for (let fy = 0.15; fy < 0.85 && !changed; fy += 0.06) {
        await tap(box.x + box.width * fx, box.y + box.height * fy);
        await mob.waitForTimeout(60);
        changed = (await mob.locator(".v3-reader__title").textContent()) !== before;
      }
    assert.ok(changed, "点遍图表都没有固定到新节点");
  });
  await check(`${name} 手机：下拉框浮在最上层`, async () => {
    await mob.locator(".v3-picker__btn").first().click();
    await mob.waitForTimeout(400);
    assert.equal(await popOnTop(mob), "ok");
  });
  await check(`${name}：全程没有脚本报错`, async () => assert.deepEqual(errors, []));
  await browser.close();
}

console.log(results.join("\n"));
process.exit(process.exitCode ?? 0);
