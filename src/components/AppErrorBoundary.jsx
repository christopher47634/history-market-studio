import React from "react";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("History Market Studio render failure", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app-recovery" role="alert">
        <section>
          <WarningCircle weight="duotone" />
          <small>历史行情局 · 安全恢复</small>
          <h1>界面刚刚走神了</h1>
          <p>人物与事件数据仍然安全。重新载入即可回到刚才的研究界面。</p>
          <button type="button" onClick={() => location.reload()}>
            <ArrowClockwise />重新载入
          </button>
        </section>
      </main>
    );
  }
}
