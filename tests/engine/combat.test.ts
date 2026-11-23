import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { createTestSim, runSeconds } from './fixtures';

describe('attack orders', () => {
  it('closes into range and destroys the target, leaving salvage', () => {
    const sim = createTestSim();
    const squad = [4.5, 5.5, 6.5].map((y) => sim.world.spawn('soldier', 1, 5.5, y));
    const soldier = squad[1]!;
    const enemy = sim.world.spawn('turret', 2, 20.5, 5.5);
    sim.world.spawn('scout', 1, 20.5, 11.5); // spotter outside turret range, so the target is visible
    runSeconds(sim, 0.25);
    applyCommand(sim.world, { type: 'attack', playerId: 1, unitIds: squad.map((u) => u.id), targetId: enemy.id });
    runSeconds(sim, 25);
    expect(sim.world.entity(enemy.id)).toBeUndefined();
    expect(Math.hypot(soldier.x - 20.5, soldier.y - 5.5)).toBeLessThanOrEqual(4.01 + 0.5);
    const salvage = sim.world.depositsList().find((d) => d.kind === 'salvage');
    expect(salvage?.amount).toBe(20);
    const events = sim.drainEvents();
    expect(events.some((e) => e.type === 'shot')).toBe(true);
    expect(events.some((e) => e.type === 'destroyed' && e.entityId === enemy.id)).toBe(true);
  });

  it('reduces damage by armour with a minimum of one point', () => {
    const sim = createTestSim();
    const soldier = sim.world.spawn('soldier', 1, 5.5, 5.5);
    const tank = sim.world.spawn('tank', 2, 8.5, 5.5);
    tank.order = { type: 'move', x: 8.5, y: 5.5 }; // keep the tank from shooting back
    runSeconds(sim, 0.25);
    applyCommand(sim.world, { type: 'attack', playerId: 1, unitIds: [soldier.id], targetId: tank.id });
    runSeconds(sim, 0.1);
    expect(tank.hp).toBe(200 - (10 - 5));
  });

  it('automatically engages enemies that come into range when idle', () => {
    const sim = createTestSim();
    const soldier = sim.world.spawn('soldier', 1, 5.5, 5.5);
    const enemy = sim.world.spawn('scout', 2, 8.5, 5.5);
    runSeconds(sim, 1);
    expect(enemy.hp).toBeLessThan(30);
    expect(soldier.order.type).toBe('idle');
  });
});

describe('turret detection', () => {
  it('cannot engage targets beyond the owner’s sensor coverage', () => {
    const sim = createTestSim();
    const turret = sim.world.spawn('longTurret', 1, 5.5, 5.5);
    const enemy = sim.world.spawn('scout', 2, 13.5, 5.5);
    enemy.order = { type: 'move', x: 13.5, y: 5.5 };
    runSeconds(sim, 2);
    expect(enemy.hp).toBe(30);
    sim.world.spawn('drone', 1, 12.5, 7.5); // reconnaissance extends the turret's reach
    runSeconds(sim, 2);
    expect(enemy.hp).toBeLessThan(30);
    expect(turret.order.type).toBe('idle');
  });

  it('only fires at domains its weapon can target', () => {
    const sim = createTestSim();
    sim.world.spawn('aaTurret', 1, 5.5, 5.5);
    const ground = sim.world.spawn('scout', 2, 8.5, 5.5);
    const air = sim.world.spawn('drone', 2, 7.5, 7.5);
    ground.order = { type: 'move', x: 8.5, y: 5.5 };
    air.order = { type: 'move', x: 7.5, y: 7.5 };
    runSeconds(sim, 2);
    expect(ground.hp).toBe(30);
    expect(air.hp).toBeLessThan(30);
  });
});
