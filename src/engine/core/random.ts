/**
 * Deterministic pseudo-random utilities.
 *
 * The engine never uses Math.random(): every random decision derives from an explicit seed so
 * that world generation and simulation outcomes can be reproduced on any machine (and later on
 * an authoritative server).
 */

/** Hashes a seed and two integer coordinates into an unsigned 32-bit integer. */
export function hash2(seed: number, x: number, y: number): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) | 0;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Hashes a seed and coordinates into a float in [0, 1). */
export function hash2Unit(seed: number, x: number, y: number): number {
  return hash2(seed, x, y) / 4294967296;
}

/** Returns a seeded generator (mulberry32) yielding floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
