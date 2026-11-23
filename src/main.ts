import './client/styles.css';
import { BrowserSaveStore, resolveStorage } from './app/saveStore';
import { openSession, parseSeed } from './app/sessionLoader';
import { GameClient } from './client/gameClient';

/**
 * SPA entry point. Which planet to load is decided by `openSession`: an explicit `?seed=` wins
 * (restoring the saved game when it belongs to that seed), otherwise the saved game, otherwise a
 * new random planet.
 */
function bootstrap(): void {
  const store = new BrowserSaveStore(resolveStorage(() => window.localStorage));
  const { session, discardedSave } = openSession(store, parseSeed(window.location.search), randomSeed);
  const params = new URLSearchParams(window.location.search);
  params.set('seed', String(session.seed));
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  const client = new GameClient(document, session, store, () => newPlanet(store));
  client.start();
  if (discardedSave) client.notify('The saved game could not be restored. Started this planet afresh.', 6);
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
