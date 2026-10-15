import type { AreaContent } from '../../engine/types';
import { cycleTemplates } from './cycles';
import { cycleSelectTemplates, cycleSelectTraps } from './cycleSelect';
import { integersTemplates, integersTraps } from './integers';
import { numbersTemplates, numbersTraps } from './numbers';
import { rootTemplates } from './roots';
import { rootsEquationTemplates, rootsEquationTraps } from './rootsEquationNE';
import { rootsOrderTemplates, rootsOrderTraps } from './rootsOrder';
import { rootsRationalizeTemplates, rootsRationalizeTraps } from './rootsRationalize';
import { rootsSquareTemplates, rootsSquareTraps } from './rootsSquareQC';
import { arithmeticSkills } from './skills';
import { arithmeticTraps } from './traps';

export const arithmetic: AreaContent = {
  area: 'arithmetic',
  skills: arithmeticSkills,
  traps: { ...arithmeticTraps, ...cycleSelectTraps, ...integersTraps, ...numbersTraps, ...rootsSquareTraps, ...rootsRationalizeTraps, ...rootsOrderTraps, ...rootsEquationTraps },
  templates: [...cycleTemplates, ...cycleSelectTemplates, ...rootTemplates, ...rootsSquareTemplates, ...rootsRationalizeTemplates, ...rootsOrderTemplates, ...rootsEquationTemplates, ...integersTemplates, ...numbersTemplates],
};
