// 浏览器端的轻量人物索引：列表、筛选、搜索只需要这些字段；完整事件在选中人物时按需加载。
// 由 pipeline/build.mjs 在写完全量数据包之后调用，也可单独运行：node pipeline/client-index.mjs
import { writeFile, mkdir, readdir, readFile, rm } from "node:fs/promises";

export async function writeClientIndex() {
  const { figures } = await import(`../src/data.js?t=${Date.now()}`);
  const light = figures.map((f) => ({
    id: f.id, name: f.name, courtesy: f.courtesy, camp: f.camp, dynasty: f.dynasty, era: f.era,
    period: f.period, periodLabel: f.periodLabel, domain: f.domain, color: f.color,
    born: f.born, died: f.died, lifeSpan: f.lifeSpan, thesis: f.thesis,
    legacy: { score: f.legacy.score, tier: f.legacy.tier, label: f.legacy.label },
    peak: f.peak,
    eventCount: f.events.length + (f.subEvents?.length ?? 0),
    // 搜索用：名号、朝代、领域、主线和全部事件标题。
    searchText: [f.name, f.courtesy, f.camp, f.dynasty, f.era, f.periodLabel, f.domain, ...f.events.map((e) => e.title), ...(f.subEvents ?? []).map((e) => e.title)]
      .filter(Boolean).join(" ").toLocaleLowerCase("zh-CN"),
  }));
  const out = new URL("../src/v2/index.generated.js", import.meta.url);
  await writeFile(out, `// 由 pipeline/client-index.mjs 生成，勿手改。\nexport default ${JSON.stringify(light)};\n`);
  await writeClientDetails();
  console.log(`客户端索引：${light.length} 人 → src/v2/index.generated.js（${(JSON.stringify(light).length / 1024).toFixed(0)} KB）`);
}

// 每人一份精简详情（按需加载的分包）：去掉只供审核用的字段和繁体引文原串。
async function writeClientDetails() {
  const src = new URL("../data/v2/figures/", import.meta.url);
  const dst = new URL("../data/v2/client/", import.meta.url);
  await rm(dst, { recursive: true, force: true });
  await mkdir(dst, { recursive: true });
  for (const file of (await readdir(src)).filter((f) => f.endsWith(".json"))) {
    const f = JSON.parse(await readFile(new URL(file, src), "utf8"));
    // 引文只存简体原句和来源序号（出处名、链接在人物的 sources 里只存一份）。
    const slimQuote = (q) => (q ? { t: q.textSimplified, s: Math.max(0, f.sources.findIndex((x) => x.label === q.source)) } : null);
    const slimEvent = ({ rejectedQuote, draftRationale, verified, adjudicated, ...e }) => ({ ...e, quote: slimQuote(e.quote) });
    const { quality, ...rest } = f;
    const slim = { ...rest, events: f.events.map(slimEvent), finale: { ...f.finale, quote: slimQuote(f.finale.quote) } };
    await writeFile(new URL(file, dst), JSON.stringify(slim));
  }
}

if (process.argv[1]?.endsWith("client-index.mjs")) await writeClientIndex();
