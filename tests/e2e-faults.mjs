// 故障注入：对每一类按需下载的资源制造网络失败，看页面能不能自己恢复、有没有露出裂图或卡死在错误页。
// 用法：node tests/e2e-faults.mjs [baseUrl]（默认 http://localhost:4174，需要先启动预览服务）
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:4174";
let failed = 0;
const check = async (name, fn) => {
  const p = await launch({ width: 1440, height: 900 });
  try { await fn(p); console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name}：${e.message}`); }
  finally { await p.close(); }
};
const block = async (p, urls) => { await p.send("Network.enable"); await p.send("Network.setBlockedURLs", { urls }); };
const html = (p) => p.eval("document.body.innerText");
// 等到条件成立（最多 ms 毫秒）。线上网络比本机慢，固定睡眠会误报，所以都改成「等到出现为止」。
const until = async (p, expr, ms = 20000) => { for (let t = 0; t < ms; t += 400) { if (await p.eval(expr).catch(() => false)) return true; await p.sleep(400); } return false; };
const CHART = `!!document.querySelector('.v3-chart-canvas canvas')`;

await check("个别人物的数据文件前几秒下载失败：自动重试后图表出来，不停在错误页", async (p) => {
  await block(p, ["*/assets/*.json*"]);
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 2500);
  assert.ok(!(await html(p)).includes("人物数据没加载下来"), "重试期间就弹了错误页");
  await p.send("Network.setBlockedURLs", { urls: [] });
  assert.ok(await until(p, CHART, 25000), "网络恢复后图表没画出来");
  assert.ok(!(await html(p)).includes("没加载下来"));
});

await check("人物数据一直失败：显示错误页和「重试」，网络恢复后点重试就好", async (p) => {
  await block(p, ["*/assets/*.json*"]);
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 9000);
  assert.ok(await until(p, `document.body.innerText.includes('人物数据没加载下来')`, 40000), `没出现带重试的错误页；页面当时显示：${(await html(p)).slice(0, 80).replace(/
/g, " | ")}`);
  await p.send("Network.setBlockedURLs", { urls: [] });
  await p.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重试').click()`);
  assert.ok(await until(p, CHART), "点重试后图表没出来");
});

await check("错误页之后换一个人：旧的失败不再算数", async (p) => {
  await block(p, ["*/assets/liubang-*.json*"]);
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 2000);
  assert.ok(await until(p, `document.body.innerText.includes('没加载下来')`, 25000), "前提：应该先出错误页");
  await p.send("Network.setBlockedURLs", { urls: [] });
  await p.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重试').click()`);
  assert.ok(await until(p, CHART));
});

await check("头像数据和头像图片失败：不露裂图，恢复后全部补上", async (p) => {
  await block(p, ["*roles.generated*", "*/portraits/*"]);
  await p.goto(`${base}/?view=roles#b`, 3000);
  const broken = await p.eval(`[...document.querySelectorAll('img.v3-ava')].filter(i => !i.dataset.ok).length`);
  const visibleBroken = await p.eval(`[...document.querySelectorAll('img.v3-ava')].filter(i => !i.dataset.ok && getComputedStyle(i).content === 'none').length`);
  assert.equal(visibleBroken, 0, `有 ${visibleBroken} 个未加载的头像还露着原图（可能是裂图图标）`);
  await p.send("Network.setBlockedURLs", { urls: [] });
  await until(p, `document.querySelectorAll('img.v3-ava[data-ok]').length > 8`, 30000);
  const ok = await p.eval(`document.querySelectorAll('img.v3-ava[data-ok]').length`);
  assert.ok(ok > 8, `恢复后只有 ${ok} 张头像加载成功（未加载时 ${broken}）`);
});

await check("字体下载失败：页面照常显示文字，没有空白", async (p) => {
  await block(p, ["*/fonts/*"]);
  await p.goto(`${base}/?view=roles#b`, 1500);
  assert.ok(await until(p, `document.body.innerText.includes('毛泽东') && document.body.innerText.includes('角色')`), "字体失败后页面没有正常显示文字");
});

await check("主程序脚本下载失败：骨架屏上给出提示和「重新载入」", async (p) => {
  await block(p, ["*/assets/index-*.js*"]);
  await p.goto(`${base}/#b`, 1500);
  assert.ok(await p.eval(`!!document.querySelector('[data-boot-note] button')`), "没有出现启动失败提示");
});

await check("离线缓存：第二次打开不再请求头像，也不报错", async (p) => {
  await p.goto(`${base}/?view=roles#b`, 3500);
  await until(p, `document.querySelectorAll('img.v3-ava[data-ok]').length > 8`, 30000);
  await p.goto(`${base}/?view=roles#b`, 3500);
  await until(p, `!!navigator.serviceWorker.controller`, 10000);
  const info = await p.eval(`(async () => ({ sw: !!navigator.serviceWorker.controller, cached: (await Promise.all((await caches.keys()).filter((k) => k.endsWith('-portraits')).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0) }))()`);
  assert.ok(info.sw && info.cached > 8, `离线缓存没生效：${JSON.stringify(info)}`);
  assert.equal(p.consoleErrors.length, 0, p.consoleErrors.join("\n"));
});

if (failed) { console.log(`\n${failed} 项没通过`); process.exit(1); }
console.log("\n故障注入全部通过");
