import { templateById } from '../content';
import { DAY, type SkillState } from '../mastery/model';
import type { ProgressData } from './progress';

/** Version 1 started some skills flagged as weak and Attempted: restart the unanswered ones from zero and drop the flag. */
export function dropWeakFlags(data: ProgressData): ProgressData {
  if (!data || typeof data !== 'object') return data;
  const skills: Record<string, SkillState> = {};
  const src: unknown = data.skills;
  // Never throw on bad input: a corrupted skill entry is dropped, it would only crash later.
  for (const [id, st] of Object.entries(src && typeof src === 'object' ? src : {})) {
    if (!st || typeof st !== 'object') continue;
    const { flagged, ...rest } = st as SkillState & { flagged?: boolean };
    if (flagged && rest.attempts === 0) continue;
    skills[id] = rest;
  }
  return { ...data, skills };
}

/** A skill as version 2 saved it: credited template ids and the days they were earned on. */
type V2Skill = Omit<SkillState, 'styles' | 'styleFormats' | 'formats' | 'recent'> & { styles: string[]; days?: string[] };

/**
 * Version 2 credited a style as a bare template id: count it at difficulty 2 with the format of its template
 * (ids no longer in the registry are dropped), and leave Mastered skills to be confirmed by their next review.
 */
export function migrateStyleCredits(data: ProgressData): ProgressData {
  if (!data || typeof data !== 'object') return data;
  const skills: Record<string, SkillState> = {};
  const src: unknown = data.skills;
  for (const [id, st] of Object.entries(src && typeof src === 'object' ? src : {})) {
    if (!st || typeof st !== 'object') continue;
    if (!Array.isArray(st.styles)) {
      skills[id] = st;
      continue;
    }
    const { styles, days = [], ...rest } = st as V2Skill;
    const ids = styles.filter((t) => templateById.has(t));
    const styleFormats = Object.fromEntries(ids.map((t) => [t, templateById.get(t)!.format]));
    skills[id] = {
      ...rest,
      styles: Object.fromEntries(ids.map((t) => [t, 2])),
      styleFormats,
      formats: [...new Set(Object.values(styleFormats))],
      // Credits on 2+ days: the retention clock started at least a day before the last answer.
      firstCreditAt: ids.length ? (days.length >= 2 ? rest.lastAt - DAY : rest.lastAt) : undefined,
      recent: [],
      provisional: rest.level === 4 || undefined,
    };
  }
  return { ...data, skills };
}

/** Saved progress from an older persist version: 1 -> 2 -> 3. */
export function migrateProgress(persisted: unknown, version: number): ProgressData {
  let data = persisted as ProgressData;
  if (version < 2) data = dropWeakFlags(data);
  if (version < 3) data = migrateStyleCredits(data);
  return data;
}
