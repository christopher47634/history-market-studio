// 阅读面板：固定下来的那个节点的完整说明——分数怎么来的、发生了什么、原文依据。
import { AnimatedNumber, BasisBadge } from "./bits.jsx";
import { nodeDetail } from "./detail.js";

export function Reader({ node, prev, next, onGo, onFocus, figures }) {
  if (!node) {
    return (
      <aside className="v3-reader v3-card is-empty" aria-live="polite">
        <p className="v3-eyebrow">阅读</p>
        <h2>点图上的任意节点</h2>
        <p className="v3-muted">这里会展开那一刻发生了什么、当时的势怎么算出来，以及能逐字核对的原文。</p>
      </aside>
    );
  }
  const d = nodeDetail(node);
  const tierPct = d.tierScore != null ? Math.min(100, d.tierScore) : null;
  return (
    <aside className="v3-reader v3-card" aria-live="polite" style={{ "--c": `var(--p${d.slot})` }}>
      <div className="v3-reader__body" key={`${node.id}`}>
        <p className="v3-eyebrow"><i className="v3-dot" />{d.person}<span>·</span>{d.when}{!d.certain && <span className="v3-tag">年份为估计</span>}<span className="v3-tag">{d.tag}</span></p>
        <h2 className="v3-reader__title">{d.title}</h2>

        <div className="v3-reader__score">
          <div>
            <small>{d.kind === "posthumous" ? "当时声望" : "当时的势"}</small>
            <strong><AnimatedNumber value={d.score} digits={d.score % 1 ? 1 : 0} /></strong>
          </div>
          {d.kind !== "sub" && d.kind !== "posthumous" && d.delta !== 0 && (
            <span className={`v3-delta ${d.delta > 0 ? "is-up" : "is-down"}`}>{d.delta > 0 ? "▲" : "▼"} {Math.abs(d.delta)}</span>
          )}
        </div>

        {tierPct != null && (
          <div className="v3-formula" aria-label={`${d.tier} ${d.tierScore} 减 ${d.crisis} ${d.penalty} 等于 ${d.score}`}>
            <div className="v3-formula__bar">
              <span className="v3-formula__tier" style={{ width: `${tierPct}%` }} />
              {d.penalty > 0 && <span className="v3-formula__cut" style={{ left: `${Math.max(0, tierPct - d.penalty)}%`, width: `${Math.min(d.penalty, tierPct)}%` }} />}
            </div>
            <p><b>{d.tier}</b> {d.tierScore}<span> − </span><b>{d.crisis}</b> {d.penalty}<span> = </span><b>{d.score}</b></p>
          </div>
        )}

        {d.summary && <p className="v3-reader__summary">{d.summary}</p>}
        {d.rationale && d.rationale !== d.summary && <p className="v3-reader__why"><span>为什么是这个分</span>{d.rationale}</p>}

        <figure className={`v3-quote${d.quote ? "" : " is-none"}`}>
          <BasisBadge basis={d.basis} />
          {d.quote ? (
            <>
              <blockquote>{d.quote.text}</blockquote>
              <figcaption>{d.quote.url ? <a href={d.quote.url} target="_blank" rel="noreferrer">{d.quote.source} ↗</a> : d.quote.source}</figcaption>
            </>
          ) : <p className="v3-muted">这一节点在来源里找不到能逐字对应的句子，内容是概括，不冒充原文。</p>}
        </figure>
      </div>

      <nav className="v3-reader__nav" aria-label="逐个翻看">
        <button type="button" disabled={!prev} onClick={() => onGo(prev)}><kbd>←</kbd><span>{prev ? prev.event?.title : "已是第一个"}</span></button>
        <button type="button" className="v3-reader__zoom" onClick={() => onFocus(node)} title="放大到这一刻">细读这一段</button>
        <button type="button" disabled={!next} onClick={() => onGo(next)}><span>{next ? next.event?.title : "已是最后一个"}</span><kbd>→</kbd></button>
      </nav>
    </aside>
  );
}
