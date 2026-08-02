import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import { HistoryDataProvider } from "./historyDataContext.jsx";
import "./styles.css";
import "./apple-polish.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HistoryDataProvider>
        <App />
      </HistoryDataProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
