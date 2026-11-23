# Agent Note: Fixed-step simulation of shared planetary instances

Status: implemented

## Problem

The planetary RTS layer must feel responsive in the browser today, yet later run on an authoritative server where several players share one persistent planet. Game rules tied to the frame rate, to a client, or to a per-player copy of the planet would have to be rewritten for multiplayer.

## Decision

- One `World` (`src/engine/sim/world.ts`) holds the authoritative state of one planet for all players on it. Each player has their own `VisibilityMap` and stockpile; nothing is duplicated per player.
- `Simulation` (`src/engine/sim/simulation.ts`) advances a World in fixed 1/20 s ticks. Systems run in a fixed order and iterate entities in ascending id order. Randomness is seeded; there is no wall-clock or `Math.random()` in rules.
- Players change the world only through validated `Command`s carrying a `playerId`, queued with `submit()` and applied at the next tick.
- Entities are plain serialisable data; derived indexes (spatial grid, occupancy) are rebuilt on restore.
- `GameSession` (app layer) converts real time to ticks with an accumulator and exposes an interpolation factor; rendering interpolates between ticks.

## Alternatives considered

- **Variable time step tied to `requestAnimationFrame`:** simpler, but outcomes differ by frame rate and machine, and cannot be reproduced on a server.
- **Entity-component-system framework:** flexible, but unnecessary at the current scale; plain entities with optional definition components keep the code small (YAGNI).
- **Per-player world copies:** would make hidden settlements trivial but breaks shared persistence and explodes memory for shared planets.

## Consequences

- Determinism is tested (`tests/engine/determinism.test.ts`), including continuation after a snapshot round trip.
- The engine runs in Node.js without changes, ready for a server process.
- Commands arrive one tick late; acceptable at 20 Hz and identical to the networked model.
- Systems must keep deterministic iteration order and avoid floating-point order dependencies.
