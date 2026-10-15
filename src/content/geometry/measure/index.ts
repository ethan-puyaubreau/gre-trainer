import type { Skill, Template, Trap } from '../../../engine/types';
import { circleTemplates } from './circles';
import { compositeTemplates } from './composite';
import { equalPerimeterTemplates, equalPerimeterTraps } from './equal-perimeter';
import { originDiameterTemplates, originDiameterTraps } from './origin-diameter';
import { polygonArcTemplates, polygonArcTraps } from './polygon-arcs';
import { polygonTemplates } from './polygons';
import { solidTemplates } from './solids';
import { measureSkills as skills } from './skills';
import { measureTraps as traps } from './traps';

export const measureSkills: Skill[] = skills;
export const measureTemplates: Template<any>[] = [...polygonTemplates, ...circleTemplates, ...compositeTemplates, ...solidTemplates, ...polygonArcTemplates, ...equalPerimeterTemplates, ...originDiameterTemplates];
export const measureTraps: Record<string, Trap> = { ...traps, ...polygonArcTraps, ...equalPerimeterTraps, ...originDiameterTraps };
