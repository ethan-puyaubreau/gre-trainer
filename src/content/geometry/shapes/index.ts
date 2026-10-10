import type { Skill, Template, Trap } from '../../../engine/types';
import { linesTemplates } from './lines';
import { shapesSkillList } from './skills';
import { shapesTraps as traps } from './traps';

export const shapesSkills: Skill[] = shapesSkillList;
export const shapesTemplates: Template<any>[] = [...linesTemplates];
export const shapesTraps: Record<string, Trap> = traps;
