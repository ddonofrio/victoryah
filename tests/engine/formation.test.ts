import { describe, expect, it } from 'vitest';
import { assignGroupDestinations } from '../../src/engine/sim/formation';
import { gridFrom, openGrid } from './fixtures';

const key = (p: { x: number; y: number }) => `${Math.floor(p.x)},${Math.floor(p.y)}`;

describe('assignGroupDestinations', () => {
  it('sends a single unit to the exact requested point', () => {
    const result = assignGroupDestinations(openGrid(), [{ id: 1, x: 2, y: 2 }], { x: 10.3, y: 7.8 });
    expect(result.get(1)).toEqual({ x: 10.3, y: 7.8 });
  });

  it('gives each unit of a group a distinct walkable tile near the target', () => {
    const grid = openGrid(40);
    const units = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, x: 2 + (i % 4), y: 2 + Math.floor(i / 4) }));
    const result = assignGroupDestinations(grid, units, { x: 20.5, y: 20.5 });
    const tiles = new Set([...result.values()].map(key));
    expect(tiles.size).toBe(12);
    for (const p of result.values()) {
      expect(grid.isWalkable(Math.floor(p.x), Math.floor(p.y))).toBe(true);
      expect(Math.hypot(p.x - 20.5, p.y - 20.5)).toBeLessThan(4);
    }
  });

  it('avoids obstacles around the target', () => {
    const grid = gridFrom(['..........', '..........', '...####...', '...####...', '..........', '..........']);
    const units = [1, 2, 3, 4].map((id) => ({ id, x: 0.5, y: 0.5 }));
    const result = assignGroupDestinations(grid, units, { x: 4.5, y: 2.5 });
    for (const p of result.values()) expect(grid.isWalkable(Math.floor(p.x), Math.floor(p.y))).toBe(true);
  });
});
