// Picks the next question: repair queue first (a missed skill coming back), then due reviews (the most
// overdue one 60% of the time), then reviews, skills in progress and new skills, interleaved.

import type { Rng } from '../engine/rng';
import type { Area, Difficulty, Skill, Template } from '../engine/types';
import { isDue, newSkillState, type SkillState } from './model';

export interface Remediation {
  skillId: string;
  /** Template that was missed. */
  missedTemplate: string;
  /** Stage 1 is served once the global attempt counter reaches this value; stage 2 does not use it. */
  dueSeq: number;
  /**
   * 1 = first comeback, a few questions later: the missed template again, with new numbers, one difficulty
   * below the missed question. 2 = next-day comeback, once the skill's `dueAt` has passed: another style.
   * Entries saved before stages existed have none and count as stage 1.
   */
  stage: 1 | 2;
}

const stageOf = (r: Remediation): 1 | 2 => r.stage ?? 1;

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

/** Chance that a due review jumps the queue ahead of the interleaved buckets. */
const DUE_FIRST = 0.6;
/** Skills at Attempted or Familiar from which no new skill is started: finish those first. */
const MAX_STARTED = 4;

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
  /**
   * `same` forces a template (when it still exists), `avoid` keeps one out. The first question of a new skill
   * is easy (difficulty 1); after that the difficulty is the skill's own: a miss has already lowered it by one,
   * which is the "one below the missed question" of a stage 1 comeback.
   */
  const make = (skill: Skill, reason: Pick['reason'], o: { same?: string; avoid?: string; remediation?: Remediation } = {}): Pick => {
    const st = stateOf(skill.id);
    const templates = input.templatesBySkill.get(skill.id)!;
    const t = templates.find((x) => x.id === o.same) ?? pickTemplate(rng, templates, st, input.recentTemplates, o.avoid);
    return { skillId: skill.id, templateId: t.id, difficulty: st.level === 0 ? 1 : st.difficulty, reason, remediation: o.remediation };
  };
  const byId = new Map(playable.map((s) => [s.id, s]));

  // 1. Repair queue: a missed skill comes back, first on the same template, then the next day in another style.
  const repair = input.remediation
    .filter((r) => byId.has(r.skillId) && (stageOf(r) === 2 ? isDue(stateOf(r.skillId), input.now) : r.dueSeq <= input.seq))
    .sort((a, b) => a.dueSeq - b.dueSeq)[0];
  if (repair) {
    const o = stageOf(repair) === 1 ? { same: repair.missedTemplate } : { avoid: repair.missedTemplate };
    return make(byId.get(repair.skillId)!, 'repair', { ...o, remediation: repair });
  }

  if (scope.kind === 'skill') return make(playable[0], 'focus', { avoid: input.recentTemplates.at(-1) });

  const notLast = (s: Skill) => playable.length === 1 || s.id !== input.lastSkill;
  const due = playable.filter((s) => isDue(stateOf(s.id), input.now) && notLast(s));
  if (scope.kind === 'review') {
    if (due.length) return make(rng.pick(due), 'review');
    const mastered = playable.filter((s) => stateOf(s.id).level === 4 && notLast(s));
    return mastered.length ? make(rng.pick(mastered), 'review') : null;
  }

  // Mini block: a skill just started gets a second question, and a third on a coin flip, before interleaving.
  const started = input.lastSkill ? byId.get(input.lastSkill) : undefined;
  if (started) {
    const answered = stateOf(started.id).attempts;
    if (answered === 1 || (answered === 2 && rng.chance(0.5))) return make(started, 'new');
  }

  // Due reviews first: the most overdue one most of the time, the interleaved buckets below otherwise.
  if (due.length && rng.chance(DUE_FIRST)) {
    return make(due.reduce((a, b) => (stateOf(b.id).dueAt! < stateOf(a.id).dueAt! ? b : a)), 'review');
  }

  const inProgress = playable
    .filter((s) => {
      const st = stateOf(s.id);
      return st.level > 0 && st.level < 4 && notLast(s);
    })
    // weakest first
    .sort((a, b) => stateOf(a.id).level - stateOf(b.id).level);
  const fresh = playable.filter((s) => stateOf(s.id).level === 0 && notLast(s));
  // No new skill while MAX_STARTED are barely started (any skill of the syllabus, not only this scope's).
  const crowded = input.skills.filter((s) => [1, 2].includes(stateOf(s.id).level)).length >= MAX_STARTED;
  const open = crowded ? [] : fresh;

  // Interleave: reviews 30%, in-progress 50%, new 20% (falling back when a bucket is empty).
  const roll = rng.next();
  const buckets: [Skill[], Pick['reason']][] =
    roll < 0.3
      ? [
          [due, 'review'],
          [inProgress, 'practice'],
          [open, 'new'],
        ]
      : roll < 0.8
        ? [
            [inProgress, 'practice'],
            [due, 'review'],
            [open, 'new'],
          ]
        : [
            [open, 'new'],
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
  // Nothing else to serve in this scope: a new skill is better than repeating a mastered one.
  if (fresh.length) return make(fresh[0], 'new');
  // Everything mastered and nothing due: keep practicing mastered skills.
  const any = playable.filter(notLast);
  return make(rng.pick(any.length ? any : playable), 'review');
}

/** Remediation entry for a miss: stage 1 comes back after 2 to 4 other questions, stage 2 as soon as the skill is due again. */
export function scheduleRepair(rng: Rng, skillId: string, templateId: string, seq: number, stage: 1 | 2 = 1): Remediation {
  return { skillId, missedTemplate: templateId, dueSeq: stage === 1 ? seq + rng.int(2, 4) : seq, stage };
}
