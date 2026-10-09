// 「角色」页：按板块（领域 + 走势形态）和搜索浏览 300 人。
// - 光标停在一行上：右侧玻璃角色卡显示简要介绍（维基百科头像 + 导语 + 行情摘要）。
// - 单击一行：打开完整角色卡（完整导语、一生节点、出处署名）。
// - 对比：把行（或角色卡）拖到底部对比栏的 A / B 格，或点「+」填入；再点「对比走势」回主图。
import { useEffect, useMemo, useRef, useState } from "react";
import { figures, figureById, dynastyOrder, loadFigure } from "../data.js";
import { lifePoints } from "../v2/model.js";
import { BOARDS, DOMAIN_BOARDS, SPECIAL_BOARDS, SORTS, boardById, boardStats, filterFigures } from "./boards.js";
import { Segmented } from "./bits.jsx";

const fmtYear = (y) => (y < 0 ? `前${-y}` : `${y}`);
const years = (f) => `${fmtYear(f.born)}—${fmtYear(f.died)}`;
const domainLabel = Object.fromEntries(DOMAIN_BOARDS.map((b) => [b.id, b.label]));
const wikiUrl = (r) => `https://zh.wikipedia.org/w/index.php?title=${encodeURIComponent(r.title)}${r.revid ? `&oldid=${r.revid}` : ""}`;
const DRAG = "text/x-history-figure";

// 角色数据（维基导语 + 头像）单独成包，进入本页时才加载。
let rolesPromise = null;
const loadRoles = () => (rolesPromise ??= import("../v2/roles.generated.js").then((m) => m.default).catch(() => ({})));
function useRoles() {
  const [roles, setRoles] = useState(null);
  useEffect(() => { let alive = true; loadRoles().then((r) => alive && setRoles(r)); return () => { alive = false; }; }, []);
  return roles ?? {};
}

// 迷你走势：生前主线，最后虚线一截接到后世评价。身后涨（后世评价高于去世时）为红，跌为绿。
export function Spark({ f, w = 116, h = 30, big = false }) {
  const t = f.trend;
  if (!t?.length || t.length < 2) return <svg className="v3-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />;
  const lifeW = w - (big ? 30 : 18);
  const X = (i) => (i / (t.length - 1)) * lifeW;
  const Y = (v) => h - 2 - (v / 100) * (h - 4);
  const d = t.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const up = f.legacy.score >= t.at(-1);
  return (
    <svg className={`v3-spark${big ? " is-big" : ""} ${up ? "is-up" : "is-down"}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="v3-spark__area" d={`${d}L${lifeW},${h}L0,${h}Z`} />
      <path className="v3-spark__line" d={d} vectorEffect="non-scaling-stroke" />
      <path className="v3-spark__tail" d={`M${lifeW},${Y(t.at(-1)).toFixed(1)}L${w - 2},${Y(f.legacy.score).toFixed(1)}`} vectorEffect="non-scaling-stroke" />
      <circle cx={w - 2} cy={Y(f.legacy.score)} r={big ? 3 : 2} />
    </svg>
  );
}

// 头像：有维基头像用头像，没有就用姓氏字章（人物主色）。
function Avatar({ f, role, size = "sm" }) {
  return role?.img ? (
    <img className={`v3-ava v3-ava--${size}`} src={role.img.src} alt="" loading="lazy" decoding="async" width={role.img.w} height={role.img.h} draggable="false" />
  ) : (
    <span className={`v3-ava v3-ava--${size} v3-ava--mono`} style={{ "--fc": f.color }} aria-hidden="true">{f.name[0]}</span>
  );
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
    <article className="v3-role v3-glass" key={f.id} draggable onDragStart={(e) => startDrag(e, f.id)} aria-label={`${f.name} 简要角色卡`}>
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
        <span><small>峰值</small><b>{f.peak?.score ?? "—"}</b><em>{f.peak?.title}</em></span>
        <span><small>后世评价</small><b className="is-accent">{f.legacy.score}</b><em>{f.legacy.tier} · {f.legacy.label}</em></span>
      </div>
      <Spark f={f} w={300} h={56} big />
      <footer className="v3-role__foot">
        <button type="button" className="v3-btn" onClick={() => onOpen(f.id)}>完整角色卡</button>
        <button type="button" className="v3-btn v3-btn--ghost" onClick={() => onAdd(f.id)}>＋ 加入对比</button>
      </footer>
      <p className="v3-role__hint">{role?.title ? <>简介摘自维基百科「{role.title}」</> : "一句话行情为本站概括"} · 可拖到下方对比栏</p>
    </article>
  );
}

// 完整角色卡：弹出的玻璃面板。一生节点按需加载该人的完整数据。
function FullCard({ f, role, onClose, onAdd, onSolo, tray }) {
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
    <div className="v3-sheet" role="dialog" aria-modal="true" aria-label={`${f.name} 完整角色卡`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="v3-full v3-glass">
        <div className="v3-glass__bg" style={role?.img ? { backgroundImage: `url(${role.img.src})` } : { "--fc": f.color }} aria-hidden="true" />
        <button ref={close} type="button" className="v3-full__close" onClick={onClose} aria-label="关闭">×</button>
        <aside className="v3-full__side">
          <Avatar f={f} role={role} size="xl" />
          {role?.img && (
            <p className="v3-full__credit">
              头像：<a href={role.img.page} target="_blank" rel="noreferrer">{role.img.artist}</a>，{role.img.license}，来自 Wikimedia Commons
            </p>
          )}
          <div className="v3-full__stats">
            <span><small>峰值</small><b>{f.peak?.score ?? "—"}</b></span>
            <span><small>后世评价</small><b className="is-accent">{f.legacy.score}</b></span>
            <span><small>人生节点</small><b>{f.eventCount}</b></span>
          </div>
          <Spark f={f} w={260} h={64} big />
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
          <ol className="v3-full__life">
            {life === null && <li className="is-loading">正在载入…</li>}
            {life?.map((p, i) => (
              <li key={i} className={p.kind === "finale" ? "is-end" : ""}>
                <time>{fmtYear(p.year)}</time>
                <b>{p.event?.title}</b>
                <span className={i && p.score - life[i - 1].score < 0 ? "is-down" : i && p.score - life[i - 1].score > 0 ? "is-up" : ""}>{Math.round(p.score)}</span>
              </li>
            ))}
          </ol>
          <footer className="v3-full__foot">
            <button type="button" className="v3-btn" onClick={() => onSolo(f.id)}>看走势 →</button>
            <button type="button" className="v3-btn v3-btn--ghost" onClick={() => onAdd(f.id)} disabled={slot >= 0}>{slot >= 0 ? `已在对比栏 ${slot ? "B" : "A"}` : "＋ 加入对比"}</button>
          </footer>
        </div>
      </article>
    </div>
  );
}

function BoardCard({ board, active, onPick, stats }) {
  return (
    <button type="button" className={`v3-board${active ? " is-active" : ""}${board.test ? " is-special" : ""}`} onClick={() => onPick(board.id)} aria-pressed={active} title={board.hint}>
      <span className="v3-board__head"><b>{board.label}</b><em>{stats.count}</em></span>
      <span className="v3-board__avg">均 {stats.avg}</span>
      <span className="v3-board__lead">{stats.leaders.map((f) => f.name).join(" · ") || "—"}</span>
    </button>
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
  const search = useRef(null);

  useEffect(() => {
    const url = new URL(location.href);
    board === "all" ? url.searchParams.delete("board") : url.searchParams.set("board", board);
    q ? url.searchParams.set("q", q) : url.searchParams.delete("q");
    open ? url.searchParams.set("role", open) : url.searchParams.delete("role");
    history.replaceState(history.state, "", url);
  }, [board, q, open]);
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

  return (
    <section className="v3-roles" aria-label="角色">
      <div className="v3-roles__main">
        <div className="v3-index__head rise" style={{ "--d": 1 }}>
          <label className="v3-index__search">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
            <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜人名、字号、朝代或事件，如「长征」「变法」" aria-label="搜索人物" />
            <kbd>/</kbd>
          </label>
          <p className="v3-index__count"><b>{list.length}</b> / {figures.length} 人<span>·</span>{b.hint}</p>
        </div>

        <div className="v3-boards rise" style={{ "--d": 2 }} role="group" aria-label="板块">
          <div className="v3-boards__group">
            <span className="v3-boards__label">领域板块</span>
            <div className="v3-boards__row">{[boardById.all, ...DOMAIN_BOARDS].map((x) => <BoardCard key={x.id} board={x} active={board === x.id} onPick={setBoard} stats={stats[x.id]} />)}</div>
          </div>
          <div className="v3-boards__group">
            <span className="v3-boards__label">特色板块 <small>按一生走势的形态归类</small></span>
            <div className="v3-boards__row">{SPECIAL_BOARDS.map((x) => <BoardCard key={x.id} board={x} active={board === x.id} onPick={setBoard} stats={stats[x.id]} />)}</div>
          </div>
        </div>

        <div className="v3-index__tools rise" style={{ "--d": 3 }}>
          <div className="v3-eras" role="radiogroup" aria-label="时代">
            {["all", ...eras].map((d) => <button key={d} type="button" role="radio" aria-checked={era === d} className={era === d ? "is-on" : ""} onClick={() => setEra(d)}>{d === "all" ? "全部时代" : d}</button>)}
          </div>
          <Segmented label="排序" size="sm" value={sort} onChange={setSort} options={sorts} />
        </div>

        <div className="v3-rows rise" style={{ "--d": 4 }} role="list" aria-label="人物列表" onMouseLeave={() => setFocus(null)}>
          <div className="v3-rows__head" aria-hidden="true"><span>人物</span><span>板块</span><span>一生走势</span><span>峰值</span><span>后世评价</span></div>
          {list.map((f) => {
            const at = tray.indexOf(f.id);
            return (
              <div key={f.id} role="listitem" className={`v3-row${at >= 0 ? " is-picked" : ""}${shown?.id === f.id ? " is-focus" : ""}`} style={at >= 0 ? { "--c": `var(--p${at})` } : undefined}
                draggable onDragStart={(e) => startDrag(e, f.id)} onMouseEnter={() => setFocus(f.id)} onFocus={() => setFocus(f.id)}>
                <button type="button" className="v3-row__check" onClick={() => (at >= 0 ? remove(f.id) : add(f.id))} aria-label={`${f.name}：${at >= 0 ? "移出对比" : "加入对比"}`} title={at >= 0 ? "移出对比栏" : "加入对比栏"}>{at >= 0 ? (at ? "B" : "A") : "+"}</button>
                <button type="button" className="v3-row__main" onClick={() => setOpen(f.id)} aria-label={`${f.name}：查看完整角色卡`}>
                  <span className="v3-row__who"><Avatar f={f} role={roles[f.id]} /><span><b>{f.name}</b><small>{f.dynasty} · {years(f)}</small></span></span>
                  <span className="v3-row__tag">{domainLabel[f.domain] ?? f.domain}</span>
                  <Spark f={f} />
                  <span className="v3-row__peak"><b>{f.peak?.score ?? "—"}</b><small>{f.peak?.title}</small></span>
                  <span className="v3-row__legacy"><b>{f.legacy.score}</b><small>{f.legacy.tier}</small></span>
                </button>
                <button type="button" className="v3-row__go" onClick={() => go([f.id])} aria-label={`单看${f.name}的走势`}><span>看走势 </span>→</button>
              </div>
            );
          })}
          {!list.length && <p className="v3-rows__empty">这个条件下没有人物，换个板块或关键词试试</p>}
        </div>
      </div>

      <div className="v3-roles__aside rise" style={{ "--d": 2 }}>
        <BriefCard f={shown} role={roles[shown?.id]} onOpen={setOpen} onAdd={add} />
      </div>

      <div className={`v3-tray${tray.length ? " is-on" : ""}`} role="region" aria-label="对比栏">
        <div className="v3-tray__slots">
          {[0, 1].map((i) => {
            const f = figureById[tray[i]];
            return (
              <span key={i} className={`v3-tray__slot${f ? " is-full" : ""}${over === i ? " is-over" : ""}`} style={{ "--c": `var(--p${i})` }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(i); }} onDragLeave={() => setOver(-1)} onDrop={drop(i)}>
                {f ? <Avatar f={f} role={roles[f.id]} size="xs" /> : <i className="v3-dot" />}
                {f ? <><b>{f.name}</b><button type="button" onClick={() => remove(f.id)} aria-label={`移出${f.name}`}>×</button></> : <em>{i ? "B：拖到这里（可不选）" : "A：把人拖到这里或点 +"}</em>}
              </span>
            );
          })}
        </div>
        <p className="v3-tray__now">主图现在：{[current.left, current.right].filter(Boolean).map((id) => figureById[id]?.name).join(" 对比 ")}</p>
        {tray.length > 0 && <button type="button" className="v3-tray__clear" onClick={() => setTray([])}>清空</button>}
        <button type="button" className="v3-tray__go" disabled={!tray.length} onClick={() => go(tray)}>{tray.length === 2 ? "对比走势 →" : "看走势 →"}</button>
      </div>

      {open && figureById[open] && <FullCard f={figureById[open]} role={roles[open]} tray={tray} onClose={() => setOpen(null)} onAdd={add} onSolo={(id) => go([id])} />}
    </section>
  );
}
