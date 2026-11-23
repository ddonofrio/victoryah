import { describe, expect, it } from 'vitest';
import { commandForAction, pointerTarget } from '../../src/client/input/pointerCommands';
import { createTestSim } from '../engine/fixtures';

describe('pointerTarget', () => {
  it('prefers the picked entity, then a known deposit, then bare ground', () => {
    const sim = createTestSim();
    sim.world.spawn('soldier', 1, 5.5, 5.5);
    const deposit = sim.world.addDeposit({ kind: 'crystal', x: 7.5, y: 5.5, amount: 50 });
    sim.step();
    expect(pointerTarget(sim.world, 1, { x: 7.6, y: 5.4 }, 42)).toEqual({ x: 7.6, y: 5.4, entityId: 42 });
    expect(pointerTarget(sim.world, 1, { x: 7.6, y: 5.4 })).toEqual({ x: 7.6, y: 5.4, depositId: deposit.id });
    expect(pointerTarget(sim.world, 1, { x: 3, y: 3 })).toEqual({ x: 3, y: 3 });
  });

  it('ignores deposits the player does not know about', () => {
    const sim = createTestSim();
    sim.world.spawn('soldier', 1, 5.5, 5.5);
    sim.world.addDeposit({ kind: 'ore', x: 7.5, y: 5.5, amount: 50, hidden: true });
    sim.step();
    expect(pointerTarget(sim.world, 1, { x: 7.5, y: 5.5 })).toEqual({ x: 7.5, y: 5.5 });
  });
});

describe('commandForAction', () => {
  const ids = [1, 2];
  it('builds the command matching a targeted action', () => {
    expect(commandForAction('move', ids, { x: 3, y: 4 })).toEqual({ type: 'move', unitIds: ids, x: 3, y: 4 });
    expect(commandForAction('attack', ids, { x: 3, y: 4, entityId: 9 })).toEqual({
      type: 'attack',
      unitIds: ids,
      targetId: 9,
    });
    expect(commandForAction('harvest', ids, { x: 3, y: 4, depositId: 5 })).toEqual({
      type: 'harvest',
      unitIds: ids,
      depositId: 5,
    });
    expect(commandForAction('extract', ids, { x: 3, y: 4, depositId: 5 })).toEqual({
      type: 'extract',
      unitIds: ids,
      depositId: 5,
    });
    expect(commandForAction('repair', ids, { x: 3, y: 4, entityId: 9 })).toEqual({
      type: 'repair',
      unitIds: ids,
      targetId: 9,
    });
    expect(commandForAction('haul', ids, { x: 3, y: 4, entityId: 9 })).toEqual({
      type: 'haul',
      unitIds: ids,
      targetId: 9,
    });
    expect(commandForAction('build', ids, { x: 3, y: 4 }, 'turret')).toEqual({
      type: 'build',
      unitIds: ids,
      structureType: 'turret',
      x: 3,
      y: 4,
    });
  });

  it('returns null when the target does not fit the action', () => {
    expect(commandForAction('attack', ids, { x: 3, y: 4 })).toBeNull();
    expect(commandForAction('harvest', ids, { x: 3, y: 4, entityId: 2 })).toBeNull();
    expect(commandForAction('build', ids, { x: 3, y: 4 })).toBeNull();
  });
});
