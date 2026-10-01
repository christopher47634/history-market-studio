import React from "react";
import { report } from "../v3/report.js";

export class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("History Market Studio render failure", error, info);
    report("render", error, { component: String(info?.componentStack ?? "").split("\n").slice(0, 4).join("\n").slice(0, 400) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="v3-shell v3-fail" role="alert">
        <b>页面出了点问题</b>
        <small>人物与事件数据不受影响，重新载入即可。问题已自动记录。</small>
        <button type="button" className="v3-share" onClick={() => location.reload()}>重新载入</button>
      </main>
    );
  }
}
