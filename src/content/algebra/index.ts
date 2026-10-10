import type { AreaContent } from '../../engine/types';
import { appliedSkills, appliedTemplates, appliedTraps } from './applied';
import { coreSkills, coreTemplates, coreTraps } from './core';

export const algebra: AreaContent = {
  area: 'algebra',
  skills: [...coreSkills, ...appliedSkills],
  traps: { ...coreTraps, ...appliedTraps },
  templates: [...coreTemplates, ...appliedTemplates],
};
