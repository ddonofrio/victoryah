import type { ResourceAmounts, ResourceKind } from '../../engine/sim/definitions';
import type { Entity, Order } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';

const ORDER_LABELS: Readonly<Record<Order['type'], string>> = {
  idle: 'Idle',
  move: 'Moving',
  attack: 'Attacking',
  harvest: 'Harvesting',
  build: 'Constructing',
  repair: 'Repairing',
  extract: 'Extracting energy',
  haul: 'Hauling',
};

const HARVEST_PHASES = {
  toDeposit: 'Heading to deposit',
  gathering: 'Gathering',
  returning: 'Returning cargo',
} as const;

export function formatCost(cost: ResourceAmounts | undefined): string {
  if (!cost) return '';
  return (Object.entries(cost) as [ResourceKind, number][]).map(([kind, amount]) => `${amount} ${kind}`).join(' · ');
}

const formatStock = (stock: ResourceAmounts): string =>
  (Object.entries(stock) as [ResourceKind, number][])
    .filter(([, amount]) => amount >= 1)
    .map(([kind, amount]) => `${Math.floor(amount)} ${kind}`)
    .join(', ');

/** One-line, player-facing status of a unit or structure. */
export function describeStatus(world: World, entity: Entity): string {
  if (entity.built < 1) return `Under construction · ${Math.floor(entity.built * 100)}%`;
  const order = entity.order;
  const parts = [order.type === 'harvest' ? HARVEST_PHASES[order.phase] : ORDER_LABELS[order.type]];
  const def = world.def(entity.typeId);
  if (entity.cargo && def.harvest) {
    parts.push(`${Math.floor(entity.cargo.amount)}/${def.harvest.capacity} ${entity.cargo.kind}`);
  }
  const refined = formatStock(entity.refinedStock);
  if (refined) parts.push(def.dropOff === 'refinery' ? `refined ${refined}` : `carrying ${refined}`);
  return parts.join(' · ');
}
