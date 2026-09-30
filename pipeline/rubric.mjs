// v2 评分规则的代码版，和 docs/v2/scoring-standard.md 保持一致。
export const CAP = 98;
export const SOLE_100 = "maozedong";
export const capFor = (id) => (id === SOLE_100 ? 100 : CAP);

export const TIERS = {
  天下共主: [95, 98],
  一方之主: [85, 94],
  重臣主帅: [70, 84],
  方面名家: [55, 69],
  成名: [40, 54],
  初起: [25, 39],
  布衣: [8, 35], // 出生分按家世：皇族约 35，贵族官宦约 25，平民约 12，贫寒约 8
};

export const CRISIS = {
  平稳: [0, 0],
  受挫: [5, 15],
  大败: [20, 35],
  绝境: [40, 60],
};

export const LEGACY_TIERS = {
  文明塑造者: [95, 98],
  时代定义者: [85, 94],
  一代名家: [75, 84],
  重要人物: [60, 74],
  有影响: [45, 59],
  局部: [0, 44],
};

export const LABELS = ["正面", "争议", "负面"];
export const RETENTION = [0.8, 1];
export const GAP_YEARS = 15;

// 锚点：生前峰值、终章、后世评价，允许 ±2 的偏差。
export const ANCHORS = {
  maozedong: { peak: 100, finale: 95, legacy: 100 },
  qinst: { peak: 98, finale: 95, legacy: 98 },
  liubang: { peak: 97, finale: 93, legacy: 92 },
  xiangyu: { peak: 94, finale: 27, legacy: 82 },
  hanxin: { peak: 88, finale: 30, legacy: 85 },
  caocao: { peak: 93, finale: 90, legacy: 90 },
  zhugeliang: { peak: 88, finale: 80, legacy: 91 },
  lshimin: { peak: 98, finale: 97, legacy: 97 },
  wanganshi: { peak: 90, finale: 44, legacy: 85 },
  yuefei: { peak: 84, finale: 18, legacy: 88 },
  zhuyuanzhang: { peak: 98, finale: 95, legacy: 90 },
  zhangjuzheng: { peak: 93, finale: 90, legacy: 86 },
  confucius: { peak: 65, finale: 52, legacy: 98 },
  libai: { peak: 62, finale: 45, legacy: 93 },
  dufu: { peak: 45, finale: 27, legacy: 93 },
  sushi: { peak: 72, finale: 50, legacy: 94 },
};

export const eventScore = (event, id) => {
  const raw = event.tierScore - (event.crisisPenalty || 0);
  return Math.max(2, Math.min(capFor(id), Math.round(raw)));
};

// 给模型看的精简版评分标准。
export function rubricText() {
  const rows = (table) => Object.entries(table).map(([k, [a, b]]) => `${k} ${a}–${b}`).join("；");
  return [
    "【势】= 权位档分 − 危局折损，最低 2。只看当时处境，不看后人评价。",
    `权位档：${rows(TIERS)}。天下共主只给统一或主宰天下者，98 只给统一之主。文化、思想、科技人物按当世名望和官位落档：名满天下的文坛学派领袖为方面名家，有文名无大位为成名。`,
    `危局折损：${rows(CRISIS)}。受挫=贬官、小败、被排挤；大败=大败、失地、罢黜；绝境=被围、下狱、受刑、流放、亡命。`,
    "终章：死亡不归零。给出保留率 0.80–1.00，按制度、政策、作品、思想死后是否延续。",
    `【后世评价】历史分量，不是褒贬：${rows(LEGACY_TIERS)}。褒贬另给标签：正面、争议、负面。`,
    "【身后事件】分数是那个时间点上社会对此人的评价，不是提前套用今天的后世评价。刚去世时通常接近终章，除非当时就有追谥、举国哀悼等明确证据。",
    `除毛泽东（唯一 100）外，任何分数不超过 ${CAP}。`,
  ].join("\n");
}
