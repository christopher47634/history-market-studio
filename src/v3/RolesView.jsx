// 「角色」页：按板块（领域 + 走势形态）和搜索浏览 300 人。
// - 卡片墙：光标停在一张卡上，卡片翻面（Motion 弹簧 3D 翻转），背面是简介；列表排布：光标停在一行，右侧玻璃角色卡显示简要介绍。
// - 单击一行：打开完整角色卡（完整导语、一生节点、出处署名）。
// - 对比：把行（或角色卡）拖到底部对比栏的 A / B 格，或点「+」填入；再点「对比走势」回主图。
// - 两种排布：卡片墙（默认，头像为主）和列表（信息密集，便于横向比较），地址里 ?layout=list 记住选择。
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { flushSync } from "react-dom";
import { figures, figureById, dynastyOrder, loadFigure } from "../data.js";
import { lifePoints } from "../v2/model.js";
import { BOARDS, DOMAIN_BOARDS, SPECIAL_BOARDS, SORTS, boardById, boardStats, filterFigures } from "./boards.js";
import { AnimatedNumber, Scroll, Segmented } from "./bits.jsx";
import { Avatar, lifeYears as years, useRoles } from "./people.jsx";
import { eraOf } from "./eras.js";
import { ChartIcon, CloseIcon, CompareIcon, GoIcon, ICON, PlusIcon, SearchIcon } from "./icons.jsx";

const fmtYear = (y) => (y < 0 ? `前${-y}` : `${y}`);
const domainLabel = Object.fromEntries(DOMAIN_BOARDS.map((b) => [b.id, b.label]));
const wikiUrl = (r) => `https://zh.wikipedia.org/w/index.php?title=${encodeURIComponent(r.title)}${r.revid ? `&oldid=${r.revid}` : ""}`;
const DRAG = "text/x-history-figure";

// 迷你走势：生前主线，最后虚线一截接到后世评价。身后涨（后世评价高于去世时）为红，跌为绿。
export function Spark({ f, w = 116, h = 30, big = false }) {
  const t = f.trend;
  if (!t?.length || t.length < 2) return <svg className="v3-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />;
  const lifeW = w - (big ? 30 : 18);
  const X = (i) => (i / (t.length - 1)) * lifeW;
  const Y = (v) => h - 2 - (v / 100) * (h - 4);
  const d = t.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const up = f.legacy.score >= t.slice(-1)[0];
  return (
    <svg className={`v3-spark${big ? " is-big" : ""} ${up ? "is-up" : "is-down"}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="v3-spark__area" d={`${d}L${lifeW},${h}L0,${h}Z`} />
      <path className="v3-spark__line" d={d} pathLength="1" vectorEffect="non-scaling-stroke" />
      <path className="v3-spark__tail" d={`M${lifeW},${Y(t.slice(-1)[0]).toFixed(1)}L${w - 2},${Y(f.legacy.score).toFixed(1)}`} vectorEffect="non-scaling-stroke" />
      <circle cx={w - 2} cy={Y(f.legacy.score)} r={big ? 3 : 2} />
    </svg>
  );
}

// 共享元素转场：点开卡片时头像从卡片墙「飞」进完整角色卡，关上时飞回去。
// 浏览器不支持 View Transitions 或开了减少动效时，直接切换（完整卡自己的淡入照常）。
const canMorph = () => typeof document !== "undefined" && "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches;
function morph(id, update) {
  // 翻面状态下看得见的是背面的头像，没翻面是正面的大头像。
  const tile = document.querySelector(`[data-figure="${id}"][data-flipped] .v3-tile__back .v3-ava, [data-figure="${id}"]:not([data-flipped]) .v3-tile__media > .v3-ava`);
  if (!canMorph() || !tile) { update(); return; }
  const root = document.documentElement;
  root.dataset.vt = "card";
  tile.style.viewTransitionName = "role-portrait";
  const t = document.startViewTransition(() => {
    tile.style.viewTransitionName = "";
    flushSync(update);
    // 关卡片的方向：新状态里卡片墙的头像接过这个名字。
    const back = document.querySelector(`[data-figure="${id}"] .v3-tile__media > .v3-ava`);
    if (back && !document.querySelector(".v3-full")) back.style.viewTransitionName = "role-portrait";
  });
  // 转场被浏览器放弃（截图失败、页面在后台等）时状态照样已更新，这里只吞掉拒绝、收拾名字。
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => {
    delete root.dataset.vt;
    document.querySelectorAll(".v3-tile .v3-ava").forEach((el) => { el.style.viewTransitionName = ""; });
  });
}

const startDrag = (e, id) => {
  e.dataTransfer.setData(DRAG, id);
  e.dataTransfer.setData("text/plain", figureById[id]?.name ?? id);
  e.dataTransfer.effectAllowed = "copy";
};

// 简要角色卡（玻璃）：悬停的人。背后垫一层放大模糊的头像，玻璃才有东西可透。
function BriefCard({ f, role, onOpen, onAdd }) {
  if (!f) return null;
  return (
    <article className="v3-role v3-glass lg spot" key={f.id} data-era={eraOf(f)} draggable onDragStart={(e) => startDrag(e, f.id)} aria-label={`${f.name} 简要角色卡`}>
      <div className="v3-glass__bg" style={role?.img ? { backgroundImage: `url(${role.img.src})` } : { "--fc": f.color }} aria-hidden="true" />
      <header className="v3-role__head">
        <Avatar f={f} role={role} size="lg" />
        <div>
          <p className="v3-role__eyebrow">{f.dynasty}<span>·</span>{years(f)}<span>·</span>{domainLabel[f.domain] ?? f.domain}</p>
          <h2>{f.name}</h2>
          {f.courtesy && f.courtesy !== f.name && <p className="v3-role__courtesy">{f.courtesy}</p>}
        </div>
      </header>
      <p className="v3-role__brief">{role?.brief ?? f.thesis}</p>
      <div className="v3-role__stats">
        <span><small>峰值</small><b><AnimatedNumber value={f.peak?.score ?? 0} /></b><em>{f.peak?.title}</em></span>
        <span><small>后世评价</small><b className="is-accent"><AnimatedNumber value={f.legacy.score} /></b><em>{f.legacy.tier} · {f.legacy.label}</em></span>
      </div>
      <div className="draw-on"><Spark f={f} w={300} h={56} big /></div>
      <footer className="v3-role__foot">
        <button type="button" className="v3-btn" onClick={() => onOpen(f.id)}>完整角色卡</button>
        <button type="button" className="v3-btn v3-btn--ghost" onClick={() => onAdd(f.id)}><PlusIcon {...ICON} size={14} />加入对比</button>
      </footer>
      <p className="v3-role__hint">{role?.title ? <>简介摘自维基百科「{role.title}」</> : "一句话行情为本站概括"} · 可拖到下方对比栏</p>
    </article>
  );
}

// 完整角色卡：弹出的玻璃面板。一生节点按需加载该人的完整数据。
function FullCard({ f, role, onClose, onAdd, onSolo, tray, morphed }) {
  const [life, setLife] = useState(null);
  const [intro, setIntro] = useState(null);
  const close = useRef(null);
  useEffect(() => {
    let alive = true;
    setLife(null);
    setIntro(null);
    // 一生节点和完整维基导语都在此人的按需数据分包里。
    loadFigure(f.id).then((full) => { if (!alive) return; setLife(lifePoints(full.v2)); setIntro(full.v2.wikiIntro ?? null); }).catch(() => alive && setLife([]));
    const prev = document.activeElement;
    close.current?.focus();
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    addEventListener("keydown", key, true);
    document.body.style.overflow = "hidden";
    return () => { alive = false; removeEventListener("keydown", key, true); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [f.id]);
  const slot = tray.indexOf(f.id);
  return (
    <div className={`v3-sheet${morphed ? " is-morph" : ""}`} role="dialog" aria-modal="true" aria-label={`${f.name} 完整角色卡`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="v3-full v3-glass lg spot" data-era={eraOf(f)}>
        <div className="v3-glass__bg" style={role?.img ? { backgroundImage: `url(${role.img.src})` } : { "--fc": f.color }} aria-hidden="true" />
        <button ref={close} type="button" className="v3-full__close" onClick={onClose} aria-label="关闭"><CloseIcon {...ICON} size={18} /></button>
        <Scroll className="v3-full__scroll">
        <div className="v3-full__grid">
        <aside className="v3-full__side">
          <Avatar f={f} role={role} size="xl" vt="role-portrait" />
          {role?.img && (
            <p className="v3-full__credit">
              {role.img.source === "baike"
                ? <>头像：来自<a href={role.img.page} target="_blank" rel="noreferrer">百度百科「{role.img.pageTitle ?? f.name}」</a>词条（未标注许可）</>
                : <>头像：<a href={role.img.page} target="_blank" rel="noreferrer">{role.img.artist}</a>，{role.img.license}，来自 Wikimedia Commons</>}
            </p>
          )}
          <div className="v3-full__stats">
            <span><small>峰值</small><b><AnimatedNumber value={f.peak?.score ?? 0} /></b></span>
            <span><small>后世评价</small><b className="is-accent"><AnimatedNumber value={f.legacy.score} /></b></span>
            <span><small>人生节点</small><b><AnimatedNumber value={f.eventCount} /></b></span>
          </div>
          <div className="draw-on"><Spark f={f} w={260} h={64} big /></div>
          <p className="v3-full__legend">实线：生前的势 · 虚线：到后世评价</p>
        </aside>
        <div className="v3-full__body">
          <p className="v3-role__eyebrow">{f.dynasty}<span>·</span>{years(f)}<span>·</span>{domainLabel[f.domain] ?? f.domain}<span>·</span>{f.legacy.tier}</p>
          <h2>{f.name}{f.courtesy && f.courtesy !== f.name && <small>{f.courtesy}</small>}</h2>
          <p className="v3-full__thesis">{f.thesis}</p>
          {role && (
            <blockquote className="v3-full__intro">
              <p>{intro ?? role.brief}</p>
              <cite>维基百科「<a href={wikiUrl(role)} target="_blank" rel="noreferrer">{role.title}</a>」{role.date ? `（${role.date} 版）` : ""} · CC BY-SA 4.0</cite>
            </blockquote>
          )}
          <h3>一生节点</h3>
          <Scroll className="v3-full__lifescroll"><ol className="v3-full__life">
            {life === null && <li className="is-loading">正在载入…</li>}
            {life?.map((p, i) => (
              <li key={i} className={p.kind === "finale" ? "is-end" : ""} style={{ "--i": Math.min(i, 14) }}>
                <time>{fmtYear(p.year)}</time>
                <b>{p.event?.title}</b>
                <span className={i && p.score - life[i - 1].score < 0 ? "is-down" : i && p.score - life[i - 1].score > 0 ? "is-up" : ""}>{Math.round(p.score)}</span>
              </li>
            ))}
          </ol></Scroll>
          <footer className="v3-full__foot">
            <button type="button" className="v3-btn" onClick={() => onSolo(f.id)}><ChartIcon {...ICON} size={14} />看走势</button>
            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => onAdd(f.id)} disabled={slot >= 0}>{slot >= 0 ? `已在对比栏 ${slot ? "B" : "A"}` : <><PlusIcon {...ICON} size={14} />加入对比</>}</button>
          </footer>
        </div>
        </div>
        </Scroll>
      </article>
    </div>
  );
}

// 卡片墙里的一张。动效全部交给 Motion（原 Framer Motion，MIT）：
// - 进场：模糊 + 上浮，按位置错开；
// - 倾斜：光标位置 → 弹簧（stiffness 300 / damping 30），离开时弹回；
// - 翻面：光标停留约 0.15 秒后绕 Y 轴翻到背面看简介（弹簧 stiffness 260 / damping 26，轻微过冲后落定）。
//   触屏没有悬停：第一次点翻面，翻过来再点才打开完整角色卡。
// 正面：头像、人名、朝代、迷你走势；背面：简介、峰值 / 后世评价、领域印章和「完整角色卡」。角上「+」加入对比，整张可拖。
const SPRING_FLIP = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 };
const SPRING_TILT = { stiffness: 300, damping: 30 };
const EASE_EXPO = [0.19, 1, 0.22, 1];
const touchOnly = () => typeof matchMedia !== "undefined" && matchMedia("(hover: none)").matches;
function Tile({ f, role, at, i, onOpen, onToggle }) {
  const reduce = useReducedMotion();
  const [flip, setFlip] = useState(false);
  const timer = useRef(0);
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), SPRING_TILT);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), SPRING_TILT);
  useEffect(() => () => clearTimeout(timer.current), []);
  const enter = () => { if (touchOnly()) return; clearTimeout(timer.current); timer.current = setTimeout(() => setFlip(true), 150); };
  const leave = () => { clearTimeout(timer.current); setFlip(false); mx.set(0.5); my.set(0.5); };
  const move = (e) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const open = () => { if (touchOnly() && !flip) { setFlip(true); return; } onOpen(f.id); };
  const brief = role?.brief ?? f.thesis;
  return (
    <div role="listitem" data-figure={f.id} data-era={eraOf(f)} data-flipped={flip ? "" : undefined} className={`v3-tile spot${at >= 0 ? " is-picked" : ""}`}
      style={{ "--fc": f.color, ...(at >= 0 ? { "--c": `var(--p${at})` } : {}) }}
      draggable onDragStart={(e) => { leave(); startDrag(e, f.id); }} onMouseEnter={enter} onMouseLeave={leave} onPointerMove={move}
      onFocus={() => setFlip(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFlip(false); }}>
      <motion.div className="v3-tile__tilt" style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
        initial={reduce ? false : { opacity: 0, y: 22, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: EASE_EXPO, delay: Math.min(i, 24) * 0.028 }}>
        <motion.div className="v3-tile__inner" initial={false} animate={{ rotateY: flip ? 180 : 0 }} transition={reduce ? { duration: 0 } : SPRING_FLIP}>
          <button type="button" className="v3-tile__face v3-tile__front" onClick={open} aria-label={`${f.name}：查看完整角色卡`} tabIndex={flip ? -1 : 0}>
            <span className={`v3-tile__media${role?.img ? "" : " is-seal"}`}>
              <Avatar f={f} role={role} size="tile" />
              {!role?.img && <i aria-hidden="true">{f.name}</i>}
            </span>
            <span className="v3-tile__score" title="后世评价"><small>后世</small><b>{f.legacy.score}</b></span>
            <span className="v3-tile__body">
              <span className="v3-tile__meta">{f.dynasty}<em>·</em>{domainLabel[f.domain] ?? f.domain}</span>
              <b className="v3-tile__name">{f.name}</b>
              <span className="v3-tile__years">{years(f)}</span>
              <Spark f={f} w={150} h={24} />
            </span>
          </button>
          <button type="button" className="v3-tile__face v3-tile__back" onClick={() => onOpen(f.id)} aria-label={`${f.name}：${brief}。查看完整角色卡`} tabIndex={flip ? 0 : -1}>
            <span className="v3-tile__backbg" style={role?.img ? { backgroundImage: `url(${role.img.src})` } : undefined} aria-hidden="true" />
            <span className="v3-tile__head">
              <Avatar f={f} role={role} size="sm" />
              <span><b>{f.name}</b><small>{f.dynasty}</small><small>{years(f)}</small></span>
            </span>
            <span className="v3-tile__seal" aria-hidden="true">{domainLabel[f.domain] ?? f.domain}</span>
            <span className="v3-tile__brief">{brief}</span>
            <span className="v3-tile__nums">
              <span><small>峰值</small><b>{f.peak?.score ?? "—"}</b></span>
              <span><small>后世评价</small><b className="is-accent">{f.legacy.score}</b></span>
            </span>
            <span className="v3-tile__more">完整角色卡<GoIcon {...ICON} size={14} /></span>
          </button>
        </motion.div>
      </motion.div>
      <button type="button" className="v3-tile__add" onClick={() => onToggle(f.id)} aria-label={`${f.name}：${at >= 0 ? "移出对比" : "加入对比"}`} title={at >= 0 ? "移出对比栏" : "加入对比栏"}>{at >= 0 ? (at ? "B" : "A") : <PlusIcon {...ICON} size={15} />}</button>
    </div>
  );
}

function BoardCard({ board, active, onPick, stats }) {
  return (
    <button type="button" className={`v3-board spot${active ? " is-active" : ""}${board.test ? " is-special" : ""}`} onClick={() => onPick(board.id)} aria-pressed={active} title={board.hint}>
      <span className="v3-board__head"><b>{board.label}</b><em>{stats.count}</em></span>
      <span className="v3-board__avg">均 {stats.avg}</span>
      <span className="v3-board__lead">{stats.leaders.length ? stats.leaders.flatMap((f, i, all) => [i ? " " : null, <span key={f.id}>{f.name}{i < all.length - 1 ? " ·" : ""}</span>]) : "—"}</span>
    </button>
  );
}

// 空结果：说明为什么空、下一步能做什么，并给一个一键清空。
function Empty({ q, onReset }) {
  return (
    <div className="v3-empty" role="status">
      <b>{q.trim() ? `没有和「${q.trim()}」相关的人物` : "这个板块和时代下没有人物"}</b>
      <p>可以搜字号（如「孔明」）、朝代（如「北宋」）或事件（如「变法」），也可以放宽板块和时代。</p>
      <button type="button" className="v3-btn v3-btn--ghost" onClick={onReset}>清空筛选</button>
    </div>
  );
}

export function RolesView({ current, onCompare }) {
  const params = new URLSearchParams(location.search);
  const roles = useRoles();
  const [board, setBoard] = useState(boardById[params.get("board")] ? params.get("board") : "all");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [era, setEra] = useState("all");
  const [sort, setSort] = useState("legacy");
  const [tray, setTray] = useState([]);
  const [focus, setFocus] = useState(null);
  const [open, setOpen] = useState(params.get("role") && figureById[params.get("role")] ? params.get("role") : null);
  const [over, setOver] = useState(-1);
  const [layout, setLayout] = useState(params.get("layout") === "list" ? "list" : "cards");
  const [dragging, setDragging] = useState(false);
  const search = useRef(null);

  useEffect(() => {
    const url = new URL(location.href);
    board === "all" ? url.searchParams.delete("board") : url.searchParams.set("board", board);
    q ? url.searchParams.set("q", q) : url.searchParams.delete("q");
    open ? url.searchParams.set("role", open) : url.searchParams.delete("role");
    layout === "list" ? url.searchParams.set("layout", "list") : url.searchParams.delete("layout");
    history.replaceState(history.state, "", url);
  }, [board, q, open, layout]);
  // 拖人的时候对比栏亮起来，告诉人往哪放。
  useEffect(() => {
    const on = (e) => e.dataTransfer?.types?.includes(DRAG) && setDragging(true);
    const off = () => { setDragging(false); setOver(-1); };
    addEventListener("dragstart", on);
    addEventListener("dragend", off);
    addEventListener("drop", off);
    return () => { removeEventListener("dragstart", on); removeEventListener("dragend", off); removeEventListener("drop", off); };
  }, []);
  useEffect(() => {
    const key = (e) => { if (e.key === "/" && !e.target.closest?.("input, textarea")) { e.preventDefault(); search.current?.focus(); } };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const b = boardById[board];
  const words = q.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  const list = useMemo(() => filterFigures(figures, { board: b, words, era, sort, dynastyOrder }), [board, q, era, sort]);
  const stats = useMemo(() => Object.fromEntries(BOARDS.map((x) => [x.id, boardStats(figures, x)])), []);
  const eras = useMemo(() => dynastyOrder.filter((d) => figures.some((f) => f.dynasty === d)), []);
  const sorts = b?.metric ? [{ value: "board", label: "板块指标" }, ...SORTS] : SORTS;
  useEffect(() => { setSort(b?.metric ? "board" : "legacy"); }, [board]);
  // 悬停卡片默认显示列表第一位，光标移到哪一行就换成谁。
  const shown = figureById[focus] && list.some((f) => f.id === focus) ? figureById[focus] : list[0];

  // 对比栏：加入时放进第一个空格，满了替换 B；拖放可以指定放进 A 或 B。
  const add = (id) => setTray((t) => (t.includes(id) ? t : t.length < 2 ? [...t, id] : [t[0], id]));
  const put = (i, id) => setTray((t) => { const n = [t[0], t[1]].map((x) => (x === id ? undefined : x)); n[i] = id; return n.filter(Boolean); });
  const remove = (id) => setTray((t) => t.filter((x) => x !== id));
  const go = (ids) => onCompare(ids[0], ids[1] ?? "");
  const drop = (i) => (e) => { e.preventDefault(); setOver(-1); const id = e.dataTransfer.getData(DRAG); if (figureById[id]) put(i, id); };
  const toggle = (id) => (tray.includes(id) ? remove(id) : add(id));
  // 用共享元素转场打开的卡片不再播自己的进场动画（否则转场结束后会再淡入一次）。
  const [morphed, setMorphed] = useState(false);
  const openCard = (id) => { setMorphed(canMorph() && !!document.querySelector(`[data-figure="${id}"]`)); morph(id, () => setOpen(id)); };
  const closeCard = () => { const id = open; morph(id, () => setOpen(null)); };

  // ⌘K 面板里点「角色卡」：已经在本页时直接打开那个人。
  useEffect(() => {
    const on = (e) => { if (figureById[e.detail]) { setQ(""); setOpen(e.detail); } };
    addEventListener("v3:open-role", on);
    return () => removeEventListener("v3:open-role", on);
  }, []);
  const trayStep = tray.length === 0 ? 1 : tray.length === 1 ? 2 : 3;

  return (
    <section className={`v3-roles is-${layout}`} aria-label="角色">
      <div className="v3-roles__main">
        <header className="v3-roles__hero rise" style={{ "--d": 0 }}>
          <h1>角色</h1>
          <p className="v3-roles__lede">{figures.length} 位历史人物，按<em>领域</em>或<em>一生走势的形态</em>分板块。光标停在卡片上翻看简介，点开读完整角色卡；挑一两个人放进下方对比栏，就能同图对比走势。</p>
        </header>

        <div className="v3-filterbar lg rise" style={{ "--d": 1 }}>
          <label className="v3-index__search">
            <SearchIcon {...ICON} />
            <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜人名、字号、朝代或事件，如「长征」「变法」" aria-label="在角色里搜索" />
            {q ? <button type="button" className="v3-index__clear" onClick={() => { setQ(""); search.current?.focus(); }} aria-label="清空搜索"><CloseIcon {...ICON} size={14} /></button> : <kbd>/</kbd>}
          </label>
          <p className="v3-index__count" aria-live="polite"><b><AnimatedNumber value={list.length} /></b> 人<span>·</span>{b.label}</p>
          <div className="v3-index__sorts">
            <Segmented label="排序" size="sm" value={sort} onChange={setSort} options={sorts} />
            <Segmented label="排布" size="sm" value={layout} onChange={setLayout} options={[{ value: "cards", label: "卡片" }, { value: "list", label: "列表" }]} />
          </div>
        </div>

        <div className="v3-boards rise" style={{ "--d": 2 }} role="group" aria-label="板块">
          <div className="v3-boards__group">
            <span className="v3-boards__label">领域板块</span>
            <div className="v3-boards__row" data-hscroll="">{[boardById.all, ...DOMAIN_BOARDS].map((x) => <BoardCard key={x.id} board={x} active={board === x.id} onPick={setBoard} stats={stats[x.id]} />)}</div>
          </div>
          <div className="v3-boards__group">
            <span className="v3-boards__label">特色板块 <small>按一生走势的形态归类</small></span>
            <div className="v3-boards__row" data-hscroll="">{SPECIAL_BOARDS.map((x) => <BoardCard key={x.id} board={x} active={board === x.id} onPick={setBoard} stats={stats[x.id]} />)}</div>
          </div>
          <div className="v3-eras" role="radiogroup" aria-label="时代" data-hscroll="">
            {["all", ...eras].map((d) => <button key={d} type="button" role="radio" aria-checked={era === d} className={era === d ? "is-on" : ""} onClick={() => setEra(d)}>{d === "all" ? "全部时代" : d}</button>)}
          </div>
        </div>

        {layout === "cards" ? (
          <div className="v3-tiles" role="list" aria-label="人物卡片" key={`${board}|${era}|${sort}`}>
            {list.map((f, i) => (
              <Tile key={f.id} f={f} role={roles[f.id]} at={tray.indexOf(f.id)} i={i} onOpen={openCard} onToggle={toggle} />
            ))}
            {!list.length && <Empty q={q} onReset={() => { setQ(""); setBoard("all"); setEra("all"); }} />}
          </div>
        ) : (
        <div className="v3-rows rise" style={{ "--d": 3 }} role="list" aria-label="人物列表" onMouseLeave={() => setFocus(null)}>
          <div className="v3-rows__head" aria-hidden="true"><span>人物</span><span>板块</span><span>一生走势</span><span>峰值</span><span>后世评价</span></div>
          {list.map((f) => {
            const at = tray.indexOf(f.id);
            return (
              <div key={f.id} role="listitem" data-era={eraOf(f)} className={`v3-row${at >= 0 ? " is-picked" : ""}${shown?.id === f.id ? " is-focus" : ""}`} style={at >= 0 ? { "--c": `var(--p${at})` } : undefined}
                draggable onDragStart={(e) => startDrag(e, f.id)} onMouseEnter={() => setFocus(f.id)} onFocus={() => setFocus(f.id)}>
                <button type="button" className="v3-row__check" onClick={() => (at >= 0 ? remove(f.id) : add(f.id))} aria-label={`${f.name}：${at >= 0 ? "移出对比" : "加入对比"}`} title={at >= 0 ? "移出对比栏" : "加入对比栏"}>{at >= 0 ? (at ? "B" : "A") : <PlusIcon {...ICON} size={15} />}</button>
                <button type="button" className="v3-row__main" onClick={() => setOpen(f.id)} aria-label={`${f.name}：查看完整角色卡`}>
                  <span className="v3-row__who"><Avatar f={f} role={roles[f.id]} /><span><b>{f.name}</b><small>{f.dynasty}</small><small>{years(f)}</small></span></span>
                  <span className="v3-row__tag">{domainLabel[f.domain] ?? f.domain}</span>
                  <Spark f={f} />
                  <span className="v3-row__peak"><b>{f.peak?.score ?? "—"}</b><small>{f.peak?.title}</small></span>
                  <span className="v3-row__legacy"><b>{f.legacy.score}</b><small>{f.legacy.tier}</small></span>
                </button>
                <button type="button" className="v3-row__go" onClick={() => go([f.id])} aria-label={`单看${f.name}的走势`}><span>看走势</span><GoIcon {...ICON} size={14} /></button>
              </div>
            );
          })}
          {!list.length && <Empty q={q} onReset={() => { setQ(""); setBoard("all"); setEra("all"); }} />}
        </div>
        )}
      </div>

      {layout === "list" && (
        <div className="v3-roles__aside rise" style={{ "--d": 2 }}>
          <BriefCard f={shown} role={roles[shown?.id]} onOpen={openCard} onAdd={add} />
        </div>
      )}

      <div className={`v3-tray lg${tray.length ? " is-on" : ""}${dragging ? " is-dragging" : ""}`} role="region" aria-label="对比栏">
        <ol className="v3-tray__steps" aria-label="对比的步骤">
          <li className={trayStep === 1 ? "is-now" : "is-done"}>挑人</li>
          <li className={trayStep === 3 ? "is-done" : trayStep === 2 ? "is-now" : ""}>再挑一个（可不选）</li>
          <li className={trayStep > 1 ? "is-now" : ""}>同图对比</li>
        </ol>
        <div className="v3-tray__slots">
          {[0, 1].map((i) => {
            const f = figureById[tray[i]];
            return (
              <span key={i} data-era={f ? eraOf(f) : undefined} className={`v3-tray__slot${f ? " is-full" : ""}${over === i ? " is-over" : ""}`} style={{ "--c": `var(--p${i})` }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(i); }} onDragLeave={() => setOver(-1)} onDrop={drop(i)}>
                {f ? <Avatar f={f} role={roles[f.id]} size="xs" /> : <i className="v3-dot" />}
                {f ? <><b>{f.name}</b><button type="button" onClick={() => remove(f.id)} aria-label={`移出${f.name}`}><CloseIcon {...ICON} size={13} /></button></> : <em>{i ? "B" : "A"}<span className="v3-tray__hint">{i ? "：可不选" : "：拖进来或点卡片上的 +"}</span><span className="v3-tray__hint--short">{i ? " 可选" : " 点 +"}</span></em>}
              </span>
            );
          })}
        </div>
        {tray.length > 0 && <button type="button" className="v3-tray__clear" onClick={() => setTray([])}>清空</button>}
        <button type="button" className="v3-tray__go" disabled={!tray.length} onClick={() => go(tray)} title={tray.length ? "" : `主图现在：${[current.left, current.right].filter(Boolean).map((id) => figureById[id]?.name).join(" 对比 ")}`}>
          {tray.length === 2 ? <CompareIcon {...ICON} /> : <ChartIcon {...ICON} />}{tray.length === 2 ? "对比走势" : "看走势"}
        </button>
      </div>

      {open && figureById[open] && <FullCard f={figureById[open]} role={roles[open]} tray={tray} morphed={morphed} onClose={closeCard} onAdd={add} onSolo={(id) => go([id])} />}
    </section>
  );
}
