import { describe, expect, it } from 'vitest';
import { GameSession, type SavedGame } from '../../src/app/gameSession';
import { BrowserSaveStore, MemoryStorage, resolveStorage } from '../../src/app/saveStore';
import { openSession, parseSeed } from '../../src/app/sessionLoader';

const storeWith = (saved?: unknown): BrowserSaveStore => {
  const storage = new MemoryStorage();
  if (saved !== undefined) storage.setItem(BrowserSaveStore.KEY, JSON.stringify(saved));
  return new BrowserSaveStore(storage);
};

const savedAfterPlaying = (seed: number): SavedGame => {
  const session = GameSession.create(seed);
  session.advance(0.2);
  return JSON.parse(JSON.stringify(session.toSavedGame())) as SavedGame;
};

const neverCalled = (): number => {
  throw new Error('a new seed must not be drawn');
};

describe('openSession', () => {
  it('starts a new planet from a fresh seed when nothing is saved', () => {
    const opened = openSession(storeWith(), null, () => 4242);
    expect(opened.session.seed).toBe(4242);
    expect(opened.session.simulation.tick).toBe(0);
    expect(opened.discardedSave).toBe(false);
  });

  it('resumes the saved game when no seed is requested or the requested seed matches', () => {
    const saved = savedAfterPlaying(31);
    expect(openSession(storeWith(saved), null, neverCalled).session.simulation.tick).toBe(saved.world.tick);
    expect(openSession(storeWith(saved), 31, neverCalled).session.simulation.tick).toBe(saved.world.tick);
  });

  it('creates the requested planet when the saved game belongs to another seed', () => {
    const opened = openSession(storeWith(savedAfterPlaying(31)), 32, neverCalled);
    expect(opened.session.seed).toBe(32);
    expect(opened.session.simulation.tick).toBe(0);
    expect(opened.discardedSave).toBe(false);
  });
});

describe('openSession with an unusable saved game', () => {
  const broken = (): SavedGame => {
    const saved = savedAfterPlaying(31);
    return { ...saved, world: { ...saved.world, entities: [{ ...saved.world.entities[0]!, typeId: 'removedUnit' }] } };
  };

  it('starts the same planet afresh instead of failing to boot', () => {
    const store = storeWith(broken());
    const opened = openSession(store, null, neverCalled);
    expect(opened.session.seed).toBe(31);
    expect(opened.session.simulation.tick).toBe(0);
    expect(opened.discardedSave).toBe(true);
  });

  it('removes the unusable save so later visits are not affected', () => {
    const store = storeWith(broken());
    openSession(store, 31, neverCalled);
    expect(store.load()).toBeNull();
  });

  it('draws a new seed when the save does not even carry a usable one', () => {
    const opened = openSession(storeWith({ version: 1, seed: 'x', world: null }), null, () => 77);
    expect(opened.session.seed).toBe(77);
    expect(opened.discardedSave).toBe(true);
  });
});

describe('parseSeed', () => {
  it('reads an integer seed from a query string', () => {
    expect(parseSeed('?seed=2026')).toBe(2026);
    expect(parseSeed('?foo=1&seed=7')).toBe(7);
  });

  it('returns null when the seed is missing or not a safe integer', () => {
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('?seed=')).toBeNull();
    expect(parseSeed('?seed=abc')).toBeNull();
    expect(parseSeed('?seed=99999999999999999999')).toBeNull();
  });
});

describe('resolveStorage', () => {
  it('uses the browser storage when it is available', () => {
    const storage = new MemoryStorage();
    expect(resolveStorage(() => storage)).toBe(storage);
  });

  it('falls back to in-memory storage when the browser denies access', () => {
    const storage = resolveStorage(() => {
      throw new Error('SecurityError');
    });
    storage.setItem('key', 'value');
    expect(storage.getItem('key')).toBe('value');
    storage.removeItem('key');
    expect(storage.getItem('key')).toBeNull();
  });
});
