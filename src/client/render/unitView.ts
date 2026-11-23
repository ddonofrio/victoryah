import * as THREE from 'three';
import type { Entity, PlayerId } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';
import type { ScreenEntity } from '../input/selection';
import { disposeGeometries } from './dispose';
import type { HeightField } from './heightField';
import { LOGISTICS_BUILDERS, fallbackModel } from './logisticsModels';
import { ModelKit, type UnitModel } from './modelKit';
import { teamColor } from './palette';
import { MILITARY_BUILDERS } from './unitModels';

const AIR_ALTITUDE = 2.2;
const BUILDERS = { ...MILITARY_BUILDERS, ...LOGISTICS_BUILDERS };

interface UnitVisual {
  readonly model: UnitModel;
  readonly ring: THREE.Mesh;
  readonly hpBar: THREE.Group;
  readonly hpFill: THREE.Mesh;
  readonly air: boolean;
  readonly structure: boolean;
  prev: { x: number; y: number; facing: number };
  curr: { x: number; y: number; facing: number };
}

const lerpAngle = (a: number, b: number, t: number): number => {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
};

/** Presents the units and structures the local player perceives, interpolated between ticks. */
export class UnitView {
  readonly root = new THREE.Group();
  private readonly kit = new ModelKit();
  private readonly visuals = new Map<number, UnitVisual>();
  private readonly ringOwn = new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.9 });
  private readonly ringOther = new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.9 });
  private readonly hpBack = new THREE.MeshBasicMaterial({ color: 0x101010, depthTest: false });
  private readonly hpGood = new THREE.MeshBasicMaterial({ color: 0x52e06a, depthTest: false });
  private readonly hpWarn = new THREE.MeshBasicMaterial({ color: 0xf0c040, depthTest: false });
  private readonly hpBad = new THREE.MeshBasicMaterial({ color: 0xf04a3a, depthTest: false });
  private readonly position = new THREE.Vector3();

  constructor(
    private readonly world: World,
    private readonly localPlayer: PlayerId,
    private readonly heights: HeightField,
  ) {}

  /** Call after simulation steps: records new authoritative positions and adds/removes visuals. */
  sync(): void {
    const seen = new Set<number>();
    for (const entity of this.world.perceivedEntities(this.localPlayer)) {
      seen.add(entity.id);
      const visual = this.visuals.get(entity.id) ?? this.create(entity);
      visual.prev = visual.curr;
      visual.curr = { x: entity.x, y: entity.y, facing: entity.facing };
      this.applyStatic(visual, entity);
    }
    for (const [id, visual] of this.visuals) {
      if (seen.has(id)) continue;
      this.root.remove(visual.model.root, visual.ring, visual.hpBar);
      for (const part of [visual.model.root, visual.ring, visual.hpBar]) disposeGeometries(part);
      this.visuals.delete(id);
    }
  }

  render(alpha: number, selection: ReadonlySet<number>, camera: THREE.Camera, time: number): void {
    for (const [id, visual] of this.visuals) {
      const entity = this.world.entity(id);
      if (!entity) continue;
      const p = this.interpolated(visual, alpha, time, id);
      visual.model.root.position.copy(p);
      const facing = lerpAngle(visual.prev.facing, visual.curr.facing, alpha);
      if (visual.structure) {
        if (visual.model.head) visual.model.head.rotation.y = -facing;
      } else {
        visual.model.root.rotation.y = -facing;
      }
      for (const spinner of visual.model.spinners) spinner.rotation.y = time * 6 + id;
      this.placeOverlays(visual, entity, p, selection.has(id), camera);
    }
  }

  /** World-space render position of a perceived entity (for markers and effects). */
  renderPosition(id: number, alpha: number, time: number): THREE.Vector3 | undefined {
    const visual = this.visuals.get(id);
    return visual ? this.interpolated(visual, alpha, time, id).clone() : undefined;
  }

  /** Projects perceived entities to screen space for picking and box selection. */
  screenEntities(camera: THREE.PerspectiveCamera, width: number, height: number): ScreenEntity[] {
    const result: ScreenEntity[] = [];
    const projected = new THREE.Vector3();
    for (const [id, visual] of this.visuals) {
      const entity = this.world.entity(id);
      if (!entity) continue;
      projected.copy(visual.model.root.position).setY(visual.model.root.position.y + visual.model.height * 0.4);
      const distance = projected.distanceTo(camera.position);
      projected.project(camera);
      if (projected.z > 1) continue;
      const pixelsPerUnit = height / (2 * Math.tan((camera.fov * Math.PI) / 360) * distance);
      result.push({
        id,
        x: ((projected.x + 1) / 2) * width,
        y: ((1 - projected.y) / 2) * height,
        radiusPx: Math.max(7, this.world.def(entity.typeId).radius * pixelsPerUnit * 1.1),
        own: entity.owner === this.localPlayer,
        mobile: !visual.structure,
      });
    }
    return result;
  }

  private interpolated(visual: UnitVisual, alpha: number, time: number, id: number): THREE.Vector3 {
    const x = visual.prev.x + (visual.curr.x - visual.prev.x) * alpha;
    const y = visual.prev.y + (visual.curr.y - visual.prev.y) * alpha;
    const ground = this.heights.heightAt(x, y);
    const lift = visual.air ? AIR_ALTITUDE + Math.sin(time * 2 + id) * 0.12 : 0;
    const base = visual.air ? Math.max(ground, 0) : ground;
    return this.position.set(x, base + lift, y);
  }

  private create(entity: Entity): UnitVisual {
    const def = this.world.def(entity.typeId);
    const build = BUILDERS[entity.typeId];
    const team = this.kit.team(teamColor(entity.owner));
    const model = build ? build(this.kit, team) : fallbackModel(this.kit, team);
    const radius = Math.max(def.radius, 0.35) * 1.25;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.08, 32).rotateX(-Math.PI / 2),
      entity.owner === this.localPlayer ? this.ringOwn : this.ringOther,
    );
    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), this.hpGood);
    const hpBar = new THREE.Group();
    hpBar.add(new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.14), this.hpBack), hpFill);
    hpFill.position.z = 0.001;
    hpBar.renderOrder = 10;
    hpFill.renderOrder = 11;
    const start = { x: entity.x, y: entity.y, facing: entity.facing };
    const visual: UnitVisual = {
      model,
      ring,
      hpBar,
      hpFill,
      air: def.domain === 'air',
      structure: def.domain === 'structure',
      prev: start,
      curr: start,
    };
    this.root.add(model.root, ring, hpBar);
    this.visuals.set(entity.id, visual);
    return visual;
  }

  private applyStatic(visual: UnitVisual, entity: Entity): void {
    const scaleY = entity.built >= 1 ? 1 : 0.25 + 0.75 * entity.built;
    visual.model.root.scale.set(1, scaleY, 1);
  }

  private placeOverlays(
    visual: UnitVisual,
    entity: Entity,
    p: THREE.Vector3,
    selected: boolean,
    camera: THREE.Camera,
  ): void {
    const def = this.world.def(entity.typeId);
    const ground = visual.air ? p.y - AIR_ALTITUDE : p.y;
    visual.ring.visible = selected;
    visual.ring.position.set(p.x, ground + 0.06, p.z);
    const damaged = entity.hp < def.maxHp;
    visual.hpBar.visible = selected || damaged;
    if (!visual.hpBar.visible) return;
    const ratio = Math.max(0, entity.hp / def.maxHp);
    const width = Math.max(0.8, def.radius * 2);
    visual.hpBar.scale.set(width, 1, 1);
    visual.hpFill.scale.x = ratio;
    visual.hpFill.position.x = -(1 - ratio) / 2;
    visual.hpFill.material = ratio > 0.6 ? this.hpGood : ratio > 0.3 ? this.hpWarn : this.hpBad;
    visual.hpBar.position.set(p.x, p.y + visual.model.height + 0.35, p.z);
    visual.hpBar.quaternion.copy(camera.quaternion);
  }
}
