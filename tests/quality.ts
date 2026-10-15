// Content quality gates (see quality.test.ts). Each gate scans the generated text of a template over
// many seeds and returns the rules it breaks, with one example, so a template can be allowlisted
// per rule in tests/quality-allow/<area>.json while the content is being fixed.

import { Frac, parseDecimal } from '../src/engine/frac';
import { generateBody, hashString } from '../src/engine/generate';
import { parseRich, type Segment } from '../src/engine/rich';
import type { Difficulty, Figure, QuestionBody, Template } from '../src/engine/types';

/** Seeds for the text, distractor, degenerate, QC and figure gates. */
export const QUALITY_SEEDS = 150;
/** Seeds for the bank-size and difficulty-spread gate (the app serves 500; 300 keeps the test fast). */
export const BANK_SEEDS = 300;
const DIFFS: Difficulty[] = [1, 2, 3];

/** Every rule a template can break; these are the keys of the allowlist files. */
export const GATES = [
  'artifacts.coef-1',
  'artifacts.frac-1',
  'artifacts.exp-1',
  'artifacts.sign',
  'artifacts.plural-1',
  'artifacts.doubled-word',
  'artifacts.so-the',
  'distractors.trapped',
  'distractors.equal',
  'distractors.cited',
  'degenerate.trivial',
  'degenerate.trap-answer',
  'bank.size',
  'bank.difficulty',
  'qc.never-d',
  'qc.d-share',
  'figures.scale',
] as const;
export type Gate = (typeof GATES)[number];

/* ------------------------------------------------------------------------------ text extraction */

/** The rich strings a student reads: stem parts, choices, explanation. */
function richStrings(q: QuestionBody): string[] {
  switch (q.format) {
    case 'qc':
      return [q.info ?? '', q.quantityA, q.quantityB, q.explanation];
    case 'mcs':
      return [q.stem, ...q.choices.map((c) => c.text), q.explanation];
    case 'mcm':
      return [q.stem, q.instruction, ...q.choices.map((c) => c.text), q.explanation];
    case 'ne':
      return [q.stem, q.prefix ?? '', q.suffix ?? '', q.explanation];
  }
}

const isNumberTex = (tex: string) => /^-?[\d.]+(\{,\}\d{3})*(\.\d+)?$/.test(tex.trim());

/**
 * Splits rich text into its TeX (one entry per math segment) and its prose, one line per paragraph or
 * bullet. In the prose a math segment that is a plain number is inlined ("$1$ years" reads "1 years")
 * and any other math becomes a neutral token, so words are never glued across a formula.
 */
function splitRich(s: string): { math: string[]; prose: string[] } {
  const math: string[] = [];
  const prose: string[] = [];
  let blocks;
  try {
    blocks = parseRich(s);
  } catch {
    return { math, prose: [s] }; // broken $ is reported by validate.ts
  }
  const line = (segs: Segment[]) =>
    segs
      .map((g) => {
        if (g.type === 'text') return g.value;
        math.push(g.value);
        return isNumberTex(g.value) ? g.value.trim().replace(/\{,\}/g, ',') : ' ⟨m⟩ ';
      })
      .join('');
  for (const b of blocks) {
    if (b.type === 'display') math.push(b.tex);
    else if (b.type === 'p') prose.push(line(b.segments));
    else for (const item of b.items) prose.push(line(item));
  }
  return { math, prose };
}

/* -------------------------------------------------------------------------- 1. artifacts */

/** Words ending in "s" that may follow "1" without being a plural noun. */
const NOT_PLURAL = new Set(
  'is was has does as its this thus plus minus less unless yes his us times gives means makes equals remains leaves goes grows shrinks holds answers divides appears belongs comes lies works fails counts stays becomes represents contains satisfies exceeds follows occurs results uses lands sits falls ends starts gets needs takes keeps puts sets wins loses adds subtracts multiplies always perhaps'.split(
    ' ',
  ),
);

const ARTIFACTS: { gate: Gate; math?: RegExp; prose?: RegExp; skip?: (m: RegExpExecArray) => boolean }[] = [
  // "1x", "-1y", "1\pi", "1\sqrt{2}": a coefficient 1 that should be hidden. Not "0.1x", "21x", "x_1y".
  { gate: 'artifacts.coef-1', math: /(?<![\w.])1\s*(?:[a-z](?![a-zA-Z])|\\pi\b|\\sqrt\b)/, prose: /(?<![\w.,])1[a-z]\b/ },
  // "\frac{3}{1}", "3/1}"
  { gate: 'artifacts.frac-1', math: /\\[dt]?frac\{[^{}]+\}\{1\}|\/1\}/, prose: /(?<![\w.])\d+\/1(?![\d.])/ },
  // "x^1", "x^{1}"
  { gate: 'artifacts.exp-1', math: /\^\{1\}|\^1(?![\d.])/ },
  // "5 - -3", "5 + -3", "5 −− 3": subtracting or adding a negative written without parentheses
  { gate: 'artifacts.sign', math: /-\s*-|\+\s*-|−\s*−/ },
  // "1 years", "1 inches"
  {
    gate: 'artifacts.plural-1',
    prose: /(?<![\w.,$\-−])1 ([a-z]+s)\b/,
    skip: (m) => NOT_PLURAL.has(m[1]),
  },
  // "the the", "is is"
  { gate: 'artifacts.doubled-word', prose: /\b([A-Za-z]+)\s+\1\b/i },
  // "So The" (a capitalized sentence glued after a connective)
  { gate: 'artifacts.so-the', prose: /\b(?:[Ss]o|and|but|then|thus|because) The\b/ },
];

function firstMatch(re: RegExp, s: string, skip?: (m: RegExpExecArray) => boolean): string | null {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (let m = g.exec(s); m; m = g.exec(s)) {
    if (!skip?.(m)) return s.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25);
    if (m[0] === '') g.lastIndex++;
  }
  return null;
}

/** Artifact rules broken by one question, with the offending excerpt. */
export function artifactHits(q: QuestionBody): Map<Gate, string> {
  const hits = new Map<Gate, string>();
  for (const s of richStrings(q)) {
    if (!s) continue;
    const { math, prose } = splitRich(s);
    for (const a of ARTIFACTS) {
      if (hits.has(a.gate)) continue;
      for (const [re, parts] of [
        [a.math, math],
        [a.prose, prose],
      ] as const) {
        if (!re) continue;
        for (const p of parts) {
          const hit = firstMatch(re, p, a.skip);
          if (hit) {
            hits.set(a.gate, hit);
            break;
          }
        }
        if (hits.has(a.gate)) break;
      }
    }
  }
  return hits;
}

/* -------------------------------------------------------------------------- values of choices */

/**
 * Exact value of a choice that is a single number: "12", "$-0.5$", "$\frac{3}{4}$", "3/4", "$2\frac{1}{3}$",
 * "\$1,250", "$12.5\%$". Anything else (expressions, words, radicals) gives null.
 */
export function choiceValue(text: string): Frac | null {
  let s = text.trim();
  const m = /^\$([^$]*)\$$/.exec(s);
  if (m) s = m[1];
  s = s
    .replace(/\\\$|\\%|%|\{,\}|,|\\[,;!]|\s+/g, '')
    .replace(/^\\text\{([^{}]*)\}$/, '$1')
    .replace(/−/g, '-');
  const dec = /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseDecimal(s) : null;
  if (dec) return dec;
  let f = /^(-)?\\[dt]?frac\{(-?\d+)\}\{(\d+)\}$/.exec(s) ?? /^(-)?\(?(-?\d+)\)?\/(\d+)$/.exec(s);
  if (f) {
    if (Number(f[3]) === 0) return null;
    const v = new Frac(Number(f[2]), Number(f[3]));
    return f[1] ? v.neg() : v;
  }
  f = /^(-)?(\d+)\\[dt]?frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (f && Number(f[4]) !== 0) {
    const v = new Frac(Number(f[2]) * Number(f[4]) + Number(f[3]), Number(f[4]));
    return f[1] ? v.neg() : v;
  }
  return null;
}

/* -------------------------------------------------------------------------- figures */

/** Length written on a segment label: "$6$", "6 cm", "$4\sqrt{3}$", "$\frac{5}{2}$". Null for "$x$", "$2x$"... */
export function labelLength(label: string): number | null {
  let s = label.replace(/\$/g, '').replace(/\\text\{\s*(cm|m|in|ft|units?|km|mm)\s*\}|\b(cm|m|in|ft|units?|km|mm)\b/g, '');
  s = s.replace(/\{,\}|,|\s+/g, '');
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  let m = /^\\[dt]?frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return Number(m[1]) / Number(m[2]);
  m = /^(\d*)\\sqrt\{(\d+)\}$/.exec(s);
  if (m) return (m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]));
  return null;
}

/** Worst ratio between the drawn/labelled scales of the numerically labelled segments (1 = to scale). */
export function figureScaleSpread(f: Figure): number {
  if (f.kind !== 'geometry' || f.notToScale || !f.segments) return 1;
  const ks: number[] = [];
  for (const s of f.segments) {
    const len = s.label ? labelLength(s.label) : null;
    const a = f.points[s.from];
    const b = f.points[s.to];
    if (!len || !a || !b) continue;
    ks.push(Math.hypot(a[0] - b[0], a[1] - b[1]) / len);
  }
  if (ks.length < 2) return 1;
  return Math.max(...ks) / Math.min(...ks);
}

/* -------------------------------------------------------------------------- the gates */

/** What a student sees before answering, choices as a set (their order does not count): used to count distinct questions. */
function presented(q: QuestionBody): number {
  const { explanation: _e, answer: _a, ...shown } = q as QuestionBody & { traps?: unknown };
  delete shown.traps;
  if ('choices' in shown) shown.choices = shown.choices.map((c) => ({ text: c.text })).sort((a, b) => (a.text < b.text ? -1 : 1));
  return hashString(JSON.stringify(shown));
}

/** A sentence that names a mistake ... */
const TRAP_SENTENCE = /\b(?:traps?|slips?|mistakes?|wrong|tempting)\b/i;
/** ... and cites its result: "gives $48{,}450$", "($26$)", "leads to $8$". */
const CITED = /(?:\b(?:gives?|giving|gets?|getting|yields?|leads to|lands on|produces)\s+|\()\$([^$]+)\$/g;

/** Numbers an explanation cites as the result of a mistake. */
export function citedTrapValues(explanation: string): Frac[] {
  const out: Frac[] = [];
  for (const s of explanation.split(/(?<=[.!?])\s+(?=[A-Z$(])|\n+/)) {
    if (!TRAP_SENTENCE.test(s)) continue;
    for (const m of s.matchAll(CITED)) {
      const v = choiceValue(`$${m[1]}$`);
      if (v) out.push(v);
    }
  }
  return out;
}

/**
 * Runs every gate on one template. Returns the broken rules, each with a short example message.
 * Text gates use seeds 1..QUALITY_SEEDS at d1-d3; the bank gate uses seeds 1..BANK_SEEDS.
 */
export function templateGateFailures(t: Template<any>): Map<Gate, string> {
  const fails = new Map<Gate, string>();
  const fail = (g: Gate, msg: string) => {
    if (!fails.has(g)) fails.set(g, msg);
  };
  const stems: Map<number, number>[] = DIFFS.map(() => new Map()); // seed -> presented hash
  let n = 0;
  let trivial = 0;
  let qcD = 0;
  let qcN = 0;

  for (const d of DIFFS) {
    for (let seed = 1; seed <= BANK_SEEDS; seed++) {
      const q = generateBody(t, seed, d).q;
      stems[d - 1].set(seed, presented(q));
      if (seed > QUALITY_SEEDS) continue;
      const at = `seed ${seed} d${d}`;
      n++;

      // 1. artifacts
      for (const [g, excerpt] of artifactHits(q)) fail(g, `${at}: "${excerpt}"`);

      // 2-3. distractors and degenerate answers
      if (q.format === 'mcs' || q.format === 'mcm') {
        const right = new Set(q.format === 'mcs' ? [q.answer] : q.answer);
        const wrong = q.choices.filter((_, i) => !right.has(i));
        const trapped = wrong.filter((c) => c.trap).length;
        if (trapped * 2 < wrong.length) fail('distractors.trapped', `${at}: ${trapped} of ${wrong.length} wrong choices carry a trap`);
        const vals = q.choices.map((c) => choiceValue(c.text));
        for (let i = 0; i < vals.length; i++)
          for (let j = i + 1; j < vals.length; j++) {
            const a = vals[i];
            const b = vals[j];
            if (a && b && a.eq(b)) {
              fail('distractors.equal', `${at}: "${q.choices[i].text}" = "${q.choices[j].text}"`);
              if (right.has(i) !== right.has(j) && (q.choices[i].trap || q.choices[j].trap))
                fail('degenerate.trap-answer', `${at}: trap choice equals the correct "${q.choices[right.has(i) ? i : j].text}"`);
            }
          }
        for (const v of citedTrapValues(q.explanation))
          if (!vals.some((c) => c?.eq(v))) fail('distractors.cited', `${at}: the explanation cites the mistaken result ${v} but no choice has it`);
        if (q.format === 'mcs') {
          const v = vals[q.answer];
          if (v && (v.eq(0) || v.eq(1))) trivial++;
        }
      } else if (q.format === 'ne') {
        if (q.answer.eq(0) || q.answer.eq(1)) trivial++;
        for (const tr of q.traps ?? []) if (tr.value.eq(q.answer)) fail('degenerate.trap-answer', `${at}: NE trap "${tr.trap}" equals the answer`);
      } else {
        qcN++;
        if (q.answer === 'D') qcD++;
      }

      // 6. figures
      const figs = q.figure ? (Array.isArray(q.figure) ? q.figure : [q.figure]) : [];
      for (const f of figs) {
        const spread = figureScaleSpread(f);
        if (spread > 1.15) fail('figures.scale', `${at}: labelled lengths and drawn lengths differ by ${Math.round((spread - 1) * 100)}% without notToScale`);
      }
    }
  }

  // 3. degenerate answers
  if (trivial / n > 0.15) fail('degenerate.trivial', `answer is 0 or 1 in ${Math.round((trivial / n) * 100)}% of ${n} questions`);

  // 4. banks
  const sizes = stems.map((m) => new Set(m.values()).size);
  if (sizes.some((s) => s < 100)) fail('bank.size', `distinct questions over ${BANK_SEEDS} seeds: d1 ${sizes[0]}, d2 ${sizes[1]}, d3 ${sizes[2]} (need 100)`);
  for (const [a, b] of [
    [0, 1],
    [1, 2],
  ]) {
    let differ = 0;
    for (let seed = 1; seed <= BANK_SEEDS; seed++) if (stems[a].get(seed) !== stems[b].get(seed)) differ++;
    if (differ < 0.3 * BANK_SEEDS) fail('bank.difficulty', `d${a + 1} and d${b + 1} differ on only ${differ} of ${BANK_SEEDS} seeds`);
  }

  // 5. QC balance
  if (t.format === 'qc') {
    if (qcD === 0) fail('qc.never-d', `never D in ${qcN} questions`);
    else if (qcD / qcN < 0.08) fail('qc.d-share', `D in ${qcD} of ${qcN} questions (${Math.round((qcD / qcN) * 100)}%, need 8%)`);
  }
  return fails;
}
