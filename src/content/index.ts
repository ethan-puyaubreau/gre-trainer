import type { Area, AreaContent, Skill, Template, Trap } from '../engine/types';
import { algebra } from './algebra';
import { arithmetic } from './arithmetic';
import { dataAnalysis } from './data';
import { geometry } from './geometry';

export const AREAS: AreaContent[] = [arithmetic, algebra, geometry, dataAnalysis];

export const AREA_NAMES: Record<Area, string> = {
  arithmetic: 'Arithmetic',
  algebra: 'Algebra',
  geometry: 'Geometry',
  data: 'Data Analysis',
};

export const SKILLS: Skill[] = AREAS.flatMap((a) => a.skills);
export const TEMPLATES: Template<any>[] = AREAS.flatMap((a) => a.templates);
export const TRAPS: Record<string, Trap> = Object.assign({}, ...AREAS.map((a) => a.traps));

export const skillById = new Map(SKILLS.map((s) => [s.id, s]));
export const templateById = new Map(TEMPLATES.map((t) => [t.id, t]));
export const templatesBySkill = new Map<string, Template<any>[]>(
  SKILLS.map((s) => [s.id, TEMPLATES.filter((t) => t.skill === s.id)]),
);

/** Skills that have at least one template (the ones that can be practiced). */
export const PLAYABLE_SKILLS = SKILLS.filter((s) => (templatesBySkill.get(s.id)?.length ?? 0) > 0);
