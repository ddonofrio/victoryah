import type { Capability, ResourceAmounts } from '../../engine/sim/definitions';
import { formatCost } from './describe';

export const ACTION_INFO: Readonly<Record<Capability, { readonly label: string; readonly hotkey: string }>> = {
  move: { label: 'Move', hotkey: 'M' },
  attack: { label: 'Attack', hotkey: 'A' },
  harvest: { label: 'Harvest', hotkey: 'H' },
  build: { label: 'Build', hotkey: 'B' },
  repair: { label: 'Repair', hotkey: 'R' },
  extract: { label: 'Extract', hotkey: 'X' },
  haul: { label: 'Haul', hotkey: 'T' },
  stop: { label: 'Stop', hotkey: 'S' },
};

export interface BuildOption {
  readonly typeId: string;
  readonly name: string;
  readonly cost: ResourceAmounts | undefined;
  readonly affordable: boolean;
}

export interface CommandPanelState {
  readonly actions: readonly Capability[];
  readonly activeAction: Capability | null;
  /** When set, the panel shows the structures the selected engineers can build. */
  readonly buildOptions: readonly BuildOption[] | null;
  readonly placing: string | null;
}

export interface CommandPanelHandlers {
  readonly onAction: (action: Capability) => void;
  readonly onBuild: (typeId: string) => void;
  readonly onBack: () => void;
}

/** Context-sensitive command buttons derived from the selection's shared capabilities. */
export class CommandPanel {
  private signature = '';

  constructor(
    private readonly element: HTMLElement,
    private readonly handlers: CommandPanelHandlers,
  ) {
    element.addEventListener('click', (event) => this.onClick(event));
  }

  render(state: CommandPanelState): void {
    const html = state.buildOptions ? this.buildMenu(state) : this.actionMenu(state);
    if (html === this.signature) return;
    this.signature = html;
    this.element.innerHTML = html;
  }

  private actionMenu(state: CommandPanelState): string {
    return state.actions
      .map((action) => {
        const info = ACTION_INFO[action];
        const active = state.activeAction === action ? ' class="active"' : '';
        return `<button type="button" data-action="${action}"${active}>${info.label}<kbd>${info.hotkey}</kbd></button>`;
      })
      .join('');
  }

  private buildMenu(state: CommandPanelState): string {
    const options = (state.buildOptions ?? []).map((option, i) => {
      const active = state.placing === option.typeId ? ' class="active"' : '';
      const disabled = option.affordable ? '' : ' disabled';
      return (
        `<button type="button" data-build="${option.typeId}"${active}${disabled}>` +
        `${option.name}<small>${formatCost(option.cost)}</small><kbd>${i + 1}</kbd></button>`
      );
    });
    return options.join('') + '<button type="button" data-back="1">Back<kbd>Esc</kbd></button>';
  }

  private onClick(event: MouseEvent): void {
    const button = (event.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.action) this.handlers.onAction(button.dataset.action as Capability);
    else if (button.dataset.build) this.handlers.onBuild(button.dataset.build);
    else if (button.dataset.back) this.handlers.onBack();
  }
}
