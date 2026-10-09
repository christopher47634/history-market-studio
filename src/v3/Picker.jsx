// 人物选择：胶囊按钮 + 搜索弹层（按朝代分组，键盘上下选、回车确认、Esc 关闭）。
// 弹层通过 portal 挂到 body 顶层、按按钮位置定位，不受任何区块的层叠上下文或 overflow 裁切。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { figures, dynastyOrder } from "../data.js";

const years = (f) => `${f.born < 0 ? `前${-f.born}` : f.born}—${f.died < 0 ? `前${-f.died}` : f.died}`;

export function Picker({ value, onChange, slot, allowEmpty = false, exclude }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const pop = useRef(null);
  const input = useRef(null);
  const [place, setPlace] = useState(null);
  const current = figures.find((f) => f.id === value);

  const list = useMemo(() => {
    const words = q.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
    const hit = figures.filter((f) => f.id !== exclude && words.every((w) => f.searchText.includes(w)));
    const order = (d) => dynastyOrder.indexOf(d);
    return hit.sort((a, b) => order(a.dynasty) - order(b.dynasty) || a.born - b.born).slice(0, 120);
  }, [q, exclude]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const away = (e) => { if (!root.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [open]);
  // 弹层在定位好之后才挂上，所以等它出现再聚焦搜索框。
  const shown = open && !!place;
  useEffect(() => { if (shown) input.current?.focus({ preventScroll: true }); }, [shown]);
  useEffect(() => { if (!open) setPlace(null); }, [open]);
  // 跟着按钮走：打开时、滚动或改窗口大小时重新定位；窄屏铺满左右留 16px。
  useLayoutEffect(() => {
    if (!open) return;
    const put = () => {
      const r = root.current.getBoundingClientRect();
      const narrow = innerWidth <= 720;
      const width = narrow ? innerWidth - 32 : Math.min(340, innerWidth - 32);
      const left = narrow ? 16 : Math.max(16, Math.min(r.left, innerWidth - width - 16));
      const top = r.bottom + 8;
      setPlace({ left, top, width, maxHeight: Math.max(220, innerHeight - top - 16) });
    };
    put();
    addEventListener("resize", put);
    addEventListener("scroll", put, true);
    return () => { removeEventListener("resize", put); removeEventListener("scroll", put, true); };
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { root.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = (id) => { onChange(id); setOpen(false); setQ(""); };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && list[active]) choose(list[active].id);
    else if (e.key === "Escape") setOpen(false);
  };

  let lastDynasty = null;
  return (
    <div className={`v3-picker${open ? " is-open" : ""}`} ref={root} style={{ "--c": `var(--p${slot})` }}>
      <button type="button" className="v3-picker__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {current ? (
          <>
            <span className="v3-picker__mark">{current.name[0]}</span>
            <span className="v3-picker__text"><b>{current.name}</b><small>{current.dynasty} · {years(current)}</small></span>
          </>
        ) : (
          <span className="v3-picker__text v3-picker__text--empty"><b>加一个人对比</b><small>同时代按纪年对齐</small></span>
        )}
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
      </button>
      {open && place && createPortal(
        <div className="v3-picker__pop" ref={pop} role="dialog" aria-label="选择人物" style={{ left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight, "--c": `var(--p${slot})` }}>
          <div className="v3-picker__search">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="搜人名、朝代或事件，如「长征」" aria-label="搜索人物" role="combobox" aria-expanded="true" aria-controls={`v3-list-${slot}`} />
          </div>
          <ul className="v3-picker__list" role="listbox" id={`v3-list-${slot}`}>
            {allowEmpty && value && <li><button type="button" className="v3-picker__clear" onClick={() => choose("")}>只看一个人</button></li>}
            {list.map((f, i) => {
              const head = f.dynasty !== lastDynasty ? (lastDynasty = f.dynasty) : null;
              return [
                head && <li key={`h-${head}`} className="v3-picker__group">{head}</li>,
                <li key={f.id} role="option" aria-selected={i === active}>
                  <button type="button" data-i={i} className={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)} onClick={() => choose(f.id)}>
                    <b>{f.name}</b><span>{years(f)}</span><em>{f.legacy.score}</em>
                  </button>
                </li>,
              ];
            })}
            {!list.length && <li className="v3-picker__empty">没有找到，换个关键词试试</li>}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
