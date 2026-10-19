// ⌘K 搜索面板：任何页面按 ⌘K / Ctrl+K（走势页也可以按 /）打开，直接搜人并决定去哪。
// - 回车：看这个人的走势；⇧回车：和主图上的人对比；⌘/Ctrl+回车：打开 TA 的完整角色卡。
// - 不输入时给出页面切换、主题、复制链接和后世评价最高的几个人。
// - 中文输入法正在拼字时按回车不算确认（isComposing），免得选字时就跳走了。
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { figures, figureById } from "../data.js";
import { Avatar, lifeYears, useRoles } from "./people.jsx";
import { Scroll } from "./bits.jsx";
import { eraOf } from "./eras.js";
import { ChartIcon, CompareIcon, EnterIcon, ICON, LinkIcon, MoonIcon, RolesIcon, SearchIcon, SunIcon } from "./icons.jsx";

const TOP = [...figures].sort((a, b) => b.legacy.score - a.legacy.score).slice(0, 8);

function search(q) {
  const words = q.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hit = figures.filter((f) => words.every((w) => f.searchText.includes(w)));
  const rank = (f) => (f.name === q.trim() ? 0 : f.name.startsWith(words[0]) ? 1 : f.name.includes(words[0]) ? 2 : 3);
  return hit.sort((a, b) => rank(a) - rank(b) || b.legacy.score - a.legacy.score).slice(0, 40);
}

export function CommandPalette({ open, onClose, page, current, themeKey, actions }) {
  const roles = useRoles();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const anchor = figureById[current.left];

  const people = useMemo(() => (q.trim() ? search(q) : TOP), [q]);
  const commands = useMemo(() => (q.trim() ? [] : [
    page === "chart" ? { id: "go-roles", icon: RolesIcon, label: "去「角色」页", hint: "按板块浏览 300 位人物", run: () => actions.page("roles") }
      : { id: "go-chart", icon: ChartIcon, label: "回到「走势」", hint: `主图：${[current.left, current.right].filter(Boolean).map((id) => figureById[id]?.name).join(" 对比 ")}`, run: () => actions.page("chart") },
    { id: "theme", icon: themeKey === "b" ? SunIcon : MoonIcon, label: themeKey === "b" ? "换成朱砂（浅色）" : "换成玉衡（深色）", hint: "两套主题", run: actions.theme },
    { id: "link", icon: LinkIcon, label: "复制当前页面链接", hint: "人物组合、板块和打开的卡片都在链接里", run: actions.share },
  ]), [q, page, themeKey, current.left, current.right]);
  const rows = [...commands.map((c) => ({ kind: "cmd", ...c })), ...people.map((f) => ({ kind: "fig", id: f.id, f }))];

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const prev = document.activeElement;
    requestAnimationFrame(() => input.current?.focus());
    return () => prev?.focus?.({ preventScroll: true });
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  if (!open) return null;
  const run = (row, how = "chart") => {
    if (!row) return;
    onClose();
    if (row.kind === "cmd") { row.run(); return; }
    if (how === "compare") actions.compare(row.id);
    else if (how === "role") actions.role(row.id);
    else actions.chart(row.id);
  };
  const key = (e) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(rows[active], e.metaKey || e.ctrlKey ? "role" : e.shiftKey ? "compare" : "chart"); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };
  const canCompare = (id) => anchor && id !== anchor.id;

  let head = null;
  return createPortal(
    <div className="v3-cmd" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="v3-cmd__panel lg" role="dialog" aria-modal="true" aria-label="搜索人物">
        <label className="v3-cmd__search">
          <SearchIcon {...ICON} size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="搜人名、字号、朝代或事件" aria-label="搜索人物" role="combobox" aria-expanded="true" aria-controls="v3-cmd-list" aria-activedescendant={`v3-cmd-${active}`} />
          <kbd>Esc</kbd>
        </label>
        <Scroll className="v3-cmd__scroll">
          <ul className="v3-cmd__list" id="v3-cmd-list" role="listbox" ref={list}>
            {rows.map((row, i) => {
              const group = row.kind === "cmd" ? "操作" : q.trim() ? `人物 · ${people.length === 40 ? "前 40 个" : `${people.length} 个`}` : "后世评价最高";
              const label = group !== head ? (head = group) : null;
              return [
                label && <li key={`g-${label}`} className="v3-cmd__group" role="presentation">{label}</li>,
                <li key={row.kind + row.id} id={`v3-cmd-${i}`} data-era={row.f ? eraOf(row.f) : undefined} role="option" aria-selected={i === active} data-i={i} className={`v3-cmd__row${i === active ? " is-active" : ""}`}
                  onPointerMove={() => i !== active && setActive(i)} onClick={() => run(row)}>
                  {row.kind === "cmd" ? (
                    <>
                      <span className="v3-cmd__icon"><row.icon {...ICON} /></span>
                      <span className="v3-cmd__text"><b>{row.label}</b><small>{row.hint}</small></span>
                    </>
                  ) : (
                    <>
                      <Avatar f={row.f} role={roles[row.id]} size="sm" />
                      <span className="v3-cmd__text"><b>{row.f.name}</b><small>{row.f.dynasty} · {lifeYears(row.f)}</small></span>
                      <span className="v3-cmd__score" title="后世评价">{row.f.legacy.score}</span>
                      {i === active && (
                        <span className="v3-cmd__acts" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => run(row, "chart")}><ChartIcon {...ICON} size={14} />走势</button>
                          {canCompare(row.id) && <button type="button" onClick={() => run(row, "compare")}><CompareIcon {...ICON} size={14} />对比{anchor.name}</button>}
                          <button type="button" onClick={() => run(row, "role")}><RolesIcon {...ICON} size={14} />角色卡</button>
                        </span>
                      )}
                    </>
                  )}
                </li>,
              ];
            })}
            {q.trim() && !people.length && <li className="v3-cmd__empty">没有找到「{q.trim()}」。试试字号（如「孔明」）、朝代（如「北宋」）或事件（如「变法」）。</li>}
          </ul>
        </Scroll>
        <footer className="v3-cmd__foot">
          <span><kbd><EnterIcon {...ICON} size={12} /></kbd>看走势</span>
          {anchor && <span><kbd>⇧</kbd><kbd><EnterIcon {...ICON} size={12} /></kbd>和{anchor.name}对比</span>}
          <span><kbd>Ctrl</kbd><kbd><EnterIcon {...ICON} size={12} /></kbd>角色卡</span>
          <span><kbd>↑</kbd><kbd>↓</kbd>选择</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
