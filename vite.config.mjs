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

export default defineConfig({
  // 浏览器端用轻量索引 + 按人懒加载的 data.client.js；Node 端脚本和 API 服务仍直接用全量 data.js。
  resolve: {
    alias: [{ find: /^(\.{1,2}\/)data\.js$/, replacement: "$1data.client.js" }],
  },
  build: {
    outDir: "dist/client",
    chunkSizeWarningLimit: 500,
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
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [historyApiPlugin(), react()],
});
