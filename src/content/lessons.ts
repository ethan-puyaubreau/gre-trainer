import type { Rich } from '../engine/types';
import { algebraLessons } from './algebra/lessons';
import { arithmeticLessons } from './arithmetic/lessons';
import { dataLessons } from './data/lessons';
import { geometryLessons } from './geometry/lessons';

/** A short lesson shown before the first question of a skill. */
export interface Lesson {
  /** Key idea in one or two sentences (Rich text, KaTeX allowed). */
  idea: Rich;
  /** "If you see ..., think ...": how to recognize this kind of problem. */
  recognize: Rich;
  /** One worked example: problem, numbered steps each with its "because", answer. */
  example: { problem: Rich; steps: Rich[]; answer: Rich };
  /** 2-3 trap ids from the skill's trap catalog (TRAPS). */
  traps: string[];
}

/** Lessons keyed by skill id. */
export const LESSONS: Record<string, Lesson> = { ...arithmeticLessons, ...algebraLessons, ...geometryLessons, ...dataLessons };

/** Whether a skill's lesson comes before its next question: lessons on (undefined = on), the skill untouched (level 0) and its lesson not yet shown. */
export function lessonDue(skillId: string, o: { enabled?: boolean; level: number; seen?: string[] }): boolean {
  return o.enabled !== false && skillId in LESSONS && o.level === 0 && !(o.seen ?? []).includes(skillId);
}
