import type { ReactNode } from 'react';
import type {
  BarChartFigure,
  BoxPlotFigure,
  Figure as FigureT,
  GeometryFigure,
  HistogramFigure,
  LineChartFigure,
  NumberLineFigure,
  PieChartFigure,
  ScatterFigure,
  TableFigure,
} from '../engine/types';
import { Rich, RichInline } from './Rich';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
const INK = 'var(--figure-ink)';

/** SVG + absolutely positioned HTML labels (so labels can contain KaTeX). */
function Canvas({
  w,
  h,
  children,
  labels,
  maxWidth,
  label = 'Figure',
}: {
  w: number;
  h: number;
  children: ReactNode;
  labels?: { x: number; y: number; text: string; align?: 'center' | 'left' | 'right' }[];
  maxWidth?: number;
  /** Accessible name of the drawing. */
  label?: string;
}) {
  return (
    <div className="figure-wrap" style={{ maxWidth: maxWidth ?? w, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {children}
      </svg>
      {labels?.map((l, i) => (
        <div
          key={i}
          className="fig-label"
          style={{
            left: `${(l.x / w) * 100}%`,
            top: `${(l.y / h) * 100}%`,
            transform: l.align === 'left' ? 'translate(0, -50%)' : l.align === 'right' ? 'translate(-100%, -50%)' : undefined,
          }}
        >
          <RichInline text={l.text} />
        </div>
      ))}
    </div>
  );
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v.toFixed(4)).toString());

function niceStep(range: number): number {
  const raw = range / 5;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
}

/* ------------------------------------------------------------------ number line */
function NumberLine({ f }: { f: NumberLineFigure }) {
  const W = 460;
  const H = 90;
  const pad = 40;
  const x = (v: number) => pad + ((v - f.min) / (f.max - f.min)) * (W - 2 * pad);
  const y = 42;
  const labels: { x: number; y: number; text: string }[] = [];
  for (const p of f.points) {
    if (p.name) labels.push({ x: x(p.at), y: y - 20, text: `$${p.name}$` });
    if (p.value) labels.push({ x: x(p.at), y: y + 24, text: p.value });
  }
  for (const t of f.ticks ?? []) if (t.label) labels.push({ x: x(t.at), y: y + 24, text: t.label });
  return (
    <Canvas w={W} h={H} labels={labels} label="Number line">
      <line x1={12} y1={y} x2={W - 12} y2={y} stroke={INK} strokeWidth={1.5} />
      <path d={`M12 ${y} l9 -5 v10 z`} fill={INK} />
      <path d={`M${W - 12} ${y} l-9 -5 v10 z`} fill={INK} />
      {(f.ticks ?? []).map((t, i) => (
        <line key={i} x1={x(t.at)} x2={x(t.at)} y1={y - 6} y2={y + 6} stroke={INK} strokeWidth={1.2} />
      ))}
      {f.points.map((p, i) => (
        <circle key={i} cx={x(p.at)} cy={y} r={4} fill={INK} />
      ))}
    </Canvas>
  );
}

/* ------------------------------------------------------------------ geometry */
function clipLine(
  p: [number, number],
  q: [number, number],
  box: { xMin: number; xMax: number; yMin: number; yMax: number },
): [[number, number], [number, number]] | null {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const ts: number[] = [];
  if (dx !== 0) ts.push((box.xMin - p[0]) / dx, (box.xMax - p[0]) / dx);
  if (dy !== 0) ts.push((box.yMin - p[1]) / dy, (box.yMax - p[1]) / dy);
  const pts = ts
    .map((t) => [p[0] + t * dx, p[1] + t * dy] as [number, number])
    .filter(([a, b]) => a >= box.xMin - 1e-9 && a <= box.xMax + 1e-9 && b >= box.yMin - 1e-9 && b <= box.yMax + 1e-9);
  if (pts.length < 2) return null;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return [pts[0], pts[pts.length - 1]];
}

function Geometry({ f }: { f: GeometryFigure }) {
  const pts = f.points;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [a, b] of Object.values(pts)) {
    xs.push(a);
    ys.push(b);
  }
  for (const c of f.circles ?? []) {
    const [cx, cy] = pts[c.center];
    xs.push(cx - c.r, cx + c.r);
    ys.push(cy - c.r, cy + c.r);
  }
  for (const l of f.labels ?? []) {
    xs.push(l.at[0]);
    ys.push(l.at[1]);
  }
  if (f.axes) {
    xs.push(f.axes.xMin, f.axes.xMax);
    ys.push(f.axes.yMin, f.axes.yMax);
  }
  for (const c of f.curves ?? []) for (const [a, b] of c.pts) (xs.push(a), ys.push(b));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const inner = 340;
  const k = inner / Math.max(spanX, spanY);
  const pad = 34;
  const W = spanX * k + 2 * pad;
  const H = spanY * k + 2 * pad;
  const P = ([a, b]: [number, number]): [number, number] => [pad + (a - minX) * k, pad + (maxY - b) * k];
  const at = (name: string) => P(pts[name]);

  const cx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const cy = ys.reduce((s, v) => s + v, 0) / ys.length;
  const [ccx, ccy] = P([cx, cy]);

  const labels: { x: number; y: number; text: string }[] = [];
  const hidden = new Set(f.hideLabels ?? []);
  const inPolygon = new Set((f.polygons ?? []).flatMap((p) => p.pts));
  const els: ReactNode[] = [];

  // axes
  if (f.axes) {
    const a = f.axes;
    const step = a.step ?? niceStep(Math.max(a.xMax - a.xMin, a.yMax - a.yMin));
    if (a.grid) {
      for (let v = Math.ceil(a.xMin / step) * step; v <= a.xMax + 1e-9; v += step) {
        const [x1, y1] = P([v, a.yMin]);
        const [, y2] = P([v, a.yMax]);
        els.push(<line key={`gx${v}`} x1={x1} x2={x1} y1={y1} y2={y2} stroke="var(--border)" strokeWidth={1} />);
      }
      for (let v = Math.ceil(a.yMin / step) * step; v <= a.yMax + 1e-9; v += step) {
        const [x1, y1] = P([a.xMin, v]);
        const [x2] = P([a.xMax, v]);
        els.push(<line key={`gy${v}`} x1={x1} x2={x2} y1={y1} y2={y1} stroke="var(--border)" strokeWidth={1} />);
      }
    }
    const [x0a, y0] = P([a.xMin, 0]);
    const [x1a] = P([a.xMax, 0]);
    const [x0, y0b] = P([0, a.yMin]);
    const [, y1b] = P([0, a.yMax]);
    if (a.yMin <= 0 && a.yMax >= 0) {
      els.push(<line key="ax" x1={x0a - 6} x2={x1a + 6} y1={y0} y2={y0} stroke={INK} strokeWidth={1.3} />);
      els.push(<path key="axh" d={`M${x1a + 12} ${y0} l-8 -4 v8 z`} fill={INK} />);
      labels.push({ x: x1a + 22, y: y0, text: `$${a.xLabel ?? 'x'}$` });
    }
    if (a.xMin <= 0 && a.xMax >= 0) {
      els.push(<line key="ay" x1={x0} x2={x0} y1={y0b + 6} y2={y1b - 6} stroke={INK} strokeWidth={1.3} />);
      els.push(<path key="ayh" d={`M${x0} ${y1b - 12} l-4 8 h8 z`} fill={INK} />);
      labels.push({ x: x0, y: y1b - 22, text: `$${a.yLabel ?? 'y'}$` });
    }
    if (a.yMin <= 0 && a.yMax >= 0)
      for (let v = Math.ceil(a.xMin / step) * step; v <= a.xMax + 1e-9; v += step) {
        if (Math.abs(v) < 1e-9) continue;
        const [x] = P([v, 0]);
        els.push(<line key={`tx${v}`} x1={x} x2={x} y1={y0 - 4} y2={y0 + 4} stroke={INK} />);
        if (a.labelTicks) labels.push({ x, y: y0 + 14, text: `$${fmt(v)}$` });
      }
    if (a.xMin <= 0 && a.xMax >= 0)
      for (let v = Math.ceil(a.yMin / step) * step; v <= a.yMax + 1e-9; v += step) {
        if (Math.abs(v) < 1e-9) continue;
        const [, y] = P([0, v]);
        els.push(<line key={`ty${v}`} x1={x0 - 4} x2={x0 + 4} y1={y} y2={y} stroke={INK} />);
        if (a.labelTicks) labels.push({ x: x0 - 14, y, text: `$${fmt(v)}$` });
      }
    if (a.labelTicks && a.xMin <= 0 && a.yMin <= 0) labels.push({ x: x0 - 10, y: y0 + 12, text: '$O$' });
  }

  for (const [i, poly] of (f.polygons ?? []).entries()) {
    const d = poly.pts.map((n, j) => `${j ? 'L' : 'M'}${at(n).join(' ')}`).join(' ') + ' Z';
    els.push(
      <path key={`poly${i}`} d={d} fill={poly.shade ? 'var(--figure-fill)' : 'none'} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />,
    );
  }
  for (const [i, c] of (f.circles ?? []).entries()) {
    const [x, y] = at(c.center);
    els.push(<circle key={`c${i}`} cx={x} cy={y} r={c.r * k} fill={c.shade ? 'var(--figure-fill)' : 'none'} stroke={INK} strokeWidth={1.6} />);
  }
  for (const [i, c] of (f.curves ?? []).entries()) {
    const d = c.pts.map((p, j) => `${j ? 'L' : 'M'}${P(p).join(' ')}`).join(' ');
    els.push(<path key={`cv${i}`} d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeDasharray={c.dashed ? '6 5' : undefined} />);
  }
  for (const [i, l] of (f.lines ?? []).entries()) {
    if (!f.axes) continue;
    const seg = clipLine(l.through[0], l.through[1], f.axes);
    if (!seg) continue;
    const [a, b] = seg.map(P);
    els.push(
      <line key={`ln${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--series-1)" strokeWidth={2} strokeDasharray={l.dashed ? '6 5' : undefined} />,
    );
    if (l.label) labels.push({ x: b[0] - 8, y: b[1] - 14, text: l.label });
  }
  for (const [i, s] of (f.segments ?? []).entries()) {
    const [x1, y1] = at(s.from);
    const [x2, y2] = at(s.to);
    els.push(<line key={`s${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.6} strokeDasharray={s.dashed ? '5 4' : undefined} />);
    if (s.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      let nx = -(y2 - y1);
      let ny = x2 - x1;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      // put the label on the side away from the figure's center
      if ((mx - ccx) * nx + (my - ccy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      labels.push({ x: mx + nx * 16, y: my + ny * 16, text: s.label });
    }
  }
  for (const [i, r] of (f.rightAngles ?? []).entries()) {
    const v = at(r.vertex);
    const a = at(r.a);
    const b = at(r.b);
    const u1 = [(a[0] - v[0]) / Math.hypot(a[0] - v[0], a[1] - v[1]), (a[1] - v[1]) / Math.hypot(a[0] - v[0], a[1] - v[1])];
    const u2 = [(b[0] - v[0]) / Math.hypot(b[0] - v[0], b[1] - v[1]), (b[1] - v[1]) / Math.hypot(b[0] - v[0], b[1] - v[1])];
    const s = 11;
    const d = `M${v[0] + u1[0] * s} ${v[1] + u1[1] * s} L${v[0] + (u1[0] + u2[0]) * s} ${v[1] + (u1[1] + u2[1]) * s} L${v[0] + u2[0] * s} ${v[1] + u2[1] * s}`;
    els.push(<path key={`ra${i}`} d={d} fill="none" stroke={INK} strokeWidth={1.2} />);
  }
  for (const [i, an] of (f.angles ?? []).entries()) {
    const v = at(an.vertex);
    const a = at(an.a);
    const b = at(an.b);
    let t1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
    let t2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
    let diff = t2 - t1;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < 0) {
      [t1, t2] = [t2, t1];
      diff = -diff;
    }
    const r = 22;
    const p1 = [v[0] + r * Math.cos(t1), v[1] + r * Math.sin(t1)];
    const p2 = [v[0] + r * Math.cos(t1 + diff), v[1] + r * Math.sin(t1 + diff)];
    els.push(<path key={`an${i}`} d={`M${p1[0]} ${p1[1]} A${r} ${r} 0 0 1 ${p2[0]} ${p2[1]}`} fill="none" stroke={INK} strokeWidth={1.2} />);
    if (an.label) {
      const mid = t1 + diff / 2;
      const lr = r + 16;
      labels.push({ x: v[0] + lr * Math.cos(mid), y: v[1] + lr * Math.sin(mid), text: an.label });
    }
  }
  for (const [name, p] of Object.entries(pts)) {
    if (hidden.has(name)) continue;
    const [x, y] = P(p);
    if (!inPolygon.has(name)) els.push(<circle key={`pt${name}`} cx={x} cy={y} r={3.2} fill={INK} />);
    const off = f.labelOffsets?.[name];
    let dx: number;
    let dy: number;
    if (off) {
      const len = Math.hypot(off[0], off[1]) || 1;
      dx = (off[0] / len) * 15;
      dy = (-off[1] / len) * 15;
    } else {
      dx = x - ccx;
      dy = y - ccy;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) {
        dx = 0;
        dy = -15;
      } else {
        dx = (dx / len) * 15;
        dy = (dy / len) * 15;
      }
    }
    labels.push({ x: x + dx, y: y + dy, text: `$${name.replace(/_(\w+)/, '_{$1}')}$` });
  }
  for (const l of f.labels ?? []) {
    const [x, y] = P(l.at);
    labels.push({ x, y, text: l.text });
  }
  return (
    <>
      <Canvas w={W} h={H} labels={labels} maxWidth={Math.min(W, 460)} label="Geometry figure">
        {els}
      </Canvas>
      {f.notToScale && <div className="fig-note">Note: Figure not drawn to scale.</div>}
    </>
  );
}

/* ------------------------------------------------------------------ charts */
interface AxisSpec {
  yMin: number;
  yMax: number;
  yStep: number;
}
function axisFor(values: number[], yMin?: number, yMax?: number, yStep?: number): AxisSpec {
  const lo = yMin ?? Math.min(0, ...values);
  const hiRaw = Math.max(...values, lo + 1);
  const step = yStep ?? niceStep(hiRaw - lo);
  const hi = yMax ?? Math.ceil(hiRaw / step) * step;
  return { yMin: lo, yMax: hi, yStep: step };
}

function ChartFrame({
  title,
  yLabel,
  axis,
  W,
  H,
  left,
  bottom,
  children,
  legend,
}: {
  title?: string;
  yLabel?: string;
  axis: AxisSpec;
  W: number;
  H: number;
  left: number;
  bottom: number;
  children: ReactNode;
  legend?: { name: string; color: string }[];
}) {
  const top = 16;
  const right = 12;
  const y = (v: number) => top + (1 - (v - axis.yMin) / (axis.yMax - axis.yMin)) * (H - top - bottom);
  const ticks: number[] = [];
  for (let v = axis.yMin; v <= axis.yMax + 1e-9; v += axis.yStep) ticks.push(Number(v.toFixed(6)));
  return (
    <div>
      {title && <div className="fig-title">{title}</div>}
      <div className="figure-wrap" style={{ maxWidth: W, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={11}>
                {fmt(t)}
              </text>
            </g>
          ))}
          <line x1={left} x2={left} y1={top} y2={H - bottom} stroke={INK} />
          <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke={INK} />
          {yLabel && (
            <text x={12} y={(H - bottom + top) / 2} fontSize={11} textAnchor="middle" transform={`rotate(-90 12 ${(H - bottom + top) / 2})`}>
              {yLabel}
            </text>
          )}
          {children}
        </svg>
      </div>
      {legend && legend.length > 1 && (
        <div className="legend" style={{ justifyContent: 'center', marginTop: 4 }}>
          {legend.map((l) => (
            <span key={l.name}>
              <i className="level-dot" style={{ background: l.color }} /> {l.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BarChart({ f }: { f: BarChartFigure }) {
  const W = 520;
  const H = 280;
  const left = 54;
  const bottom = 46;
  const values = f.stacked ? f.categories.map((_, i) => f.series.reduce((s, se) => s + se.values[i], 0)) : f.series.flatMap((s) => s.values);
  const axis = axisFor(values, f.yMin, f.yMax, f.yStep);
  const plotW = W - left - 12;
  const band = plotW / f.categories.length;
  const y = (v: number) => 16 + (1 - (v - axis.yMin) / (axis.yMax - axis.yMin)) * (H - 16 - bottom);
  const nS = f.stacked ? 1 : f.series.length;
  const bw = Math.min(40, (band * 0.7) / nS);
  return (
    <ChartFrame
      title={f.title}
      yLabel={f.yLabel}
      axis={axis}
      W={W}
      H={H}
      left={left}
      bottom={bottom}
      legend={f.series.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
    >
      {f.categories.map((c, i) => {
        const x0 = left + i * band + (band - bw * nS) / 2;
        let acc = 0;
        return (
          <g key={c}>
            {f.series.map((s, j) => {
              const v = s.values[i];
              const base = f.stacked ? acc : 0;
              if (f.stacked) acc += v;
              const x = f.stacked ? x0 : x0 + j * bw;
              const yTop = y(base + v);
              const yBot = y(Math.max(axis.yMin, base));
              return (
                <g key={s.name}>
                  <rect x={x} y={yTop} width={bw - 2} height={Math.max(0, yBot - yTop)} fill={SERIES[j % SERIES.length]} />
                  {f.showValues && (
                    <text x={x + (bw - 2) / 2} y={yTop - 4} textAnchor="middle" fontSize={10.5}>
                      {fmt(v)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={left + i * band + band / 2} y={H - bottom + 16} textAnchor="middle" fontSize={11.5}>
              {c}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

function LineChart({ f }: { f: LineChartFigure }) {
  const W = 520;
  const H = 280;
  const left = 54;
  const bottom = 46;
  const axis = axisFor(
    f.series.flatMap((s) => s.values),
    f.yMin,
    f.yMax,
    f.yStep,
  );
  const plotW = W - left - 12;
  const band = plotW / f.categories.length;
  const x = (i: number) => left + i * band + band / 2;
  const y = (v: number) => 16 + (1 - (v - axis.yMin) / (axis.yMax - axis.yMin)) * (H - 16 - bottom);
  return (
    <ChartFrame
      title={f.title}
      yLabel={f.yLabel}
      axis={axis}
      W={W}
      H={H}
      left={left}
      bottom={bottom}
      legend={f.series.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
    >
      {f.categories.map((c, i) => (
        <text key={c} x={x(i)} y={H - bottom + 16} textAnchor="middle" fontSize={11.5}>
          {c}
        </text>
      ))}
      {f.series.map((s, j) => (
        <g key={s.name}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={SERIES[j % SERIES.length]} strokeWidth={2} />
          {s.values.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={3.5} fill={SERIES[j % SERIES.length]} />
              {f.showValues && (
                <text x={x(i)} y={y(v) - 8} textAnchor="middle" fontSize={10.5}>
                  {fmt(v)}
                </text>
              )}
            </g>
          ))}
        </g>
      ))}
    </ChartFrame>
  );
}

function PieChart({ f }: { f: PieChartFigure }) {
  const W = 460;
  const H = 300;
  const cx = W / 2;
  const cy = 150;
  const r = 105;
  let acc = 0;
  const slices = f.slices.map((s, i) => {
    const a0 = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const mid = (a0 + a1) / 2;
    const lx = cx + (r + 22) * Math.cos(mid);
    const ly = cy + (r + 22) * Math.sin(mid);
    const d = `M${cx} ${cy} L${p0[0]} ${p0[1]} A${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} Z`;
    return { d, lx, ly, s, color: SERIES[i % SERIES.length], anchor: Math.cos(mid) > 0.15 ? 'start' : Math.cos(mid) < -0.15 ? 'end' : 'middle' };
  });
  return (
    <div>
      {f.title && <div className="fig-title">{f.title}</div>}
      <div className="figure-wrap" style={{ maxWidth: W, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          {slices.map((sl, i) => (
            <path key={i} d={sl.d} fill={sl.color} fillOpacity={0.85} stroke="var(--surface)" strokeWidth={1.5} />
          ))}
          {slices.map((sl, i) => (
            <text key={`t${i}`} x={sl.lx} y={sl.ly + 4} textAnchor={sl.anchor as 'start'} fontSize={12}>
              {sl.s.label} {fmt(sl.s.value)}%
            </text>
          ))}
        </svg>
      </div>
      {f.caption && <div className="fig-note">{f.caption}</div>}
    </div>
  );
}

function Scatter({ f }: { f: ScatterFigure }) {
  const W = 480;
  const H = 320;
  const left = 54;
  const bottom = 46;
  const top = 16;
  const right = 14;
  const xStep = f.xStep ?? niceStep(f.xMax - f.xMin);
  const yStep = f.yStep ?? niceStep(f.yMax - f.yMin);
  const X = (v: number) => left + ((v - f.xMin) / (f.xMax - f.xMin)) * (W - left - right);
  const Y = (v: number) => top + (1 - (v - f.yMin) / (f.yMax - f.yMin)) * (H - top - bottom);
  const xt: number[] = [];
  for (let v = f.xMin; v <= f.xMax + 1e-9; v += xStep) xt.push(Number(v.toFixed(6)));
  const yt: number[] = [];
  for (let v = f.yMin; v <= f.yMax + 1e-9; v += yStep) yt.push(Number(v.toFixed(6)));
  return (
    <div>
      {f.title && <div className="fig-title">{f.title}</div>}
      <div className="figure-wrap" style={{ maxWidth: W, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          {yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={left} x2={W - right} y1={Y(t)} y2={Y(t)} stroke="var(--border)" />
              <text x={left - 6} y={Y(t) + 4} textAnchor="end" fontSize={11}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {xt.map((t) => (
            <g key={`x${t}`}>
              <line x1={X(t)} x2={X(t)} y1={top} y2={H - bottom} stroke="var(--border)" />
              <text x={X(t)} y={H - bottom + 16} textAnchor="middle" fontSize={11}>
                {fmt(t)}
              </text>
            </g>
          ))}
          <line x1={left} x2={left} y1={top} y2={H - bottom} stroke={INK} />
          <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke={INK} />
          {f.line &&
            (() => {
              const seg = clipLine([f.xMin, f.line.intercept + f.line.slope * f.xMin], [f.xMax, f.line.intercept + f.line.slope * f.xMax], f);
              return seg ? (
                <line x1={X(seg[0][0])} y1={Y(seg[0][1])} x2={X(seg[1][0])} y2={Y(seg[1][1])} stroke="var(--series-3)" strokeWidth={2} />
              ) : null;
            })()}
          {f.points.map(([a, b], i) => (
            <circle key={i} cx={X(a)} cy={Y(b)} r={4} fill="var(--series-1)" />
          ))}
          {f.xLabel && (
            <text x={(left + W - right) / 2} y={H - 8} textAnchor="middle" fontSize={12}>
              {f.xLabel}
            </text>
          )}
          {f.yLabel && (
            <text x={12} y={(H - bottom + top) / 2} fontSize={12} textAnchor="middle" transform={`rotate(-90 12 ${(H - bottom + top) / 2})`}>
              {f.yLabel}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

function Histogram({ f }: { f: HistogramFigure }) {
  const W = 520;
  const H = 280;
  const left = 54;
  const bottom = 50;
  const axis = axisFor(
    f.bins.map((b) => b.count),
    0,
    f.yMax,
    f.yStep,
  );
  const plotW = W - left - 12;
  const band = plotW / f.bins.length;
  const y = (v: number) => 16 + (1 - v / (axis.yMax - axis.yMin)) * (H - 16 - bottom);
  return (
    <ChartFrame title={f.title} yLabel={f.yLabel} axis={axis} W={W} H={H} left={left} bottom={bottom}>
      {f.bins.map((b, i) => (
        <g key={i}>
          <rect x={left + i * band} y={y(b.count)} width={band} height={H - bottom - y(b.count)} fill="var(--series-1)" fillOpacity={0.8} stroke="var(--surface)" />
          <text x={left + i * band + band / 2} y={H - bottom + 16} textAnchor="middle" fontSize={11}>
            {b.label}
          </text>
        </g>
      ))}
      {f.xLabel && (
        <text x={(left + W) / 2} y={H - 8} textAnchor="middle" fontSize={12}>
          {f.xLabel}
        </text>
      )}
    </ChartFrame>
  );
}

function BoxPlot({ f }: { f: BoxPlotFigure }) {
  const W = 520;
  const rowH = 54;
  const H = 30 + f.boxes.length * rowH + 30;
  const left = f.boxes.some((b) => b.name) ? 90 : 24;
  const right = 20;
  const X = (v: number) => left + ((v - f.axisMin) / (f.axisMax - f.axisMin)) * (W - left - right);
  const ticks: number[] = [];
  for (let v = f.axisMin; v <= f.axisMax + 1e-9; v += f.step) ticks.push(Number(v.toFixed(6)));
  const axisY = H - 30;
  return (
    <div>
      {f.title && <div className="fig-title">{f.title}</div>}
      <div className="figure-wrap" style={{ maxWidth: W, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          <line x1={left} x2={W - right} y1={axisY} y2={axisY} stroke={INK} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={X(t)} x2={X(t)} y1={axisY - 4} y2={axisY + 4} stroke={INK} />
              <text x={X(t)} y={axisY + 18} textAnchor="middle" fontSize={11}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {f.boxes.map((b, i) => {
            const cy = 30 + i * rowH + rowH / 2 - 10;
            const h = 26;
            return (
              <g key={i}>
                {b.name && (
                  <text x={left - 10} y={cy + 4} textAnchor="end" fontSize={12}>
                    {b.name}
                  </text>
                )}
                <line x1={X(b.min)} x2={X(b.q1)} y1={cy} y2={cy} stroke={INK} />
                <line x1={X(b.q3)} x2={X(b.max)} y1={cy} y2={cy} stroke={INK} />
                <line x1={X(b.min)} x2={X(b.min)} y1={cy - 8} y2={cy + 8} stroke={INK} />
                <line x1={X(b.max)} x2={X(b.max)} y1={cy - 8} y2={cy + 8} stroke={INK} />
                <rect x={X(b.q1)} y={cy - h / 2} width={X(b.q3) - X(b.q1)} height={h} fill="var(--figure-fill)" stroke={INK} />
                <line x1={X(b.median)} x2={X(b.median)} y1={cy - h / 2} y2={cy + h / 2} stroke={INK} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Table({ f }: { f: TableFigure }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      {f.title && (
        <div className="fig-title">
          <RichInline text={f.title} />
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {f.headers.map((h, i) => (
              <th key={i}>
                <RichInline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {f.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>
                  <RichInline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {f.note && <Rich className="fig-note" text={f.note} />}
    </div>
  );
}

export function Figure({ figure }: { figure: FigureT | FigureT[] | undefined }) {
  if (!figure) return null;
  const list = Array.isArray(figure) ? figure : [figure];
  return (
    <>
      {list.map((f, i) => (
        <div className="figure" key={i}>
          {f.kind === 'numberLine' && <NumberLine f={f} />}
          {f.kind === 'geometry' && <Geometry f={f} />}
          {f.kind === 'table' && <Table f={f} />}
          {f.kind === 'bar' && <BarChart f={f} />}
          {f.kind === 'line' && <LineChart f={f} />}
          {f.kind === 'pie' && <PieChart f={f} />}
          {f.kind === 'scatter' && <Scatter f={f} />}
          {f.kind === 'histogram' && <Histogram f={f} />}
          {f.kind === 'boxplot' && <BoxPlot f={f} />}
        </div>
      ))}
    </>
  );
}
