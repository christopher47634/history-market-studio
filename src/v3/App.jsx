// v3 界面：一张主图 + 阅读面板 + 事件时间条。两套主题（玉衡深色 / 朱砂浅色）共用同一套结构。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { figureById, loadFigure } from "../data.js";
import { buildScene, readingOrder, LEVELS, candleOf, valueAt } from "./scene.js";
import { LifeChart } from "./LifeChart.jsx";
import { Atlas } from "./Atlas.jsx";
import { Picker } from "./Picker.jsx";
import { Reader } from "./Reader.jsx";
import { RolesView } from "./RolesView.jsx";
import { CommandPalette } from "./Command.jsx";
import { AnimatedNumber, Segmented } from "./bits.jsx";
import { nodeDetail } from "./detail.js";
import { eraOf } from "./eras.js";
import { CheckIcon, ICON, SearchIcon, ShareIcon, SwapIcon } from "./icons.jsx";

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

// 节点详情：停靠在图表上方的「详情栏」里（宽屏在右上，和左上的开高低收信息栏并排；手机在图表下方），
// 永远不浮在走势或 K 线上——看盘软件的数据窗口也是这样停靠的。
// 光标在图上显示光标所在节点（is-live），离开后显示固定的节点，所以这一栏不会忽有忽无、不让图跳动。
// 节点必须属于图上现在的人：从两人切成一人（或换人）的那一帧，固定的节点还是旧的，要先丢掉，不然会去读不存在的第二个人（10-20 随机测试抓到的崩溃）。
export const onChart = (scene, n) => (n && scene?.people[n.slot]?.figure.id === n.figure?.id ? n : null);

function Dock({ hover, pinned, scene, level, mode }) {
  const node = onChart(scene, hover?.node) ?? onChart(scene, pinned);
  if (!node || !scene) return null;
  const d = nodeDetail(node);
  // K 线模式下涨跌按这一根算（开盘是前一个事件），和信息栏一致。
  const k = mode === "k" ? candleOf(scene.people[node.slot], level, node) : null;
  if (k) d.delta = +(k.close - k.open).toFixed(1);
  const live = !!hover;
  return (
    <div className={`v3-dock${live ? " v3-hover is-live" : " is-idle"}`} data-era={eraOf(node.figure)} style={{ "--c": `var(--p${d.slot})` }} role={live ? "tooltip" : undefined}
      data-node-x={live ? Math.round(hover.pixel[0]) : undefined} data-node-y={live ? Math.round(hover.pixel[1]) : undefined}>
      <div className="v3-dock__main" key={node.id}>
        <p className="v3-eyebrow"><i className="v3-dot" />{d.person}<span>·</span>{d.when}{!live && <em className="v3-dock__pin">已固定</em>}</p>
        <b className="v3-hover__title">{d.title}</b>
        {d.summary && <p className="v3-hover__sum">{d.summary}</p>}
      </div>
      <p className="v3-hover__score">
        <small>{d.kind === "posthumous" ? "声望" : "当时的势"}</small>
        <span><strong>{d.score}</strong>{d.kind !== "sub" && d.delta !== 0 && d.kind !== "posthumous" && <em className={d.delta > 0 ? "is-up" : "is-down"}>{d.delta > 0 ? "+" : ""}{d.delta}</em>}</span>
        {d.tier && <small>{d.tier}{d.penalty ? ` · ${d.crisis}` : ""}</small>}
      </p>
    </div>
  );
}

// 信息栏（看盘软件左上角那一行）：光标所在那根的开高低收和涨跌；光标不在图上时显示固定的节点。
// 两人同图时另一个人显示同一时刻的势（沿曲线取值）。
function Legend({ scene, level, mode, node, live }) {
  if (!scene || !node) return null;
  const fmt = (v) => (v == null ? "—" : String(v));
  const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
  return (
    <div className={`v3-legend${live ? " is-live" : ""}`} aria-hidden="true">
      {scene.people.map((p) => {
        const mine = p.figure.id === node.figure.id;
        const k = mine && mode === "k" ? candleOf(p, level, node) : null;
        const after = node.x > scene.lifeEnd;
        const v = mine ? node.score : valueAt(p, node.x, level);
        const delta = k ? +(k.close - k.open).toFixed(1) : mine && node.kind !== "sub" && !after ? node.delta : null;
        const tone = delta > 0 ? "is-up" : delta < 0 ? "is-down" : "";
        return (
          <p key={p.figure.id} className={mine ? "is-on" : ""} data-era={eraOf(p.figure)} style={{ "--c": `var(--p${p.slot})` }}>
            <i className="v3-dot" /><b>{p.figure.name}</b>
            {mine && <time>{node.year < 0 ? `前${-node.year}` : node.year}{node.age != null && !after ? ` · ${node.age}岁` : ""}</time>}
            {k ? (
              <>
                <span>开<em>{k.open}</em></span><span>高<em>{k.high}</em></span><span>低<em>{k.low}</em></span>
                <span>收<em className={tone}>{k.close}</em></span>
                <span className={tone}>{signed(delta)}{k.open ? ` · ${signed(+((delta / k.open) * 100).toFixed(1))}%` : ""}</span>
              </>
            ) : (
              <>
                <span>{mine ? (after ? "声望" : "势") : "同期"}<em>{fmt(v)}</em></span>
                {delta ? <span className={tone}>{signed(delta)}</span> : null}
              </>
            )}
            {mine && <small>{clipText(node.event?.title ?? "", 14)}</small>}
          </p>
        );
      })}
    </div>
  );
}
const clipText = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Readout({ person, hover, level }) {
  const f = person.figure;
  const then = hover && hover.node.figure.id === f.id;
  // 光标停在另一个人身上、而此人当时在世：显示同一时刻此人的势。
  const peer = hover && !then && hover.node.x <= person.main.slice(-1)[0].x ? valueAt(person, hover.node.x, level) : null;
  const value = then ? hover.node.score : peer ?? f.legacy.score;
  // 报价闪烁：读数一变，底色按涨跌闪一下（看盘软件的逐笔跳动）。
  const last = useRef(value);
  const [tick, setTick] = useState({ dir: "", n: 0 });
  useEffect(() => {
    const d = value - last.current;
    last.current = value;
    if (Math.abs(d) >= 0.1) setTick((t) => ({ dir: d > 0 ? "tick-up" : "tick-down", n: t.n + 1 }));
  }, [value]);
  return (
    <div className={`v3-readout${then || peer != null ? " is-then" : ""}`} style={{ "--c": `var(--p${person.slot})` }}>
      <span className="v3-readout__who"><i className="v3-dot" />{f.name}</span>
      <strong className="v3-readout__num">{tick.n > 0 && <i key={tick.n} className={`v3-tick ${tick.dir}`} aria-hidden="true" />}<AnimatedNumber value={value} digits={value % 1 ? 1 : 0} /></strong>
      <span className="v3-readout__label">{then ? <>当时的势<em>{hover.node.event?.title}</em></> : peer != null ? <>同期的势<em>{hover.node.year < 0 ? `前${-hover.node.year}` : hover.node.year} 年</em></> : <>后世评价<em>{f.legacy.tier} · {f.legacy.label}</em></>}</span>
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
    <ol className="v3-strip" ref={ref} aria-label="视窗内的事件" data-hscroll="">
      {nodes.map((n) => (
        <li key={n.id} data-era={eraOf(n.figure)} style={{ "--c": `var(--p${n.slot})` }}>
          <button type="button" className={`spot${pinned?.id === n.id ? " is-pinned" : ""}${hover?.node.id === n.id ? " is-hover" : ""}${n.kind === "sub" ? " is-sub" : ""}`} onClick={() => onPick(n)}>
            <time>{n.year < 0 ? `前${-n.year}` : n.year}</time>
            <b>{n.event?.title}</b>
            <span>{n.score}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// 文字版：图上每个节点的表格。读屏软件读不到画布，这里给出同样的信息；平时也方便通读。
function TextTable({ scene, onPick, pinned }) {
  return (
    <div className="v3-table">
      {scene.people.map((p) => (
        <table key={p.figure.id} style={{ "--c": `var(--p${p.slot})` }}>
          <caption><i className="v3-dot" />{p.figure.name}：后世评价 {p.figure.legacy.score}（{p.figure.legacy.tier} · {p.figure.legacy.label}）</caption>
          <thead><tr><th scope="col">年份</th><th scope="col">事件</th><th scope="col">当时的势</th><th scope="col">依据</th></tr></thead>
          <tbody>
            {[...p.nodes, ...p.posthumous].map((n) => {
              const d = nodeDetail(n);
              return (
                <tr key={n.id} className={`${n.kind === "sub" ? "is-sub" : ""}${pinned?.id === n.id ? " is-pinned" : ""}`}>
                  <td>{d.when}</td>
                  <td><button type="button" onClick={() => onPick(n)}>{d.title}</button></td>
                  <td>{d.score}{d.kind !== "sub" && d.delta ? <small className={d.delta > 0 ? "is-up" : "is-down"}> {d.delta > 0 ? "+" : ""}{d.delta}</small> : null}</td>
                  <td>{d.basis === "原文" ? "史书原文" : d.basis === "百科" ? "维基百科" : "概括"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}

// 给画布的文字摘要：每人的峰值、谷底和后世评价。
function chartSummary(scene) {
  return scene.people.map((p) => {
    const peak = p.main.reduce((a, b) => (b.score > a.score ? b : a));
    const low = p.main.slice(1).reduce((a, b) => (b.score < a.score ? b : a));
    return `${p.figure.name}：峰值 ${peak.score}（${peak.year} 年 ${peak.event.title}），谷底 ${low.score}（${low.year} 年 ${low.event.title}），后世评价 ${p.figure.legacy.score}`;
  }).join("；");
}

// 「角色」页的地址是 ?view=roles（早先的 ?view=index 也认）。
const viewFromUrl = () => (["roles", "index"].includes(new URLSearchParams(location.search).get("view")) ? "roles" : "chart");

export function App() {
  const [themeKey, setThemeKey] = useState(themeFromHash);
  const [ids, setIds] = useState(initialIds);
  const [page, setPage] = useState(viewFromUrl);
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState(null);
  const [tries, setTries] = useState(0); // 点「重试」时加一，让加载人物数据的 effect 重跑
  const [axis, setAxis] = useState(null);
  const [mode, setMode] = useState("line");
  const [textView, setTextView] = useState(false);
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
  // 走势 ⇄ 索引用 pushState 切换，浏览器「返回」能回到上一页；人物参数一直留在地址里。
  useEffect(() => {
    const pop = () => { setPage(viewFromUrl()); setIds(initialIds()); };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  const openPage = useCallback((next, nextIds) => {
    const url = new URL(location.href);
    if (next === "roles") url.searchParams.set("view", "roles");
    else ["view", "board", "q", "role"].forEach((k) => url.searchParams.delete(k));
    if (nextIds) { url.searchParams.set("left", nextIds.left); url.searchParams.set("right", nextIds.right); }
    history.pushState(null, "", url);
    const apply = () => {
      if (nextIds) setIds(nextIds);
      setPage(next);
      scrollTo({ top: 0 });
    };
    // 两页之间用 View Transitions 过渡：旧页模糊淡出、新页上浮。不支持或减少动效时直接切。
    if ("startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches && !document.hidden) {
      const t = document.startViewTransition(() => flushSync(apply));
      t.ready.catch(() => {});
      t.finished.catch(() => {});
    } else apply();
  }, []);
  // 用 layout effect：子组件（图表）的普通 effect 会先于父组件执行，若这里也用普通 effect，
  // 图表切主题时读到的还是旧主题的颜色（朱砂切回玉衡会画出浅色网格和白边）。
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = THEMES[themeKey];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeKey === "b" ? "#0a0e0d" : "#f4f1ea");
  }, [themeKey]);

  useEffect(() => {
    let alive = true;
    const want = [ids.left, ids.right].filter(Boolean);
    setError(null); // 换了人或点了重试，上一次的失败不再算数
    Promise.all(want.map((id) => loadFigure(id)))
      .then((list) => alive && setLoaded(Object.fromEntries(list.map((f) => [f.id, f.v2]))))
      .catch((e) => alive && setError(e));
    const url = new URL(location.href);
    url.searchParams.set("left", ids.left);
    if (ids.right) url.searchParams.set("right", ids.right); else url.searchParams.set("right", "");
    history.replaceState(history.state, "", url);
    try { localStorage.setItem(STORE, JSON.stringify(ids)); } catch {}
    return () => { alive = false; };
  }, [ids.left, ids.right, tries]);

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
  // 下面所有地方都用 pin：只认属于图上现在这些人的节点（换人那一帧旧节点作废）。
  const pin = onChart(scene, pinned);

  const onHover = useCallback((h) => setHover(h), []);
  const onPin = useCallback((n) => setPinned(n), []);
  const go = useCallback((n) => { if (!n) return; setPinned(n); chart.current?.reveal(n); }, []);
  const at = pin ? order.findIndex((n) => n.id === pin.id) : -1;
  const prev = at > 0 ? order[at - 1] : null;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "ArrowLeft" && prev) { e.preventDefault(); go(prev); }
      else if (e.key === "ArrowRight" && next) { e.preventDefault(); go(next); }
      else if (e.key === "Escape") chart.current?.zoomToLevel("overview");
      else if (e.key === "Enter" && pin) chart.current?.focus(pin);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [prev, next, pin, go]);

  const inWindow = order.filter((n) => n.x >= view.window[0] - 0.5 && n.x <= view.window[1] + 0.5 && (view.level.key !== "overview" || n.kind !== "sub"));
  const setTheme = (k) => { location.hash = k; };
  // 提示条：复制链接等操作的结果，玻璃胶囊从底部浮起，2 秒后退场。
  const [toast, setToast] = useState(null);
  const say = useCallback((text) => { setToast({ text, n: Date.now() }); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);
  const share = async (copyOnly = false) => {
    const url = location.href;
    const title = `历史行情局 · ${figs.map((f) => f.name).join(" 对比 ")}`;
    try {
      if (!copyOnly && navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      say("链接已复制，发给别人打开就是这张图");
    } catch { say("没能复制，可以直接复制地址栏"); }
  };
  const swap = () => ids.right && setIds({ left: ids.right, right: ids.left });

  // ⌘K / Ctrl+K 任何页面打开搜索面板；走势页上 / 也可以（角色页的 / 留给页内搜索框）。
  const [cmd, setCmd] = useState(false);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((o) => !o); }
      else if (e.key === "/" && page === "chart" && !e.target.closest?.("input, textarea")) { e.preventDefault(); setCmd(true); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [page]);
  const cmdActions = {
    chart: (id) => openPage("chart", { left: id, right: "" }),
    compare: (id) => openPage("chart", { left: ids.left === id ? ids.right || id : ids.left, right: id }),
    role: (id) => { const url = new URL(location.href); url.searchParams.set("role", id); history.replaceState(history.state, "", url); openPage("roles"); window.dispatchEvent(new CustomEvent("v3:open-role", { detail: id })); },
    page: (p) => openPage(p),
    theme: () => setTheme(themeKey === "b" ? "c" : "b"),
    share: () => share(true),
  };

  // 页面往下滚以后，顶栏的玻璃显出来、收紧一点（停在顶上时是透明的，不跟内容抢）。
  useEffect(() => {
    const on = () => document.documentElement.toggleAttribute("data-scrolled", scrollY > 8);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  if (error) return (
    <main className="v3-shell v3-fail" role="alert">
      <b>人物数据没加载下来</b>
      <small>网络可能抖了一下（已自动重试过几次）：{String(error.message || error)}</small>
      <button type="button" className="v3-btn" onClick={() => setTries((n) => n + 1)}>重试</button>
    </main>
  );
  const personOf = (id) => scene?.people.find((p) => p.figure.id === id);
  return (
    <>
    <div className="v3-ambient" aria-hidden="true"><i /><i /><i /></div>
    <header className="v3-bar">
      <div className="v3-bar__in">
        <a className="v3-brand" href="./" aria-label="历史行情局 首页">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 23 11 15l5 5 6-9 6 6" /><circle cx="22" cy="11" r="2.2" /></svg>
          <span><b>历史行情局</b><small>HISTORY · MARKET</small></span>
        </a>
        <nav className="v3-bar__nav" aria-label="页面">
          <Segmented label="页面" className="lg" value={page} onChange={(v) => openPage(v)} options={[{ value: "chart", label: "走势", hint: "人生走势与对比" }, { value: "roles", label: "角色", hint: "按板块和搜索找人，看角色卡，挑人对比" }]} />
        </nav>
        <div className="v3-bar__tools">
          <button type="button" className="v3-bar__search lg" onClick={() => setCmd(true)} aria-haspopup="dialog" aria-label="搜索人物（Ctrl+K）">
            <SearchIcon {...ICON} />
            <span>搜索人物</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button type="button" className="v3-icon-btn lg" onClick={() => share()} aria-label="复制或分享当前页面链接" title="分享">
            <ShareIcon {...ICON} />
          </button>
          <Segmented label="主题" size="sm" className="lg" value={themeKey} onChange={setTheme} options={[{ value: "b", label: "玉衡", hint: "深色" }, { value: "c", label: "朱砂", hint: "浅色" }]} />
        </div>
      </div>
    </header>
    <div className="v3-shell">

      {page === "roles" ? (
        <RolesView current={ids} onCompare={(left, right) => openPage("chart", { left, right })} />
      ) : (<>
      <section className="v3-intro rise" style={{ "--d": 0 }}>
        <h1>一个人的一生，画成一张走势</h1>
        <p><em>当时的势</em>随经历起落，<em>后世评价</em>在身后慢慢落定。挑一到两个人，悬停看每个节点，点下去读原文。</p>
      </section>
      <section className="v3-tickers rise" style={{ "--d": 1 }} aria-label="选择人物">
        <div className="v3-ticker lg" data-era={eraOf(ids.left)} style={{ "--c": "var(--p0)" }}>
          <Picker slot={0} value={ids.left} exclude={ids.right} onChange={(id) => id && setIds((s) => ({ ...s, left: id }))} />
          {personOf(ids.left) && <Readout person={personOf(ids.left)} hover={hover} level={view.level} />}
        </div>
        <button type="button" className="v3-swap lg" onClick={swap} disabled={!ids.right} aria-label="交换两人" title="交换左右">
          <SwapIcon {...ICON} />
        </button>
        <div className={`v3-ticker lg${ids.right ? "" : " is-empty"}`} data-era={ids.right ? eraOf(ids.right) : undefined} style={{ "--c": "var(--p1)" }}>
          <Picker slot={1} value={ids.right} exclude={ids.left} allowEmpty onChange={(id) => setIds((s) => ({ ...s, right: id }))} />
          {ids.right && personOf(ids.right) && <Readout person={personOf(ids.right)} hover={hover} level={view.level} />}
        </div>
      </section>

      <main className="v3-main">
        <section className="v3-card v3-chart spot rise" style={{ "--d": 2 }} aria-label="人生走势">
          <div className="v3-chart__bar">
            <div className="v3-chart__title">
              <h2>当时的势 <span>0–100</span></h2>
              <p>{scene ? (scene.axis === "year" ? "纪年对齐" : "按年龄对齐") : ""}<span>·</span>实线是生前，虚线是身后声望，右端落在后世评价</p>
            </div>
            <div className="v3-chart__tools">
              <Segmented label="缩放层级" value={view.level.key} onChange={(k) => chart.current?.zoomToLevel(k, pin)} options={LEVELS.map((l) => ({ value: l.key, label: l.label, hint: l.hint }))} />
              <Segmented label="图形" size="sm" value={mode} onChange={setMode} options={[{ value: "line", label: "折线" }, { value: "k", label: "K 线" }]} />
              <button type="button" className="v3-text-toggle" aria-pressed={textView} onClick={() => setTextView((v) => !v)}>文字版</button>
              {scene?.people.length > 1 && <Segmented label="横轴" size="sm" value={scene.axis} onChange={setAxis} options={[{ value: "year", label: "纪年" }, { value: "age", label: "年龄" }]} />}
            </div>
          </div>
          {scene && <p className="v3-sr" id="v3-chart-summary">{chartSummary(scene)}</p>}
          <div className="v3-chart__stage" ref={chartBox}>
            {scene ? <LifeChart ref={chart} scene={scene} mode={mode} theme={themeKey} pinned={pin} onHover={onHover} onPin={onPin} onView={setView} initialWindow={initialWindow} /> : <div className="v3-chart__loading"><span />正在排列人生节点</div>}
            <Legend scene={scene} level={view.level} mode={mode} node={onChart(scene, hover?.node) ?? pin} live={!!onChart(scene, hover?.node)} />
            <Dock hover={hover} pinned={pin} scene={scene} level={view.level} mode={mode} />
          </div>
          <p className="v3-chart__hint">
            <span><kbd>滚轮</kbd>缩放</span><span><kbd>拖动</kbd>平移</span><span><kbd>悬停</kbd>十字光标</span><span><kbd>点击</kbd>固定节点</span><span><kbd>双击</kbd>细读</span><span><kbd>←</kbd><kbd>→</kbd>逐个翻看</span><span><kbd>Esc</kbd>回全景</span>
            <em>{view.level.label} · {view.level.hint}</em>
          </p>
          <Strip nodes={inWindow} pinned={pin} hover={hover} onPick={go} />
          {textView && scene && <TextTable scene={scene} pinned={pin} onPick={go} />}
        </section>
        <div className="v3-side rise" style={{ "--d": 3 }}>
          <Atlas year={(hover?.node ?? pin)?.year} person={(hover?.node ?? pin)?.figure?.name} />
          <Reader node={pin} prev={prev} next={next} onGo={go} onFocus={(n) => chart.current?.focus(n)} />
        </div>
      </main>
      </>)}

      <footer className="v3-foot">
        <p><b>怎么算的</b>势 = 权位档分 − 危局折损，所有人用同一把尺子；只有毛泽东达到 100，其余人最高 98。后世评价衡量历史分量，不等于褒扬。</p>
        <p><b>依据</b>古代人物引自正史原文（维基文库），近现代人物引自维基百科；每一句都在原文里逐字核对过，找不到原句的节点标为「概括」。</p>
        <p className="v3-license">维基百科引句依 <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> 使用，出处链接指向核对时的条目版本（含版本号），作者见各条目的页面历史；维基文库所收古籍为公有领域文本。「角色」页的人物简介摘自维基百科（CC BY-SA 4.0），头像来自 Wikimedia Commons 的公有领域或 CC 许可图片；少数没有自由版权图片的人物取自百度百科词条配图。每张头像的来源写在完整角色卡上。字体为思源宋体、思源黑体与 Inter（SIL OFL 1.1）。分数与评语是本站按统一标准作出的解读，不代表任何机构立场。</p>
      </footer>
    </div>
    <CommandPalette open={cmd} onClose={() => setCmd(false)} page={page} current={ids} themeKey={themeKey} actions={cmdActions} />
    {toast && <div className="v3-toast lg" role="status" key={toast.n}><CheckIcon {...ICON} />{toast.text}</div>}
    </>
  );
}
