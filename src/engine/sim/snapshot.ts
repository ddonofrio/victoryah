import type { WalkabilityGrid } from '../world/pathfinding';
import { VisibilityMap } from '../world/visibility';
import type { ResourceKind, Ruleset } from './definitions';
import type { Deposit, Entity, PlayerId } from './types';
import { World } from './world';

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface PlayerSnapshot {
  readonly id: PlayerId;
  readonly name: string;
  readonly stockpile: Record<ResourceKind, number>;
  /** Run-length encoded explored mask: alternating run lengths, starting with unexplored. */
  readonly explored: number[];
}

/**
 * Versioned, JSON-safe representation of a World's authoritative state. Terrain is not stored:
 * it is regenerated from the planet seed, which keeps snapshots small.
 */
export interface WorldSnapshot {
  readonly schemaVersion: number;
  readonly tick: number;
  readonly nextEntityId: number;
  readonly nextDepositId: number;
  readonly players: readonly PlayerSnapshot[];
  readonly entities: readonly Entity[];
  readonly deposits: readonly Deposit[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function snapshotWorld(world: World): WorldSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    tick: world.tick,
    nextEntityId: world.nextEntityId,
    nextDepositId: world.nextDepositId,
    players: world.playersList().map((p) => ({
      id: p.id,
      name: p.name,
      stockpile: { ...p.stockpile },
      explored: encodeRuns(world.visibility(p.id).exportExplored()),
    })),
    entities: clone(world.entitiesList()),
    deposits: clone(world.depositsList()),
  };
}

export function restoreWorld(snapshot: WorldSnapshot, surface: WalkabilityGrid, ruleset: Ruleset): World {
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported snapshot schema version: ${snapshot.schemaVersion}`);
  }
  const world = new World({ surface, ruleset, players: snapshot.players.map((p) => ({ id: p.id, name: p.name })) });
  world.tick = snapshot.tick;
  world.nextEntityId = snapshot.nextEntityId;
  world.nextDepositId = snapshot.nextDepositId;
  for (const p of snapshot.players) {
    Object.assign(world.player(p.id).stockpile, p.stockpile);
    const explored = decodeRuns(p.explored, surface.width * surface.height);
    world.replaceVisibility(p.id, VisibilityMap.fromExplored(surface.width, surface.height, explored));
  }
  const entities = [...clone(snapshot.entities)].sort((a, b) => a.id - b.id);
  for (const entity of entities) world.insertEntity(entity);
  for (const deposit of clone(snapshot.deposits)) world.insertDeposit(deposit);
  return world;
}

function encodeRuns(mask: Uint8Array): number[] {
  const runs: number[] = [];
  let current = 0;
  let length = 0;
  for (const value of mask) {
    const bit = value ? 1 : 0;
    if (bit === current) {
      length++;
    } else {
      runs.push(length);
      current = bit;
      length = 1;
    }
  }
  runs.push(length);
  return runs;
}

function decodeRuns(runs: readonly number[], size: number): Uint8Array {
  const mask = new Uint8Array(size);
  let offset = 0;
  runs.forEach((length, i) => {
    if (i % 2 === 1) mask.fill(1, offset, Math.min(size, offset + length));
    offset += length;
  });
  return mask;
}
