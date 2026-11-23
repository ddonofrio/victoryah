import type { LocalCommand } from '../../app/gameSession';
import type { CommandTarget } from '../../engine/sim/commands';
import type { Capability } from '../../engine/sim/definitions';
import type { EntityId, PlayerId, Point } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';

/** Radius, in tiles, within which a click counts as clicking a deposit. */
const DEPOSIT_PICK_RADIUS = 0.8;

/** Describes what the pointer is over: a picked entity, a known deposit, or plain ground. */
export function pointerTarget(world: World, playerId: PlayerId, ground: Point, entityId?: EntityId): CommandTarget {
  if (entityId !== undefined) return { x: ground.x, y: ground.y, entityId };
  let best: number | undefined;
  let bestDistance = DEPOSIT_PICK_RADIUS;
  for (const deposit of world.knownDeposits(playerId)) {
    const d = Math.hypot(deposit.x - ground.x, deposit.y - ground.y);
    if (d <= bestDistance) {
      bestDistance = d;
      best = deposit.id;
    }
  }
  return best === undefined ? { x: ground.x, y: ground.y } : { x: ground.x, y: ground.y, depositId: best };
}

/** Translates an explicitly chosen action plus a target into a command, or null if they do not fit. */
export function commandForAction(
  action: Capability,
  unitIds: readonly EntityId[],
  target: CommandTarget,
  structureType?: string,
): LocalCommand | null {
  const { entityId, depositId } = target;
  switch (action) {
    case 'move':
      return { type: 'move', unitIds, x: target.x, y: target.y };
    case 'stop':
      return { type: 'stop', unitIds };
    case 'attack':
      return entityId === undefined ? null : { type: 'attack', unitIds, targetId: entityId };
    case 'repair':
      return entityId === undefined ? null : { type: 'repair', unitIds, targetId: entityId };
    case 'haul':
      return entityId === undefined ? null : { type: 'haul', unitIds, targetId: entityId };
    case 'harvest':
      return depositId === undefined ? null : { type: 'harvest', unitIds, depositId };
    case 'extract':
      return depositId === undefined ? null : { type: 'extract', unitIds, depositId };
    case 'build':
      return structureType ? { type: 'build', unitIds, structureType, x: target.x, y: target.y } : null;
  }
}
