// 前端报错上报：脚本错误、未处理的 Promise 拒绝和渲染崩溃发到 /api/report，
// 服务端只写运行日志（不接第三方服务）。只发错误信息、堆栈前几行、页面路径和浏览器标识，不含任何个人数据。
const MAX_PER_PAGE = 5;
let sent = 0;
const seen = new Set();

export function report(kind, error, extra = {}) {
  if (sent >= MAX_PER_PAGE || import.meta.env.DEV) return;
  const message = String(error?.message ?? error ?? "unknown").slice(0, 300);
  const key = `${kind}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({
    kind, message,
    stack: String(error?.stack ?? "").split("\n").slice(0, 6).join("\n").slice(0, 1200),
    page: location.pathname + location.search + location.hash,
    ua: navigator.userAgent.slice(0, 200),
    at: new Date().toISOString(),
    ...extra,
  });
  try {
    if (!navigator.sendBeacon?.("/api/report", new Blob([body], { type: "application/json" }))) {
      fetch("/api/report", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {}
}

export function installReporter() {
  addEventListener("error", (e) => report("error", e.error ?? e.message, { source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined }));
  addEventListener("unhandledrejection", (e) => report("rejection", e.reason));
}
