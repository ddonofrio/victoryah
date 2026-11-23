import type { Capability, ResourceKind } from './definitions';
import { assignGroupDestinations } from './formation';
import { isEngageable } from './systems/combat';
import { requestPath } from './systems/movement';
import { resolveSmartCommand } from './smart';
import type { Entity, EntityId, Order, PlayerId } from './types';
import type { World } from './world';

export interface CommandTarget {
  readonly x: number;
  readonly y: number;
  readonly entityId?: EntityId;
  readonly depositId?: number;
}

interface CommandBase {
  readonly playerId: PlayerId;
  readonly unitIds: readonly EntityId[];
}

/** Player intents. Treated as untrusted input: every field is validated before use. */
export type Command = CommandBase &
  (
    | { readonly type: 'move'; readonly x: number; readonly y: number }
    | { readonly type: 'stop' }
    | { readonly type: 'attack'; readonly targetId: EntityId }
    | { readonly type: 'harvest'; readonly depositId: number }
    | { readonly type: 'build'; readonly structureType: string; readonly x: number; readonly y: number }
    | { readonly type: 'repair'; readonly targetId: EntityId }
    | { readonly type: 'extract'; readonly depositId: number }
    | { readonly type: 'haul'; readonly targetId: EntityId }
    | { readonly type: 'smart'; readonly target: CommandTarget }
  );

export type RejectionReason =
  'unknown-unit' | 'not-owner' | 'unsupported' | 'not-ready' | 'invalid-target' | 'blocked' | 'insufficient-resources';

export interface CommandResult {
  accepted: EntityId[];
  rejected: { id: EntityId; reason: RejectionReason }[];
}

const emptyResult = (): CommandResult => ({ accepted: [], rejected: [] });

/** Validates a command and turns it into orders on the affected units. */
export function applyCommand(world: World, command: Command): CommandResult {
  switch (command.type) {
    case 'move':
      return moveUnits(world, command, command.x, command.y);
    case 'stop':
      return forEachUnit(world, command, 'stop', (unit) => assignOrder(unit, { type: 'idle' }));
    case 'attack':
      return forEachUnit(world, command, 'attack', (unit) => orderAttack(world, unit, command.targetId));
    case 'harvest':
      return forEachUnit(world, command, 'harvest', (unit) => orderHarvest(world, unit, command.depositId));
    case 'build':
      return orderBuild(world, command);
    case 'repair':
      return forEachUnit(world, command, 'repair', (unit) => orderRepair(world, unit, command.targetId));
    case 'extract':
      return forEachUnit(world, command, 'extract', (unit) => orderExtract(world, unit, command.depositId));
    case 'haul':
      return forEachUnit(world, command, 'haul', (unit) => orderHaul(world, unit, command.targetId));
    case 'smart':
      return resolveSmartCommand(world, command, command.target);
    default:
      return emptyResult();
  }
}

/** Resolves and authorises the units of a command for one capability. */
export function selectUnits(
  world: World,
  command: CommandBase,
  capability: Capability,
  result: CommandResult,
): Entity[] {
  const units: Entity[] = [];
  for (const id of new Set(command.unitIds)) {
    const unit = world.entity(id);
    if (!unit) result.rejected.push({ id, reason: 'unknown-unit' });
    else if (unit.owner !== command.playerId) result.rejected.push({ id, reason: 'not-owner' });
    else if (!world.def(unit.typeId).capabilities.includes(capability))
      result.rejected.push({ id, reason: 'unsupported' });
    else if (unit.built < 1) result.rejected.push({ id, reason: 'not-ready' });
    else units.push(unit);
  }
  return units;
}

type UnitHandler = (unit: Entity) => RejectionReason | null;

function forEachUnit(world: World, command: CommandBase, capability: Capability, handler: UnitHandler): CommandResult {
  const result = emptyResult();
  for (const unit of selectUnits(world, command, capability, result)) {
    const reason = handler(unit);
    if (reason) result.rejected.push({ id: unit.id, reason });
    else result.accepted.push(unit.id);
  }
  return result;
}

function assignOrder(unit: Entity, order: Order): null {
  unit.order = order;
  unit.path = [];
  unit.lastPathTick = -1000;
  return null;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function moveUnits(world: World, command: CommandBase, x: number, y: number): CommandResult {
  const result = emptyResult();
  const units = selectUnits(world, command, 'move', result);
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    for (const unit of units) result.rejected.push({ id: unit.id, reason: 'invalid-target' });
    return result;
  }
  const destinations = assignGroupDestinations(world, units, { x, y });
  for (const unit of units) {
    const target = destinations.get(unit.id)!;
    assignOrder(unit, { type: 'move', x: target.x, y: target.y });
    requestPath(world, unit, target.x, target.y);
    result.accepted.push(unit.id);
  }
  return result;
}

export function orderAttack(world: World, unit: Entity, targetId: EntityId): RejectionReason | null {
  const target = world.entity(targetId);
  if (!target || !isEngageable(world, unit, target)) return 'invalid-target';
  return assignOrder(unit, { type: 'attack', targetId });
}

export function orderHarvest(world: World, unit: Entity, depositId: number): RejectionReason | null {
  const deposit = world.deposit(depositId);
  const kinds: readonly ResourceKind[] = world.def(unit.typeId).harvest?.kinds ?? [];
  if (!deposit || !kinds.includes(deposit.kind) || !world.isDepositKnownTo(deposit, unit.owner))
    return 'invalid-target';
  return assignOrder(unit, { type: 'harvest', depositId, phase: 'toDeposit' });
}

export function orderRepair(world: World, unit: Entity, targetId: EntityId): RejectionReason | null {
  const target = world.entity(targetId);
  if (!target || target.owner !== unit.owner || target.id === unit.id) return 'invalid-target';
  if (target.built < 1 && world.def(unit.typeId).capabilities.includes('build')) {
    return assignOrder(unit, { type: 'build', structureId: target.id });
  }
  if (target.hp >= world.def(target.typeId).maxHp) return 'invalid-target';
  return assignOrder(unit, { type: 'repair', targetId });
}

export function orderExtract(world: World, unit: Entity, depositId: number): RejectionReason | null {
  const deposit = world.deposit(depositId);
  if (!deposit || deposit.kind !== 'energy') return 'invalid-target';
  return assignOrder(unit, { type: 'extract', depositId });
}

export function orderHaul(world: World, unit: Entity, targetId: EntityId): RejectionReason | null {
  const source = world.entity(targetId);
  if (!source || source.owner !== unit.owner || world.def(source.typeId).dropOff !== 'refinery')
    return 'invalid-target';
  return assignOrder(unit, { type: 'haul', sourceId: targetId, phase: 'toSource' });
}

function orderBuild(world: World, command: Extract<Command, { type: 'build' }>): CommandResult {
  const result = emptyResult();
  const engineers = selectUnits(world, command, 'build', result).filter((unit) => {
    if (world.def(unit.typeId).builder?.structures.includes(command.structureType)) return true;
    result.rejected.push({ id: unit.id, reason: 'unsupported' });
    return false;
  });
  if (engineers.length === 0) return result;
  const x = Math.floor(command.x) + 0.5;
  const y = Math.floor(command.y) + 0.5;
  const reason = buildRejection(world, command.playerId, command.structureType, x, y);
  if (reason) {
    for (const unit of engineers) result.rejected.push({ id: unit.id, reason });
    return result;
  }
  payCost(world, command.playerId, command.structureType);
  const structure = world.spawn(command.structureType, command.playerId, x, y, { built: 0 });
  for (const unit of engineers) {
    assignOrder(unit, { type: 'build', structureId: structure.id });
    result.accepted.push(unit.id);
  }
  return result;
}

function buildRejection(
  world: World,
  playerId: PlayerId,
  typeId: string,
  x: number,
  y: number,
): RejectionReason | null {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return 'invalid-target';
  const def = world.def(typeId);
  const half = Math.floor((def.footprint ?? 1) / 2);
  for (let ty = Math.floor(y) - half; ty <= Math.floor(y) + half; ty++) {
    for (let tx = Math.floor(x) - half; tx <= Math.floor(x) + half; tx++) {
      if (!world.isWalkable(tx, ty)) return 'blocked';
    }
  }
  const occupied = world.entitiesNear(x, y, half + 0.9).some((e) => world.def(e.typeId).domain !== 'air');
  if (occupied) return 'blocked';
  const stockpile = world.player(playerId).stockpile;
  for (const [kind, amount] of Object.entries(def.cost ?? {}) as [ResourceKind, number][]) {
    if (stockpile[kind] < amount) return 'insufficient-resources';
  }
  return null;
}

function payCost(world: World, playerId: PlayerId, typeId: string): void {
  const stockpile = world.player(playerId).stockpile;
  for (const [kind, amount] of Object.entries(world.def(typeId).cost ?? {}) as [ResourceKind, number][]) {
    stockpile[kind] -= amount;
  }
}
