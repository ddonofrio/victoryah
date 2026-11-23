import { describe, expect, it } from 'vitest';
import { createSkirmish, ENEMY_PLAYER_ID, LOCAL_PLAYER_ID } from '../../src/instances/skirmish';
import { UNIT_DEFINITIONS } from '../../src/content/units';
import { snapshotWorld } from '../../src/engine/sim/snapshot';
import { findPath } from '../../src/engine/world/pathfinding';

const fingerprint = (seed: number) => JSON.stringify(snapshotWorld(createSkirmish(seed).world));

describe('skirmish scenario', () => {
  it('is fully determined by its seed', () => {
    expect(fingerprint(11)).toBe(fingerprint(11));
    expect(fingerprint(11)).not.toBe(fingerprint(12));
  });

  it('gives the local player every unit type of the roster', () => {
    const { world } = createSkirmish(2026);
    const owned = new Set(
      world
        .entitiesList()
        .filter((e) => e.owner === LOCAL_PLAYER_ID)
        .map((e) => e.typeId),
    );
    for (const def of UNIT_DEFINITIONS) expect(owned.has(def.id), def.id).toBe(true);
  });

  it('places every unit on open ground and ground units on distinct tiles', () => {
    for (const seed of [1, 2026, 77777]) {
      const { world, terrain } = createSkirmish(seed);
      const tiles = new Set<string>();
      for (const e of world.entitiesList()) {
        expect(terrain.isWalkable(Math.floor(e.x), Math.floor(e.y)), `${seed}:${e.typeId}`).toBe(true);
        if (world.def(e.typeId).domain === 'air') continue;
        const key = `${Math.floor(e.x)},${Math.floor(e.y)}`;
        expect(tiles.has(key), `${seed}:${key}`).toBe(false);
        tiles.add(key);
      }
    }
  });
});

describe('skirmish robustness', () => {
  it('builds a valid scenario for many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      expect(() => createSkirmish(seed), `seed ${seed}`).not.toThrow();
    }
  });
});

describe('skirmish geography', () => {
  it('connects the player base to the enemy base over land', () => {
    for (const seed of [1, 2026, 77777]) {
      const { world, terrain } = createSkirmish(seed);
      const hq = (owner: number) =>
        world.entitiesList().find((e) => e.owner === owner && e.typeId === 'commandCenter')!;
      const from = hq(LOCAL_PLAYER_ID);
      const to = hq(ENEMY_PLAYER_ID);
      const result = findPath(
        terrain,
        { x: Math.floor(from.x) + 3, y: Math.floor(from.y) },
        { x: Math.floor(to.x) + 3, y: Math.floor(to.y) },
        { maxExpanded: 200_000 },
      );
      expect(result.reachedGoal, `seed ${seed}`).toBe(true);
    }
  });

  it('offers every resource kind near the player base, on reachable open ground', () => {
    for (const seed of [1, 2026, 77777]) {
      const { world, terrain } = createSkirmish(seed);
      const hq = world.entitiesList().find((e) => e.owner === LOCAL_PLAYER_ID && e.typeId === 'commandCenter')!;
      const near = world.depositsList().filter((d) => Math.hypot(d.x - hq.x, d.y - hq.y) < 28);
      expect(
        near.some((d) => d.kind === 'crystal' && !d.hidden),
        `seed ${seed}`,
      ).toBe(true);
      expect(
        near.some((d) => d.kind === 'ore' && d.hidden),
        `seed ${seed}`,
      ).toBe(true);
      expect(
        near.some((d) => d.kind === 'energy'),
        `seed ${seed}`,
      ).toBe(true);
      for (const d of world.depositsList()) expect(terrain.isWalkable(Math.floor(d.x), Math.floor(d.y))).toBe(true);
      expect(world.depositsList().length).toBeGreaterThan(40);
    }
  });
});
