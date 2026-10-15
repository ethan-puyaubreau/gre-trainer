import type { Template, Trap } from '../../../engine/types';
import { wpAverageChange, wpAverageChangeTraps } from './wpAverageChange';
import { wpIntegerPurchaseQc, wpIntegerPurchaseTraps } from './wpIntegerPurchaseQc';
import { wpRatioChange, wpRatioChangeTraps } from './wpRatioChange';
import { rwThresholdQc, rwThresholdTraps } from './rwThresholdQc';
import { rwCurrent, rwCurrentTraps } from './rwCurrent';
import { rwCrewScaling, rwCrewTraps } from './rwCrewScaling';
import { rwTrainPassing, rwTrainTraps } from './rwTrainPassing';
import { mxBlendQc, mxBlendTraps } from './mxBlendQc';
import { mxReplacement, mxReplacementTraps } from './mxReplacement';
import { mxSplitInvestment, mxSplitTraps } from './mxSplitInvestment';
import { mxSimpleYears, mxSimpleYearsTraps } from './mxSimpleYears';

// New question styles added by lot B5, with their traps.
export const lotB5Templates: Template<any>[] = [mxSimpleYears, mxSplitInvestment, mxReplacement, mxBlendQc, rwTrainPassing, rwCrewScaling, rwCurrent, wpAverageChange, wpIntegerPurchaseQc, wpRatioChange, rwThresholdQc];
export const lotB5Traps: Record<string, Trap> = { ...mxSimpleYearsTraps, ...mxSplitTraps, ...mxReplacementTraps, ...mxBlendTraps, ...rwTrainTraps, ...rwCrewTraps, ...rwCurrentTraps, ...wpAverageChangeTraps, ...wpIntegerPurchaseTraps, ...wpRatioChangeTraps, ...rwThresholdTraps };
