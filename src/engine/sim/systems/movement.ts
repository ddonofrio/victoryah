import { findPath, smoothPath } from '../../world/pathfinding';
import { clamp, distance } from '../geometry';
import type { Entity } from '../types';
import type { World } from '../world';

/** Minimum ticks between path requests while chasing a moving target. */
const REPATH_INTERVAL = 20;

/**
 * Replaces an entity's path with a route to (tx, ty). Air units fly straight; ground units use
 * A* over terrain and structures, smoothed into straight segments.
 */
export function requestPath(world: World, entity: Entity, tx: number, ty: number): void {
  entity.lastPathTick = world.tick;
  const x = clamp(tx, 0.01, world.width - 0.01);
  const y = clamp(ty, 0.01, world.height - 0.01);
  if (world.def(entity.typeId).domain === 'air') {
    entity.path = [{ x, y }];
    return;
  }
  const from = { x: Math.floor(entity.x), y: Math.floor(entity.y) };
  const goal = { x: Math.floor(x), y: Math.floor(y) };
  const result = findPath(world, from, goal);
  const waypoints = smoothPath(world, result.path).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  if (result.reachedGoal) waypoints[waypoints.length - 1] = { x, y };
  if (waypoints.length > 1 && distance(entity, waypoints[0]!) < 0.3) waypoints.shift();
  entity.path = waypoints;
}

/** Advances an entity along its path. Returns true when the path is complete. */
export function followPath(world: World, entity: Entity, dt: number): boolean {
  let budget = world.def(entity.typeId).speed * dt;
  let x = entity.x;
  let y = entity.y;
  while (budget > 0 && entity.path.length > 0) {
    const waypoint = entity.path[0]!;
    const d = Math.hypot(waypoint.x - x, waypoint.y - y);
    if (d > 1e-9) entity.facing = Math.atan2(waypoint.y - y, waypoint.x - x);
    if (d <= budget) {
      x = waypoint.x;
      y = waypoint.y;
      budget -= d;
      entity.path.shift();
    } else {
      x += ((waypoint.x - x) / d) * budget;
      y += ((waypoint.y - y) / d) * budget;
      budget = 0;
    }
  }
  if (x !== entity.x || y !== entity.y) world.relocate(entity, x, y);
  return entity.path.length === 0;
}

/** Moves toward a point unless already within `range`. Returns true when within range. */
export function approach(world: World, entity: Entity, tx: number, ty: number, range: number, dt: number): boolean {
  if (Math.hypot(tx - entity.x, ty - entity.y) <= range) {
    entity.path = [];
    return true;
  }
  if (entity.path.length === 0 && world.tick - entity.lastPathTick >= REPATH_INTERVAL) {
    requestPath(world, entity, tx, ty);
  }
  followPath(world, entity, dt);
  return Math.hypot(tx - entity.x, ty - entity.y) <= range;
}

/**
 * Pushes overlapping idle ground units apart so groups do not stack on one spot. Pushes are
 * computed first and applied afterwards (order independent) and never enter blocked tiles.
 */
export function separateUnits(world: World): void {
  const pushes = new Map<number, { x: number; y: number }>();
  for (const entity of world.entitiesList()) {
    const def = world.def(entity.typeId);
    if (def.domain !== 'ground' || entity.path.length > 0) continue;
    for (const other of world.entitiesNear(entity.x, entity.y, def.radius * 2 + 0.5)) {
      if (other.id === entity.id) continue;
      const otherDef = world.def(other.typeId);
      if (otherDef.domain !== 'ground') continue;
      accumulatePush(pushes, entity, other, def.radius + otherDef.radius);
    }
  }
  for (const [id, push] of pushes) {
    const entity = world.entity(id)!;
    const nx = entity.x + clamp(push.x, -0.05, 0.05);
    const ny = entity.y + clamp(push.y, -0.05, 0.05);
    if (world.isWalkable(Math.floor(nx), Math.floor(ny))) world.relocate(entity, nx, ny);
  }
}

function accumulatePush(pushes: Map<number, { x: number; y: number }>, a: Entity, b: Entity, minDist: number): void {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let d = Math.hypot(dx, dy);
  if (d >= minDist) return;
  if (d < 1e-6) {
    // Coincident units: separate along a direction derived from ids (deterministic).
    const angle = (a.id * 2.399963) % (Math.PI * 2);
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    d = 1;
  }
  const strength = (minDist - Math.min(d, minDist)) * 0.5;
  const push = pushes.get(a.id) ?? { x: 0, y: 0 };
  push.x += (dx / d) * strength;
  push.y += (dy / d) * strength;
  pushes.set(a.id, push);
}
