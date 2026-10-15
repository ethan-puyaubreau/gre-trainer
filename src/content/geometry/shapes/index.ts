import type { Skill, Template, Trap } from '../../../engine/types';
import { linesTemplates } from './lines';
import { readingTemplates } from './reading';
import { rightTemplates } from './right';
import { similarTemplates } from './similar';
import { triangleTemplates } from './triangles';
import { tripleSetTemplates, tripleSetTraps } from './triple-sets';
import { shapesSkillList } from './skills';
import { shapesTraps as traps } from './traps';

export const shapesSkills: Skill[] = shapesSkillList;
export const shapesTemplates: Template<any>[] = [...linesTemplates, ...triangleTemplates, ...rightTemplates, ...similarTemplates, ...readingTemplates, ...tripleSetTemplates];
export const shapesTraps: Record<string, Trap> = { ...traps, ...tripleSetTraps };
