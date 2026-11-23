import { describe, expect, it } from 'vitest';
import { Terrain, TileKind, isWalkableKind } from '../../src/engine/world/terrain';

const SIZE = 192;

function snapshotRegion(t: Terrain, x0: number, y0: number, w: number, h: number): string {
  const parts: string[] = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) parts.push(`${t.kindAt(x, y)}:${t.elevationAt(x, y).toFixed(4)}`);
  }
  return parts.join(',');
}

/** Size of the largest 4-connected walkable region (flood fill). */
function largestWalkableRegion(t: Terrain, size: number): number {
  const seen = new Uint8Array(size * size);
  let largest = 0;
  for (let s = 0; s < size * size; s++) {
    if (seen[s] || !t.isWalkable(s % size, Math.floor(s / size))) continue;
    largest = Math.max(largest, floodFill(t, size, s, seen));
  }
  return largest;
}

function floodFill(t: Terrain, size: number, start: number, seen: Uint8Array): number {
  let count = 0;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    count++;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = ny * size + nx;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && !seen[ni] && t.isWalkable(nx, ny)) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return count;
}

describe('Terrain generation', () => {
  it('reproduces the same planetary surface from the same seed', () => {
    const a = new Terrain({ seed: 2026, width: SIZE, height: SIZE });
    const b = new Terrain({ seed: 2026, width: SIZE, height: SIZE });
    expect(snapshotRegion(a, 0, 0, SIZE, SIZE)).toBe(snapshotRegion(b, 0, 0, SIZE, SIZE));
  });

  it('produces a different surface for a different seed', () => {
    const a = new Terrain({ seed: 1, width: SIZE, height: SIZE });
    const b = new Terrain({ seed: 2, width: SIZE, height: SIZE });
    expect(snapshotRegion(a, 0, 0, SIZE, SIZE)).not.toBe(snapshotRegion(b, 0, 0, SIZE, SIZE));
  });

  it('generates chunks lazily and independently of access order', () => {
    const a = new Terrain({ seed: 77, width: SIZE, height: SIZE, chunkSize: 32 });
    expect(a.loadedChunkCount).toBe(0);
    const far = snapshotRegion(a, 160, 160, 16, 16);
    expect(a.loadedChunkCount).toBe(1);

    const b = new Terrain({ seed: 77, width: SIZE, height: SIZE, chunkSize: 32 });
    snapshotRegion(b, 0, 0, 100, 100);
    expect(snapshotRegion(b, 160, 160, 16, 16)).toBe(far);
  });
});

describe('Terrain features', () => {
  it('contains every terrain feature on a planet-sized map', () => {
    const t = new Terrain({ seed: 2026, width: 256, height: 256 });
    const seen = new Set<TileKind>();
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) seen.add(t.kindAt(x, y));
    for (const kind of [
      TileKind.Plains,
      TileKind.Highland,
      TileKind.Rock,
      TileKind.Mountain,
      TileKind.Cliff,
      TileKind.CraterRim,
      TileKind.CraterFloor,
    ]) {
      expect(seen.has(kind), TileKind[kind]).toBe(true);
    }
  });

  it('marks obstacles as non-walkable and open ground as walkable', () => {
    expect(isWalkableKind(TileKind.Plains)).toBe(true);
    expect(isWalkableKind(TileKind.Highland)).toBe(true);
    expect(isWalkableKind(TileKind.CraterFloor)).toBe(true);
    expect(isWalkableKind(TileKind.Rock)).toBe(false);
    expect(isWalkableKind(TileKind.Mountain)).toBe(false);
    expect(isWalkableKind(TileKind.Cliff)).toBe(false);
    expect(isWalkableKind(TileKind.CraterRim)).toBe(false);
  });

  it('treats tiles outside the map as non-walkable', () => {
    const t = new Terrain({ seed: 3, width: 64, height: 64 });
    expect(t.isWalkable(-1, 5)).toBe(false);
    expect(t.isWalkable(5, 64)).toBe(false);
  });
});

describe('Terrain traversability', () => {
  it('is predominantly open and connected ground', () => {
    const t = new Terrain({ seed: 2026, width: 256, height: 256 });
    let walkable = 0;
    let start = -1;
    for (let i = 0; i < 256 * 256; i++) {
      if (t.isWalkable(i % 256, Math.floor(i / 256))) {
        walkable++;
        if (start < 0) start = i;
      }
    }
    expect(walkable / (256 * 256)).toBeGreaterThan(0.6);
    expect(walkable / (256 * 256)).toBeLessThan(0.92);

    const largest = largestWalkableRegion(t, 256);
    expect(largest / walkable).toBeGreaterThan(0.9);
  });

  it('keeps walkable ground predominantly flat', () => {
    const t = new Terrain({ seed: 9, width: 128, height: 128 });
    for (let y = 0; y < 128; y += 3) {
      for (let x = 0; x < 128; x += 3) {
        if (t.isWalkable(x, y)) expect(Math.abs(t.elevationAt(x, y))).toBeLessThan(1.5);
      }
    }
  });
});
