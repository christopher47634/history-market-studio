import { figures, figureById, buildComparison, getPairColors, dynastyOrder } from "../src/data.js";
import {
  figureDomains,
  filterFigures,
  historyPeriods,
  indexSorts,
} from "../src/figureIndex.js";
import { getCandleView } from "../src/marketEngine.js";

const fail = (message) => { throw new Error(message); };

if(new Set(figures.map((figure)=>figure.id)).size!==figures.length)fail("人物 ID 不唯一");
if(new Set(figures.map((figure)=>figure.name)).size!==figures.length)fail("人物姓名存在重复条目");

// v2 口径：每个人物都来自 data/v2（经 pipeline/build.mjs 校验），这里复核界面拿到的结构。
const CAP = (figure) => (figure.id === "maozedong" ? 100 : 98);
for (const figure of figures) {
  if (!figure.v2 || !figure.legacy) fail(`${figure.name}: 没有接入 v2 数据`);
  if(!Number.isFinite(figure.born)||!Number.isFinite(figure.died)||figure.born>=figure.died)fail(`${figure.name}: 生卒年无效`);
  if (!dynastyOrder.includes(figure.dynasty)) fail(`${figure.name}: 朝代分类无效`);
  if (!historyPeriods.some((period) => period.id === figure.period)) fail(`${figure.name}: 历史分期无效`);
  if (!figureDomains.some((domain) => domain.id === figure.domain)) fail(`${figure.name}: 人物领域无效`);
  const life = figure.events.filter((event) => !event.posthumous);
  if (life.length < 5) fail(`${figure.name}: 生前节点少于 5 个（含终章）`);
  if (life.at(-1).kind !== "finale") fail(`${figure.name}: 生前最后一个节点不是终章`);
  const lastStage = life.at(-2);
  if (life.at(-1).score < lastStage.score * 0.8 - 0.05) fail(`${figure.name}: 终章回撤超过 20%`);
  if (figure.legacy.score > CAP(figure)) fail(`${figure.name}: 后世评价超过封顶`);
  figure.events.forEach((event,index) => {
    if (event.score < 0 || event.score > CAP(figure)) fail(`${figure.name}/${event.title}: 分数越界或超过封顶`);
    if (!event.posthumous && (event.age < 0 || event.age > figure.lifeSpan)) fail(`${figure.name}/${event.title}: 年龄轴越界`);
    if (index && !event.posthumous && event.year < figure.events[index-1].year) fail(`${figure.name}: 史年未排序`);
    if (!event.citation) fail(`${figure.name}/${event.title}: 缺少引文或概括说明`);
    if (["原文", "百科"].includes(event.evidence?.basis)) {
      if (!event.citation.quote || !event.citation.url?.startsWith("https://")) fail(`${figure.name}/${event.title}: 标为原文却没有引句或出处`);
    } else if (event.citation.isExcerpt !== false || !event.citation.note) fail(`${figure.name}/${event.title}: 概括类节点必须写明说明、不得冒充原文`);
    if (!event.posthumous && event.kind !== "finale" && (!event.tier || !event.rationale)) fail(`${figure.name}/${event.title}: 缺少档位或打分理由`);
  });
}

if (figures.length !== 300) fail(`全史人物必须精确达到 300 位，当前 ${figures.length} 位`);
const totalEvents=figures.reduce((sum,figure)=>sum+figure.events.length,0);
if(totalEvents<2400)fail(`300 人节点总量少于 2400 个，当前 ${totalEvents}`);
const verified=figures.reduce((sum,figure)=>sum+[...figure.events,...(figure.subEvents??[])].filter((event)=>event.evidence?.basis==="原文").length,0);
if(verified<900)fail(`逐字核验的原文引句少于 900 条，当前 ${verified}`);
if(figures.filter((figure)=>figure.period==="modern").length<25)fail("近现代人物少于 25 位");
for (const dynasty of dynastyOrder) if (!figures.some((figure)=>figure.dynasty===dynasty)) fail(`${dynasty}: 无人物覆盖`);
for(const [dynasty,minimum] of [["五代十国",5],["辽金西夏",5],["元",7]])if(figures.filter((figure)=>figure.dynasty===dynasty).length<minimum)fail(`${dynasty}: 薄弱时期覆盖不足 ${minimum} 位`);
for(const domain of figureDomains.filter((item)=>item.id!=="all"))if(!figures.some((figure)=>figure.domain===domain.id))fail(`${domain.label}: 无人物覆盖`);
if(historyPeriods.length<6||indexSorts.length<4)fail("人物索引缺少完整分期或排序维度");

const riceSearch=filterFigures(figures,{query:"杂交水稻"});
if(!riceSearch.some((figure)=>figure.name==="袁隆平"))fail("事件关键词无法检索到袁隆平");
if(filterFigures(figures,{period:"modern"}).length<25)fail("近现代分期筛选失效");
if(!filterFigures(figures,{domain:"科技实业"}).some((figure)=>figure.name==="钱学森"))fail("人物领域筛选失效");
if(!filterFigures(figures,{query:"胡服骑射"}).some((figure)=>figure.name==="赵武灵王"))fail("新增人物事件关键词无法检索");
const wangXizhi=filterFigures(figures,{query:"王 羲之"});
// 谢道韫嫁王羲之之子，会被合法检索到；要求王羲之本人排第一、结果不超过 3 位。
if(wangXizhi[0]?.name!=="王羲之"||wangXizhi.length>3)fail(`多关键词检索排序或范围异常：${wangXizhi.map((f)=>f.name).join("、")}`);

const sameEra = buildComparison(figureById.liubang,figureById.xiangyu);
const crossEra = buildComparison(figureById.liubang,figureById.lshimin);
if (sameEra.key!=="year") fail("同时代人物默认应按公元纪年对齐");
if (crossEra.key!=="age") fail("跨时代人物只能按年龄对齐");
if (buildComparison(figureById.liubang,figureById.xiangyu,"age").key!=="age") fail("同时代人物应能切换到年龄轴");
if (crossEra.axis[0]!=="0岁") fail("年龄轴没有从 0 岁开始");
const afterTang=crossEra.rawAxis.findIndex((age,i)=>i<=crossEra.lifeEndIndex&&age>figureById.lshimin.lifeSpan+0.5);
if(afterTang>=0&&crossEra.right[afterTang].value!==null)fail("较短寿人物去世后生前线仍在延续");
if(!crossEra.rightTail.some((point)=>point.value!==null))fail("缺少身后声望线");
if(Math.abs(crossEra.rightTail.filter((p)=>p.value!==null).at(-1).value-figureById.lshimin.legacy.score)>0.01)fail("身后声望线终点不等于后世评价");
if (sameEra.left.filter((point)=>point.event).length < figureById.liubang.events.filter((event)=>!event.posthumous).length) fail("刘邦生前节点在曲线上丢失");

for (const figure of [figureById.liubang,figureById.zhugeliang,figureById.sushi]) {
  const stages=figure.v2.events.filter((event)=>event.kind==="stage").length;
  const stage=getCandleView(figure,100), fine=getCandleView(figure,30);
  if(stage.candles.length!==stages)fail(`${figure.name}: 阶段 K 线根数应等于阶段事件数（含终章）`);
  if(fine.candles.length!==figure.v2.events.length)fail(`${figure.name}: 放大后应每个事件一根`);
  [...stage.candles,...fine.candles].forEach((bar)=>{if(bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close))fail(`${figure.name}: OHLC 关系错误`)});
}

const sameColorPair=figures.find((figure,index)=>figures.slice(index+1).some((other)=>other.color===figure.color));
const colorMate=figures.find((figure)=>figure.id!==sameColorPair.id&&figure.color===sameColorPair.color);
const pairColors=getPairColors(sameColorPair,colorMate);
if(pairColors[0]===pairColors[1])fail("同色人物对比没有生成可辨识的配色");

const withPrimary=figures.filter((figure)=>figure.v2.sources.some((source)=>source.site!=="wp")).length;
for(const figure of figures)for(const source of figure.v2.sources)if(source.site==="wp"&&(!/[?&]oldid=\d+/.test(source.url)||source.license!=="CC BY-SA 4.0"))fail(`${figure.name}: 维基来源没有固定版本号或缺少许可证`);
const encyclopedic=figures.reduce((sum,figure)=>sum+[...figure.events,...(figure.subEvents??[])].filter((event)=>event.evidence?.basis==="百科").length,0);
if(figures.filter((figure)=>figure.born>=1780).some((figure)=>figure.events.filter((event)=>!event.posthumous).length+(figure.subEvents?.length??0)<9))fail("近现代人物的生前节点少于 9 个");
if(withPrimary<230)fail(`有正史原文来源的人物少于 230 位，当前 ${withPrimary}`);
const sourceUrls=new Set(figures.flatMap((figure)=>figure.v2.sources.map((source)=>source.url)));

console.log(`data validation passed: ${figures.length} figures, ${totalEvents} events, ${sourceUrls.size} source URLs, six-domain index and ${verified} verified primary quotes + ${encyclopedic} encyclopedia quotes, ${withPrimary} figures with official-history sources, stage/event OHLC verified`);
