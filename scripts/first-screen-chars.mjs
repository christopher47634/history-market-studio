// 抓首页默认首屏（桌面/手机、两套主题）实际显示的汉字，写进 pipeline/first-screen.txt，供 pipeline/fonts.py 做首屏专用字体片。
// 用法：先 npm run build 并 npx vite preview --port 4180，再 node scripts/first-screen-chars.mjs http://localhost:4180/
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:4180/";
const browser = await chromium.launch({ channel: "chrome" });
const all = new Set(); const report = [];
for (const [vp, hash] of [[{ width: 1440, height: 900 }, ""], [{ width: 1440, height: 900 }, "#c"], [{ width: 390, height: 844 }, ""], [{ width: 1920, height: 1080 }, ""], [{ width: 1280, height: 720 }, "#c"]]) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  const page = await ctx.newPage();
  const fonts = [];
  page.on("request", (r) => { if (r.url().includes("/fonts/")) fonts.push(r.url().split("/").pop()); });
  await page.goto(base + hash, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("canvas") && !document.querySelector(".sk"), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  // 屏幕上实际渲染的文字（DOM 文本 + 伪元素/占位符/标题属性），加上 canvas 里画的字靠后面的 echarts 选项抓不到，单独从图表选项里取
  const text = await page.evaluate(() => {
    let s = document.body.innerText;
    for (const el of document.querySelectorAll("*")) {
      for (const p of ["::before", "::after"]) { const c = getComputedStyle(el, p).content; if (c && c !== "none" && c !== "normal") s += c; }
      for (const a of ["placeholder", "aria-label", "title", "alt"]) if (el.getAttribute?.(a)) s += el.getAttribute(a);
    }
    for (const c of document.querySelectorAll("canvas")) {
      const inst = window.echarts?.getInstanceByDom?.(c.parentElement);
      if (inst) s += JSON.stringify(inst.getOption());
    }
    return s;
  });
  const cjk = [...new Set([...text].filter((c) => c.codePointAt(0) >= 0x2e80))];
  cjk.forEach((c) => all.add(c));
  report.push({ vp: `${vp.width}x${vp.height}${hash}`, chars: cjk.length, fonts: fonts.length });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report));
writeFileSync(new URL("../pipeline/first-screen.txt", import.meta.url), [...all].join("") + "\n");
console.log(`首屏字 ${all.size} 个 → pipeline/first-screen.txt`);
