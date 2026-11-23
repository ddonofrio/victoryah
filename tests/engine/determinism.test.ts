import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { restoreWorld, snapshotWorld } from '../../src/engine/sim/snapshot';
import { Simulation } from '../../src/engine/sim/simulation';
import { createTestSim, observe, runSeconds, testRuleset } from './fixtures';
import type { WalkabilityGrid } from '../../src/engine/world/pathfinding';

function battle(): Simulation {
  const sim = createTestSim();
  sim.world.spawn('hq', 1, 5.5, 5.5);
  const blue = [0, 1, 2, 3].map((i) => sim.world.spawn('soldier', 1, 8.5, 4.5 + i).id);
  [0, 1, 2].forEach((i) => sim.world.spawn('soldier', 2, 30.5, 10.5 + i));
  const harvester = sim.world.spawn('harvester', 1, 6.5, 9.5);
  const deposit = sim.world.addDeposit({ kind: 'crystal', x: 11.5, y: 11.5, amount: 500 });
  observe(sim);
  applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: blue, x: 28.5, y: 11.5 });
  applyCommand(sim.world, { type: 'harvest', playerId: 1, unitIds: [harvester.id], depositId: deposit.id });
  return sim;
}

const surfaceOf = (sim: Simulation): WalkabilityGrid => sim.world.surface;

describe('determinism and persistence', () => {
  it('produces identical states from identical inputs', () => {
    const a = battle();
    const b = battle();
    runSeconds(a, 30);
    runSeconds(b, 30);
    expect(JSON.stringify(snapshotWorld(a.world))).toBe(JSON.stringify(snapshotWorld(b.world)));
    // The scenario must really exercise movement, combat and the economy to be a meaningful check.
    expect(a.world.player(1).stockpile.crystal).toBeGreaterThan(0);
  });

  it('continues identically after a snapshot round trip', () => {
    const uninterrupted = battle();
    const saved = battle();
    runSeconds(uninterrupted, 10);
    runSeconds(saved, 10);
    const json = JSON.stringify(snapshotWorld(saved.world));
    const restored = new Simulation(restoreWorld(JSON.parse(json), surfaceOf(saved), testRuleset()));
    runSeconds(uninterrupted, 20);
    runSeconds(restored, 20);
    expect(JSON.stringify(snapshotWorld(restored.world))).toBe(JSON.stringify(snapshotWorld(uninterrupted.world)));
  });

  it('rejects snapshots with an unsupported schema version', () => {
    const sim = battle();
    const snapshot = { ...snapshotWorld(sim.world), schemaVersion: 999 };
    expect(() => restoreWorld(snapshot, surfaceOf(sim), testRuleset())).toThrow(/schema/i);
  });
});
