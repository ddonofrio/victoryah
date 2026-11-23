# Agent Note: Mandatory formatting, linting and size limits

Status: implemented

## Problem

The repository owner made code quality rules mandatory: a formatter and linter, automated enforcement including CI, at most 500 lines per source file and 50 lines per function, refactoring instead of growth, exclusions only for generated and third-party code, and no bypassing of checks.

## Decision

- Prettier (`.prettierrc.json`) and ESLint with `typescript-eslint` (`eslint.config.js`), integrated through `eslint-config-prettier`.
- ESLint `max-lines` (500) and `max-lines-per-function` (50), counting blank lines and comments, applied to all project code including tests.
- `linterOptions.noInlineConfig` rejects inline `eslint-disable` comments.
- `npm run check` runs formatting, typecheck, lint, tests and build; GitHub Actions CI runs the same gates plus end-to-end smoke tests.
- The canonical rules live in `DEVELOPMENT.md` ("Code quality rules"); `AGENTS.md` references them.

## Alternatives considered

- **Biome or dprint** as formatter: fast, but Prettier is the most widely supported choice and integrates with existing editor setups.
- **Size limits excluding tests:** rejected; the rule says source code files, and long test callbacks hide unrelated scenarios.

## Consequences

- Large `describe` blocks must be split by concern; long functions must be decomposed.
- Exceptions require explicit owner approval and a documented change to the rules.
