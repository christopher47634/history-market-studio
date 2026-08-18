import { getSubjectReference, sourceRegistry } from "./sourceRegistry.js";

const palette = [
  "#bd5b4d",
  "#3f8276",
  "#ad7747",
  "#587a94",
  "#84624d",
  "#526f63",
  "#8a5368",
  "#696d9b",
];

const hash = (text) =>
  [...text].reduce(
    (sum, char) => ((sum * 33) ^ char.charCodeAt(0)) >>> 0,
    5381,
  );

export const milestone = (year, title, score, dimension, summary) => ({
  year,
  title,
  score,
  dimension,
  summary,
});

export function canonicalFigure({
  id,
  name,
  courtesy,
  camp,
  dynasty,
  domain,
  born,
  died,
  birthplace,
  thesis,
  milestones,
  sourceKey,
  dateCertainty = "documented",
  dateNote = "",
}) {
  const source = sourceRegistry[sourceKey];
  if (!source) throw new Error(`${name}: 未登记史料来源 ${sourceKey}`);
  const seed = hash(id);
  const raw = [
    milestone(
      born,
      `生于${birthplace || camp}`,
      24,
      "出身",
      `进入${dynasty}历史语境中的人生起点；生卒纪年按通行史籍整理。`,
    ),
    ...milestones,
    milestone(
      died,
      "人生终章",
      0,
      "终局",
      "生命结束；终章势能由生前能力与制度、作品、思想或政权的身后延续性另行计算。",
    ),
  ];
  const events = raw
    .sort((left, right) => left.year - right.year)
    .map((event, index, sorted) => ({
      ...event,
      phase: +Math.max(
        0,
        Math.min(100, ((event.year - born) / (died - born)) * 100),
      ).toFixed(1),
      delta: index ? event.score - sorted[index - 1].score : 0,
      source,
      evidence: {
        status: "source-backed",
        sourceType: source.type,
        sourceScope: source.scope,
        dateCertainty,
      },
    }));

  return {
    id,
    name,
    courtesy,
    camp,
    dynasty,
    domain,
    born,
    died,
    thesis,
    dateCertainty,
    dateNote,
    events,
    sources: [source, getSubjectReference(name)],
    color: palette[seed % palette.length],
    metrics: { alliance: 50, command: 50, legitimacy: 50, resilience: 50 },
    provenance: {
      model: "source-backed-catalog-v1",
      reviewStatus: "chronology-reviewed",
      scoreNature: "interpretive-model",
      historicalFacts: "source-indexed",
    },
  };
}
