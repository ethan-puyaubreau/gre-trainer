// Khan-Academy-style mastery per skill.
//
// Levels: Not started -> Attempted -> Familiar -> Proficient -> Mastered.
// - A credit is a correct answer at difficulty 2 or 3 without the full strategy card. It records the
//   style (template) with the highest difficulty answered and its format. Pace does not matter for it.
// - Familiar on the first correct answer, Proficient at 2 credited styles.
// - Mastered on an on-pace credit once the skill has enough distinct styles (stylesForMastered),
//   2 formats including numeric entry or select-all when the skill has one, a credit at difficulty 3,
//   and 18 h since the first credit. It stays "to confirm" until the first successful review.
// - A miss removes the credit of the missed style, lowers the difficulty and brings the skill back;
//   two misses within the last 6 answers wipe every credit, drop one level and start a new window.
// - Mastered skills come back for spaced review; a miss on review drops them to Proficient.

import type { Difficulty, Format, Template } from '../engine/types';

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_NAMES = ['Not started', 'Attempted', 'Familiar', 'Proficient', 'Mastered'] as const;

const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
/** Days until the next review after reaching Mastered, then after each successful review. */
export const REVIEW_DAYS = [3, 7, 21, 60];
export const STYLES_FOR_PROFICIENT = 2;
/** Time between the first credit and the answer that masters the skill. */
export const RETENTION_MS = 18 * HOUR;
/** Reaching Proficient brings the skill back the next day, for the retention check. */
const PROFICIENT_COMEBACK_MS = 20 * HOUR;
/** Results kept in `recent`: two misses among them wipe the credits. */
const RECENT = 6;
/** Default GRE pace: 21 min / 12 questions and 26 min / 15 questions are both ~1:45 per question. */
export const DEFAULT_PACE_SEC = 105;
/** Formats where the answer is produced, not picked. */
const PRODUCTION: Format[] = ['ne', 'mcm'];

export interface SkillRequirements {
  /** Number of styles (templates) of the skill. */
  styles: number;
  /** Formats the skill has at least one template in. */
  formats: Format[];
}

export function requirementsFor(templates: Template<any>[]): SkillRequirements {
  return { styles: templates.length, formats: [...new Set(templates.map((t) => t.format))] };
}

/** Distinct credited styles needed for Mastered: min(6, max(3, ceil(2S/3))). */
export function stylesForMastered(S: number): number {
  return Math.min(6, Math.max(3, Math.ceil((2 * S) / 3)));
}

export interface SkillState {
  level: Level;
  attempts: number;
  correct: number;
  /** Credited styles: templateId -> highest difficulty answered cleanly (difficulty 1 never credits). */
  styles: Record<string, Difficulty>;
  /** Format of each credited style, so a miss can recompute `formats`. */
  styleFormats: Record<string, Format>;
  /** Formats with at least one credited style. */
  formats: Format[];
  /** First credit since the last reset (retention clock). */
  firstCreditAt?: number;
  /** Last 6 results, oldest first (true = correct). */
  recent: boolean[];
  /** Mastered but not yet confirmed by a successful review. */
  provisional?: boolean;
  /** Difficulty of the next question for this skill. */
  difficulty: Difficulty;
  /** Consecutive correct answers without the full strategy card (drives the difficulty up). */
  streak: number;
  lastAt: number;
  /** When the skill should come back (after a miss, for retention, or for spaced review once mastered). */
  dueAt?: number;
  reviewStage: number;
  /** Total time spent, for average pace. */
  timeMs: number;
}

export interface AttemptInput {
  templateId: string;
  format: Format;
  difficulty: Difficulty;
  correct: boolean;
  timeMs: number;
  at: number;
  /** 0 none, 1 first line, 2 bullets, 3 full strategy card (only 3 cancels the credit). */
  hintLevel: 0 | 1 | 2 | 3;
  /** In a timed section the section clock enforces the pace, so every answer is on pace. */
  timedSection?: boolean;
}

export function newSkillState(): SkillState {
  return {
    level: 0,
    attempts: 0,
    correct: 0,
    styles: {},
    styleFormats: {},
    formats: [],
    recent: [],
    difficulty: 2,
    streak: 0,
    lastAt: 0,
    reviewStage: 0,
    timeMs: 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const clockTime = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const clampDiff = (d: number): Difficulty => Math.max(1, Math.min(3, d)) as Difficulty;

/** GRE pace, with 1.5x the time at difficulty 3; the section clock already enforces it in a timed section. */
export function isOnPace(timeMs: number, difficulty: Difficulty, paceSec: number, timedSection = false): boolean {
  return timedSection || timeMs <= paceSec * 1000 * (difficulty === 3 ? 1.5 : 1);
}

export interface AttemptOutcome {
  state: SkillState;
  /** True if this answer was clean (correct, on pace, without the full strategy card). */
  clean: boolean;
  /** Level before and after, for "level up" feedback. */
  from: Level;
  to: Level;
}

const formatsOf = (styleFormats: Record<string, Format>): Format[] => [...new Set(Object.values(styleFormats))];

export function applyAttempt(prev: SkillState, a: AttemptInput, req: SkillRequirements, paceSec = DEFAULT_PACE_SEC): AttemptOutcome {
  const s: SkillState = {
    ...prev,
    styles: { ...prev.styles },
    styleFormats: { ...prev.styleFormats },
    recent: [...prev.recent, a.correct].slice(-RECENT),
  };
  s.attempts += 1;
  s.lastAt = a.at;
  s.timeMs += a.timeMs;
  const onPace = isOnPace(a.timeMs, a.difficulty, paceSec, a.timedSection);
  const unaided = a.hintLevel < 3;
  const clean = a.correct && onPace && unaided;

  if (!a.correct) {
    const wipe = s.recent.filter((r) => !r).length >= 2;
    if (wipe) {
      s.styles = {};
      s.styleFormats = {};
      // The window starts over, so the same two misses cannot wipe the credits again on the next miss.
      s.recent = [];
    } else {
      delete s.styles[a.templateId];
      delete s.styleFormats[a.templateId];
    }
    s.formats = formatsOf(s.styleFormats);
    const credits = Object.keys(s.styles).length;
    if (wipe) s.level = Math.max(1, prev.level - 1) as Level;
    else if (prev.level === 4) s.level = 3;
    else if (prev.level === 3 && credits < STYLES_FOR_PROFICIENT) s.level = 2;
    else s.level = Math.max(1, prev.level) as Level;
    s.provisional = undefined;
    s.firstCreditAt = undefined;
    s.streak = 0;
    s.difficulty = clampDiff(prev.difficulty - 1);
    s.reviewStage = 0;
    s.dueAt = a.at + DAY;
    return { state: s, clean, from: prev.level, to: s.level };
  }

  s.correct += 1;
  const credited = unaided && a.difficulty >= 2;
  if (credited) {
    s.styles[a.templateId] = Math.max(s.styles[a.templateId] ?? 0, a.difficulty) as Difficulty;
    s.styleFormats[a.templateId] = a.format;
    s.formats = formatsOf(s.styleFormats);
    s.firstCreditAt ??= a.at;
  }
  if (unaided) {
    s.streak += 1;
    if (s.streak % 2 === 0) s.difficulty = clampDiff(s.difficulty + 1);
  } else s.streak = 0;

  // A correct answer after the "come back" date clears it for skills still in progress.
  if (prev.level < 4 && unaided && prev.dueAt !== undefined && a.at >= prev.dueAt) s.dueAt = undefined;

  // One level per answer.
  if (s.level < 2) s.level = 2;
  else if (s.level === 2 && Object.keys(s.styles).length >= STYLES_FOR_PROFICIENT) {
    s.level = 3;
    s.dueAt = a.at + PROFICIENT_COMEBACK_MS;
  } else if (s.level === 3 && credited && onPace && nextCriteria(s, req, a.at).every((c) => c.done)) {
    s.level = 4;
    s.provisional = true;
    s.reviewStage = 0;
    s.dueAt = a.at + REVIEW_DAYS[0] * DAY;
  } else if (s.level === 4 && clean && prev.dueAt !== undefined && a.at >= prev.dueAt) {
    s.provisional = undefined;
    s.reviewStage = Math.min(prev.reviewStage + 1, REVIEW_DAYS.length - 1);
    s.dueAt = a.at + REVIEW_DAYS[s.reviewStage] * DAY;
  }
  return { state: s, clean, from: prev.level, to: s.level };
}

export function isDue(s: SkillState, now: number): boolean {
  return s.dueAt !== undefined && now >= s.dueAt;
}

export interface Criterion {
  key: 'styles' | 'formats' | 'production' | 'hard' | 'retention';
  label: string;
  done: boolean;
  detail?: string;
}

/** The single next step below Proficient, in words. */
function stepText(s: SkillState): string {
  if (s.level === 0) return 'Answer one question to start.';
  if (s.level === 1) return 'Answer one question correctly.';
  const need = STYLES_FOR_PROFICIENT - Object.keys(s.styles).length;
  return need > 0
    ? `Answer ${need} more style${need > 1 ? 's' : ''} correctly at medium or hard difficulty, without the full strategy card.`
    : 'One more correct answer.';
}

/** Criteria for the next level (only the Mastered step has several). */
export function nextCriteria(s: SkillState, req: SkillRequirements, now: number): Criterion[] {
  const credits = Object.keys(s.styles).length;
  if (s.level === 4) return [];
  if (s.level < 3) return [{ key: 'styles', label: stepText(s), done: s.level === 2 && credits >= STYLES_FOR_PROFICIENT }];
  const need = stylesForMastered(req.styles);
  const needFormats = Math.min(2, req.formats.length);
  const production = PRODUCTION.filter((f) => req.formats.includes(f));
  const back = s.firstCreditAt === undefined ? undefined : s.firstCreditAt + RETENTION_MS;
  const out: Criterion[] = [
    { key: 'styles', label: `Styles ${credits}/${need}`, done: credits >= need, detail: 'correct, medium or hard, without the full strategy card' },
    { key: 'formats', label: `${needFormats} format${needFormats === 1 ? '' : 's'}`, done: s.formats.length >= needFormats },
  ];
  if (production.length) {
    const label = production.length > 1 ? 'Numeric entry or select-all' : production[0] === 'ne' ? 'Numeric entry' : 'Select-all';
    out.push({ key: 'production', label, done: s.formats.some((f) => production.includes(f)) });
  }
  out.push({ key: 'hard', label: 'One hard question', done: Object.values(s.styles).includes(3) });
  out.push({
    key: 'retention',
    label:
      back === undefined
        ? 'Back 18 h after the first credit'
        : now >= back
          ? 'Back after 18 h'
          : `Back ${dayKey(back) === dayKey(now) ? '' : 'tomorrow '}after ${clockTime(back)}`,
    done: back !== undefined && now >= back,
    // The label already says it while no time is known.
    detail: back === undefined ? undefined : '18 h after the first credit',
  });
  return out;
}

/**
 * Share of next-level criteria met, in [0, 1]. The style count counts pro rata so the ring moves with
 * each new style (below Proficient it is the only criterion).
 */
export function progressToNext(s: SkillState, req: SkillRequirements, now: number): number {
  if (s.level === 4) return 1;
  const criteria = nextCriteria(s, req, now);
  const share = Math.min(1, Object.keys(s.styles).length / (s.level === 3 ? stylesForMastered(req.styles) : STYLES_FOR_PROFICIENT));
  return criteria.reduce((sum, c) => sum + (c.done ? 1 : c.key === 'styles' ? share : 0), 0) / criteria.length;
}

/** What comes next, in words, for the feedback line (the skill panel shows the full checklist). */
export function nextStep(s: SkillState): string {
  if (s.level < 3) return stepText(s);
  if (s.level === 3) return 'The mastery checklist is in the skill panel on the dashboard.';
  const due = s.dueAt === undefined ? undefined : new Date(s.dueAt).toLocaleDateString();
  if (s.provisional) return `Mastered, to confirm at the ${due ? `review due ${due}` : 'next review'}.`;
  return due ? `Review due ${due}.` : 'Mastered.';
}
