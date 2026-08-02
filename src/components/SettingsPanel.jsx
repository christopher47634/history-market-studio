import { useEffect,useMemo,useRef,useState } from "react";
import { AnimatePresence,motion } from "motion/react";
import { X,GearSix,Palette,ChartLineUp,Database,Check,Monitor,ClockCounterClockwise,Play,Pause,Rewind,CaretRight,ArrowClockwise,LinkSimple,CheckCircle } from "@phosphor-icons/react";
import { buildComparison,formatAge,getTurningPoints } from "../data.js";
import { useHistoryData } from "../historyDataContext.jsx";

const sections=[{id:"appearance",label:"界面与主题",icon:Palette},{id:"chart",label:"图表设置",icon:ChartLineUp},{id:"timeline",label:"事件轴",icon:ClockCounterClockwise},{id:"data",label:"数据说明",icon:Database}];

export function SettingsPanel({open,onClose,view,onView,left,right,initialSection="appearance"}){
  const panelRef=useRef(null);const returnFocusRef=useRef(null);
  const {figures,status:historyStatus,meta,lastSyncedAt,refresh}=useHistoryData();
  const [active,setActive]=useState(initialSection);const [scope,setScope]=useState("all");const [eventIndex,setEventIndex]=useState(0);const [playing,setPlaying]=useState(false);const [copied,setCopied]=useState(false);
  const comparison=useMemo(()=>buildComparison(left,right),[left,right]);
  const allEvents=useMemo(()=>getTurningPoints(comparison,left,right),[comparison,left,right]);
  const timelineEvents=useMemo(()=>{
    if(scope==="critical")return [...allEvents].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,10).sort((a,b)=>a.age-b.age);
    if(scope==="up")return allEvents.filter((event)=>event.delta>=0);
    return allEvents;
  },[allEvents,scope]);
  const currentEvent=timelineEvents[Math.min(eventIndex,Math.max(0,timelineEvents.length-1))]||null;
  useEffect(()=>{if(!open)return;const close=(event)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open,onClose]);
  useEffect(()=>{if(!open)return;returnFocusRef.current=document.activeElement;const panel=panelRef.current;const selector='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';const focusables=()=>[...(panel?.querySelectorAll(selector)||[])];requestAnimationFrame(()=>focusables()[0]?.focus());const trap=(event)=>{if(event.key!=="Tab")return;const items=focusables();if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",trap);return()=>{document.removeEventListener("keydown",trap);returnFocusRef.current?.focus?.()}},[open]);
  useEffect(()=>{if(open)setActive(initialSection)},[open,initialSection]);
  useEffect(()=>{setEventIndex(0);setPlaying(false)},[left.id,right.id,scope]);
  useEffect(()=>{if(!open||active!=="timeline"||!playing||timelineEvents.length<2)return;const timer=window.setInterval(()=>setEventIndex((index)=>(index+1)%timelineEvents.length),1600);return()=>window.clearInterval(timer)},[open,active,playing,timelineEvents.length]);
  const shareCurrent=async()=>{const shareData={title:"历史行情局",text:`${left.name}与${right.name}的历史综合势能对比`,url:location.href};try{if(navigator.share&&matchMedia("(pointer:coarse)").matches){await navigator.share(shareData)}else{await navigator.clipboard.writeText(shareData.url)}setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setCopied(false)}};
  return <AnimatePresence>{open&&<motion.div className="settings-layer" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}>
    <motion.section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-label="历史行情局设置" initial={{x:36,opacity:0,scale:.98}} animate={{x:0,opacity:1,scale:1}} exit={{x:36,opacity:0,scale:.98}} transition={{type:"spring",stiffness:360,damping:34}}>
      <header><span><GearSix/>设置中心</span><div><button type="button" className={copied?"is-copied":""} onClick={shareCurrent} aria-label={copied?"链接已复制":"分享当前人物对比"}>{copied?<CheckCircle weight="fill"/>:<LinkSimple/>}<em>{copied?"已复制":"分享"}</em></button><button type="button" onClick={onClose} aria-label="关闭设置"><X/></button></div></header>
      <div className="settings-panel__body">
        <nav aria-label="设置分类">{sections.map(({id,label,icon:Icon})=><button type="button" key={id} aria-pressed={id===active} onClick={()=>setActive(id)} className={id===active?"is-active":""}><Icon/>{label}</button>)}</nav>
        <div className="settings-detail">
          {active==="appearance"&&<><span className="settings-breadcrumb">设置 / 界面与主题 / 版本</span>
          <h2>选择工作界面</h2><p>两套界面共享人物、年龄轴和历史节点。切换后当前对比人物保持不变。</p><div className="version-cards">
            <button type="button" className={view==="b"?"is-active":""} onClick={()=>{onView("b");onClose()}}><img className="version-preview" src="/assets/yuheng-terminal-target.webp" alt="玉衡终端界面预览"/><span><b>玉衡终端</b><small>暗色专业分析系统</small></span>{view==="b"&&<Check/>}</button>
            <button type="button" className={view==="c"?"is-active":""} onClick={()=>{onView("c");onClose()}}><img className="version-preview" src="/assets/zhusha-scroll-target.webp" alt="朱砂长卷界面预览"/><span><b>朱砂长卷</b><small>纸本历史研究界面</small></span>{view==="c"&&<Check/>}</button>
          </div><div className="settings-note"><Monitor/><span><b>响应式显示</b><small>桌面保持参考图的一屏比例；窄屏自动转为可滚动的单列研究视图。</small></span></div></>}
          {active==="chart"&&<><span className="settings-breadcrumb">设置 / 图表设置</span><h2>图表行为</h2><p>双人默认折线对比；K 线固定为单人物并随缩放聚合。</p><div className="settings-facts"><span><b>横轴</b><small>实际年龄 0 岁—去世年龄</small></span><span><b>缩放</b><small>滚轮缩放、拖拽平移、按钮复位</small></span><span><b>K 线</b><small>季度 / 半年 / 年度自动切换</small></span></div></>}
          {active==="timeline"&&<><span className="settings-breadcrumb">设置 / 事件轴 / 演变播放</span><div className="timeline-settings-head"><div><h2>人生事件演变</h2><p>{left.name}与{right.name}按实际年龄共轴；播放会依次定位到关键转折。</p></div><div className="timeline-scope" role="group" aria-label="事件范围"><button type="button" className={scope==="all"?"is-active":""} onClick={()=>setScope("all")}>人生全程</button><button type="button" className={scope==="critical"?"is-active":""} onClick={()=>setScope("critical")}>关键十点</button><button type="button" className={scope==="up"?"is-active":""} onClick={()=>setScope("up")}>上行事件</button></div></div><div className="settings-timeline-player">
            <div className="settings-timeline-controls"><button type="button" onClick={()=>{setPlaying(false);setEventIndex(0)}} aria-label="回到起点"><Rewind/></button><button type="button" className="is-primary" onClick={()=>setPlaying((value)=>!value)} aria-label={playing?"暂停事件轴":"播放事件轴"}>{playing?<Pause/>:<Play/>}<span>{playing?"暂停":"播放"}</span></button><span>{String(Math.min(eventIndex+1,timelineEvents.length)).padStart(2,"0")} / {String(timelineEvents.length).padStart(2,"0")}</span></div>
            <div className="settings-timeline-track"><span/><em style={{width:`${currentEvent?Math.min(100,(currentEvent.age/comparison.maxAge)*100):0}%`}}/>{timelineEvents.map((event,index)=><button type="button" key={`${event.figure.id}-${event.title}`} className={index===eventIndex?"is-active":""} style={{left:`${Math.min(100,(event.age/comparison.maxAge)*100)}%`}} onClick={()=>{setPlaying(false);setEventIndex(index)}} aria-label={`${event.figure.name} ${event.title} ${formatAge(event.age)}`}><i/></button>)}</div>
            <AnimatePresence mode="wait">{currentEvent&&<motion.article key={`${currentEvent.figure.id}-${currentEvent.title}`} className="settings-timeline-event" initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.2}}><span className="settings-timeline-index">{String(eventIndex+1).padStart(2,"0")}</span><div><header><span><b>{currentEvent.title}</b><small>{currentEvent.figure.name} · {formatAge(currentEvent.age)}</small></span><em className={currentEvent.delta>=0?"is-up":"is-down"}>{currentEvent.delta>=0?"+":""}{currentEvent.delta.toFixed(1)}</em></header><p>{currentEvent.summary}</p><footer><span>{currentEvent.dimension}维度</span><span>史料：{currentEvent.source.label}</span></footer></div><CaretRight/></motion.article>}</AnimatePresence>
          </div></>}
          {active==="data"&&<><span className="settings-breadcrumb">设置 / 数据说明</span><h2>{figures.length} 位人物已接入</h2><p>每位人物至少包含 6 个故事节点，并使用同一年龄行情协议。</p><div className="settings-facts"><span><b>数据通道</b><small>{historyStatus==="live"||historyStatus==="refreshing"?"API 在线同步":"内置数据回退"}</small></span><span><b>事件总量</b><small>{meta?.events||figures.reduce((sum,figure)=>sum+figure.events.length,0)} 个历史节点</small></span><span><b>终章规则</b><small>死亡不归零，最低保留前值 80%</small></span><span><b>模型声明</b><small>解释性综合势能，不是史学定论</small></span></div><div className="settings-data-sync"><button type="button" onClick={()=>refresh()} disabled={historyStatus==="connecting"||historyStatus==="refreshing"}><ArrowClockwise className={historyStatus==="connecting"||historyStatus==="refreshing"?"is-spinning":""}/>{historyStatus==="connecting"||historyStatus==="refreshing"?"正在同步":"重新同步数据"}</button><small>{lastSyncedAt?`上次同步 ${lastSyncedAt.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`:"当前使用随应用发布的安全数据集"}</small></div></>}
        </div>
      </div>
    </motion.section>
  </motion.div>}</AnimatePresence>;
}
