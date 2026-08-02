import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  BookmarkSimple,
  ChartBar,
  ChartLineUp,
  CloudCheck,
  CloudSlash,
  CompassRose,
  GearSix,
  Question,
  SlidersHorizontal,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { CatalogSearch } from "../components/CatalogSearch.jsx";
import { ComparisonPicker } from "../components/ComparisonPicker.jsx";
import { HistoricalCitation } from "../components/HistoricalCitation.jsx";
import { LifeMarketChart } from "../components/LifeMarketChart.jsx";
import { getFloatingEventCardPosition } from "../components/floatingEventCard.js";
import {
  getPairColors,
  figures,
  formatAge,
} from "../data.js";
import { useHistoryComparison } from "../historyDataContext.jsx";

const hoverCapable = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover:hover) and (pointer:fine)").matches;
const floatingPosition = (pointer, compact = false, measured = {}) =>
  getFloatingEventCardPosition(pointer, {
    width: measured.width || 352,
    height: measured.height || (compact ? 300 : 410),
    gap: 14,
    anchorLead: 38,
  });

export function BTerminal({ left, right, onLeft, onRight, onOpenSettings, dataStatus, dataMeta, lastSyncedAt }) {
  const [mode, setMode] = useState("line");
  const [candleId, setCandleId] = useState(left.id);
  const [active, setActive] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const [granularity, setGranularity] = useState({ label: "按年" });
  const [sourceFilter, setSourceFilter] = useState("全部");
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const closeTimer = useRef(0);
  const detailCardRef = useRef(null);
  const cardAnchorRef = useRef(null);
  const { comparison, events, status: comparisonStatus } = useHistoryComparison(left, right);
  const pairColors = useMemo(() => getPairColors(left, right), [left, right]);
  const candleFigure = candleId === right.id ? right : left;
  const displayEvents =
    mode === "line"
      ? events
      : candleFigure.events
          .filter((event) => !event.posthumous)
          .map((event) => ({
            ...event,
            figure: candleFigure,
            axisLabel: formatAge(event.age),
          }));
  const sourceType = useCallback(
    (event) =>
      /史记|汉书|三国志|旧唐书|新唐书|宋史|明史|清史/.test(event.source.label)
        ? "正史"
        : /通鉴|左传|春秋|编年/.test(event.source.label)
          ? "编年"
          : "杂记",
    [],
  );
  const filteredEvents = useMemo(
    () =>
      sourceFilter === "全部"
        ? displayEvents
        : displayEvents.filter((event) => sourceType(event) === sourceFilter),
    [displayEvents, sourceFilter, sourceType],
  );
  useEffect(() => {
    if (candleId !== left.id && candleId !== right.id) setCandleId(left.id);
  }, [left.id, right.id, candleId]);
  useEffect(() => {
    setActive(null);
    setDetailOpen(false);
  }, [left.id, right.id, mode, candleId]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!detailOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailOpen]);
  useLayoutEffect(() => {
    if (!detailOpen || !detailCardRef.current || !cardAnchorRef.current) return;
    const rect = detailCardRef.current.getBoundingClientRect();
    setCardPosition(
      floatingPosition(cardAnchorRef.current, mode === "line", {
        width: rect.width,
        height: rect.height,
      }),
    );
  }, [detailOpen, active?.title, active?.figure?.id, mode]);
  const cancelClose = useCallback(
    () => window.clearTimeout(closeTimer.current),
    [],
  );
  const closeSoon = useCallback(() => {
    if (!hoverCapable()) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDetailOpen(false), 150);
  }, []);
  const focus = useCallback(
    (event, pointer) => {
      if (!event) return;
      window.clearTimeout(closeTimer.current);
      setActive(event);
      if (Number.isFinite(pointer?.snapX)) {
        cardAnchorRef.current = pointer;
        setCardPosition(floatingPosition(pointer, mode === "line"));
        setDetailOpen(true);
      } else {
        setDetailOpen(false);
      }
    },
    [mode],
  );
  const anchorDetail = useCallback(
    (event, pointer) => {
      if (!event || !Number.isFinite(pointer?.snapX)) return;
      window.clearTimeout(closeTimer.current);
      setActive(event);
      cardAnchorRef.current = pointer;
      setCardPosition(floatingPosition(pointer, mode === "line"));
      setDetailOpen(true);
    },
    [mode],
  );
  const openSettings = useCallback(
    (section = "appearance") => {
      window.clearTimeout(closeTimer.current);
      setDetailOpen(false);
      onOpenSettings(section);
    },
    [onOpenSettings],
  );
  const saveComparison = useCallback(() => {
    const key = "history-market-saved-pairs";
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      list = [];
    }
    const next = [
      { left: left.id, right: right.id, savedAt: new Date().toISOString() },
      ...list.filter(
        (item) => item.left !== left.id || item.right !== right.id,
      ),
    ].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }, [left.id, right.id]);
  const today = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("/", "-");
  return (
    <main className="yuheng-page">
      <header className="yuheng-header">
        <div className="yuheng-brand">
          <CompassRose />
          <span>
            <b>玉衡终端</b>
            <small>历史势能分析系统 · 教育研究版</small>
          </span>
        </div>
        <CatalogSearch onSelect={onLeft} />
        <time className={`history-sync history-sync--${dataStatus}`}>
          <small>{dataStatus === "live" || dataStatus === "refreshing" ? <CloudCheck /> : <CloudSlash />} {dataStatus === "live" ? "数据已同步" : dataStatus === "refreshing" ? "正在刷新" : dataStatus === "connecting" ? "正在连接" : "离线数据"}</small>
          <b>{today}</b>
        </time>
        <button
          type="button"
          className="icon-control"
          onClick={() => openSettings("appearance")}
          aria-label="打开设置"
        >
          <GearSix />
        </button>
      </header>

      <section className="yuheng-compare">
        <div>
          <b>对比组合</b>
          <small>可对比任意两位中国历史人物 · 按实际年龄共轴</small>
        </div>
        <ComparisonPicker
          left={left}
          right={right}
          onLeft={onLeft}
          onRight={onRight}
          compact
          portalMenus
        />
        <button
          type="button"
          className="yuheng-generate"
          onClick={(pointer) => focus(events[0] || null, pointer)}
        >
          生成对比 <span>→</span>
        </button>
        <button
          type="button"
          className={`yuheng-save ${saved ? "is-saved" : ""}`}
          onClick={saveComparison}
        >
          <BookmarkSimple weight={saved ? "fill" : "regular"} />
          {saved ? "已保存" : "保存对比"}
        </button>
      </section>

      <div className="yuheng-workspace">
        <section className="yuheng-chart-panel">
          <header>
            <div>
              <h1>
                人生影响力对比 <Question />
              </h1>
              <p>0—100：越高代表当时可调动的权力、军事、盟友与民心资源越强</p>
            </div>
            <div className="yuheng-chart-tools">
              <span>
                <i style={{ background: pairColors[0] }} />
                {left.name}
              </span>
              <span>
                <i style={{ background: pairColors[1] }} />
                {right.name}
              </span>
              <button type="button" onClick={() => openSettings("chart")}>
                <SlidersHorizontal />
                显示设置
              </button>
            </div>
          </header>
          <div className="yuheng-modebar">
            <div>
              <button
                type="button"
                aria-pressed={mode === "line"}
                className={mode === "line" ? "is-active" : ""}
                onClick={() => setMode("line")}
              >
                <ChartLineUp />
                折线
              </button>
              <button
                type="button"
                aria-pressed={mode === "candlestick"}
                className={mode === "candlestick" ? "is-active" : ""}
                onClick={() => setMode("candlestick")}
              >
                <ChartBar />K 线
              </button>
            </div>
            {mode === "candlestick" && (
              <div className="yuheng-candle-person">
                <button
                  type="button"
                  className={candleFigure.id === left.id ? "is-active" : ""}
                  onClick={() => setCandleId(left.id)}
                >
                  {left.name}
                </button>
                <button
                  type="button"
                  className={candleFigure.id === right.id ? "is-active" : ""}
                  onClick={() => setCandleId(right.id)}
                >
                  {right.name}
                </button>
                <span>{granularity.label}</span>
              </div>
            )}
          </div>
          <LifeMarketChart
            left={left}
            right={right}
            mode={mode}
            candleFigure={candleFigure}
            variant="terminal"
            activeEvent={active}
            onEventFocus={focus}
            onEventAnchor={anchorDetail}
            onEventBlur={closeSoon}
            onGranularityChange={setGranularity}
          />
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {detailOpen && active && (
                  <motion.article
                    ref={detailCardRef}
                    key={`${active.figure.id}-${active.title}`}
                    className={`yuheng-detail-card event-float-card event-float-card--anchor-${cardPosition.side || "right"}`}
                    style={{
                      left: cardPosition.x,
                      top: cardPosition.y,
                      "--anchor-y": `${cardPosition.anchorOffsetY || 56}px`,
                      "--anchor-x": `${cardPosition.anchorOffsetX || 42}px`,
                      "--anchor-gap": `${cardPosition.anchorGap || 14}px`,
                    }}
                    initial={{
                      opacity: 0,
                      y: 7,
                      scale: 0.975,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: 4,
                      scale: 0.982,
                      filter: "blur(2px)",
                    }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={closeSoon}
                  >
                    <button
                      type="button"
                      className="yuheng-detail-close"
                      onClick={() => setDetailOpen(false)}
                      aria-label="关闭事件详情"
                    >
                      <X />
                    </button>
                    <header>
                      <span>
                        <b>{active.title}</b>
                        <small>
                          {formatAge(active.age)} · {active.figure.name}
                        </small>
                      </span>
                      <em>
                        {mode === "candlestick" ? "微观行情" : "关键转折"}
                      </em>
                    </header>
                    <p>{active.summary}</p>
                    <HistoricalCitation event={active} tone="jade" />
                    {mode === "candlestick" && (
                      <div className="yuheng-market-note">
                        <b>{active.delta >= 0 ? "上行催化" : "下行冲击"}</b>
                        <span>
                          该节点首先改变{active.dimension}
                          维度，随后通过组织、联盟与安全预期传导，使这一年龄区间的开盘—收盘结构出现
                          {active.delta >= 0 ? "抬升" : "回撤"}。
                        </span>
                      </div>
                    )}
                    <div className="yuheng-direct-impact">
                      <span>
                        <small>{active.figure.name} 势能</small>
                        <b className={active.delta >= 0 ? "is-up" : "is-down"}>
                          {active.delta >= 0 ? "+" : ""}
                          {active.delta.toFixed(1)}
                        </b>
                      </span>
                      <span>
                        <small>影响维度</small>
                        <b>{active.dimension}</b>
                      </span>
                    </div>
                    <div className="yuheng-impact-grid">
                      {["权力", "军事", "联盟", "安全", "民心"].map(
                        (label, index) => (
                          <span key={label}>
                            <b>{label}</b>
                            <em
                              className={
                                active.delta >= 0 ? "is-up" : "is-down"
                              }
                            >
                              {active.delta >= 0 ? "+" : "-"}
                              {(
                                Math.abs(active.delta) === 0
                                  ? 0
                                  : Math.abs(active.delta) / (index + 1) +
                                    index * 0.7
                              ).toFixed(1)}
                            </em>
                          </span>
                        ),
                      )}
                    </div>
                    <footer>
                      <span>史料依据 · {active.source.label}</span>
                      <b>可信度 88%</b>
                    </footer>
                  </motion.article>
                )}
              </AnimatePresence>,
              document.body,
            )}
        </section>

        <aside className="yuheng-evidence">
          <header>
            <h2>
              史料依据 <Question />
            </h2>
            <div>
              {["全部", "正史", "编年", "杂记"].map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={sourceFilter === filter ? "is-active" : ""}
                  onClick={() => {
                    setSourceFilter(filter);
                    setEvidenceExpanded(false);
                  }}
                >
                  {filter}
                  {filter === "全部" && (
                    <>
                      {" "}
                      <b>{displayEvents.length}</b>
                    </>
                  )}
                </button>
              ))}
            </div>
          </header>
          <div className="yuheng-evidence-list">
            {(evidenceExpanded
              ? filteredEvents
              : filteredEvents.slice(0, 6)
            ).map((event, index) => (
              <button
                type="button"
                key={`${event.figure.id}-${event.title}`}
                className={
                  active?.title === event.title &&
                  active?.figure?.id === event.figure.id
                    ? "is-active"
                    : ""
                }
                onMouseEnter={(pointer) => focus(event, pointer)}
                onMouseLeave={closeSoon}
                onFocus={(pointer) => focus(event, pointer)}
                onBlur={closeSoon}
              >
                <i style={{ borderColor: event.figure.color }} />
                <span>
                  <b>
                    《
                    {event.source.label
                      .replaceAll("《", "")
                      .replaceAll("》", "")}
                    》
                  </b>
                  <p>{event.summary}</p>
                  <small>
                    {event.figure.name} ·{" "}
                    {event.axisLabel || formatAge(event.age)}
                  </small>
                </span>
                <em>相关度 {Math.max(60, 95 - index * 5)}%</em>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="yuheng-expand"
            onClick={() =>
              filteredEvents.length > 6
                ? setEvidenceExpanded((value) => !value)
                : openSettings("timeline")
            }
          >
            {filteredEvents.length > 6
              ? evidenceExpanded
                ? "收起史料⌃"
                : "展开全部史料⌄"
              : "在设置中查看事件轴⌄"}
          </button>
        </aside>
      </div>
      <span className="yuheng-status">
        {comparisonStatus === "live" ? <CloudCheck /> : <Sparkle />}
        人物库 {dataMeta?.people || figures.length} 位 · 年龄轴 0—{comparison.maxAge} 岁 ·
        {comparisonStatus === "live" ? "实时接口已贯通" : "本地模型安全回退"}
      </span>
    </main>
  );
}
