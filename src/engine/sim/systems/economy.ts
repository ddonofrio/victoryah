import type { ResourceAmounts, ResourceKind } from '../definitions';
import { distance } from '../geometry';
import type { Deposit, Entity, HaulPhase, HarvestPhase } from '../types';
import type { World } from '../world';
import { approach } from './movement';

/** Distance at which a unit can gather from a deposit. */
const GATHER_RANGE = 0.9;
/** Extra reach, beyond the structure radius, for deliveries and pick-ups. */
const DOCK_RANGE = 1.5;
/** How far a harvester looks for another deposit when its current one is exhausted. */
const REPLACEMENT_SEARCH_RADIUS = 15;

const sum = (stock: ResourceAmounts): number => Object.values(stock).reduce((a, b) => a + (b ?? 0), 0);

/** Nearest completed drop-off owned by the entity's owner, optionally restricted by type. */
function nearestDropOff(world: World, entity: Entity, only?: 'stockpile' | 'refinery'): Entity | undefined {
  let best: Entity | undefined;
  let bestDistance = Infinity;
  for (const candidate of world.entitiesList()) {
    if (candidate.owner !== entity.owner || candidate.built < 1 || candidate.id === entity.id) continue;
    const dropOff = world.def(candidate.typeId).dropOff;
    if (!dropOff || (only && dropOff !== only)) continue;
    const d = distance(entity, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return best;
}

export function findDepositNear(
  world: World,
  entity: Entity,
  kinds: readonly ResourceKind[],
  radius: number,
): Deposit | undefined {
  let best: Deposit | undefined;
  let bestDistance = Infinity;
  for (const deposit of world.knownDeposits(entity.owner)) {
    if (!kinds.includes(deposit.kind) || deposit.amount <= 0) continue;
    const d = distance(entity, deposit);
    if (d <= radius && d < bestDistance) {
      bestDistance = d;
      best = deposit;
    }
  }
  return best;
}

function setHarvestPhase(entity: Entity, depositId: number, phase: HarvestPhase): void {
  entity.order = { type: 'harvest', depositId, phase };
}

/** Harvest cycle: travel to the deposit, gather until full, deliver, repeat. */
export function updateHarvestOrder(
  world: World,
  entity: Entity,
  depositId: number,
  phase: HarvestPhase,
  dt: number,
): void {
  if (phase === 'returning') {
    returnCargo(world, entity, depositId, dt);
    return;
  }
  const deposit = world.deposit(depositId) ?? replaceDeposit(world, entity);
  if (!deposit) {
    if (entity.cargo) setHarvestPhase(entity, depositId, 'returning');
    else entity.order = { type: 'idle' };
    return;
  }
  if (deposit.id !== depositId) {
    setHarvestPhase(entity, deposit.id, 'toDeposit');
    entity.path = [];
  }
  if (!approach(world, entity, deposit.x, deposit.y, GATHER_RANGE, dt)) return;
  gather(world, entity, deposit, dt);
}

function gather(world: World, entity: Entity, deposit: Deposit, dt: number): void {
  const spec = world.def(entity.typeId).harvest!;
  if (entity.cargo && entity.cargo.kind !== deposit.kind) entity.cargo = null;
  const carried = entity.cargo?.amount ?? 0;
  const amount = Math.min(spec.rate * dt, spec.capacity - carried, deposit.amount);
  entity.cargo = { kind: deposit.kind, amount: carried + amount };
  deposit.amount -= amount;
  if (deposit.amount <= 1e-9) world.removeDeposit(deposit.id);
  const full = entity.cargo.amount >= spec.capacity - 1e-9;
  setHarvestPhase(entity, deposit.id, full || deposit.amount <= 1e-9 ? 'returning' : 'gathering');
}

function replaceDeposit(world: World, entity: Entity): Deposit | undefined {
  const kinds = world.def(entity.typeId).harvest?.kinds ?? [];
  return findDepositNear(world, entity, kinds, REPLACEMENT_SEARCH_RADIUS);
}

function returnCargo(world: World, entity: Entity, depositId: number, dt: number): void {
  if (!entity.cargo || entity.cargo.amount <= 0) {
    entity.cargo = null;
    setHarvestPhase(entity, depositId, 'toDeposit');
    return;
  }
  const dropOff = nearestDropOff(world, entity);
  if (!dropOff) return;
  const range = world.def(dropOff.typeId).radius + DOCK_RANGE;
  if (!approach(world, entity, dropOff.x, dropOff.y, range, dt)) return;
  deliver(world, dropOff, entity, entity.cargo.kind, entity.cargo.amount);
  entity.cargo = null;
  setHarvestPhase(entity, depositId, 'toDeposit');
}

function deliver(world: World, dropOff: Entity, carrier: Entity, kind: ResourceKind, amount: number): void {
  if (world.def(dropOff.typeId).dropOff === 'refinery') {
    dropOff.rawStock[kind] = (dropOff.rawStock[kind] ?? 0) + amount;
    return;
  }
  world.player(dropOff.owner).stockpile[kind] += amount;
  world.emit({ type: 'delivered', entityId: carrier.id, owner: carrier.owner, kind, amount });
}

/** Refineries convert raw deliveries into refined stock over time. */
export function updateRefining(world: World, entity: Entity, dt: number): void {
  const refining = world.def(entity.typeId).refining;
  if (!refining) return;
  for (const [kind, raw] of Object.entries(entity.rawStock) as [ResourceKind, number][]) {
    const processed = Math.min(raw, refining.rate * dt);
    if (processed <= 0) continue;
    entity.rawStock[kind] = raw - processed;
    entity.refinedStock[kind] = (entity.refinedStock[kind] ?? 0) + processed * refining.yield;
  }
}

function setHaulPhase(entity: Entity, sourceId: number, phase: HaulPhase): void {
  entity.order = { type: 'haul', sourceId, phase };
}

/** Transport cycle: load refined goods at a refinery and carry them to a stockpile. */
export function updateHaulOrder(world: World, entity: Entity, sourceId: number, phase: HaulPhase, dt: number): void {
  const source = world.entity(sourceId);
  if (phase === 'toSource') {
    if (!source) {
      entity.order = sum(entity.refinedStock) > 0 ? { type: 'haul', sourceId, phase: 'toStockpile' } : { type: 'idle' };
      return;
    }
    const range = world.def(source.typeId).radius + DOCK_RANGE;
    if (!approach(world, entity, source.x, source.y, range, dt)) return;
    if (load(world, entity, source)) setHaulPhase(entity, sourceId, 'toStockpile');
    return;
  }
  const stockpile = nearestDropOff(world, entity, 'stockpile');
  if (!stockpile) return;
  if (!approach(world, entity, stockpile.x, stockpile.y, world.def(stockpile.typeId).radius + DOCK_RANGE, dt)) return;
  for (const [kind, amount] of Object.entries(entity.refinedStock) as [ResourceKind, number][]) {
    if (amount > 0) deliver(world, stockpile, entity, kind, amount);
  }
  entity.refinedStock = {};
  setHaulPhase(entity, sourceId, source ? 'toSource' : 'toStockpile');
  if (!source) entity.order = { type: 'idle' };
}

/** Loads refined goods; returns true when the transport should depart. */
function load(world: World, transport: Entity, source: Entity): boolean {
  const capacity = world.def(transport.typeId).haulCapacity ?? 0;
  for (const [kind, available] of Object.entries(source.refinedStock) as [ResourceKind, number][]) {
    const space = capacity - sum(transport.refinedStock);
    const amount = Math.min(space, available);
    if (amount <= 0) continue;
    source.refinedStock[kind] = available - amount;
    transport.refinedStock[kind] = (transport.refinedStock[kind] ?? 0) + amount;
  }
  const carried = sum(transport.refinedStock);
  return carried >= capacity - 1e-9 || (carried > 0 && sum(source.refinedStock) <= 1e-9);
}

/** Energy extraction: deploy next to an energy source and feed the owner's stockpile. */
export function updateExtractOrder(world: World, entity: Entity, depositId: number, dt: number): void {
  const deposit = world.deposit(depositId);
  if (!deposit) {
    entity.order = { type: 'idle' };
    return;
  }
  if (!approach(world, entity, deposit.x, deposit.y, DOCK_RANGE, dt)) return;
  const amount = Math.min((world.def(entity.typeId).extractRate ?? 0) * dt, deposit.amount);
  deposit.amount -= amount;
  world.player(entity.owner).stockpile.energy += amount;
  if (deposit.amount <= 1e-9) world.removeDeposit(deposit.id);
}
