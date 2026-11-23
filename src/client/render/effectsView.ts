import * as THREE from 'three';
import type { HeightField } from './heightField';

/** A GPU-backed resource owned by a single effect and released when the effect ends. */
type Disposable = THREE.Material | THREE.BufferGeometry;

interface Effect {
  readonly object: THREE.Object3D;
  readonly duration: number;
  age: number;
  readonly update: (t: number) => void;
  readonly owned: readonly Disposable[];
}

const MARKER_COLORS = { move: 0x5dff8a, attack: 0xff4a3a, interact: 0xffd34a } as const;
export type MarkerKind = keyof typeof MARKER_COLORS;

/** Short-lived visual feedback: weapon tracers, explosions and command markers. */
export class EffectsView {
  readonly root = new THREE.Group();
  private effects: Effect[] = [];
  private readonly flashGeometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly ringGeometry = new THREE.RingGeometry(0.5, 0.62, 32).rotateX(-Math.PI / 2);

  constructor(private readonly heights: HeightField) {}

  update(dt: number): void {
    this.effects = this.effects.filter((effect) => {
      effect.age += dt;
      const t = Math.min(1, effect.age / effect.duration);
      effect.update(t);
      if (t < 1) return true;
      this.root.remove(effect.object);
      for (const resource of effect.owned) resource.dispose();
      return false;
    });
  }

  marker(kind: MarkerKind, x: number, y: number): void {
    const material = new THREE.MeshBasicMaterial({ color: MARKER_COLORS[kind], transparent: true });
    const ring = new THREE.Mesh(this.ringGeometry, material);
    ring.position.set(x, this.heights.heightAt(x, y) + 0.08, y);
    this.spawn(ring, 0.6, [material], (t) => {
      ring.scale.setScalar(1.6 - t * 1.2);
      material.opacity = 1 - t;
    });
  }

  shot(from: THREE.Vector3, to: THREE.Vector3, visual: string): void {
    const color = visual === 'flak' ? 0xb0d0ff : visual === 'bullet' ? 0xffe08a : 0xffa040;
    const arc = visual === 'artillery' ? 3 : visual === 'cannon' ? 0.4 : 0;
    if (arc === 0) this.tracer(from, to, color);
    else this.projectile(from, to, color, arc, visual === 'artillery' ? 0.6 : 0.25);
    this.flash(from, color, 0.18, 0.1);
  }

  explosion(at: THREE.Vector3, size: number): void {
    const fire = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true });
    const ball = new THREE.Mesh(this.flashGeometry, fire);
    ball.position.copy(at).setY(at.y + 0.4);
    this.spawn(ball, 0.7, [fire], (t) => {
      ball.scale.setScalar(size * (0.3 + t));
      fire.opacity = 1 - t;
      fire.color.setHSL(0.08 - t * 0.08, 1, 0.6 - t * 0.4);
    });
  }

  private tracer(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const material = new THREE.LineBasicMaterial({ color, transparent: true });
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.spawn(new THREE.Line(geometry, material), 0.12, [geometry, material], (t) => (material.opacity = 1 - t));
  }

  private projectile(from: THREE.Vector3, to: THREE.Vector3, color: number, arc: number, duration: number): void {
    const material = new THREE.MeshBasicMaterial({ color });
    const shell = new THREE.Mesh(this.flashGeometry, material);
    shell.scale.setScalar(0.09);
    this.spawn(shell, duration, [material], (t) => {
      shell.position.lerpVectors(from, to, t);
      shell.position.y += Math.sin(t * Math.PI) * arc;
      if (t >= 1) this.flash(to, color, 0.35, 0.2);
    });
  }

  private flash(at: THREE.Vector3, color: number, size: number, duration: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    const mesh = new THREE.Mesh(this.flashGeometry, material);
    mesh.position.copy(at);
    mesh.scale.setScalar(size);
    this.spawn(mesh, duration, [material], (t) => (material.opacity = 1 - t));
  }

  /** Starts an effect; `owned` lists the resources created for it alone (never the shared geometries). */
  private spawn(
    object: THREE.Object3D,
    duration: number,
    owned: readonly Disposable[],
    update: (t: number) => void,
  ): void {
    update(0);
    this.root.add(object);
    this.effects.push({ object, duration, age: 0, update, owned });
  }
}
