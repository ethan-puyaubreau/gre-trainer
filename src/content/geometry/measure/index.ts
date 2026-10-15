import type { Skill, Template, Trap } from '../../../engine/types';
import { circleTemplates } from './circles';
import { compositeTemplates } from './composite';
import { diagonalTemplates, diagonalTraps } from './diagonals';
import { equalPerimeterTemplates, equalPerimeterTraps } from './equal-perimeter';
import { insidePointsTemplates, insidePointsTraps } from './inside-points';
import { latticeAreaTemplates, latticeAreaTraps } from './lattice-area';
import { packingTemplates, packingTraps } from './packing';
import { originDiameterTemplates, originDiameterTraps } from './origin-diameter';
import { polygonArcTemplates, polygonArcTraps } from './polygon-arcs';
import { polygonTemplates } from './polygons';
import { solidTemplates } from './solids';
import { measureSkills as skills } from './skills';
import { measureTraps as traps } from './traps';

export const measureSkills: Skill[] = skills;
export const measureTemplates: Template<any>[] = [...polygonTemplates, ...circleTemplates, ...compositeTemplates, ...solidTemplates, ...polygonArcTemplates, ...equalPerimeterTemplates, ...originDiameterTemplates, ...packingTemplates, ...insidePointsTemplates, ...diagonalTemplates, ...latticeAreaTemplates];
export const measureTraps: Record<string, Trap> = { ...traps, ...polygonArcTraps, ...equalPerimeterTraps, ...originDiameterTraps, ...packingTraps, ...insidePointsTraps, ...diagonalTraps, ...latticeAreaTraps };
