import { additionalFigures, dynastyOrder } from "./catalog.js";
import { expandedFigures } from "./expandedCatalog.js";
import { extendedFigures } from "./extendedCatalog.js";
import { supplementalFigures } from "./supplementalCatalog.js";
import { attachFigureIndex } from "./figureIndex.js";
import { attachHistoricalCitations } from "./historicalCitations.js";
import {
  attachLegacyAwareTerminal,
  interpolateTrajectoryScore,
} from "./trajectoryModel.js";

export const sources = {
  shijiGaozu: { label: "《史记·高祖本纪》", url: "https://ctext.org/shiji/gao-zu-ben-ji/zhs" },
  shijiXiang: { label: "《史记·项羽本纪》", url: "https://ctext.org/shiji/xiang-yu-ben-ji/zhs" },
  shijiHanxin: { label: "《史记·淮阴侯列传》", url: "https://ctext.org/shiji/huai-yin-hou-lie-zhuan/zhs" },
  sanguoZhuge: { label: "《三国志·诸葛亮传》", url: "https://ctext.org/text.pl?if=gb&node=603498" },
};

const e = (year, title, score, delta, summary, dimension, source, phase) => ({
  year, title, score, delta, summary, dimension, source, phase,
});

const coreFigures = [
  {
    id: "liubang", name: "刘邦", courtesy: "汉高祖", camp: "汉", color: "#d85b4b", born: -256, died: -195,
    thesis: "从亭长到帝王：善用人、能复盘，以组织韧性穿越连败。",
    metrics: { alliance: 96, command: 79, legitimacy: 94, resilience: 98 },
    events: [
      e(-256,"生于丰邑",22,0,"出身平民家庭，早年社会资本有限。","出身",sources.shijiGaozu,0),
      e(-209,"沛县起兵",34,12,"秦末动荡中被推为沛公，完成首次组织跃迁。","组织",sources.shijiGaozu,16),
      e(-207,"先入咸阳",66,32,"率先进入关中，接受秦王子婴投降，政治声望急升。","战果",sources.shijiGaozu,31),
      e(-206,"鸿门脱险",51,-15,"军事实力弱于项羽，但保存了领导核心与基本盘。","生存",sources.shijiXiang,41),
      e(-206,"受封汉王",46,-5,"被迫入汉中，空间受限，却获得独立经营根据地。","权位",sources.shijiGaozu,47),
      e(-206,"还定三秦",64,18,"韩信统军打开关中，汉军重新进入天下竞争。","战果",sources.shijiHanxin,54),
      e(-205,"彭城大败",31,-33,"联军溃败，家属被俘，势能跌至争楚汉阶段低点。","战损",sources.shijiGaozu,61),
      e(-204,"荥阳相持",45,14,"依赖关中输送与多线盟友，维持长期消耗战。","资源",sources.shijiGaozu,69),
      e(-203,"韩信定齐",72,27,"北方战场完成战略包围，楚汉力量结构逆转。","联盟",sources.shijiHanxin,78),
      e(-203,"鸿沟议和",76,4,"换回家属并争取休整，随后抓住项羽撤退窗口。","策略",sources.shijiGaozu,84),
      e(-202,"垓下合围",96,20,"调动韩信、彭越等力量完成对楚军的终局合围。","战果",sources.shijiGaozu,93),
      e(-202,"称帝定汉",100,4,"建立汉朝，个人势能转化为制度合法性。","合法性",sources.shijiGaozu,100),
    ],
  },
  {
    id: "xiangyu", name: "项羽", courtesy: "西楚霸王", camp: "楚", color: "#3f7f78", born: -232, died: -202,
    thesis: "以极致战力冲上高位，却在分配、联盟与后勤上持续折损。",
    metrics: { alliance: 54, command: 98, legitimacy: 68, resilience: 71 },
    events: [
      e(-232,"生于下相",31,0,"楚将世家出身，拥有强烈的复国身份与军事传统。","出身",sources.shijiXiang,0),
      e(-209,"会稽起兵",48,17,"随项梁杀郡守起兵，快速获得江东武装基础。","组织",sources.shijiXiang,16),
      e(-208,"项梁战死",38,-10,"核心庇护与指挥体系骤失，楚军进入权力重组。","损失",sources.shijiXiang,28),
      e(-207,"巨鹿破秦",94,56,"破釜沉舟击溃秦军主力，军事声望抵达峰值。","战果",sources.shijiXiang,39),
      e(-206,"鸿门宴",88,-6,"握有压倒性优势却未消除刘邦，战略机会开始流失。","决策",sources.shijiXiang,47),
      e(-206,"分封天下",82,-6,"成为西楚霸王，但分封失衡催生多方反叛。","治理",sources.shijiXiang,54),
      e(-205,"彭城大胜",96,14,"以少胜多重创汉军，个人战术能力再次封顶。","战果",sources.shijiXiang,62),
      e(-204,"荥阳胶着",77,-19,"战线拉长、补给受扰，优势无法兑换成终局。","资源",sources.shijiXiang,69),
      e(-203,"龙且败亡",58,-19,"齐地楚军主力被韩信击破，侧翼与盟友体系崩解。","战损",sources.shijiHanxin,78),
      e(-203,"鸿沟议和",53,-5,"表面划界，实际已失去持续战争所需的资源纵深。","资源",sources.shijiXiang,84),
      e(-202,"垓下被围",21,-32,"诸侯合围、军心瓦解，战略失败集中兑现。","生存",sources.shijiXiang,93),
      e(-202,"乌江自刎",0,-21,"拒绝渡江重建，个人与西楚政治势能归零。","终局",sources.shijiXiang,100),
    ],
  },
  {
    id: "hanxin", name: "韩信", courtesy: "淮阴侯", camp: "汉", color: "#c9604f", born: -231, died: -196,
    thesis: "从寄食受辱到兵仙封王：军事能力陡升，政治安全却与功业反向运行。",
    metrics: { alliance: 62, command: 100, legitimacy: 72, resilience: 90 },
    events: [
      e(-231,"淮阴布衣",16,0,"贫困且无名望，长期寄食，处于社会网络边缘。","出身",sources.shijiHanxin,0),
      e(-210,"胯下之辱",10,-6,"忍受公开羞辱，以生存与未来机会为优先。","生存",sources.shijiHanxin,12),
      e(-209,"从项梁军",20,10,"进入反秦军队，首次获得军事组织入口。","组织",sources.shijiHanxin,22),
      e(-207,"项羽帐下郎中",25,5,"多次献策未被采用，能力与职位严重错配。","权位",sources.shijiHanxin,31),
      e(-206,"弃楚归汉",22,-3,"离开项羽集团，转投刘邦，短期仍未获重用。","选择",sources.shijiHanxin,40),
      e(-206,"萧何月下追",48,26,"被萧何追回并强力推荐，政治赞助人形成。","联盟",sources.shijiHanxin,47),
      e(-206,"登坛拜将",63,15,"被拜为大将军，能力第一次匹配组织权限。","权位",sources.shijiHanxin,54),
      e(-205,"还定三秦",74,11,"打开汉军东进通道，军事信用持续上升。","战果",sources.shijiHanxin,62),
      e(-204,"背水破赵",88,14,"井陉之战建立超常规用兵声望。","战果",sources.shijiHanxin,70),
      e(-203,"平齐杀龙且",98,10,"控制齐地并击溃楚军主力，功业达到峰值。","战果",sources.shijiHanxin,80),
      e(-202,"垓下统军",100,2,"担任合围核心指挥，但功高震主风险同步累积。","权位",sources.shijiHanxin,90),
      e(-196,"长乐宫死",0,-100,"由楚王降侯，最终以谋反嫌疑被吕后处死。","终局",sources.shijiHanxin,100),
    ],
  },
  {
    id: "zhangliang", name: "张良", courtesy: "留侯", camp: "汉", color: "#9c5b47", born: -250, died: -186,
    thesis: "以低显性的策略影响高杠杆节点，并在权力高峰前主动降仓。",
    metrics: { alliance: 91, command: 67, legitimacy: 87, resilience: 89 },
    events: [
      e(-250,"韩国世家",39,0,"家族五世相韩，天然拥有复国目标与政治教育。","出身",sources.shijiGaozu,0),
      e(-218,"博浪沙击秦",28,-11,"刺秦失败后逃亡，个人风险急剧上升。","生存",sources.shijiGaozu,18),
      e(-216,"圯桥受书",43,15,"获得战略知识的象征性转折，转向长期谋划。","能力",sources.shijiGaozu,26),
      e(-209,"聚众反秦",49,6,"进入反秦联盟并寻找可承载策略的政治主体。","组织",sources.shijiGaozu,35),
      e(-208,"归附刘邦",58,9,"与刘邦形成稳定互信，战略影响获得执行通道。","联盟",sources.shijiGaozu,44),
      e(-207,"谋取关中",70,12,"协助先入咸阳并约束掠夺，积累政治信用。","策略",sources.shijiGaozu,52),
      e(-206,"鸿门解围",76,6,"通过项伯、樊哙等关系链帮助刘邦脱险。","联盟",sources.shijiXiang,60),
      e(-205,"下邑画策",83,7,"提出联结英布、彭越、韩信的多线牵制方案。","策略",sources.shijiGaozu,68),
      e(-203,"劝追项羽",88,5,"在议和后判断楚军可击，推动终局窗口。","决策",sources.shijiGaozu,78),
      e(-202,"定都关中",92,4,"支持关中作为长期治理中心，完成战略落地。","治理",sources.shijiGaozu,86),
      e(-201,"受封留侯",95,3,"功业获得制度承认，同时避免掌握高风险兵权。","权位",sources.shijiGaozu,93),
      e(-186,"功成身退",82,-13,"淡出权力中心，以退为进保存个人与家族。","生存",sources.shijiGaozu,100),
    ],
  },
  {
    id: "xiahe", name: "萧何", courtesy: "酂侯", camp: "汉", color: "#aa704f", born: -257, died: -193,
    thesis: "不以战功见长，却用制度、人才和后勤把刘邦的波动变成可持续复利。",
    metrics: { alliance: 94, command: 56, legitimacy: 90, resilience: 96 },
    events: [
      e(-257,"沛县小吏",35,0,"熟悉基层行政，积累治理与识人能力。","出身",sources.shijiGaozu,0),
      e(-209,"辅佐起兵",48,13,"成为沛县集团核心，提供组织与行政连续性。","组织",sources.shijiGaozu,16),
      e(-207,"收秦图籍",66,18,"进入咸阳后保存律令图书，为汉政权建立数据底座。","资源",sources.shijiGaozu,30),
      e(-206,"留守巴蜀",61,-5,"远离前线却掌握后方建设，短期声望不显。","治理",sources.shijiGaozu,41),
      e(-206,"月下追韩信",76,15,"识别并挽回关键人才，改变汉军能力上限。","人才",sources.shijiHanxin,50),
      e(-205,"经营关中",82,6,"稳定输送兵员粮饷，抵消刘邦前线大败。","资源",sources.shijiGaozu,59),
      e(-204,"补充兵粮",86,4,"把后勤系统转化为汉军长期消耗优势。","资源",sources.shijiGaozu,67),
      e(-203,"稳固根本",89,3,"关中秩序持续稳定，成为联盟与战争的信用基础。","治理",sources.shijiGaozu,75),
      e(-202,"功列第一",97,8,"建国论功居首，制度贡献得到政治确认。","权位",sources.shijiGaozu,84),
      e(-200,"约束宗族",91,-6,"面对猜忌主动控制家族扩张，降低政治风险。","生存",sources.shijiGaozu,91),
      e(-196,"协助诛信",83,-8,"与吕后处置韩信，稳定政权也留下复杂评价。","决策",sources.shijiHanxin,96),
      e(-193,"卒于相位",88,5,"以丞相身份终结一生，组织遗产留存。","终局",sources.shijiGaozu,100),
    ],
  },
  {
    id: "fanzeng", name: "范增", courtesy: "亚父", camp: "楚", color: "#4f817b", born: -277, died: -204,
    thesis: "判断多次领先局势，却无法把正确意见稳定转换成组织行动。",
    metrics: { alliance: 66, command: 72, legitimacy: 61, resilience: 70 },
    events: [
      e(-277,"居鄛隐士",28,0,"年长而未仕，长期积累对天下形势的判断。","出身",sources.shijiXiang,0),
      e(-209,"投奔项梁",44,16,"七十岁出山，提出拥立楚后以聚合法性。","策略",sources.shijiXiang,18),
      e(-208,"立楚怀王",58,14,"策略被采纳，楚军获得更强政治号召。","合法性",sources.shijiXiang,29),
      e(-207,"辅佐项羽",69,11,"进入最高决策圈，被项羽尊为亚父。","权位",sources.shijiXiang,39),
      e(-206,"识别刘邦",82,13,"判断刘邦志向不小，主张尽早消除风险。","判断",sources.shijiXiang,48),
      e(-206,"鸿门举玦",70,-12,"多次示意未被执行，影响力与组织执行脱节。","执行",sources.shijiXiang,56),
      e(-206,"怒撞玉斗",62,-8,"对项羽放走刘邦强烈失望，关系出现裂缝。","联盟",sources.shijiXiang,63),
      e(-205,"楚汉交锋",67,5,"仍在项羽核心幕僚体系中提供战略判断。","策略",sources.shijiXiang,70),
      e(-204,"陈平反间",43,-24,"汉军离间生效，项羽对其信任显著下降。","联盟",sources.shijiXiang,80),
      e(-204,"削夺权柄",28,-15,"组织影响力被抽空，正确判断无法再进入决策。","权位",sources.shijiXiang,88),
      e(-204,"辞归彭城",18,-10,"主动离开项羽，政治生涯事实上终结。","选择",sources.shijiXiang,94),
      e(-204,"途中病卒",0,-18,"未能抵达彭城，个人势能归零。","终局",sources.shijiXiang,100),
    ],
  },
  {
    id: "zhugeliang", name: "诸葛亮", courtesy: "武乡侯", camp: "蜀汉", color: "#5f7890", born: 181, died: 234,
    thesis: "从隆中隐士到托孤重臣：战略、治理与忠诚构成高位平台，北伐则持续消耗边际资源。",
    metrics: { alliance: 88, command: 82, legitimacy: 93, resilience: 96 },
    events: [
      e(181,"生于琅邪",30,0,"士族家庭出身，早年丧父，随叔父辗转。","出身",sources.sanguoZhuge,0),
      e(197,"躬耕隆中",34,4,"在荆州建立知识与名士网络，保持低位观察。","能力",sources.sanguoZhuge,15),
      e(207,"三顾出山",55,21,"与刘备形成君臣联盟，隆中对成为战略框架。","联盟",sources.sanguoZhuge,28),
      e(208,"联吴抗曹",68,13,"推动孙刘联盟，在赤壁前后完成关键外交杠杆。","联盟",sources.sanguoZhuge,39),
      e(214,"入蜀治政",76,8,"进入益州治理体系，组织资源与制度影响上升。","治理",sources.sanguoZhuge,49),
      e(221,"任丞相",88,12,"蜀汉建国后位居中枢，权位与责任同步到顶。","权位",sources.sanguoZhuge,58),
      e(223,"白帝托孤",94,6,"接受刘备托孤，成为政权连续性的核心。","合法性",sources.sanguoZhuge,66),
      e(225,"南征安定",91,-3,"稳定后方但消耗时间与军政资源。","治理",sources.sanguoZhuge,73),
      e(227,"出师北伐",96,5,"以《出师表》整合政治目标，开启主动战略。","战略",sources.sanguoZhuge,80),
      e(228,"街亭失守",72,-24,"首次北伐的关键节点失败，战果与信用回撤。","战损",sources.sanguoZhuge,87),
      e(231,"木门再进",81,9,"多次北伐维持压力，组织韧性高但收益有限。","战果",sources.sanguoZhuge,94),
      e(234,"五丈原病逝",0,-81,"长期军政负荷在前线终结，个人指数归零而制度遗产留存。","终局",sources.sanguoZhuge,100),
    ],
  },
];

const coreDynasty = (figure) => figure.id === "zhugeliang" ? "三国" : "秦汉";
const attachAgeAxis = (figure) => {
  const lifeSpan=figure.died-figure.born;
  const yearCounts=new Map();
  figure.events.forEach((event)=>yearCounts.set(event.year,(yearCounts.get(event.year)||0)+1));
  const yearSeen=new Map();
  const events=figure.events.map((event)=>{
    const seen=yearSeen.get(event.year)||0;yearSeen.set(event.year,seen+1);
    const count=yearCounts.get(event.year)||1;
    const base=event.year-figure.born;
    const offset=count===1?0:(event.year===figure.died?-.72+(seen/(count-1))*.72:(seen/(count-1))*.72);
    const age=Math.max(0,Math.min(lifeSpan,base+offset));
    return {...event,age:+age.toFixed(2),posthumous:event.year>figure.died};
  });
  return {...figure,lifeSpan,events};
};
const allFigures = [
  ...coreFigures.map((figure) => ({...figure,dynasty:coreDynasty(figure)})),
  ...additionalFigures,
  ...expandedFigures,
  ...extendedFigures,
  ...supplementalFigures,
];

const seenFigureNames = new Set();
export const figures = allFigures
  .filter((figure) => {
    if (seenFigureNames.has(figure.name)) return false;
    seenFigureNames.add(figure.name);
    return true;
  })
  .map(attachAgeAxis)
  .map(attachFigureIndex)
  .map(attachLegacyAwareTerminal)
  .map(attachHistoricalCitations);

export { dynastyOrder };

export const figureById = Object.fromEntries(figures.map((figure) => [figure.id, figure]));

export function getPairColors(left,right) {
  if(left.color.toLowerCase()!==right.color.toLowerCase())return [left.color,right.color];
  const alternate=left.color.toLowerCase()==="#c15d50"?"#3f8f9d":"#c15d50";
  return [left.color,alternate];
}

export const formatYear = (year) => year < 0 ? `前${Math.abs(year)}` : `${year}`;
export const formatAge = (age) => `${Number.isInteger(age)?age:age.toFixed(1)}岁`;

function addMicroTexture(figure,index,value,isEvent){
  if(isEvent||value===null)return value;
  const seed=[...figure.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%29;
  const ripple=Math.sin((index+seed)*1.37)*.52+Math.sin(index*.43+seed*.71)*.31;
  return +Math.max(0,Math.min(100,value+ripple)).toFixed(1);
}

export function buildComparison(left, right) {
  const step=.5;
  const maxAge=Math.ceil(Math.max(left.lifeSpan,right.lifeSpan));
  const rawAxis=Array.from({length:Math.round(maxAge/step)+1},(_,index)=>+(index*step).toFixed(1));
  const axis=rawAxis.map(formatAge);
  const lifeEvents=(figure)=>figure.events.filter((event)=>!event.posthumous&&event.age<=figure.lifeSpan);
  const eventMap=(figure)=>new Map(lifeEvents(figure).map((event)=>[Math.round(event.age/step),event]));
  const seriesFor=(figure)=>{
    const events=lifeEvents(figure);
    const map=eventMap(figure);
    const targets=rawAxis.map((age)=>age>figure.lifeSpan?null:interpolateTrajectoryScore(events,age));
    let marketState=targets.find((value)=>value!==null)??0;
    return rawAxis.map((age,index)=>{
      const event=map.get(index)||null;
      const target=targets[index];
      if(target===null)return {value:null,age,raw:age,event:null,axisLabel:formatAge(age)};
      if (event?.trajectory?.terminal) {
        // The terminal point is a declared historical/legacy valuation. It
        // must land on that value exactly instead of lagging behind through
        // the visual smoothing state.
        marketState = target;
      } else {
        const distance=target-marketState;
        const maxMove=event?6.4:3.6;
        const response=event?.delta&&Math.abs(event.delta)>12?.76:.56;
        marketState+=Math.max(-maxMove,Math.min(maxMove,distance*response));
      }
      const value=addMicroTexture(figure,index,marketState,event);
      return {value,age,raw:age,event,axisLabel:formatAge(age)};
    });
  };
  return {sameEra:false,key:"age",step,maxAge,rawAxis,axis,left:seriesFor(left),right:seriesFor(right)};
}

export function toCandles(points) {
  return points.map((point,index) => {
    const open = index ? points[index-1].value : Math.max(0, point.value - 3);
    const close = point.value;
    const spread = Math.max(3, Math.round(Math.abs(close-open) * .18) + 2);
    return { ...point, value: [open, close, Math.max(0, Math.min(open,close)-spread), Math.min(100,Math.max(open,close)+spread)] };
  });
}

export function getTurningPoints(comparison, left, right) {
  const candidates = [];
  comparison.rawAxis.forEach((raw,index) => {
    const le = comparison.left[index].event;
    const re = comparison.right[index].event;
    if (le) candidates.push({ ...le, figure:left, axisLabel:comparison.axis[index], score:comparison.left[index].value });
    if (re) candidates.push({ ...re, figure:right, axisLabel:comparison.axis[index], score:comparison.right[index].value });
  });
  return candidates.sort((a,b) => a.age-b.age).filter((item,index,arr) => {
    if (index===0 || index===arr.length-1) return true;
    return Math.abs(item.delta) >= 12 || index % 3 === 0;
  }).slice(0,8);
}
