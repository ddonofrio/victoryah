import { describe, expect, it } from 'vitest';
import { findPath, hasLineOfSight, smoothPath, type WalkabilityGrid } from '../../src/engine/world/pathfinding';

function gridFrom(rows: string[]): WalkabilityGrid {
  return {
    width: rows[0]!.length,
    height: rows.length,
    isWalkable: (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0]!.length && rows[y]![x] === '.',
  };
}

const open = (w: number, h: number) => gridFrom(Array.from({ length: h }, () => '.'.repeat(w)));

function assertContinuous(grid: WalkabilityGrid, path: { x: number; y: number }[]) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
    expect(grid.isWalkable(b.x, b.y)).toBe(true);
    if (dx !== 0 && dy !== 0) {
      // No corner cutting: both orthogonal neighbours must be open.
      expect(grid.isWalkable(a.x + dx, a.y)).toBe(true);
      expect(grid.isWalkable(a.x, a.y + dy)).toBe(true);
    }
  }
}

describe('findPath', () => {
  it('returns a single-tile path when start equals goal', () => {
    const result = findPath(open(5, 5), { x: 2, y: 2 }, { x: 2, y: 2 });
    expect(result.path).toEqual([{ x: 2, y: 2 }]);
    expect(result.reachedGoal).toBe(true);
  });

  it('finds an optimal path on open ground', () => {
    const grid = open(20, 20);
    const result = findPath(grid, { x: 0, y: 0 }, { x: 6, y: 3 });
    expect(result.reachedGoal).toBe(true);
    expect(result.path[0]).toEqual({ x: 0, y: 0 });
    expect(result.path.at(-1)).toEqual({ x: 6, y: 3 });
    // Octile distance: 3 diagonal + 3 straight moves.
    expect(result.path).toHaveLength(7);
    assertContinuous(grid, result.path);
  });
});

describe('findPath around obstacles', () => {
  it('routes around obstacles without cutting corners', () => {
    const grid = gridFrom([
      '..........',
      '.....#....',
      '.....#....',
      '.....#....',
      '.....#....',
      '.....#....',
      '..........',
    ]);
    const result = findPath(grid, { x: 2, y: 3 }, { x: 8, y: 3 });
    expect(result.reachedGoal).toBe(true);
    expect(result.path.at(-1)).toEqual({ x: 8, y: 3 });
    assertContinuous(grid, result.path);
  });

  it('stops at the closest reachable tile when the goal is enclosed', () => {
    const grid = gridFrom(['.........', '.....###.', '.....#.#.', '.....###.', '.........']);
    const result = findPath(grid, { x: 0, y: 2 }, { x: 6, y: 2 });
    expect(result.reachedGoal).toBe(false);
    const end = result.path.at(-1)!;
    expect(grid.isWalkable(end.x, end.y)).toBe(true);
    expect(Math.hypot(end.x - 6, end.y - 2)).toBeLessThanOrEqual(2.01);
    assertContinuous(grid, result.path);
  });

  it('approaches a non-walkable goal as closely as possible', () => {
    const grid = gridFrom(['.....', '..#..', '.....']);
    const result = findPath(grid, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(result.reachedGoal).toBe(false);
    expect(result.path.at(-1)).toEqual({ x: 1, y: 1 });
  });

  it('gives up gracefully when the search budget is exhausted', () => {
    const grid = open(200, 200);
    const result = findPath(grid, { x: 0, y: 0 }, { x: 199, y: 199 }, { maxExpanded: 50 });
    expect(result.reachedGoal).toBe(false);
    expect(result.path.length).toBeGreaterThan(0);
    assertContinuous(grid, result.path);
  });
});

describe('line of sight and smoothing', () => {
  it('detects blocked and clear lines', () => {
    const grid = gridFrom(['.....', '..#..', '.....']);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    expect(hasLineOfSight(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);
  });

  it('collapses straight runs into a direct segment', () => {
    const grid = open(20, 20);
    const { path } = findPath(grid, { x: 0, y: 0 }, { x: 10, y: 4 });
    const smooth = smoothPath(grid, path);
    expect(smooth).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 4 },
    ]);
  });

  it('keeps every smoothed segment free of obstacles', () => {
    const grid = gridFrom(['..........', '.....#....', '.....#....', '.....#....', '.....#....', '..........']);
    const { path } = findPath(grid, { x: 2, y: 3 }, { x: 8, y: 3 });
    const smooth = smoothPath(grid, path);
    expect(smooth.length).toBeLessThan(path.length);
    for (let i = 1; i < smooth.length; i++) {
      expect(hasLineOfSight(grid, smooth[i - 1]!, smooth[i]!)).toBe(true);
    }
  });
});
