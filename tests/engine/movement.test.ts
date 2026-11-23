import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { createTestSim, gridFrom, runSeconds } from './fixtures';

describe('movement orders', () => {
  it('moves a unit to the target at its configured speed', () => {
    const sim = createTestSim();
    const unit = sim.world.spawn('soldier', 1, 5.5, 5.5);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [unit.id], x: 15.5, y: 5.5 });
    runSeconds(sim, 4); // speed 2 tiles/s -> 8 tiles
    expect(unit.x).toBeCloseTo(13.5, 1);
    runSeconds(sim, 2);
    expect(unit.x).toBeCloseTo(15.5, 5);
    expect(unit.y).toBeCloseTo(5.5, 5);
    expect(unit.order.type).toBe('idle');
  });

  it('routes ground units around obstacles and never enters blocked tiles', () => {
    const rows = Array.from({ length: 20 }, (_, y) => (y < 16 ? '.........#..........' : '....................'));
    const surface = gridFrom(rows);
    const sim = createTestSim(surface);
    const unit = sim.world.spawn('soldier', 1, 3.5, 3.5);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [unit.id], x: 15.5, y: 3.5 });
    for (let i = 0; i < 20 * 30; i++) {
      sim.step();
      expect(surface.isWalkable(Math.floor(unit.x), Math.floor(unit.y))).toBe(true);
    }
    expect(unit.x).toBeCloseTo(15.5, 3);
  });

  it('lets air units fly straight over obstacles', () => {
    const rows = Array.from({ length: 20 }, () => '.........#..........');
    const sim = createTestSim(gridFrom(rows));
    const drone = sim.world.spawn('drone', 1, 3.5, 3.5);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [drone.id], x: 15.5, y: 3.5 });
    runSeconds(sim, 4.1);
    expect(drone.x).toBeCloseTo(15.5, 3);
  });
});

describe('group movement and stopping', () => {
  it('spreads a group over distinct destinations', () => {
    const sim = createTestSim();
    const ids = [0, 1, 2, 3, 4].map((i) => sim.world.spawn('soldier', 1, 3.5 + i, 3.5).id);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: ids, x: 25.5, y: 25.5 });
    runSeconds(sim, 25);
    const tiles = new Set(ids.map((id) => sim.world.entity(id)!).map((e) => `${Math.floor(e.x)},${Math.floor(e.y)}`));
    expect(tiles.size).toBe(5);
  });

  it('stops and clears the current order', () => {
    const sim = createTestSim();
    const unit = sim.world.spawn('soldier', 1, 5.5, 5.5);
    applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [unit.id], x: 30.5, y: 5.5 });
    runSeconds(sim, 1);
    applyCommand(sim.world, { type: 'stop', playerId: 1, unitIds: [unit.id] });
    const x = unit.x;
    runSeconds(sim, 2);
    expect(unit.x).toBeCloseTo(x, 1);
    expect(unit.order.type).toBe('idle');
  });
});
