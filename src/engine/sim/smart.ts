import {
  moveUnits,
  orderAttack,
  orderExtract,
  orderHarvest,
  orderHaul,
  orderRepair,
  selectUnits,
  type CommandResult,
  type CommandTarget,
  type RejectionReason,
} from './commands';
import type { Capability } from './definitions';
import type { Entity, EntityId, PlayerId } from './types';
import type { World } from './world';

type Attempt = [Capability, (unit: Entity) => RejectionReason | null];

/**
 * Context-sensitive "right click": every unit does the most useful thing it supports with the
 * clicked target, and units that cannot interact with it move there instead. Resolved inside the
 * engine so the same rules apply to local play and to a future authoritative server.
 */
export function resolveSmartCommand(
  world: World,
  command: { readonly playerId: PlayerId; readonly unitIds: readonly EntityId[] },
  target: CommandTarget,
): CommandResult {
  const result: CommandResult = { accepted: [], rejected: [] };
  const movers: EntityId[] = [];
  for (const id of new Set(command.unitIds)) {
    const units = selectUnits(world, { playerId: command.playerId, unitIds: [id] }, 'stop', result);
    const unit = units[0];
    if (!unit) continue;
    if (tryInteractions(world, unit, target)) result.accepted.push(unit.id);
    else movers.push(unit.id);
  }
  if (movers.length > 0) {
    const moved = moveUnits(world, { playerId: command.playerId, unitIds: movers }, target.x, target.y);
    result.accepted.push(...moved.accepted);
    result.rejected.push(...moved.rejected);
  }
  return result;
}

function tryInteractions(world: World, unit: Entity, target: CommandTarget): boolean {
  const capabilities = world.def(unit.typeId).capabilities;
  for (const [capability, attempt] of interactionsFor(world, target)) {
    if (capabilities.includes(capability) && attempt(unit) === null) return true;
  }
  return false;
}

function interactionsFor(world: World, target: CommandTarget): Attempt[] {
  const attempts: Attempt[] = [];
  const { entityId, depositId } = target;
  if (entityId !== undefined) {
    attempts.push(['attack', (unit) => orderAttack(world, unit, entityId)]);
    attempts.push(['repair', (unit) => orderRepair(world, unit, entityId)]);
    attempts.push(['build', (unit) => orderRepair(world, unit, entityId)]);
    attempts.push(['haul', (unit) => orderHaul(world, unit, entityId)]);
  }
  if (depositId !== undefined) {
    attempts.push(['harvest', (unit) => orderHarvest(world, unit, depositId)]);
    attempts.push(['extract', (unit) => orderExtract(world, unit, depositId)]);
  }
  return attempts;
}
