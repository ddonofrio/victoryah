import type { TilePoint, WalkabilityGrid } from './pathfinding';

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Connected walkable areas of a grid. Two tiles can reach each other exactly when their labels
 * are equal, which answers reachability in constant time instead of with a failed path search.
 *
 * Areas are joined through orthogonal neighbours only. That matches the pathfinder: its diagonal
 * steps may not cut corners, so they never connect tiles that orthogonal steps do not.
 */
export class RegionMap implements RegionSource {
  private readonly width: number;
  private readonly height: number;
  private readonly labels: Int32Array;
  /** Tile count per label; index 0 (blocked) stays 0. */
  private readonly sizes: number[] = [0];

  constructor(grid: WalkabilityGrid) {
    this.width = grid.width;
    this.height = grid.height;
    this.labels = new Int32Array(this.width * this.height);
    const stack = new Int32Array(this.width * this.height);
    for (let i = 0; i < this.labels.length; i++) {
      if (this.labels[i] !== 0 || !grid.isWalkable(i % this.width, Math.floor(i / this.width))) continue;
      this.sizes.push(this.flood(grid, i, this.sizes.length, stack));
    }
  }

  /** Number of regions; labels run from 1 to `count`. */
  get count(): number {
    return this.sizes.length - 1;
  }

  /** Label of the region containing a tile; 0 for blocked tiles and tiles outside the grid. */
  labelAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.labels[y * this.width + x]!;
  }

  regionAt(x: number, y: number): number {
    return this.labelAt(x, y);
  }

  sizeOf(label: number): number {
    return this.sizes[label] ?? 0;
  }

  private flood(grid: WalkabilityGrid, start: number, label: number, stack: Int32Array): number {
    let top = 0;
    let size = 0;
    stack[top++] = start;
    this.labels[start] = label;
    while (top > 0) {
      const i = stack[--top]!;
      size++;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      for (const [dx, dy] of ORTHOGONAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
        const ni = ny * this.width + nx;
        if (this.labels[ni] !== 0 || !grid.isWalkable(nx, ny)) continue;
        this.labels[ni] = label;
        stack[top++] = ni;
      }
    }
    return size;
  }
}

/** Anything that can report the region of a tile (a RegionMap, or a World that keeps one current). */
export interface RegionSource {
  regionAt(x: number, y: number): number;
}

/**
 * The tile of a region that lies closest to `goal`, searching square rings of growing radius up
 * to `maxRadius`. Ties go to the tile nearest to `from`, so units approach from their own side.
 * Returns null when the region has no tile within the search radius.
 */
export function nearestTileInRegion(
  regions: RegionSource,
  region: number,
  goal: TilePoint,
  from: TilePoint,
  maxRadius: number,
): TilePoint | null {
  let best: TilePoint | null = null;
  let bestGoal = Infinity;
  let bestFrom = Infinity;
  // A ring of radius r only holds tiles at distance >= r, so the search can stop once r passes the best.
  for (let r = 0; r <= maxRadius && r <= bestGoal; r++) {
    for (let y = goal.y - r; y <= goal.y + r; y++) {
      const step = Math.abs(y - goal.y) === r ? 1 : 2 * r;
      for (let x = goal.x - r; x <= goal.x + r; x += Math.max(1, step)) {
        if (regions.regionAt(x, y) !== region) continue;
        const toGoal = Math.hypot(x - goal.x, y - goal.y);
        const toFrom = Math.hypot(x - from.x, y - from.y);
        if (toGoal > bestGoal + 1e-9 || (toGoal > bestGoal - 1e-9 && toFrom >= bestFrom)) continue;
        best = { x, y };
        bestGoal = toGoal;
        bestFrom = toFrom;
      }
    }
  }
  return best;
}
