# Gameplay guide: planetary RTS (MVP 1)

This guide describes what is playable today. It covers the planetary layer only; the space layer, multiplayer and autonomous command arrive in later milestones. Balance values live in `src/content` and are first-milestone placeholders.

## The skirmish

Each game takes place on one procedurally generated planet (256 × 256 tiles) derived from a seed. Your command center stands on the main landmass with a starting force. A hostile garrison holds the far side of the planet and a patrol waits near the middle. You start with 400 crystal and 150 ore.

The planet is mostly flat, open ground broken by highlands, mountains, cliffs, rock fields and craters. Mountains, cliffs, crater rims and rocks block ground units; each crater rim has one gap. Air units fly over everything.

## Controls

| Input                       | Effect                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| Left click                  | Select a unit or structure (enemies can be inspected, not commanded)      |
| Left drag                   | Box-select your units (mobile units take precedence over structures)      |
| Shift + click / drag        | Toggle / add to the selection                                             |
| Double click                | Select all visible units of the same type                                 |
| Right click                 | Context order (see below)                                                 |
| Command panel or hotkey     | M move, A attack, H harvest, B build, R repair, X extract, T haul, S stop |
| Ctrl + 1–9, 1–9, double tap | Assign a control group, recall it, recall and centre the camera           |
| Esc                         | Cancel targeting, close the build menu, then clear the selection          |
| Arrow keys, screen edges    | Pan                                                                       |
| Mouse wheel                 | Zoom                                                                      |
| Middle drag, Q / E, Z / C   | Rotate, change inclination                                                |
| Space                       | Centre on the selection                                                   |
| Minimap                     | Left click or drag to look, right click to order the selection            |
| F1                          | Controls reference                                                        |

### Context-sensitive orders

The command panel shows only the actions **every** selected unit supports, derived from unit capabilities. A heavy tank shows Move, Attack, Stop; a harvester shows Move, Harvest, Stop; both together show only Move and Stop.

A right click lets each unit do the most useful thing it can with the target, and units that cannot interact with it move there instead:

- enemy in sight → armed units attack;
- damaged friendly unit or structure → engineers repair; unfinished structure → engineers resume construction;
- your mobile refinery → transports haul its output;
- known resource deposit → compatible gatherers harvest it, energy extractors deploy on energy vents;
- open ground → move, spread over distinct destinations around the point.

An order toward a place ground units cannot reach (a mountain, a structure, ground cut off from them) sends them to the nearest point they can reach.

## Units and structures

### Military

| Unit                  | Role                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| Scout                 | Fast, unarmed, longest ground sight (12): exploration and spotting                  |
| Infantry              | Cheap rifles; can hit ground, air and structures                                    |
| Light Armored Vehicle | Fast skirmisher                                                                     |
| Heavy Tank            | Slow, heavily armoured main cannon                                                  |
| Siege Unit            | Artillery, range 11, triple damage against structures; needs spotters for its range |
| Surveillance Drone    | Air unit, unarmed, sight 13: reconnaissance for turrets and artillery               |
| Military Engineer     | Builds turrets and repairs units and structures                                     |

### Defensive structures (turrets)

Turrets are built by engineers on explored, unobstructed ground and cost resources. They cannot move.

| Turret            | Cost                | Role                                                                |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| Automatic Turret  | 100 crystal, 25 ore | Rapid fire against ground units, range 7                            |
| Long-Range Turret | 150 crystal, 60 ore | Range 14 against ground and structures, but its own sight is only 6 |
| Anti-Air Turret   | 120 crystal, 30 ore | Only engages air units, range 10                                    |

**Detection matters:** a weapon only fires at targets its owner can currently see. Every unit and structure contributes its sight to its player's vision, so scouts and drones extend the effective reach of turrets and siege units; a long-range turret alone cannot use its full range.

The **Command Center** is the main base and the stockpile for delivered resources.

### Resource gathering and logistics

| Unit                    | Role                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| Prospector              | Reveals underground ore deposits within 9 tiles                         |
| Harvester               | Gathers surface crystal                                                 |
| Drilling Unit           | Extracts underground ore, once revealed                                 |
| Collection Drone        | Air unit that automatically gathers nearby crystal when idle            |
| Transport Vehicle       | Hauls refined output from a mobile refinery to the command center       |
| Mobile Refinery         | Forward drop-off point; processes raw deliveries with a 1.5× yield      |
| Salvage Unit            | Recovers materials from wreckage left by destroyed units and structures |
| Mobile Energy Extractor | Deploys next to an energy vent and feeds energy into the stockpile      |

Gatherers deliver to the nearest drop-off: the command center credits the stockpile directly; a mobile refinery stores and processes deliveries until a transport carries the refined output home. When a deposit runs out, gatherers move on to a nearby deposit of the same kind.

### Roster adjustments made for this milestone

The requested roster was kept, with these clarifications to keep the economy coherent without a full production chain:

- A **Command Center** was added as the base structure and stockpile (no unit production yet).
- The **Mobile Refinery** doubles as a forward drop-off, which gives the **Transport Vehicle** a concrete job (refinery → stockpile).
- The **Collection Drone** is the automated crystal gatherer; automation is a unit capability rather than a separate system, ready to be generalised by autonomous command later.
- Destroyed units and structures leave **salvage** deposits, the Salvage Unit's resource.

## Resources

| Resource | Source                                        | Gathered by                 |
| -------- | --------------------------------------------- | --------------------------- |
| Crystal  | Surface fields                                | Harvester, Collection Drone |
| Ore      | Underground deposits, hidden until prospected | Drilling Unit               |
| Energy   | Energy vents                                  | Mobile Energy Extractor     |
| Salvage  | Wreckage of destroyed units and structures    | Salvage Unit                |

Crystal and ore pay for turrets. Energy and salvage are collected and stored but not yet spent; they anticipate production and research in later milestones.

## Fog of war

Unexplored ground is black. Explored ground you cannot currently see is dimmed: terrain and known deposits remain visible but enemy units are hidden. Enemy structures and units appear only while inside your vision. The minimap follows the same rules.

## Not yet in this milestone

Unit production, research, an opposing strategic AI (enemy units only defend themselves), attack-move, terrain line-of-sight, the space layer, multiplayer and server persistence.
