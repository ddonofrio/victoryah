import { fbm, valueNoise } from '../core/noise';
import { hash2, hash2Unit } from '../core/random';

/**
 * Tile categories of the planetary surface. Values are persisted and used by renderers, so new
 * kinds must be appended rather than reordered.
 */
export enum TileKind {
  Plains = 0,
  Highland = 1,
  Rock = 2,
  Mountain = 3,
  Cliff = 4,
  CraterRim = 5,
  CraterFloor = 6,
}

const WALKABLE: ReadonlySet<TileKind> = new Set([TileKind.Plains, TileKind.Highland, TileKind.CraterFloor]);

export function isWalkableKind(kind: TileKind): boolean {
  return WALKABLE.has(kind);
}

export interface TerrainConfig {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** Side length, in tiles, of a lazily generated chunk. */
  readonly chunkSize?: number;
}

export interface TerrainChunk {
  readonly cx: number;
  readonly cy: number;
  readonly kinds: Uint8Array;
  readonly elevation: Float32Array;
}

interface TileSample {
  kind: TileKind;
  elevation: number;
}

// Generation parameters. Kept together so balancing does not require touching the algorithm.
const BASE_SCALE = 1 / 42;
const MOUNTAIN_THRESHOLD = 0.665;
const CLIFF_THRESHOLD = 0.635;
const HIGHLAND_THRESHOLD = 0.56;
const CRATER_CELL = 26;
const CRATER_CHANCE = 0.45;
const CRATER_MIN_RADIUS = 3;
const CRATER_MAX_RADIUS = 7;
const CRATER_GAP_HALF_ANGLE = 0.55;

/**
 * Samples one tile of the surface. A pure function of (seed, x, y): chunks can therefore be
 * generated in any order, on demand, on the client or on a server, with identical results.
 */
export function sampleTile(seed: number, x: number, y: number): TileSample {
  const h = fbm(seed, x * BASE_SCALE, y * BASE_SCALE, 4);
  const undulation = (fbm(seed + 17, x / 9, y / 9, 2) - 0.5) * 0.35;

  if (h >= MOUNTAIN_THRESHOLD) {
    return { kind: TileKind.Mountain, elevation: 2.2 + (h - MOUNTAIN_THRESHOLD) * 40 + undulation * 2 };
  }
  if (h >= CLIFF_THRESHOLD) {
    return { kind: TileKind.Cliff, elevation: 1.4 + (h - CLIFF_THRESHOLD) * 20 };
  }

  const crater = sampleCrater(seed, x, y);
  if (crater) return crater;

  if (isRock(seed, x, y)) return { kind: TileKind.Rock, elevation: 0.9 + hash2Unit(seed + 5, x, y) * 0.5 };

  if (h >= HIGHLAND_THRESHOLD) {
    return { kind: TileKind.Highland, elevation: 0.35 + (h - HIGHLAND_THRESHOLD) * 4 + undulation };
  }
  return { kind: TileKind.Plains, elevation: undulation };
}

function isRock(seed: number, x: number, y: number): boolean {
  const cluster = valueNoise(seed + 31, x / 5, y / 5);
  const r = hash2Unit(seed + 37, x, y);
  return (cluster > 0.86 && r < 0.5) || r < 0.004;
}

function sampleCrater(seed: number, x: number, y: number): TileSample | null {
  const cellX = Math.floor(x / CRATER_CELL);
  const cellY = Math.floor(y / CRATER_CELL);
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = cellX + ox;
      const cy = cellY + oy;
      const h = hash2(seed + 101, cx, cy);
      if ((h % 1000) / 1000 >= CRATER_CHANCE) continue;
      const radius = CRATER_MIN_RADIUS + (hash2(seed + 103, cx, cy) % (CRATER_MAX_RADIUS - CRATER_MIN_RADIUS + 1));
      const margin = radius + 2;
      const span = CRATER_CELL - 2 * margin;
      const centerX = cx * CRATER_CELL + margin + hash2Unit(seed + 107, cx, cy) * span + 0.5;
      const centerY = cy * CRATER_CELL + margin + hash2Unit(seed + 109, cx, cy) * span + 0.5;
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const d = Math.hypot(dx, dy);
      if (d > radius + 0.5) continue;
      if (d <= radius - 0.75) {
        const depth = 1 - (d / radius) ** 2;
        return { kind: TileKind.CraterFloor, elevation: -0.9 * depth };
      }
      const gapAngle = hash2Unit(seed + 113, cx, cy) * Math.PI * 2;
      let delta = Math.abs(Math.atan2(dy, dx) - gapAngle);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      if (delta < CRATER_GAP_HALF_ANGLE) return { kind: TileKind.CraterFloor, elevation: -0.1 };
      return { kind: TileKind.CraterRim, elevation: 0.9 };
    }
  }
  return null;
}

/**
 * The planetary surface. Chunks are generated lazily on first access and cached; the renderer
 * and pathfinder only touch the chunks they need, so large planets never require the whole
 * surface to be generated or rendered at once.
 */
export class Terrain {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  private readonly chunks = new Map<number, TerrainChunk>();

  constructor(config: TerrainConfig) {
    this.seed = config.seed;
    this.width = config.width;
    this.height = config.height;
    this.chunkSize = config.chunkSize ?? 32;
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  get chunksX(): number {
    return Math.ceil(this.width / this.chunkSize);
  }

  get chunksY(): number {
    return Math.ceil(this.height / this.chunkSize);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  kindAt(x: number, y: number): TileKind {
    if (!this.inBounds(x, y)) return TileKind.Mountain;
    const chunk = this.chunkAtTile(x, y);
    return chunk.kinds[this.localIndex(x, y)] as TileKind;
  }

  elevationAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    const chunk = this.chunkAtTile(x, y);
    return chunk.elevation[this.localIndex(x, y)] ?? 0;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && isWalkableKind(this.kindAt(x, y));
  }

  /** Returns (generating if needed) the chunk with chunk coordinates (cx, cy). */
  chunk(cx: number, cy: number): TerrainChunk {
    const key = cy * 65536 + cx;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private chunkAtTile(x: number, y: number): TerrainChunk {
    return this.chunk(Math.floor(x / this.chunkSize), Math.floor(y / this.chunkSize));
  }

  private localIndex(x: number, y: number): number {
    return (y % this.chunkSize) * this.chunkSize + (x % this.chunkSize);
  }

  private generateChunk(cx: number, cy: number): TerrainChunk {
    const size = this.chunkSize;
    const kinds = new Uint8Array(size * size);
    const elevation = new Float32Array(size * size);
    for (let ly = 0; ly < size; ly++) {
      for (let lx = 0; lx < size; lx++) {
        const sample = sampleTile(this.seed, cx * size + lx, cy * size + ly);
        kinds[ly * size + lx] = sample.kind;
        elevation[ly * size + lx] = sample.elevation;
      }
    }
    return { cx, cy, kinds, elevation };
  }
}
