export const historyPeriods = [
  { id: "all", label: "全部", short: "全史", dynasties: [] },
  { id: "pre-qin", label: "先秦文明", short: "先秦", dynasties: ["先秦"] },
  {
    id: "early-empire",
    label: "秦汉魏晋",
    short: "秦汉魏晋",
    dynasties: ["秦汉", "三国", "魏晋南北朝"],
  },
  {
    id: "middle-empire",
    label: "隋唐宋元",
    short: "隋唐宋元",
    dynasties: ["隋唐", "五代十国", "宋", "辽金西夏", "元"],
  },
  { id: "late-empire", label: "明清时期", short: "明清", dynasties: ["明", "清"] },
  { id: "modern", label: "近现代", short: "近现代", dynasties: ["近现代"] },
];

export const figureDomains = [
  { id: "all", label: "全部领域" },
  { id: "政治治理", label: "政治治理" },
  { id: "军事战略", label: "军事战略" },
  { id: "社会变革", label: "社会变革" },
  { id: "思想学术", label: "思想学术" },
  { id: "文学艺术", label: "文学艺术" },
  { id: "科技实业", label: "科技实业" },
];

export const indexSorts = [
  { id: "chronology", label: "时代顺序" },
  { id: "events", label: "节点最多" },
  { id: "influence", label: "综合影响" },
  { id: "name", label: "姓名排序" },
];

const domainRules = [
  ["科技实业", /科学|技术|工程|数学|医学|农学|天文|地理|水利|造纸|纺织|历法|本草|地动仪|航天|核物理|气象|地质/],
  ["文学艺术", /诗|词|文学|小说|书法|绘画|戏曲|艺术|作家|文坛|创作|红楼梦|兰亭/],
  ["思想学术", /思想|学说|哲学|经学|史学|教育|讲学|译经|著述|学术|法家|儒|道家|墨家|心学/],
  ["社会变革", /革命|变法|改革|启蒙|女权|维新|民权|新文化|救亡/],
  ["军事战略", /将军|名将|统帅|军事|战争|北伐|抗金|抗倭|武圣|兵圣|战功|领军|军队/],
];

export function getPeriodForDynasty(dynasty) {
  return (
    historyPeriods.find(
      (period) => period.id !== "all" && period.dynasties.includes(dynasty),
    ) || historyPeriods[0]
  );
}

export function inferFigureDomain(figure) {
  if (figure.domain) return figure.domain;
  const searchable = [
    figure.name,
    figure.courtesy,
    figure.camp,
    figure.thesis,
    ...figure.events.flatMap((event) => [
      event.title,
      event.dimension,
      event.summary,
    ]),
  ].join(" ");
  const match = domainRules.find(([, pattern]) => pattern.test(searchable));
  if (match) return match[0];
  if (figure.metrics.command >= 90) return "军事战略";
  return "政治治理";
}

export function attachFigureIndex(figure) {
  const period = getPeriodForDynasty(figure.dynasty);
  return {
    ...figure,
    period: period.id,
    periodLabel: period.label,
    era: figure.era || figure.dynasty,
    domain: inferFigureDomain(figure),
  };
}

export function getDynastiesForPeriod(periodId, dynastyOrder) {
  if (periodId === "all") return dynastyOrder;
  return (
    historyPeriods.find((period) => period.id === periodId)?.dynasties || []
  );
}

export function getFigureSearchText(figure) {
  return [
    figure.name,
    figure.courtesy,
    figure.camp,
    figure.dynasty,
    figure.era,
    figure.periodLabel,
    figure.domain,
    figure.thesis,
    ...figure.events.flatMap((event) => [
      event.title,
      event.dimension,
      event.summary,
      event.source?.label,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

const influenceScore = (figure) =>
  Object.values(figure.metrics).reduce((sum, value) => sum + value, 0) / 4;

export function filterFigures(
  figures,
  {
    query = "",
    period = "all",
    dynasty = "全部",
    domain = "all",
    sort = "chronology",
    excludeId = "",
  } = {},
) {
  const terms = query
    .trim()
    .toLocaleLowerCase("zh-CN")
    .split(/\s+/)
    .filter(Boolean);
  const result = figures.filter((figure) => {
    if (figure.id === excludeId) return false;
    if (period !== "all" && figure.period !== period) return false;
    if (dynasty !== "全部" && figure.dynasty !== dynasty) return false;
    if (domain !== "all" && figure.domain !== domain) return false;
    if (!terms.length) return true;
    const searchable = getFigureSearchText(figure);
    return terms.every((term) => searchable.includes(term));
  });
  return result.sort((left, right) => {
    if (sort === "events")
      return right.events.length - left.events.length || left.born - right.born;
    if (sort === "influence")
      return influenceScore(right) - influenceScore(left) || left.born - right.born;
    if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
    return left.born - right.born || left.name.localeCompare(right.name, "zh-CN");
  });
}

export function getIndexStats(figures) {
  return {
    people: figures.length,
    events: figures.reduce((sum, figure) => sum + figure.events.length, 0),
    dynasties: new Set(figures.map((figure) => figure.dynasty)).size,
    domains: new Set(figures.map((figure) => figure.domain)).size,
  };
}
