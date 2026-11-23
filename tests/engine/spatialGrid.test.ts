import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../../src/engine/world/spatialGrid';

describe('SpatialGrid', () => {
  it('returns only entries inside the query radius, sorted by id', () => {
    const grid = new SpatialGrid(8);
    grid.insert(3, 10, 10);
    grid.insert(1, 12, 10);
    grid.insert(2, 40, 40);
    expect(grid.queryRadius(10, 10, 3)).toEqual([1, 3]);
    expect(grid.queryRadius(40, 40, 0.5)).toEqual([2]);
  });

  it('includes entries exactly on the radius boundary', () => {
    const grid = new SpatialGrid(4);
    grid.insert(1, 5, 0);
    expect(grid.queryRadius(0, 0, 5)).toEqual([1]);
  });

  it('tracks moves across cells and removals', () => {
    const grid = new SpatialGrid(8);
    grid.insert(1, 1, 1);
    grid.move(1, 30, 30);
    expect(grid.queryRadius(1, 1, 2)).toEqual([]);
    expect(grid.queryRadius(30, 30, 1)).toEqual([1]);
    grid.remove(1);
    expect(grid.queryRadius(30, 30, 1)).toEqual([]);
    expect(grid.size).toBe(0);
  });

  it('handles negative coordinates', () => {
    const grid = new SpatialGrid(8);
    grid.insert(9, -5, -5);
    expect(grid.queryRadius(-4, -4, 2)).toEqual([9]);
  });
});
