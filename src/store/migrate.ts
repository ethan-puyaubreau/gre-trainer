import type { SkillState } from '../mastery/model';
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
