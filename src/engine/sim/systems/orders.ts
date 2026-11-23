import type { Entity } from '../types';
import type { World } from '../world';
import { autoEngage, coolDown, updateAttackOrder } from './combat';
import { updateBuildOrder, updateRepairOrder } from './construction';
import { findDepositNear, updateExtractOrder, updateHarvestOrder, updateHaulOrder, updateRefining } from './economy';
import { followPath } from './movement';

/** Idle time (ticks) before automated gatherers look for work. */
const AUTO_GATHER_DELAY = 20;
const AUTO_GATHER_RADIUS = 25;

/** Advances one entity by one tick according to its current order. */
export function updateEntity(world: World, entity: Entity, dt: number): void {
  coolDown(entity, dt);
  if (entity.built < 1) return;
  entity.idleTicks = entity.order.type === 'idle' ? entity.idleTicks + 1 : 0;
  executeOrder(world, entity, dt);
  if (entity.order.type !== 'attack') autoEngage(world, entity);
  updateRefining(world, entity, dt);
}

function executeOrder(world: World, entity: Entity, dt: number): void {
  const order = entity.order;
  switch (order.type) {
    case 'idle':
      updateIdle(world, entity, dt);
      break;
    case 'move':
      if (followPath(world, entity, dt)) entity.order = { type: 'idle' };
      break;
    case 'attack':
      updateAttackOrder(world, entity, order.targetId, dt);
      break;
    case 'harvest':
      updateHarvestOrder(world, entity, order.depositId, order.phase, dt);
      break;
    case 'build':
      updateBuildOrder(world, entity, order.structureId, dt);
      break;
    case 'repair':
      updateRepairOrder(world, entity, order.targetId, dt);
      break;
    case 'extract':
      updateExtractOrder(world, entity, order.depositId, dt);
      break;
    case 'haul':
      updateHaulOrder(world, entity, order.sourceId, order.phase, dt);
      break;
  }
}

function updateIdle(world: World, entity: Entity, dt: number): void {
  if (entity.path.length > 0) followPath(world, entity, dt);
  const harvest = world.def(entity.typeId).harvest;
  if (!harvest?.autoGather || entity.idleTicks < AUTO_GATHER_DELAY) return;
  entity.idleTicks = 0;
  const deposit = findDepositNear(world, entity, harvest.kinds, AUTO_GATHER_RADIUS);
  if (deposit) entity.order = { type: 'harvest', depositId: deposit.id, phase: 'toDeposit' };
}
