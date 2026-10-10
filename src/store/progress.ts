import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Response } from '../engine/grade';
import { createRng, randomSeed } from '../engine/rng';
import type { Difficulty, Question } from '../engine/types';
import { applyAttempt, DEFAULT_PACE_SEC, newSkillState, type AttemptOutcome, type SkillState } from '../mastery/model';
import { scheduleRepair, type Remediation } from '../mastery/scheduler';
import { dropWeakFlags } from './migrate';

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
}

interface Actions {
  recordAttempt(input: {
    question: Question;
    correct: boolean;
    timeMs: number;
    hinted: boolean;
    traps: string[];
    mode: Mode;
    response?: Response;
  }): AttemptOutcome;
  recordSection(rec: SectionRecord): void;
  updateSettings(patch: Partial<Settings>): void;
  importData(data: unknown): void;
  reset(): void;
}

const MAX_HISTORY = 4000;

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
  };
}

function isProgressData(x: unknown): x is ProgressData {
  if (!x || typeof x !== 'object') return false;
  const d = x as Partial<ProgressData>;
  return d.version === 1 && typeof d.skills === 'object' && Array.isArray(d.history) && Array.isArray(d.remediation);
}

export const useProgress = create<ProgressData & Actions>()(
  persist(
    (set, get) => ({
      ...initialData(),

      recordAttempt({ question, correct, timeMs, hinted, traps, mode, response }) {
        const s = get();
        const prev = s.skills[question.skillId] ?? newSkillState();
        const at = Date.now();
        const outcome = applyAttempt(
          prev,
          { templateId: question.templateId, correct, timeMs, hinted, at, timedSection: mode === 'section' },
          s.settings.paceSec,
        );
        const seq = s.seq + 1;
        // Served repairs for this skill are done; a new miss schedules a fresh one.
        let remediation = s.remediation.filter((r) => !(r.skillId === question.skillId && r.dueSeq <= seq));
        if (!correct) {
          remediation = remediation.filter((r) => r.skillId !== question.skillId);
          remediation.push(scheduleRepair(createRng(randomSeed()), question.skillId, question.templateId, seq));
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
          hinted,
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

      updateSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
      },

      importData(data) {
        if (!isProgressData(data)) throw new Error('This file is not a GRE Trainer progress export.');
        set({ ...initialData(), ...dropWeakFlags(data), settings: { ...initialData().settings, ...data.settings } });
      },

      reset() {
        set(initialData());
      },
    }),
    {
      name: 'gre-trainer-progress',
      version: 2,
      migrate: (persisted, version) => (version < 2 ? dropWeakFlags(persisted as ProgressData) : persisted) as ProgressData & Actions,
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
      }),
    },
  ),
);

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
  };
  return JSON.stringify(data);
}
