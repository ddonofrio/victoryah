import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { createTestSim, runSeconds } from './fixtures';

describe('command validation', () => {
  it("rejects orders for another player's units", () => {
    const sim = createTestSim();
    const enemy = sim.world.spawn('soldier', 2, 5.5, 5.5);
    const result = applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [enemy.id], x: 9, y: 9 });
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([{ id: enemy.id, reason: 'not-owner' }]);
    expect(enemy.order.type).toBe('idle');
  });

  it('rejects units that lack the capability and accepts the rest', () => {
    const sim = createTestSim();
    const soldier = sim.world.spawn('soldier', 1, 5.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 6.5, 5.5);
    const deposit = sim.world.addDeposit({ kind: 'crystal', x: 10.5, y: 5.5, amount: 100 });
    const result = applyCommand(sim.world, {
      type: 'harvest',
      playerId: 1,
      unitIds: [soldier.id, harvester.id],
      depositId: deposit.id,
    });
    expect(result.accepted).toEqual([harvester.id]);
    expect(result.rejected).toEqual([{ id: soldier.id, reason: 'unsupported' }]);
  });
});

describe('command validation of targets and timing', () => {
  it('rejects unknown units, invalid targets and immobile units for movement', () => {
    const sim = createTestSim();
    const turret = sim.world.spawn('turret', 1, 5.5, 5.5);
    const soldier = sim.world.spawn('soldier', 1, 8.5, 5.5);
    expect(applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [999], x: 1, y: 1 }).rejected).toEqual([
      { id: 999, reason: 'unknown-unit' },
    ]);
    expect(applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [turret.id], x: 1, y: 1 }).rejected).toEqual([
      { id: turret.id, reason: 'unsupported' },
    ]);
    expect(
      applyCommand(sim.world, { type: 'attack', playerId: 1, unitIds: [soldier.id], targetId: 12345 }).rejected,
    ).toEqual([{ id: soldier.id, reason: 'invalid-target' }]);
    expect(
      applyCommand(sim.world, { type: 'move', playerId: 1, unitIds: [soldier.id], x: Number.NaN, y: 1 }).rejected,
    ).toEqual([{ id: soldier.id, reason: 'invalid-target' }]);
  });

  it('applies queued commands on the next simulation step', () => {
    const sim = createTestSim();
    const unit = sim.world.spawn('soldier', 1, 5.5, 5.5);
    sim.submit({ type: 'move', playerId: 1, unitIds: [unit.id], x: 10.5, y: 5.5 });
    expect(unit.order.type).toBe('idle');
    sim.step();
    expect(unit.order.type).toBe('move');
  });
});

describe('smart (context-sensitive) commands', () => {
  it('makes each unit do what it can with the clicked target', () => {
    const sim = createTestSim();
    const soldier = sim.world.spawn('soldier', 1, 5.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 6.5, 5.5);
    const deposit = sim.world.addDeposit({ kind: 'crystal', x: 12.5, y: 5.5, amount: 100 });
    applyCommand(sim.world, {
      type: 'smart',
      playerId: 1,
      unitIds: [soldier.id, harvester.id],
      target: { x: 12.5, y: 5.5, depositId: deposit.id },
    });
    expect(harvester.order.type).toBe('harvest');
    expect(soldier.order.type).toBe('move');
  });

  it('attacks visible enemies and moves units that cannot attack', () => {
    const sim = createTestSim();
    const soldier = sim.world.spawn('soldier', 1, 5.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 6.5, 5.5);
    const enemy = sim.world.spawn('soldier', 2, 9.5, 5.5);
    runSeconds(sim, 0.25);
    applyCommand(sim.world, {
      type: 'smart',
      playerId: 1,
      unitIds: [soldier.id, harvester.id],
      target: { x: 9.5, y: 5.5, entityId: enemy.id },
    });
    expect(soldier.order).toEqual({ type: 'attack', targetId: enemy.id });
    expect(harvester.order.type).toBe('move');
  });

  it('repairs damaged friendly units with engineers', () => {
    const sim = createTestSim();
    const engineer = sim.world.spawn('engineer', 1, 5.5, 5.5);
    const tank = sim.world.spawn('tank', 1, 8.5, 5.5);
    tank.hp = 50;
    applyCommand(sim.world, {
      type: 'smart',
      playerId: 1,
      unitIds: [engineer.id],
      target: { x: 8.5, y: 5.5, entityId: tank.id },
    });
    expect(engineer.order).toEqual({ type: 'repair', targetId: tank.id });
  });
});
