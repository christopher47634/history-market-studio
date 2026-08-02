import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  MagnifyingGlass,
  ArrowsLeftRight,
  CaretDown,
  ClockCounterClockwise,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { dynastyOrder } from "../data.js";
import { useHistoryData } from "../historyDataContext.jsx";
import {
  figureDomains,
  filterFigures,
  getDynastiesForPeriod,
  getIndexStats,
  historyPeriods,
  indexSorts,
} from "../figureIndex.js";

function PersonSelect({
  value,
  other,
  onChange,
  label,
  portalMenu = false,
  onPreview,
  onPreviewEnd,
}) {
  const { figures } = useHistoryData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [dynasty, setDynasty] = useState("全部");
  const [domain, setDomain] = useState("all");
  const [sort, setSort] = useState("chronology");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const stats = useMemo(() => getIndexStats(figures), [figures]);
  const availableDynasties = useMemo(
    () => getDynastiesForPeriod(period, dynastyOrder),
    [period],
  );
  const results = useMemo(
    () =>
      filterFigures(figures, {
        query,
        period,
        dynasty,
        domain,
        sort,
        excludeId: other.id,
      }),
    [figures, query, period, dynasty, domain, sort, other.id],
  );
  useLayoutEffect(() => {
    if (!open || !portalMenu || !triggerRef.current) return;
    const placeMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(456, window.innerWidth - 24);
      const desiredHeight = Math.min(620, window.innerHeight - 24);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const openUp = below < 440 && above > below;
      const height = Math.max(
        360,
        Math.min(desiredHeight, openUp ? above - 8 : below - 8),
      );
      const left = Math.max(
        12,
        Math.min(rect.left, window.innerWidth - width - 12),
      );
      const top = openUp
        ? Math.max(12, rect.top - height - 8)
        : rect.bottom + 8;
      setMenuPosition({ left, top, width, height });
    };
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, portalMenu]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);
  const resetFilters = () => {
    setPeriod("all");
    setDynasty("全部");
    setDomain("all");
  };
  const menu = (
    <div
      ref={menuRef}
      className={`person-select__menu ${portalMenu ? "person-select__menu--portal" : ""}`}
      style={portalMenu && menuPosition ? menuPosition : undefined}
      role="dialog"
      aria-label={`${label}人物选择`}
    >
      <header className="person-index__overview">
        <span>
          <b>中国人物谱系</b>
          <small>按分期、朝代与领域交叉定位</small>
        </span>
        <em>
          {stats.people} 人 · {stats.events} 节点
        </em>
      </header>
      <div className="person-select__search">
        <MagnifyingGlass size={15} />
        <input
          autoFocus
          aria-label={`${label}搜索`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜姓名、字号、事件或领域…"
        />
      </div>
      <section className="person-index__group">
        <div className="person-index__label">
          <span>历史分期</span>
          <small>由早至今</small>
        </div>
        <div className="person-index__chips" aria-label="历史分期筛选">
          {historyPeriods.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={period === item.id}
              className={period === item.id ? "is-active" : ""}
              onClick={() => {
                setPeriod(item.id);
                setDynasty("全部");
              }}
            >
              {item.short}
            </button>
          ))}
        </div>
      </section>
      <section className="person-index__group">
        <div className="person-index__label">
          <span>朝代 / 时期</span>
          <ClockCounterClockwise />
        </div>
        <div className="person-index__chips" aria-label="朝代筛选">
          {["全部", ...availableDynasties].map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={dynasty === item}
              className={dynasty === item ? "is-active" : ""}
              onClick={() => setDynasty(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <section className="person-index__group person-index__group--domain">
        <div className="person-index__label">
          <span>人物领域</span>
          <SlidersHorizontal />
        </div>
        <div className="person-index__chips" aria-label="人物领域筛选">
          {figureDomains.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={domain === item.id}
              className={domain === item.id ? "is-active" : ""}
              onClick={() => setDomain(item.id)}
            >
              {item.label.replace("全部领域", "全部")}
            </button>
          ))}
        </div>
      </section>
      <div className="person-select__summary">
        <span>
          {dynasty !== "全部"
            ? dynasty
            : historyPeriods.find((item) => item.id === period)?.label ||
              "全部"}
          {domain !== "all" ? ` · ${domain}` : ""}
        </span>
        <b>{results.length} 位可选</b>
        <label className="person-index__sort">
          <span>排序</span>
          <select
            aria-label="人物排序方式"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {indexSorts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="person-select__results" aria-live="polite">
        {results.map((person) => (
          <button
            type="button"
            key={person.id}
            onClick={() => {
              onChange(person);
              setOpen(false);
              setQuery("");
            }}
          >
            <span
              className="person-select__dot"
              style={{ background: person.color }}
            />
            <span>
              <b>
                {person.name}
                <em>{person.courtesy}</em>
              </b>
              <small>
                {person.dynasty} · {person.era} · {person.domain}
              </small>
            </span>
            <strong className="person-select__meta">
              {person.lifeSpan} 岁
              <small>{person.events.length} 节点</small>
            </strong>
          </button>
        ))}
        {!results.length && (
          <div className="person-index__empty">
            <p>没有匹配人物，试试事件名、字号或放宽分类。</p>
            <button type="button" onClick={resetFilters}>
              清除分类筛选
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div
      className="person-select"
      ref={rootRef}
      onMouseEnter={() => onPreview?.(value)}
      onMouseMove={() => onPreview?.(value)}
      onMouseLeave={() => onPreviewEnd?.(value)}
      onFocusCapture={() => onPreview?.(value)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onPreviewEnd?.(value);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="person-select__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="person-select__mark"
          style={{ background: value.color }}
        >
          {value.name[0]}
        </span>
        <span>
          <small>
            {label} · {value.dynasty}
          </small>
          <b>{value.name}</b>
          <em>{value.courtesy}</em>
        </span>
        <CaretDown size={14} />
      </button>
      {open &&
        (portalMenu && typeof document !== "undefined"
          ? createPortal(menu, document.body)
          : menu)}
    </div>
  );
}

export function ComparisonPicker({
  left,
  right,
  onLeft,
  onRight,
  compact = false,
  portalMenus = false,
  onPreviewLeft,
  onPreviewRight,
  onPreviewEnd,
}) {
  const [swapping, setSwapping] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [tooltipSuppressed, setTooltipSuppressed] = useState(false);
  const swapTimer = useRef(0);
  const tooltipId = useId();
  useEffect(() => () => window.clearTimeout(swapTimer.current), []);
  const swap = () => {
    if (swapping || left.id === right.id) return;
    const previousLeft = left;
    const previousRight = right;
    flushSync(() => setSwapping(true));
    const commit = () => {
      flushSync(() => {
        onLeft(previousRight);
        onRight(previousLeft);
      });
    };
    if (typeof document !== "undefined" && document.startViewTransition) {
      try {
        document.startViewTransition(commit);
      } catch {
        commit();
      }
    } else {
      commit();
    }
    setAnnouncement(
      `已交换：人物 A 为${previousRight.name}，人物 B 为${previousLeft.name}`,
    );
    window.clearTimeout(swapTimer.current);
    swapTimer.current = window.setTimeout(() => setSwapping(false), 460);
  };
  return (
    <div
      className={`comparison-picker ${compact ? "comparison-picker--compact" : ""} ${swapping ? "is-swapping" : ""}`}
    >
      <span className="a11y-status" aria-live="polite">
        {announcement}
      </span>
      <PersonSelect
        value={left}
        other={right}
        onChange={onLeft}
        label="人物 A"
        portalMenu={portalMenus}
        onPreview={onPreviewLeft}
        onPreviewEnd={onPreviewEnd}
      />
      <button
        type="button"
        className={`swap-button ${swapping ? "is-swapping" : ""} ${tooltipSuppressed ? "is-tooltip-suppressed" : ""}`}
        onClick={swap}
        onPointerEnter={() => setTooltipSuppressed(false)}
        onPointerLeave={() => setTooltipSuppressed(false)}
        onFocus={() => setTooltipSuppressed(false)}
        onBlur={() => setTooltipSuppressed(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          setTooltipSuppressed(true);
          event.stopPropagation();
        }}
        aria-busy={swapping}
        aria-disabled={swapping}
        aria-describedby={tooltipId}
        aria-label={`交换 ${left.name} 与 ${right.name}`}
      >
        <span className="swap-button__halo" aria-hidden="true" />
        <span className="swap-button__glyph" aria-hidden="true">
          <ArrowsLeftRight size={18} />
        </span>
        <span id={tooltipId} role="tooltip" className="swap-button__tooltip">
          交换 A / B
        </span>
      </button>
      <PersonSelect
        value={right}
        other={left}
        onChange={onRight}
        label="人物 B"
        portalMenu={portalMenus}
        onPreview={onPreviewRight}
        onPreviewEnd={onPreviewEnd}
      />
    </div>
  );
}
