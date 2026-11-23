import { RegionMap } from '../world/connectivity';
import { SpatialGrid } from '../world/spatialGrid';
import { VisibilityMap } from '../world/visibility';
import type { WalkabilityGrid } from '../world/pathfinding';
import { RESOURCE_KINDS, type ResourceKind, type Ruleset, type UnitTypeDefinition } from './definitions';
import type { Deposit, Entity, EntityId, PlayerId, PlayerState, SimEvent } from './types';

export interface WorldConfig {
  readonly surface: WalkabilityGrid;
  readonly ruleset: Ruleset;
  readonly players: readonly { readonly id: PlayerId; readonly name: string }[];
}

export interface SpawnOptions {
  readonly built?: number;
  readonly facing?: number;
}

export interface DepositSpec {
  readonly kind: ResourceKind;
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly hidden?: boolean;
}

const SURFACE_UNKNOWN = 0;
const SURFACE_OPEN = 1;
const SURFACE_BLOCKED = 2;

const emptyStockpile = (): Record<ResourceKind, number> =>
  Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<ResourceKind, number>;

/**
 * Authoritative state of one planetary instance: surface, entities, deposits and players.
 * Holds no rendering or networking concerns. Several players share one World; each has its own
 * visibility map, so shared planets never need per-player copies.
 */
export class World implements WalkabilityGrid {
  readonly surface: WalkabilityGrid;
  readonly ruleset: Ruleset;
  readonly width: number;
  readonly height: number;
  tick = 0;
  nextEntityId = 1;
  nextDepositId = 1;
  private readonly entities = new Map<EntityId, Entity>();
  private readonly deposits = new Map<number, Deposit>();
  private readonly players = new Map<PlayerId, PlayerState>();
  private readonly visibilityMaps = new Map<PlayerId, VisibilityMap>();
  private readonly index = new SpatialGrid(8);
  private readonly occupancy: Uint16Array;
  /**
   * Surface walkability per tile, filled on first use. The surface never changes during the life
   * of a World, and pathfinding asks about the same tiles thousands of times per search.
   */
  private readonly surfaceCache: Uint8Array;
  /** Derived from terrain and occupancy; rebuilt lazily after a structure appears or disappears. */
  private regions: RegionMap | null = null;
  private events: SimEvent[] = [];

  constructor(config: WorldConfig) {
    this.surface = config.surface;
    this.ruleset = config.ruleset;
    this.width = config.surface.width;
    this.height = config.surface.height;
    this.occupancy = new Uint16Array(this.width * this.height);
    this.surfaceCache = new Uint8Array(this.width * this.height);
    for (const p of config.players) {
      this.players.set(p.id, { id: p.id, name: p.name, stockpile: emptyStockpile() });
      this.visibilityMaps.set(p.id, new VisibilityMap(this.width, this.height));
    }
  }

  // ---- terrain -------------------------------------------------------------------------------

  /** Terrain walkability combined with tiles blocked by structures. */
  isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const i = y * this.width + x;
    let surface = this.surfaceCache[i]!;
    if (surface === SURFACE_UNKNOWN) {
      surface = this.surface.isWalkable(x, y) ? SURFACE_OPEN : SURFACE_BLOCKED;
      this.surfaceCache[i] = surface;
    }
    return surface === SURFACE_OPEN && this.occupancy[i] === 0;
  }

  /**
   * Identifier of the connected walkable area containing a tile, or 0 when the tile is blocked.
   * Ground units can travel between two tiles exactly when both report the same non-zero region.
   */
  regionAt(x: number, y: number): number {
    this.regions ??= new RegionMap(this);
    return this.regions.labelAt(x, y);
  }

  // ---- entities ------------------------------------------------------------------------------

  def(typeId: string): UnitTypeDefinition {
    const def = this.ruleset.units.get(typeId);
    if (!def) throw new Error(`Unknown unit type: ${typeId}`);
    return def;
  }

  spawn(typeId: string, owner: PlayerId, x: number, y: number, options: SpawnOptions = {}): Entity {
    const def = this.def(typeId);
    if (!this.players.has(owner)) throw new Error(`Unknown player: ${owner}`);
    const built = options.built ?? 1;
    return this.insertEntity({
      id: this.nextEntityId++,
      typeId,
      owner,
      x,
      y,
      facing: options.facing ?? 0,
      hp: built >= 1 ? def.maxHp : Math.max(1, Math.round(def.maxHp * built)),
      built,
      order: { type: 'idle' },
      path: [],
      cooldown: 0,
      cargo: null,
      rawStock: {},
      refinedStock: {},
      lastPathTick: -1000,
      idleTicks: 0,
    });
  }

  /** Inserts an already-formed entity (used by spawning and snapshot restoration). */
  insertEntity(entity: Entity): Entity {
    this.entities.set(entity.id, entity);
    this.index.insert(entity.id, entity.x, entity.y);
    this.setFootprint(entity, 1);
    return entity;
  }

  remove(id: EntityId): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.setFootprint(entity, -1);
    this.index.remove(id);
    this.entities.delete(id);
  }

  entity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /** All entities in ascending id order (deterministic iteration). */
  entitiesList(): Entity[] {
    return [...this.entities.values()];
  }

  relocate(entity: Entity, x: number, y: number): void {
    entity.x = x;
    entity.y = y;
    this.index.move(entity.id, x, y);
  }

  entitiesNear(x: number, y: number, radius: number): Entity[] {
    return this.index.queryRadius(x, y, radius).map((id) => this.entities.get(id)!);
  }

  // ---- deposits ------------------------------------------------------------------------------

  addDeposit(spec: DepositSpec): Deposit {
    const deposit: Deposit = {
      id: this.nextDepositId++,
      kind: spec.kind,
      x: spec.x,
      y: spec.y,
      amount: spec.amount,
      hidden: spec.hidden ?? false,
      revealedTo: [],
    };
    this.deposits.set(deposit.id, deposit);
    return deposit;
  }

  insertDeposit(deposit: Deposit): void {
    this.deposits.set(deposit.id, deposit);
  }

  deposit(id: number): Deposit | undefined {
    return this.deposits.get(id);
  }

  depositsList(): Deposit[] {
    return [...this.deposits.values()];
  }

  removeDeposit(id: number): void {
    this.deposits.delete(id);
  }

  /**
   * Whether a player may know about and act on a deposit: it lies on ground the player has
   * explored and, if underground, one of the player's prospectors has revealed it.
   */
  isDepositKnownTo(deposit: Deposit, playerId: PlayerId): boolean {
    if (deposit.hidden && !deposit.revealedTo.includes(playerId)) return false;
    return this.visibility(playerId).isExplored(deposit.x, deposit.y);
  }

  // ---- players and perception ----------------------------------------------------------------

  player(id: PlayerId): PlayerState {
    const player = this.players.get(id);
    if (!player) throw new Error(`Unknown player: ${id}`);
    return player;
  }

  playersList(): PlayerState[] {
    return [...this.players.values()];
  }

  visibility(id: PlayerId): VisibilityMap {
    const map = this.visibilityMaps.get(id);
    if (!map) throw new Error(`Unknown player: ${id}`);
    return map;
  }

  replaceVisibility(id: PlayerId, map: VisibilityMap): void {
    this.visibilityMaps.set(id, map);
  }

  /** Own entities plus foreign entities currently inside the player's vision. */
  perceivedEntities(playerId: PlayerId): Entity[] {
    const vision = this.visibility(playerId);
    return this.entitiesList().filter((e) => e.owner === playerId || vision.isVisible(e.x, e.y));
  }

  /** Deposits on explored ground, excluding underground deposits the player has not found. */
  knownDeposits(playerId: PlayerId): Deposit[] {
    return this.depositsList().filter((d) => this.isDepositKnownTo(d, playerId));
  }

  // ---- events --------------------------------------------------------------------------------

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  drainEvents(): SimEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private setFootprint(entity: Entity, delta: 1 | -1): void {
    const footprint = this.def(entity.typeId).footprint;
    if (!footprint) return;
    this.regions = null;
    const half = Math.floor(footprint / 2);
    const cx = Math.floor(entity.x);
    const cy = Math.floor(entity.y);
    for (let y = cy - half; y <= cy + half; y++) {
      for (let x = cx - half; x <= cx + half; x++) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        const i = y * this.width + x;
        this.occupancy[i] = (this.occupancy[i] ?? 0) + delta;
      }
    }
  }
}
