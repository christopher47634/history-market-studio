import { getSubjectReference } from "./catalogs/sourceRegistry.js";

const clamp = (value, min = 18, max = 98) =>
  +Math.max(min, Math.min(max, value)).toFixed(1);

const dimensionPatterns = {
  alliance: /联盟|外交|组织|人才|协同|结盟|用人|声望|民心|教育/,
  command: /军事|战果|战损|战略|指挥|统帅|军政|征战|生存/,
  legitimacy: /合法性|继承|权位|治理|制度|改革|法制|政权|政策/,
};

const domainBias = {
  政治治理: { alliance: 5, command: 0, legitimacy: 10 },
  军事战略: { alliance: 1, command: 12, legitimacy: 0 },
  社会变革: { alliance: 2, command: 0, legitimacy: 7 },
  思想学术: { alliance: 4, command: -8, legitimacy: 2 },
  文学艺术: { alliance: 2, command: -10, legitimacy: 0 },
  科技实业: { alliance: 3, command: -5, legitimacy: 3 },
};

const weightedSignal = (events, pattern, fallback, bias = 0) => {
  const matched = events.filter((event) =>
    pattern.test(`${event.dimension} ${event.title} ${event.summary}`),
  );
  if (!matched.length) return clamp(fallback + bias);
  const mean = matched.reduce((sum, event) => sum + event.score, 0) / matched.length;
  const peak = Math.max(...matched.map((event) => event.score));
  return clamp(mean * 0.58 + peak * 0.42 + bias);
};

function evidenceBasedMetrics(figure) {
  const events = figure.events.filter((event) => !event.trajectory?.terminal);
  const scores = events.map((event) => event.score);
  const average = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
  const peak = Math.max(...scores, 24);
  const overall = average * 0.48 + peak * 0.52;
  const bias = domainBias[figure.domain] || {};
  const recovery = events.reduce((sum, event, index) => {
    if (!index) return sum;
    return sum + Math.max(0, event.score - events[index - 1].score);
  }, 0);
  const largestLoss = events.reduce((loss, event, index) => {
    if (!index) return loss;
    return Math.max(loss, events[index - 1].score - event.score);
  }, 0);
  const survivalSignals = events.filter((event) =>
    /生存|韧性|复起|归来|再起|恢复|重建|坚持/.test(
      `${event.dimension} ${event.title} ${event.summary}`,
    ),
  ).length;
  const resilience = clamp(
    42 + recovery * 0.28 - largestLoss * 0.08 + survivalSignals * 4.5,
  );

  return {
    alliance: weightedSignal(
      events,
      dimensionPatterns.alliance,
      overall,
      bias.alliance || 0,
    ),
    command: weightedSignal(
      events,
      dimensionPatterns.command,
      overall,
      bias.command || 0,
    ),
    legitimacy: weightedSignal(
      events,
      dimensionPatterns.legitimacy,
      overall,
      bias.legitimacy || 0,
    ),
    resilience,
  };
}

const sourceType = (source) => {
  if (source?.type) return source.type;
  if (/科学院|工程院|政府|人民网|纪念馆/.test(source?.label || ""))
    return "institutional";
  return "primary";
};

export function attachDataQuality(figure) {
  const uniqueSources = new Map();
  for (const source of figure.sources || figure.events.map((event) => event.source)) {
    if (!source?.url || uniqueSources.has(source.url)) continue;
    uniqueSources.set(source.url, {
      ...source,
      type: sourceType(source),
      scope: source.scope || "collection",
    });
  }
  const subject = getSubjectReference(figure.name);
  if (!uniqueSources.has(subject.url)) uniqueSources.set(subject.url, subject);
  const sources = [...uniqueSources.values()];
  const metrics = evidenceBasedMetrics(figure);
  const dateCertainty = figure.dateCertainty || "traditional-chronology";
  const events = figure.events.map((event) => ({
    ...event,
    source: {
      ...event.source,
      type: sourceType(event.source),
      scope: event.source?.scope || "collection",
    },
    evidence: {
      status: "source-backed",
      sourceType: sourceType(event.source),
      sourceScope: event.source?.scope || "collection",
      dateCertainty,
      scoreNature: "interpretive-model",
      ...(event.evidence || {}),
    },
  }));

  return {
    ...figure,
    metrics,
    events,
    sources,
    dateCertainty,
    provenance: {
      model: "source-backed-catalog-v1",
      reviewStatus: figure.provenance?.reviewStatus || "catalogued",
      sourceCount: sources.length,
      scoreNature: "interpretive-model",
      historicalFacts: "source-indexed",
      ...(figure.provenance || {}),
    },
  };
}
