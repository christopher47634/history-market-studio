import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleHistoryApi } from "./src/server/historyApi.js";

const historyApiPlugin = () => ({
  name: "history-api",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(`http://${req.headers.host || "127.0.0.1"}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
      });
      const response = await handleHistoryApi(request);
      if (!response) return next();
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    });
  },
});

// 首屏默认显示 毛泽东 × 周恩来（见 src/v3/App.jsx 的 initialIds）。这两人的数据和角色包原本要等主程序跑完才开始请求，
// 构建时把它们的带哈希文件名写进 HTML 预加载，和 JS 并行下载，走势图不再干等网络。
const FIRST_SCREEN = ["maozedong", "zhouenlai"];
const firstScreenPreload = () => ({
  name: "first-screen-preload",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const files = Object.keys(ctx.bundle ?? {});
      const tags = [];
      for (const id of FIRST_SCREEN) {
        const file = files.find((f) => new RegExp(`^assets/${id}-[\\w-]+\\.json$`).test(f));
        if (file) tags.push({ tag: "link", attrs: { rel: "preload", href: `/${file}`, as: "fetch", crossorigin: "" }, injectTo: "head" });
      }
      const roles = files.find((f) => /^assets\/roles\.generated-[\w-]+\.js$/.test(f));
      if (roles) tags.push({ tag: "link", attrs: { rel: "modulepreload", href: `/${roles}`, crossorigin: "" }, injectTo: "head" });
      return tags;
    },
  },
});

export default defineConfig({
  // 浏览器端用轻量索引 + 按人懒加载的 data.client.js；Node 端脚本和 API 服务仍直接用全量 data.js。
  resolve: {
    alias: [{ find: /^(\.{1,2}\/)data\.js$/, replacement: "$1data.client.js" }],
  },
  build: {
    outDir: "dist/client",
    // 显式目标：旧版 iOS Safari 也能解析（esbuild 只转语法、不补方法，方法调用已在源码里改成兼容写法）。
    target: ["es2020", "safari14"],
    chunkSizeWarningLimit: 500,
    // 每人一个的 JSON 必须是独立文件：小于 4KB 的资源 Vite 默认内联成 data: 地址，而网站的内容安全策略不允许 fetch data:，那几个人会加载失败。
    assetsInlineLimit: (file) => (file.endsWith(".json") ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          if (/\/src\/(data\.client|figureIndex|marketEngine)\.js$/.test(normalized) || normalized.endsWith("/src/v2/index.generated.js")) return "history-data";
          if (!normalized.includes("/node_modules/")) return undefined;
          if (normalized.includes("/echarts/") || normalized.includes("/zrender/")) return "echarts";
          if (normalized.includes("/@phosphor-icons/")) return "icons";
          if (normalized.includes("/motion/") || normalized.includes("/framer-motion/")) return "motion";
          if (normalized.includes("/react/") || normalized.includes("/react-dom/") || normalized.includes("/scheduler/")) return "react-vendor";
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    // 默认只监听本机；需要局域网/手机访问时设 VITE_HOST=0.0.0.0。
    host: process.env.VITE_HOST || "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [historyApiPlugin(), react(), firstScreenPreload()],
});
