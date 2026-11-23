import * as THREE from 'three';
import type { ResourceKind } from '../../engine/sim/definitions';
import type { Deposit, PlayerId } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';
import type { HeightField } from './heightField';
import { RESOURCE_COLORS } from './palette';

interface DepositVisual {
  readonly group: THREE.Group;
  readonly initial: number;
}

/** Shows the resource deposits the local player knows about (explored and, if underground, revealed). */
export class DepositView {
  readonly root = new THREE.Group();
  private readonly visuals = new Map<number, DepositVisual>();
  private readonly materials: Record<ResourceKind, THREE.Material>;
  private readonly rockMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3a34, flatShading: true });
  private readonly crystalGeometry = new THREE.OctahedronGeometry(0.22, 0);
  private readonly chunkGeometry = new THREE.DodecahedronGeometry(0.25, 0);

  constructor(
    private readonly world: World,
    private readonly localPlayer: PlayerId,
    private readonly heights: HeightField,
  ) {
    this.materials = {
      crystal: new THREE.MeshLambertMaterial({ color: RESOURCE_COLORS.crystal, emissive: 0x1a6a78, flatShading: true }),
      ore: new THREE.MeshLambertMaterial({ color: RESOURCE_COLORS.ore, emissive: 0x5a2008, flatShading: true }),
      energy: new THREE.MeshBasicMaterial({ color: RESOURCE_COLORS.energy, transparent: true, opacity: 0.75 }),
      salvage: new THREE.MeshLambertMaterial({ color: RESOURCE_COLORS.salvage, flatShading: true }),
    };
  }

  update(time: number): void {
    const known = new Set<number>();
    for (const deposit of this.world.knownDeposits(this.localPlayer)) {
      known.add(deposit.id);
      const visual = this.visuals.get(deposit.id) ?? this.create(deposit);
      const fraction = Math.max(0.25, Math.sqrt(deposit.amount / visual.initial));
      visual.group.scale.setScalar(fraction);
      if (deposit.kind === 'energy') visual.group.children[0]!.scale.y = 1 + Math.sin(time * 3 + deposit.id) * 0.25;
    }
    for (const [id, visual] of this.visuals) {
      if (known.has(id)) continue;
      this.root.remove(visual.group);
      this.visuals.delete(id);
    }
  }

  private create(deposit: Deposit): DepositVisual {
    const group = this.buildShape(deposit);
    group.position.set(deposit.x, this.heights.heightAt(deposit.x, deposit.y), deposit.y);
    group.rotation.y = (deposit.id * 1.7) % (Math.PI * 2);
    this.root.add(group);
    const visual = { group, initial: Math.max(deposit.amount, 1) };
    this.visuals.set(deposit.id, visual);
    return visual;
  }

  private buildShape(deposit: Deposit): THREE.Group {
    const group = new THREE.Group();
    const material = this.materials[deposit.kind];
    if (deposit.kind === 'energy') {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 1.2, 8, 1, true), material);
      column.position.y = 0.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 16).rotateX(Math.PI / 2), this.rockMaterial);
      group.add(column, ring);
      return group;
    }
    const geometry = deposit.kind === 'crystal' ? this.crystalGeometry : this.chunkGeometry;
    const pieces = deposit.kind === 'crystal' ? 4 : 3;
    for (let i = 0; i < pieces; i++) {
      const angle = (i / pieces) * Math.PI * 2;
      const mesh = new THREE.Mesh(geometry, i === 0 && deposit.kind === 'ore' ? this.rockMaterial : material);
      mesh.position.set(Math.cos(angle) * 0.22, 0.2 + (i % 2) * 0.08, Math.sin(angle) * 0.22);
      if (deposit.kind === 'crystal') mesh.scale.set(0.8, 1.8 + (i % 3) * 0.5, 0.8);
      group.add(mesh);
    }
    return group;
  }
}
