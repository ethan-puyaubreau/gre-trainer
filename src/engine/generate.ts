import { createRng } from './rng';
import type { Difficulty, Question, QuestionBody, Template } from './types';

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The app only serves seeds 1..SEED_POOL, and the test suite verifies the answer key of every one of
 * them (for every template and difficulty), so no unverified question can reach a student.
 */
export const SEED_POOL = 500;

export function poolSeed(): number {
  return 1 + Math.floor(Math.random() * SEED_POOL);
}

/** Same (template, seed, difficulty) always gives the same question. */
export function rngFor(templateId: string, seed: number, difficulty: Difficulty) {
  return createRng((hashString(templateId) ^ Math.imul(seed, 2654435761) ^ (difficulty * 97)) >>> 0);
}

/** Templates of a data interpretation family share one random stream, hence one dataset per seed. */
export const streamId = (t: Template<any>) => (t.set ? `set:${t.set}` : t.id);

export function generateBody<P>(t: Template<P>, seed: number, difficulty: Difficulty): { q: QuestionBody; params: P } {
  return t.generate(rngFor(streamId(t), seed, difficulty), difficulty);
}

export function generateQuestion(t: Template<any>, seed: number, difficulty: Difficulty): Question {
  const { q } = generateBody(t, seed, difficulty);
  return { ...q, id: `${t.id}#${seed}#${difficulty}`, templateId: t.id, skillId: t.skill, seed, difficulty };
}

/** Parse a question id back into its parts. */
export function parseQuestionId(id: string): { templateId: string; seed: number; difficulty: Difficulty } | null {
  const m = /^(.+)#(\d+)#([123])$/.exec(id);
  if (!m) return null;
  return { templateId: m[1], seed: Number(m[2]), difficulty: Number(m[3]) as Difficulty };
}
