import { figures, figureById, buildComparison, getPairColors, dynastyOrder } from "../src/data.js";
import { extendedFigures } from "../src/extendedCatalog.js";
import { canonicalAncientFigures } from "../src/catalogs/canonicalAncient.js";
import { canonicalImperialFigures } from "../src/catalogs/canonicalImperial.js";
import { canonicalLateModernFigures } from "../src/catalogs/canonicalLateModern.js";
import {
  figureDomains,
  filterFigures,
  historyPeriods,
  indexSorts,
} from "../src/figureIndex.js";
import { buildMicroCandles, getCandleView } from "../src/marketEngine.js";

const fail = (message) => { throw new Error(message); };

if(new Set(figures.map((figure)=>figure.id)).size!==figures.length)fail("人物 ID 不唯一");
if(new Set(figures.map((figure)=>figure.name)).size!==figures.length)fail("人物姓名存在重复条目");

for (const figure of figures) {
  if(!Number.isFinite(figure.born)||!Number.isFinite(figure.died)||figure.born>=figure.died)fail(`${figure.name}: 生卒年无效`);
  for(const [metric,value] of Object.entries(figure.metrics))if(value<0||value>100)fail(`${figure.name}/${metric}: 指标越界`);
  if (figure.events.length < 6) fail(`${figure.name}: 事件少于 6 个`);
  if (!figure.provenance || figure.provenance.scoreNature !== "interpretive-model") fail(`${figure.name}: 未区分史实与解释性评分`);
  if (!Array.isArray(figure.sources) || figure.sources.length < 2) fail(`${figure.name}: 少于两类人物参考来源`);
  if (!figure.sources.some((source)=>["primary","institutional"].includes(source.type))) fail(`${figure.name}: 缺少主史或机构来源`);
  if (!figure.sources.some((source)=>source.type==="secondary"&&source.scope==="subject")) fail(`${figure.name}: 缺少人物级辅助校对来源`);
  if (!figure.dateCertainty) fail(`${figure.name}: 未标注年代精度`);
  if (!dynastyOrder.includes(figure.dynasty)) fail(`${figure.name}: 朝代分类无效`);
  if (!historyPeriods.some((period) => period.id === figure.period)) fail(`${figure.name}: 历史分期无效`);
  if (!figureDomains.some((domain) => domain.id === figure.domain)) fail(`${figure.name}: 人物领域无效`);
  if (new Set(figure.events.map((event) => event.title)).size !== figure.events.length) fail(`${figure.name}: 重复事件标题`);
  figure.events.forEach((event,index) => {
    if (event.score < 0 || event.score > 100) fail(`${figure.name}/${event.title}: 指数越界`);
    if (event.phase < 0 || event.phase > 100) fail(`${figure.name}/${event.title}: 人生阶段越界`);
    if (event.age < 0 || event.age > figure.lifeSpan) fail(`${figure.name}/${event.title}: 年龄轴越界`);
    if (index && event.phase < figure.events[index-1].phase) fail(`${figure.name}: 阶段未排序`);
    if (index && event.year < figure.events[index-1].year) fail(`${figure.name}: 史年未排序`);
    if (!event.source?.url?.startsWith("https://")) fail(`${figure.name}/${event.title}: 缺少史料链接`);
    if (!event.evidence || event.evidence.status!=="source-backed") fail(`${figure.name}/${event.title}: 缺少证据状态`);
    if (!event.citation?.source || !event.citation?.url?.startsWith("https://")) fail(`${figure.name}/${event.title}: 缺少可核验的史料入口`);
    if (!/原文|摘句|索引/.test(event.citation.kind)) fail(`${figure.name}/${event.title}: 引文类型未区分原文、摘句或史料索引`);
    if (event.citation.isExcerpt===false&&!event.citation.note) fail(`${figure.name}/${event.title}: 史料索引缺少编校说明`);
  });
}

if (figures.length !== 300) fail(`全史人物必须精确达到 300 位，当前 ${figures.length} 位`);
const canonicalFigures=[...canonicalAncientFigures,...canonicalImperialFigures,...canonicalLateModernFigures];
if(canonicalFigures.length!==119)fail(`本轮可靠扩充应为 119 位，当前 ${canonicalFigures.length} 位`);
const totalEvents=figures.reduce((sum,figure)=>sum+figure.events.length,0);
if(totalEvents<1900)fail("300 人关键节点总量少于 1900 个");
if(canonicalFigures.some((figure)=>figure.events.length<6))fail("本轮扩充人物存在少于 6 个关键节点的数据");
if(extendedFigures.some((figure)=>figure.events.length<8))fail("本轮扩充人物存在少于 8 个关键节点的数据");
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
if(filterFigures(figures,{query:"王 羲之"}).some((figure)=>figure.name!=="王羲之"))fail("多关键词检索返回了无关人物");

const sameEra = buildComparison(figureById.liubang,figureById.xiangyu);
const crossEra = buildComparison(figureById.liubang,figureById.lshimin);
if (sameEra.key!=="age"||crossEra.key!=="age") fail("所有人物对比必须统一使用实际年龄轴");
if (sameEra.axis[0]!=="0岁"||crossEra.axis[0]!=="0岁") fail("年龄轴没有从 0 岁开始");
if (crossEra.maxAge!==Math.ceil(Math.max(figureById.liubang.lifeSpan,figureById.lshimin.lifeSpan))) fail("年龄轴终点不是较长寿人物的去世年龄");
const laterThanTang=crossEra.rawAxis.findIndex((age)=>age>figureById.lshimin.lifeSpan);
if(laterThanTang>=0&&crossEra.right[laterThanTang].value!==null)fail("较短寿人物去世后仍被错误补线");
if (sameEra.left.filter((point)=>point.event).length < figureById.liubang.events.filter((event)=>!event.posthumous).length-1) fail("刘邦年龄事件映射丢失过多");

for (const figure of [figureById.liubang,figureById.zhugeliang,figureById.sushi]) {
  const micro=buildMicroCandles(figure);
  const expected=Math.max(120,Math.min(400,Math.round(figure.lifeSpan*4)+1));
  if(micro.length!==expected)fail(`${figure.name}: 微观 K 线没有按寿命生成季度粒度`);
  if(getCandleView(figure,100).candles.length!==Math.ceil(expected/4))fail(`${figure.name}: 宏观聚合不是按年级别`);
  if(getCandleView(figure,50).candles.length!==Math.ceil(expected/2))fail(`${figure.name}: 波段聚合不是半年级别`);
  if(getCandleView(figure,20).candles.length!==expected)fail(`${figure.name}: 拉近后未恢复季度粒度`);
  micro.forEach((bar)=>{if(bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close))fail(`${figure.name}: 微观 OHLC 关系错误`)});
}

const sameColorPair=figures.find((figure,index)=>figures.slice(index+1).some((other)=>other.color===figure.color));
const colorMate=figures.find((figure)=>figure.id!==sameColorPair.id&&figure.color===sameColorPair.color);
const pairColors=getPairColors(sameColorPair,colorMate);
if(pairColors[0]===pairColors[1])fail("同色人物对比没有生成可辨识的配色");

const sourceUrls=new Set(figures.flatMap((figure)=>figure.sources.map((source)=>source.url)));
if(sourceUrls.size<300)fail(`人物级来源去重后少于 300 条，当前 ${sourceUrls.size} 条`);

console.log(`data validation passed: ${figures.length} figures, ${totalEvents} events, ${sourceUrls.size} source URLs, six-domain index and adaptive OHLC verified`);
