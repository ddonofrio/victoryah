import type { Point } from './types';

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
