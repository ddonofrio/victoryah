/**
 * Uniform-grid spatial hash for point entities. Range queries (targeting, visibility, picking)
 * touch only nearby cells instead of every entity on the planet. Results are sorted by id so the
 * simulation stays deterministic regardless of insertion history.
 */
export class SpatialGrid {
  private readonly cells = new Map<string, Set<number>>();
  private readonly positions = new Map<number, { x: number; y: number; cell: string }>();

  constructor(private readonly cellSize: number) {}

  get size(): number {
    return this.positions.size;
  }

  insert(id: number, x: number, y: number): void {
    const cell = this.cellKey(x, y);
    this.positions.set(id, { x, y, cell });
    this.bucket(cell).add(id);
  }

  move(id: number, x: number, y: number): void {
    const entry = this.positions.get(id);
    if (!entry) {
      this.insert(id, x, y);
      return;
    }
    const cell = this.cellKey(x, y);
    if (cell !== entry.cell) {
      this.cells.get(entry.cell)?.delete(id);
      this.bucket(cell).add(id);
      entry.cell = cell;
    }
    entry.x = x;
    entry.y = y;
  }

  remove(id: number): void {
    const entry = this.positions.get(id);
    if (!entry) return;
    this.cells.get(entry.cell)?.delete(id);
    this.positions.delete(id);
  }

  queryRadius(x: number, y: number, radius: number): number[] {
    const result: number[] = [];
    const r2 = radius * radius;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          const p = this.positions.get(id)!;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2 + 1e-9) result.push(id);
        }
      }
    }
    return result.sort((a, b) => a - b);
  }

  private cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  private bucket(cell: string): Set<number> {
    let set = this.cells.get(cell);
    if (!set) {
      set = new Set();
      this.cells.set(cell, set);
    }
    return set;
  }
}
