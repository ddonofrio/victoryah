import * as THREE from 'three';
import type { Point } from '../../engine/sim/types';
import { pickEntity, type ScreenEntity } from '../input/selection';
import type { TerrainView } from './terrainView';
import type { UnitView } from './unitView';

/** Converts screen positions into ground points and entities. */
export class WorldPicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly terrainView: TerrainView,
    private readonly unitView: UnitView,
  ) {}

  /** Ground point (map coordinates) under a screen pixel, or null if the ray misses. */
  ground(px: number, py: number, precise = true): Point | null {
    this.aim(px, py);
    const hit = precise ? this.terrainView.raycast(this.raycaster) : null;
    const point = hit ?? this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    return point ? { x: point.x, y: point.z } : null;
  }

  entityAt(px: number, py: number): number | undefined {
    return pickEntity(this.screenEntities(), px, py);
  }

  screenEntities(): ScreenEntity[] {
    return this.unitView.screenEntities(this.camera, this.element.clientWidth, this.element.clientHeight);
  }

  /** Ground quadrilateral currently visible (for the minimap), using the flat ground plane. */
  footprint(bottomInset: number): Point[] {
    const w = this.element.clientWidth;
    const h = this.element.clientHeight - bottomInset;
    const corners: [number, number][] = [
      [0, 40],
      [w, 40],
      [w, h],
      [0, h],
    ];
    return corners.map(([x, y]) => this.ground(x, y, false)).filter((p): p is Point => p !== null);
  }

  private aim(px: number, py: number): void {
    this.ndc.set((px / this.element.clientWidth) * 2 - 1, -(py / this.element.clientHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }
}
