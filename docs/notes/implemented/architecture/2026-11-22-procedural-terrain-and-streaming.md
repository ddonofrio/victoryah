# Agent Note: Seeded per-tile terrain, lazy chunks and streamed rendering

Status: implemented

## Problem

Planets must be reproducible from a seed, never regenerate differently between sessions, and scale to large maps without generating or rendering the entire surface at once.

## Decision

- Every tile is a pure function of `(seed, x, y)` (`sampleTile` in `src/engine/world/terrain.ts`): fBm value noise for elevation bands (plains, highlands, cliffs, mountains), per-cell hashed craters with an entry gap, and clustered rock fields.
- `Terrain` generates 32 × 32 chunks lazily, in any order, and caches them.
- Saved games store the seed, not the terrain; snapshots stay small.
- Bases are placed on the largest connected landmass (`regions.ts`) so every seed yields a playable map (regression-tested over 25 seeds).
- The client builds terrain meshes only for chunks near the camera and releases distant ones; fog of war is a one-texel-per-tile texture sampled in patched materials.

## Alternatives considered

- **Whole-map generation into arrays:** simpler at 256², but does not scale to planet-sized maps and couples generation order to results.
- **Storing generated terrain in saves:** larger saves and a migration burden whenever generation improves; seeds plus a versioned generator are sufficient for now.

## Consequences

- Changing generation parameters changes existing planets; when planets become long-lived on a server, the generator must be versioned with the planet.
- Visual and walkability data come from the same samples, so what players see matches what units can traverse.
