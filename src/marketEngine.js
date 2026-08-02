import { interpolateTrajectoryScore } from "./trajectoryModel.js";

const hashText = (text) => [...text].reduce((sum,char)=>((sum*33)^char.charCodeAt(0))>>>0,5381);

function nearestEvent(events, age, tolerance=.15) {
  const event = events.reduce((best,item)=>Math.abs(item.age-age)<Math.abs(best.age-age)?item:best,events[0]);
  return Math.abs(event.age-age)<=tolerance ? event : null;
}

export function buildMicroCandles(figure, count=Math.max(120,Math.min(400,Math.round(figure.lifeSpan*4)+1))) {
  const seed=hashText(figure.id);
  const events=figure.events.filter((event)=>!event.posthumous);
  const result=[];
  let previous=Math.max(0,Math.min(100,interpolateTrajectoryScore(events,0)));
  for(let index=0;index<count;index++){
    const age=(index/(count-1))*figure.lifeSpan;
    const baseline=interpolateTrajectoryScore(events,age);
    const wave=Math.sin((index+seed%17)*1.37)*1.5+Math.cos((index+seed%29)*.61)*.9;
    const close=Math.max(0,Math.min(100,index===count-1?baseline:baseline+wave));
    const open=index===0?Math.max(0,close-.8):previous;
    const volatility=1.2+Math.abs(Math.sin((index+seed%11)*.83))*2.1;
    const low=Math.max(0,Math.min(open,close)-volatility);
    const high=Math.min(100,Math.max(open,close)+volatility*.86);
    const event=nearestEvent(events,age,figure.lifeSpan/(count-1)*.55);
    result.push({age:+age.toFixed(2),phase:+((age/figure.lifeSpan)*100).toFixed(2),open:+open.toFixed(2),close:+close.toFixed(2),low:+low.toFixed(2),high:+high.toFixed(2),event});
    previous=close;
  }
  return result;
}

export function aggregateCandles(candles,bucketSize=1) {
  if(bucketSize<=1)return candles;
  const output=[];
  for(let start=0;start<candles.length;start+=bucketSize){
    const group=candles.slice(start,start+bucketSize);
    if(!group.length)continue;
    output.push({
      age:group[Math.floor(group.length/2)].age,
      phase:group[Math.floor(group.length/2)].phase,
      open:group[0].open,
      close:group.at(-1).close,
      low:Math.min(...group.map((item)=>item.low)),
      high:Math.max(...group.map((item)=>item.high)),
      event:group.find((item)=>item.event)?.event || null,
      members:group.length,
    });
  }
  return output;
}

export function granularityForSpan(span) {
  if(span>68)return {key:"macro",bucket:4,label:"年度聚合",trendDominant:true};
  if(span>34)return {key:"swing",bucket:2,label:"半年聚合",trendDominant:false};
  return {key:"micro",bucket:1,label:"季度微观",trendDominant:false};
}

export function getCandleView(figure,span=100) {
  const granularity=granularityForSpan(span);
  const candles=aggregateCandles(buildMicroCandles(figure),granularity.bucket);
  return {
    granularity:{...granularity,label:`${granularity.key==="macro"?"按年":granularity.key==="swing"?"半年":"季度"} · ${candles.length} 段`},
    candles,
    categories:candles.map((item)=>`${Number.isInteger(item.age)?item.age:item.age.toFixed(1)}岁`),
    values:candles.map((item)=>[item.open,item.close,item.low,item.high]),
    trend:candles.map((item)=>+((item.open+item.close)/2).toFixed(2)),
  };
}
