# Development Guide

This document establishes the engineering and documentation conventions for Victoryah, the browser-based multiplayer science-fiction strategy game. The selected stack is TypeScript, Vite, Three.js, Vitest, ESLint, and Prettier; the rationale is recorded in [docs/notes/implemented/architecture/2026-11-22-technology-stack.md](docs/notes/implemented/architecture/2026-11-22-technology-stack.md).

## 1. Development philosophy

The engineering model follows four practices: **test-first implementation**, **explicit architecture boundaries**, **documentation maintained alongside code**, and **small verifiable changes**. Avoid overengineering. A simpler implementation is preferable when it meets the tested contract and keeps future changes inexpensive.

Use SOLID pragmatically; apply DRY to proven duplication, KISS to implementation and operations, and YAGNI to speculative requirements. Favor clear, observable behavior over clever abstractions.

## 2. Product scope

Victoryah is a persistent, browser-based multiplayer strategy game set in a single fictional binary star system. The complete product combines:

- **Space strategy:** planets, moons and asteroid fields; fleets, orbital operations and asynchronous missions that continue while players are offline.
- **Planetary real-time strategy:** landing forces, base building, resource gathering and logistics, turrets and tactical combat on shared planetary surfaces where players may not know about each other.
- **Limited territorial awareness:** exploration, surveillance and intelligence determine what each player knows.
- **Autonomous command:** configurable standing orders executed while players are offline.
- Persistence, multiplayer synchronisation, alliances, research and progression.

Implemented so far: MVP 1, the planetary RTS foundation (see [docs/gameplay.md](docs/gameplay.md)). Everything else is a product direction, not a claim of existing functionality. Define gameplay and balancing contracts through small, testable increments.

## 3. Architecture boundaries

Keep domain logic isolated from delivery, infrastructure, instance configuration, and content data.

| Boundary                 | Responsibilities                                                               | Must not own                                                           |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Game engine/domain       | Deterministic rules, costs, production, travel and combat resolution           | Database calls, HTTP handlers, browser state, deployment configuration |
| World instances          | Per-universe state, lifecycle, ruleset selection, tick/scheduler orchestration | Reimplementation of core game rules                                    |
| Content/data definitions | Ships, buildings, research trees, balance parameters, validation               | Transport, persistence, or procedural logic                            |
| Application services     | Use-case orchestration, permissions, transactions, command coordination        | UI rendering or duplicate domain algorithms                            |
| Persistence adapters     | Database access, migrations, durable event/state storage                       | Game balance and authoritative gameplay decisions                      |
| API/transport            | Authentication, validation, rate limits, request/response mapping              | Direct mutation of domain state without service validation             |
| Browser client           | Presentation, interaction, accessible UX, local view state                     | Authoritative combat, economy, or security decisions                   |
| Infrastructure           | Deployment, observability, worker execution, external integration              | Business rules                                                         |

The mapping of these boundaries to source directories, and the import rules ESLint enforces between them, are described in [docs/architecture.md](docs/architecture.md#layers-and-dependencies).

Dependency direction: transport, persistence, and UI depend on explicit application/domain contracts, not the reverse. Use interfaces at real integration seams. Keep the domain free of global singleton state so world instances remain isolated.

### Deterministic time and combat

Inject time and random sources into engine operations. Use well-defined server-authoritative timestamps and explicit rounding rules. Tests must reproduce the same scenario and output. Persist changes atomically where necessary, and ensure scheduled work is retry-safe and idempotent.

### Multiplayer and security

Treat every client action as untrusted. Validate ownership, permissions, costs, target availability, and preconditions server-side. Address duplicate requests, transaction races, delayed processing, and disconnects as those features are implemented. Log meaningful events without exposing secrets or private player data.

## 4. Mandatory TDD workflow

For each behavior change:

1. **Specify:** State an observable requirement and the expected outcome. Decide whether a unit, integration, or end-to-end test best proves it.
2. **RED:** Add the smallest meaningful test and execute it. Verify that it fails _because the functionality is absent_.
3. **GREEN:** Make the minimum code change required to pass. Execute the focused test.
4. **REFACTOR:** Improve naming, boundaries, and duplication without changing behavior. Execute the focused test again.
5. **VERIFY:** Execute the relevant suite plus applicable lint, typecheck, build, integration, and security gates.
6. **DOCUMENT:** Update the appropriate documentation and decision note in the same change.

Repeat these steps incrementally. Fix tests that expose defects; do not bypass tests, dilute assertions, or replace real behavior with mocks. Prefer deterministic fixtures and clocks over sleep-based timing assumptions.

### Minimum test coverage expectations

- Engine: cost calculations, production over elapsed time, research prerequisites, travel estimates, combat resolution, deterministic random seeds, and boundary conditions.
- Instances: isolated state between universes, restart/recovery consistency, and event scheduling.
- Application/API: input validation, authorization, duplicate requests, idempotency, and conflicting actions.
- Persistence: schema compatibility, migrations, transactions, and reconstruction of authoritative state.
- UI: meaningful component/integration checks and critical player journeys when tooling exists.

Coverage percentages are diagnostic, not a substitute for relevant assertions. Define numerical thresholds only when supported by actual code and CI needs.

### Code quality rules (mandatory)

These rules are mandatory for all project-owned code, including tests, scripts, and configuration written in a programming language.

- **Formatter and linter:** Prettier formats every supported file; ESLint (with `typescript-eslint`) lints all TypeScript and JavaScript. Both are mandatory. Configuration lives in `.prettierrc.json` and `eslint.config.js`.
- **Automated enforcement:** `npm run format:check` and `npm run lint` are part of `npm run check` and of the CI workflow. Run `npm run format` before committing.
- **File size:** no source code file may exceed **500 lines** (ESLint `max-lines`, blank lines and comments included).
- **Function size:** no function or method may exceed **50 lines** (ESLint `max-lines-per-function`, blank lines and comments included). Test callbacks such as `describe` blocks count as functions.
- **Refactor instead of growing:** split oversized files and functions into cohesive, reusable components following SOLID, DRY, and KISS. Extract helpers by responsibility, not by arbitrary line ranges.
- **Exclusions:** generated output (`dist/`, `coverage/`) and third-party dependencies (`node_modules/`) are excluded from formatting, linting, and size limits because both tools honour `.gitignore`. No other exclusion may be added.
- **No bypassing:** never disable, weaken, skip, or work around a quality check to make validation pass. Inline `eslint-disable` comments are rejected by configuration (`noInlineConfig`); `prettier-ignore`, raised limits, new ignore entries, or skipped CI steps are equally forbidden unless the repository owner explicitly approves a documented exception.

### Executable checks

All commands run from the repository root after installing Node.js 22 LTS.

| Check                                      | Command                                                                                                                               | Status                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Install dependencies                       | `npm ci`                                                                                                                              | Configured                          |
| Unit and integration tests                 | `npm run test` (watch mode: `npm run test:watch`)                                                                                     | Configured (Vitest)                 |
| Formatting                                 | `npm run format:check` (fix: `npm run format`)                                                                                        | Configured (Prettier)               |
| Lint, architecture boundaries, size limits | `npm run lint`                                                                                                                        | Configured (ESLint)                 |
| Typecheck/static analysis                  | `npm run typecheck`                                                                                                                   | Configured (`tsc --noEmit`, strict) |
| Build                                      | `npm run build`                                                                                                                       | Configured (Vite)                   |
| All gates, as run by CI                    | `npm run check`                                                                                                                       | Configured                          |
| Development server                         | `npm run dev`                                                                                                                         | Configured                          |
| E2E/smoke                                  | `npm run test:e2e` (Playwright with the installed Google Chrome) and the [manual checklist](docs/architecture.md#manual-verification) | Configured                          |

CI (`.github/workflows/ci.yml`) runs formatting, typecheck, lint, tests, build, and the end-to-end smoke tests on every pull request and on pushes to `main`. A failing gate blocks the change.

## 5. Documentation system

Follow the Little Whale approach: a concise entry point, a detailed contributor guide, accurate architectural references, and dated decision notes. Maintain documentation _with_ code, not afterward.

| Document                 | Audience and ownership                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| `README.md`              | Project overview, setup, user-facing status, and links                  |
| `DEVELOPMENT.md`         | Working rules, architecture, test workflow, quality gates, and releases |
| `AGENTS.md`              | Mandatory operational rules for coding agents                           |
| `docs/architecture.md`   | Implemented components, dependencies, invariants, and runtime flows     |
| `docs/notes/`            | Historical technical decisions and implementation rationale             |
| Module-level README/docs | Public interfaces and module-specific contracts, as needed              |

### Decision notes (Agent Notes)

Create a dated note for decisions that change architecture, persistence contracts, concurrency semantics, major test infrastructure, important security guarantees, or development workflow. Keep proposed and implemented notes distinct; use a category subdirectory only when it adds navigational value.

Suggested paths:

- `docs/notes/proposed/2026-11-22-world-instance-isolation.md`
- `docs/notes/implemented/architecture/YYYY-MM-DD-short-title.md`
- `docs/notes/implemented/process/YYYY-MM-DD-short-title.md`

Suggested template:

```markdown
# Agent Note: Short descriptive title

Status: proposed | implemented | superseded

## Problem

What needs to change, and why?

## Decision

What exact technical contract or workflow is chosen?

## Alternatives considered

Which realistic options were rejected, and why?

## Consequences

What improves, what becomes constrained, and what must be tested?
```

Notes should be factual, link to relevant source and tests, and explain _why_. If a decision changes, amend its status and link to a new note rather than silently rewriting history. Do not copy whole sections between documents: link the canonical explanation.

### Documentation acceptance criteria

A change that modifies user workflows, gameplay rules, public interfaces, schemas, operations, or architectural dependencies must update the corresponding documentation in the same PR or commit. Every new significant module should explain its responsibility, contracts, and dependencies. Examples must run or be marked illustrative. Write everything in English.

## 6. Git workflow and releases

Only the user's Git identity may be credited as the author of a commit. Never mention or attribute authorship or co-authorship to AI assistants, bots, software, automated systems, or tools, including in commit messages or metadata trailers.

Use small commits with Conventional Commits syntax:

```text
feat(engine): implement deterministic resource production
fix(api): reject duplicate fleet orders
test(combat): cover draw and retreat outcomes
docs(architecture): record world-instance boundaries
refactor(domain): extract immutable combat input
feat(storage)!: change persisted fleet event schema
```

Use English commit subjects in the imperative mood. Breaking changes require an explicit description in the body or a `BREAKING CHANGE:` footer. Keep commits atomic and review diffs before committing. Never force-push shared branches without authorization.

Semantic Versioning (SemVer):

- **MAJOR**: incompatible public API, stored-data, protocol, or otherwise committed contract changes (with a migration plan).
- **MINOR**: backward-compatible new features.
- **PATCH**: backward-compatible bug fixes.

Pre-1.0 versioning may communicate instability, but breaking changes must still be documented. A Conventional Commit is not itself a release; release only under an explicit release process. Maintain release notes or a changelog when releases begin.

## 7. Scratch artifacts and repository hygiene

The only disposable scratch workspace is the one declared by the dedicated root ignore rule. Agents and users may store temporary experiments and generated artifacts there. Its literal name or path must never appear in any tracked file other than `.gitignore`; no application code, tests, configuration, scripts, CI, or production runtime may read, write, import, or depend on it. All reproducible builds and tests must pass without it.

Do not commit generated output, secrets, environment-specific state, logs, or stale debug helpers. Preserve only reproducible sources and intentional fixtures in tracked directories.

## 8. Definition of done

A change is complete only when its acceptance criteria are met; formatting, linting, and the code quality rules pass; TDD RED/GREEN/REFACTOR steps have been followed; applicable tests and checks were actually run and passed; architecture boundaries are respected; documentation is updated; and the diff contains no unrelated edits or leaked secrets.

Every delivery report must state the behavior changed, tests added, **exact checks run with results**, documentation touched, and any checks not run with a reason. Never claim success for unexecuted checks.
