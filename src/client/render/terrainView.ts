import * as THREE from 'three';
import { hash2Unit } from '../../engine/core/random';
import { TileKind, type Terrain } from '../../engine/world/terrain';
import type { FogOfWarTexture } from './fogMaterial';
import type { HeightField } from './heightField';
import { TILE_COLORS } from './palette';

interface ChunkView {
  readonly group: THREE.Group;
  readonly ground: THREE.Mesh;
}

/**
 * Streams terrain chunk meshes around the camera: only chunks near the view are built and kept,
 * so the cost of rendering does not grow with the size of the planet.
 */
export class TerrainView {
  readonly root = new THREE.Group();
  private readonly chunks = new Map<string, ChunkView>();
  private readonly groundMaterial: THREE.MeshLambertMaterial;
  private readonly rockMaterial: THREE.MeshLambertMaterial;
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.45, 0);

  constructor(
    private readonly terrain: Terrain,
    private readonly heights: HeightField,
    fog: FogOfWarTexture,
  ) {
    this.groundMaterial = fog.apply(new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.rockMaterial = fog.apply(new THREE.MeshLambertMaterial({ color: 0x6b5a50, flatShading: true }));
  }

  get loadedChunks(): number {
    return this.chunks.size;
  }

  /** Ensures chunks within `radius` tiles of (x, z) exist and releases distant ones. */
  update(x: number, z: number, radius: number): void {
    const size = this.terrain.chunkSize;
    for (let cy = 0; cy < this.terrain.chunksY; cy++) {
      for (let cx = 0; cx < this.terrain.chunksX; cx++) {
        const d = Math.hypot((cx + 0.5) * size - x, (cy + 0.5) * size - z);
        const key = `${cx},${cy}`;
        if (d <= radius + size) this.ensureChunk(key, cx, cy);
        else if (d > radius * 1.5 + size) this.releaseChunk(key);
      }
    }
  }

  /** Ray intersection with the loaded ground meshes. */
  raycast(raycaster: THREE.Raycaster): THREE.Vector3 | null {
    const meshes = [...this.chunks.values()].map((c) => c.ground);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.point : null;
  }

  private ensureChunk(key: string, cx: number, cy: number): void {
    if (this.chunks.has(key)) return;
    const group = new THREE.Group();
    const ground = new THREE.Mesh(this.buildGroundGeometry(cx, cy), this.groundMaterial);
    group.add(ground);
    const rocks = this.buildRocks(cx, cy);
    if (rocks) group.add(rocks);
    this.root.add(group);
    this.chunks.set(key, { group, ground });
  }

  private releaseChunk(key: string): void {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.root.remove(chunk.group);
    chunk.ground.geometry.dispose();
    this.chunks.delete(key);
  }

  private buildGroundGeometry(cx: number, cy: number): THREE.BufferGeometry {
    const size = this.terrain.chunkSize;
    const side = size + 1;
    const positions = new Float32Array(side * side * 3);
    const colors = new Float32Array(side * side * 3);
    const color = new THREE.Color();
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const x = cx * size + i;
        const y = cy * size + j;
        const v = (j * side + i) * 3;
        positions.set([x, this.heights.cornerHeight(x, y), y], v);
        this.cornerColor(x, y, color);
        colors.set([color.r, color.g, color.b], v);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(gridIndices(size));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private cornerColor(x: number, y: number, out: THREE.Color): void {
    const tile = new THREE.Color();
    out.setRGB(0, 0, 0);
    let count = 0;
    for (const [tx, ty] of [
      [x - 1, y - 1],
      [x, y - 1],
      [x - 1, y],
      [x, y],
    ] as const) {
      if (!this.terrain.inBounds(tx, ty)) continue;
      tile.setHex(TILE_COLORS[this.terrain.kindAt(tx, ty)]);
      out.add(tile);
      count++;
    }
    const jitter = 0.92 + hash2Unit(this.terrain.seed + 991, x, y) * 0.16;
    out.multiplyScalar(jitter / Math.max(1, count));
  }

  private buildRocks(cx: number, cy: number): THREE.InstancedMesh | null {
    const size = this.terrain.chunkSize;
    const tiles: [number, number][] = [];
    for (let y = cy * size; y < (cy + 1) * size; y++) {
      for (let x = cx * size; x < (cx + 1) * size; x++) {
        if (this.terrain.inBounds(x, y) && this.terrain.kindAt(x, y) === TileKind.Rock) tiles.push([x, y]);
      }
    }
    if (tiles.length === 0) return null;
    const mesh = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, tiles.length);
    const matrix = new THREE.Matrix4();
    tiles.forEach(([x, y], i) => {
      const r = hash2Unit(this.terrain.seed + 997, x, y);
      const scale = 0.8 + r * 0.7;
      matrix.compose(
        new THREE.Vector3(x + 0.5, this.heights.heightAt(x + 0.5, y + 0.5) + 0.15, y + 0.5),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r * 3, r * 7, r * 5)),
        new THREE.Vector3(scale, scale * 0.8, scale),
      );
      mesh.setMatrixAt(i, matrix);
    });
    return mesh;
  }
}

function gridIndices(size: number): number[] {
  const side = size + 1;
  const indices: number[] = [];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = j * side + i;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return indices;
}
