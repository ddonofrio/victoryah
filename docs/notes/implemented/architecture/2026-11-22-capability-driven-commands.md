# Agent Note: Capability-driven unit actions and context orders

Status: implemented

## Problem

The command interface must show, for any selection, only the actions every selected unit supports, and right clicks must do the sensible thing per unit. Hardcoding unit-type combinations would not scale with the roster.

## Decision

- Each `UnitTypeDefinition` declares `capabilities` (`move`, `attack`, `harvest`, `build`, `repair`, `extract`, `haul`, `stop`) and the data each needs (weapon, harvest spec, builder spec...). A content test asserts that capabilities and component data always agree.
- `sharedActions(definitions)` returns the canonical-order intersection of capabilities; the command panel renders exactly that list.
- The context order (`smart` command) is resolved in the engine (`src/engine/sim/smart.ts`): each unit tries the interactions its capabilities allow for the clicked target (attack, repair, build, haul, harvest, extract); units that cannot interact move there, spread by the group formation.

## Alternatives considered

- **Per-type UI configuration:** duplicates information and breaks for mixed selections.
- **Resolving context orders in the client:** a server would have to trust or re-implement the same logic; keeping it in the engine makes local and networked play identical.

## Consequences

- New units only need a definition (and a model) to appear correctly in the UI.
- Capability names are a shared contract between content, engine and client.
