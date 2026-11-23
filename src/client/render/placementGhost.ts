import * as THREE from 'three';
import type { HeightField } from './heightField';

/** Translucent preview of a structure being placed: green when the site is valid, red otherwise. */
export class PlacementGhost {
  readonly mesh: THREE.Mesh;
  private readonly material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });

  constructor(private readonly heights: HeightField) {
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1), this.material);
    this.mesh.visible = false;
  }

  show(x: number, y: number, footprint: number, valid: boolean): void {
    const cx = Math.floor(x) + 0.5;
    const cy = Math.floor(y) + 0.5;
    this.mesh.visible = true;
    this.mesh.scale.set(footprint, 1, footprint);
    this.mesh.position.set(cx, this.heights.heightAt(cx, cy) + 0.4, cy);
    this.material.color.setHex(valid ? 0x5dff8a : 0xff4a3a);
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
