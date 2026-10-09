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
const total = built.reduce((sum, item) => sum + item.size, 0);
if (total > 3.6 * 1024 * 1024) fail("生产静态资源总量超过 3.6MB");
// 角色头像在 dist/client/portraits，逐张懒加载，单独算：每张 ≤ 40KB，总量 ≤ 4MB。
const portraitDir = path.join(root, "dist", "client", "portraits");
const portraits = await Promise.all((await readdir(portraitDir)).map(async (name) => ({ name, size: (await stat(path.join(portraitDir, name))).size })));
if (portraits.length < 250) fail(`角色头像只有 ${portraits.length} 张，构建没有带上 public/portraits`);
if (portraits.some((item) => item.size > 40 * 1024)) fail("有角色头像超过 40KB，应先跑 pipeline/roles.py 压缩");
if (portraits.reduce((sum, item) => sum + item.size, 0) > 4 * 1024 * 1024) fail("角色头像总量超过 4MB");
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
  `production validation passed: ${built.length} assets, ${(total / 1024 / 1024).toFixed(2)}MB app + ${portraits.length} portraits, shareable deep links and install metadata verified`,
);
