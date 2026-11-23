import type { Point } from '../sim/types';
import type { Terrain } from './terrain';

/** Mask of the largest connected walkable region: the planet's main landmass. */
export function largestRegionMask(terrain: Terrain): Uint8Array {
  const labels = new Int32Array(terrain.width * terrain.height);
  let bestLabel = 0;
  let bestSize = 0;
  let label = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] || !terrain.isWalkable(i % terrain.width, Math.floor(i / terrain.width))) continue;
    label++;
    const size = floodLabel(terrain, labels, i, label);
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  }
  return Uint8Array.from(labels, (l) => (l === bestLabel && l !== 0 ? 1 : 0));
}

function floodLabel(terrain: Terrain, labels: Int32Array, start: number, label: number): number {
  const { width, height } = terrain;
  const stack = [start];
  labels[start] = label;
  let size = 0;
  while (stack.length > 0) {
    const i = stack.pop()!;
    size++;
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const ni = ny * width + nx;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || labels[ni] || !terrain.isWalkable(nx, ny)) continue;
      labels[ni] = label;
      stack.push(ni);
    }
  }
  return size;
}

/** Iterates tiles in square rings of increasing radius around a centre. */
export function* spiral(cx: number, cy: number, maxRadius: number, minRadius = 0): Generator<Point> {
  for (let r = minRadius; r <= maxRadius; r++) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r) yield { x, y };
      }
    }
  }
}

function isClearSquare(terrain: Terrain, cx: number, cy: number, half: number, mask?: Uint8Array): boolean {
  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (!terrain.isWalkable(x, y)) return false;
      if (mask && !mask[y * terrain.width + x]) return false;
    }
  }
  return true;
}

/** Finds the open site closest to a desired location with a clear square of `half` tiles around it. */
export function findOpenSite(terrain: Terrain, desired: Point, half: number, mask?: Uint8Array): Point {
  for (const p of spiral(Math.floor(desired.x), Math.floor(desired.y), 120)) {
    if (isClearSquare(terrain, p.x, p.y, half, mask)) return p;
  }
  throw new Error('No open site found for a base');
}

/** Allocates distinct free tiles around a centre, marking them as taken. */
export class TileAllocator {
  private readonly taken = new Set<number>();

  constructor(
    private readonly terrain: Terrain,
    private readonly mask: Uint8Array,
  ) {}

  reserveSquare(cx: number, cy: number, half: number): void {
    for (let y = cy - half; y <= cy + half; y++) {
      for (let x = cx - half; x <= cx + half; x++) this.taken.add(y * this.terrain.width + x);
    }
  }

  isFree(x: number, y: number): boolean {
    const i = y * this.terrain.width + x;
    return this.terrain.isWalkable(x, y) && this.mask[i] === 1 && !this.taken.has(i);
  }

  /** Takes the next free tile around the centre at or beyond `minRadius`; returns its centre. */
  take(center: Point, minRadius = 0): Point {
    for (const p of spiral(Math.floor(center.x), Math.floor(center.y), 60, minRadius)) {
      if (!this.isFree(p.x, p.y)) continue;
      this.taken.add(p.y * this.terrain.width + p.x);
      return { x: p.x + 0.5, y: p.y + 0.5 };
    }
    throw new Error('No free tile available');
  }
}
