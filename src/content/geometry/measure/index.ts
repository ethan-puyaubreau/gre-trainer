import type { Skill, Template, Trap } from '../../../engine/types';
import { circleTemplates } from './circles';
import { compositeTemplates } from './composite';
import { polygonTemplates } from './polygons';
import { solidTemplates } from './solids';
import { measureSkills as skills } from './skills';
import { measureTraps as traps } from './traps';

export const measureSkills: Skill[] = skills;
export const measureTemplates: Template<any>[] = [...polygonTemplates, ...circleTemplates, ...compositeTemplates, ...solidTemplates];
export const measureTraps: Record<string, Trap> = traps;
