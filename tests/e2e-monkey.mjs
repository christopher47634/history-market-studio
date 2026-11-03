// 随机操作（猴子）测试：随机点按钮、按键、滚动、切换页面和主题、改窗口大小，每一步之后检查有没有崩溃页、控制台报错、横向溢出。
// 用法：node tests/e2e-monkey.mjs [steps=300] [seed=1] [baseUrl]
import { launch } from "../scripts/cdp.mjs";

const steps = +(process.argv[2] ?? 300), seed0 = +(process.argv[3] ?? 1), base = process.argv[4] ?? "http://localhost:4174";
let s = seed0 * 2654435761 % 2 ** 32;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const p = await launch({ width: 1440, height: 900 });
const key = async (k, mods = 0) => {
  const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
  const vk = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 }[k] ?? k.toUpperCase().charCodeAt(0);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers: mods, windowsVirtualKeyCode: vk });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers: mods });
};
const targets = () => p.eval(`(() => {
  const sel = 'button:not(:disabled), [role=option], [role=radio], .v3-tile, .v3-row__main, .v3-cmd__row, .v3-picker__list button, .v3-board, .v3-strip button';
  return [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return [e.className?.toString?.().slice(0, 30), r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })
    .filter(([, x, y, w, h]) => w > 4 && h > 4 && x > 0 && y > 0 && x < innerWidth && y < innerHeight);
})()`);

await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 3500);
const log = [];
let bad = 0, lastErr = 0;
for (let i = 0; i < steps; i++) {
  const r = rnd();
  let what = "";
  try {
    if (r < 0.46) { const t = await targets(); if (t.length) { const [c, x, y] = pick(t); what = `click ${c}`; await p.click(x, y); } }
    else if (r < 0.58) { const k = pick(["Escape", "Tab", "ArrowDown", "ArrowUp", "Enter", "ArrowLeft", "ArrowRight"]); what = `key ${k}`; await key(k); }
    else if (r < 0.64) { what = "ctrl+k"; await key("k", 2); }
    else if (r < 0.70) { what = "/"; await key("/"); }
    else if (r < 0.78) { const d = pick([-600, -200, 200, 600, 1400]); what = `wheel ${d}`; await p.wheel(pick([300, 720, 1100]), 450, d); }
    else if (r < 0.84) { const t = pick(["变法", "李", "东坡", "唐", "wang", "诗", "帝", "孔明", ""]); what = `type ${t}`; if (t) await p.send("Input.insertText", { text: t }); }
    else if (r < 0.88) { const [w, h, m] = pick([[1440, 900, false], [390, 844, true], [820, 1180, false], [1024, 700, false]]); what = `resize ${w}`; await p.setViewport(w, h, m); }
    else if (r < 0.92) { what = "hash"; await p.eval(`location.hash = ${JSON.stringify(pick(["#b", "#c"]))}`); }
    else if (r < 0.95) { what = "back"; await p.eval(`history.back()`).catch(() => {}); await p.sleep(600); }
    else { const [x, y] = [100 + rnd() * 1200, 100 + rnd() * 700]; what = "hover"; await p.mouse(x, y); }
  } catch (e) { what += ` (script error: ${String(e.message).slice(0, 80)})`; }
  await p.sleep(rnd() < 0.3 ? 400 : 120);
  const state = await p.eval(`({
    crashed: !!document.querySelector('.v3-fail'),
    blank: !document.querySelector('#root')?.children.length,
    overflow: document.documentElement.scrollWidth - innerWidth,
    away: location.origin !== ${JSON.stringify(new URL(base).origin)},
  })`).catch(() => ({ crashed: true, blank: true }));
  const errs = p.consoleErrors.length;
  const problems = [];
  // 「后退」退到了站外（会话开头的空白页）：那是浏览器自己的页，不算网站的问题，拉回来继续。
  const offsite = state.away || (await p.eval("location.href").catch(() => "")).startsWith("about:");
  if (!offsite && state.crashed) problems.push("崩溃/错误页");
  if (!offsite && state.blank) problems.push("页面空白");
  if (state.overflow > 1) problems.push(`横向溢出 ${state.overflow}px`);
  if (errs > lastErr) problems.push("控制台报错：" + p.consoleErrors.slice(lastErr).join(" | ").slice(0, 300));
  if (offsite) { await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 1500); what += " (离站，已拉回)"; }
  lastErr = errs;
  log.push(`${i} ${what}`);
  if (problems.length) {
    bad++;
    console.log(`✗ 第 ${i} 步 [${what}] ${problems.join("；")}`);
    console.log("  最近 8 步：" + log.slice(-8).join(" → "));
    if (state.crashed || state.blank) await p.goto(`${base}/?left=liubang&right=xiangyu#b`, 2000);
  }
}
console.log(bad ? `\n共 ${bad} 处问题（seed ${seed0}，${steps} 步）` : `✓ 随机操作 ${steps} 步（seed ${seed0}）没有崩溃、报错或溢出`);
await p.close();
process.exit(bad ? 1 : 0);
