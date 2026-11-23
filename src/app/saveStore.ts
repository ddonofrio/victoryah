import { SAVED_GAME_VERSION, type SavedGame } from './gameSession';

/** The subset of the Web Storage API the store needs; injectable for tests. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Persistence port for the local game. A server-backed implementation can replace it later. */
export interface SaveStore {
  load(): SavedGame | null;
  save(game: SavedGame): boolean;
  clear(): void;
}

/** Stores the current game in browser storage (localStorage). */
export class BrowserSaveStore implements SaveStore {
  static readonly KEY = 'victoryah.savedGame';

  constructor(private readonly storage: KeyValueStorage) {}

  load(): SavedGame | null {
    try {
      const raw = this.storage.getItem(BrowserSaveStore.KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SavedGame> | null;
      return parsed?.version === SAVED_GAME_VERSION ? (parsed as SavedGame) : null;
    } catch {
      return null;
    }
  }

  save(game: SavedGame): boolean {
    try {
      this.storage.setItem(BrowserSaveStore.KEY, JSON.stringify(game));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(BrowserSaveStore.KEY);
    } catch {
      // Storage that cannot be written holds nothing worth removing.
    }
  }
}

/** Volatile storage for browsers that deny access to persistent storage: the game runs, unsaved. */
export class MemoryStorage implements KeyValueStorage {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/**
 * Obtains the browser storage, which some privacy settings refuse with an exception on access,
 * and falls back to in-memory storage so the game still starts.
 */
export function resolveStorage(access: () => KeyValueStorage): KeyValueStorage {
  try {
    return access();
  } catch {
    return new MemoryStorage();
  }
}
