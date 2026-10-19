import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./v3/App.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import "./v3/fonts.css";
import "./v3/app.css";
import "./v3/material.css";
import "./v3/type.css";
import { installReporter } from "./v3/report.js";
import { installGlowScroll } from "./v3/glowscroll.js";
import { installPointer } from "./v3/pointer.js";

installReporter();
installGlowScroll();
installPointer();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
