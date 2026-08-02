import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowsOutSimple, MouseScroll } from "@phosphor-icons/react";
import { buildComparison, formatAge, getPairColors } from "../data.js";
import { getCandleView } from "../marketEngine.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>\"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
  );
const eventHTML = (event) =>
  event
    ? `<div class="life-tip__event"><b>${esc(event.title)}</b><p>${esc(event.summary)}</p><span>${event.delta >= 0 ? "+" : ""}${event.delta} · ${esc(event.dimension)}</span></div>`
    : "";

function lineTip(params) {
  const rows = (Array.isArray(params) ? params : [params]).filter(
    (row) =>
      row.seriesType === "line" &&
      row.xAxisIndex === 0 &&
      row.data?.value !== null,
  );
  if (!rows.length) return "";
  return `<div class="life-tip"><small>${esc(rows[0].axisValueLabel)} · 人生势能</small>${rows.map((row) => `<div><i style="background:${esc(row.color)}"></i><b>${esc(row.seriesName)}</b><strong>${esc(row.data.value)}</strong></div>`).join("")}</div>`;
}

function candleTip(params, figure, granularity) {
  const row = (Array.isArray(params) ? params : [params]).find(
    (item) => item.seriesType === "candlestick",
  );
  if (!row) return "";
  const [open, close, low, high] = row.data.value;
  return `<div class="life-tip life-tip--candle"><small>${esc(figure.name)} · ${esc(row.name)} · ${esc(granularity.label)}</small><div class="life-tip__ohlc"><span>开<b>${open.toFixed(1)}</b></span><span>高<b>${high.toFixed(1)}</b></span><span>低<b>${low.toFixed(1)}</b></span><span>收<b class="${close >= open ? "up" : "down"}">${close.toFixed(1)}</b></span></div>${eventHTML(row.data.event)}</div>`;
}

export function LifeMarketChart({
  left,
  right,
  mode = "line",
  candleFigure = left,
  variant = "terminal",
  activeEvent,
  onEventFocus,
  onEventAnchor,
  onEventBlur,
  onGranularityChange,
}) {
  const descriptionId = useId();
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const focusRef = useRef(onEventFocus);
  const anchorRef = useRef(onEventAnchor);
  const blurRef = useRef(onEventBlur);
  const granularityRef = useRef(onGranularityChange);
  const raf = useRef(0);
  const pointerRaf = useRef(0);
  const pointerProbeRef = useRef(null);
  const pointerTetherRef = useRef(null);
  const snapTargetsRef = useRef([]);
  const snapStateRef = useRef({ key: "", clientX: 0, clientY: 0 });
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState({ start: 0, end: 100 });
  const [snapTarget, setSnapTarget] = useState(null);
  const comparison = useMemo(() => buildComparison(left, right), [left, right]);
  const colors = useMemo(() => getPairColors(left, right), [left, right]);
  const candleView = useMemo(
    () => getCandleView(candleFigure, zoom.end - zoom.start),
    [candleFigure, zoom],
  );
  const markers = useMemo(
    () =>
      [
        ...comparison.left.map(
          (point) =>
            point.event && {
              ...point.event,
              axisLabel: point.axisLabel,
              figure: left,
            },
        ),
        ...comparison.right.map(
          (point) =>
            point.event && {
              ...point.event,
              axisLabel: point.axisLabel,
              figure: right,
            },
        ),
      ]
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 4)
        .sort((a, b) => a.age - b.age),
    [comparison, left, right],
  );
  const snapTargets = useMemo(
    () =>
      mode === "line"
        ? [
            ...comparison.left
              .filter((point) => point.event)
              .map((point) => ({
                key: `${left.id}-${point.event.title}`,
                axisValue: point.axisLabel,
                value: point.value,
                event: {
                  ...point.event,
                  axisLabel: point.axisLabel,
                  figure: left,
                },
              })),
            ...comparison.right
              .filter((point) => point.event)
              .map((point) => ({
                key: `${right.id}-${point.event.title}`,
                axisValue: point.axisLabel,
                value: point.value,
                event: {
                  ...point.event,
                  axisLabel: point.axisLabel,
                  figure: right,
                },
              })),
          ]
        : candleView.candles
            .map(
              (item, index) =>
                item.event && {
                  key: `${candleFigure.id}-${item.event.title}`,
                  axisValue: candleView.categories[index],
                  value: (item.open + item.close) / 2,
                  event: {
                    ...item.event,
                    axisLabel: formatAge(item.age),
                    figure: candleFigure,
                  },
                },
            )
            .filter(Boolean),
    [mode, comparison, left, right, candleView, candleFigure],
  );
  snapTargetsRef.current = snapTargets;
  focusRef.current = onEventFocus;
  anchorRef.current = onEventAnchor;
  blurRef.current = onEventBlur;
  granularityRef.current = onGranularityChange;

  useEffect(
    () => setZoom({ start: 0, end: 100 }),
    [left.id, right.id, candleFigure.id, mode],
  );
  useEffect(() => {
    setSnapTarget(null);
    snapStateRef.current = { key: "", clientX: 0, clientY: 0 };
  }, [left.id, right.id, candleFigure.id, mode]);
  useEffect(() => {
    let disposed = false;
    let observer;
    let chart;
    let zr;
    const hideGuidance = (hideProbe = true) => {
      if (pointerProbeRef.current && hideProbe) {
        pointerProbeRef.current.style.opacity = "0";
        pointerProbeRef.current.classList.remove("is-snapped");
      }
      if (pointerTetherRef.current)
        pointerTetherRef.current.style.opacity = "0";
    };
    const clearSnap = (notify = true, hideProbe = true) => {
      const hadSnap = Boolean(snapStateRef.current.key);
      snapStateRef.current = { key: "", clientX: 0, clientY: 0 };
      if (hadSnap) setSnapTarget(null);
      hideGuidance(hideProbe);
      zr?.setCursorStyle("default");
      if (notify && hadSnap) blurRef.current?.();
    };
    async function mount() {
      const echarts = await import("../echartsRuntime.js");
      if (disposed || !rootRef.current) return;
      chart = echarts.init(rootRef.current, null, {
        renderer: "canvas",
        useCoarsePointer: true,
        pointerSize: 44,
      });
      chartRef.current = chart;
      zr = chart.getZr();
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(rootRef.current);
      const pixelFor = (target) => {
        try {
          const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
            target.axisValue,
            target.value,
          ]);
          return Array.isArray(pixel) && pixel.every(Number.isFinite)
            ? pixel
            : null;
        } catch {
          return null;
        }
      };
      const nearestTarget = (pointer, forced = false) => {
        const x = Number.isFinite(pointer.offsetX)
          ? pointer.offsetX
          : pointer.zrX;
        const y = Number.isFinite(pointer.offsetY)
          ? pointer.offsetY
          : pointer.zrY;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        try {
          if (!chart.containPixel({ gridIndex: 0 }, [x, y])) return null;
        } catch {
          return null;
        }
        const bounds = rootRef.current?.getBoundingClientRect();
        const radius = forced
          ? 76
          : Math.max(46, Math.min(64, (bounds?.width || 900) * 0.055));
        let nearest = null;
        for (const target of snapTargetsRef.current) {
          const pixel = pixelFor(target);
          if (!pixel) continue;
          const distance = Math.hypot(pixel[0] - x, (pixel[1] - y) * 0.88);
          if (!nearest || distance < nearest.distance)
            nearest = { target, x: pixel[0], y: pixel[1], distance };
        }
        if (!nearest || nearest.distance > radius) return null;
        const current = snapTargetsRef.current.find(
          (target) => target.key === snapStateRef.current.key,
        );
        if (current && current.key !== nearest.target.key) {
          const pixel = pixelFor(current);
          if (pixel) {
            const currentDistance = Math.hypot(
              pixel[0] - x,
              (pixel[1] - y) * 0.88,
            );
            if (
              currentDistance <= radius + 12 &&
              currentDistance <= nearest.distance + 8
            )
              return {
                target: current,
                x: pixel[0],
                y: pixel[1],
                distance: currentDistance,
              };
          }
        }
        return nearest;
      };
      const updateGuidance = (x, y, inside, match) => {
        const probe = pointerProbeRef.current;
        const tether = pointerTetherRef.current;
        if (!inside || !Number.isFinite(x) || !Number.isFinite(y)) {
          hideGuidance(true);
          return;
        }
        if (probe) {
          probe.style.left = `${x}px`;
          probe.style.top = `${y}px`;
          probe.style.opacity = "1";
          probe.style.setProperty(
            "--probe-color",
            match?.target.event.figure.color ||
              (variant === "paper" ? "#a84b3d" : "#77bdaa"),
          );
          probe.style.setProperty(
            "--probe-pull",
            match ? `${Math.max(0, 1 - match.distance / 76)}` : "0",
          );
          probe.classList.toggle("is-snapped", Boolean(match));
        }
        if (!tether) return;
        if (!match || match.distance < 9) {
          tether.style.opacity = "0";
          return;
        }
        tether.setAttribute("x1", x);
        tether.setAttribute("y1", y);
        tether.setAttribute("x2", match.x);
        tether.setAttribute("y2", match.y);
        tether.style.stroke = match.target.event.figure.color;
        tether.style.opacity = `${Math.min(0.82, 0.28 + (1 - match.distance / 76) * 0.68)}`;
      };
      const syncSnap = (event, forced = false) => {
        const pointer = {
          offsetX: event.offsetX,
          zrX: event.zrX,
          offsetY: event.offsetY,
          zrY: event.zrY,
          native: event.event,
        };
        cancelAnimationFrame(pointerRaf.current);
        pointerRaf.current = requestAnimationFrame(() => {
          if (disposed || !rootRef.current) return;
          const x = Number.isFinite(pointer.offsetX)
            ? pointer.offsetX
            : pointer.zrX;
          const y = Number.isFinite(pointer.offsetY)
            ? pointer.offsetY
            : pointer.zrY;
          let inside = false;
          try {
            inside = chart.containPixel({ gridIndex: 0 }, [x, y]);
          } catch {
            inside = false;
          }
          const match = nearestTarget(pointer, forced);
          updateGuidance(x, y, inside, match);
          if (!match) {
            clearSnap(true, !inside);
            if (inside) zr.setCursorStyle("crosshair");
            return;
          }
          const bounds = rootRef.current.getBoundingClientRect();
          // The detail card belongs to the snapped data point, not to the
          // free-moving cursor that happened to enter its magnetic range.
          const clientX = bounds.left + match.x;
          const clientY = bounds.top + match.y;
          const previous = snapStateRef.current;
          const changed = previous.key !== match.target.key;
          snapStateRef.current = { key: match.target.key, clientX, clientY };
          zr.setCursorStyle("pointer");
          setSnapTarget((current) =>
            current?.key === match.target.key &&
            Math.abs(current.x - match.x) < 1 &&
            Math.abs(current.y - match.y) < 1
              ? current
              : {
                  key: match.target.key,
                  x: match.x,
                  y: match.y,
                  color: match.target.event.figure.color,
                  label: match.target.event.title,
                  align:
                    match.x + (variant === "paper" ? 556 : 390) < bounds.width
                      ? "left"
                      : "right",
                },
          );
          if (changed || forced)
            focusRef.current?.(match.target.event, {
              clientX,
              clientY,
              chartX: match.x,
              chartY: match.y,
              snapX: bounds.left + match.x,
              snapY: bounds.top + match.y,
              chartLeft: bounds.left,
              chartRight: bounds.right,
              chartTop: bounds.top,
              chartBottom: bounds.bottom,
              source: forced ? "range-click" : "range-snap",
            });
        });
      };
      const onMove = (event) => syncSnap(event, false);
      const onClick = (event) => syncSnap(event, true);
      const onOut = () => clearSnap(true, true);
      zr.on("mousemove", onMove);
      zr.on("click", onClick);
      zr.on("globalout", onOut);
      chart.on("datazoom", (params) => {
        clearSnap(false, true);
        const item = params.batch?.[0] || params;
        if (typeof item.start !== "number") return;
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() =>
          setZoom((current) =>
            Math.abs(current.start - item.start) < 0.05 &&
            Math.abs(current.end - item.end) < 0.05
              ? current
              : { start: item.start, end: item.end },
          ),
        );
      });
      setReady(true);
      chart.__snapHandlers = { onMove, onClick, onOut };
    }
    mount();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(pointerRaf.current);
      observer?.disconnect();
      if (zr && chart?.__snapHandlers) {
        zr.off("mousemove", chart.__snapHandlers.onMove);
        zr.off("click", chart.__snapHandlers.onClick);
        zr.off("globalout", chart.__snapHandlers.onOut);
      }
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (mode === "candlestick")
      granularityRef.current?.(candleView.granularity);
  }, [mode, candleView.granularity]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    const paper = variant === "paper";
    const terminal = variant === "terminal";
    const narrow = typeof window !== "undefined" && window.innerWidth <= 560;
      const label = paper ? "#806f5e" : "#a5bdb3",
        gridLine = paper ? "rgba(92,65,41,.12)" : "rgba(137,196,176,.16)",
        axisLine = paper ? "rgba(71,49,31,.34)" : "rgba(155,204,186,.3)";
    const zoomInside = {
      type: "inside",
      start: zoom.start,
      end: zoom.end,
      filterMode: "none",
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
    };
    if (mode === "line") {
      const mainGrid = {
        left: narrow ? 38 : terminal ? 54 : 50,
        right: narrow ? 18 : terminal ? 34 : 30,
        top: terminal ? 64 : 66,
        bottom: terminal ? (narrow ? 146 : 174) : 52,
      };
      const miniGrid = {
        left: narrow ? 38 : 54,
        right: narrow ? 18 : 34,
        height: narrow ? 66 : 88,
        bottom: narrow ? 32 : 38,
      };
      const xMain = {
        type: "category",
        boundaryGap: false,
        data: comparison.axis,
        gridIndex: 0,
        axisLine: { lineStyle: { color: axisLine } },
        axisTick: { show: false },
        axisLabel: {
          color: label,
          fontSize: narrow ? 8.5 : 10.5,
          margin: narrow ? 10 : 13,
          interval: Math.max(
            0,
            Math.floor(comparison.axis.length / (narrow ? 5 : 8)) - 1,
          ),
        },
        splitLine: { show: false },
      };
      const yMain = {
        type: "value",
        gridIndex: 0,
        min: 0,
        max: 100,
        interval: 25,
        name: narrow ? "" : "人生影响力（0—100）",
        nameTextStyle: { color: label, fontSize: 10, padding: [0, 0, 8, 0] },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: label, fontSize: narrow ? 8.5 : 10 },
        splitLine: { lineStyle: { color: gridLine, type: "dashed" } },
      };
      const glowSeries = [left, right].map((figure, index) => ({
        name: `${figure.name} · 光晕`,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: index ? comparison.right : comparison.left,
        smooth: 0.16,
        smoothMonotone: "x",
        showSymbol: false,
        connectNulls: false,
        silent: true,
        z: 2,
        lineStyle: {
            width: terminal ? 5.8 : 4.6,
          color: colors[index],
          type: "solid",
          cap: "round",
          join: "round",
            opacity: terminal ? 0.2 : 0.08,
          shadowBlur: terminal ? 13 : 7,
          shadowColor: `${colors[index]}58`,
        },
        emphasis: { disabled: true },
      }));
      const lineSeries = [left, right].map((figure, index) => ({
        name: figure.name,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: index ? comparison.right : comparison.left,
        smooth: 0.16,
        smoothMonotone: "x",
        showSymbol: false,
        connectNulls: false,
        z: 4,
        lineStyle: {
            width: terminal ? 1.7 : 1.35,
          color: colors[index],
          type: "solid",
          cap: "round",
          join: "round",
          shadowBlur: terminal ? 5 : 2,
          shadowOffsetY: 0,
          shadowColor: `${colors[index]}75`,
          opacity: 1,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${colors[index]}1a` },
              { offset: 0.6, color: `${colors[index]}06` },
              { offset: 1, color: `${colors[index]}00` },
            ],
          },
            opacity: paper ? 0.68 : 0.56,
        },
        emphasis: {
          focus: "series",
          lineStyle: { width: terminal ? 1.9 : 1.75, shadowBlur: 8 },
        },
        endLabel: {
          show: true,
          formatter: "{a}",
          color: colors[index],
          fontWeight: 600,
          fontSize: narrow ? 9 : 10,
          distance: 5,
        },
        labelLayout: { moveOverlap: "shiftY" },
        itemStyle: { color: colors[index] },
        markLine:
          index === 0
            ? {
                silent: true,
                symbol: ["none", "circle"],
                symbolSize: [0, 2.5],
                lineStyle: {
                  color: paper ? "rgba(160,77,59,.2)" : "rgba(195,162,118,.18)",
                  type: "solid",
                  width: 0.55,
                },
                label: {
                  show: true,
                  position: "insideEndTop",
                  color: paper ? "#765b43" : "#c2aa87",
                  fontSize: narrow ? 7.5 : 9,
                  lineHeight: narrow ? 10 : 13,
                  formatter: (p) => p.name,
                },
                data: markers.map((event) => ({
                  name: `${event.title}\n${formatAge(event.age)}`,
                  xAxis: event.axisLabel,
                })),
              }
            : undefined,
      }));
      const eventSeries = [left, right].map((figure, index) => ({
        name: `${figure.name} · 节点`,
        type: "scatter",
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 8,
        symbol: "circle",
        symbolSize: (value, params) => (params.data.event ? 4.5 : 0),
        data: (index ? comparison.right : comparison.left).map((point) => ({
          ...point,
          figure,
          itemStyle: {
            color: paper ? "#fffaf0" : "#071513",
            borderColor: colors[index],
            borderWidth: 1.1,
            shadowBlur: 4,
            shadowColor: `${colors[index]}72`,
          },
        })),
        emphasis: {
          scale: 1.5,
          itemStyle: { borderWidth: 1.6, shadowBlur: 8 },
        },
      }));
      const eventHitSeries = [left, right].map((figure, index) => ({
        name: `${figure.name} · 节点热区`,
        type: "scatter",
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 9,
        symbol: "circle",
        symbolSize: (value, params) => (params.data.event ? 26 : 0),
        cursor: "pointer",
        data: (index ? comparison.right : comparison.left).map((point) => ({
          ...point,
          figure,
          itemStyle: { opacity: 0 },
        })),
        emphasis: { disabled: true },
        tooltip: { show: false },
      }));
      const candleData = candleView.candles.map((item) => ({
        value: [item.open, item.close, item.low, item.high],
        event: item.event,
        figure: candleFigure,
      }));
      const miniSeries = terminal
        ? [
            {
              name: `${candleFigure.name} · 同步K线`,
              type: "candlestick",
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: candleData,
              barMaxWidth: 8,
              itemStyle: {
                color: "#e05449",
                color0: "#58a16f",
                borderColor: "#f06a5e",
                borderColor0: "#72b886",
              },
            },
            {
              name: "趋势",
              type: "line",
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: candleView.trend,
              smooth: 0.35,
              showSymbol: false,
              silent: true,
              lineStyle: {
                color: candleFigure.color,
                width: 1.2,
                type: "dashed",
                opacity: 0.85,
              },
            },
          ]
        : [];
      chart.setOption(
        {
          animationDurationUpdate: 360,
          animationEasingUpdate: "cubicOut",
          grid: terminal ? [mainGrid, miniGrid] : [mainGrid],
          xAxis: terminal
            ? [
                xMain,
                {
                  ...xMain,
                  data: candleView.categories,
                  gridIndex: 1,
                  axisLabel: {
                    ...xMain.axisLabel,
                    interval: Math.max(
                      0,
                      Math.floor(
                        candleView.categories.length / (narrow ? 5 : 7),
                      ) - 1,
                    ),
                    fontSize: narrow ? 7 : 8,
                  },
                },
              ]
            : [xMain],
          yAxis: terminal
            ? [
                yMain,
                {
                  ...yMain,
                  gridIndex: 1,
                  name: narrow ? "" : "同步态势（K线）",
                  nameTextStyle: { ...yMain.nameTextStyle, fontSize: 8 },
                  axisLabel: { ...yMain.axisLabel, fontSize: narrow ? 7 : 8 },
                  splitNumber: 2,
                },
              ]
            : [yMain],
          dataZoom: [{ ...zoomInside, xAxisIndex: terminal ? [0, 1] : [0] }],
          axisPointer: terminal ? { link: [{ xAxisIndex: "all" }] } : undefined,
          tooltip: {
            trigger: "axis",
            showContent: false,
            axisPointer: {
              type: "line",
              snap: true,
              lineStyle: {
                color: paper ? "rgba(152,79,58,.3)" : "rgba(125,220,198,.3)",
                width: 0.7,
                type: "solid",
              },
            },
          },
          series: [
            ...glowSeries,
            ...lineSeries,
            ...eventHitSeries,
            ...eventSeries,
            ...miniSeries,
          ],
        },
        true,
      );
    } else {
      const data = candleView.candles.map((item) => ({
        value: [item.open, item.close, item.low, item.high],
        event: item.event,
        figure: candleFigure,
      }));
      const events = candleView.candles.map((item) => ({
        value: (item.open + item.close) / 2,
        event: item.event,
        figure: candleFigure,
        itemStyle: {
          color: paper ? "#f8f0e3" : "#071513",
          borderColor: candleFigure.color,
          borderWidth: 2,
        },
      }));
      chart.setOption(
        {
          animationDurationUpdate: 360,
          grid: {
            left: narrow ? 38 : 52,
            right: narrow ? 18 : 32,
            top: 62,
            bottom: 52,
          },
          xAxis: {
            type: "category",
            data: candleView.categories,
            boundaryGap: true,
            axisLine: { lineStyle: { color: axisLine } },
            axisTick: { show: false },
            axisLabel: {
              color: label,
              fontSize: narrow ? 8.5 : 10,
              interval: Math.max(
                0,
                Math.floor(candleView.categories.length / (narrow ? 5 : 8)) - 1,
              ),
            },
          },
          yAxis: {
            type: "value",
            min: 0,
            max: 100,
            interval: 25,
            name: narrow ? "" : "人生影响力 OHLC",
            nameTextStyle: { color: label, fontSize: 10 },
            axisLabel: { color: label, fontSize: narrow ? 8.5 : 10 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: gridLine, type: "dashed" } },
          },
          dataZoom: [zoomInside],
          tooltip: {
            trigger: "axis",
            confine: true,
            backgroundColor: "transparent",
            borderWidth: 0,
            padding: 0,
            formatter: (params) =>
              candleTip(params, candleFigure, candleView.granularity),
            axisPointer: {
              type: "cross",
              lineStyle: { width: 0.7 },
              crossStyle: { width: 0.7 },
            },
          },
          series: [
            {
              name: `${candleFigure.name} · OHLC`,
              type: "candlestick",
              data,
              barMaxWidth: candleView.granularity.key === "micro" ? 5 : 11,
              itemStyle: {
                color: "#df5045",
                color0: "#4d9567",
                borderColor: "#ef6a5f",
                borderColor0: "#68b17f",
                borderWidth: 0.8,
                opacity: candleView.granularity.trendDominant ? 0.52 : 0.9,
              },
            },
            {
              name: `${candleFigure.name} · 趋势`,
              type: "line",
              data: candleView.trend,
              smooth: 0.2,
              showSymbol: false,
              silent: true,
              z: 5,
              lineStyle: {
                color: candleFigure.color,
                width: candleView.granularity.trendDominant ? 2.1 : 1,
                shadowBlur: 4,
                shadowColor: `${candleFigure.color}55`,
                opacity: candleView.granularity.trendDominant ? 0.96 : 0.5,
              },
            },
            {
              name: "关键节点",
              type: "scatter",
              data: events,
              z: 8,
              symbolSize: (value, params) => (params.data.event ? 4.5 : 0),
              emphasis: { scale: 1.5, itemStyle: { shadowBlur: 8 } },
            },
          ],
        },
        true,
      );
    }
    chart.dispatchAction({ type: "hideTip" });
    chart.dispatchAction({ type: "downplay" });
    if (activeEvent) {
      if (mode === "line") {
        const rightSide = activeEvent.figure?.id === right.id;
        const points = rightSide ? comparison.right : comparison.left;
        const index = points.findIndex(
          (point) => point.event?.title === activeEvent.title,
        );
        if (index >= 0)
          chart.dispatchAction({
            type: "highlight",
            seriesIndex: rightSide ? 7 : 6,
            dataIndex: index,
          });
      } else if (activeEvent.figure?.id === candleFigure.id) {
        const index = candleView.candles.reduce(
          (best, item, i) =>
            Math.abs(item.age - activeEvent.age) <
            Math.abs(candleView.candles[best].age - activeEvent.age)
              ? i
              : best,
          0,
        );
        chart.dispatchAction({
          type: "highlight",
          seriesIndex: 2,
          dataIndex: index,
        });
      }
    }
  }, [
    left,
    right,
    mode,
    candleFigure,
    variant,
    ready,
    activeEvent,
    comparison,
    colors,
    candleView,
    markers,
    zoom,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    const root = rootRef.current;
    if (!chart || !root || !ready || !activeEvent) return;
    const target = snapTargets.find(
      (item) =>
        item.event.title === activeEvent.title &&
        item.event.figure?.id === activeEvent.figure?.id,
    );
    if (!target) return;
    let frame = 0;
    let anchorObserver;
    const syncAnchor = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
      let pixel;
      try {
        pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
          target.axisValue,
          target.value,
        ]);
      } catch {
        return;
      }
      if (!Array.isArray(pixel) || !pixel.every(Number.isFinite)) return;
      const bounds = root.getBoundingClientRect();
      const clientX = bounds.left + pixel[0];
      const clientY = bounds.top + pixel[1];
      setSnapTarget({
        key: target.key,
        x: pixel[0],
        y: pixel[1],
        color: target.event.figure.color,
        label: target.event.title,
        align:
          pixel[0] + (variant === "paper" ? 556 : 390) < bounds.width
            ? "left"
            : "right",
      });
      if (snapStateRef.current.key === target.key) return;
      snapStateRef.current = { key: target.key, clientX, clientY };
      anchorRef.current?.(target.event, {
        clientX,
        clientY,
        chartX: pixel[0],
        chartY: pixel[1],
        snapX: clientX,
        snapY: clientY,
        chartLeft: bounds.left,
        chartRight: bounds.right,
        chartTop: bounds.top,
        chartBottom: bounds.bottom,
        source: "active-event",
      });
      });
    };
    syncAnchor();
    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);
    if (typeof ResizeObserver !== "undefined") {
      anchorObserver = new ResizeObserver(syncAnchor);
      anchorObserver.observe(root);
    }
    return () => {
      cancelAnimationFrame(frame);
      anchorObserver?.disconnect();
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [activeEvent, ready, snapTargets, variant]);

  const reset = () => {
    setZoom({ start: 0, end: 100 });
    chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  };
  return (
    <div
      className={`life-market-chart life-market-chart--${variant} life-market-chart--${mode}`}
    >
      <div
        ref={rootRef}
        className="life-market-chart__canvas"
        role="img"
        tabIndex={0}
        aria-describedby={descriptionId}
        aria-label={
          mode === "line"
            ? `${left.name}与${right.name}按实际年龄对比折线图`
            : `${candleFigure.name}按实际年龄生成的微观 K 线`
        }
      />
      <p id={descriptionId} className="a11y-chart-summary">
        {mode === "line"
          ? `${left.name}与${right.name}从零岁到${comparison.maxAge}岁的影响力走势。关键事件可从页面事件列表使用键盘逐项查看。`
          : `${candleFigure.name}的蜡烛图当前显示${candleView.granularity.label}，可使用复位按钮恢复完整年龄范围。`}
      </p>
      <svg className="life-pointer-tether" aria-hidden="true" focusable="false">
        <line ref={pointerTetherRef} x1="0" y1="0" x2="0" y2="0" />
      </svg>
      <span
        ref={pointerProbeRef}
        className="life-pointer-probe"
        aria-hidden="true"
      >
        <i />
        <b />
      </span>
      {snapTarget && (
        <span
          className={`life-snap-indicator ${snapTarget.align === "right" ? "is-left" : ""}`}
          style={{
            left: snapTarget.x,
            top: snapTarget.y,
            "--snap-color": snapTarget.color,
          }}
        >
          <i />
          <b>
            {mode === "candlestick"
              ? snapTarget.label
              : `已吸附 · ${snapTarget.label}`}
          </b>
        </span>
      )}
      <span className="life-chart-hint">
        <MouseScroll />
        进入节点附近即可吸附 · 滚轮/双指缩放
      </span>
      <span className="life-chart-age">
        年龄共轴 · 0—{comparison.maxAge} 岁
      </span>
      <button
        type="button"
        className="life-chart-reset"
        onClick={reset}
        aria-label="复位图表"
      >
        <ArrowsOutSimple />
        <span>复位</span>
      </button>
    </div>
  );
}
