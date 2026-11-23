import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/sim/commands';
import { createTestSim, observe, runSeconds } from './fixtures';

describe('harvesting', () => {
  it('gathers from a deposit and delivers cargo to the stockpile', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 8.5, 5.5);
    const deposit = sim.world.addDeposit({ kind: 'crystal', x: 14.5, y: 5.5, amount: 100 });
    observe(sim);
    applyCommand(sim.world, { type: 'harvest', playerId: 1, unitIds: [harvester.id], depositId: deposit.id });
    runSeconds(sim, 15);
    const stock = sim.world.player(1).stockpile.crystal;
    expect(stock).toBeGreaterThanOrEqual(10);
    expect(stock % 10).toBe(0);
    expect(deposit.amount).toBeLessThanOrEqual(100 - stock);
    expect(sim.drainEvents().some((e) => e.type === 'delivered' && e.kind === 'crystal')).toBe(true);
  });

  it('moves on to a nearby deposit of the same kind when one is exhausted', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 8.5, 5.5);
    const first = sim.world.addDeposit({ kind: 'crystal', x: 12.5, y: 5.5, amount: 10 });
    const second = sim.world.addDeposit({ kind: 'crystal', x: 13.5, y: 7.5, amount: 100 });
    observe(sim);
    applyCommand(sim.world, { type: 'harvest', playerId: 1, unitIds: [harvester.id], depositId: first.id });
    runSeconds(sim, 25);
    expect(sim.world.deposit(first.id)).toBeUndefined();
    expect(second.amount).toBeLessThan(100);
  });

  it('starts automated gathering for idle collection drones', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    sim.world.spawn('collector', 1, 8.5, 8.5);
    sim.world.addDeposit({ kind: 'crystal', x: 12.5, y: 8.5, amount: 100 });
    runSeconds(sim, 15);
    expect(sim.world.player(1).stockpile.crystal).toBeGreaterThan(0);
  });

  it('recovers salvage from wreckage', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    const salvager = sim.world.spawn('salvager', 1, 8.5, 5.5);
    const wreck = sim.world.addDeposit({ kind: 'salvage', x: 12.5, y: 5.5, amount: 10 });
    observe(sim);
    applyCommand(sim.world, { type: 'harvest', playerId: 1, unitIds: [salvager.id], depositId: wreck.id });
    runSeconds(sim, 15);
    expect(sim.world.player(1).stockpile.salvage).toBe(10);
  });
});

describe('underground deposits', () => {
  it('cannot be drilled until a prospector reveals them', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    const drill = sim.world.spawn('drill', 1, 8.5, 5.5);
    const ore = sim.world.addDeposit({ kind: 'ore', x: 20.5, y: 5.5, amount: 100, hidden: true });
    const command = { type: 'harvest', playerId: 1, unitIds: [drill.id], depositId: ore.id } as const;
    expect(applyCommand(sim.world, command).rejected).toEqual([{ id: drill.id, reason: 'invalid-target' }]);

    sim.world.spawn('prospector', 1, 17.5, 5.5);
    runSeconds(sim, 0.5);
    expect(ore.revealedTo).toEqual([1]);
    expect(sim.drainEvents().some((e) => e.type === 'depositRevealed')).toBe(true);
    expect(applyCommand(sim.world, command).accepted).toEqual([drill.id]);
    runSeconds(sim, 30);
    expect(sim.world.player(1).stockpile.ore).toBeGreaterThan(0);
  });
});

describe('logistics', () => {
  it('refines deliveries at a mobile refinery and hauls the output to the stockpile', () => {
    const sim = createTestSim();
    sim.world.spawn('hq', 1, 5.5, 5.5);
    const refinery = sim.world.spawn('refinery', 1, 25.5, 5.5);
    const harvester = sim.world.spawn('harvester', 1, 27.5, 5.5);
    const transport = sim.world.spawn('transport', 1, 23.5, 5.5);
    const deposit = sim.world.addDeposit({ kind: 'crystal', x: 29.5, y: 5.5, amount: 100 });
    observe(sim);
    applyCommand(sim.world, { type: 'harvest', playerId: 1, unitIds: [harvester.id], depositId: deposit.id });
    applyCommand(sim.world, { type: 'haul', playerId: 1, unitIds: [transport.id], targetId: refinery.id });
    runSeconds(sim, 8);
    expect(sim.world.player(1).stockpile.crystal).toBe(0);
    expect((refinery.refinedStock.crystal ?? 0) + (transport.refinedStock.crystal ?? 0)).toBeGreaterThan(0);
    runSeconds(sim, 40);
    expect(sim.world.player(1).stockpile.crystal).toBeGreaterThan(0);
  });

  it('extracts energy while deployed on an energy source', () => {
    const sim = createTestSim();
    const extractor = sim.world.spawn('extractor', 1, 8.5, 5.5);
    const vent = sim.world.addDeposit({ kind: 'energy', x: 11.5, y: 5.5, amount: 1000 });
    observe(sim);
    applyCommand(sim.world, { type: 'extract', playerId: 1, unitIds: [extractor.id], depositId: vent.id });
    runSeconds(sim, 12);
    const energy = sim.world.player(1).stockpile.energy;
    expect(energy).toBeGreaterThan(10);
    expect(vent.amount).toBeCloseTo(1000 - energy, 5);
  });
});
