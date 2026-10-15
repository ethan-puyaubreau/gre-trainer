import type { Skill, Template, Trap } from '../../../engine/types';
import { linesTemplates } from './lines';
import { readingTemplates } from './reading';
import { rightTemplates } from './right';
import { similarTemplates } from './similar';
import { triangleTemplates } from './triangles';
import { bisectorTemplates, bisectorTraps } from './bisector';
import { cevianTemplates, cevianTraps } from './cevians';
import { clockHandsTemplates, clockHandsTraps } from './clock-hands';
import { parallelQcTemplates, parallelQcTraps } from './parallel-qc';
import { apexParallelTemplates, apexParallelTraps } from './apex-parallel';
import { longestSegmentTemplates, longestSegmentTraps } from './longest-segment';
import { tripleSetTemplates, tripleSetTraps } from './triple-sets';
import { shapesSkillList } from './skills';
import { shapesTraps as traps } from './traps';

export const shapesSkills: Skill[] = shapesSkillList;
export const shapesTemplates: Template<any>[] = [...linesTemplates, ...triangleTemplates, ...rightTemplates, ...similarTemplates, ...readingTemplates, ...tripleSetTemplates, ...longestSegmentTemplates, ...bisectorTemplates, ...apexParallelTemplates, ...parallelQcTemplates, ...clockHandsTemplates, ...cevianTemplates];
export const shapesTraps: Record<string, Trap> = { ...traps, ...tripleSetTraps, ...longestSegmentTraps, ...bisectorTraps, ...apexParallelTraps, ...parallelQcTraps, ...clockHandsTraps, ...cevianTraps };
