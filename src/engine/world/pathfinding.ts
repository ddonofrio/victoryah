import { BinaryHeap } from './binaryHeap';

export interface TilePoint {
  readonly x: number;
  readonly y: number;
}

/** The only terrain contract the pathfinder needs; keeps it independent of terrain generation. */
export interface WalkabilityGrid {
  readonly width: number;
  readonly height: number;
  isWalkable(x: number, y: number): boolean;
}

export interface PathOptions {
  /** Maximum number of expanded nodes before returning the best partial path. */
  readonly maxExpanded?: number;
}

export interface PathResult {
  readonly path: TilePoint[];
  readonly reachedGoal: boolean;
}

const SQRT2 = Math.SQRT2;
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/** Per-search bookkeeping in flat arrays indexed by tile (y * width + x), far cheaper than hash maps. */
interface SearchState {
  readonly gScore: Float64Array;
  /** Previous tile on the best known route, or -1. */
  readonly cameFrom: Int32Array;
  readonly closed: Uint8Array;
  bestNode: number;
  bestHeuristic: number;
}

/**
 * A* over an 8-connected tile grid. Diagonal moves may not cut obstacle corners. When the goal
 * is blocked or unreachable, the path ends at the explored tile closest to the goal, which gives
 * natural "move as close as possible" behaviour for RTS orders.
 */
export function findPath(grid: WalkabilityGrid, from: TilePoint, to: TilePoint, options: PathOptions = {}): PathResult {
  const width = grid.width;
  const size = width * grid.height;
  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  const state: SearchState = {
    gScore: new Float64Array(size).fill(Infinity),
    cameFrom: new Int32Array(size).fill(-1),
    closed: new Uint8Array(size),
    bestNode: start,
    bestHeuristic: octile(from.x, from.y, to.x, to.y),
  };
  state.gScore[start] = 0;
  const open = new BinaryHeap<number>();
  open.push(start, state.bestHeuristic);
  const maxExpanded = options.maxExpanded ?? 40_000;

  for (let expanded = 0; open.size > 0 && expanded < maxExpanded;) {
    const current = open.pop()!;
    if (current === goal) return { path: reconstruct(state.cameFrom, current, width), reachedGoal: true };
    if (state.closed[current]) continue;
    state.closed[current] = 1;
    expanded++;
    expand(grid, current, to, state, open);
  }
  return { path: reconstruct(state.cameFrom, state.bestNode, width), reachedGoal: state.bestNode === goal };
}

function expand(
  grid: WalkabilityGrid,
  current: number,
  to: TilePoint,
  state: SearchState,
  open: BinaryHeap<number>,
): void {
  const width = grid.width;
  const cx = current % width;
  const cy = Math.floor(current / width);
  const baseCost = state.gScore[current]!;
  for (const [dx, dy, cost] of NEIGHBOURS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!grid.isWalkable(nx, ny)) continue;
    if (dx !== 0 && dy !== 0 && (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))) continue;
    const neighbour = ny * width + nx;
    if (state.closed[neighbour]) continue;
    const tentative = baseCost + cost;
    if (tentative >= state.gScore[neighbour]!) continue;
    state.gScore[neighbour] = tentative;
    state.cameFrom[neighbour] = current;
    const h = octile(nx, ny, to.x, to.y);
    if (h < state.bestHeuristic) {
      state.bestHeuristic = h;
      state.bestNode = neighbour;
    }
    open.push(neighbour, tentative + h);
  }
}

function reconstruct(cameFrom: Int32Array, end: number, width: number): TilePoint[] {
  const path: TilePoint[] = [];
  for (let node = end; node >= 0; node = cameFrom[node] ?? -1) {
    path.push({ x: node % width, y: Math.floor(node / width) });
  }
  return path.reverse();
}

/**
 * Conservative tile line of sight between tile centres: samples the segment densely and also
 * checks the orthogonal neighbours at diagonal steps so smoothed paths never clip corners.
 */
export function hasLineOfSight(grid: WalkabilityGrid, a: TilePoint, b: TilePoint): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 3);
  let px = a.x;
  let py = a.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = Math.round(a.x + (b.x - a.x) * t);
    const ty = Math.round(a.y + (b.y - a.y) * t);
    if (tx === px && ty === py) continue;
    if (!grid.isWalkable(tx, ty)) return false;
    if (tx !== px && ty !== py && (!grid.isWalkable(tx, py) || !grid.isWalkable(px, ty))) return false;
    px = tx;
    py = ty;
  }
  return true;
}

/** Removes waypoints that can be skipped with a clear straight line (string pulling). */
export function smoothPath(grid: WalkabilityGrid, path: readonly TilePoint[]): TilePoint[] {
  if (path.length <= 2) return [...path];
  const result: TilePoint[] = [path[0]!];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!hasLineOfSight(grid, path[anchor]!, path[i]!)) {
      result.push(path[i - 1]!);
      anchor = i - 1;
    }
  }
  result.push(path.at(-1)!);
  return result;
}
