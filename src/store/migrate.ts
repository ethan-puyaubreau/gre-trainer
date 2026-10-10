import type { SkillState } from '../mastery/model';
import type { ProgressData } from './progress';

/** Version 1 started some skills flagged as weak and Attempted: restart the unanswered ones from zero and drop the flag. */
export function dropWeakFlags(data: ProgressData): ProgressData {
  const skills: Record<string, SkillState> = {};
  for (const [id, st] of Object.entries(data.skills)) {
    const { flagged, ...rest } = st as SkillState & { flagged?: boolean };
    if (flagged && rest.attempts === 0) continue;
    skills[id] = rest;
  }
  return { ...data, skills };
}
