import { createRuleset, type UnitTypeDefinition } from '../../engine/sim/definitions';
import { LOGISTICS_UNITS } from './logistics';
import { MILITARY_UNITS } from './military';
import { STRUCTURES } from './structures';

export const UNIT_DEFINITIONS: readonly UnitTypeDefinition[] = [...MILITARY_UNITS, ...STRUCTURES, ...LOGISTICS_UNITS];

/** The ruleset used by the planetary RTS layer. */
export const VICTORYAH_RULESET = createRuleset(UNIT_DEFINITIONS);
