// v3 界面：一张主图 + 阅读面板 + 事件时间条。两套主题（玉衡深色 / 朱砂浅色）共用同一套结构。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { figureById, loadFigure } from "../data.js";
import { buildScene, readingOrder, LEVELS } from "./scene.js";
import { LifeChart } from "./LifeChart.jsx";
import { Picker } from "./Picker.jsx";
import { Reader } from "./Reader.jsx";
import { AnimatedNumber, Segmented } from "./bits.jsx";
import { nodeDetail } from "./detail.js";

const THEMES = { b: "jade", c: "cinnabar" };
const themeFromHash = () => (location.hash === "#c" ? "c" : "b");

const STORE = "history-market-current-pair";
function initialIds() {
  let q = new URLSearchParams(location.search);
  // 没带参数时恢复上次看的组合（只存在本机浏览器里）。
  if (!q.has("left")) { try { q = new URLSearchParams(JSON.parse(localStorage.getItem(STORE) || "{}")); } catch {} }
  const left = figureById[q.get("left")] ? q.get("left") : "maozedong";
  const right = q.has("right") ? (figureById[q.get("right")] && q.get("right") !== left ? q.get("right") : "") : left === "maozedong" ? "zhouenlai" : "";
  return { left, right };
}

function HoverCard({ hover, box }) {
  if (!hover) return null;
  const d = nodeDetail(hover.node);
  const [x, y] = hover.pixel;
  const w = box?.clientWidth ?? 800;
  const below = y < 170;
  const left = Math.max(130, Math.min(w - 130, x));
  return (
    <div className={`v3-hover${below ? " is-below" : ""}`} style={{ left, top: y, "--c": `var(--p${d.slot})` }} key={hover.node.id} role="tooltip">
      <p className="v3-eyebrow"><i className="v3-dot" />{d.person}<span>·</span>{d.when}</p>
      <b className="v3-hover__title">{d.title}</b>
      <p className="v3-hover__score">
        <span>{d.kind === "posthumous" ? "声望" : "势"} <strong>{d.score}</strong></span>
        {d.kind !== "sub" && d.delta !== 0 && d.kind !== "posthumous" && <em className={d.delta > 0 ? "is-up" : "is-down"}>{d.delta > 0 ? "+" : ""}{d.delta}</em>}
        {d.tier && <small>{d.tier}{d.penalty ? ` · ${d.crisis}` : ""}</small>}
      </p>
      {d.summary && <p className="v3-hover__sum">{d.summary}</p>}
      <p className="v3-hover__hint">点击固定 · 双击细读</p>
    </div>
  );
}

function Readout({ person, hover }) {
  const f = person.figure;
  const then = hover && hover.node.figure.id === f.id;
  const value = then ? hover.node.score : f.legacy.score;
  return (
    <div className={`v3-readout${then ? " is-then" : ""}`} style={{ "--c": `var(--p${person.slot})` }}>
      <span className="v3-readout__who"><i className="v3-dot" />{f.name}</span>
      <strong className="v3-readout__num"><AnimatedNumber value={value} digits={value % 1 ? 1 : 0} /></strong>
      <span className="v3-readout__label">{then ? <>当时的势<em>{hover.node.event?.title}</em></> : <>后世评价<em>{f.legacy.tier} · {f.legacy.label}</em></>}</span>
    </div>
  );
}

function Strip({ nodes, pinned, hover, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector(".is-pinned");
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: document.hidden ? "auto" : "smooth" });
  }, [pinned?.id]);
  return (
    <ol className="v3-strip" ref={ref} aria-label="视窗内的事件">
      {nodes.map((n) => (
        <li key={n.id} style={{ "--c": `var(--p${n.slot})` }}>
          <button type="button" className={`${pinned?.id === n.id ? "is-pinned" : ""}${hover?.node.id === n.id ? " is-hover" : ""}${n.kind === "sub" ? " is-sub" : ""}`} onClick={() => onPick(n)}>
            <time>{n.year < 0 ? `前${-n.year}` : n.year}</time>
            <b>{n.event?.title}</b>
            <span>{n.score}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function App() {
  const [themeKey, setThemeKey] = useState(themeFromHash);
  const [ids, setIds] = useState(initialIds);
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState(null);
  const [axis, setAxis] = useState(null);
  const [mode, setMode] = useState("line");
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [view, setView] = useState({ level: LEVELS[0], window: [0, 1] });
  const chart = useRef(null);
  const chartBox = useRef(null);

  useEffect(() => {
    const sync = () => setThemeKey(themeFromHash());
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = THEMES[themeKey];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeKey === "b" ? "#0a0e0d" : "#f4f1ea");
  }, [themeKey]);

  useEffect(() => {
    let alive = true;
    const want = [ids.left, ids.right].filter(Boolean);
    Promise.all(want.map((id) => loadFigure(id)))
      .then((list) => alive && setLoaded(Object.fromEntries(list.map((f) => [f.id, f.v2]))))
      .catch((e) => alive && setError(e));
    const url = new URL(location.href);
    url.searchParams.set("left", ids.left);
    if (ids.right) url.searchParams.set("right", ids.right); else url.searchParams.set("right", "");
    history.replaceState(null, "", url);
    try { localStorage.setItem(STORE, JSON.stringify(ids)); } catch {}
    return () => { alive = false; };
  }, [ids.left, ids.right]);

  const figs = [loaded[ids.left], ids.right ? loaded[ids.right] : null].filter(Boolean);
  const ready = figs.length === (ids.right ? 2 : 1);
  const scene = useMemo(() => (ready ? buildScene(figs, axis ?? undefined) : null), [ready, loaded, ids.left, ids.right, axis]);
  const order = useMemo(() => (scene ? readingOrder(scene) : []), [scene]);
  // 手机屏窄，一生全景挤不下：默认从「章节」层、以峰值为中心打开，滚动或捏合再缩小。
  const initialWindow = useMemo(() => {
    if (!scene || !matchMedia("(max-width: 720px)").matches) return undefined;
    const peak = scene.people[0].main.reduce((a, b) => (b.score > a.score ? b : a));
    return [peak.x - 12, peak.x + 12];
  }, [scene]);

  // 换人后默认固定在左边那人的峰值上。
  useEffect(() => {
    if (!scene) return;
    const p = scene.people[0];
    setPinned(p.main.reduce((a, b) => (b.score > a.score ? b : a)));
    setHover(null);
  }, [scene]);

  const onHover = useCallback((h) => setHover(h), []);
  const onPin = useCallback((n) => setPinned(n), []);
  const go = useCallback((n) => { if (!n) return; setPinned(n); chart.current?.reveal(n); }, []);
  const at = pinned ? order.findIndex((n) => n.id === pinned.id) : -1;
  const prev = at > 0 ? order[at - 1] : null;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "ArrowLeft" && prev) { e.preventDefault(); go(prev); }
      else if (e.key === "ArrowRight" && next) { e.preventDefault(); go(next); }
      else if (e.key === "Escape") chart.current?.zoomToLevel("overview");
      else if (e.key === "Enter" && pinned) chart.current?.focus(pinned);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [prev, next, pinned, go]);

  const inWindow = order.filter((n) => n.x >= view.window[0] - 0.5 && n.x <= view.window[1] + 0.5 && (view.level.key !== "overview" || n.kind !== "sub"));
  const setTheme = (k) => { location.hash = k; };
  const [shared, setShared] = useState("");
  const share = async () => {
    const url = location.href;
    const title = `历史行情局 · ${figs.map((f) => f.name).join(" 对比 ")}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setShared("链接已复制");
    } catch { setShared(""); return; }
    setTimeout(() => setShared(""), 1800);
  };
  const swap = () => ids.right && setIds({ left: ids.right, right: ids.left });

  if (error) return <main className="v3-shell v3-fail" role="alert"><b>人物数据加载失败</b><small>{String(error.message || error)}，请刷新重试</small></main>;
  return (
    <div className="v3-shell">
      <header className="v3-top rise" style={{ "--d": 0 }}>
        <a className="v3-brand" href="./" aria-label="历史行情局">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 23 11 15l5 5 6-9 6 6" /><circle cx="22" cy="11" r="2.2" /></svg>
          <span><b>历史行情局</b><small>HISTORY · MARKET</small></span>
        </a>
        <p className="v3-top__lede">把一个人的一生画成走势：<em>当时的势</em>随经历起落，<em>后世评价</em>在身后慢慢落定。</p>
        <button type="button" className="v3-share" onClick={share} aria-live="polite">{shared || "分享这张图"}</button>
        <Segmented label="主题" size="sm" value={themeKey} onChange={setTheme} options={[{ value: "b", label: "玉衡" }, { value: "c", label: "朱砂" }]} />
      </header>

      <section className="v3-pick rise" style={{ "--d": 1 }} aria-label="选择人物">
        <Picker slot={0} value={ids.left} exclude={ids.right} onChange={(id) => id && setIds((s) => ({ ...s, left: id }))} />
        <button type="button" className="v3-swap" onClick={swap} disabled={!ids.right} aria-label="交换两人">⇄</button>
        <Picker slot={1} value={ids.right} exclude={ids.left} allowEmpty onChange={(id) => setIds((s) => ({ ...s, right: id }))} />
        <div className="v3-readouts">{scene?.people.map((p) => <Readout key={p.figure.id} person={p} hover={hover} />)}</div>
      </section>

      <main className="v3-main">
        <section className="v3-card v3-chart rise" style={{ "--d": 2 }} aria-label="人生走势">
          <div className="v3-chart__bar">
            <div className="v3-chart__title">
              <h1>当时的势 <span>0–100</span></h1>
              <p>{scene ? (scene.axis === "year" ? "纪年对齐" : "按年龄对齐") : ""}<span>·</span>实线是生前，虚线是身后声望，右端落在后世评价</p>
            </div>
            <div className="v3-chart__tools">
              <Segmented label="缩放层级" value={view.level.key} onChange={(k) => chart.current?.zoomToLevel(k, pinned)} options={LEVELS.map((l) => ({ value: l.key, label: l.label, hint: l.hint }))} />
              <Segmented label="图形" size="sm" value={mode} onChange={setMode} options={[{ value: "line", label: "折线" }, { value: "k", label: "K 线" }]} />
              {scene?.people.length > 1 && <Segmented label="横轴" size="sm" value={scene.axis} onChange={setAxis} options={[{ value: "year", label: "纪年" }, { value: "age", label: "年龄" }]} />}
            </div>
          </div>
          <div className="v3-chart__stage" ref={chartBox}>
            {scene ? <LifeChart ref={chart} scene={scene} mode={mode} theme={themeKey} pinned={pinned} onHover={onHover} onPin={onPin} onView={setView} initialWindow={initialWindow} /> : <div className="v3-chart__loading"><span />正在排列人生节点</div>}
            <HoverCard hover={hover} box={chartBox.current} />
          </div>
          <p className="v3-chart__hint">
            <span><kbd>滚轮</kbd>缩放</span><span><kbd>拖动</kbd>平移</span><span><kbd>点击</kbd>固定节点</span><span><kbd>双击</kbd>细读</span><span><kbd>←</kbd><kbd>→</kbd>逐个翻看</span><span><kbd>Esc</kbd>回全景</span>
            <em>{view.level.label} · {view.level.hint}</em>
          </p>
          <Strip nodes={inWindow} pinned={pinned} hover={hover} onPick={go} />
        </section>
        <div className="rise" style={{ "--d": 3 }}>
          <Reader node={pinned} prev={prev} next={next} onGo={go} onFocus={(n) => chart.current?.focus(n)} />
        </div>
      </main>

      <footer className="v3-foot">
        <p><b>怎么算的</b>势 = 权位档分 − 危局折损，所有人用同一把尺子；只有毛泽东达到 100，其余人最高 98。后世评价衡量历史分量，不等于褒扬。</p>
        <p><b>依据</b>古代人物引自正史原文（维基文库），近现代人物引自维基百科；每一句都在原文里逐字核对过，找不到原句的节点标为「概括」。</p>
      </footer>
    </div>
  );
}
