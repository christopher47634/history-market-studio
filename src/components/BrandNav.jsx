import { ChartBar, Scroll, Info, GithubLogo } from "@phosphor-icons/react";
import { figures } from "../data.js";

export function BrandNav({ view,onView,variant="terminal" }) {
  return <header className={`brand-nav brand-nav--${variant}`}>
    <button type="button" className="brand" onClick={()=>onView("b")} aria-label="返回玉衡终端"><span className="brand__seal">史</span><span><b>历史行情局</b><small>HISTORY MARKET STUDIO</small></span></button>
    <nav aria-label="版本切换">
      <button type="button" aria-pressed={view==="b"} className={view==="b"?"is-active":""} onClick={()=>onView("b")}><ChartBar size={16}/>B · 玉衡终端</button>
      <button type="button" aria-pressed={view==="c"} className={view==="c"?"is-active":""} onClick={()=>onView("c")}><Scroll size={16}/>C · 朱砂长卷</button>
    </nav>
    <div className="brand-nav__meta"><span><i/>{figures.length} 位 · 全史模型在线</span><a href="https://github.com/apache/echarts" target="_blank" rel="noreferrer" title="Apache ECharts" aria-label="打开 Apache ECharts 项目"><GithubLogo size={17}/></a><button type="button" aria-label="查看指数方法说明" title="指数方法说明" onClick={()=>document.getElementById("methodology")?.scrollIntoView({behavior:"smooth"})}><Info size={17}/></button></div>
  </header>;
}
