import { RESOURCE_FIELD_TYPES, STARTER_FIELDS } from '../content/resourceFields';
import { ENEMY_DEFENCES, ENEMY_GARRISON, ENEMY_PATROL, PLAYER_DEFENCES, PLAYER_FORCE } from '../content/skirmishForces';
import { VICTORYAH_RULESET } from '../content/units';
import type { PlayerId, Point } from '../engine/sim/types';
import type { DepositSpec } from '../engine/sim/world';
import { World } from '../engine/sim/world';
import { findOpenSite, largestRegionMask, TileAllocator } from '../engine/world/regions';
import { generateDeposits, placeStarterField, type DepositPlan } from '../engine/world/resourceFields';
import { Terrain } from '../engine/world/terrain';

export const LOCAL_PLAYER_ID: PlayerId = 1;
export const ENEMY_PLAYER_ID: PlayerId = 2;
const SKIRMISH_MAP_SIZE = 256;

export interface Scenario {
  readonly seed: number;
  readonly terrain: Terrain;
  readonly world: World;
  readonly localPlayerId: PlayerId;
}

/**
 * A single-planet skirmish: the local commander's landing site and a hostile garrison on the
 * far side of the map. Everything is derived from the seed, so the same seed always yields the
 * same planet, deposits and starting forces.
 */
export function createSkirmish(seed: number): Scenario {
  const terrain = new Terrain({ seed, width: SKIRMISH_MAP_SIZE, height: SKIRMISH_MAP_SIZE });
  const reachable = largestRegionMask(terrain);
  const playerBase = findOpenSite(terrain, { x: 44, y: 44 }, 6, reachable);
  const enemyBase = findOpenSite(terrain, { x: 208, y: 208 }, 5, reachable);
  const world = new World({
    surface: terrain,
    ruleset: VICTORYAH_RULESET,
    players: [
      { id: LOCAL_PLAYER_ID, name: 'Commander' },
      { id: ENEMY_PLAYER_ID, name: 'Hostile Garrison' },
    ],
  });
  const tiles = new TileAllocator(terrain, reachable);
  deployPlayer(world, tiles, center(playerBase));
  deployEnemy(world, tiles, center(enemyBase), center(midpoint(terrain, reachable, playerBase, enemyBase)));
  for (const spec of planDeposits(
    seed,
    { terrain, reachable, exclusions: baseZones(playerBase, enemyBase) },
    center(playerBase),
  )) {
    world.addDeposit(spec);
  }
  const stockpile = world.player(LOCAL_PLAYER_ID).stockpile;
  stockpile.crystal = 400;
  stockpile.ore = 150;
  return { seed, terrain, world, localPlayerId: LOCAL_PLAYER_ID };
}

const center = (p: Point): Point => ({ x: p.x + 0.5, y: p.y + 0.5 });

function baseZones(a: Point, b: Point): DepositPlan['exclusions'] {
  return [
    { center: center(a), radius: 7 },
    { center: center(b), radius: 7 },
  ];
}

function deployPlayer(world: World, tiles: TileAllocator, base: Point): void {
  world.spawn('commandCenter', LOCAL_PLAYER_ID, base.x, base.y);
  tiles.reserveSquare(Math.floor(base.x), Math.floor(base.y), 2);
  placeDefences(world, tiles, base, PLAYER_DEFENCES, LOCAL_PLAYER_ID, 5);
  for (const [typeId, count] of PLAYER_FORCE) {
    for (let i = 0; i < count; i++) spawnAt(world, typeId, LOCAL_PLAYER_ID, tiles.take(base, 2));
  }
}

function deployEnemy(world: World, tiles: TileAllocator, base: Point, patrol: Point): void {
  world.spawn('commandCenter', ENEMY_PLAYER_ID, base.x, base.y);
  tiles.reserveSquare(Math.floor(base.x), Math.floor(base.y), 2);
  placeDefences(world, tiles, base, ENEMY_DEFENCES, ENEMY_PLAYER_ID, 4);
  for (const [typeId, count] of ENEMY_GARRISON) {
    for (let i = 0; i < count; i++) spawnAt(world, typeId, ENEMY_PLAYER_ID, tiles.take(base, 2));
  }
  for (const [typeId, count] of ENEMY_PATROL) {
    for (let i = 0; i < count; i++) spawnAt(world, typeId, ENEMY_PLAYER_ID, tiles.take(patrol, 0));
  }
}

/** Spreads turrets evenly on a ring around the base. */
function placeDefences(
  world: World,
  tiles: TileAllocator,
  base: Point,
  types: readonly string[],
  owner: PlayerId,
  radius: number,
): void {
  types.forEach((typeId, i) => {
    const angle = Math.PI / 4 + (i / types.length) * Math.PI * 2;
    const spot = { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
    spawnAt(world, typeId, owner, tiles.take(spot, 0));
  });
}

function spawnAt(world: World, typeId: string, owner: PlayerId, p: Point): void {
  world.spawn(typeId, owner, p.x, p.y, { facing: owner === LOCAL_PLAYER_ID ? Math.PI / 4 : (-3 * Math.PI) / 4 });
}

function midpoint(terrain: Terrain, reachable: Uint8Array, a: Point, b: Point): Point {
  return findOpenSite(terrain, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 2, reachable);
}

function planDeposits(seed: number, plan: DepositPlan, base: Point): DepositSpec[] {
  const used = new Set<number>();
  const deposits: DepositSpec[] = [];
  placeStarterField(plan, STARTER_FIELDS.crystal, base, 11, seed + 1, used, deposits);
  placeStarterField(plan, STARTER_FIELDS.energy, base, 9, seed + 2, used, deposits);
  placeStarterField(plan, STARTER_FIELDS.ore, base, 16, seed + 3, used, deposits);
  placeStarterField(plan, STARTER_FIELDS.salvage, base, 13, seed + 4, used, deposits);
  deposits.push(...generateDeposits(seed, plan, RESOURCE_FIELD_TYPES, used));
  return deposits;
}
