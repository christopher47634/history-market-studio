import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { figureById } from "./data.js";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { useHistoryData } from "./historyDataContext.jsx";

const BTerminal = lazy(() =>
  import("./versions/BTerminal.jsx").then((module) => ({ default: module.BTerminal })),
);
const CScroll = lazy(() =>
  import("./versions/CScroll.jsx").then((module) => ({ default: module.CScroll })),
);
const viewFromHash = () => location.hash === "#c" ? "c" : "b";
const initialPair = () => {
  const params = new URLSearchParams(location.search);
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("history-market-current-pair") || "{}");
  } catch {
    saved = {};
  }
  const leftId = params.get("left") || saved.left || "liubang";
  const rightId = params.get("right") || saved.right || "xiangyu";
  return {
    left: figureById[leftId] || figureById.liubang,
    right:
      figureById[rightId] && rightId !== leftId
        ? figureById[rightId]
        : figureById.xiangyu,
  };
};

function ViewLoading({ view }) {
  return (
    <main className={`view-loading view-loading--${view}`} aria-live="polite">
      <span />
      <b>{view === "b" ? "正在校准玉衡" : "正在展开长卷"}</b>
      <small>人物、事件与走势正在归位</small>
    </main>
  );
}

export function App() {
  const { figures, status: dataStatus, meta: dataMeta, lastSyncedAt } = useHistoryData();
  const [view,setView] = useState(viewFromHash);
  const [pair] = useState(initialPair);
  const [left,setLeft] = useState(pair.left);
  const [right,setRight] = useState(pair.right);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [settingsSection,setSettingsSection] = useState("appearance");
  useEffect(()=>{
    const syncView=()=>setView(viewFromHash());
    addEventListener("hashchange",syncView);
    return()=>removeEventListener("hashchange",syncView);
  },[]);
  useEffect(()=>{
    const nextLeft=figures.find((figure)=>figure.id===left.id);
    const nextRight=figures.find((figure)=>figure.id===right.id);
    if(nextLeft&&nextLeft!==left)setLeft(nextLeft);
    if(nextRight&&nextRight!==right)setRight(nextRight);
  },[figures,left,right]);
  useEffect(()=>{
    const url=new URL(location.href);
    url.hash=view;
    url.searchParams.set("left",left.id);
    url.searchParams.set("right",right.id);
    history.replaceState(null,"",url);
    try{localStorage.setItem("history-market-current-pair",JSON.stringify({left:left.id,right:right.id}))}catch{}
    document.documentElement.dataset.view=view;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",view==="b"?"#07100e":"#eee5d4");
    scrollTo({top:0,behavior:"auto"});
  },[view,left.id,right.id]);
  useEffect(()=>{
    const preload=()=>{
      import("./versions/BTerminal.jsx");
      import("./versions/CScroll.jsx");
    };
    if("requestIdleCallback" in window){const handle=requestIdleCallback(preload,{timeout:1800});return()=>cancelIdleCallback(handle)}
    const timer=window.setTimeout(preload,900);return()=>window.clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(!matchMedia("(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)").matches)return;
    let frame=0;
    const move=(event)=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const x=(event.clientX/innerWidth-.5)*6;const y=(event.clientY/innerHeight-.5)*4;document.documentElement.style.setProperty("--scene-shift-x",`${x.toFixed(2)}px`);document.documentElement.style.setProperty("--scene-shift-y",`${y.toFixed(2)}px`)})};
    const reset=()=>{document.documentElement.style.setProperty("--scene-shift-x","0px");document.documentElement.style.setProperty("--scene-shift-y","0px")};
    addEventListener("pointermove",move,{passive:true});addEventListener("blur",reset);
    return()=>{cancelAnimationFrame(frame);removeEventListener("pointermove",move);removeEventListener("blur",reset);reset()};
  },[]);
  const openSettings=(section="appearance")=>{setSettingsSection(section);setSettingsOpen(true)};
  const changeView=useCallback((next)=>setView(next),[]);
  const props={view,onView:changeView,left,right,onLeft:setLeft,onRight:setRight,onOpenSettings:openSettings,dataStatus,dataMeta,lastSyncedAt};
  return <MotionConfig reducedMotion="user" transition={{duration:.45,ease:[.16,1,.3,1]}}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={view} className="view-transition-shell" initial={{opacity:0,scale:.995,filter:"blur(5px)"}} animate={{opacity:1,scale:1,filter:"blur(0px)"}} exit={{opacity:0,scale:1.002,filter:"blur(3px)"}} transition={{duration:.26,ease:[.16,1,.3,1]}}>
        <Suspense fallback={<ViewLoading view={view}/>}>
          {view==="b"?<BTerminal {...props}/>:<CScroll {...props}/>} 
        </Suspense>
      </motion.div>
    </AnimatePresence>
    <SettingsPanel open={settingsOpen} onClose={()=>setSettingsOpen(false)} view={view} onView={changeView} left={left} right={right} initialSection={settingsSection}/>
  </MotionConfig>;
}
