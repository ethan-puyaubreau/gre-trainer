import type { Skill, Template, Trap } from '../../../engine/types';
import { polygonTemplates } from './polygons';
import { measureSkills as skills } from './skills';
import { measureTraps as traps } from './traps';

export const measureSkills: Skill[] = skills;
export const measureTemplates: Template<any>[] = [...polygonTemplates];
export const measureTraps: Record<string, Trap> = traps;
