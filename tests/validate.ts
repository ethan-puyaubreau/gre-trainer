import katex from 'katex';
import { Frac } from '../src/engine/frac';
import { parseRich } from '../src/engine/rich';
import type { Figure, QuestionBody, Template, Trap } from '../src/engine/types';

/** Render every math segment of a rich string with KaTeX; report broken TeX and TeX outside math. */
export function richErrors(s: string | undefined, where: string): string[] {
  if (s === undefined) return [];
  if (typeof s !== 'string') return [`${where}: not a string`];
  const errs: string[] = [];
  let blocks;
  try {
    blocks = parseRich(s);
  } catch (e) {
    return [`${where}: ${(e as Error).message}`];
  }
  const render = (tex: string, display: boolean) => {
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' });
    } catch (e) {
      errs.push(`${where}: KaTeX error in "${tex}": ${(e as Error).message}`);
    }
  };
  for (const b of blocks) {
    if (b.type === 'display') render(b.tex, true);
    const segs = b.type === 'p' ? b.segments : b.type === 'ul' ? b.items.flat() : [];
    for (const seg of segs) {
      if (seg.type === 'math') render(seg.value, false);
      else if (seg.type === 'display') render(seg.value, true);
      else if (/\\[a-zA-Z]+|\^|\\\{/.test(seg.value)) errs.push(`${where}: TeX outside of $...$: "${seg.value}"`);
      else if (/(^|[\s(])-\d/.test(seg.value)) errs.push(`${where}: negative number outside of $...$ (renders as a hyphen): "${seg.value}"`);
    }
  }
  return errs;
}

function figureErrors(f: Figure, where: string): string[] {
  const errs: string[] = [];
  const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  switch (f.kind) {
    case 'numberLine':
      if (!(f.min < f.max)) errs.push(`${where}: numberLine min >= max`);
      for (const p of f.points) {
        if (!finite(p.at) || p.at < f.min || p.at > f.max) errs.push(`${where}: numberLine point out of range`);
        errs.push(...richErrors(p.value, `${where}.value`));
      }
      for (const t of f.ticks ?? []) errs.push(...richErrors(t.label, `${where}.tick`));
      break;
    case 'geometry': {
      const names = new Set(Object.keys(f.points));
      for (const [k, v] of Object.entries(f.points)) if (!finite(v[0]) || !finite(v[1])) errs.push(`${where}: point ${k} not finite`);
      const need = (n: string) => {
        if (!names.has(n)) errs.push(`${where}: unknown point ${n}`);
      };
      f.segments?.forEach((s) => {
        need(s.from);
        need(s.to);
        errs.push(...richErrors(s.label, `${where}.segment`));
      });
      f.polygons?.forEach((p) => p.pts.forEach(need));
      f.circles?.forEach((c) => {
        need(c.center);
        if (!(c.r > 0)) errs.push(`${where}: circle radius`);
      });
      f.rightAngles?.forEach((r) => [r.a, r.vertex, r.b].forEach(need));
      f.angles?.forEach((a) => {
        [a.a, a.vertex, a.b].forEach(need);
        errs.push(...richErrors(a.label, `${where}.angle`));
      });
      f.labels?.forEach((l) => errs.push(...richErrors(l.text, `${where}.label`)));
      f.lines?.forEach((l) => errs.push(...richErrors(l.label, `${where}.line`)));
      if (f.lines?.length && !f.axes) errs.push(`${where}: lines require axes`);
      break;
    }
    case 'table':
      errs.push(...richErrors(f.title, `${where}.title`));
      f.headers.forEach((h) => errs.push(...richErrors(h, `${where}.header`)));
      f.rows.forEach((r) => {
        if (r.length !== f.headers.length) errs.push(`${where}: row length ${r.length} != headers ${f.headers.length}`);
        r.forEach((c) => errs.push(...richErrors(c, `${where}.cell`)));
      });
      errs.push(...richErrors(f.note, `${where}.note`));
      break;
    case 'bar':
    case 'line':
      if (!f.series.length) errs.push(`${where}: no series`);
      f.series.forEach((s) => {
        if (s.values.length !== f.categories.length) errs.push(`${where}: series ${s.name} length`);
        if (!s.values.every(finite)) errs.push(`${where}: series ${s.name} not finite`);
      });
      break;
    case 'pie': {
      const total = f.slices.reduce((s, x) => s + x.value, 0);
      if (Math.abs(total - 100) > 0.51) errs.push(`${where}: pie slices sum to ${total}`);
      break;
    }
    case 'scatter':
      if (!f.points.every((p) => finite(p[0]) && finite(p[1]))) errs.push(`${where}: scatter point not finite`);
      break;
    case 'histogram':
      if (!f.bins.every((b) => finite(b.count) && b.count >= 0)) errs.push(`${where}: histogram counts`);
      break;
    case 'boxplot':
      f.boxes.forEach((b) => {
        if (!(b.min <= b.q1 && b.q1 <= b.median && b.median <= b.q3 && b.q3 <= b.max)) errs.push(`${where}: boxplot order`);
      });
      break;
    default:
      errs.push(`${where}: unknown figure kind ${(f as { kind: string }).kind}`);
  }
  return errs;
}

/** Structural checks shared by every template. */
export function questionErrors(q: QuestionBody, t: Template<any>, traps: Record<string, Trap>): string[] {
  const errs: string[] = [];
  const w = t.id;
  if (q.format !== t.format) errs.push(`${w}: format ${q.format} != declared ${t.format}`);
  if (!q.explanation || q.explanation.trim().length < 20) errs.push(`${w}: explanation missing or too short`);
  errs.push(...richErrors(q.explanation, `${w}.explanation`));
  const figs = q.figure ? (Array.isArray(q.figure) ? q.figure : [q.figure]) : [];
  figs.forEach((f, i) => errs.push(...figureErrors(f, `${w}.figure[${i}]`)));
  const trapKnown = (id: string | undefined, where: string) => {
    if (id !== undefined && !traps[id]) errs.push(`${w}: unknown trap id "${id}" at ${where}`);
  };

  switch (q.format) {
    case 'qc':
      if (!['A', 'B', 'C', 'D'].includes(q.answer)) errs.push(`${w}: bad QC answer ${q.answer}`);
      errs.push(...richErrors(q.info, `${w}.info`), ...richErrors(q.quantityA, `${w}.A`), ...richErrors(q.quantityB, `${w}.B`));
      if (!q.quantityA?.trim() || !q.quantityB?.trim()) errs.push(`${w}: empty quantity`);
      for (const [k, v] of Object.entries(q.traps ?? {})) {
        if (k === q.answer) errs.push(`${w}: trap on the correct QC choice`);
        trapKnown(v, `qc ${k}`);
      }
      break;
    case 'mcs':
    case 'mcm': {
      errs.push(...richErrors(q.stem, `${w}.stem`));
      const texts = q.choices.map((c) => c.text);
      if (new Set(texts).size !== texts.length) errs.push(`${w}: duplicate choices ${texts.join(' | ')}`);
      q.choices.forEach((c, i) => {
        errs.push(...richErrors(c.text, `${w}.choice${i}`));
        if (!c.text.trim()) errs.push(`${w}: empty choice`);
        trapKnown(c.trap, `choice ${i}`);
      });
      if (q.format === 'mcs') {
        if (q.choices.length !== 5) errs.push(`${w}: single-answer questions need exactly 5 choices (got ${q.choices.length})`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) errs.push(`${w}: answer index out of range`);
        else if (q.choices[q.answer].trap) errs.push(`${w}: the correct choice carries a trap`);
      } else {
        errs.push(...richErrors(q.instruction, `${w}.instruction`));
        if (q.choices.length < 3 || q.choices.length > 10) errs.push(`${w}: select-all questions need 3 to 10 choices`);
        if (!q.answer.length) errs.push(`${w}: no correct choice`);
        const sorted = [...q.answer].sort((a, b) => a - b);
        if (JSON.stringify(sorted) !== JSON.stringify(q.answer) || new Set(q.answer).size !== q.answer.length)
          errs.push(`${w}: answer indices must be ascending and unique`);
        if (q.answer.some((i) => i < 0 || i >= q.choices.length)) errs.push(`${w}: answer index out of range`);
        if (q.answer.some((i) => q.choices[i]?.trap)) errs.push(`${w}: a correct choice carries a trap`);
      }
      break;
    }
    case 'ne':
      errs.push(...richErrors(q.stem, `${w}.stem`), ...richErrors(q.prefix, `${w}.prefix`), ...richErrors(q.suffix, `${w}.suffix`));
      if (!(q.answer instanceof Frac)) errs.push(`${w}: NE answer must be a Frac`);
      else {
        if (!q.fractionBoxes && !q.answer.isTerminating())
          errs.push(`${w}: answer ${q.answer} has no exact decimal; use fractionBoxes or ask to round`);
        if (Math.abs(q.answer.toNumber()) > 1e9) errs.push(`${w}: answer too large`);
      }
      for (const t2 of q.traps ?? []) {
        if (t2.value.eq(q.answer)) errs.push(`${w}: NE trap equals the answer`);
        trapKnown(t2.trap, 'ne trap');
      }
      break;
  }
  return errs;
}

/** JSON key of a question for variety / determinism checks. */
export const qKey = (q: QuestionBody) => JSON.stringify(q);
