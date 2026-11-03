// 把图上的一个节点整理成阅读面板要显示的内容。
import { formatYear } from "../v2/model.js";

export function nodeDetail(n) {
  const f = n.figure;
  const e = n.event ?? {};
  const q = e.quote;
  const source = q ? (q.s !== undefined ? f.sources[q.s] : { label: q.source, url: q.url }) : null;
  const quote = q ? { text: q.t ?? q.textSimplified ?? q.text, source: source?.label ?? "", url: source?.url ?? "" } : null;
  const basis = quote ? (e.evidence === "百科" ? "百科" : "原文") : "概括";
  const base = {
    person: f.name, slot: n.slot, kind: n.kind, title: e.title ?? "", score: n.score, delta: n.delta,
    when: `${formatYear(n.year)}${n.year < 0 ? "" : "年"}${n.age != null && n.kind !== "posthumous" ? ` · ${n.age}岁` : ""}`,
    basis, quote, certain: e.yearCertainty !== "估计",
  };
  if (n.kind === "finale") {
    return { ...base, tag: "终章", summary: e.reason, rationale: `去世时保留生前最后一个阶段 ${Math.round(e.retention * 100)}% 的势（标准规定最多回撤 20%）。` };
  }
  if (n.kind === "posthumous") {
    const today = e.title === "今日评价";
    return { ...base, tag: today ? "后世评价" : "身后", summary: e.rationale, rationale: today ? `${f.legacy.tier} · ${f.legacy.label}。后世评价衡量历史分量，不等于褒扬；褒贬另见标签。` : "身后声望：衡量历史分量，不等于褒扬。", basis: "概括", quote: null };
  }
  return {
    ...base, tag: n.kind === "sub" ? "细节" : "阶段",
    summary: e.summary, rationale: e.rationale,
    tier: e.tier, tierScore: e.tierScore, crisis: e.crisis, penalty: e.crisisPenalty ?? 0,
  };
}
