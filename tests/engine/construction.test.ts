import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { createTestSim, runSeconds } from './fixtures';

describe('construction', () => {
  it('spends resources and builds a turret over time', () => {
    const sim = createTestSim();
    const engineer = sim.world.spawn('engineer', 1, 5.5, 5.5);
    sim.world.player(1).stockpile.crystal = 60;
    sim.world.player(1).stockpile.ore = 20;
    const result = applyCommand(sim.world, {
      type: 'build',
      playerId: 1,
      unitIds: [engineer.id],
      structureType: 'turret',
      x: 10.5,
      y: 5.5,
    });
    expect(result.accepted).toEqual([engineer.id]);
    expect(sim.world.player(1).stockpile).toMatchObject({ crystal: 10, ore: 0 });
    const turret = sim.world.entitiesList().find((e) => e.typeId === 'turret')!;
    expect(turret.built).toBeLessThan(1);
    expect(sim.world.isWalkable(10, 5)).toBe(false);
    runSeconds(sim, 6);
    expect(turret.built).toBe(1);
    expect(turret.hp).toBe(100);
    expect(engineer.order.type).toBe('idle');
    expect(sim.drainEvents().some((e) => e.type === 'constructed')).toBe(true);
  });

  it('rejects construction without resources, on blocked ground or of unknown structures', () => {
    const sim = createTestSim();
    const engineer = sim.world.spawn('engineer', 1, 5.5, 5.5);
    const build = (x: number, structureType = 'turret') =>
      applyCommand(sim.world, { type: 'build', playerId: 1, unitIds: [engineer.id], structureType, x, y: 5.5 });
    expect(build(10.5).rejected).toEqual([{ id: engineer.id, reason: 'insufficient-resources' }]);
    sim.world.player(1).stockpile.crystal = 500;
    sim.world.player(1).stockpile.ore = 500;
    sim.world.spawn('soldier', 1, 12.5, 5.5);
    expect(build(12.5).rejected).toEqual([{ id: engineer.id, reason: 'blocked' }]);
    expect(build(10.5, 'hq').rejected).toEqual([{ id: engineer.id, reason: 'unsupported' }]);
  });

  it('does not let a turret fire before it is completed', () => {
    const sim = createTestSim();
    const turret = sim.world.spawn('turret', 1, 5.5, 5.5, { built: 0.5 });
    const enemy = sim.world.spawn('scout', 2, 8.5, 5.5);
    enemy.order = { type: 'move', x: 8.5, y: 5.5 };
    runSeconds(sim, 2);
    expect(enemy.hp).toBe(30);
    expect(turret.built).toBe(0.5);
  });
});

describe('repair', () => {
  it('restores hit points of damaged friendly units', () => {
    const sim = createTestSim();
    const engineer = sim.world.spawn('engineer', 1, 5.5, 5.5);
    const tank = sim.world.spawn('tank', 1, 10.5, 5.5);
    tank.hp = 100;
    applyCommand(sim.world, { type: 'repair', playerId: 1, unitIds: [engineer.id], targetId: tank.id });
    runSeconds(sim, 10);
    expect(tank.hp).toBe(200);
    expect(engineer.order.type).toBe('idle');
  });

  it('rejects repairing enemies', () => {
    const sim = createTestSim();
    const engineer = sim.world.spawn('engineer', 1, 5.5, 5.5);
    const enemy = sim.world.spawn('tank', 2, 7.5, 5.5);
    enemy.hp = 10;
    const result = applyCommand(sim.world, { type: 'repair', playerId: 1, unitIds: [engineer.id], targetId: enemy.id });
    expect(result.rejected).toEqual([{ id: engineer.id, reason: 'invalid-target' }]);
  });
});
