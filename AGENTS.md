# Repository Instructions for Coding Agents

These rules apply to every agent, contributor, tool-assisted change, and subtask in this repository. Read `README.md` and `DEVELOPMENT.md` before changing code. When instructions conflict, explicit user requirements take precedence; otherwise follow these repository rules.

## 1. Non-negotiable working contract

- **English only:** All project-owned source code, identifiers, filenames where practical, comments, docstrings, documentation, tests, test names, error messages, logs, commit messages, configuration descriptions, and agent notes must be written in English. Preserve player-authored text and other user input verbatim and support Unicode where appropriate.
- **Test-driven development is mandatory:** For a behavioral change, first write or modify a meaningful automated test that fails for the intended reason (RED); implement the smallest change that makes it pass (GREEN); then refactor while keeping the tests green (REFACTOR).
- **Execute the tests:** Never claim completion based only on written tests or static inspection. Run the relevant tests after every implementation cycle, and run the broader applicable checks before presenting work as complete. Record the exact commands and results.
- **Document what changes:** Maintain the relevant user, developer, architecture, API, data-model, and operational documentation in the same change as the code. Document important decisions using the Agent Note format in `DEVELOPMENT.md`.
- **Code quality rules are mandatory:** Prettier formatting, ESLint linting, a 500-line limit per source file, and a 50-line limit per function or method, enforced locally and in CI. Never bypass or disable quality checks. The canonical rules are in `DEVELOPMENT.md` ("Code quality rules").
- **Make focused changes:** No unrelated refactoring, speculative infrastructure, large rewrites, hidden behavior changes, or unnecessary dependencies.
- **Keep the application modular:** Enforce explicit boundaries among the game engine, game/world instances, content and configuration data, persistence, application services, network transport, and UI.
- **Never add author, co-author, or AI-generated attribution** to source code, file headers, comments, docstrings, or metadata. If an author field is required, use only the user's explicitly configured identity. Never credit AI assistants, bots, software, or automated tools as creators or contributors.

## 2. Work sequence

1. Read the request and inspect existing code, tests, architecture, documentation, and tooling. Do not infer repository behavior when it can be checked.
2. Identify the smallest observable behavior to implement and its relevant architectural boundary. State assumptions only when needed.
3. Write a failing test, then **run it and verify the failure**. The failure must demonstrate the missing behavior, not a broken test harness.
4. Implement the minimal production change. Run the test until green.
5. Refactor for clarity and separation of responsibilities. Rerun relevant tests.
6. Run formatting, linting, and the required static checks, integration tests, and applicable broader suite. For UI changes, include practical manual verification instructions; automated tests are still required.
7. Update documentation, examples, and decision notes when contracts or behavior change.
8. Review the diff for scope, secrets, dead code, temporary artifacts, and undocumented behavior. Summarize changed files, executed checks, results, and any remaining limitations.

If tests cannot be executed, report the actual blocker and do not say the change is tested or complete. If the repository lacks a test harness, establish the smallest reliable one before building substantial application behavior.

## 3. Architecture and modularity

- **Game engine:** Pure, reusable domain rules (economy, movement, combat, progression, time-based resolution). It must not depend on HTTP, UI, a database driver, a specific world instance, or deployment details.
- **World/game instances:** Manage the independent state and lifecycle of each persistent universe or server instance. Instance identity, clocks, scheduling, and state must not leak between universes.
- **Data and content definitions:** Keep balance values, ship/building/research definitions, and starting conditions separate from algorithms. Validate and version schemas when persistence requires it.
- **Application services:** Coordinate use cases such as building, fleet dispatch, colonization, and battle resolution. Enforce authorization and transaction boundaries without reimplementing game rules.
- **Persistence:** Hide storage technology behind explicit interfaces or repositories. Persist authoritative state, support safe migrations, and keep infrastructure concerns outside the engine.
- **Transport and UI:** Treat requests as untrusted; validate inputs and permissions server-side. The web client renders state and initiates commands, but never authoritatively determines game outcomes.
- **Shared contracts:** Prefer small explicit types and versioned events over implicit cross-layer coupling. Keep dependency direction toward domain contracts; avoid circular dependencies and global mutable state.
- **Determinism:** Separate time, random number generation, and external effects from domain logic so combat, resource production, and scheduled events can be tested reproducibly.
- **Asynchronous multiplayer:** Design operations to tolerate retries, races, disconnected clients, and out-of-order workers. Use idempotency and transactional consistency where necessary; do not add distributed infrastructure without evidence it is needed.

Use SOLID as a design guide, DRY to remove _actual_ duplication, and KISS to prefer understandable solutions. Apply YAGNI: avoid premature abstractions, microservices, and frameworks without a demonstrated requirement.

## 4. Testing and quality gates

- Cover happy paths, invalid input, boundary values, permission failures, concurrency where relevant, and persistence behavior.
- Keep domain tests fast, isolated, and deterministic. Use integration tests for database, API, scheduler, and network boundaries; add end-to-end tests for critical player journeys when supported.
- Fix flaky tests instead of ignoring them. Do not weaken assertions, mock the behavior under test, or alter expected results merely to make a test pass.
- Apply formatting, linting, static typing/type checks, security checks, and CI gates supported by the chosen stack. Do not invent pass results or silently skip required checks.
- A change is not complete if relevant tests fail or its documentation is stale.

## 5. Documentation rules

- `README.md` is the concise entry point for project purpose, status, setup, and documentation links.
- `DEVELOPMENT.md` is the authoritative contributor workflow, testing standard, architecture rules, and release process.
- Add narrowly scoped architecture and decision records when a nontrivial design or operational decision is made. Use **Problem, Decision, Alternatives considered, Consequences** and an explicit status.
- Keep docs factual and linked to current behavior. Never claim nonexistent commands, integrations, or features are available.
- Describe the _why_ for decisions; explain public contracts and operational steps precisely. Link canonical sources instead of duplicating large sections.

## 6. Scratch workspace: strict isolation

- The repository has one dedicated, Git-ignored scratch directory at its root, defined **only** by the dedicated entry in `.gitignore`.
- Both the user and agents may freely put disposable notes, generated intermediates, logs, downloads, and experiments there. Nothing stored there is a deliverable, tracked source, or authoritative data.
- **No other tracked file may mention that directory's literal name or path.** The single permitted literal reference is its ignore entry in `.gitignore`.
- Production code, tests, fixtures, configuration, scripts, CI, build processes, and documentation must never import, read from, write to, enumerate, or depend on that directory, directly or indirectly.
- All required project behavior and checks must work after the scratch directory is deleted. Never use its contents to make tests pass or to deploy the application.

## 7. Security and completion

- Do not commit credentials, access tokens, player secrets, database dumps, or private production data. Use managed configuration and safe examples.
- Check authentication, authorization, abuse controls, and trust boundaries for multiplayer actions; keep the server authoritative.
- Before declaring completion, report: **behavior implemented, tests added, commands actually executed with results, documentation updated, and outstanding risks**. If a step was not done, say so explicitly.
