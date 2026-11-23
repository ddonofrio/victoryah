import { createRng, hash2, hash2Unit } from '../core/random';
import type { ResourceKind } from '../sim/definitions';
import type { Point } from '../sim/types';
import type { DepositSpec } from '../sim/world';
import type { Terrain } from './terrain';

const FIELD_CELL = 16;

/** Shape of one resource field: how many deposits, how spread out, how rich. */
export interface FieldSpec {
  readonly kind: ResourceKind;
  readonly count: number;
  readonly spread: number;
  readonly amount: number;
  readonly hidden: boolean;
}

/** A field type and its probability of appearing in a field cell. */
export interface FieldChance {
  readonly chance: number;
  readonly spec: FieldSpec;
}

export interface DepositPlan {
  readonly terrain: Terrain;
  /** Tiles reachable from the main base; deposits are only placed on reachable ground. */
  readonly reachable: Uint8Array;
  /** Areas kept clear of deposits (bases). */
  readonly exclusions: readonly { readonly center: Point; readonly radius: number }[];
}

/** Deterministically distributes resource fields over the whole planet surface. */
export function generateDeposits(
  seed: number,
  plan: DepositPlan,
  fieldTypes: readonly FieldChance[],
  used = new Set<number>(),
): DepositSpec[] {
  const deposits: DepositSpec[] = [];
  const cellsX = Math.ceil(plan.terrain.width / FIELD_CELL);
  const cellsY = Math.ceil(plan.terrain.height / FIELD_CELL);
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const roll = hash2Unit(seed + 211, cx, cy);
      const type = pickFieldType(fieldTypes, roll);
      if (!type) continue;
      const center = {
        x: cx * FIELD_CELL + 3 + (hash2(seed + 223, cx, cy) % (FIELD_CELL - 6)),
        y: cy * FIELD_CELL + 3 + (hash2(seed + 227, cx, cy) % (FIELD_CELL - 6)),
      };
      placeField(plan, type, center, createRng(hash2(seed + 229, cx, cy)), used, deposits);
    }
  }
  return deposits;
}

function pickFieldType(fieldTypes: readonly FieldChance[], roll: number): FieldSpec | undefined {
  let threshold = 0;
  for (const type of fieldTypes) {
    threshold += type.chance;
    if (roll < threshold) return type.spec;
  }
  return undefined;
}

/** Places a field around a centre on valid tiles; returns the number of deposits placed. */
function placeField(
  plan: DepositPlan,
  spec: FieldSpec,
  center: Point,
  rng: () => number,
  used: Set<number>,
  out: DepositSpec[],
): number {
  let placed = 0;
  for (let attempt = 0; attempt < spec.count * 6 && placed < spec.count; attempt++) {
    const x = Math.round(center.x + (rng() * 2 - 1) * spec.spread);
    const y = Math.round(center.y + (rng() * 2 - 1) * spec.spread);
    if (!isValidSite(plan, x, y, used)) continue;
    used.add(y * plan.terrain.width + x);
    const amount = Math.round(spec.amount * (0.75 + rng() * 0.5));
    out.push({ kind: spec.kind, x: x + 0.5, y: y + 0.5, amount, hidden: spec.hidden });
    placed++;
  }
  return placed;
}

function isValidSite(plan: DepositPlan, x: number, y: number, used: Set<number>): boolean {
  const index = y * plan.terrain.width + x;
  if (!plan.terrain.isWalkable(x, y) || plan.reachable[index] !== 1 || used.has(index)) return false;
  return plan.exclusions.every((zone) => Math.hypot(x + 0.5 - zone.center.x, y + 0.5 - zone.center.y) > zone.radius);
}

/** Guarantees a starter field of a kind at roughly `distance` tiles from the base. */
export function placeStarterField(
  plan: DepositPlan,
  spec: FieldSpec,
  base: Point,
  distance: number,
  seed: number,
  used: Set<number>,
  out: DepositSpec[],
): void {
  const rng = createRng(seed);
  const startAngle = rng() * Math.PI * 2;
  for (let step = 0; step < 48; step++) {
    const angle = startAngle + step * ((Math.PI * 2) / 12);
    const radius = distance + Math.floor(step / 12) * 3;
    const center = { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
    if (placeField(plan, spec, center, rng, used, out) > 0) return;
  }
}
