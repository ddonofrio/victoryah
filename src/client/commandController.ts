import type { GameSession, LocalCommand } from '../app/gameSession';
import { sharedActions } from '../engine/sim/capabilities';
import type { Capability, ResourceKind } from '../engine/sim/definitions';
import type { Entity, Point } from '../engine/sim/types';
import type { SoundBoard } from './audio/soundBoard';
import { commandForAction, pointerTarget } from './input/pointerCommands';
import { applySelection, boxSelect, type ScreenRect } from './input/selection';
import type { EffectsView, MarkerKind } from './render/effectsView';
import type { WorldPicker } from './render/worldPicker';
import type { BuildOption, CommandPanelState } from './ui/commandPanel';
import type { Toast } from './ui/toast';

export type InteractionMode =
  | { readonly kind: 'select' }
  | { readonly kind: 'target'; readonly action: Capability }
  | { readonly kind: 'place'; readonly structureType: string };

const ACK_SOUNDS: Partial<Record<LocalCommand['type'], 'ackMove' | 'ackAttack' | 'ackWork'>> = {
  move: 'ackMove',
  attack: 'ackAttack',
  harvest: 'ackWork',
  build: 'ackWork',
  repair: 'ackWork',
  extract: 'ackWork',
  haul: 'ackWork',
};

/**
 * Client-side selection state and translation of player gestures into commands. It never
 * changes the world directly: every order goes through the session as a command.
 */
export class CommandController {
  selection = new Set<number>();
  mode: InteractionMode = { kind: 'select' };
  buildMenuOpen = false;
  private readonly groups = new Map<number, number[]>();

  constructor(
    private readonly session: GameSession,
    private readonly picker: WorldPicker,
    private readonly feedback: { readonly effects: EffectsView; readonly sound: SoundBoard; readonly toast: Toast },
  ) {}

  private get world() {
    return this.session.simulation.world;
  }

  /** Selected entities that still exist and are perceived; prunes the rest. */
  selectedEntities(): Entity[] {
    const perceived = new Set(this.world.perceivedEntities(this.session.localPlayerId).map((e) => e.id));
    const result: Entity[] = [];
    for (const id of this.selection) {
      const entity = this.world.entity(id);
      if (entity && perceived.has(id)) result.push(entity);
      else this.selection.delete(id);
    }
    return result;
  }

  /** Own selected units, or none if the selection contains foreign entities. */
  commandable(): Entity[] {
    const selected = this.selectedEntities();
    return selected.every((e) => e.owner === this.session.localPlayerId) ? selected : [];
  }

  actions(): Capability[] {
    return sharedActions(this.commandable().map((e) => this.world.def(e.typeId)));
  }

  clickSelect(px: number, py: number, toggle: boolean, sameType: boolean): void {
    const id = this.picker.entityAt(px, py);
    if (id === undefined) {
      if (!toggle) this.setSelection([]);
      return;
    }
    const entity = this.world.entity(id)!;
    if (sameType && entity.owner === this.session.localPlayerId) {
      const onScreen = this.picker
        .screenEntities()
        .filter((s) => s.own && this.world.entity(s.id)?.typeId === entity.typeId);
      this.setSelection(onScreen.map((s) => s.id));
    } else if (toggle && entity.owner === this.session.localPlayerId) {
      this.setSelection([...applySelection(this.selection, [id], 'toggle')]);
    } else {
      this.setSelection([id]);
    }
    this.feedback.sound.play('select');
  }

  boxSelect(rect: ScreenRect, additive: boolean): void {
    const picked = boxSelect(this.picker.screenEntities(), rect);
    this.setSelection([...applySelection(this.selection, picked, additive ? 'add' : 'replace')]);
    if (picked.length > 0) this.feedback.sound.play('select');
  }

  selectType(typeId: string): void {
    this.setSelection(
      this.selectedEntities()
        .filter((e) => e.typeId === typeId)
        .map((e) => e.id),
    );
  }

  /** Right click on the battlefield: context-sensitive order for the whole selection. */
  contextCommand(px: number, py: number): void {
    const ground = this.picker.ground(px, py);
    if (ground) this.contextCommandAt(ground, this.picker.entityAt(px, py));
  }

  contextCommandAt(ground: Point, entityId?: number): void {
    const units = this.commandable();
    if (units.length === 0) return;
    const target = pointerTarget(this.world, this.session.localPlayerId, ground, entityId);
    this.submit(
      { type: 'smart', unitIds: units.map((u) => u.id), target },
      this.markerFor(target.entityId, target.depositId),
    );
  }

  /** Command button or hotkey pressed. */
  beginAction(action: Capability): void {
    if (!this.actions().includes(action)) return;
    const unitIds = this.commandable().map((e) => e.id);
    if (action === 'stop') {
      this.submit({ type: 'stop', unitIds }, null);
      return;
    }
    if (action === 'build') {
      this.buildMenuOpen = true;
      return;
    }
    this.mode = { kind: 'target', action };
  }

  beginPlacement(structureType: string): void {
    const option = this.buildOptions().find((o) => o.typeId === structureType);
    if (!option) return;
    if (!option.affordable) {
      this.reject('Insufficient resources');
      return;
    }
    this.mode = { kind: 'place', structureType };
  }

  /** Left click while an action or placement is pending. */
  targetClick(px: number, py: number): void {
    const ground = this.picker.ground(px, py);
    if (!ground || this.mode.kind === 'select') return;
    const unitIds = this.commandable().map((e) => e.id);
    const target = pointerTarget(this.world, this.session.localPlayerId, ground, this.picker.entityAt(px, py));
    if (this.mode.kind === 'place') {
      this.place(unitIds, ground, this.mode.structureType);
      return;
    }
    const command = commandForAction(this.mode.action, unitIds, target);
    if (!command) {
      this.reject('Invalid target for this order');
      return;
    }
    this.submit(command, this.markerFor(target.entityId, target.depositId));
    this.mode = { kind: 'select' };
  }

  /** Esc: leave targeting, then the build menu, then clear the selection. */
  cancel(): void {
    if (this.mode.kind !== 'select') this.mode = { kind: 'select' };
    else if (this.buildMenuOpen) this.buildMenuOpen = false;
    else this.setSelection([]);
  }

  assignGroup(slot: number): void {
    this.groups.set(
      slot,
      this.commandable().map((e) => e.id),
    );
    this.feedback.toast.show(`Group ${slot} assigned`, 1.2);
  }

  recallGroup(slot: number): boolean {
    const ids = (this.groups.get(slot) ?? []).filter((id) => this.world.entity(id));
    if (ids.length === 0) return false;
    this.setSelection(ids);
    return true;
  }

  isPlacementValid(x: number, y: number, structureType: string): boolean {
    const footprint = this.world.def(structureType).footprint ?? 1;
    const half = Math.floor(footprint / 2);
    for (let ty = Math.floor(y) - half; ty <= Math.floor(y) + half; ty++) {
      for (let tx = Math.floor(x) - half; tx <= Math.floor(x) + half; tx++) {
        if (!this.world.isWalkable(tx, ty)) return false;
        if (!this.world.visibility(this.session.localPlayerId).isExplored(tx, ty)) return false;
      }
    }
    const cx = Math.floor(x) + 0.5;
    const cy = Math.floor(y) + 0.5;
    return !this.world.entitiesNear(cx, cy, half + 0.9).some((e) => this.world.def(e.typeId).domain !== 'air');
  }

  panelState(): CommandPanelState {
    const actions = this.actions();
    if (!actions.includes('build')) this.buildMenuOpen = false;
    return {
      actions,
      activeAction: this.mode.kind === 'target' ? this.mode.action : null,
      buildOptions: this.buildMenuOpen ? this.buildOptions() : null,
      placing: this.mode.kind === 'place' ? this.mode.structureType : null,
    };
  }

  buildOptions(): BuildOption[] {
    const engineers = this.commandable().filter((e) => this.world.def(e.typeId).builder);
    const types = new Set(engineers.flatMap((e) => this.world.def(e.typeId).builder!.structures));
    const stockpile = this.world.player(this.session.localPlayerId).stockpile;
    return [...types].map((typeId) => {
      const def = this.world.def(typeId);
      const cost = def.cost;
      const affordable = Object.entries(cost ?? {}).every(
        ([kind, amount]) => stockpile[kind as ResourceKind] >= amount,
      );
      return { typeId, name: def.name, cost, affordable };
    });
  }

  private place(unitIds: number[], ground: Point, structureType: string): void {
    if (!this.isPlacementValid(ground.x, ground.y, structureType)) {
      this.reject('Cannot build there');
      return;
    }
    const builders = unitIds.filter((id) => this.world.def(this.world.entity(id)!.typeId).builder);
    this.submit({ type: 'build', unitIds: builders, structureType, x: ground.x, y: ground.y }, 'interact');
    this.mode = { kind: 'select' };
    this.buildMenuOpen = false;
  }

  private submit(command: LocalCommand, marker: MarkerKind | null): void {
    this.session.submit(command);
    const sound =
      command.type === 'smart'
        ? marker === 'attack'
          ? 'ackAttack'
          : marker === 'interact'
            ? 'ackWork'
            : 'ackMove'
        : ACK_SOUNDS[command.type];
    if (sound) this.feedback.sound.play(sound);
    if (!marker) return;
    const point = 'x' in command ? command : 'target' in command ? command.target : null;
    if (point) this.feedback.effects.marker(marker, point.x, point.y);
  }

  private markerFor(entityId: number | undefined, depositId: number | undefined): MarkerKind {
    if (entityId !== undefined) {
      const entity = this.world.entity(entityId);
      return entity && entity.owner !== this.session.localPlayerId ? 'attack' : 'interact';
    }
    return depositId !== undefined ? 'interact' : 'move';
  }

  private reject(message: string): void {
    this.feedback.toast.show(message);
    this.feedback.sound.play('error');
  }

  private setSelection(ids: readonly number[]): void {
    this.selection = new Set(ids);
    this.mode = { kind: 'select' };
    this.buildMenuOpen = false;
  }
}
