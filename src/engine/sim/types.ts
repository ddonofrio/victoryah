import type { ResourceAmounts, ResourceKind } from './definitions';

export type EntityId = number;
export type PlayerId = number;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type HarvestPhase = 'toDeposit' | 'gathering' | 'returning';
export type HaulPhase = 'toSource' | 'toStockpile';

/** What an entity is currently trying to do. Plain data so it can be persisted and synced. */
export type Order =
  | { readonly type: 'idle' }
  | { readonly type: 'move'; readonly x: number; readonly y: number }
  | { readonly type: 'attack'; readonly targetId: EntityId }
  | { readonly type: 'harvest'; readonly depositId: number; phase: HarvestPhase }
  | { readonly type: 'build'; readonly structureId: EntityId }
  | { readonly type: 'repair'; readonly targetId: EntityId }
  | { readonly type: 'extract'; readonly depositId: number }
  | { readonly type: 'haul'; readonly sourceId: EntityId; phase: HaulPhase };

export interface Cargo {
  kind: ResourceKind;
  amount: number;
}

/**
 * A unit or structure. All fields are plain serialisable data; derived structures (spatial
 * index, paths in progress) are rebuilt from them.
 */
export interface Entity {
  readonly id: EntityId;
  readonly typeId: string;
  readonly owner: PlayerId;
  x: number;
  y: number;
  /** Heading in radians, 0 = +x. Used for presentation and turret aiming. */
  facing: number;
  hp: number;
  /** Construction progress in [0, 1]; 1 for completed units and structures. */
  built: number;
  order: Order;
  /** Remaining world-space waypoints of the current movement. */
  path: Point[];
  /** Seconds until the weapon can fire again. */
  cooldown: number;
  cargo: Cargo | null;
  /** Refinery input waiting to be processed. */
  rawStock: ResourceAmounts;
  /** Processed materials held by a refinery, or goods carried by a transport. */
  refinedStock: ResourceAmounts;
  /** Tick of the last path request, used to throttle re-pathing while chasing. */
  lastPathTick: number;
  /** Ticks spent idle, used for automated behaviour. */
  idleTicks: number;
}

export interface Deposit {
  readonly id: number;
  readonly kind: ResourceKind;
  readonly x: number;
  readonly y: number;
  amount: number;
  /** Underground deposits must be revealed by a prospector before they can be exploited. */
  readonly hidden: boolean;
  /** Players who have discovered this hidden deposit. */
  revealedTo: PlayerId[];
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  stockpile: Record<ResourceKind, number>;
}

/** Notable things that happened during a tick, consumed by presentation (effects, sound). */
export type SimEvent =
  | {
      readonly type: 'shot';
      readonly sourceId: EntityId;
      readonly targetId: EntityId;
      readonly from: Point;
      readonly to: Point;
      readonly visual: string;
    }
  | {
      readonly type: 'destroyed';
      readonly entityId: EntityId;
      readonly typeId: string;
      readonly owner: PlayerId;
      readonly at: Point;
    }
  | {
      readonly type: 'delivered';
      readonly entityId: EntityId;
      readonly owner: PlayerId;
      readonly kind: ResourceKind;
      readonly amount: number;
    }
  | { readonly type: 'constructed'; readonly entityId: EntityId; readonly owner: PlayerId }
  | { readonly type: 'depositRevealed'; readonly depositId: number; readonly owner: PlayerId };
