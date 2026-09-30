import { useMemo, useState } from "react";
import { figuresV2, figureV2ById, livesOverlap, defaultAxis, formatYear } from "./model.js";
import { ChartV2, valueForReadout } from "./ChartV2.jsx";

const COLORS = ["#e0654f", "#4fb3c9"];
const params = new URLSearchParams(location.search);
const pick = (id, fallback) => figureV2ById[id] ?? figureV2ById[fallback];

function Picker({ value, onChange, exclude, color }) {
  return (
    <label className="v2pick">
      <i style={{ background: color }} />
      <select value={value.id} onChange={(e) => onChange(figureV2ById[e.target.value])}>
        {figuresV2.map((f) => <option key={f.id} value={f.id} disabled={f.id === exclude}>{f.name}（{formatYear(f.born.year)}–{formatYear(f.died.year)}）</option>)}
      </select>
    </label>
  );
}

function Readout({ f, pair, hover, axis, color }) {
  const then = hover ? valueForReadout(f, hover.x, axis, pair) : null;
  return (
    <div className={`v2read ${then ? "is-then" : ""}`}>
      <span className="v2read__name"><i style={{ background: color }} />{f.name}</span>
      <b className="v2read__value">{then ? then.score : f.legacy.score}</b>
      <span className="v2read__meta">
        <span className="v2read__label">{then ? (then.posthumous ? "身后声望" : "当时的势") : "后世评价"}</span>
        <span className="v2read__detail">{then ? then.title : `${f.legacy.tier} · ${f.legacy.label}`}</span>
      </span>
    </div>
  );
}

export function LabApp() {
  const [a, setA] = useState(() => pick(params.get("left"), "liubang"));
  const [b, setB] = useState(() => pick(params.get("right"), "xiangyu"));
  const overlap = livesOverlap(a, b);
  const [axisChoice, setAxisChoice] = useState(null);
  const axis = overlap ? axisChoice ?? defaultAxis(a, b) : "age";
  const [mode, setMode] = useState("line");
  const [kSide, setKSide] = useState(0);
  const [hover, setHover] = useState(null);
  const kFigure = kSide === 0 ? a : b;
  const colors = useMemo(() => COLORS, []);

  const setPair = (side, f) => { setAxisChoice(null); side === 0 ? setA(f) : setB(f); };

  return (
    <main className="v2lab">
      <header className="v2lab__top">
        <div>
          <h1>历史行情局 <small>v2 图表实验页 · 30 人样板</small></h1>
          <p>曲线 = 当时的势（权位档 − 危局）。光标在图上看当时，离开看后世评价。淡色段 = 史料空白，细淡线 = 身后声望。</p>
        </div>
        <a href="/">← 旧版</a>
      </header>

      <section className="v2lab__controls">
        <Picker value={a} onChange={(f) => setPair(0, f)} exclude={b.id} color={COLORS[0]} />
        <span className="v2lab__vs">对比</span>
        <Picker value={b} onChange={(f) => setPair(1, f)} exclude={a.id} color={COLORS[1]} />
        <div className="v2seg" role="group" aria-label="图表类型">
          <button aria-pressed={mode === "line"} onClick={() => setMode("line")}>走势</button>
          <button aria-pressed={mode === "k"} onClick={() => setMode("k")}>K 线</button>
        </div>
        {mode === "line" ? (
          <div className="v2seg" role="group" aria-label="横轴">
            <button aria-pressed={axis === "year"} disabled={!overlap} title={overlap ? "" : "两人生命没有重叠，只能按年龄对齐"} onClick={() => setAxisChoice("year")}>公元纪年</button>
            <button aria-pressed={axis === "age"} onClick={() => setAxisChoice("age")}>年龄</button>
          </div>
        ) : (
          <div className="v2seg" role="group" aria-label="K 线人物">
            <button aria-pressed={kSide === 0} onClick={() => setKSide(0)}>{a.name}</button>
            <button aria-pressed={kSide === 1} onClick={() => setKSide(1)}>{b.name}</button>
          </div>
        )}
      </section>

      <section className="v2lab__reads">
        <Readout f={a} pair={[a, b]} hover={mode === "line" ? hover : null} axis={axis} color={COLORS[0]} />
        <Readout f={b} pair={[a, b]} hover={mode === "line" ? hover : null} axis={axis} color={COLORS[1]} />
      </section>

      <section className="v2lab__chart">
        <ChartV2 a={a} b={b} axis={axis} mode={mode} kFigure={kFigure} colors={colors} onHover={setHover} />
        <p className="v2lab__hint">{mode === "k" ? "一根蜡烛 = 一个人生阶段，影线 = 阶段内子事件的最好和最坏。滚轮放大后展开到每个事件。" : axis === "year" ? "同时代：按公元纪年对齐，◆ 是反超点。" : "跨时代：按年龄对齐，竖线是去世年龄，之后是压缩的身后段。"}</p>
      </section>
    </main>
  );
}
