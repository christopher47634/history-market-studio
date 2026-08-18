const certaintyLabels = {
  estimated: "约年纪年",
  "traditional-chronology": "通行纪年",
  exact: "明确纪年",
};

const scopeLabels = {
  volume: "篇章级史料",
  article: "篇章级史料",
  biography: "人物纪传",
  subject: "人物专页",
  collection: "史书总目",
};

export function getEvidencePresentation(event) {
  const type = event?.source?.type || event?.evidence?.sourceType || "primary";
  const scope = event?.source?.scope || event?.evidence?.sourceScope || "collection";
  const certainty = event?.evidence?.dateCertainty || "traditional-chronology";
  return {
    sourceKind:
      type === "institutional"
        ? "机构资料"
        : type === "secondary"
          ? "辅助校对"
          : "原始史料",
    sourceDepth: scopeLabels[scope] || "史料索引",
    chronology: certaintyLabels[certainty] || "通行纪年",
    modelLabel:
      event?.evidence?.scoreNature === "interpretive-model"
        ? "解释模型"
        : "趋势模型",
  };
}

export function getAbilityRows(figure) {
  const metrics = figure?.metrics || {};
  return [
    { key: "alliance", label: "组织联盟", value: metrics.alliance },
    { key: "command", label: "军事统率", value: metrics.command },
    { key: "legitimacy", label: "制度合法", value: metrics.legitimacy },
    { key: "resilience", label: "韧性恢复", value: metrics.resilience },
  ].map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? item.value : 0,
  }));
}
