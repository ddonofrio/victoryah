import { ACTIONS, type Capability, type UnitTypeDefinition } from './definitions';

/**
 * Actions available for a selection: those supported by every selected unit, in canonical
 * order. Derived purely from capabilities, never from specific unit type combinations.
 */
export function sharedActions(definitions: readonly UnitTypeDefinition[]): Capability[] {
  if (definitions.length === 0) return [];
  return ACTIONS.filter((action) => definitions.every((def) => def.capabilities.includes(action)));
}
