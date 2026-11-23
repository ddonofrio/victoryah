import type { Entity, PlayerId } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';
import { describeStatus } from './describe';

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Details of the current selection: a single unit's status or a breakdown of a group. */
export class SelectionPanel {
  private signature = '';

  constructor(
    private readonly element: HTMLElement,
    onSelectType: (typeId: string) => void,
  ) {
    element.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (button?.dataset.type) onSelectType(button.dataset.type);
    });
  }

  render(world: World, selected: readonly Entity[], localPlayer: PlayerId): void {
    const html = this.html(world, selected, localPlayer);
    if (html === this.signature) return;
    this.signature = html;
    this.element.innerHTML = html;
  }

  private html(world: World, selected: readonly Entity[], localPlayer: PlayerId): string {
    if (selected.length === 0) {
      return '<h3>No selection</h3><p class="stats">Select units with a click or by dragging a box. Press F1 for controls.</p>';
    }
    if (selected.length === 1) return this.single(world, selected[0]!, localPlayer);
    return this.group(world, selected);
  }

  private single(world: World, entity: Entity, localPlayer: PlayerId): string {
    const def = world.def(entity.typeId);
    const ratio = Math.max(0, entity.hp / def.maxHp);
    const owner = entity.owner === localPlayer ? '' : ' <span class="hostile">· Hostile</span>';
    const status = entity.owner === localPlayer ? `<p>${escape(describeStatus(world, entity))}</p>` : '';
    const stats = [
      `HP ${Math.ceil(entity.hp)}/${def.maxHp}`,
      `Armor ${def.armor}`,
      def.speed > 0 ? `Speed ${def.speed}` : 'Stationary',
      `Sight ${def.sightRange}`,
      def.weapon ? `Range ${def.weapon.range} · Damage ${def.weapon.damage} vs ${def.weapon.targets.join('/')}` : '',
    ].filter(Boolean);
    return (
      `<h3>${escape(def.name)}${owner}</h3>` +
      `<div class="hp"><div style="width:${(ratio * 100).toFixed(0)}%"></div></div>` +
      status +
      `<div class="stats">${stats.map((s) => `<span>${escape(s)}</span>`).join('')}</div>`
    );
  }

  private group(world: World, selected: readonly Entity[]): string {
    const counts = new Map<string, number>();
    for (const entity of selected) counts.set(entity.typeId, (counts.get(entity.typeId) ?? 0) + 1);
    const buttons = [...counts]
      .map(
        ([typeId, count]) =>
          `<button type="button" data-type="${typeId}">${escape(world.def(typeId).name)} × ${count}</button>`,
      )
      .join('');
    return `<h3>${selected.length} units selected</h3><div class="group-grid">${buttons}</div>`;
  }
}
