import { describe, expect, it } from 'vitest';
import { nearestTileInRegion, RegionMap } from '../../src/engine/world/connectivity';
import { gridFrom } from './fixtures';

describe('RegionMap', () => {
  it('gives mutually reachable tiles the same label and blocked tiles label 0', () => {
    const regions = new RegionMap(gridFrom(['..#..', '..#..', '..#..']));
    expect(regions.labelAt(0, 0)).toBeGreaterThan(0);
    expect(regions.labelAt(1, 2)).toBe(regions.labelAt(0, 0));
    expect(regions.labelAt(3, 0)).toBeGreaterThan(0);
    expect(regions.labelAt(3, 0)).not.toBe(regions.labelAt(0, 0));
    expect(regions.labelAt(2, 1)).toBe(0);
  });

  it('does not connect areas that only touch diagonally, matching the pathfinder', () => {
    const regions = new RegionMap(gridFrom(['.#', '#.']));
    expect(regions.labelAt(0, 0)).not.toBe(regions.labelAt(1, 1));
  });

  it('reports tiles outside the grid as blocked', () => {
    const regions = new RegionMap(gridFrom(['..', '..']));
    expect(regions.labelAt(-1, 0)).toBe(0);
    expect(regions.labelAt(0, 2)).toBe(0);
  });

  it('records the size of every region', () => {
    const regions = new RegionMap(gridFrom(['..#.', '..#.']));
    expect(regions.sizeOf(regions.labelAt(0, 0))).toBe(4);
    expect(regions.sizeOf(regions.labelAt(3, 0))).toBe(2);
    expect(regions.sizeOf(0)).toBe(0);
  });
});

describe('nearestTileInRegion', () => {
  const walled = new RegionMap(gridFrom(['.....', '.###.', '.#.#.', '.###.', '.....']));
  const outside = walled.labelAt(0, 0);

  it('returns the goal itself when it belongs to the region', () => {
    expect(nearestTileInRegion(walled, outside, { x: 4, y: 4 }, { x: 0, y: 0 }, 8)).toEqual({ x: 4, y: 4 });
  });

  it('prefers, among equally close tiles, the one nearest to the traveller', () => {
    expect(nearestTileInRegion(walled, outside, { x: 2, y: 2 }, { x: 0, y: 2 }, 8)).toEqual({ x: 0, y: 2 });
    expect(nearestTileInRegion(walled, outside, { x: 2, y: 2 }, { x: 2, y: 4 }, 8)).toEqual({ x: 2, y: 4 });
  });

  it('returns null when the region has no tile within the search radius', () => {
    expect(nearestTileInRegion(walled, outside, { x: 2, y: 2 }, { x: 0, y: 0 }, 1)).toBeNull();
  });
});
