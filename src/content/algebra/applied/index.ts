import type { Skill, Template, Trap } from '../../../engine/types';
import { coordinateTemplates } from './coordinate';
import { appliedSkillList } from './skills';
import { appliedTrapMap } from './traps';

export const appliedSkills: Skill[] = appliedSkillList;
export const appliedTemplates: Template<any>[] = [...coordinateTemplates];
export const appliedTraps: Record<string, Trap> = appliedTrapMap;
