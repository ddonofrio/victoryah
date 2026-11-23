import type { WalkabilityGrid } from '../world/pathfinding';
import type { Point } from './types';

export interface FormationMember {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Assigns each unit of a group its own destination around the clicked point so units do not
 * pile onto one tile. Slots are walkable tile centres ordered by distance from the target; each
 * unit (in id order, for determinism) takes the nearest free slot to its current position.
 */
export function assignGroupDestinations(
  grid: WalkabilityGrid,
  members: readonly FormationMember[],
  target: Point,
): Map<number, Point> {
  const result = new Map<number, Point>();
  if (members.length === 1) {
    result.set(members[0]!.id, { x: target.x, y: target.y });
    return result;
  }
  const slots = collectSlots(grid, target, members.length);
  const sorted = [...members].sort((a, b) => a.id - b.id);
  for (const member of sorted) {
    let best = 0;
    let bestScore = Infinity;
    slots.forEach((slot, i) => {
      // Prefer slots close to the target first, then close to the unit (keeps groups compact).
      const score =
        Math.hypot(slot.x - target.x, slot.y - target.y) * 2 + Math.hypot(slot.x - member.x, slot.y - member.y) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    const slot = slots.splice(best, 1)[0];
    result.set(member.id, slot ?? { x: target.x, y: target.y });
  }
  return result;
}

function collectSlots(grid: WalkabilityGrid, target: Point, count: number): Point[] {
  const cx = Math.floor(target.x);
  const cy = Math.floor(target.y);
  const slots: Point[] = [];
  for (let radius = 0; slots.length < count && radius < 32; radius++) {
    const ring: Point[] = [];
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
        if (grid.isWalkable(x, y)) ring.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    ring.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
    slots.push(...ring);
  }
  return slots.slice(0, Math.max(count, slots.length));
}
