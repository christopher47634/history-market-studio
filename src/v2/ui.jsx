// 两套主题共用的 v2 界面件：事件打分拆解、横轴切换、「当时 / 后世」读数。
import { formatYear } from "./model.js";

// 事件卡里的打分拆解：当时的势 = 档位分 − 危局折损，附打分理由和依据类型。
export function ScoreBreakdown({ event, tone = "jade" }) {
  if (!event) return null;
  const delta = Number(event.delta) || 0;
  const basis = event.evidence?.basis === "原文" ? "原文已逐字核验" : "无可核验原文，内容为概括";
  let head;
  if (event.posthumous) head = <><small>身后地位</small><b>{event.score}</b></>;
  else if (event.kind === "finale") head = <><small>终章 · 当时的势</small><b>{event.score}</b></>;
  else head = <><small>当时的势</small><b>{event.score}</b>{delta ? <em className={delta > 0 ? "is-up" : "is-down"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}</em> : null}</>;
  return (
    <section className={`v2-score v2-score--${tone}`} aria-label="打分拆解">
      <div className="v2-score__head">{head}</div>
      {event.tier && !event.posthumous && event.kind !== "finale" && (
        <div className="v2-score__formula">
          <span>{event.tier} {event.tierScore}</span>
          {event.crisisPenalty ? <span>− {event.crisis} {event.crisisPenalty}</span> : <span className="is-quiet">处境平稳</span>}
        </div>
      )}
      {event.rationale && <p className="v2-score__why">{event.posthumous ? "" : "为什么是这个分："}{event.rationale}</p>}
      <p className="v2-score__basis">{basis}</p>
    </section>
  );
}

// 纪年 / 年龄 横轴切换；两人生命不重叠时只能用年龄。
export function AxisToggle({ axis, canYear, onChange, tone = "jade" }) {
  return (
    <div className={`v2-axis v2-axis--${tone}`} role="group" aria-label="横轴">
      <button type="button" aria-pressed={axis === "year"} disabled={!canYear} title={canYear ? "按公元纪年对齐，看同一时刻谁领先" : "两人生命没有重叠，只能按年龄对齐"} onClick={() => onChange("year")}>纪年</button>
      <button type="button" aria-pressed={axis === "age"} onClick={() => onChange("age")}>年龄</button>
    </div>
  );
}

// 读数：有选中节点时显示该人物「当时的势」，否则显示「后世评价」。
export function Readout({ figure, color, active, tone = "jade" }) {
  if (!figure) return null;
  const mine = active && active.figure?.id === figure.id;
  const value = mine ? active.score : figure.legacy?.score;
  const label = mine ? (active.posthumous ? "身后地位" : "当时的势") : "后世评价";
  const detail = mine ? `${active.title} · ${formatYear(active.year)}` : figure.legacy ? `${figure.legacy.tier} · ${figure.legacy.label}` : "";
  return (
    <span className={`v2-read v2-read--${tone} ${mine ? "is-then" : ""}`} title={figure.legacy?.rationale}>
      <i style={{ background: color }} />
      <span className="v2-read__name">{figure.name}</span>
      <b>{value ?? "—"}</b>
      <span className="v2-read__meta"><small>{label}</small><em>{detail}</em></span>
    </span>
  );
}
