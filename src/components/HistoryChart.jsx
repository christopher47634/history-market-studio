import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowsOutSimple, MouseScroll } from "@phosphor-icons/react";
import { buildComparison, getPairColors } from "../data.js";
import { getCandleView, granularityForSpan } from "../marketEngine.js";

const esc=(value)=>String(value??"").replace(/[&<>"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));

function eventBlock(event) {
  if(!event)return "";
  return `<div class="chart-tip__event"><em>${esc(event.title)}</em><p>${esc(event.summary)}</p><small>${event.delta>=0?"+":""}${esc(event.delta)} · ${esc(event.dimension)}</small></div>`;
}

function lineTooltip(params) {
  const rows=(Array.isArray(params)?params:[params]).filter((row)=>row.seriesType!=="scatter");
  if(!rows.length)return "";
  const eventRows=(Array.isArray(params)?params:[params]).filter((row)=>row.data?.event);
  return `<div class="chart-tip"><div class="chart-tip__eyebrow">${esc(rows[0].axisValueLabel||rows[0].name)} · 势能快照</div>${rows.map((row)=>`<div class="chart-tip__row"><span class="chart-tip__dot" style="background:${esc(row.color)}"></span><b>${esc(row.seriesName)}</b><strong>${esc(row.data?.value)}</strong></div>`).join("")}${eventRows.map((row)=>eventBlock(row.data.event)).join("")}</div>`;
}

function candleTooltip(params,figure,granularity) {
  const rows=Array.isArray(params)?params:[params];
  const candle=rows.find((row)=>row.seriesType==="candlestick");
  if(!candle)return "";
  const [open,close,low,high]=candle.data.value;
  return `<div class="chart-tip chart-tip--ohlc"><div class="chart-tip__eyebrow">${esc(figure.name)} · ${esc(candle.name)} · ${esc(granularity.label)}</div><div class="ohlc-grid"><span>开 <b>${open.toFixed(1)}</b></span><span>高 <b>${high.toFixed(1)}</b></span><span>低 <b>${low.toFixed(1)}</b></span><span>收 <b class="${close>=open?"up":"down"}">${close.toFixed(1)}</b></span></div>${eventBlock(candle.data.event)}</div>`;
}

export function HistoryChart({left,right,mode="line",candleFigure=left,variant="terminal",activeEvent,onEventFocus,onGranularityChange}) {
  const rootRef=useRef(null);
  const chartRef=useRef(null);
  const focusRef=useRef(onEventFocus);
  const granularityRef=useRef(onGranularityChange);
  const zoomRaf=useRef(0);
  const [ready,setReady]=useState(false);
  const [zoom,setZoom]=useState({start:0,end:100});
  const comparison=useMemo(()=>buildComparison(left,right),[left,right]);
  const pairColors=useMemo(()=>getPairColors(left,right),[left,right]);
  const candleView=useMemo(()=>getCandleView(candleFigure,zoom.end-zoom.start),[candleFigure,zoom]);
  focusRef.current=onEventFocus;
  granularityRef.current=onGranularityChange;

  useEffect(()=>{setZoom({start:0,end:100})},[mode,left.id,right.id,candleFigure.id]);

  useEffect(()=>{
    let disposed=false;let observer;
    async function mount(){
      const echarts=await import("echarts");
      if(disposed||!rootRef.current)return;
      const chart=echarts.init(rootRef.current,null,{renderer:"canvas"});
      chartRef.current=chart;
      observer=new ResizeObserver(()=>chart.resize());observer.observe(rootRef.current);
      chart.on("mouseover",(params)=>{if(params.data?.event&&focusRef.current)focusRef.current({...params.data.event,figure:params.data.figure})});
      chart.on("datazoom",(params)=>{
        const item=params.batch?.[0]||params;
        if(typeof item.start!=="number"||typeof item.end!=="number")return;
        cancelAnimationFrame(zoomRaf.current);
        zoomRaf.current=requestAnimationFrame(()=>setZoom((current)=>
          Math.abs(current.start-item.start)<.05&&Math.abs(current.end-item.end)<.05
            ? current
            : {start:item.start,end:item.end}
        ));
      });
      setReady(true);
    }
    mount();
    return()=>{disposed=true;cancelAnimationFrame(zoomRaf.current);observer?.disconnect();chartRef.current?.dispose();chartRef.current=null};
  },[]);

  useEffect(()=>{
    if(mode==="candlestick")granularityRef.current?.(candleView.granularity);
  },[mode,candleView.granularity]);

  useEffect(()=>{
    const chart=chartRef.current;if(!chart||!ready)return;
    const paper=variant==="scroll";
    const axisColor=paper?"rgba(73,55,35,.25)":"rgba(209,239,224,.14)";
    const labelColor=paper?"#756a5b":"#789188";
    const splitColor=paper?"rgba(82,62,38,.10)":"rgba(188,229,211,.075)";
    const common={
      animationDurationUpdate:420,animationEasingUpdate:"cubicOut",
      grid:{left:paper?44:48,right:paper?58:66,top:26,bottom:50},
      xAxis:{type:"category",axisLine:{lineStyle:{color:axisColor}},axisTick:{show:false},axisLabel:{color:labelColor,fontSize:10,margin:14},splitLine:{show:false}},
      yAxis:{type:"value",min:0,max:100,interval:25,name:mode==="line"?"势能指数":"生命行情",nameTextStyle:{color:labelColor,fontSize:9,padding:[0,0,6,0]},axisLabel:{color:labelColor,fontSize:9},axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:splitColor,type:"dashed"}}},
      dataZoom:[{type:"inside",start:zoom.start,end:zoom.end,filterMode:"none",zoomOnMouseWheel:true,moveOnMouseMove:true,moveOnMouseWheel:false},{type:"slider",height:12,bottom:7,start:zoom.start,end:zoom.end,borderColor:"transparent",backgroundColor:paper?"rgba(91,68,43,.08)":"rgba(255,255,255,.035)",fillerColor:paper?"rgba(160,61,47,.16)":"rgba(189,227,210,.1)",handleSize:0,showDetail:false,brushSelect:false}],
      axisPointer:{label:{backgroundColor:paper?"#4b4033":"#16352d"}},legend:{show:false},
    };
    if(mode==="line"){
      const lineSeries=[left,right].map((figure,index)=>({
        color:pairColors[index],
        name:figure.name,type:"line",data:index?comparison.right:comparison.left,smooth:.2,showSymbol:false,symbolSize:7,
        lineStyle:{width:index?2.15:2.6,type:index?"dashed":"solid",color:pairColors[index],shadowBlur:paper?0:7,shadowColor:`${pairColors[index]}44`},
        endLabel:{show:true,formatter:"{a}",color:pairColors[index],fontSize:10,fontWeight:600,distance:7},labelLayout:{moveOverlap:"shiftY"},
        itemStyle:{color:pairColors[index]},emphasis:{focus:"series"},
      }));
      const eventSeries=[left,right].map((figure,index)=>({
        name:`${figure.name} · 事件`,type:"scatter",z:8,symbol:"circle",symbolSize:(value,params)=>params.data.event?9:0,
        data:(index?comparison.right:comparison.left).map((point)=>({...point,value:point.value,figure,itemStyle:{color:paper?"#f6ecda":"#091312",borderColor:pairColors[index],borderWidth:2,shadowBlur:8,shadowColor:`${pairColors[index]}66`}})),emphasis:{scale:1.5},
      }));
      chart.setOption({...common,xAxis:{...common.xAxis,boundaryGap:false,data:comparison.axis,axisLabel:{...common.xAxis.axisLabel,interval:Math.max(0,Math.floor(comparison.axis.length/7)-1)}},tooltip:{trigger:"axis",confine:true,backgroundColor:"transparent",borderWidth:0,padding:0,extraCssText:"box-shadow:none;",formatter:lineTooltip,axisPointer:{type:"line"}},series:[...lineSeries,...eventSeries]},true);
    } else {
      const candleData=candleView.candles.map((item)=>({value:[item.open,item.close,item.low,item.high],event:item.event,phase:item.phase,figure:candleFigure}));
      const eventData=candleView.candles.map((item)=>({value:(item.open+item.close)/2,event:item.event,phase:item.phase,figure:candleFigure,itemStyle:{color:paper?"#f6ecda":"#091312",borderColor:candleFigure.color,borderWidth:2}}));
      chart.setOption({...common,xAxis:{...common.xAxis,boundaryGap:true,data:candleView.categories,axisLabel:{...common.xAxis.axisLabel,interval:Math.max(0,Math.floor(candleView.categories.length/7)-1)}},tooltip:{trigger:"axis",confine:true,backgroundColor:"transparent",borderWidth:0,padding:0,extraCssText:"box-shadow:none;",formatter:(params)=>candleTooltip(params,candleFigure,candleView.granularity),axisPointer:{type:"cross"}},series:[
        {name:`${candleFigure.name} · OHLC`,type:"candlestick",barMaxWidth:candleView.granularity.key==="micro"?10:18,data:candleData,itemStyle:{color:"#df5b4c",color0:"#3f9278",borderColor:"#ee8174",borderColor0:"#69b59c",borderWidth:1,opacity:candleView.granularity.trendDominant?0.48:1},emphasis:{itemStyle:{borderWidth:2,shadowBlur:10,shadowColor:candleFigure.color}}},
        {name:`${candleFigure.name} · 趋势`,type:"line",data:candleView.trend,smooth:.32,showSymbol:false,silent:true,z:5,lineStyle:{width:candleView.granularity.trendDominant?2.6:1,color:candleFigure.color,opacity:candleView.granularity.trendDominant?1:.32}},
        {name:`${candleFigure.name} · 事件`,type:"scatter",data:eventData,z:8,symbolSize:(value,params)=>params.data.event?9:0,emphasis:{scale:1.5}},
      ]},true);
    }
    if(activeEvent){
      chart.dispatchAction({type:"downplay"});
      if(mode==="line"){
        const rightSide=activeEvent.figure?.id===right.id;const points=rightSide?comparison.right:comparison.left;
        const index=points.findIndex((point)=>point.event?.title===activeEvent.title);if(index>=0){chart.dispatchAction({type:"highlight",seriesIndex:rightSide?3:2,dataIndex:index});chart.dispatchAction({type:"showTip",seriesIndex:rightSide?3:2,dataIndex:index})}
      }else if(activeEvent.figure?.id===candleFigure.id){
        const index=candleView.candles.reduce((best,item,i)=>Math.abs(item.age-activeEvent.age)<Math.abs(candleView.candles[best].age-activeEvent.age)?i:best,0);chart.dispatchAction({type:"highlight",seriesIndex:2,dataIndex:index});chart.dispatchAction({type:"showTip",seriesIndex:0,dataIndex:index});
      }
    }
  },[left,right,mode,candleFigure,variant,ready,activeEvent,comparison,candleView,zoom,pairColors]);

  const reset=()=>{setZoom({start:0,end:100});chartRef.current?.dispatchAction({type:"dataZoom",start:0,end:100})};
  return <div className={`history-chart history-chart--${variant} history-chart--${mode}`}>
    <div ref={rootRef} className="history-chart__canvas" role="img" aria-label={mode==="line"?`${left.name}与${right.name}历史势能对比折线图`:`${candleFigure.name}细粒度生命蜡烛图`}/>
    <div className="history-chart__hint"><MouseScroll size={14}/>滚轮缩放 · 拖拽平移</div>
    {mode==="candlestick"&&<div className={`granularity-badge granularity-badge--${granularityForSpan(zoom.end-zoom.start).key}`}>{candleView.granularity.label}</div>}
    <button type="button" className="chart-reset" onClick={reset} title="复位图表" aria-label="复位图表缩放"><ArrowsOutSimple size={15}/><span>复位</span></button>
  </div>;
}
