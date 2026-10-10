// Khan-Academy-style mastery per skill.
//
// Levels: Not started -> Attempted -> Familiar -> Proficient -> Mastered.
// - A clean answer (correct, on GRE pace, no hint) moves the skill up.
// - A correct but slow or hinted answer only counts up to Familiar.
// - A miss drops one level, resets the style/day credit, lowers the difficulty and schedules the
//   skill to come back (in a different style) a few questions later and again the next day.
// - Mastered needs clean answers on >= 3 different styles, on >= 2 different days, since the last miss.
// - Mastered skills come back for spaced review; a miss on review drops them to Proficient.

import type { Difficulty } from '../engine/types';

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_NAMES = ['Not started', 'Attempted', 'Familiar', 'Proficient', 'Mastered'] as const;

export const DAY = 24 * 60 * 60 * 1000;
/** Days until the next review after reaching Mastered, then after each successful review. */
export const REVIEW_DAYS = [3, 7, 21, 60];
export const STYLES_FOR_PROFICIENT = 2;
export const STYLES_FOR_MASTERED = 3;
export const DAYS_FOR_MASTERED = 2;
/** Default GRE pace: 21 min / 12 questions and 26 min / 15 questions are both ~1:45 per question. */
export const DEFAULT_PACE_SEC = 105;

export interface SkillState {
  level: Level;
  attempts: number;
  correct: number;
  /** Templates answered cleanly since the last miss. */
  styles: string[];
  /** Distinct local days (YYYY-MM-DD) with a clean answer since the last miss. */
  days: string[];
  /** Difficulty of the next question for this skill. */
  difficulty: Difficulty;
  /** Consecutive clean answers (drives the difficulty up). */
  streak: number;
  lastAt: number;
  /** When the skill should come back (after a miss, or for spaced review once mastered). */
  dueAt?: number;
  reviewStage: number;
  /** Total time spent and number of timed attempts, for average pace. */
  timeMs: number;
  /** Set for skills flagged as weak (e.g. from the Official Guide practice set). */
  flagged?: boolean;
}

export interface AttemptInput {
  templateId: string;
  correct: boolean;
  timeMs: number;
  hinted: boolean;
  at: number;
  /** In a timed section the section clock enforces the pace, so every correct answer is on pace. */
  timedSection?: boolean;
}

export function newSkillState(): SkillState {
  return {
    level: 0,
    attempts: 0,
    correct: 0,
    styles: [],
    days: [],
    difficulty: 2,
    streak: 0,
    lastAt: 0,
    reviewStage: 0,
    timeMs: 0,
  };
}

export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const clampDiff = (d: number): Difficulty => Math.max(1, Math.min(3, d)) as Difficulty;

export interface AttemptOutcome {
  state: SkillState;
  /** True if this answer was clean (correct, on pace, no hint). */
  clean: boolean;
  /** Level before and after, for "level up" feedback. */
  from: Level;
  to: Level;
}

export function applyAttempt(prev: SkillState, a: AttemptInput, paceSec = DEFAULT_PACE_SEC): AttemptOutcome {
  const s: SkillState = { ...prev, styles: [...prev.styles], days: [...prev.days] };
  s.attempts += 1;
  s.lastAt = a.at;
  s.timeMs += a.timeMs;
  const onPace = a.timedSection || a.timeMs <= paceSec * 1000;
  const clean = a.correct && onPace && !a.hinted;

  if (!a.correct) {
    s.level = (prev.level >= 2 ? prev.level - 1 : 1) as Level;
    s.styles = [];
    s.days = [];
    s.streak = 0;
    s.difficulty = clampDiff(prev.difficulty - 1);
    s.reviewStage = 0;
    s.dueAt = a.at + DAY;
    return { state: s, clean, from: prev.level, to: s.level };
  }

  s.correct += 1;
  if (!clean) {
    // Slow or hinted: counts as practice, not as proof of mastery.
    if (s.level < 2) s.level = 2;
    s.streak = 0;
    return { state: s, clean, from: prev.level, to: s.level };
  }

  if (!s.styles.includes(a.templateId)) s.styles.push(a.templateId);
  const day = dayKey(a.at);
  if (!s.days.includes(day)) s.days.push(day);
  s.streak += 1;
  if (s.streak % 2 === 0) s.difficulty = clampDiff(s.difficulty + 1);

  if (s.level < 2) s.level = 2;
  else if (s.level === 2 && s.styles.length >= STYLES_FOR_PROFICIENT) s.level = 3;
  else if (s.level === 3 && s.styles.length >= STYLES_FOR_MASTERED && s.days.length >= DAYS_FOR_MASTERED) {
    s.level = 4;
    s.reviewStage = 0;
    s.dueAt = a.at + REVIEW_DAYS[0] * DAY;
  } else if (s.level === 4 && prev.dueAt !== undefined && a.at >= prev.dueAt) {
    s.reviewStage = Math.min(prev.reviewStage + 1, REVIEW_DAYS.length - 1);
    s.dueAt = a.at + REVIEW_DAYS[s.reviewStage] * DAY;
  }
  // A clean answer after the "come back tomorrow" date clears it for skills still in progress.
  if (s.level < 4 && prev.dueAt !== undefined && a.at >= prev.dueAt) s.dueAt = undefined;
  if (s.level >= 3) s.flagged = false;
  return { state: s, clean, from: prev.level, to: s.level };
}

export function isDue(s: SkillState, now: number): boolean {
  return s.dueAt !== undefined && now >= s.dueAt;
}

/** What is still missing before the next level, in words. */
export function nextStep(s: SkillState): string {
  switch (s.level) {
    case 0:
      return 'Answer one question to start.';
    case 1:
      return 'Answer one question correctly.';
    case 2: {
      const need = STYLES_FOR_PROFICIENT - s.styles.length;
      return need > 0 ? `Answer ${need} more style${need > 1 ? 's' : ''} correctly, on pace and without hints.` : 'One more clean answer.';
    }
    case 3: {
      const needStyles = Math.max(0, STYLES_FOR_MASTERED - s.styles.length);
      const needDays = Math.max(0, DAYS_FOR_MASTERED - s.days.length);
      const parts: string[] = [];
      if (needStyles) parts.push(`${needStyles} more style${needStyles > 1 ? 's' : ''}`);
      if (needDays) parts.push(`a clean answer on ${needDays} more day${needDays > 1 ? 's' : ''}`);
      return parts.length ? `Needs ${parts.join(' and ')}.` : 'One more clean answer.';
    }
    case 4:
      return s.dueAt ? `Review due ${new Date(s.dueAt).toLocaleDateString()}.` : 'Mastered.';
  }
}
