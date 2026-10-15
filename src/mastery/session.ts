// Pure helpers for the practice page: what a session did, kept apart from React.

import { grade, type Response } from '../engine/grade';
import type { QuestionBody } from '../engine/types';
import type { AttemptInput, Level } from './model';

export type HintLevel = AttemptInput['hintLevel'];
/** The step that shows the whole strategy card and is the only one that cancels the mastery credit. */
export const FULL_CARD: HintLevel = 3;

const isBullets = (para: string) => para.split('\n').every((l) => /^\s*- /.test(l));

/**
 * What a hint step shows of a skill strategy (a first line, then bullets): step 1 the first line,
 * step 2 the bullets alone, step 3 the whole card. A card without bullets repeats its first line at step 2.
 */
export function hintText(strategy: string, level: HintLevel): string {
  if (level === 0) return '';
  if (level === FULL_CARD) return strategy;
  const paras = strategy
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bullets = paras.slice(1).filter(isBullets).join('\n\n');
  return level === 2 && bullets ? bullets : (paras[0] ?? '');
}

/**
 * Trap ids carried by the wrong choices the user did not pick. Only for a correct answer on a
 * choice question (qc / mcs / mcm); numeric entry has no visible wrong choices, so it returns [].
 */
export function dodgedTraps(q: QuestionBody, r: Response | undefined): string[] {
  if (q.format === 'ne' || !grade(q, r).correct) return [];
  // The answer is correct, so every wrong choice was left alone.
  const ids =
    q.format === 'qc'
      ? Object.entries(q.traps ?? {})
          .filter(([choice]) => choice !== q.answer)
          .map(([, id]) => id)
      : q.choices.filter((_, i) => (q.format === 'mcs' ? i !== q.answer : !q.answer.includes(i))).map((c) => c.trap);
  return [...new Set(ids.filter((id): id is string => !!id))];
}

/** One answered question, as the recap needs it. */
export interface SessionOutcome {
  skillId: string;
  from: Level;
  to: Level;
  correct: boolean;
  /** How many traps this answer dodged. */
  dodged: number;
}

/** Net level change of one skill over the session: first `from` to last `to`. */
export interface SkillMove {
  skillId: string;
  from: Level;
  to: Level;
}

export interface SessionSummary {
  answered: number;
  correct: number;
  /** Whole percent, 0 when nothing was answered. */
  accuracy: number;
  up: SkillMove[];
  down: SkillMove[];
  dodged: number;
}

export function summarize(outcomes: SessionOutcome[]): SessionSummary {
  const moves = new Map<string, SkillMove>();
  for (const o of outcomes) {
    const m = moves.get(o.skillId);
    if (m) m.to = o.to;
    else moves.set(o.skillId, { skillId: o.skillId, from: o.from, to: o.to });
  }
  const all = [...moves.values()];
  const correct = outcomes.filter((o) => o.correct).length;
  return {
    answered: outcomes.length,
    correct,
    accuracy: outcomes.length ? Math.round((100 * correct) / outcomes.length) : 0,
    up: all.filter((m) => m.to > m.from),
    down: all.filter((m) => m.to < m.from),
    dodged: outcomes.reduce((n, o) => n + o.dodged, 0),
  };
}
