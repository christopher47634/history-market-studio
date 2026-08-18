import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChartBar,
  ChartLineUp,
  CaretLeft,
  CaretRight,
  CloudCheck,
  CloudSlash,
  GearSix,
  Info,
  SealCheck,
  X,
} from "@phosphor-icons/react";
import { CatalogSearch } from "../components/CatalogSearch.jsx";
import { ComparisonPicker } from "../components/ComparisonPicker.jsx";
import { HistoricalCitation } from "../components/HistoricalCitation.jsx";
import { LifeMarketChart } from "../components/LifeMarketChart.jsx";
import {
  getAbilityRows,
  getEvidencePresentation,
} from "../components/evidencePresentation.js";
import { getFloatingEventCardPosition } from "../components/floatingEventCard.js";
import {
  formatAge,
  getPairColors,
  figures,
} from "../data.js";
import { useHistoryComparison } from "../historyDataContext.jsx";

const hoverCapable = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover:hover) and (pointer:fine)").matches;
const floatingPosition = (pointer, compact = false, measured = {}) =>
  getFloatingEventCardPosition(pointer, {
    width: measured.width || 520,
    height: measured.height || (compact ? 370 : 450),
    gap: 14,
    anchorLead: 44,
  });
const getRailEventKey = (event) =>
  event ? `${event.figure?.id || "figure"}:${event.title}` : "";

export function CScroll({ left, right, onLeft, onRight, onOpenSettings, dataStatus, dataMeta }) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState("line");
  const [candleId, setCandleId] = useState(left.id);
  const [active, setActive] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const [granularity, setGranularity] = useState({ label: "按年" });
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railPreviewId, setRailPreviewId] = useState(null);
  const [railFollow, setRailFollow] = useState(null);
  const closeTimer = useRef(0);
  const detailCardRef = useRef(null);
  const cardAnchorRef = useRef(null);
  const stageRef = useRef(null);
  const railListRef = useRef(null);
  const railEventRefs = useRef(new Map());
  const railHoverGuardRef = useRef(0);
  const { comparison, status: comparisonStatus } = useHistoryComparison(left, right);
  const colors = useMemo(() => getPairColors(left, right), [left, right]);
  const candleFigure = candleId === right.id ? right : left;
  const railFigure =
    railPreviewId === right.id
      ? right
      : railPreviewId === left.id
        ? left
        : railFollow?.figureId === right.id
          ? right
          : railFollow?.figureId === left.id
            ? left
        : mode === "candlestick"
          ? candleFigure
          : left;
  const displayEvents = railFigure.events
    .filter((event) => !event.posthumous)
    .map((event) => ({
      ...event,
      figure: railFigure,
      axisLabel: formatAge(event.age),
    }));
  useEffect(() => {
    if (candleId !== left.id && candleId !== right.id) setCandleId(left.id);
  }, [left.id, right.id, candleId]);
  useEffect(() => {
    setActive(null);
    setDetailOpen(false);
    setRailPreviewId(null);
    setRailFollow(null);
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
        width: Math.max(rect.width, detailCardRef.current.offsetWidth),
        height: Math.max(rect.height, detailCardRef.current.offsetHeight),
      }),
    );
  }, [detailOpen, active?.title, active?.figure?.id, mode]);
  useEffect(() => {
    if (!detailOpen || !detailCardRef.current || !cardAnchorRef.current) return;
    let frame = 0;
    const syncCard = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = detailCardRef.current?.getBoundingClientRect();
        if (!rect || !cardAnchorRef.current) return;
        const livePoint = document
          .querySelector(".life-snap-indicator")
          ?.getBoundingClientRect();
        const anchor = livePoint
          ? {
              ...cardAnchorRef.current,
              snapX: livePoint.left,
              snapY: livePoint.top,
            }
          : cardAnchorRef.current;
        cardAnchorRef.current = anchor;
        const nextPosition = floatingPosition(anchor, mode === "line", {
            width: Math.max(rect.width, detailCardRef.current.offsetWidth),
            height: Math.max(rect.height, detailCardRef.current.offsetHeight),
          });
        setCardPosition((current) =>
          Math.abs(current.x - nextPosition.x) < 0.5 &&
          Math.abs(current.y - nextPosition.y) < 0.5 &&
          current.side === nextPosition.side
            ? current
            : nextPosition,
        );
      });
    };
    const observer = new ResizeObserver(syncCard);
    observer.observe(detailCardRef.current);
    window.addEventListener("resize", syncCard);
    const tracker = window.setInterval(syncCard, 120);
    syncCard();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearInterval(tracker);
      window.removeEventListener("resize", syncCard);
    };
  }, [detailOpen, active?.title, active?.figure?.id, mode]);
  useLayoutEffect(() => {
    if (railCollapsed || !railFollow || railFollow.figureId !== railFigure.id)
      return;
    const list = railListRef.current;
    const item = railEventRefs.current.get(railFollow.key);
    if (!list || !item) return;
    const frame = window.requestAnimationFrame(() => {
      const centeredTop =
        item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
      list.scrollTo({
        top: Math.max(0, centeredTop),
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [railCollapsed, railFollow, railFigure.id]);
  const cancelClose = useCallback(
    () => window.clearTimeout(closeTimer.current),
    [],
  );
  const closeSoon = useCallback(() => {
    if (!hoverCapable()) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setDetailOpen(false);
      setRailFollow(null);
    }, 180);
  }, []);
  const focus = useCallback(
    (event, pointer) => {
      if (!event) return;
      window.clearTimeout(closeTimer.current);
      setActive(event);
      if (Number.isFinite(pointer?.snapX)) {
        const key = getRailEventKey(event);
        setRailFollow((current) =>
          current?.key === key
            ? current
            : { key, figureId: event.figure?.id || left.id },
        );
        cardAnchorRef.current = pointer;
        setCardPosition(floatingPosition(pointer, mode === "line"));
        setDetailOpen(true);
      } else {
        setDetailOpen(false);
      }
    },
    [left.id, mode],
  );
  const anchorDetail = useCallback(
    (event, pointer) => {
      if (!event || !Number.isFinite(pointer?.snapX)) return;
      window.clearTimeout(closeTimer.current);
      setActive(event);
      const key = getRailEventKey(event);
      setRailFollow((current) =>
        current?.key === key
          ? current
          : { key, figureId: event.figure?.id || left.id },
      );
      cardAnchorRef.current = pointer;
      setCardPosition(floatingPosition(pointer, mode === "line"));
      setDetailOpen(true);
    },
    [left.id, mode],
  );
  const openSettings = useCallback(
    (section = "appearance") => {
      window.clearTimeout(closeTimer.current);
      setDetailOpen(false);
      onOpenSettings(section);
    },
    [onOpenSettings],
  );
  const toggleRail = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    railHoverGuardRef.current = performance.now() + 480;
    setActive(null);
    setDetailOpen(false);
    setRailFollow(null);
    setRailCollapsed((value) => !value);
  }, []);
  const startComparison = useCallback(() => {
    setDetailOpen(false);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!reducedMotion) stageRef.current?.animate?.(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.07)" },
        { filter: "brightness(1)" },
      ],
      { duration: 720, easing: "cubic-bezier(.16,1,.3,1)" },
    );
  }, [reducedMotion]);
  return (
    <main className="zhusha-page">
      <header className="zhusha-header">
        <div className="zhusha-brand">
          <b>朱砂长卷</b>
          <img
            className="zhusha-brand-seal"
            src="/assets/zhusha-seal-jianwangzhilai.webp"
            alt="鉴往知来篆印"
          />
          <small>历史人物对比研究</small>
        </div>
        <CatalogSearch onSelect={onLeft} placeholder="搜索历史人物" />
        <div className="zhusha-header-pair">
          <ComparisonPicker
            left={left}
            right={right}
            onLeft={onLeft}
            onRight={onRight}
            compact
            portalMenus
            tone="paper"
            onPreviewLeft={() => setRailPreviewId(left.id)}
            onPreviewRight={() => setRailPreviewId(right.id)}
            onPreviewEnd={(figure) =>
              setRailPreviewId((current) =>
                current === figure?.id ? null : current,
              )
            }
          />
          <button
            type="button"
            className="zhusha-start"
            onClick={startComparison}
          >
            开始对比
          </button>
        </div>
        <button
          type="button"
          className="zhusha-settings"
          onClick={() => openSettings("appearance")}
          aria-label="打开设置"
        >
          <GearSix />
        </button>
      </header>

      <div
        className={`zhusha-workbench ${railCollapsed ? "is-rail-collapsed" : ""}`}
      >
        <aside className="zhusha-rail">
          <header>
            <i />
            <span className="zhusha-rail-heading">
              <b>历史长卷</b>
              <small>人物命途 · 随走势定位</small>
            </span>
            <span className="zhusha-rail-count">
              {railFigure.name} · {displayEvents.length} 节点
            </span>
          </header>
          <motion.div
            ref={railListRef}
            id="zhusha-history-rail"
            className="zhusha-rail-list"
            key={railFigure.id}
            data-figure={railFigure.id}
            initial={reducedMotion ? false : { opacity: 0, x: 8, filter: "blur(3px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={reducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
              {displayEvents.map((event, index) => (
                <button
                  type="button"
                  ref={(node) => {
                    const key = getRailEventKey(event);
                    if (node) railEventRefs.current.set(key, node);
                    else railEventRefs.current.delete(key);
                  }}
                  data-event-key={getRailEventKey(event)}
                  key={`${event.figure.id}-${event.title}`}
                  className={
                    active?.title === event.title &&
                    active?.figure?.id === event.figure.id
                      ? "is-active"
                      : ""
                  }
                  onClick={(pointer) => focus(event, pointer)}
                  onMouseEnter={(pointer) => {
                    if (performance.now() >= railHoverGuardRef.current)
                      focus(event, pointer);
                  }}
                  onMouseLeave={closeSoon}
                  onFocus={(pointer) => focus(event, pointer)}
                  onBlur={closeSoon}
                >
                  <span className="zhusha-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <b>{event.title}</b>
                    <small>
                      {formatAge(event.age)} · {event.figure.name}
                    </small>
                    <p>{event.summary}</p>
                  </span>
                </button>
              ))}
          </motion.div>
          <button
            type="button"
            className="zhusha-collapse"
            onClick={toggleRail}
            aria-expanded={!railCollapsed}
            aria-controls="zhusha-history-rail"
            title={railCollapsed ? "展开历史长卷" : "收起历史长卷"}
          >
            {railCollapsed ? <CaretRight /> : <CaretLeft />}
            <span>{railCollapsed ? "展开长卷" : "收起长卷"}</span>
          </button>
        </aside>

        <section className="zhusha-main">
          <header className="zhusha-chart-head">
            <div>
              <h1>
                0—{comparison.maxAge} 岁 · 历史综合势能（0—100） <Info />
              </h1>
              <div className="zhusha-legend">
                {mode === "line" ? <>
                  <span>
                    <i style={{ background: colors[0] }} />
                    {left.name} · 实线
                  </span>
                  <span>
                    <i style={{ background: colors[1] }} />
                    {right.name} · 实线
                  </span>
                </> : <span>
                  <i style={{ background: candleFigure.color }} />
                  当前 K 线 · {candleFigure.name}
                </span>}
                <em>综合生前资源与身后制度、思想及作品延续</em>
              </div>
            </div>
            <div className="zhusha-modes">
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
          </header>
          {mode === "candlestick" && (
            <div className="zhusha-candle-select">
              <span>查看人物：</span>
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
              <em>{granularity.label}</em>
            </div>
          )}
          <div className="zhusha-chart-stage" ref={stageRef}>
            <LifeMarketChart
              left={left}
              right={right}
              mode={mode}
              candleFigure={candleFigure}
              variant="paper"
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
                      className={`zhusha-detail-card event-float-card event-float-card--anchor-${cardPosition.side || "right"}`}
                      style={{
                      left: cardPosition.x,
                      top: cardPosition.y,
                      "--anchor-y": `${cardPosition.anchorOffsetY || 72}px`,
                      "--anchor-x": `${cardPosition.anchorOffsetX || 54}px`,
                      "--anchor-gap": `${cardPosition.anchorGap || 14}px`,
                    }}
                      initial={reducedMotion ? false : {
                        opacity: 0,
                        y: 10,
                        scale: 0.97,
                        filter: "blur(5px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={reducedMotion ? { opacity: 0 } : {
                        opacity: 0,
                        y: 5,
                        scale: 0.98,
                        filter: "blur(3px)",
                      }}
                      transition={reducedMotion ? { duration: 0.01 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      onMouseEnter={cancelClose}
                      onMouseLeave={closeSoon}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailOpen(false)}
                        aria-label="关闭事件详情"
                      >
                        <X />
                      </button>
                      <header>
                        <span>{active.title}</span>
                        <i>史</i>
                      </header>
                      <small>
                        年龄：{formatAge(active.age)} · 史年{" "}
                        {active.year < 0
                          ? `公元前${Math.abs(active.year)}`
                          : `公元${active.year}`}{" "}
                        年
                      </small>
                      <p>{active.summary}</p>
                      <HistoricalCitation event={active} tone="paper" />
                      {mode === "candlestick" && (
                        <div className="zhusha-market-note">
                          <b>{active.delta >= 0 ? "上行催化" : "下行冲击"}</b>
                          <span>
                            事件先作用于{active.dimension}
                            ，再传导至组织与安全预期；因此本年龄区间的蜡烛实体表现为
                            {active.delta >= 0
                              ? "收盘抬高、趋势增强"
                              : "收盘回撤、波动放大"}
                            ，后续惯性取决于相邻事件能否形成连续确认。
                          </span>
                        </div>
                      )}
                      <div className="zhusha-impact">
                        <span>
                          <small>{active.figure.name} 影响</small>
                          <b
                            className={active.delta >= 0 ? "is-up" : "is-down"}
                          >
                            {active.delta >= 0 ? "+" : ""}
                            {active.delta.toFixed(1)}{" "}
                            {active.delta >= 0 ? "↑" : "↓"}
                          </b>
                        </span>
                        <span>
                          <small>
                            {mode === "candlestick" ? "行情属性" : "另一方同期"}
                          </small>
                          <b>
                            {mode === "candlestick"
                              ? active.trajectory?.continuity || active.dimension
                              : active.figure.id === left.id
                                ? right.name
                                : left.name}
                          </b>
                        </span>
                      </div>
                      <div className="zhusha-dimensions" aria-label="人物综合能力指标">
                        {getAbilityRows(active.figure).map((metric) => (
                            <span key={metric.key}>
                              <b>{metric.label} · {Math.round(metric.value)}</b>
                              <i>
                                <em
                                  style={{
                                    width: `${Math.max(4, Math.min(100, metric.value))}%`,
                                  }}
                                />
                              </i>
                            </span>
                          ))}
                      </div>
                      <footer>
                        <span>
                          <SealCheck />
                          史料依据：{active.source.label}
                        </span>
                        <b>
                          {getEvidencePresentation(active).sourceDepth} · {getEvidencePresentation(active).chronology}
                        </b>
                      </footer>
                    </motion.article>
                  )}
                </AnimatePresence>,
                document.body,
              )}
          </div>
        </section>
      </div>
      <footer className="zhusha-footer">
        <span>
          <img
            className="zhusha-footer-seal"
            src="/assets/zhusha-seal-jianwangzhilai.webp"
            alt=""
            aria-hidden="true"
          />
          <b>提示</b> · 滚动缩放图表，悬停节点查看故事；在设置中切换玉衡终端。
        </span>
        <span>
          {dataStatus === "live" || comparisonStatus === "live" ? <CloudCheck /> : <CloudSlash />}
          人物库：{dataMeta?.people || figures.length} 位 · {dataStatus === "live" ? "API 在线" : "内置数据"} · 数据截至：{new Date().getFullYear()}
        </span>
        <Info />
      </footer>
    </main>
  );
}
