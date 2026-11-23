import { describe, expect, it } from 'vitest';
import { createRng, hash2 } from '../../src/engine/core/random';

describe('hash2', () => {
  it('is deterministic for identical inputs', () => {
    expect(hash2(42, 10, -3)).toBe(hash2(42, 10, -3));
  });

  it('changes when the seed or coordinates change', () => {
    const base = hash2(42, 10, 3);
    expect(hash2(43, 10, 3)).not.toBe(base);
    expect(hash2(42, 11, 3)).not.toBe(base);
    expect(hash2(42, 10, 4)).not.toBe(base);
  });

  it('returns an unsigned 32-bit integer', () => {
    for (let i = 0; i < 100; i++) {
      const h = hash2(7, i, i * 3);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe('createRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('produces values in [0, 1) with a roughly uniform mean', () => {
    const rng = createRng(99);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10_000).toBeGreaterThan(0.47);
    expect(sum / 10_000).toBeLessThan(0.53);
  });
});
