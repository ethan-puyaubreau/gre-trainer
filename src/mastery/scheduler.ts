// Picks the next question: repair queue first (a missed skill coming back in a different style),
// then spaced reviews, skills in progress and new skills, interleaved.

import type { Rng } from '../engine/rng';
import type { Area, Difficulty, Skill, Template } from '../engine/types';
import { isDue, newSkillState, type SkillState } from './model';

export interface Remediation {
  skillId: string;
  /** Template that was missed: the comeback uses a different one. */
  missedTemplate: string;
  /** Serve once the global attempt counter reaches this value. */
  dueSeq: number;
}

export type PracticeScope =
  | { kind: 'smart'; areas?: Area[] }
  | { kind: 'skill'; skillId: string }
  | { kind: 'unit'; area: Area; unit: string }
  | { kind: 'review' };

export interface SchedulerInput {
  skills: Skill[];
  templatesBySkill: Map<string, Template<any>[]>;
  states: Record<string, SkillState>;
  remediation: Remediation[];
  seq: number;
  now: number;
  /** Recently served template ids, most recent last. */
  recentTemplates: string[];
  /** Skill of the previous question (avoid repeating it in mixed modes). */
  lastSkill?: string;
}

export interface Pick {
  skillId: string;
  templateId: string;
  difficulty: Difficulty;
  reason: 'repair' | 'review' | 'practice' | 'new' | 'focus';
  /** Remediation entry consumed by this pick, if any. */
  remediation?: Remediation;
}

export function inScope(skill: Skill, scope: PracticeScope): boolean {
  switch (scope.kind) {
    case 'smart':
      return !scope.areas || scope.areas.includes(skill.area);
    case 'skill':
      return skill.id === scope.skillId;
    case 'unit':
      return skill.area === scope.area && skill.unit === scope.unit;
    case 'review':
      return true;
  }
}

/** Choose a template for a skill: avoid the missed one and recent ones, prefer styles not yet credited. */
export function pickTemplate(
  rng: Rng,
  templates: Template<any>[],
  state: SkillState,
  recent: string[],
  avoid?: string,
): Template<any> {
  let pool = templates.filter((t) => t.id !== avoid);
  if (!pool.length) pool = templates;
  const recentIdx = (id: string) => {
    const i = recent.lastIndexOf(id);
    return i < 0 ? -1 : i;
  };
  // Score: uncredited styles first, then least recently seen.
  const scored = pool.map((t) => ({
    t,
    score: (state.styles[t.id] ? 1000 : 0) + (recentIdx(t.id) + 1) * 10 + rng.next(),
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored[0].t;
}

export function nextPick(rng: Rng, input: SchedulerInput, scope: PracticeScope): Pick | null {
  const playable = input.skills.filter((s) => (input.templatesBySkill.get(s.id)?.length ?? 0) > 0 && inScope(s, scope));
  if (!playable.length) return null;
  const stateOf = (id: string) => input.states[id] ?? newSkillState();
  const make = (skill: Skill, reason: Pick['reason'], avoid?: string, remediation?: Remediation): Pick => {
    const st = stateOf(skill.id);
    const t = pickTemplate(rng, input.templatesBySkill.get(skill.id)!, st, input.recentTemplates, avoid);
    return { skillId: skill.id, templateId: t.id, difficulty: st.difficulty, reason, remediation };
  };
  const byId = new Map(playable.map((s) => [s.id, s]));

  // 1. Repair queue: a missed skill comes back in another style.
  const repair = input.remediation
    .filter((r) => r.dueSeq <= input.seq && byId.has(r.skillId))
    .sort((a, b) => a.dueSeq - b.dueSeq)[0];
  if (repair) return make(byId.get(repair.skillId)!, 'repair', repair.missedTemplate, repair);

  if (scope.kind === 'skill') return make(playable[0], 'focus', input.recentTemplates.at(-1));

  const notLast = (s: Skill) => playable.length === 1 || s.id !== input.lastSkill;
  const due = playable.filter((s) => isDue(stateOf(s.id), input.now) && notLast(s));
  if (scope.kind === 'review') {
    if (due.length) return make(rng.pick(due), 'review');
    const mastered = playable.filter((s) => stateOf(s.id).level === 4 && notLast(s));
    return mastered.length ? make(rng.pick(mastered), 'review') : null;
  }

  const inProgress = playable
    .filter((s) => {
      const st = stateOf(s.id);
      return st.level > 0 && st.level < 4 && notLast(s);
    })
    // weakest first
    .sort((a, b) => stateOf(a.id).level - stateOf(b.id).level);
  const fresh = playable.filter((s) => stateOf(s.id).level === 0 && notLast(s));

  // Interleave: reviews 30%, in-progress 50%, new 20% (falling back when a bucket is empty).
  const roll = rng.next();
  const buckets: [Skill[], Pick['reason']][] =
    roll < 0.3
      ? [
          [due, 'review'],
          [inProgress, 'practice'],
          [fresh, 'new'],
        ]
      : roll < 0.8
        ? [
            [inProgress, 'practice'],
            [due, 'review'],
            [fresh, 'new'],
          ]
        : [
            [fresh, 'new'],
            [inProgress, 'practice'],
            [due, 'review'],
          ];
  for (const [bucket, reason] of buckets) {
    if (!bucket.length) continue;
    if (reason === 'practice') {
      // Bias toward the weakest few, but keep some variety.
      const top = bucket.slice(0, Math.max(3, Math.ceil(bucket.length / 3)));
      return make(rng.pick(top), reason);
    }
    if (reason === 'new') return make(bucket[0], reason); // syllabus order
    return make(rng.pick(bucket), reason);
  }
  // Everything mastered and nothing due: keep practicing mastered skills.
  const any = playable.filter(notLast);
  return make(rng.pick(any.length ? any : playable), 'review');
}

/** Remediation entry for a miss: comes back after 2 to 4 other questions. */
export function scheduleRepair(rng: Rng, skillId: string, templateId: string, seq: number): Remediation {
  return { skillId, missedTemplate: templateId, dueSeq: seq + rng.int(2, 4) };
}
