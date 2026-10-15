import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Response } from '../engine/grade';
import { createRng, randomSeed } from '../engine/rng';
import type { Difficulty, Question } from '../engine/types';
import { templatesBySkill } from '../content';
import { applyAttempt, DEFAULT_PACE_SEC, newSkillState, requirementsFor, type AttemptInput, type AttemptOutcome, type SkillState } from '../mastery/model';
import { scheduleRepair, type Remediation } from '../mastery/scheduler';
import { dropWeakFlags, migrateProgress, migrateStyleCredits } from './migrate';

export type Mode = 'practice' | 'section';

export interface AttemptRecord {
  qid: string;
  skillId: string;
  templateId: string;
  correct: boolean;
  timeMs: number;
  at: number;
  mode: Mode;
  traps: string[];
  hinted: boolean;
  response?: Response;
}

export interface SectionPart {
  questions: number;
  correct: number;
  limitSec: number;
  usedSec: number;
  difficulty: Difficulty;
  qids: string[];
  results: boolean[];
}

export interface SectionRecord {
  at: number;
  parts: SectionPart[];
}

export interface Settings {
  paceSec: number;
  /** Show the running clock (the real GRE lets you hide it). */
  showTimer: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Animations: follow the system's reduced-motion preference, or force them on or off. */
  motion?: 'system' | 'on' | 'off';
  /** When the user last downloaded an export (drives the backup reminder). */
  lastExportAt?: number;
  /** Show a skill's lesson before its first question (undefined = on). */
  lessons?: boolean;
}

export interface ProgressData {
  version: 1;
  createdAt: number;
  skills: Record<string, SkillState>;
  remediation: Remediation[];
  history: AttemptRecord[];
  sections: SectionRecord[];
  /** Global attempt counter, used to space the repair queue. */
  seq: number;
  settings: Settings;
  /** Skill ids whose lesson was shown before the first question (absent = none). */
  lessonsSeen?: string[];
}

interface Actions {
  recordAttempt(input: {
    question: Question;
    correct: boolean;
    timeMs: number;
    hintLevel: AttemptInput['hintLevel'];
    traps: string[];
    mode: Mode;
    response?: Response;
    /** The repair entry the pick of this question carried: only that one is served by this attempt. */
    repair?: Remediation;
  }): AttemptOutcome;
  recordSection(rec: SectionRecord): void;
  markLessonSeen(skillId: string): void;
  updateSettings(patch: Partial<Settings>): void;
  importData(data: unknown): void;
  reset(): void;
}

const MAX_HISTORY = 4000;
/** ponytail: one flat 10 min cap on a recorded answer time (a tab left open overnight); make it per-skill if long untimed sessions matter. */
export const MAX_ATTEMPT_MS = 10 * 60 * 1000;
export const PROGRESS_KEY = 'gre-trainer-progress';

export function initialData(now = Date.now()): ProgressData {
  return {
    version: 1,
    createdAt: now,
    skills: {},
    remediation: [],
    history: [],
    sections: [],
    seq: 0,
    settings: { paceSec: DEFAULT_PACE_SEC, showTimer: true, theme: 'system' },
    lessonsSeen: [],
  };
}

/** The queue without the first entry equal to `served` (an entry saved before stages existed counts as stage 1). */
function withoutOne(queue: Remediation[], served: Remediation): Remediation[] {
  const same = (r: Remediation) =>
    r.skillId === served.skillId && r.missedTemplate === served.missedTemplate && r.dueSeq === served.dueSeq && (r.stage ?? 1) === (served.stage ?? 1);
  const i = queue.findIndex(same);
  return i < 0 ? queue : queue.filter((_, j) => j !== i);
}

export const NOT_AN_EXPORT = 'This file is not a GRE Trainer progress export.';

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);

/** Shape check for an imported file: every field the pages read without a guard must be there. */
export function isProgressData(x: unknown): x is ProgressData {
  if (!isObj(x) || x.version !== 1) return false;
  if (!isObj(x.skills) || !Object.values(x.skills).every(isObj)) return false;
  if (!Array.isArray(x.remediation) || (x.sections !== undefined && !Array.isArray(x.sections))) return false;
  if (x.settings !== undefined && !isObj(x.settings)) return false;
  if (x.seq !== undefined && !isNum(x.seq)) return false;
  if (x.lessonsSeen !== undefined && !(Array.isArray(x.lessonsSeen) && x.lessonsSeen.every((id) => typeof id === 'string'))) return false;
  return (
    Array.isArray(x.history) &&
    x.history.every(
      (h) =>
        isObj(h) &&
        typeof h.qid === 'string' &&
        typeof h.skillId === 'string' &&
        typeof h.templateId === 'string' &&
        typeof h.correct === 'boolean' &&
        isNum(h.timeMs) &&
        isNum(h.at) &&
        Array.isArray(h.traps),
    )
  );
}

export const useProgress = create<ProgressData & Actions>()(
  persist(
    (set, get) => ({
      ...initialData(),

      recordAttempt({ question, correct, timeMs: rawMs, hintLevel, traps, mode, response, repair }) {
        const timeMs = Math.min(rawMs, MAX_ATTEMPT_MS);
        const s = get();
        const prev = s.skills[question.skillId] ?? newSkillState();
        const at = Date.now();
        const outcome = applyAttempt(
          prev,
          {
            templateId: question.templateId,
            format: question.format,
            difficulty: question.difficulty,
            correct,
            timeMs,
            at,
            hintLevel,
            timedSection: mode === 'section',
          },
          requirementsFor(templatesBySkill.get(question.skillId) ?? []),
          s.settings.paceSec,
        );
        const seq = s.seq + 1;
        // The repair this question came from is done (any other entry of the skill stays queued). A miss replaces the skill's
        // queue with a fresh first comeback. A first comeback answered right leaves the next-day comeback in another style,
        // but only if this attempt really removed the entry (a stale pick or a second tab must not add a duplicate) and the
        // skill still has a come-back date (a stage 2 entry is served only when the skill is due, so it would be stranded).
        let remediation = s.remediation;
        let served: Remediation | undefined;
        if (repair) {
          remediation = withoutOne(s.remediation, repair);
          if (remediation.length < s.remediation.length) served = repair;
        }
        if (!correct) {
          remediation = [...remediation.filter((r) => r.skillId !== question.skillId), scheduleRepair(createRng(randomSeed()), question.skillId, question.templateId, seq)];
        } else if (served && (served.stage ?? 1) === 1 && outcome.state.dueAt !== undefined) {
          remediation = [...remediation, scheduleRepair(createRng(randomSeed()), question.skillId, served.missedTemplate, seq, 2)];
        }
        const record: AttemptRecord = {
          qid: question.id,
          skillId: question.skillId,
          templateId: question.templateId,
          correct,
          timeMs,
          at,
          mode,
          traps,
          hinted: hintLevel > 0,
          response,
        };
        set({
          skills: { ...s.skills, [question.skillId]: outcome.state },
          remediation,
          seq,
          history: [...s.history, record].slice(-MAX_HISTORY),
        });
        return outcome;
      },

      recordSection(rec) {
        set({ sections: [...get().sections, rec].slice(-200) });
      },

      markLessonSeen(skillId) {
        const seen = get().lessonsSeen ?? [];
        if (!seen.includes(skillId)) set({ lessonsSeen: [...seen, skillId] });
      },

      updateSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
      },

      importData(data) {
        if (!isProgressData(data)) throw new Error(NOT_AN_EXPORT);
        // Both migrations leave data already in the current shape untouched.
        set({ ...initialData(), ...migrateStyleCredits(dropWeakFlags(data)), settings: { ...initialData().settings, ...data.settings } });
      },

      reset() {
        set(initialData());
      },
    }),
    {
      name: PROGRESS_KEY,
      version: 3,
      migrate: (persisted, version) => migrateProgress(persisted, version) as ProgressData & Actions,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version,
        createdAt: s.createdAt,
        skills: s.skills,
        remediation: s.remediation,
        history: s.history,
        sections: s.sections,
        seq: s.seq,
        settings: s.settings,
        lessonsSeen: s.lessonsSeen,
      }),
    },
  ),
);

// Another tab wrote its progress: take it, or our next write would overwrite it with this tab's stale copy.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PROGRESS_KEY) void useProgress.persist.rehydrate();
  });
}

export function exportProgress(): string {
  const s = useProgress.getState();
  const data: ProgressData = {
    version: s.version,
    createdAt: s.createdAt,
    skills: s.skills,
    remediation: s.remediation,
    history: s.history,
    sections: s.sections,
    seq: s.seq,
    settings: s.settings,
    lessonsSeen: s.lessonsSeen,
  };
  return JSON.stringify(data);
}
