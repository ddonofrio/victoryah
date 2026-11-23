export enum FogState {
  Unexplored = 0,
  Explored = 1,
  Visible = 2,
}

/**
 * Per-player fog of war. Each update cycle recomputes the currently visible tiles from the
 * player's sensors, while explored tiles are remembered permanently. Every player owns an
 * independent map, so players sharing a planet never see each other's knowledge.
 */
export class VisibilityMap {
  private readonly visible: Uint8Array;
  private readonly explored: Uint8Array;
  private previous: Uint8Array;
  private changed = false;
  private versionCounter = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.visible = new Uint8Array(width * height);
    this.explored = new Uint8Array(width * height);
    this.previous = new Uint8Array(width * height);
  }

  static fromExplored(width: number, height: number, explored: Uint8Array): VisibilityMap {
    const map = new VisibilityMap(width, height);
    map.explored.set(explored);
    return map;
  }

  /** Incremented whenever any tile changes state; lets renderers skip redundant uploads. */
  get version(): number {
    return this.versionCounter;
  }

  beginUpdate(): void {
    this.previous = this.visible.slice();
    this.visible.fill(0);
    this.changed = false;
  }

  reveal(cx: number, cy: number, radius: number): void {
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.floor(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.floor(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r2) continue;
        const i = y * this.width + x;
        this.visible[i] = 1;
        if (!this.explored[i]) {
          this.explored[i] = 1;
          this.changed = true;
        }
      }
    }
  }

  endUpdate(): void {
    if (!this.changed) {
      for (let i = 0; i < this.visible.length; i++) {
        if (this.visible[i] !== this.previous[i]) {
          this.changed = true;
          break;
        }
      }
    }
    if (this.changed) this.versionCounter++;
  }

  stateAt(x: number, y: number): FogState {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return FogState.Unexplored;
    const i = y * this.width + x;
    if (this.visible[i]) return FogState.Visible;
    return this.explored[i] ? FogState.Explored : FogState.Unexplored;
  }

  isVisible(x: number, y: number): boolean {
    return this.stateAt(Math.floor(x), Math.floor(y)) === FogState.Visible;
  }

  isExplored(x: number, y: number): boolean {
    return this.stateAt(Math.floor(x), Math.floor(y)) !== FogState.Unexplored;
  }

  exportExplored(): Uint8Array {
    return this.explored.slice();
  }
}
