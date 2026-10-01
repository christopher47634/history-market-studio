import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./v3/App.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import "./v3/app.css";
import { installReporter } from "./v3/report.js";

installReporter();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
