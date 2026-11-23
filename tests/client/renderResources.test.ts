import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { disposeGeometries } from '../../src/client/render/dispose';
import { EffectsView } from '../../src/client/render/effectsView';
import { HeightField } from '../../src/client/render/heightField';
import { TerrainView } from '../../src/client/render/terrainView';
import { FogOfWarTexture } from '../../src/client/render/fogMaterial';
import { UnitView } from '../../src/client/render/unitView';
import { Terrain } from '../../src/engine/world/terrain';
import { createTestSim } from '../engine/fixtures';

/** Records which GPU-backed resources receive a dispose call. */
function watchDisposal(resources: Iterable<THREE.BufferGeometry | THREE.Material>): Set<unknown> {
  const disposed = new Set<unknown>();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource));
  return disposed;
}

function meshesOf(root: THREE.Object3D): (THREE.Mesh | THREE.Line)[] {
  const meshes: (THREE.Mesh | THREE.Line)[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) meshes.push(object);
  });
  return meshes;
}

const flatHeights = () => new HeightField(new Terrain({ seed: 1, width: 64, height: 64 }));

describe('disposeGeometries', () => {
  it('releases every geometry below an object and leaves shared materials alone', () => {
    const material = new THREE.MeshBasicMaterial();
    const group = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), material), inner);
    const geometries = meshesOf(group).map((m) => m.geometry);
    const disposed = watchDisposal([...geometries, material]);
    disposeGeometries(group);
    expect(geometries.every((g) => disposed.has(g))).toBe(true);
    expect(disposed.has(material)).toBe(false);
  });
});

describe('UnitView resources', () => {
  it('releases the geometries of a unit that leaves the perceived world', () => {
    const sim = createTestSim();
    sim.world.spawn('scout', 1, 10.5, 10.5);
    const enemy = sim.world.spawn('soldier', 2, 12.5, 10.5);
    sim.step();
    const view = new UnitView(sim.world, 1, flatHeights());
    view.sync();
    const before = meshesOf(view.root).map((m) => m.geometry);
    const disposed = watchDisposal(before);
    sim.world.remove(enemy.id);
    view.sync();
    const remaining = new Set(meshesOf(view.root).map((m) => m.geometry));
    const dropped = before.filter((g) => !remaining.has(g));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((g) => disposed.has(g))).toBe(true);
    expect([...remaining].some((g) => disposed.has(g))).toBe(false);
  });
});

describe('EffectsView resources', () => {
  it('releases the per-effect resources of finished effects', () => {
    const effects = new EffectsView(flatHeights());
    effects.shot(new THREE.Vector3(1, 0, 1), new THREE.Vector3(4, 0, 1), 'bullet');
    effects.marker('move', 5, 5);
    const objects = meshesOf(effects.root);
    const tracer = objects.find((o) => o instanceof THREE.Line)!;
    const materials = objects.map((o) => o.material as THREE.Material);
    const disposed = watchDisposal([tracer.geometry, ...materials]);
    effects.update(5);
    expect(effects.root.children).toHaveLength(0);
    expect(disposed.has(tracer.geometry)).toBe(true);
    expect(materials.every((m) => disposed.has(m))).toBe(true);
  });

  it('keeps the geometries shared between effects usable', () => {
    const effects = new EffectsView(flatHeights());
    effects.marker('move', 5, 5);
    const shared = (effects.root.children[0] as THREE.Mesh).geometry;
    const disposed = watchDisposal([shared]);
    effects.update(5);
    expect(disposed.has(shared)).toBe(false);
  });
});

describe('TerrainView resources', () => {
  it('releases ground and rock resources of chunks that scroll out of range', () => {
    const terrain = new Terrain({ seed: 2026, width: 256, height: 256 });
    const view = new TerrainView(terrain, new HeightField(terrain), new FogOfWarTexture(256, 256));
    view.update(128, 128, 400);
    const instanced = meshesOf(view.root).filter((m): m is THREE.InstancedMesh => m instanceof THREE.InstancedMesh);
    expect(instanced.length).toBeGreaterThan(0);
    const released: THREE.InstancedMesh[] = [];
    for (const mesh of instanced) mesh.addEventListener('dispose', () => released.push(mesh));
    const grounds = meshesOf(view.root)
      .filter((m) => !(m instanceof THREE.InstancedMesh))
      .map((m) => m.geometry);
    const disposed = watchDisposal(grounds);
    view.update(-5000, -5000, 10);
    expect(view.loadedChunks).toBe(0);
    expect(grounds.every((g) => disposed.has(g))).toBe(true);
    expect(released).toHaveLength(instanced.length);
  });
});
