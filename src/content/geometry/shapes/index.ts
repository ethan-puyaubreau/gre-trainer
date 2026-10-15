import type { Skill, Template, Trap } from '../../../engine/types';
import { linesTemplates } from './lines';
import { readingTemplates } from './reading';
import { rightTemplates } from './right';
import { similarTemplates } from './similar';
import { triangleTemplates } from './triangles';
import { longestSegmentTemplates, longestSegmentTraps } from './longest-segment';
import { tripleSetTemplates, tripleSetTraps } from './triple-sets';
import { altitudeTemplates, altitudeTraps } from './altitude';
import { trapezoidDiagonalTemplates, trapezoidDiagonalTraps } from './trapezoid-diagonals';
import { shapesSkillList } from './skills';
import { shapesTraps as traps } from './traps';

export const shapesSkills: Skill[] = shapesSkillList;
export const shapesTemplates: Template<any>[] = [...linesTemplates, ...triangleTemplates, ...rightTemplates, ...similarTemplates, ...readingTemplates, ...tripleSetTemplates, ...longestSegmentTemplates, ...altitudeTemplates, ...trapezoidDiagonalTemplates];
export const shapesTraps: Record<string, Trap> = { ...traps, ...tripleSetTraps, ...longestSegmentTraps, ...altitudeTraps, ...trapezoidDiagonalTraps };
