// Pure helpers for the practice page: what a session did, kept apart from React.

import { parseQuestionId, SEED_POOL, poolSeed } from '../engine/generate';
import { grade, type Response } from '../engine/grade';
import { parseInline } from '../engine/rich';
import type { Difficulty, QuestionBody } from '../engine/types';
import type { Lesson } from '../content/lessons';
import { isOnPace, type AttemptInput, type Level } from './model';

/** Speed is judged from Proficient on; below that only accuracy counts and the pace bar stays neutral. */
export function paceJudged(level: Level): boolean {
  return level >= 3;
}

export type HintLevel = AttemptInput['hintLevel'];

/** The last step (worked example and full card): the only one that cancels the mastery credit. */
export const FULL_CARD: HintLevel = 3;

const isBullets = (para: string) => para.split('\n').every((l) => /^\s*- /.test(l));

/** A lesson's worked example as Rich text: problem, steps as bullets, answer. */
function workedExample(e: Lesson['example']): string {
  return ['**Worked example**', e.problem, e.steps.map((st) => `- ${st}`).join('\n'), `**Answer:** ${e.answer}`].join('\n\n');
}

/**
 * What a hint step shows of a skill strategy (a first line, then bullets): step 1 the first line,
 * step 2 the bullets alone, step 3 the skill's worked example followed by the whole card (the card alone
 * when there is no example). A card without bullets repeats its first line at step 2.
 */
export function hintText(strategy: string, level: HintLevel, example?: Lesson['example']): string {
  if (level === 0) return '';
  if (level === FULL_CARD) return example ? `${workedExample(example)}\n\n**Strategy card**\n\n${strategy}` : strategy;
  const paras = strategy
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bullets = paras.slice(1).filter(isBullets).join('\n\n');
  return level === 2 && bullets ? bullets : (paras[0] ?? '');
}

export interface RewardInput {
  correct: boolean;
  hintLevel: HintLevel;
  difficulty: Difficulty;
  timeMs: number;
  paceSec: number;
  /** The skill's level before this answer: it decides whether speed is judged. */
  level: Level;
}

/**
 * Whether an answer earns the session rewards (trap dodged, streak): correct, with at most the first-line
 * hint, on pace where speed is judged (from Proficient on), and hard enough to credit a style. Difficulty 1
 * credits nothing in the model, so it earns nothing here either.
 */
export function earnsReward(a: RewardInput): boolean {
  return a.correct && a.hintLevel <= 1 && a.difficulty >= 2 && (!paceJudged(a.level) || isOnPace(a.timeMs, a.difficulty, a.paceSec));
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
  /** The question answered: the recap regenerates it from this id. */
  questionId: string;
  response: Response;
  /** Ids of the traps the response hit (wrong answers only). */
  traps: string[];
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
  /** The questions answered wrong, in order. */
  missed: SessionOutcome[];
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
    missed: outcomes.filter((o) => !o.correct),
  };
}

/** The start of a question as Rich text, cut between words (or before a formula) once it passes `max` characters. */
export function stemPreview(q: QuestionBody, max = 90): string {
  const src = (q.format === 'qc' ? [q.info, `A: ${q.quantityA}`, `B: ${q.quantityB}`] : [q.stem]).filter(Boolean).join(' ');
  const esc = (t: string) => t.replace(/\$/g, '\\$');
  let out = '';
  let len = 0;
  for (const seg of parseInline(src)) {
    const text = seg.type === 'text' ? seg.value.replace(/\s+/g, ' ') : seg.value;
    const room = max - len;
    if (text.length > room) {
      if (seg.type === 'text') {
        let cut = text.slice(0, room);
        if (/\S/.test(text[room])) cut = cut.replace(/\S*$/, ''); // no half word
        cut = cut.trimEnd();
        if (cut) out += seg.bold ? `**${esc(cut)}**` : esc(cut);
      }
      return `${out.trimEnd()}…`;
    }
    out += seg.type !== 'text' ? `$${text}$` : seg.bold ? `**${esc(text)}**` : esc(text);
    len += text.length;
  }
  return out.trim();
}

/** What "Replay my traps" serves: the first missed question of each template (its id carries template and difficulty), in order. */
export function replayIds(missed: SessionOutcome[]): string[] {
  const seen = new Set<string>();
  return missed.flatMap((m) => {
    const p = parseQuestionId(m.questionId);
    if (!p || seen.has(p.templateId)) return [];
    seen.add(p.templateId);
    return [m.questionId];
  });
}

/** What the next question is, given the replay queue (null: no replay is running). */
export type ReplayStep = { kind: 'scheduler' } | { kind: 'end' } | { kind: 'serve'; id: string; rest: string[] };

/** One step: no replay hands over to the scheduler, a queue served in full is over, otherwise its head is served. */
export function replayStep(queue: string[] | null): ReplayStep {
  if (!queue) return { kind: 'scheduler' };
  if (queue.length === 0) return { kind: 'end' };
  return { kind: 'serve', id: queue[0], rest: queue.slice(1) };
}

/** "Keep practicing" after End session: a replay with questions left resumes, one already served in full is dropped. */
export function resumeReplay(queue: string[] | null): string[] | null {
  return queue?.length ? queue : null;
}

/** A seed for the replayed question: new numbers, never the missed question again. `draw` is injectable for tests. */
export function replaySeed(missedSeed: number, draw: () => number = poolSeed): number {
  const seed = draw();
  return seed === missedSeed ? (seed % SEED_POOL) + 1 : seed;
}
