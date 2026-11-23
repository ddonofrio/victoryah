import { createRuleset, type UnitTypeDefinition } from '../../src/engine/sim/definitions';
import { Simulation } from '../../src/engine/sim/simulation';
import { updatePerception } from '../../src/engine/sim/systems/perception';
import { World } from '../../src/engine/sim/world';
import type { WalkabilityGrid } from '../../src/engine/world/pathfinding';

/** Balance-independent definitions used by engine tests. */
const base = { armor: 0, radius: 0.4, sightRange: 6 } as const;

export const TEST_UNITS: UnitTypeDefinition[] = [
  {
    ...base,
    id: 'soldier',
    name: 'Soldier',
    category: 'military',
    domain: 'ground',
    maxHp: 50,
    speed: 2,
    capabilities: ['move', 'attack', 'stop'],
    weapon: { damage: 10, range: 4, cooldown: 1, targets: ['ground', 'structure'], visual: 'bullet' },
  },
  {
    ...base,
    id: 'tank',
    name: 'Tank',
    category: 'military',
    domain: 'ground',
    maxHp: 200,
    armor: 5,
    speed: 1,
    capabilities: ['move', 'attack', 'stop'],
    weapon: { damage: 30, range: 5, cooldown: 2, targets: ['ground', 'structure'], visual: 'cannon' },
  },
  {
    ...base,
    id: 'scout',
    name: 'Scout',
    category: 'military',
    domain: 'ground',
    maxHp: 30,
    speed: 4,
    sightRange: 9,
    capabilities: ['move', 'stop'],
  },
  {
    ...base,
    id: 'drone',
    name: 'Drone',
    category: 'military',
    domain: 'air',
    maxHp: 30,
    speed: 3,
    capabilities: ['move', 'stop'],
  },
  {
    ...base,
    id: 'harvester',
    name: 'Harvester',
    category: 'logistics',
    domain: 'ground',
    maxHp: 80,
    speed: 2,
    capabilities: ['move', 'harvest', 'stop'],
    harvest: { kinds: ['crystal'], capacity: 10, rate: 5 },
  },
  {
    ...base,
    id: 'collector',
    name: 'Collector',
    category: 'logistics',
    domain: 'air',
    maxHp: 20,
    speed: 3,
    capabilities: ['move', 'harvest', 'stop'],
    harvest: { kinds: ['crystal'], capacity: 4, rate: 4, autoGather: true },
  },
  {
    ...base,
    id: 'drill',
    name: 'Drill',
    category: 'logistics',
    domain: 'ground',
    maxHp: 80,
    speed: 1.5,
    capabilities: ['move', 'harvest', 'stop'],
    harvest: { kinds: ['ore'], capacity: 10, rate: 5 },
  },
  {
    ...base,
    id: 'salvager',
    name: 'Salvager',
    category: 'logistics',
    domain: 'ground',
    maxHp: 80,
    speed: 2,
    capabilities: ['move', 'harvest', 'stop'],
    harvest: { kinds: ['salvage'], capacity: 10, rate: 5 },
  },
  {
    ...base,
    id: 'prospector',
    name: 'Prospector',
    category: 'logistics',
    domain: 'ground',
    maxHp: 40,
    speed: 3,
    capabilities: ['move', 'stop'],
    prospectRange: 5,
  },
  {
    ...base,
    id: 'refinery',
    name: 'Refinery',
    category: 'logistics',
    domain: 'ground',
    maxHp: 150,
    speed: 1,
    capabilities: ['move', 'stop'],
    dropOff: 'refinery',
    refining: { rate: 10, yield: 1.5 },
  },
  {
    ...base,
    id: 'transport',
    name: 'Transport',
    category: 'logistics',
    domain: 'ground',
    maxHp: 100,
    speed: 3,
    capabilities: ['move', 'haul', 'stop'],
    haulCapacity: 30,
  },
  {
    ...base,
    id: 'extractor',
    name: 'Extractor',
    category: 'logistics',
    domain: 'ground',
    maxHp: 80,
    speed: 1.5,
    capabilities: ['move', 'extract', 'stop'],
    extractRate: 2,
  },
  {
    ...base,
    id: 'engineer',
    name: 'Engineer',
    category: 'military',
    domain: 'ground',
    maxHp: 40,
    speed: 2,
    capabilities: ['move', 'build', 'repair', 'stop'],
    builder: { structures: ['turret'], rate: 50 },
    repairRate: 20,
  },
  {
    ...base,
    id: 'hq',
    name: 'HQ',
    category: 'structure',
    domain: 'structure',
    maxHp: 1000,
    speed: 0,
    radius: 1.4,
    capabilities: [],
    dropOff: 'stockpile',
    footprint: 3,
  },
  {
    ...base,
    id: 'turret',
    name: 'Turret',
    category: 'turret',
    domain: 'structure',
    maxHp: 100,
    speed: 0,
    capabilities: ['attack', 'stop'],
    footprint: 1,
    cost: { crystal: 50, ore: 20 },
    salvageValue: 20,
    weapon: { damage: 10, range: 5, cooldown: 1, targets: ['ground'], visual: 'bullet' },
  },
  {
    ...base,
    id: 'longTurret',
    name: 'Long Turret',
    category: 'turret',
    domain: 'structure',
    maxHp: 100,
    speed: 0,
    sightRange: 4,
    capabilities: ['attack', 'stop'],
    footprint: 1,
    weapon: { damage: 10, range: 10, cooldown: 1, targets: ['ground'], visual: 'artillery' },
  },
  {
    ...base,
    id: 'aaTurret',
    name: 'AA Turret',
    category: 'turret',
    domain: 'structure',
    maxHp: 100,
    speed: 0,
    capabilities: ['attack', 'stop'],
    footprint: 1,
    weapon: { damage: 10, range: 6, cooldown: 1, targets: ['air'], visual: 'flak' },
  },
];

export const testRuleset = () => createRuleset(TEST_UNITS);

export function gridFrom(rows: string[]): WalkabilityGrid {
  return {
    width: rows[0]!.length,
    height: rows.length,
    isWalkable: (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0]!.length && rows[y]![x] === '.',
  };
}

export const openGrid = (size = 48): WalkabilityGrid => gridFrom(Array.from({ length: size }, () => '.'.repeat(size)));

export function createTestSim(surface: WalkabilityGrid = openGrid()): Simulation {
  const world = new World({
    surface,
    ruleset: testRuleset(),
    players: [
      { id: 1, name: 'Blue' },
      { id: 2, name: 'Red' },
    ],
  });
  return new Simulation(world);
}

/** Advances the simulation by a number of seconds of game time. */
export function runSeconds(sim: Simulation, seconds: number): void {
  const ticks = Math.round(seconds * Simulation.TICK_RATE);
  for (let i = 0; i < ticks; i++) sim.step();
}

/**
 * Refreshes every player's vision after units were placed by hand, as the next simulation step
 * would. Commands are validated against what the player has explored.
 */
export function observe(sim: Simulation): void {
  updatePerception(sim.world);
}
