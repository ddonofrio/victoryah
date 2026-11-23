import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import type { WalkabilityGrid } from '../../src/engine/world/pathfinding';
import { createTestSim, gridFrom, openGrid, runSeconds } from './fixtures';

/** Wraps a grid and counts walkability queries, a deterministic measure of search effort. */
function counting(grid: WalkabilityGrid): WalkabilityGrid & { queries: number } {
  return {
    width: grid.width,
    height: grid.height,
    queries: 0,
    isWalkable(x: number, y: number) {
      this.queries++;
      return grid.isWalkable(x, y);
    },
  };
}

/** A 64 × 64 plain with a sealed 3 × 3 pocket whose centre is (40, 40). */
function plainWithSealedPocket(): WalkabilityGrid {
  const rows = Array.from({ length: 64 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      const ring = Math.max(Math.abs(x - 40), Math.abs(y - 40));
      return ring === 2 ? '#' : '.';
    }).join(''),
  );
  return gridFrom(rows);
}

describe('world connectivity', () => {
  it('tracks regions as structures seal and reopen passages', () => {
    // A wall with a single gap at (4, 4) between the left and right halves.
    const rows = Array.from({ length: 9 }, (_, y) => (y === 4 ? '.........' : '....#....'));
    const sim = createTestSim(gridFrom(rows));
    const world = sim.world;
    expect(world.regionAt(1, 1)).toBe(world.regionAt(7, 7));
    const gate = world.spawn('turret', 1, 4.5, 4.5);
    expect(world.regionAt(4, 4)).toBe(0);
    expect(world.regionAt(1, 1)).not.toBe(world.regionAt(7, 7));
    world.remove(gate.id);
    expect(world.regionAt(1, 1)).toBe(world.regionAt(7, 7));
  });
});

describe('orders toward unreachable destinations', () => {
  it('walks to the reachable tile nearest to a sealed-off destination', () => {
    const sim = createTestSim(plainWithSealedPocket());
    const unit = sim.world.spawn('soldier', 1, 30.5, 40.5);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [unit.id], x: 40.5, y: 40.5 });
    runSeconds(sim, 10);
    expect(unit.order.type).toBe('idle');
    expect(unit.x).toBeCloseTo(37.5, 5);
    expect(unit.y).toBeCloseTo(40.5, 5);
  });

  it('does not search the whole map when the destination cannot be reached', () => {
    const surface = counting(plainWithSealedPocket());
    const sim = createTestSim(surface);
    const unit = sim.world.spawn('soldier', 1, 30.5, 40.5);
    sim.world.regionAt(0, 0);
    surface.queries = 0;
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [unit.id], x: 40.5, y: 40.5 });
    // An exhaustive search of the 64 × 64 plain needs tens of thousands of queries.
    expect(surface.queries).toBeLessThan(2000);
  });

  it('approaches a structure without searching the whole map for its blocked centre', () => {
    const surface = counting(openGrid(64));
    const sim = createTestSim(surface);
    const hq = sim.world.spawn('hq', 1, 40.5, 40.5);
    const harvester = sim.world.spawn('harvester', 1, 30.5, 40.5);
    harvester.cargo = { kind: 'crystal', amount: 10 };
    harvester.order = { type: 'harvest', depositId: 999, phase: 'returning' };
    sim.world.regionAt(0, 0);
    surface.queries = 0;
    runSeconds(sim, 6);
    expect(sim.world.player(1).stockpile.crystal).toBe(10);
    expect(hq.hp).toBe(1000);
    expect(surface.queries).toBeLessThan(4000);
  });
});

describe('world walkability', () => {
  it('asks the immutable surface about each tile only once', () => {
    const surface = counting(openGrid(16));
    const world = createTestSim(surface).world;
    surface.queries = 0;
    expect(world.isWalkable(3, 3)).toBe(true);
    expect(world.isWalkable(3, 3)).toBe(true);
    expect(surface.queries).toBe(1);
  });

  it('treats tiles outside the map as blocked', () => {
    const world = createTestSim(openGrid(16)).world;
    expect(world.isWalkable(-1, 3)).toBe(false);
    expect(world.isWalkable(16, 3)).toBe(false);
    expect(world.isWalkable(3, 16)).toBe(false);
  });
});
