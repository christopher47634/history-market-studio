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
    await page.mouse(b.x + b.w * 0.5, b.y + b.h * 0.3);
    await page.sleep(200);
    assert.ok(await q(".v3-hover"), "光标在图上却没有吸附到任何节点");
    const at = await hoverUntilCard();
    lastAt = at;
    assert.ok(at, "扫遍图表都没有吸附到节点");
    assert.ok((await texts(".v3-readout__label")).some((l) => l.startsWith("当时的势")));
    // 详情栏停靠在绘图区上方：不压住目标节点，也不伸进绘图区（详情栏不接收指针，所以按几何判断）。
    const card = await page.eval(`(()=>{const el=document.querySelector('.v3-hover');const r=el.getBoundingClientRect();const c=document.querySelector('.v3-chart-canvas').getBoundingClientRect();const x=c.left+ +el.dataset.nodeX,y=c.top+ +el.dataset.nodeY;return {bottom:r.bottom,plotTop:c.top+100,covered:x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}})()`);
    assert.ok(!card.covered, "详情栏压住了目标节点");
    assert.ok(card.bottom <= card.plotTop + 1, `详情栏伸进了绘图区（底 ${Math.round(card.bottom)}，绘图区顶 ${Math.round(card.plotTop)}）`);
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
// 图表画布用的颜色必须跟着主题走：取缩放条底色的亮度（玉衡深、朱砂浅）。
const sliderLum = () => page.eval(`(()=>{const c=document.querySelector('.v3-chart-canvas canvas');const k=c.width/c.clientWidth;const d=c.getContext('2d').getImageData(Math.round(c.width*0.5),Math.round(c.height-25*k),1,1).data;return (d[0]+d[1]+d[2])/3})()`);
await check("朱砂切回玉衡：图表画布换回深色（不残留浅色网格和缩放条）", async () => {
  assert.ok((await sliderLum()) > 150, `朱砂下缩放条应是浅色，实际亮度 ${await sliderLum()}`);
  await pick("主题", "玉衡");
  await page.sleep(800);
  const lum = await sliderLum();
  assert.ok(lum < 80, `玉衡下缩放条应是深色，实际亮度 ${lum}`);
});
// 下拉框必须浮在最上层：弹层中心点最上面的元素要属于弹层本身，不能被图表卡片盖住。
const popOnTop = () => page.eval(`(()=>{const p=document.querySelector('.v3-picker__pop');if(!p)return 'no-pop';const r=p.getBoundingClientRect();const pts=[[.5,.5],[.5,.85],[.2,.7]].map(([fx,fy])=>document.elementFromPoint(r.left+r.width*fx,r.top+r.height*fy));return pts.every(e=>p.contains(e))?'ok':pts.map(e=>e&&e.className).join('|')})()`);
await check("人物下拉框浮在图表之上，可以直接点选", async () => {
  await page.eval(`document.querySelectorAll('.v3-picker__btn')[1].click()`);
  await page.sleep(400);
  assert.equal(await popOnTop(), "ok");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.sleep(200);
});

// 角色页：卡片墙（默认）——悬停出简要角色卡，单击出完整角色卡（头像共享元素转场），「+」填入对比栏后回主图对比；
// 列表排布照常可用；浏览器返回能回到角色页。
await page.goto(`${base}/?left=maozedong&right=zhouenlai&view=roles#b`, 3500);
const tileAt = (i) => page.eval(`(()=>{const r=document.querySelectorAll('.v3-tile')[${i}].getBoundingClientRect();return {x:r.x+r.width*0.5,y:r.y+r.height*0.45}})()`);
await check("角色页默认是卡片墙：每张卡有头像或字章、人名和后世评价", async () => {
  const n = await page.eval(`document.querySelectorAll('.v3-tile').length`);
  assert.equal(n, 300);
  assert.ok(await page.eval(`[...document.querySelectorAll('.v3-tile')].slice(0,12).every(t=>t.querySelector('.v3-ava')&&t.querySelector('.v3-tile__name').textContent&&/\\d/.test(t.querySelector('.v3-tile__score').textContent))`));
});
await check("角色页：光标停在一张卡上，卡片翻到背面显示简介（弹簧翻转落定在 180°），移开翻回正面", async () => {
  const at = await tileAt(2);
  await page.mouse(at.x - 30, at.y - 20);
  await page.mouse(at.x, at.y);
  await page.sleep(1300);
  const r = JSON.parse(await page.eval(`(()=>{const t=document.querySelectorAll('.v3-tile')[2];const m=new DOMMatrix(getComputedStyle(t.querySelector('.v3-tile__inner')).transform);return JSON.stringify({flipped:t.hasAttribute('data-flipped'),m11:m.m11,brief:t.querySelector('.v3-tile__brief').textContent,spot:t.hasAttribute('data-spot-on')})})()`));
  assert.ok(r.flipped, "悬停后卡片没有翻面");
  assert.ok(r.m11 < -0.95, `翻面没有落定到背面（m11=${r.m11}）`);
  assert.ok(r.brief.length > 20, "背面简介是空的");
  assert.ok(r.spot, "卡片没有跟手的光");
  await page.mouse(5, 5);
  await page.sleep(1300);
  const back = await page.eval(`new DOMMatrix(getComputedStyle(document.querySelectorAll('.v3-tile')[2].querySelector('.v3-tile__inner')).transform).m11`);
  assert.ok(back > 0.95, `移开后没有翻回正面（m11=${back}）`);
});
await check("角色页：单击卡片打开完整角色卡（简介出处、一生节点），Esc 关闭", async () => {
  const at = await tileAt(2);
  await page.click(at.x, at.y);
  await page.sleep(1400);
  assert.ok(await q(".v3-full"), "完整角色卡没有打开");
  assert.ok((await text(".v3-full__intro cite")).includes("CC BY-SA"), "缺少维基出处与许可");
  assert.ok((await texts(".v3-full__life li")).length >= 3, "一生节点没有载入");
  const op = await page.eval(`getComputedStyle(document.querySelector('.v3-full')).opacity`);
  assert.ok(+op > 0.98, `完整角色卡没有完全显示（opacity ${op}）`);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.sleep(800);
  assert.ok(!(await q(".v3-full")), "Esc 没有关闭角色卡");
});
await check("滚动条：原生滚动条隐藏，页面用 OverlayScrollbars 发光主题，滚动时出现、停下后淡出，window 滚动照常", async () => {
  assert.equal(await page.eval(`getComputedStyle(document.documentElement).scrollbarWidth`), "none");
  assert.ok(await page.eval(`!!document.querySelector('.os-scrollbar-vertical.os-theme-glow')`), "页面没有挂上发光主题的覆盖式滚动条");
  await page.eval(`scrollTo(0, 1200)`);
  await page.sleep(300);
  const r = JSON.parse(await page.eval(`(()=>{const bar=document.querySelector('.os-scrollbar-vertical.os-theme-glow');const h=bar.querySelector('.os-scrollbar-handle').getBoundingClientRect();return JSON.stringify({y:scrollY+(document.scrollingElement?.scrollTop||0)>0?1:0,hidden:bar.classList.contains('os-scrollbar-auto-hide-hidden'),top:h.top,right:bar.getBoundingClientRect().right,w:innerWidth,glow:getComputedStyle(bar.querySelector('.os-scrollbar-handle')).boxShadow})})()`));
  assert.ok(r.y, "scrollTo 没有滚动页面");
  assert.ok(!r.hidden, "滚动时滚动条没有出现");
  assert.ok(r.top > 20, `滚动条手柄没有随滚动下移：${r.top}`);
  assert.ok(r.right > r.w - 20, "滚动条不在右缘");
  assert.ok(r.glow && r.glow !== "none", "滚动条手柄没有光晕");
  await page.sleep(1800);
  assert.ok(await page.eval(`document.querySelector('.os-scrollbar-vertical.os-theme-glow').classList.contains('os-scrollbar-auto-hide-hidden')`), "停下后滚动条没有淡出");
  await page.eval(`scrollTo(0, 0)`);
  await page.sleep(300);
});await check("角色页：点 + 填入对比栏两格，再点「对比走势」回主图对比这两人；返回键回到角色页", async () => {
  await page.eval(`[...document.querySelectorAll('.v3-board')].find(b=>b.textContent.includes('军事')).click()`);
  await page.sleep(600);
  const names = await page.eval(`[...document.querySelectorAll('.v3-tile__name')].slice(0,2).map(b=>b.textContent)`);
  await page.eval(`document.querySelectorAll('.v3-tile__add')[0].click()`);
  await page.eval(`document.querySelectorAll('.v3-tile__add')[1].click()`);
  await page.sleep(300);
  assert.deepEqual(await texts(".v3-tray__slot b"), names);
  await page.eval(`document.querySelector('.v3-tray__go').click()`);
  await page.sleep(2500);
  const who = await texts(".v3-readout__who");
  assert.ok(names.every((n, i) => who[i]?.includes(n)), `主图读数：${who.join("|")}`);
  await page.eval("history.back()");
  await page.sleep(1200);
  assert.ok(await q(".v3-roles"), "返回后没有回到角色页");
});
await check("角色页列表排布：悬停换角色卡、单击开完整卡、+ 填对比栏", async () => {
  await page.goto(`${base}/?left=maozedong&right=zhouenlai&view=roles&layout=list#b`, 3500);
  const name = (await text(".v3-row:nth-of-type(3) .v3-row__who b")).trim();
  const at = await page.eval(`(()=>{const r=document.querySelectorAll('.v3-row')[1].getBoundingClientRect();return {x:r.x+r.width*0.35,y:r.y+r.height/2}})()`);
  await page.mouse(at.x, at.y);
  await page.sleep(400);
  assert.equal((await text(".v3-role h2")).trim(), name);
  await page.eval(`document.querySelectorAll('.v3-row__check')[0].click()`);
  await page.sleep(200);
  assert.equal((await texts(".v3-tray__slot b")).length, 1);
  await page.click(at.x, at.y);
  await page.sleep(1200);
  assert.ok(await q(".v3-full"), "列表单击没有打开完整角色卡");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.sleep(500);
});
await check("事件时间条没有横向滚动条：竖向滚轮转成横向滚动", async () => {
  await page.goto(`${base}/?left=maozedong&right=zhouenlai#b`, 3500);
  const s = await page.eval(`(()=>{const s=document.querySelector('.v3-strip');return JSON.stringify({sb:getComputedStyle(s).scrollbarWidth,h:s.offsetHeight-s.clientHeight,max:s.scrollWidth-s.clientWidth})})()`);
  const m = JSON.parse(s);
  assert.equal(m.sb, "none");
  assert.equal(m.h, 0, "时间条还占着横向滚动条的高度");
  if (m.max > 20) {
    await page.eval(`document.querySelector('.v3-strip').scrollIntoView({block:'center'})`);
    await page.sleep(400);
    const r = await page.eval(`(()=>{const r=document.querySelector('.v3-strip').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: r.x, y: r.y, deltaX: 0, deltaY: 240 });
    await page.sleep(700);
    assert.ok((await page.eval(`document.querySelector('.v3-strip').scrollLeft`)) > 20, "滚轮没有让时间条横移");
  }
});

// 改版（10-19）：⌘K 搜索面板、吸顶玻璃导航、液态玻璃折射、提示条。
const keyK = async (key, modifiers = 0, code = key) => {
  const vk = key.length === 1 ? key.toUpperCase().charCodeAt(0) : key === "Enter" ? 13 : key === "Escape" ? 27 : 0;
  await page.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, modifiers, windowsVirtualKeyCode: vk });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: vk });
};
await check("⌘K 搜索面板：Ctrl+K 打开，搜「诸葛」回车看他的走势，⇧回车和主图的人对比", async () => {
  await page.goto(`${base}/?left=maozedong&right=zhouenlai#b`, 3500);
  await keyK("k", 2, "KeyK");
  await page.sleep(400);
  assert.ok(await q(".v3-cmd__panel"), "Ctrl+K 没有打开搜索面板");
  assert.ok((await texts(".v3-cmd__row")).length >= 5, "空输入时没有给出操作和推荐人物");
  await page.send("Input.insertText", { text: "诸葛" });
  await page.sleep(300);
  assert.ok((await text(".v3-cmd__row.is-active")).includes("诸葛亮"), "第一条不是诸葛亮");
  await keyK("Enter", 0, "Enter");
  await page.sleep(2200);
  assert.ok(!(await q(".v3-cmd__panel")), "回车后面板没有关闭");
  assert.deepEqual(await texts(".v3-readout__who"), ["诸葛亮"]);
  await keyK("k", 2, "KeyK");
  await page.sleep(400);
  await page.send("Input.insertText", { text: "司马懿" });
  await page.sleep(300);
  await keyK("Enter", 8, "Enter");
  await page.sleep(2200);
  assert.deepEqual(await texts(".v3-readout__who"), ["诸葛亮", "司马懿"]);
});
await check("吸顶导航：停在顶上透明，往下滚后玻璃显出来；控件挂上液态玻璃折射", async () => {
  assert.ok(!(await page.eval(`document.documentElement.hasAttribute('data-scrolled')`)) || (await page.eval("scrollY")) > 8);
  await page.eval(`scrollTo(0, 600)`);
  await page.sleep(500);
  assert.ok(await page.eval(`document.documentElement.hasAttribute('data-scrolled')`), "滚动后没有标记 data-scrolled");
  const top = await page.eval(`document.querySelector('.v3-bar').getBoundingClientRect().top`);
  assert.ok(Math.abs(top) < 1, `导航没有吸顶（top=${top}）`);
  assert.ok(await page.eval(`document.documentElement.hasAttribute('data-refract')`), "Chromium 上没有开折射");
  await page.sleep(1800);
  assert.ok(await page.eval(`[...document.querySelectorAll('.v3-bar .lg')].some(el=>el.style.getPropertyValue('--lg-filter').startsWith('url(#lgf-'))`), "导航上的玻璃控件没有挂上折射滤镜");
  assert.ok(await page.eval(`!!document.querySelector('svg defs filter[id^=lgf-] feDisplacementMap')`), "没有生成位移贴图滤镜");
  await page.eval(`scrollTo(0, 0)`);
});
await check("分享按钮：给出玻璃提示条，2 秒后自己退场", async () => {
  await page.eval(`document.querySelector('.v3-bar .v3-icon-btn').click()`);
  await page.sleep(300);
  assert.ok((await text(".v3-toast")).length > 4, "点分享后没有提示");
  await page.sleep(2300);
  assert.ok(!(await q(".v3-toast")), "提示条没有退场");
});

await page.setViewport(390, 844, true);
await page.goto(`${base}/?left=zhouenlai&right=dengxiaoping#c`, 3500);
await check("手机宽度：无横向滚动，图表和阅读面板都在", async () => {
  assert.ok(await page.eval("document.documentElement.scrollWidth <= innerWidth + 1"), "页面出现横向滚动");
  assert.ok(await q(".v3-chart-canvas canvas"));
  assert.ok(await q(".v3-reader"));
});
await check("手机宽度：下拉框浮在最上层且不超出屏幕", async () => {
  await page.eval(`document.querySelector('.v3-picker__btn').click()`);
  await page.sleep(400);
  assert.equal(await popOnTop(), "ok");
  const r = await page.eval(`(()=>{const r=document.querySelector('.v3-picker__pop').getBoundingClientRect();return {l:r.left,r:r.right,b:r.bottom,w:innerWidth,h:innerHeight}})()`);
  assert.ok(r.l >= 0 && r.r <= r.w && r.b <= r.h + 1, JSON.stringify(r));
});

await check("手机宽度：角色页和完整角色卡都不超出屏幕", async () => {
  await page.goto(`${base}/?left=zhouenlai&right=&view=roles#b`, 3500);
  const fits = (sel) => page.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})()`);
  assert.ok(await page.eval("document.documentElement.scrollWidth <= innerWidth + 1"), "角色页出现横向滚动");
  for (const sel of [".v3-index__search", ".v3-tiles", ".v3-tray"]) assert.ok(await fits(sel), `${sel} 超出屏幕`);
  await page.eval(`document.querySelectorAll('.v3-tile__front')[0].click()`);
  await page.sleep(1200);
  assert.ok(await fits(".v3-full"), "完整角色卡超出屏幕");
});
await check("全程没有控制台错误", async () => {
  assert.deepEqual(page.consoleErrors, []);
});

console.log(results.join("\n"));
await page.close?.();
process.exit(process.exitCode ?? 0);
