import { describe, expect, it } from 'vitest';
import { fbm, valueNoise } from '../../src/engine/core/noise';

describe('valueNoise', () => {
  it('is deterministic and bounded to [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * 0.91;
      const v = valueNoise(5, x, y);
      expect(v).toBe(valueNoise(5, x, y));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: tiny coordinate changes produce tiny value changes', () => {
    const a = valueNoise(5, 10.5, 20.25);
    const b = valueNoise(5, 10.501, 20.251);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});

describe('fbm', () => {
  it('is bounded to [0, 1] and depends on the seed', () => {
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      const v = fbm(1, i * 1.3, i * 0.7, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v !== fbm(2, i * 1.3, i * 0.7, 4)) differences++;
    }
    expect(differences).toBeGreaterThan(90);
  });
});
