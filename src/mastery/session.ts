// Pure helpers for the practice page: what a session did, kept apart from React.

import { grade, type Response } from '../engine/grade';
import type { QuestionBody } from '../engine/types';

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
