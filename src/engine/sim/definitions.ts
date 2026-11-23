/**
 * Contracts for data-driven unit and structure definitions. The engine only knows these shapes;
 * concrete balance values live in `src/content`.
 */

/** Player-facing actions. A unit exposes exactly the actions listed in its capabilities. */
export const ACTIONS = ['move', 'attack', 'harvest', 'build', 'repair', 'extract', 'haul', 'stop'] as const;
export type Capability = (typeof ACTIONS)[number];

export const RESOURCE_KINDS = ['crystal', 'ore', 'energy', 'salvage'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export type ResourceAmounts = Partial<Record<ResourceKind, number>>;

/** Movement and targeting layer of an entity. */
export type Domain = 'ground' | 'air' | 'structure';

export type UnitCategory = 'military' | 'logistics' | 'structure' | 'turret';

export interface WeaponDefinition {
  readonly damage: number;
  /** Range in tiles, measured centre to centre. */
  readonly range: number;
  /** Seconds between shots. */
  readonly cooldown: number;
  readonly targets: readonly Domain[];
  /** Damage multiplier applied against structures (siege weapons). */
  readonly structureMultiplier?: number;
  /** Cosmetic hint for presentation (tracer, shell, missile...). */
  readonly visual: 'bullet' | 'cannon' | 'missile' | 'artillery' | 'flak';
}

export interface HarvestDefinition {
  readonly kinds: readonly ResourceKind[];
  readonly capacity: number;
  /** Units gathered per second. */
  readonly rate: number;
  /** Starts gathering on its own when idle. */
  readonly autoGather?: boolean;
}

export interface UnitTypeDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: UnitCategory;
  readonly domain: Domain;
  readonly maxHp: number;
  /** Flat damage reduction per hit (minimum damage is 1). */
  readonly armor: number;
  /** Tiles per second; 0 for structures. */
  readonly speed: number;
  /** Collision and selection radius in tiles. */
  readonly radius: number;
  readonly sightRange: number;
  readonly capabilities: readonly Capability[];
  readonly weapon?: WeaponDefinition;
  readonly harvest?: HarvestDefinition;
  /** Structure types this unit can construct and its construction speed (hp per second). */
  readonly builder?: { readonly structures: readonly string[]; readonly rate: number };
  /** Hit points restored per second when repairing. */
  readonly repairRate?: number;
  /** Energy generated per second while deployed on an energy source. */
  readonly extractRate?: number;
  readonly haulCapacity?: number;
  /** Radius within which hidden (underground) deposits are revealed to the owner. */
  readonly prospectRange?: number;
  /** Accepts resource deliveries. `stockpile` credits the owner directly; `refinery` buffers. */
  readonly dropOff?: 'stockpile' | 'refinery';
  /** Refinery processing: raw units per second and refined output per raw unit. */
  readonly refining?: { readonly rate: number; readonly yield: number };
  /** Side length in tiles of the area a structure blocks (odd number). */
  readonly footprint?: number;
  readonly cost?: ResourceAmounts;
  /** Salvage left behind on destruction. */
  readonly salvageValue?: number;
}

/** The set of definitions a simulation runs with. */
export interface Ruleset {
  readonly units: ReadonlyMap<string, UnitTypeDefinition>;
}

export function createRuleset(definitions: readonly UnitTypeDefinition[]): Ruleset {
  const units = new Map<string, UnitTypeDefinition>();
  for (const def of definitions) {
    if (units.has(def.id)) throw new Error(`Duplicate unit definition: ${def.id}`);
    units.set(def.id, def);
  }
  return { units };
}
