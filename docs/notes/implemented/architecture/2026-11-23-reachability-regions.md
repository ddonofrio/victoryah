# Agent Note: Connectivity regions answer reachability before pathfinding

Status: implemented

## Problem

A* only discovers that a goal is unreachable by exhausting its search. In the planetary layer most "unreachable" goals are routine: units approach structures, whose own tiles are blocked (every harvester delivery to the command center, every attack on a turret, every construction and repair), and players click on mountains or unexplored ground. Measured on the 256 × 256 skirmish map, one such path request took 80–110 ms against a tick budget of 50 ms, so two harvesters alone produced a visible stutter every few seconds, and a group ordered toward cut-off ground froze the game for a tick per unit.

## Decision

- `RegionMap` (`src/engine/world/connectivity.ts`) labels the connected walkable areas of a grid by flood fill. Areas are joined through orthogonal neighbours only, which is exactly the pathfinder's reachability: its diagonal steps may not cut corners.
- `World.regionAt()` exposes the labels for terrain plus structures. The map is derived state: it is dropped whenever a structure footprint is added or removed and rebuilt on the next query (about 2 ms).
- `requestPath` (`src/engine/sim/systems/movement.ts`) compares the regions of the unit and of the destination. When they differ it paths to the nearest tile of the unit's region (searched in rings around the destination, ties broken toward the unit) instead. A* therefore only receives goals it can reach, and its cost follows the length of the route.
- If the unit itself stands on a blocked tile, or no reachable tile lies within 48 tiles of the destination, the old "closest explored tile" search still runs, with a budget of 2 000 nodes.
- `World.isWalkable()` memoises surface walkability, and A* keeps its bookkeeping in typed arrays; both were measured hot spots of the searches that remain.
- `largestRegionMask` (base placement) now uses the same `RegionMap`.

Tests: `tests/engine/connectivity.test.ts` and `tests/engine/reachability.test.ts`. Search effort is asserted by counting walkability queries, which is deterministic, rather than by timing.

## Alternatives considered

- _*Stop A* within the approach range of the target:_* fixes approaching structures, but not destinations that are cut off, which still exhaust the search.
- **A smaller node budget:** bounds the cost of failure but also breaks legitimate long routes across the map.
- _*Hierarchical pathfinding (HPA*) or flow fields:_* the right tools for much larger maps and unit counts; unnecessary machinery at the current scale.

## Consequences

- Blocked and cut-off destinations cost about 2 ms instead of about 100 ms. Units still end on the reachable tile closest to what was ordered; among equally close tiles they now take the one on their own side.
- The region map covers the whole surface, so the first query generates every terrain chunk. The skirmish instance already does that when it places bases; planet-sized maps will need per-chunk or hierarchical regions (recorded under performance assumptions in `docs/architecture.md`).
- Anything that changes walkability must invalidate the regions. Today that is only structure footprints, handled in one place (`World.setFootprint`).
- The surface of a World is assumed immutable. Terrain that can change (for example destructible rocks) must invalidate both the walkability cache and the regions.
