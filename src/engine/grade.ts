import { Frac, parseDecimal, parseIntBox } from './frac';
import type { QCChoice, QuestionBody } from './types';

export type Response =
  | { format: 'qc'; choice: QCChoice }
  | { format: 'mcs'; choice: number }
  | { format: 'mcm'; choices: number[] }
  | { format: 'ne'; value: string }
  | { format: 'ne'; num: string; den: string };

export interface GradeResult {
  correct: boolean;
  /** The response could not be read (empty or malformed numeric entry). Counts as wrong. */
  invalid?: boolean;
  /** Trap ids hit by the response. */
  traps: string[];
}

export function parseNumericResponse(r: Response): Frac | null {
  if (r.format !== 'ne') return null;
  try {
    if ('value' in r) return parseDecimal(r.value);
    const n = parseIntBox(r.num);
    const d = parseIntBox(r.den);
    if (n === null || d === null || d === 0) return null;
    return new Frac(n, d);
  } catch {
    return null; // user input must never crash a render
  }
}

export function isAnswered(r: Response | undefined): boolean {
  if (!r) return false;
  switch (r.format) {
    case 'qc':
      return true;
    case 'mcs':
      return r.choice >= 0;
    case 'mcm':
      return r.choices.length > 0;
    case 'ne':
      return 'value' in r ? r.value.trim() !== '' : r.num.trim() !== '' || r.den.trim() !== '';
  }
}

export function grade(q: QuestionBody, r: Response | undefined): GradeResult {
  if (!r || r.format !== q.format) return { correct: false, invalid: true, traps: [] };
  switch (q.format) {
    case 'qc': {
      const choice = (r as { choice: QCChoice }).choice;
      const trap = q.traps?.[choice];
      return { correct: choice === q.answer, traps: choice !== q.answer && trap ? [trap] : [] };
    }
    case 'mcs': {
      const choice = (r as { choice: number }).choice;
      const trap = q.choices[choice]?.trap;
      return { correct: choice === q.answer, traps: choice !== q.answer && trap ? [trap] : [] };
    }
    case 'mcm': {
      const picked = [...new Set((r as { choices: number[] }).choices)].sort((a, b) => a - b);
      const correct = picked.length === q.answer.length && picked.every((x, i) => x === q.answer[i]);
      const traps = picked.filter((i) => !q.answer.includes(i)).flatMap((i) => (q.choices[i]?.trap ? [q.choices[i].trap!] : []));
      return { correct, traps };
    }
    case 'ne': {
      const v = parseNumericResponse(r);
      if (!v) return { correct: false, invalid: true, traps: [] };
      const correct = v.eq(q.answer);
      const traps = correct ? [] : (q.traps ?? []).filter((t) => t.value.eq(v)).map((t) => t.trap);
      return { correct, traps };
    }
  }
}

/** Human-readable correct answer, used in review screens. */
export function answerText(q: QuestionBody): string {
  switch (q.format) {
    case 'qc':
      return q.answer;
    case 'mcs':
      return String.fromCharCode(65 + q.answer);
    case 'mcm':
      return q.answer.map((i) => String.fromCharCode(65 + i)).join(', ');
    case 'ne':
      return q.answer.isTerminating() && !q.fractionBoxes ? q.answer.toDecimalString() : q.answer.toString();
  }
}
