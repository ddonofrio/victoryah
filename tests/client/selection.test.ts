import { describe, expect, it } from 'vitest';
import { applySelection, boxSelect, pickEntity, type ScreenEntity } from '../../src/client/input/selection';

const item = (id: number, x: number, y: number, extra: Partial<ScreenEntity> = {}): ScreenEntity => ({
  id,
  x,
  y,
  radiusPx: 10,
  own: true,
  mobile: true,
  ...extra,
});

describe('pickEntity', () => {
  it('returns the nearest entity under the cursor', () => {
    const items = [item(1, 100, 100), item(2, 112, 100)];
    expect(pickEntity(items, 109, 100)).toBe(2);
    expect(pickEntity(items, 101, 101)).toBe(1);
  });

  it('returns undefined when nothing is close enough', () => {
    expect(pickEntity([item(1, 100, 100)], 140, 140)).toBeUndefined();
  });
});

describe('boxSelect', () => {
  it('selects own entities inside the rectangle in any drag direction', () => {
    const items = [item(1, 10, 10), item(2, 50, 50), item(3, 200, 200), item(4, 20, 20, { own: false })];
    expect(boxSelect(items, { x0: 60, y0: 60, x1: 0, y1: 0 })).toEqual([1, 2]);
  });

  it('prefers mobile units over structures', () => {
    const items = [item(1, 10, 10), item(2, 20, 20, { mobile: false })];
    expect(boxSelect(items, { x0: 0, y0: 0, x1: 30, y1: 30 })).toEqual([1]);
    expect(boxSelect([item(2, 20, 20, { mobile: false })], { x0: 0, y0: 0, x1: 30, y1: 30 })).toEqual([2]);
  });
});

describe('applySelection', () => {
  it('replaces, adds and toggles', () => {
    const current = new Set([1, 2]);
    expect([...applySelection(current, [3], 'replace')]).toEqual([3]);
    expect([...applySelection(current, [3], 'add')].sort()).toEqual([1, 2, 3]);
    expect([...applySelection(current, [2, 3], 'toggle')].sort()).toEqual([1, 3]);
  });
});
