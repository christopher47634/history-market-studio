import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message) => {
  throw new Error(message);
};

const manifest = JSON.parse(
  await readFile(path.join(root, "public", "manifest.webmanifest"), "utf8"),
);
if (manifest.display !== "standalone" || !manifest.icons?.length) {
  fail("Web App Manifest 缺少独立显示模式或应用图标");
}

const app = await readFile(path.join(root, "src", "v3", "App.jsx"), "utf8");
if (!app.includes("history-market-current-pair") || !app.includes("history.replaceState")) {
  fail("人物组合没有写入可分享链接与本地恢复状态");
}
if (!app.includes("navigator.share") || !app.includes("navigator.clipboard")) {
  fail("缺少原生分享与复制链接回退");
}

// 首屏内联脚本改了以后，CSP 里的哈希要跟着改，否则线上主题脚本会被浏览器拦下。
const { createHash } = await import("node:crypto");
const html = await readFile(path.join(root, "dist", "client", "index.html"), "utf8");
const inlineHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `sha256-${createHash("sha256").update(m[1]).digest("base64")}`);
for (const file of ["vercel.json", path.join("worker", "index.js")]) {
  const text = await readFile(path.join(root, file), "utf8");
  for (const h of inlineHashes) if (!text.includes(h)) fail(`${file}: CSP 缺少首屏内联脚本的哈希 ${h}`);
}
if (!html.includes('class="sk"')) fail("index.html 缺少首屏骨架");
const vercel = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
if (vercel.outputDirectory !== "dist/client") fail("vercel.json 的输出目录不对");

const publicAssets = path.join(root, "public", "assets");
for (const name of await readdir(publicAssets)) {
  const file = path.join(publicAssets, name);
  const info = await stat(file);
  if (/\.(png|jpe?g)$/i.test(name) && info.size > 220 * 1024) {
    fail(`${name}: 上线目录仍含超过 220KB 的未优化位图`);
  }
}

const builtAssets = path.join(root, "dist", "client", "assets");
const built = await Promise.all(
  (await readdir(builtAssets)).map(async (name) => ({
    name,
    size: (await stat(path.join(builtAssets, name))).size,
  })),
);
// 预算：assets 里大部分是每人一个的按需数据分包，外加角色页的简介包（约 330KB，进角色页才加载）。
// 10-19 加了搜索词表（300 人的别名和代表事件，约 25KB），预算从 3.6MB 调到 3.7MB。
const total = built.reduce((sum, item) => sum + item.size, 0);
if (total > 3.7 * 1024 * 1024) fail("生产静态资源总量超过 3.7MB");
// 角色头像在 dist/client/portraits，逐张懒加载，单独算：每张 ≤ 40KB，总量 ≤ 4MB。
const portraitDir = path.join(root, "dist", "client", "portraits");
const portraits = await Promise.all((await readdir(portraitDir)).map(async (name) => ({ name, size: (await stat(path.join(portraitDir, name))).size })));
if (portraits.length < 250) fail(`角色头像只有 ${portraits.length} 张，构建没有带上 public/portraits`);
if (portraits.some((item) => item.size > 40 * 1024)) fail("有角色头像超过 40KB，应先跑 pipeline/roles.py 压缩");
if (portraits.reduce((sum, item) => sum + item.size, 0) > 4 * 1024 * 1024) fail("角色头像总量超过 4MB");
// 自托管字体在 dist/client/fonts：按 unicode-range 分片，浏览器只下载屏幕上出现的字所在的片。每片 ≤ 170KB，总量 ≤ 3.4MB（宋体、黑体各一套分片 + 西文），要带 OFL 许可。
const fontDir = path.join(root, "dist", "client", "fonts");
const fonts = await Promise.all((await readdir(fontDir)).map(async (name) => ({ name, size: (await stat(path.join(fontDir, name))).size })));
const woff = fonts.filter((f) => f.name.endsWith(".woff2"));
if (woff.length < 2 || !fonts.some((f) => f.name === "OFL.txt")) fail("自托管字体缺失或没带 OFL 许可文本，先跑 python pipeline/fonts.py");
if (woff.some((f) => f.size > 170 * 1024)) fail("有字体分片超过 170KB");
if (woff.reduce((s, f) => s + f.size, 0) > 3.4 * 1024 * 1024) fail("自托管字体总量超过 3.4MB");
// 朝代字体在 dist/client/fonts/era：同样按需分片，每片 ≤ 170KB，总量 ≤ 2MB，要带 OFL / IPA 许可和来源说明。
const eraDir = path.join(fontDir, "era");
const eraFiles = await Promise.all((await readdir(eraDir)).map(async (name) => ({ name, size: (await stat(path.join(eraDir, name))).size })));
const eraWoff = eraFiles.filter((f) => f.name.endsWith(".woff2"));
for (const lic of ["LICENSES.md", "OFL.txt", "IPA-LICENSE.md"]) if (!eraFiles.some((f) => f.name === lic)) fail(`朝代字体缺少 ${lic}`);
if (eraWoff.length < 6 || eraWoff.some((f) => f.size > 170 * 1024)) fail("朝代字体缺失或有分片超过 170KB");
if (eraWoff.reduce((s, f) => s + f.size, 0) > 2 * 1024 * 1024) fail("朝代字体总量超过 2MB");
woff.push(...eraWoff);
for (const item of built) {
  if (
    item.name.endsWith(".js") &&
    !item.name.startsWith("echarts-") &&
    item.size > 240 * 1024
  ) {
    fail(`${item.name}: 非图表脚本分包超过 240KB`);
  }
}

console.log(
  `production validation passed: ${built.length} assets, ${(total / 1024 / 1024).toFixed(2)}MB app + ${portraits.length} portraits + ${woff.length} font slices (${(woff.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)}MB), shareable deep links and install metadata verified`,
);
