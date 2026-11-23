import type { Entity } from '../types';
import type { World } from '../world';
import { approach } from './movement';

const WORK_RANGE = 1.5;

/** Engineers raise a structure under construction until it is complete. */
export function updateBuildOrder(world: World, entity: Entity, structureId: number, dt: number): void {
  const structure = world.entity(structureId);
  if (!structure || structure.built >= 1 || structure.owner !== entity.owner) {
    entity.order = { type: 'idle' };
    return;
  }
  const def = world.def(structure.typeId);
  if (!approach(world, entity, structure.x, structure.y, def.radius + WORK_RANGE, dt)) return;
  const work = (world.def(entity.typeId).builder?.rate ?? 0) * dt;
  structure.hp = Math.min(def.maxHp, structure.hp + work);
  structure.built = Math.min(1, structure.built + work / def.maxHp);
  if (structure.built >= 1 - 1e-9) {
    structure.built = 1;
    entity.order = { type: 'idle' };
    world.emit({ type: 'constructed', entityId: structure.id, owner: structure.owner });
  }
}

/** Engineers restore hit points of damaged friendly units and structures. */
export function updateRepairOrder(world: World, entity: Entity, targetId: number, dt: number): void {
  const target = world.entity(targetId);
  if (!target || target.owner !== entity.owner) {
    entity.order = { type: 'idle' };
    return;
  }
  const def = world.def(target.typeId);
  if (target.hp >= def.maxHp) {
    entity.order = { type: 'idle' };
    return;
  }
  if (!approach(world, entity, target.x, target.y, def.radius + WORK_RANGE, dt)) return;
  target.hp = Math.min(def.maxHp, target.hp + (world.def(entity.typeId).repairRate ?? 0) * dt);
  if (target.hp >= def.maxHp) entity.order = { type: 'idle' };
}
