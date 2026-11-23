import type { Terrain } from '../../engine/world/terrain';

/**
 * Smooth render heights derived from tile elevations: each tile corner takes the average of the
 * tiles touching it, and points in between are interpolated bilinearly. Units and the terrain
 * mesh use the same function so models sit exactly on the ground.
 */
export class HeightField {
  constructor(private readonly terrain: Terrain) {}

  cornerHeight(cx: number, cy: number): number {
    let sum = 0;
    let count = 0;
    for (const [tx, ty] of [
      [cx - 1, cy - 1],
      [cx, cy - 1],
      [cx - 1, cy],
      [cx, cy],
    ] as const) {
      if (!this.terrain.inBounds(tx, ty)) continue;
      sum += this.terrain.elevationAt(tx, ty);
      count++;
    }
    return count > 0 ? sum / count : 0;
  }

  heightAt(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const top = this.cornerHeight(x0, y0) * (1 - fx) + this.cornerHeight(x0 + 1, y0) * fx;
    const bottom = this.cornerHeight(x0, y0 + 1) * (1 - fx) + this.cornerHeight(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }
}
