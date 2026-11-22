# Space Strategy Game

A persistent, browser-based multiplayer space strategy game with planetary development, research, fleets, alliances, and asynchronous combat.

> **Status:** Project scaffold. Architecture and engineering conventions are defined; the application stack and implementation are not yet selected.

## Project goals

- Build and develop planetary economies and technology.
- Explore and colonize worlds within a persistent universe.
- Construct fleets and issue asynchronous travel and combat orders.
- Support multiplayer interaction and alliances.
- Keep game rules deterministic, testable, and independent of the web interface and storage layer.

## Getting started

The implementation, dependencies, and start commands will be documented here once the technology stack is selected. No runnable application is included in this scaffold.

## Documentation

| Document | Purpose |
|---|---|
| [Agent instructions](AGENTS.md) | Mandatory rules for agent-assisted implementation, TDD, and repository hygiene |
| [Development guide](DEVELOPMENT.md) | Architecture boundaries, engineering workflow, testing, documentation, and releases |

As the implementation grows, maintain a canonical architecture reference and dated decision notes following the conventions in the development guide.

## Development approach

Test-driven development (RED, GREEN, REFACTOR) is mandatory. All project-owned code, tests, documentation, and Git messages are in English. Prefer small, independently testable components and separate the game engine from world instances, configuration/content, persistence, services, and browser UI.

## Versioning

Use Git, Conventional Commits, and Semantic Versioning once releases begin. The first release version has not been assigned.

## License

To be decided by the repository owner.
