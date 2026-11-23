import './client/styles.css';
import { GameSession } from './app/gameSession';
import { BrowserSaveStore } from './app/saveStore';
import { GameClient } from './client/gameClient';

/**
 * SPA entry point. Resolves which planet to load: an explicit `?seed=` wins (restoring the saved
 * game when it belongs to that seed), otherwise the saved game, otherwise a new random planet.
 */
function bootstrap(): void {
  const store = new BrowserSaveStore(window.localStorage);
  const params = new URLSearchParams(window.location.search);
  const requested = params.has('seed') ? Number.parseInt(params.get('seed')!, 10) : Number.NaN;
  const saved = store.load();
  let session: GameSession;
  if (Number.isFinite(requested)) {
    session = saved && saved.seed === requested ? GameSession.restore(saved) : GameSession.create(requested);
  } else if (saved) {
    session = GameSession.restore(saved);
  } else {
    session = GameSession.create(randomSeed());
  }
  params.set('seed', String(session.seed));
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  const client = new GameClient(document, session, store, () => newPlanet(store));
  client.start();
}

function newPlanet(store: BrowserSaveStore): void {
  if (!window.confirm('Abandon this planet and land on a new one?')) return;
  store.clear();
  window.location.search = `?seed=${randomSeed()}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
}

bootstrap();
