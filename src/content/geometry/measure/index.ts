import type { Skill, Template, Trap } from '../../../engine/types';
import { circleTemplates } from './circles';
import { compositeTemplates } from './composite';
import { equalPerimeterTemplates, equalPerimeterTraps } from './equal-perimeter';
import { insidePointsTemplates, insidePointsTraps } from './inside-points';
import { packingTemplates, packingTraps } from './packing';
import { originDiameterTemplates, originDiameterTraps } from './origin-diameter';
import { polygonArcTemplates, polygonArcTraps } from './polygon-arcs';
import { polygonTemplates } from './polygons';
import { regionQcTemplates, regionQcTraps } from './region-qc';
import { solidTemplates } from './solids';
import { tangentQcTemplates, tangentQcTraps } from './tangent-qc';
import { measureSkills as skills } from './skills';
import { measureTraps as traps } from './traps';

export const measureSkills: Skill[] = skills;
export const measureTemplates: Template<any>[] = [...polygonTemplates, ...circleTemplates, ...compositeTemplates, ...solidTemplates, ...polygonArcTemplates, ...equalPerimeterTemplates, ...originDiameterTemplates, ...packingTemplates, ...insidePointsTemplates, ...tangentQcTemplates, ...regionQcTemplates];
export const measureTraps: Record<string, Trap> = { ...traps, ...polygonArcTraps, ...equalPerimeterTraps, ...originDiameterTraps, ...packingTraps, ...insidePointsTraps, ...tangentQcTraps, ...regionQcTraps };
