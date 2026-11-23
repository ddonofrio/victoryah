import * as THREE from 'three';
import type { PlayerId, Point, SimEvent } from '../engine/sim/types';
import type { World } from '../engine/sim/world';
import type { SoundBoard, SoundName } from './audio/soundBoard';
import type { EffectsView } from './render/effectsView';
import type { HeightField } from './render/heightField';
import type { UnitView } from './render/unitView';
import type { Toast } from './ui/toast';

/**
 * Turns simulation events into effects, sounds and notifications for the local player. Events
 * outside the player's vision are not shown, so presentation never leaks hidden information.
 */
export class EventPresenter {
  constructor(
    private readonly world: World,
    private readonly localPlayer: PlayerId,
    private readonly views: { readonly effects: EffectsView; readonly units: UnitView; readonly heights: HeightField },
    private readonly sound: SoundBoard,
    private readonly toast: Toast,
  ) {}

  present(events: readonly SimEvent[], listener: Point, alpha: number, time: number): void {
    for (const event of events) this.presentOne(event, listener, alpha, time);
  }

  private presentOne(event: SimEvent, listener: Point, alpha: number, time: number): void {
    switch (event.type) {
      case 'shot':
        if (!this.seen(event.from) && !this.seen(event.to)) return;
        this.views.effects.shot(
          this.muzzle(event.sourceId, event.from, alpha, time),
          this.muzzle(event.targetId, event.to, alpha, time),
          event.visual,
        );
        this.sound.play(event.visual as SoundName, this.volume(event.from, listener));
        return;
      case 'destroyed':
        if (!this.seen(event.at) && event.owner !== this.localPlayer) return;
        this.views.effects.explosion(
          this.groundPoint(event.at),
          this.world.ruleset.units.get(event.typeId)?.radius ?? 0.5,
        );
        this.sound.play('explosion', this.volume(event.at, listener));
        if (event.owner === this.localPlayer) this.toast.show(`${this.name(event.typeId)} destroyed`);
        return;
      default:
        this.presentEconomy(event);
    }
  }

  private presentEconomy(event: SimEvent): void {
    if (!('owner' in event) || event.owner !== this.localPlayer) return;
    if (event.type === 'delivered') this.sound.play('delivered', 0.6);
    if (event.type === 'constructed') {
      const entity = this.world.entity(event.entityId);
      this.toast.show(`${entity ? this.name(entity.typeId) : 'Structure'} online`);
      this.sound.play('constructed');
    }
    if (event.type === 'depositRevealed') {
      this.toast.show('Prospector detected an underground ore deposit');
      this.sound.play('revealed');
    }
  }

  private seen(p: Point): boolean {
    return this.world.visibility(this.localPlayer).isVisible(p.x, p.y);
  }

  private muzzle(id: number, fallback: Point, alpha: number, time: number): THREE.Vector3 {
    const position = this.views.units.renderPosition(id, alpha, time) ?? this.groundPoint(fallback);
    return position.setY(position.y + 0.45);
  }

  private groundPoint(p: Point): THREE.Vector3 {
    return new THREE.Vector3(p.x, this.views.heights.heightAt(p.x, p.y), p.y);
  }

  private volume(p: Point, listener: Point): number {
    const d = Math.hypot(p.x - listener.x, p.y - listener.y);
    return Math.max(0, 1 - d / 60);
  }

  private name(typeId: string): string {
    return this.world.ruleset.units.get(typeId)?.name ?? typeId;
  }
}
