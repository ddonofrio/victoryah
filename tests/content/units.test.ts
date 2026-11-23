import { describe, expect, it } from 'vitest';
import { UNIT_DEFINITIONS, VICTORYAH_RULESET } from '../../src/content/units';

const byId = (id: string) => VICTORYAH_RULESET.units.get(id)!;

describe('unit roster', () => {
  it('contains the military, defensive and logistics roster of the first milestone', () => {
    const expected = [
      'scout',
      'infantry',
      'lightArmoredVehicle',
      'heavyTank',
      'siegeUnit',
      'surveillanceDrone',
      'militaryEngineer',
      'automaticTurret',
      'longRangeTurret',
      'antiAirTurret',
      'prospector',
      'harvester',
      'drillingUnit',
      'collectionDrone',
      'transportVehicle',
      'mobileRefinery',
      'salvageUnit',
      'mobileEnergyExtractor',
      'commandCenter',
    ];
    expect(UNIT_DEFINITIONS.map((d) => d.id).sort()).toEqual([...expected].sort());
  });

  it('represents turrets as a distinct family of immobile defensive structures', () => {
    for (const id of ['automaticTurret', 'longRangeTurret', 'antiAirTurret']) {
      const def = byId(id);
      expect(def.category).toBe('turret');
      expect(def.domain).toBe('structure');
      expect(def.speed).toBe(0);
      expect(def.capabilities).not.toContain('move');
      expect(def.cost).toBeDefined();
    }
    expect(byId('antiAirTurret').weapon!.targets).toEqual(['air']);
    expect(byId('longRangeTurret').weapon!.range).toBeGreaterThan(byId('longRangeTurret').sightRange);
  });
});

describe('unit roles', () => {
  it('gives each unit its essential role', () => {
    expect(byId('scout').sightRange).toBeGreaterThan(byId('infantry').sightRange);
    expect(byId('lightArmoredVehicle').speed).toBeGreaterThan(byId('heavyTank').speed);
    expect(byId('heavyTank').armor).toBeGreaterThan(byId('lightArmoredVehicle').armor);
    expect(byId('siegeUnit').weapon!.structureMultiplier).toBeGreaterThan(1);
    expect(byId('surveillanceDrone').domain).toBe('air');
    expect(byId('militaryEngineer').builder!.structures).toEqual([
      'automaticTurret',
      'longRangeTurret',
      'antiAirTurret',
    ]);
    expect(byId('prospector').prospectRange).toBeGreaterThan(0);
    expect(byId('harvester').harvest!.kinds).toEqual(['crystal']);
    expect(byId('drillingUnit').harvest!.kinds).toEqual(['ore']);
    expect(byId('collectionDrone').harvest!.autoGather).toBe(true);
    expect(byId('salvageUnit').harvest!.kinds).toEqual(['salvage']);
    expect(byId('mobileRefinery').dropOff).toBe('refinery');
    expect(byId('transportVehicle').haulCapacity).toBeGreaterThan(0);
    expect(byId('mobileEnergyExtractor').extractRate).toBeGreaterThan(0);
    expect(byId('commandCenter').dropOff).toBe('stockpile');
  });
});

describe('definition consistency', () => {
  it('declares exactly the capabilities each unit can execute', () => {
    for (const def of UNIT_DEFINITIONS) {
      const has = (c: string) => (def.capabilities as readonly string[]).includes(c);
      expect(has('attack'), def.id).toBe(!!def.weapon);
      expect(has('harvest'), def.id).toBe(!!def.harvest);
      expect(has('build'), def.id).toBe(!!def.builder);
      expect(has('repair'), def.id).toBe(!!def.repairRate);
      expect(has('extract'), def.id).toBe(!!def.extractRate);
      expect(has('haul'), def.id).toBe(!!def.haulCapacity);
      expect(has('move'), def.id).toBe(def.speed > 0);
      expect(def.maxHp, def.id).toBeGreaterThan(0);
    }
  });

  it('only lets engineers build structures that exist and have a cost', () => {
    for (const id of byId('militaryEngineer').builder!.structures) {
      expect(byId(id).cost).toBeDefined();
      expect(byId(id).footprint).toBe(1);
    }
  });
});
