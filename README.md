# Victoryah

Victoryah is a persistent, browser-based multiplayer science-fiction strategy game set in a fictional **binary star system**. It combines two integrated layers: asynchronous space operations between planets and moons, and real-time strategy (RTS) on planetary surfaces, where players land forces, gather resources, build defences and fight for territory they may not even know is contested.

> **Status: MVP 1 — Planetary RTS foundation (v0.1.0, unreleased).** A playable single-player planetary skirmish runs in the browser: a procedurally generated planet, fog of war, the first military, defensive and logistics roster, RTS selection and command controls, combat, resource gathering, construction and local persistence. The space layer, multiplayer, servers and autonomous command are not implemented yet.

## Getting started

Requirements: Node.js 22 LTS and npm.

```bash
npm ci
npm run dev        # development server with hot reload (http://localhost:5173)
```

Open the printed URL. Every planet is generated from a seed shown in the top bar and in the URL (`?seed=2026`); the same seed always produces the same planet. The game autosaves in the browser and resumes where you left off. **New planet** starts over on a random seed. Press **F1** in game for the controls.

Production build: `npm run build` (output in `dist/`, a static SPA), served locally with `npm run preview`.

## Documentation

| Document                             | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| [Gameplay guide](docs/gameplay.md)   | Controls, units, resources and rules of the planetary RTS layer                               |
| [Architecture](docs/architecture.md) | Components, dependencies, runtime flow, data model, performance assumptions, manual checklist |
| [Decision notes](docs/notes/)        | Dated records of significant technical decisions                                              |
| [Development guide](DEVELOPMENT.md)  | Workflow, TDD, code quality rules, commands, documentation and release conventions            |
| [Agent instructions](AGENTS.md)      | Mandatory rules for agent-assisted implementation                                             |

## Development approach

Test-driven development (RED, GREEN, REFACTOR) is mandatory, and formatting, linting and code size limits are enforced locally and in CI. `npm run check` runs every gate; see [DEVELOPMENT.md](DEVELOPMENT.md) for the full command list. The game engine is pure TypeScript, independent of rendering and the browser, so the same simulation can later run on an authoritative server.

## Versioning

Git, Conventional Commits and Semantic Versioning. The project is pre-1.0 (`0.1.0` in `package.json`); no release has been published yet.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
