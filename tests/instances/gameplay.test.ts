import { describe, expect, it } from 'vitest';
import { createSkirmish, LOCAL_PLAYER_ID } from '../../src/instances/skirmish';
import { applyCommand } from '../../src/engine/sim/commands';
import { Simulation } from '../../src/engine/sim/simulation';

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * Simulation.TICK_RATE; i++) sim.step();
};

describe('first playable loop with real content', () => {
  it('harvests crystal into the stockpile with the starting harvesters', () => {
    const { world } = createSkirmish(2026);
    const sim = new Simulation(world);
    const harvesters = world.entitiesList().filter((e) => e.owner === LOCAL_PLAYER_ID && e.typeId === 'harvester');
    const crystal = world
      .knownDeposits(LOCAL_PLAYER_ID)
      .filter((d) => d.kind === 'crystal')
      .sort(
        (a, b) =>
          Math.hypot(a.x - harvesters[0]!.x, a.y - harvesters[0]!.y) -
          Math.hypot(b.x - harvesters[0]!.x, b.y - harvesters[0]!.y),
      )[0]!;
    const before = world.player(LOCAL_PLAYER_ID).stockpile.crystal;
    const result = applyCommand(world, {
      type: 'smart',
      playerId: LOCAL_PLAYER_ID,
      unitIds: harvesters.map((h) => h.id),
      target: { x: crystal.x, y: crystal.y, depositId: crystal.id },
    });
    expect(result.accepted).toHaveLength(harvesters.length);
    run(sim, 60);
    expect(world.player(LOCAL_PLAYER_ID).stockpile.crystal).toBeGreaterThan(before);
  });

  it('keeps the starting base stable when left alone', () => {
    const { world } = createSkirmish(2026);
    const sim = new Simulation(world);
    const ownBefore = world.entitiesList().filter((e) => e.owner === LOCAL_PLAYER_ID).length;
    run(sim, 30);
    expect(world.entitiesList().filter((e) => e.owner === LOCAL_PLAYER_ID).length).toBe(ownBefore);
  });
});
