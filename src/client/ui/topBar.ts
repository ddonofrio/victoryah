import { RESOURCE_KINDS, type ResourceKind } from '../../engine/sim/definitions';
import { RESOURCE_COLORS } from '../render/palette';

export interface TopBarHandlers {
  readonly onHelp: () => void;
  readonly onSound: () => boolean;
  readonly onNewPlanet: () => void;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Resource counters, planet identity and global buttons. */
export class TopBar {
  private readonly values = new Map<ResourceKind, HTMLElement>();

  constructor(doc: Document, handlers: TopBarHandlers) {
    const resources = doc.getElementById('resources')!;
    for (const kind of RESOURCE_KINDS) {
      const item = doc.createElement('div');
      item.className = 'resource';
      item.title = kind;
      item.innerHTML = `<i style="background:${hex(RESOURCE_COLORS[kind])}"></i><span>${kind}</span><b>0</b>`;
      resources.appendChild(item);
      this.values.set(kind, item.querySelector('b')!);
    }
    doc.getElementById('btn-help')!.addEventListener('click', handlers.onHelp);
    doc.getElementById('btn-new')!.addEventListener('click', handlers.onNewPlanet);
    const sound = doc.getElementById('btn-sound')!;
    sound.addEventListener('click', () => {
      sound.textContent = `Sound: ${handlers.onSound() ? 'on' : 'off'}`;
    });
  }

  setPlanet(doc: Document, seed: number): void {
    doc.getElementById('planet-label')!.textContent = `Planet ${seed}`;
  }

  update(stockpile: Readonly<Record<ResourceKind, number>>): void {
    for (const [kind, element] of this.values) {
      const text = String(Math.floor(stockpile[kind]));
      if (element.textContent !== text) element.textContent = text;
    }
  }
}
