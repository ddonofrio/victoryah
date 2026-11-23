import type { UnitTypeDefinition, WeaponDefinition } from '../definitions';
import { distance } from '../geometry';
import type { Entity } from '../types';
import type { World } from '../world';
import { approach } from './movement';

function canTarget(weapon: WeaponDefinition | undefined, target: UnitTypeDefinition): boolean {
  return !!weapon && weapon.targets.includes(target.domain);
}

/** A target is engageable when it is hostile, targetable, alive and seen by the attacker's owner. */
export function isEngageable(world: World, attacker: Entity, target: Entity): boolean {
  if (target.owner === attacker.owner) return false;
  if (!canTarget(world.def(attacker.typeId).weapon, world.def(target.typeId))) return false;
  return world.visibility(attacker.owner).isVisible(target.x, target.y);
}

function inWeaponRange(world: World, attacker: Entity, target: Entity): boolean {
  const weapon = world.def(attacker.typeId).weapon!;
  return distance(attacker, target) - world.def(target.typeId).radius <= weapon.range;
}

/** Executes an explicit attack order: chase the target until in range, then fire. */
export function updateAttackOrder(world: World, entity: Entity, targetId: number, dt: number): void {
  const target = world.entity(targetId);
  if (!target || !isEngageable(world, entity, target)) {
    entity.order = { type: 'idle' };
    entity.path = [];
    return;
  }
  const def = world.def(entity.typeId);
  if (inWeaponRange(world, entity, target)) {
    entity.path = [];
    fireAt(world, entity, target);
    return;
  }
  if (def.speed <= 0) {
    entity.order = { type: 'idle' };
    return;
  }
  const range = def.weapon!.range + world.def(target.typeId).radius - 0.2;
  if (entity.path.length > 0 && world.tick - entity.lastPathTick >= 20) entity.path = [];
  approach(world, entity, target.x, target.y, range, dt);
}

/** Opportunistic fire: armed units not executing an attack order shoot the nearest valid enemy. */
export function autoEngage(world: World, entity: Entity): void {
  const weapon = world.def(entity.typeId).weapon;
  if (!weapon || entity.cooldown > 0 || entity.built < 1) return;
  let best: Entity | undefined;
  let bestDistance = Infinity;
  for (const candidate of world.entitiesNear(entity.x, entity.y, weapon.range + 2)) {
    if (!isEngageable(world, entity, candidate) || !inWeaponRange(world, entity, candidate)) continue;
    const d = distance(entity, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  if (best) fireAt(world, entity, best);
}

function fireAt(world: World, attacker: Entity, target: Entity): void {
  const weapon = world.def(attacker.typeId).weapon;
  if (!weapon || attacker.cooldown > 0 || attacker.built < 1) return;
  attacker.facing = Math.atan2(target.y - attacker.y, target.x - attacker.x);
  attacker.cooldown = weapon.cooldown;
  const targetDef = world.def(target.typeId);
  const multiplier = targetDef.domain === 'structure' ? (weapon.structureMultiplier ?? 1) : 1;
  const damage = Math.max(1, weapon.damage * multiplier - targetDef.armor);
  world.emit({
    type: 'shot',
    sourceId: attacker.id,
    targetId: target.id,
    from: { x: attacker.x, y: attacker.y },
    to: { x: target.x, y: target.y },
    visual: weapon.visual,
  });
  target.hp -= damage;
  if (target.hp <= 0) destroy(world, target);
}

function destroy(world: World, target: Entity): void {
  const def = world.def(target.typeId);
  world.remove(target.id);
  world.emit({
    type: 'destroyed',
    entityId: target.id,
    typeId: target.typeId,
    owner: target.owner,
    at: { x: target.x, y: target.y },
  });
  if (def.salvageValue && def.salvageValue > 0) {
    world.addDeposit({ kind: 'salvage', x: target.x, y: target.y, amount: def.salvageValue });
  }
}

export function coolDown(entity: Entity, dt: number): void {
  if (entity.cooldown > 0) entity.cooldown = Math.max(0, entity.cooldown - dt);
}
