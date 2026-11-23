# Victoryah architecture

This document describes the implemented architecture. Engineering rules (TDD, quality gates, boundary principles) are canonical in [DEVELOPMENT.md](../DEVELOPMENT.md); decisions and their rationale are in [docs/notes](notes/). Gameplay rules are in [gameplay.md](gameplay.md).

Current scope: **MVP 1, the planetary RTS layer**, played locally in the browser. The structure is designed so that the same engine can later run on an authoritative server shared by many players, and so that the space layer can be added beside it.

## Layers and dependencies

```text
src/
  engine/      Pure rules and algorithms. No DOM, no rendering, no content.
    core/        Seeded hashing, RNG, value noise
    world/       Terrain generation, pathfinding, spatial index, visibility, regions, resource fields
    sim/         World state, Simulation loop, commands, capabilities, snapshots
      systems/   Per-tick behaviour: movement, combat, economy, construction, perception, orders
  content/     Data: unit roster, resource field tables, skirmish forces
  instances/   World instance setup: composes engine + content into a playable planet (skirmish)
  app/         Application services: GameSession (time, commands, save format), SaveStore port
  client/      Browser presentation: Three.js rendering, input, HUD, audio
  main.ts      SPA bootstrap
```

Allowed dependency direction (enforced by ESLint `no-restricted-imports` in `eslint.config.js`):

```text
client ──► app ──► instances ──► content ──► engine
   └────────┴──────────┴────────────┴──────────►┘
```

- `engine` imports nothing outside itself. It never imports `three`, the DOM, content, instances, app or client code.
- `content` may only use engine contracts (types such as `UnitTypeDefinition`, `FieldSpec`).
- `instances` and `app` must not import `three` or client code.
- Only `client` touches Three.js and the DOM.

## Engine

### World and simulation

- `World` (`engine/sim/world.ts`) is the authoritative state of **one planetary instance**: surface, entities, deposits, players, per-player `VisibilityMap`s, a `SpatialGrid` and a structure occupancy grid. Several players share one `World`; nobody gets a private copy of a shared planet.
- `Simulation` (`engine/sim/simulation.ts`) advances a World in **fixed steps of 1/20 s**. One step: apply queued commands → recompute perception → update every entity in ascending id order → separate overlapping ground units → increment the tick.
- Game rules never read wall-clock time or `Math.random()`. Outcomes depend only on the initial state and the command sequence, which `tests/engine/determinism.test.ts` verifies.

### Entities and capabilities

Units and structures are one `Entity` type (`engine/sim/types.ts`) of plain, serialisable data: position, facing, hit points, construction progress, current `Order`, path, weapon cooldown, cargo and stock. Behaviour comes from the entity's `UnitTypeDefinition` (`engine/sim/definitions.ts`): domain (ground, air, structure), stats, and **capabilities** (`move`, `attack`, `harvest`, `build`, `repair`, `extract`, `haul`, `stop`) plus the optional component data each capability needs (weapon, harvest spec, builder spec...).

`sharedActions()` derives the actions of a selection as the intersection of capabilities. It never inspects unit types, so new units work without UI changes.

### Commands

Players act only through `Command`s (`engine/sim/commands.ts`): `move`, `stop`, `attack`, `harvest`, `build`, `repair`, `extract`, `haul` and `smart` (context-sensitive right click, resolved per unit in `engine/sim/smart.ts`). Commands are treated as **untrusted input**: every command checks unit existence, ownership, capability, completion, target validity and visibility, costs and placement, and reports each rejected unit with a reason. `Simulation.submit()` queues commands for the next step, the same model a server would use for network commands.

### Systems

| System       | File                      | Responsibility                                                                              |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------- |
| Orders       | `systems/orders.ts`       | Dispatches each entity's current order; automated gathering for idle collection drones      |
| Movement     | `systems/movement.ts`     | A* path requests, path following, re-pathing while chasing, soft unit separation            |
| Combat       | `systems/combat.ts`       | Attack orders, opportunistic fire, visibility-gated targeting, damage, destruction, salvage |
| Economy      | `systems/economy.ts`      | Harvest cycles, drop-offs, refining, hauling, energy extraction                             |
| Construction | `systems/construction.ts` | Building structures and repairing                                                           |
| Perception   | `systems/perception.ts`   | Per-player vision from own units; prospectors reveal underground deposits                   |

Events (`SimEvent`: shots, destructions, deliveries, completed structures, revealed deposits) are emitted for presentation only; they never feed back into rules.

### Planet generation

- `Terrain` (`engine/world/terrain.ts`) samples each tile as a **pure function of (seed, x, y)** using value-noise fBm, per-cell craters with entry gaps and clustered rocks. Chunks of 32 × 32 tiles are generated lazily and cached, in any order, with identical results.
- `regions.ts` finds the largest connected landmass and open base sites; `resourceFields.ts` scatters seeded resource fields over reachable ground. The field tables and starting forces are content data.
- `instances/skirmish.ts` composes these into a playable planet. The seed fully determines the planet, the deposits and the starting forces.

### Pathfinding and spatial queries

- Eight-way A* with octile heuristic, no corner cutting, a node budget, and graceful fallback to the closest reachable tile; results are smoothed with tile line-of-sight. Structures block tiles through the World's occupancy grid.
- Air units fly straight lines.
- Group moves assign distinct destination tiles around the clicked point (`formation.ts`).
- `SpatialGrid` (8-tile cells) answers radius queries for targeting, separation and placement; results are sorted by id for determinism.

### Visibility

Each player has a `VisibilityMap` with three states per tile: unexplored, explored, visible. Vision is recomputed every tick from that player's own units (circular sight, no terrain occlusion yet). Explored tiles are remembered. `World.perceivedEntities(player)` and `World.knownDeposits(player)` are the only views of the world the client uses, so a client never renders information its player should not have.

## Persistence

- `snapshotWorld()` / `restoreWorld()` (`engine/sim/snapshot.ts`) produce a versioned (`schemaVersion: 1`), JSON-safe snapshot of entities, deposits, stockpiles and run-length-encoded explored masks. Terrain is not stored: it is regenerated from the seed.
- `GameSession.toSavedGame()` wraps it with the scenario, seed, map size and local player (`SAVED_GAME_VERSION = 1`).
- `SaveStore` is the persistence port; `BrowserSaveStore` implements it with `localStorage`. The client autosaves every 15 s, when the tab is hidden and before unload. Unknown versions and corrupt data are ignored rather than crashing.
- A restored game continues exactly as an uninterrupted one (tested).

## Application and client

- `GameSession` (`app/gameSession.ts`) drives the simulation from real time with an accumulator: as many fixed steps as elapsed time allows, capped at 0.25 s per frame to avoid a spiral of death after pauses. It exposes `alpha` (fraction of the next tick) for interpolation and stamps local commands with the player id.
- `GameClient` (`client/gameClient.ts`) owns the animation-frame loop: input → `session.advance(dt)` → sync visuals after steps → present events → render → periodic HUD, minimap and autosave updates.
- Rendering (`client/render`): streamed terrain chunk meshes with a fog-of-war `DataTexture` patched into the materials; procedural low-poly models; units interpolated between ticks; effects, markers and placement preview.
- Input (`client/input`, `client/commandController.ts`): screen-space picking and box selection, control groups, targeted actions and context orders, all turned into `LocalCommand`s.
- HUD (`client/ui`): resource bar, selection details, capability-driven command panel, minimap.
- Audio (`client/audio/soundBoard.ts`): sounds synthesised with WebAudio, rate-limited, unlocked by the first user gesture.

## Toward multiplayer and servers

What already holds:

- The engine has no browser dependency and can run in Node.js unchanged.
- One World serves many players, each with independent vision and stockpile; commands carry and validate a `playerId`.
- Commands are queued and applied at tick boundaries, matching a server-authoritative lockstep or snapshot model.
- State is plain data with a versioned snapshot format, suitable for persistence and synchronisation.

What is deliberately not built yet: networking, authentication, a server process, database adapters, interest management and delta synchronisation. A natural next step is a Node.js process hosting `Simulation`s per planet, with `GameSession.submit()` sending commands over the network and clients rendering per-player perceived state.

## Performance assumptions and measurements

Measured on Node.js 22 in the development container (single core, no GPU), seed 9:

| Operation                                          | Time      |
| -------------------------------------------------- | --------- |
| Generate all 256 × 256 tiles                       | ≈ 70 ms   |
| Largest-region analysis                            | ≈ 32 ms   |
| Full skirmish creation (47 entities, 318 deposits) | ≈ 100 ms  |
| One simulation tick                                | ≈ 0.56 ms |

The tick budget at 20 Hz is 50 ms, so the current scale leaves two orders of magnitude of headroom. Assumptions and first optimisation candidates when unit counts grow:

- **Perception** is recomputed every tick for every player: O(units × sight²) plus a copy of the visible mask per player. Candidates: staggered updates, incremental reveal deltas, or per-chunk masks.
- `knownDeposits`, `perceivedEntities` and drop-off searches scan linearly; deposits could join a spatial index.
- A* is bounded by a 40 000-node budget per request; re-pathing while chasing is throttled to once per second.
- Rendering streams 32 × 32 terrain chunks within about 2.2 × camera distance + 30 tiles and releases distant ones; Three.js frustum culling skips off-screen objects. The production bundle is about 83 kB of game code (28 kB gzipped) plus 479 kB for Three.js in its own cacheable chunk.

Measure before optimising; record new measurements here.

## Known limitations

- Vision ignores terrain occlusion; units do not block each other's paths (soft separation only).
- No attack-move; enemy units have no strategic AI and only engage what comes into range.
- The client caps one frame at 0.1 s, so below 10 frames per second game time runs slower than real time.
- Single local player; persistence is browser-local.

## Manual verification

Automated E2E smoke tests (`npm run test:e2e`) cover launch, selection, command derivation, movement orders, save/restore and the help overlay. For UI changes, also check by hand with `npm run dev`:

1. The planet loads with the seed in the top bar and URL; reloading the same URL shows the same planet and the saved positions.
2. Click, Shift-click, double click and box selection behave as described in the gameplay guide; selection rings and health bars appear.
3. A mixed selection (for example tanks and harvesters) shows only Move and Stop; a single unit shows all its actions.
4. Right-click ground, a crystal field, an enemy in sight and a damaged friendly unit: the selection moves, harvests, attacks or repairs accordingly, with a marker and a sound.
5. Units path around mountains, cliffs, rocks and crater rims; air units fly over them.
6. Harvesters return crystal to the command center and the counter rises; a prospector near hidden ore shows a notification, after which drilling units can harvest it.
7. Engineers: B, choose a turret, place it on valid ground (green preview); resources drop and the turret rises until complete.
8. A long-range turret does not fire at enemies beyond its own sight until a scout or drone spots them.
9. The minimap shows explored terrain, deposits, own units, visible enemies and the camera footprint; clicking it moves the camera, right-clicking orders the selection.
10. Camera: arrows and screen edges pan, wheel zooms, middle drag or Q/E/Z/C rotate and tilt.
