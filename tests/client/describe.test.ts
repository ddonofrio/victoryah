import { describe, expect, it } from 'vitest';
import { describeStatus, formatCost } from '../../src/client/ui/describe';
import { createTestSim } from '../engine/fixtures';

describe('describeStatus', () => {
  it('summarises what a unit is doing', () => {
    const sim = createTestSim();
    const unit = sim.world.spawn('harvester', 1, 5.5, 5.5);
    expect(describeStatus(sim.world, unit)).toBe('Idle');
    unit.order = { type: 'move', x: 1, y: 1 };
    expect(describeStatus(sim.world, unit)).toBe('Moving');
    unit.order = { type: 'harvest', depositId: 1, phase: 'returning' };
    unit.cargo = { kind: 'crystal', amount: 7.6 };
    expect(describeStatus(sim.world, unit)).toBe('Returning cargo · 7/10 crystal');
  });

  it('reports construction progress and refinery stock', () => {
    const sim = createTestSim();
    const turret = sim.world.spawn('turret', 1, 5.5, 5.5, { built: 0.42 });
    expect(describeStatus(sim.world, turret)).toBe('Under construction · 42%');
    const refinery = sim.world.spawn('refinery', 1, 9.5, 5.5);
    refinery.refinedStock = { crystal: 12.4 };
    expect(describeStatus(sim.world, refinery)).toBe('Idle · refined 12 crystal');
  });
});

describe('formatCost', () => {
  it('lists resource amounts', () => {
    expect(formatCost({ crystal: 100, ore: 25 })).toBe('100 crystal · 25 ore');
    expect(formatCost(undefined)).toBe('');
  });
});
