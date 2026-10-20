// 人物选择：行情卡左半边的头像按钮 + 搜索弹层（按朝代分组，键盘上下选、回车确认、Esc 关闭）。
// 弹层通过 portal 挂到 body 顶层、按按钮位置定位，不受任何区块的层叠上下文或 overflow 裁切。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { figures, dynastyOrder } from "../data.js";
import { Scroll } from "./bits.jsx";
import { Avatar, lifeYears as years, useRoles } from "./people.jsx";
import { eraOf } from "./eras.js";
import { searchFigures } from "./search.js";
import { ChevronIcon, ICON, PlusIcon, SearchIcon } from "./icons.jsx";

export function Picker({ value, onChange, slot, allowEmpty = false, exclude }) {
  const [open, setOpen] = useState(false);
  // 退场动画：关闭后再留 160ms 播完收起（原来是直接消失）。
  const [leaving, setLeaving] = useState(false);
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open) { wasOpen.current = true; setLeaving(false); return; }
    if (!wasOpen.current) return;
    setLeaving(true);
    const t = setTimeout(() => { setLeaving(false); setPlace(null); }, 160); // 退场播完才清掉位置
    return () => clearTimeout(t);
  }, [open]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const pop = useRef(null);
  const input = useRef(null);
  const [place, setPlace] = useState(null);
  const current = figures.find((f) => f.id === value);
  const roles = useRoles({ idle: true });

  const list = useMemo(() => {
    // 没输入时按朝代、生年排（分组浏览）；输入了就按相关度排（src/v3/search.js），不再分朝代组。
    const pool = figures.filter((f) => f.id !== exclude);
    const found = searchFigures(pool, q);
    if (found) return found.slice(0, 120).map((r) => r.f);
    const order = (d) => dynastyOrder.indexOf(d);
    return pool.sort((a, b) => order(a.dynasty) - order(b.dynasty) || a.born - b.born);
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
  useEffect(() => { pop.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = (id) => { onChange(id); setOpen(false); setQ(""); };
  const key = (e) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 输入法选字时的回车不算确认
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && list[active]) choose(list[active].id);
    else if (e.key === "Escape") setOpen(false);
  };

  let lastDynasty = null;
  return (
    <div className={`v3-picker${open ? " is-open" : ""}`} ref={root} data-era={current ? eraOf(current) : undefined} style={{ "--c": `var(--p${slot})` }}>
      <button type="button" className="v3-picker__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={current ? `换一个人（现在是${current.name}）` : "加一个人，同图对比"}>
        {current ? (
          <>
            <span className="v3-picker__mark"><Avatar f={current} role={roles[current.id]} size="md" /></span>
            <span className="v3-picker__text"><b>{current.name}</b><small>{current.dynasty} · {years(current)}</small></span>
          </>
        ) : (
          <>
            <span className="v3-picker__mark is-empty"><PlusIcon {...ICON} size={18} /></span>
            <span className="v3-picker__text v3-picker__text--empty"><b>加一个人对比</b><small>同时代按纪年对齐，跨时代按年龄</small></span>
          </>
        )}
        <ChevronIcon {...ICON} className="v3-picker__chev" />
      </button>
      {(open || leaving) && place && createPortal(
        <div className={`v3-picker__pop lg${open ? "" : " is-closing"}`} ref={pop} role="dialog" aria-label="选择人物" style={{ left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight, "--c": `var(--p${slot})` }}>
          <div className="v3-picker__search">
            <SearchIcon {...ICON} />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="搜人名、朝代或事件，如「长征」" aria-label="搜索人物" role="combobox" aria-expanded="true" aria-controls={`v3-list-${slot}`} />
          </div>
          <Scroll className="v3-picker__scroll"><ul className="v3-picker__list" role="listbox" id={`v3-list-${slot}`}>
            {allowEmpty && value && <li><button type="button" className="v3-picker__clear" onClick={() => choose("")}>只看一个人</button></li>}
            {list.map((f, i) => {
              const head = !q.trim() && f.dynasty !== lastDynasty ? (lastDynasty = f.dynasty) : null;
              return [
                head && <li key={`h-${head}`} className="v3-picker__group">{head}</li>,
                <li key={f.id} role="option" aria-selected={i === active} data-era={eraOf(f)}>
                  <button type="button" data-i={i} className={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)} onClick={() => choose(f.id)}>
                    <Avatar f={f} role={roles[f.id]} size="xs" /><b>{f.name}</b><span>{years(f)}</span><em>{f.legacy.score}</em>
                  </button>
                </li>,
              ];
            })}
            {!list.length && <li className="v3-picker__empty">没有找到，换个关键词试试</li>}
          </ul></Scroll>
        </div>,
        document.body,
      )}
    </div>
  );
}
