import { describe, expect, it } from 'vitest';
import { sharedActions } from '../../src/engine/sim/capabilities';
import { testRuleset } from './fixtures';

const defs = testRuleset().units;
const def = (id: string) => defs.get(id)!;

describe('sharedActions', () => {
  it('lists every action of a single selected unit in canonical order', () => {
    expect(sharedActions([def('soldier')])).toEqual(['move', 'attack', 'stop']);
    expect(sharedActions([def('harvester')])).toEqual(['move', 'harvest', 'stop']);
    expect(sharedActions([def('engineer')])).toEqual(['move', 'build', 'repair', 'stop']);
  });

  it('exposes only the actions every selected unit supports', () => {
    expect(sharedActions([def('soldier'), def('harvester')])).toEqual(['move', 'stop']);
    expect(sharedActions([def('turret'), def('tank')])).toEqual(['attack', 'stop']);
    expect(sharedActions([def('turret'), def('harvester')])).toEqual(['stop']);
  });

  it('is unaffected by duplicates and returns nothing for an empty selection', () => {
    expect(sharedActions([def('soldier'), def('soldier'), def('tank')])).toEqual(['move', 'attack', 'stop']);
    expect(sharedActions([])).toEqual([]);
  });
});
