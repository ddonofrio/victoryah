import { describe, expect, it } from 'vitest';
import { FogState, VisibilityMap } from '../../src/engine/world/visibility';

describe('VisibilityMap', () => {
  it('starts completely unexplored', () => {
    const map = new VisibilityMap(16, 16);
    expect(map.stateAt(3, 3)).toBe(FogState.Unexplored);
    expect(map.isVisible(3, 3)).toBe(false);
  });

  it('reveals a circular area as visible and explored', () => {
    const map = new VisibilityMap(32, 32);
    map.beginUpdate();
    map.reveal(10.5, 10.5, 3);
    map.endUpdate();
    expect(map.stateAt(10, 10)).toBe(FogState.Visible);
    expect(map.stateAt(13, 10)).toBe(FogState.Visible);
    expect(map.stateAt(14, 10)).toBe(FogState.Unexplored);
    expect(map.stateAt(13, 13)).toBe(FogState.Unexplored);
  });

  it('downgrades previously visible tiles to explored on the next update', () => {
    const map = new VisibilityMap(32, 32);
    map.beginUpdate();
    map.reveal(5.5, 5.5, 2);
    map.endUpdate();
    map.beginUpdate();
    map.reveal(20.5, 20.5, 2);
    map.endUpdate();
    expect(map.stateAt(5, 5)).toBe(FogState.Explored);
    expect(map.isVisible(5, 5)).toBe(false);
    expect(map.isExplored(5, 5)).toBe(true);
    expect(map.stateAt(20, 20)).toBe(FogState.Visible);
  });
});

describe('VisibilityMap boundaries and persistence', () => {
  it('clips reveals at the map border and reports out-of-bounds as unexplored', () => {
    const map = new VisibilityMap(8, 8);
    map.beginUpdate();
    map.reveal(0, 0, 4);
    map.endUpdate();
    expect(map.stateAt(0, 0)).toBe(FogState.Visible);
    expect(map.stateAt(-1, 0)).toBe(FogState.Unexplored);
  });

  it('increments its version only when the fog actually changes', () => {
    const map = new VisibilityMap(16, 16);
    const v0 = map.version;
    map.beginUpdate();
    map.reveal(4, 4, 2);
    map.endUpdate();
    const v1 = map.version;
    expect(v1).toBeGreaterThan(v0);
    map.beginUpdate();
    map.reveal(4, 4, 2);
    map.endUpdate();
    expect(map.version).toBe(v1);
  });

  it('round-trips the explored state for persistence', () => {
    const map = new VisibilityMap(16, 16);
    map.beginUpdate();
    map.reveal(4, 4, 2);
    map.endUpdate();
    const restored = VisibilityMap.fromExplored(16, 16, map.exportExplored());
    expect(restored.stateAt(4, 4)).toBe(FogState.Explored);
    expect(restored.stateAt(12, 12)).toBe(FogState.Unexplored);
  });
});
