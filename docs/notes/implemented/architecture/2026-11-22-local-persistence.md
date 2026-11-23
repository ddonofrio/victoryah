# Agent Note: Versioned snapshots with a browser save store

Status: implemented

## Problem

The MVP has no server, but the world must not reset or regenerate unpredictably between sessions, and the format must survive the move to server-side persistence.

## Decision

- `snapshotWorld` / `restoreWorld` produce a JSON-safe snapshot with `schemaVersion: 1`: entities, deposits, stockpiles and run-length-encoded explored masks. Terrain is regenerated from the seed.
- `GameSession.toSavedGame()` adds scenario, seed, map size and local player (`SAVED_GAME_VERSION = 1`).
- Storage sits behind the `SaveStore` port; `BrowserSaveStore` uses `localStorage`, ignores corrupt or unknown-version data, and reports quota failures instead of throwing.
- The client autosaves every 15 s, on tab hide and before unload. The URL carries the seed so planets are shareable and reloads are stable.

## Alternatives considered

- **IndexedDB:** more capacity, but asynchronous APIs add complexity the current save size (tens of kilobytes) does not need.
- **No persistence in MVP 1:** contradicts the requirement that the world must not regenerate between sessions.

## Consequences

- Any change to entity or snapshot shape must bump the schema version and add a migration or explicit rejection.
- A server implementation can reuse the snapshot format for storage and initial synchronisation.
