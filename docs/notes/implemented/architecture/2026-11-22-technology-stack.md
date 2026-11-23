# Agent Note: Technology stack for the browser client and engine

Status: implemented

## Problem

Victoryah needs a browser Single Page Application with 3D rendering for planetary RTS gameplay, and a game engine that can later run unchanged on an authoritative server. The repository had no stack, test runner, or quality gates.

## Decision

- **Language:** TypeScript in strict mode for every layer. One language for client and future server lets the same engine code run in both places.
- **Rendering:** Three.js, used only from `src/client`. It is a rendering library, not a game framework, so it does not dictate the simulation loop, entity model, or state ownership.
- **Build and dev server:** Vite. Fast HMR and a static production build that can be hosted anywhere.
- **Tests:** Vitest (Node environment by default), sharing Vite's TypeScript pipeline.
- **Quality:** ESLint with `typescript-eslint` (including layer-boundary and size-limit rules) and Prettier, enforced by `npm run check` and GitHub Actions CI.
- **No UI framework:** the HUD is a small amount of DOM managed by plain TypeScript modules. A framework can be introduced when menus, account flows, and the space-strategy layer justify it.

## Alternatives considered

- **Game engines (Phaser, Babylon.js, PlayCanvas):** heavier and more opinionated about scene and update loops; Babylon.js is a credible alternative but Three.js is smaller and leaves simulation ownership entirely to the engine layer.
- **Unity/Godot web exports:** large downloads, weaker SPA integration, and harder to share engine code with a Node server.
- **React for the HUD:** useful later, unnecessary for the current command panel and resource bar (YAGNI).
- **Jest:** works, but duplicates TypeScript configuration that Vitest takes from Vite.

## Consequences

- Engine code must stay free of DOM and Three.js imports; ESLint `no-restricted-imports` enforces this.
- Rendering performance depends on our own culling and batching choices; these are documented in `docs/architecture.md`.
- Node.js 22 LTS is required for development and CI.
