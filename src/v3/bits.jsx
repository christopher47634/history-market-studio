// 小部件：滚动数字、分段选择器、依据徽标。
import { useEffect, useRef, useState } from "react";

// 数字滚动到新值（约 0.45 秒，缓出）。页面隐藏时直接跳到终值。
export function AnimatedNumber({ value, digits = 0 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = value; setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 450);
      const v = start + (value - start) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF 不跑的环境（后台标签页）兜底：到点直接落定。
    const done = setTimeout(() => { from.current = value; setShown(value); }, 600);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [value]);
  return <>{Number(shown).toFixed(digits)}</>;
}

// 分段选择器：选中块滑动过去。
export function Segmented({ options, value, onChange, label, size = "md" }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`v3-seg v3-seg--${size}`} role="radiogroup" aria-label={label} style={{ "--n": options.length, "--i": index }}>
      <span className="v3-seg__pill" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const BASIS = {
  原文: { label: "史书原文", note: "逐字核验" },
  百科: { label: "维基百科", note: "逐字核验" },
  概括: { label: "概括", note: "无可核验原句" },
};
export function BasisBadge({ basis }) {
  const b = BASIS[basis] ?? BASIS.概括;
  return <span className={`v3-basis v3-basis--${basis === "原文" ? "primary" : basis === "百科" ? "wiki" : "none"}`}><b>{b.label}</b>{b.note}</span>;
}
