import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./v3/App.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import "./v3/fonts.css";
import "./v3/era-fonts.css";
import "./v3/app.css";
import "./v3/material.css";
import "./v3/type.css";
import "./v3/chrome.css";
import "./v3/interact.css";
import { installReporter } from "./v3/report.js";
import { reloadIfStale } from "./v3/people.jsx";
import { installGlowScroll } from "./v3/glowscroll.js";
import { installPointer } from "./v3/pointer.js";
import { installLiquid } from "./v3/liquid.js";

// 按需分包下载失败时 Vite 会发 vite:preloadError。网络偶发失败交给各处自己的重试；
// 只有确认是旧页面跨了一次发布（线上首页已换成新版本）才自动刷新一次。
addEventListener("vite:preloadError", () => reloadIfStale());

installReporter();
installGlowScroll();
installPointer();
installLiquid();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
