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
    const raw = this.storage.getItem(BrowserSaveStore.KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SavedGame>;
      return parsed.version === SAVED_GAME_VERSION ? (parsed as SavedGame) : null;
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
    this.storage.removeItem(BrowserSaveStore.KEY);
  }
}
