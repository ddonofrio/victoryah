/** An entity projected to screen space for picking. */
export interface ScreenEntity {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
  /** Owned by the local player (only own entities can be box-selected and commanded). */
  readonly own: boolean;
  /** Mobile units take precedence over structures in box selections. */
  readonly mobile: boolean;
}

export interface ScreenRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export type SelectionMode = 'replace' | 'add' | 'toggle';

/** The entity nearest to the cursor whose screen footprint (plus tolerance) contains it. */
export function pickEntity(
  items: readonly ScreenEntity[],
  px: number,
  py: number,
  tolerancePx = 6,
): number | undefined {
  let best: number | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - px, item.y - py);
    if (d <= item.radiusPx + tolerancePx && d < bestDistance) {
      bestDistance = d;
      best = item.id;
    }
  }
  return best;
}

/** Own entities inside a drag rectangle; mobile units win over structures when both are present. */
export function boxSelect(items: readonly ScreenEntity[], rect: ScreenRect): number[] {
  const minX = Math.min(rect.x0, rect.x1);
  const maxX = Math.max(rect.x0, rect.x1);
  const minY = Math.min(rect.y0, rect.y1);
  const maxY = Math.max(rect.y0, rect.y1);
  const inside = items.filter((i) => i.own && i.x >= minX && i.x <= maxX && i.y >= minY && i.y <= maxY);
  const mobile = inside.filter((i) => i.mobile);
  return (mobile.length > 0 ? mobile : inside).map((i) => i.id).sort((a, b) => a - b);
}

export function applySelection(
  current: ReadonlySet<number>,
  picked: readonly number[],
  mode: SelectionMode,
): Set<number> {
  if (mode === 'replace') return new Set(picked);
  const next = new Set(current);
  for (const id of picked) {
    if (mode === 'toggle' && next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}
