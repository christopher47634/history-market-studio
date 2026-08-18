const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const deathTitlePattern =
  /人生终章|卒|死|崩|薨|逝|殁|遇害|被杀|自尽|赐死|病故|病逝|牺牲|去世|身亡|就义|圆寂|陨落|绝笔|失踪|自沉|自刎|处死|凌迟|车裂/;
const genericTerminalPattern = /人生终章|生命终章/;
const durablePattern =
  /长期|后世|传世|延续|沿用|继承|制度|体系|传统|经典|奠定|传播|复利|遗产|学说|著述|作品|书法|史学|科学|技术|工程|教育|法典|统一/;
const interruptedPattern =
  /崩解|覆灭|失败|被废|废除|中断|清算|瓦解|失传|倒台|动乱|败亡|骤减|坍塌|失去舞台|遭难/;
const violentPattern =
  /遇害|被杀|自尽|赐死|身亡|就义|自沉|自刎|处死|凌迟|车裂|兵败|覆灭/;
const illnessPattern = /病|疾|积劳|老|衰/;

const domainProfiles = {
  思想学术: {
    retention: 0.965,
    continuity: "思想传承",
    basis: "学说、教育与著述可以跨越个人生命继续传播",
  },
  文学艺术: {
    retention: 0.975,
    continuity: "作品传承",
    basis: "作品与审美传统在身后仍可持续积累影响",
  },
  科技实业: {
    retention: 0.955,
    continuity: "成果延续",
    basis: "技术、工程与实业成果不会随个人生命终止而消失",
  },
  政治治理: {
    retention: 0.92,
    continuity: "制度延续",
    basis: "制度与政策是否被继承决定身后影响的保留程度",
  },
  社会变革: {
    retention: 0.91,
    continuity: "理念延续",
    basis: "改革理念与组织成果会在身后继续接受现实检验",
  },
  军事战略: {
    retention: 0.895,
    continuity: "战略遗产",
    basis: "直接指挥权终止，但战法、组织与政治遗产仍会保留",
  },
};

// Only cases with a clear, durable historical continuity or a clear break are
// manually anchored. Every other figure is still evaluated by the same
// domain, narrative, posthumous-event and capability model.
const continuityOverrides = {
  guanzhong: {
    retention: 0.97,
    continuity: "制度延续",
    basis: "齐国在其卒后继续遵行既有政制，霸政仍具有现实延续性",
  },
  shangyang: {
    retention: 0.98,
    continuity: "制度延续",
    basis: "商鞅身死而秦法未废，改革成果继续塑造秦国",
  },
  qinshihuang: {
    retention: 0.95,
    continuity: "制度延续",
    basis: "郡县、文字与度量衡等制度跨越秦亡继续发挥作用",
  },
  qihuangong: {
    retention: 0.82,
    continuity: "霸业失序",
    basis: "霸业失去核心维系者后迅速出现继承与组织失序",
  },
  xiangyu: {
    retention: 0.8,
    continuity: "政权中断",
    basis: "军事集团在楚汉终局中瓦解，但人物与战争影响仍被保留",
  },
  hanxin: {
    retention: 0.92,
    continuity: "军事遗产",
    basis: "现实权位终止，统兵方法与军事声望仍形成长期影响",
  },
  wangmang: {
    retention: 0.8,
    continuity: "政策中断",
    basis: "新朝覆亡使主要改制失去现实执行载体",
  },
  caocao: {
    retention: 0.96,
    continuity: "政权承继",
    basis: "其组织、人才与制度由曹魏政权继续承接",
  },
  liubei: {
    retention: 0.9,
    continuity: "政权承继",
    basis: "蜀汉政权继续存在，但国力与战略空间受到明显约束",
  },
  sunquan: {
    retention: 0.86,
    continuity: "继承震荡",
    basis: "江东政权延续，但晚年继承问题削弱了制度稳定性",
  },
  lishimin: {
    retention: 0.96,
    continuity: "制度延续",
    basis: "贞观时期形成的治理框架与人才体系继续运行",
  },
  wuzetian: {
    retention: 0.88,
    continuity: "部分延续",
    basis: "政权名号被恢复为唐，但官僚与用人遗产部分延续",
  },
  zhaokuangyin: {
    retention: 0.97,
    continuity: "制度延续",
    basis: "宋初中央集权与文官治理结构被后继者长期沿用",
  },
  wanganshi: {
    retention: 0.82,
    continuity: "政策反复",
    basis: "新法在政治反复中大幅撤改，制度连续性较弱",
  },
  zhangjuzheng: {
    retention: 0.82,
    continuity: "身后清算",
    basis: "身后政治清算使改革体系与个人声望同步回撤",
  },
  zhuyuanzhang: {
    retention: 0.97,
    continuity: "制度延续",
    basis: "明初国家结构与皇权制度被后继王朝持续沿用",
  },
  yongzheng: {
    retention: 0.96,
    continuity: "政策延续",
    basis: "财政整顿与中枢制度由乾隆前期继续承接",
  },
  zhugeliang: {
    retention: 0.95,
    continuity: "制度传承",
    basis: "蜀汉治理秩序与忠勤政治象征在其身后继续发挥作用",
  },
  yuefei: {
    retention: 0.96,
    continuity: "声望传承",
    basis: "现实军权终止，但名誉恢复与忠烈叙事持续放大影响",
  },
  yuqian: {
    retention: 0.95,
    continuity: "声望传承",
    basis: "身后平反使其政治声望与历史评价持续回升",
  },
};

const metricAverage = (figure) => {
  const values = Object.values(figure.metrics || {}).filter(Number.isFinite);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 70;
};

function inferContinuity(figure, terminalEvent) {
  const base = domainProfiles[figure.domain] || domainProfiles.政治治理;
  const ability = metricAverage(figure);
  const posthumousEvents = figure.events.filter((event) => event.posthumous);
  const recentEvents = figure.events
    .filter((event) => !event.posthumous)
    .slice(-3);
  const narrative = [
    figure.thesis,
    ...recentEvents.flatMap((event) => [event.title, event.summary]),
    ...posthumousEvents.flatMap((event) => [event.title, event.summary]),
  ].join(" ");

  let retention = base.retention;
  const reasons = [base.basis];

  if (durablePattern.test(narrative)) {
    retention += 0.012;
    reasons.push("人物叙事中存在可持续的制度、作品或知识成果");
  }
  if (interruptedPattern.test(narrative)) {
    retention -= 0.045;
    reasons.push("末期叙事存在组织、政策或政权连续性受损");
  }
  if (posthumousEvents.length) {
    const posthumousAverage =
      posthumousEvents.reduce((sum, event) => sum + event.score, 0) /
      posthumousEvents.length;
    retention += posthumousAverage >= 60 ? 0.018 : -0.025;
    reasons.push(
      posthumousAverage >= 60
        ? "已记录的身后节点显示影响得到恢复或延续"
        : "已记录的身后节点显示影响受到清算或削弱",
    );
  }
  if (violentPattern.test(terminalEvent?.title || "")) {
    retention -= 0.02;
    reasons.push("终局具有暴力或政权中断特征");
  } else if (illnessPattern.test(terminalEvent?.title || "")) {
    retention -= 0.008;
    reasons.push("晚年疾病只影响末段行动能力");
  }

  // Capability affects persistence, but is intentionally bounded so it cannot
  // overwhelm the actual trajectory or the historical continuity evidence.
  retention += clamp(-0.015, 0.015, (ability - 72) / 1000);

  const override = continuityOverrides[figure.id];
  if (override) {
    return {
      ...override,
      ability: round(ability),
      inferred: false,
      reasons: [override.basis, `综合能力均值 ${round(ability)}`],
    };
  }

  return {
    retention: round(clamp(0.8, 0.99, retention), 3),
    continuity: base.continuity,
    basis: reasons[0],
    ability: round(ability),
    inferred: true,
    reasons: [...reasons, `综合能力均值 ${round(ability)}`],
  };
}

const withoutZeroLanguage = (summary = "") =>
  summary
    .replace(/个人(?:生命|势能|指数)?归零/g, "生前行动在此终止")
    .replace(/个人势能归零/g, "生前行动在此终止")
    .replace(/势能归零/g, "生前行动在此终止")
    .replace(/归零/g, "转入历史影响阶段")
    .trim();

function recomputeDeltas(events) {
  const sorted = [...events].sort(
    (left, right) =>
      left.year - right.year ||
      left.age - right.age ||
      Number(left.posthumous) - Number(right.posthumous),
  );
  return sorted.map((event, index) => ({
    ...event,
    delta: index ? round(event.score - sorted[index - 1].score) : 0,
  }));
}

export function attachLegacyAwareTerminal(figure) {
  let events = [...figure.events];
  const explicitDeath = events
    .filter(
      (event) =>
        !event.posthumous &&
        event.year === figure.died &&
        deathTitlePattern.test(event.title) &&
        !genericTerminalPattern.test(event.title),
    )
    .at(-1);
  const genericTerminal = events
    .filter(
      (event) =>
        !event.posthumous &&
        event.year === figure.died &&
        genericTerminalPattern.test(event.title),
    )
    .at(-1);

  const lifeEvents = events
    .filter((event) => !event.posthumous)
    .sort((left, right) => left.age - right.age || left.year - right.year);
  let terminalEvent =
    genericTerminal ||
    explicitDeath ||
    lifeEvents.findLast(
      (event) =>
        Math.abs(event.age - figure.lifeSpan) < 0.05 ||
        (event.year === figure.died && genericTerminalPattern.test(event.title)),
    );

  const isCuratedLegacyEndpoint =
    terminalEvent &&
    terminalEvent.score > 0 &&
    !deathTitlePattern.test(terminalEvent.title);

  if (!terminalEvent) {
    terminalEvent = {
      year: figure.died,
      age: figure.lifeSpan,
      phase: 100,
      title: "人生终章",
      score: 0,
      delta: 0,
      dimension: "终章",
      summary: "个人生命结束，生前行动转入历史影响阶段。",
      source: lifeEvents.at(-1)?.source,
      inferredTerminal: true,
      posthumous: false,
    };
    events.push(terminalEvent);
  }

  const priorCandidates = events
    .filter(
      (event) =>
        !event.posthumous &&
        event !== terminalEvent &&
        event.age <= terminalEvent.age &&
        event.score > 0,
    )
    .sort((left, right) => left.age - right.age || left.year - right.year);
  const previous = priorCandidates.at(-1);
  const profile = inferContinuity(
    { ...figure, events },
    explicitDeath || terminalEvent,
  );
  const priorScore = previous?.score || Math.max(1, profile.ability * 0.35);

  let score = terminalEvent.score;
  if (!isCuratedLegacyEndpoint || score <= 0) {
    score = round(priorScore * profile.retention);
  } else if (score < priorScore * 0.8) {
    score = round(priorScore * 0.8);
  }
  score = round(clamp(Math.max(1, priorScore * 0.8), 100, score));

  const actualRetention = round(score / priorScore, 3);
  const continuationNote =
    actualRetention > 1
      ? `${profile.basis}；量化终点相当于前一有效节点的${Math.round(
          actualRetention * 100,
        )}%。`
      : `${profile.basis}；量化终点保留前一有效节点的${Math.round(
          actualRetention * 100,
        )}%。`;
  const summaryBase =
    withoutZeroLanguage(terminalEvent.summary) ||
    "个人生命结束，生前行动转入历史影响阶段。";
  const normalizedTerminal = {
    ...terminalEvent,
    age: figure.lifeSpan,
    phase: 100,
    score,
    summary: `${summaryBase.replace(/。+$/, "")}。 ${continuationNote}`,
    evidence: terminalEvent.evidence || previous?.evidence || {
      status: "source-backed",
      sourceType: terminalEvent.source?.type || "primary",
      sourceScope: terminalEvent.source?.scope || "collection",
      dateCertainty: figure.dateCertainty || "traditional-chronology",
      scoreNature: "interpretive-model",
    },
    trajectory: {
      terminal: true,
      model: "legacy-retention-v1",
      retention: actualRetention,
      continuity: profile.continuity,
      basis: profile.basis,
      ability: profile.ability,
      inferred: profile.inferred,
      reasons: profile.reasons,
      priorScore,
    },
  };

  events = events.map((event) => {
    if (event === terminalEvent) return normalizedTerminal;
    if (explicitDeath && genericTerminal && event === explicitDeath) {
      return {
        ...event,
        score,
        summary: `${withoutZeroLanguage(event.summary).replace(
          /。+$/,
          "",
        )}。生前行动在此终止，历史影响转入延续评估。`,
        trajectory: {
          ...normalizedTerminal.trajectory,
          terminalStage: "death",
        },
      };
    }
    return event;
  });

  return {
    ...figure,
    events: recomputeDeltas(events),
    trajectoryModel: {
      version: "legacy-retention-v1",
      terminalFloor: 0.8,
      deathResetsToZero: false,
    },
  };
}

export function interpolateTrajectoryScore(events, age) {
  const sorted = [...events]
    .filter((event) => !event.posthumous)
    .sort((left, right) => left.age - right.age);
  if (age <= sorted[0].age) return sorted[0].score;
  if (age >= sorted.at(-1).age) return sorted.at(-1).score;

  const rightIndex = sorted.findIndex((event) => event.age >= age);
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];

  if (right.trajectory?.terminal) {
    const span = Math.max(0.01, right.age - left.age);
    const taperSpan = Math.min(3, Math.max(0.75, span * 0.16));
    const taperStart = right.age - taperSpan;
    if (age <= taperStart) return left.score;
    const ratio = clamp(0, 1, (age - taperStart) / taperSpan);
    const eased = ratio * ratio * (3 - 2 * ratio);
    return left.score + (right.score - left.score) * eased;
  }

  const ratio = (age - left.age) / (right.age - left.age || 1);
  return left.score + (right.score - left.score) * ratio;
}

export const terminalTrajectoryRules = {
  minimumRetention: 0.8,
  curatedLegacyMayRise: true,
  deathResetsToZero: false,
};
