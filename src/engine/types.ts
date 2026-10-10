import type { Frac } from './frac';
import type { Rng } from './rng';

/**
 * Rich text: plain text with inline TeX between single dollar signs ($x^2$) and display TeX
 * between double dollar signs ($$...$$). Paragraphs are separated by a blank line ("\n\n").
 * A literal dollar sign (money) MUST be written as "\\$" in a JS string (see usd() in tex.ts).
 */
export type Rich = string;

export type Area = 'arithmetic' | 'algebra' | 'geometry' | 'data';
export type Format = 'qc' | 'mcs' | 'mcm' | 'ne';
export type Difficulty = 1 | 2 | 3;
export type QCChoice = 'A' | 'B' | 'C' | 'D';

export interface Choice {
  text: Rich;
  /** Id of the trap (common mistake) this wrong choice comes from, if any. */
  trap?: string;
}

/* ----------------------------------------------------------------------------------------------
 * Figures. All coordinates are math coordinates (y axis points up); the renderer scales them.
 * Labels are Rich text unless stated otherwise.
 * -------------------------------------------------------------------------------------------- */

export interface NumberLineFigure {
  kind: 'numberLine';
  /** Visible range used for layout only. */
  min: number;
  max: number;
  /** Labeled points drawn as dots. `name` is drawn above, `value` (TeX) below. */
  points: { at: number; name?: string; value?: Rich }[];
  /** Plain tick marks with optional TeX label below. */
  ticks?: { at: number; label?: Rich }[];
}

export interface GeometryFigure {
  kind: 'geometry';
  /** Named points, math coordinates. */
  points: Record<string, [number, number]>;
  /** Point names to hide (e.g. helper points). By default every named point gets its name drawn. */
  hideLabels?: string[];
  /** Override where a point label goes, as a direction offset in figure units, e.g. [0, 1] = above. */
  labelOffsets?: Record<string, [number, number]>;
  segments?: { from: string; to: string; label?: Rich; dashed?: boolean }[];
  polygons?: { pts: string[]; shade?: boolean }[];
  circles?: { center: string; r: number; shade?: boolean }[];
  /** Small square at `vertex` between rays vertex->a and vertex->b. */
  rightAngles?: { a: string; vertex: string; b: string }[];
  /** Arc mark at `vertex` between rays vertex->a and vertex->b, with an optional label like "x°". */
  angles?: { a: string; vertex: string; b: string; label?: Rich }[];
  /** Free text labels at a coordinate. */
  labels?: { at: [number, number]; text: Rich }[];
  /** Coordinate axes (for coordinate geometry). */
  axes?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    grid?: boolean;
    /** Tick spacing; ticks are unlabeled unless labelTicks is set. */
    step?: number;
    labelTicks?: boolean;
    xLabel?: string;
    yLabel?: string;
  };
  /** Infinite lines through two coordinates, clipped to the axes window (requires axes). */
  lines?: { through: [[number, number], [number, number]]; label?: Rich; dashed?: boolean }[];
  /** Polylines, e.g. a sampled parabola. */
  curves?: { pts: [number, number][]; dashed?: boolean }[];
  /** Adds "Note: Figure not drawn to scale." under the figure. */
  notToScale?: boolean;
}

export interface TableFigure {
  kind: 'table';
  title?: Rich;
  headers: Rich[];
  rows: Rich[][];
  note?: Rich;
}

export interface Series {
  name: string;
  values: number[];
}

export interface BarChartFigure {
  kind: 'bar';
  title?: string;
  categories: string[];
  series: Series[];
  yLabel?: string;
  yMin?: number;
  yMax?: number;
  yStep?: number;
  /** Print the value on top of each bar. */
  showValues?: boolean;
  stacked?: boolean;
}

export interface LineChartFigure {
  kind: 'line';
  title?: string;
  categories: string[];
  series: Series[];
  yLabel?: string;
  yMin?: number;
  yMax?: number;
  yStep?: number;
  showValues?: boolean;
}

export interface PieChartFigure {
  kind: 'pie';
  title?: string;
  /** Values are percents and should add up to 100. */
  slices: { label: string; value: number }[];
  /** Text in the middle/below, e.g. "Total expenses: $2,400,000". Plain text. */
  caption?: string;
}

export interface ScatterFigure {
  kind: 'scatter';
  title?: string;
  points: [number, number][];
  xLabel?: string;
  yLabel?: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep?: number;
  yStep?: number;
  /** Optional least-squares or reference line y = slope x + intercept. */
  line?: { slope: number; intercept: number };
}

export interface HistogramFigure {
  kind: 'histogram';
  title?: string;
  /** Adjacent bins drawn without gaps. */
  bins: { label: string; count: number }[];
  xLabel?: string;
  yLabel?: string;
  yMax?: number;
  yStep?: number;
}

export interface BoxPlotFigure {
  kind: 'boxplot';
  title?: string;
  /** One or more box plots on a shared axis. */
  boxes: { name?: string; min: number; q1: number; median: number; q3: number; max: number }[];
  axisMin: number;
  axisMax: number;
  step: number;
}

export type Figure =
  | NumberLineFigure
  | GeometryFigure
  | TableFigure
  | BarChartFigure
  | LineChartFigure
  | PieChartFigure
  | ScatterFigure
  | HistogramFigure
  | BoxPlotFigure;

/* ----------------------------------------------------------------------------------------------
 * Questions
 * -------------------------------------------------------------------------------------------- */

interface QBase {
  /** Figure(s) shown above the question. */
  figure?: Figure | Figure[];
  /** Worked solution. Paragraphs separated by a blank line. */
  explanation: Rich;
}

/** Quantitative comparison. */
export interface QCQuestion extends QBase {
  format: 'qc';
  /** Centered information above the two quantities. */
  info?: Rich;
  quantityA: Rich;
  quantityB: Rich;
  answer: QCChoice;
  /** Wrong choices that correspond to a known mistake. */
  traps?: Partial<Record<QCChoice, string>>;
}

/** Multiple choice, select exactly one (5 choices on the GRE). */
export interface MCSQuestion extends QBase {
  format: 'mcs';
  stem: Rich;
  choices: Choice[];
  answer: number;
}

/** Multiple choice, select one or more ("Indicate all such ..."). */
export interface MCMQuestion extends QBase {
  format: 'mcm';
  stem: Rich;
  /** e.g. "Indicate all such values." */
  instruction: Rich;
  choices: Choice[];
  /** Indices of the correct choices, ascending. At least one. */
  answer: number[];
}

/** Numeric entry. */
export interface NEQuestion extends QBase {
  format: 'ne';
  stem: Rich;
  /** Exact correct value. Any equivalent form (2.5, 2.50, 5/2 in fraction boxes) is accepted. */
  answer: Frac;
  /** Two boxes (numerator / denominator) instead of one decimal box. */
  fractionBoxes?: boolean;
  /** Text before / after the box, e.g. prefix "$x + y =$", suffix "employees". */
  prefix?: Rich;
  suffix?: Rich;
  /** Wrong values that correspond to a known mistake. */
  traps?: { value: Frac; trap: string }[];
}

export type QuestionBody = QCQuestion | MCSQuestion | MCMQuestion | NEQuestion;

export type Question = QuestionBody & {
  /** `${templateId}#${seed}#${difficulty}` - enough to regenerate it. */
  id: string;
  templateId: string;
  skillId: string;
  seed: number;
  difficulty: Difficulty;
};

/* ----------------------------------------------------------------------------------------------
 * Content registry
 * -------------------------------------------------------------------------------------------- */

export interface Skill {
  /** e.g. 'arith.cycles' */
  id: string;
  area: Area;
  /** Unit name inside the area, e.g. 'Integers'. Skills with the same unit are grouped. */
  unit: string;
  name: string;
  /** One-line description. */
  summary: string;
  /** Strategy card: the fast methods for this skill. Rich text; lines starting with "- " are bullets. */
  strategy: Rich;
}

export interface Trap {
  /** Short name of the mistake, e.g. "√a − √b = √(a − b)". Rich text. */
  label: Rich;
  /** Why it is wrong and what to do instead. Rich text. */
  fix: Rich;
}

export interface Template<P = unknown> {
  /** Unique id, e.g. 'arith.cycles.decimal-digit'. Never rename once shipped (progress refers to it). */
  id: string;
  /** Skill id this template trains. */
  skill: string;
  format: Format;
  /** Short description of the question style, e.g. "n-th digit of a repeating decimal". */
  style: string;
  /** Deterministic given the rng. Difficulty 1 = easy, 2 = medium (GRE typical), 3 = hard. */
  generate(rng: Rng, difficulty: Difficulty): { q: QuestionBody; params: P };
  /**
   * Independent verification used by the test-suite: recompute the answer from `params` with a
   * different method than generate() (brute force, enumeration, random sampling of the allowed
   * values...). Return an error message when the stored answer is wrong, null when it is right.
   */
  check(q: QuestionBody, params: P, rng: Rng): string | null;
}

export interface AreaContent {
  area: Area;
  skills: Skill[];
  templates: Template<any>[];
  traps: Record<string, Trap>;
}
