import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/app/gameSession';
import { BrowserSaveStore, type KeyValueStorage } from '../../src/app/saveStore';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('BrowserSaveStore', () => {
  it('saves and loads a game', () => {
    const storage = new MemoryStorage();
    const store = new BrowserSaveStore(storage);
    const game = GameSession.create(3).toSavedGame();
    store.save(game);
    expect(store.load()).toEqual(JSON.parse(JSON.stringify(game)));
  });

  it('returns null when nothing is stored, the data is corrupt or the version is unknown', () => {
    const storage = new MemoryStorage();
    const store = new BrowserSaveStore(storage);
    expect(store.load()).toBeNull();
    storage.setItem(BrowserSaveStore.KEY, '{not json');
    expect(store.load()).toBeNull();
    storage.setItem(BrowserSaveStore.KEY, JSON.stringify({ version: 999 }));
    expect(store.load()).toBeNull();
  });

  it('clears the stored game', () => {
    const storage = new MemoryStorage();
    const store = new BrowserSaveStore(storage);
    store.save(GameSession.create(3).toSavedGame());
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('reports failure instead of throwing when storage is full', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(new BrowserSaveStore(storage).save(GameSession.create(3).toSavedGame())).toBe(false);
  });
});
