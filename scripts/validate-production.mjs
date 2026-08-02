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

const app = await readFile(path.join(root, "src", "App.jsx"), "utf8");
const settings = await readFile(
  path.join(root, "src", "components", "SettingsPanel.jsx"),
  "utf8",
);
if (!app.includes("history-market-current-pair") || !app.includes("history.replaceState")) {
  fail("人物组合没有写入可分享链接与本地恢复状态");
}
if (!settings.includes("navigator.share") || !settings.includes("navigator.clipboard")) {
  fail("设置中心缺少原生分享与复制链接回退");
}

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
const total = built.reduce((sum, item) => sum + item.size, 0);
if (total > 3.2 * 1024 * 1024) fail("生产静态资源总量超过 3.2MB");
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
  `production validation passed: ${built.length} assets, ${(total / 1024 / 1024).toFixed(2)}MB total, shareable deep links and install metadata verified`,
);
