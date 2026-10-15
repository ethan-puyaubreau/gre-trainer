import type { AreaContent } from '../../engine/types';
import { cycleTemplates } from './cycles';
import { cycleSelectTemplates, cycleSelectTraps } from './cycleSelect';
import { integersTemplates, integersTraps } from './integers';
import { numbersTemplates, numbersTraps } from './numbers';
import { rootTemplates } from './roots';
import { arithmeticSkills } from './skills';
import { arithmeticTraps } from './traps';

export const arithmetic: AreaContent = {
  area: 'arithmetic',
  skills: arithmeticSkills,
  traps: { ...arithmeticTraps, ...cycleSelectTraps, ...integersTraps, ...numbersTraps },
  templates: [...cycleTemplates, ...cycleSelectTemplates, ...rootTemplates, ...integersTemplates, ...numbersTemplates],
};
