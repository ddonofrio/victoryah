import { describe, expect, it } from 'vitest';
import { FogState } from '../../src/engine/world/visibility';
import { createTestSim, runSeconds } from './fixtures';

describe('per-player perception', () => {
  it('reveals terrain only around the player’s own units', () => {
    const sim = createTestSim();
    sim.world.spawn('soldier', 1, 5.5, 5.5);
    sim.world.spawn('soldier', 2, 40.5, 40.5);
    runSeconds(sim, 0.25);
    expect(sim.world.visibility(1).stateAt(5, 5)).toBe(FogState.Visible);
    expect(sim.world.visibility(1).stateAt(40, 40)).toBe(FogState.Unexplored);
    expect(sim.world.visibility(2).stateAt(40, 40)).toBe(FogState.Visible);
  });

  it('lists only enemies inside the player’s current vision', () => {
    const sim = createTestSim();
    sim.world.spawn('scout', 1, 5.5, 5.5);
    const near = sim.world.spawn('scout', 2, 9.5, 5.5);
    sim.world.spawn('scout', 2, 40.5, 40.5);
    runSeconds(sim, 0.25);
    const ids = sim.world.perceivedEntities(1).map((e) => e.id);
    expect(ids).toContain(near.id);
    expect(ids).toHaveLength(2);
  });

  it('hides unrevealed underground deposits and unexplored surface deposits', () => {
    const sim = createTestSim();
    sim.world.spawn('soldier', 1, 5.5, 5.5);
    const crystal = sim.world.addDeposit({ kind: 'crystal', x: 7.5, y: 5.5, amount: 10 });
    sim.world.addDeposit({ kind: 'ore', x: 6.5, y: 6.5, amount: 10, hidden: true });
    sim.world.addDeposit({ kind: 'crystal', x: 40.5, y: 40.5, amount: 10 });
    runSeconds(sim, 0.25);
    expect(sim.world.knownDeposits(1).map((d) => d.id)).toEqual([crystal.id]);
  });
});
