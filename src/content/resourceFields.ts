import type { FieldChance, FieldSpec } from '../engine/world/resourceFields';

/** Probability per 16×16 cell of each resource field type across the planet. */
export const RESOURCE_FIELD_TYPES: readonly FieldChance[] = [
  { chance: 0.16, spec: { kind: 'crystal', count: 7, spread: 3, amount: 400, hidden: false } },
  { chance: 0.1, spec: { kind: 'ore', count: 3, spread: 2, amount: 700, hidden: true } },
  { chance: 0.04, spec: { kind: 'energy', count: 1, spread: 0, amount: 4000, hidden: false } },
];

/** Fields guaranteed near a landing site so every resource loop is playable from the start. */
export const STARTER_FIELDS: Readonly<Record<'crystal' | 'ore' | 'energy' | 'salvage', FieldSpec>> = {
  crystal: { kind: 'crystal', count: 8, spread: 3, amount: 500, hidden: false },
  ore: { kind: 'ore', count: 3, spread: 2, amount: 800, hidden: true },
  energy: { kind: 'energy', count: 1, spread: 1, amount: 5000, hidden: false },
  salvage: { kind: 'salvage', count: 4, spread: 2, amount: 60, hidden: false },
};
