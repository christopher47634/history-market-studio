// 动效验证：重排滑动（FLIP）、退场动画、滚动进场；并确认「减少动态效果」时全部关闭。
// 用法：node tests/e2e-motion.mjs [baseUrl]（默认 http://localhost:4174）
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

const base = process.argv[2] ?? "http://localhost:4174";
let failed = 0;
const check = async (name, opts, fn) => {
  const p = await launch({ width: 1440, height: 900 });
  try {
    if (opts.reduce) await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await fn(p); console.log(`✓ ${name}`);
  } catch (e) { failed++; console.log(`✗ ${name}：${e.message}`); }
  finally { await p.close(); }
};
const type = (p, text) => p.eval(`(() => { const i = document.querySelector('.v3-filterbar input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const flips = (p) => p.eval(`document.getAnimations().filter((a) => a.id === 'flip').length`);
const key = async (p, k, mods = 0) => {
  const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers: mods, windowsVirtualKeyCode: k === "Escape" ? 27 : k.toUpperCase().charCodeAt(0) });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers: mods });
};

await check("搜索让卡片位置变了：留下来的卡片滑到新位置（FLIP）", {}, async (p) => {
  await p.goto(`${base}/?view=roles#b`, 4500);
  assert.equal(await flips(p), 0, "一开始不该有重排动画");
  await type(p, "李");
  await p.sleep(60);
  const n = await flips(p);
  assert.ok(n > 0, "搜索后没有任何卡片在滑动");
  await p.sleep(800);
  assert.equal(await flips(p), 0, "动画没有收尾");
  assert.ok(await p.eval(`[...document.querySelectorAll('.v3-tile')].every((t) => getComputedStyle(t).transform === 'none' || getComputedStyle(t).transform === 'matrix(1, 0, 0, 1, 0, 0)')`), "动画结束后卡片没回到原位");
});

await check("减少动态效果：不做重排滑动，也没有进场动画", { reduce: true }, async (p) => {
  await p.goto(`${base}/?view=roles#b`, 4500);
  await type(p, "李");
  await p.sleep(60);
  assert.equal(await flips(p), 0, "开了减少动态效果还在滑");
  assert.equal(await p.eval(`getComputedStyle(document.querySelector('.v3-tile')).animationName`), "none", "开了减少动态效果还在做滚动进场");
});

await check("滚动进场：支持的浏览器上卡片绑定了滚动时间线，且首屏卡片是显示的", {}, async (p) => {
  await p.goto(`${base}/?view=roles#b`, 4500);
  const supported = await p.eval(`CSS.supports('animation-timeline: view()')`);
  if (!supported) return;
  assert.ok((await p.eval(`getComputedStyle(document.querySelector('.v3-tile')).animationName`)).includes("ix-tile-reveal"));
  assert.equal(await p.eval(`getComputedStyle(document.querySelector('.v3-tile')).opacity`), "1", "首屏的卡片不该是透明的");
  await p.eval(`scrollTo(0, 1600)`); await p.sleep(900);
  const o = await p.eval(`[...document.querySelectorAll('.v3-tile')].filter((t) => { const r = t.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 160; }).map((t) => +getComputedStyle(t).opacity)`);
  assert.ok(o.length && o.every((v) => v > 0.95), `滚到屏幕中间的卡片应是完全显示的：${o.join(",")}`);
});

await check("⌘K 面板：关闭时先播退场、再卸载", {}, async (p) => {
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 4000);
  await key(p, "k", 2); await p.sleep(500);
  assert.ok(await p.eval(`!!document.querySelector('.v3-cmd') && !document.querySelector('.v3-cmd.is-closing')`), "没打开");
  await key(p, "Escape"); await p.sleep(10);
  assert.ok(await p.eval(`!!document.querySelector('.v3-cmd.is-closing')`), "关闭瞬间应处于退场状态");
  await p.sleep(400);
  assert.ok(await p.eval(`!document.querySelector('.v3-cmd')`), "退场后没有卸载");
  await key(p, "k", 2); await p.sleep(500);
  assert.ok(await p.eval(`!!document.querySelector('.v3-cmd') && !document.querySelector('.v3-cmd.is-closing')`), "再次打开失败");
});

await check("选人下拉：关闭时先播退场、再卸载", {}, async (p) => {
  await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 4000);
  await p.eval(`document.querySelectorAll('.v3-picker__btn')[0].click()`); await p.sleep(600);
  assert.ok(await p.eval(`!!document.querySelector('.v3-picker__pop')`), "没打开");
  await key(p, "Escape"); await p.sleep(10);
  assert.ok(await p.eval(`!!document.querySelector('.v3-picker__pop.is-closing')`), "关闭瞬间应处于退场状态");
  await p.sleep(400);
  assert.ok(await p.eval(`!document.querySelector('.v3-picker__pop')`), "退场后没有卸载");
});

if (failed) { console.log(`\n${failed} 项没通过`); process.exit(1); }
console.log("\n动效验证全部通过");
