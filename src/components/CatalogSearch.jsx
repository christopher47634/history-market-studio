import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import { useHistoryData } from "../historyDataContext.jsx";
import {
  figureDomains,
  filterFigures,
  getIndexStats,
  historyPeriods,
} from "../figureIndex.js";

export function CatalogSearch({
  onSelect,
  placeholder = "搜索人物、时代或事件",
}) {
  const { figures } = useHistoryData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("all");
  const [domain, setDomain] = useState("all");
  const root = useRef(null);
  const stats = useMemo(() => getIndexStats(figures), [figures]);
  const allResults = useMemo(
    () =>
      filterFigures(figures, {
        query,
        period,
        domain,
        sort: query.trim() ? "chronology" : "influence",
      }),
    [figures, query, period, domain],
  );
  const results = allResults.slice(0, 18);
  const hasFilters = period !== "all" || domain !== "all";

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const resetFilters = () => {
    setPeriod("all");
    setDomain("all");
  };

  return (
    <div className="catalog-search" ref={root}>
      <MagnifyingGlass />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={open}
        aria-haspopup="dialog"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label="清空搜索">
          <X />
        </button>
      )}
      {open && (
        <div
          className="catalog-search__menu catalog-index"
          role="dialog"
          aria-label="全史人物分类搜索"
        >
          <header className="catalog-index__header">
            <span>
              <b>中国人物总谱</b>
              <small>按分期与人物领域交叉检索</small>
            </span>
            <em>
              {stats.people} 人 · {stats.events} 节点
            </em>
          </header>
          <section className="catalog-index__section">
            <div className="catalog-index__label">
              <span>历史分期</span>
              <small>由早至今</small>
            </div>
            <div className="catalog-index__chips" aria-label="历史分期筛选">
              {historyPeriods.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={period === item.id ? "is-active" : ""}
                  aria-pressed={period === item.id}
                  onClick={() => setPeriod(item.id)}
                >
                  {item.short}
                </button>
              ))}
            </div>
          </section>
          <section className="catalog-index__section">
            <div className="catalog-index__label">
              <span>人物领域</span>
              <SlidersHorizontal />
            </div>
            <div className="catalog-index__chips" aria-label="人物领域筛选">
              {figureDomains.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={domain === item.id ? "is-active" : ""}
                  aria-pressed={domain === item.id}
                  onClick={() => setDomain(item.id)}
                >
                  {item.label.replace("全部领域", "全部")}
                </button>
              ))}
            </div>
          </section>
          <div className="catalog-index__summary">
            <span>{query.trim() ? `“${query.trim()}”` : "推荐人物"}</span>
            <b>{allResults.length} 位匹配</b>
          </div>
          <div className="catalog-index__results" aria-live="polite">
            {results.map((figure) => (
              <button
                type="button"
                key={figure.id}
                onClick={() => {
                  onSelect(figure);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <i style={{ background: figure.color }} />
                <span>
                  <b>
                    {figure.name}
                    <em>{figure.courtesy}</em>
                  </b>
                  <small>
                    {figure.dynasty} · {figure.era} · {figure.domain}
                  </small>
                </span>
                <strong>
                  {figure.lifeSpan} 岁
                  <small>{figure.events.length} 节点</small>
                </strong>
              </button>
            ))}
            {!results.length && (
              <div className="catalog-index__empty">
                <p>没有匹配人物，试试事件名、字号或放宽分类。</p>
                {hasFilters && (
                  <button type="button" onClick={resetFilters}>
                    清除分类筛选
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
