import { GameSession } from './gameSession';
import type { SaveStore } from './saveStore';

export interface OpenedSession {
  readonly session: GameSession;
  /** True when a saved game existed but could not be restored and was removed. */
  readonly discardedSave: boolean;
}

/** Reads the planet seed from a URL query string; null when absent or not a safe integer. */
export function parseSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^-?\d+$/.test(raw.trim())) return null;
  const seed = Number(raw);
  return Number.isSafeInteger(seed) ? seed : null;
}

/**
 * Decides which game to open: the saved game when it matches the requested planet (or no planet
 * was requested), otherwise a new game on the requested seed or on a freshly drawn one.
 *
 * A saved game that cannot be restored (written by an incompatible build, or damaged) is removed
 * and replaced by a new game on the same planet, so a bad save can never stop the game from
 * starting on every later visit.
 */
export function openSession(store: SaveStore, requestedSeed: number | null, drawSeed: () => number): OpenedSession {
  const saved = store.load();
  if (!saved || (requestedSeed !== null && saved.seed !== requestedSeed)) {
    return { session: GameSession.create(requestedSeed ?? drawSeed()), discardedSave: false };
  }
  try {
    return { session: GameSession.restore(saved), discardedSave: false };
  } catch {
    store.clear();
    const seed = requestedSeed ?? (Number.isSafeInteger(saved.seed) ? saved.seed : drawSeed());
    return { session: GameSession.create(seed), discardedSave: true };
  }
}
