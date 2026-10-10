import type { AreaContent } from '../../engine/types';
import { measureSkills, measureTemplates, measureTraps } from './measure';
import { shapesSkills, shapesTemplates, shapesTraps } from './shapes';

export const geometry: AreaContent = {
  area: 'geometry',
  skills: [...shapesSkills, ...measureSkills],
  traps: { ...shapesTraps, ...measureTraps },
  templates: [...shapesTemplates, ...measureTemplates],
};
