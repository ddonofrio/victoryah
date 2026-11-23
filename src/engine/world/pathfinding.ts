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

interface SearchState {
  readonly gScore: Map<number, number>;
  readonly cameFrom: Map<number, number>;
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
  const key = (x: number, y: number): number => y * width + x;
  const start = key(from.x, from.y);
  const goal = key(to.x, to.y);
  const state: SearchState = {
    gScore: new Map([[start, 0]]),
    cameFrom: new Map(),
    bestNode: start,
    bestHeuristic: octile(from.x, from.y, to.x, to.y),
  };
  const open = new BinaryHeap<number>();
  open.push(start, state.bestHeuristic);
  const closed = new Set<number>();
  const maxExpanded = options.maxExpanded ?? 40_000;

  while (open.size > 0 && closed.size < maxExpanded) {
    const current = open.pop()!;
    if (current === goal) return { path: reconstruct(state.cameFrom, current, width), reachedGoal: true };
    if (closed.has(current)) continue;
    closed.add(current);
    expand(grid, current, to, state, open, closed);
  }
  return { path: reconstruct(state.cameFrom, state.bestNode, width), reachedGoal: state.bestNode === goal };
}

function expand(
  grid: WalkabilityGrid,
  current: number,
  to: TilePoint,
  state: SearchState,
  open: BinaryHeap<number>,
  closed: Set<number>,
): void {
  const width = grid.width;
  const cx = current % width;
  const cy = Math.floor(current / width);
  const baseCost = state.gScore.get(current)!;
  for (const [dx, dy, cost] of NEIGHBOURS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!grid.isWalkable(nx, ny)) continue;
    if (dx !== 0 && dy !== 0 && (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))) continue;
    const neighbour = ny * width + nx;
    if (closed.has(neighbour)) continue;
    const tentative = baseCost + cost;
    if (tentative >= (state.gScore.get(neighbour) ?? Infinity)) continue;
    state.gScore.set(neighbour, tentative);
    state.cameFrom.set(neighbour, current);
    const h = octile(nx, ny, to.x, to.y);
    if (h < state.bestHeuristic) {
      state.bestHeuristic = h;
      state.bestNode = neighbour;
    }
    open.push(neighbour, tentative + h);
  }
}

function reconstruct(cameFrom: Map<number, number>, end: number, width: number): TilePoint[] {
  const path: TilePoint[] = [];
  let node: number | undefined = end;
  while (node !== undefined) {
    path.push({ x: node % width, y: Math.floor(node / width) });
    node = cameFrom.get(node);
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
