import { hash2Unit } from './random';

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smoothly interpolated lattice value noise in [0, 1]. Pure function of its inputs. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash2Unit(seed, x0, y0);
  const b = hash2Unit(seed, x0 + 1, y0);
  const c = hash2Unit(seed, x0, y0 + 1);
  const d = hash2Unit(seed, x0 + 1, y0 + 1);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

/** Fractal Brownian motion: several octaves of value noise, normalised to [0, 1]. */
export function fbm(seed: number, x: number, y: number, octaves: number): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(seed + o * 1013, x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}
