import { createSkirmish, type Scenario } from '../instances/skirmish';
import { VICTORYAH_RULESET } from '../content/units';
import type { Command } from '../engine/sim/commands';
import { Simulation } from '../engine/sim/simulation';
import { restoreWorld, snapshotWorld, type WorldSnapshot } from '../engine/sim/snapshot';
import type { PlayerId } from '../engine/sim/types';
import { Terrain } from '../engine/world/terrain';

/** Longest real-time slice simulated in one frame; prevents a "spiral of death" after pauses. */
export const MAX_FRAME_SECONDS = 0.25;
export const SAVED_GAME_VERSION = 1;

export interface SavedGame {
  readonly version: number;
  readonly scenario: 'skirmish';
  readonly seed: number;
  readonly mapSize: number;
  readonly localPlayerId: PlayerId;
  readonly world: WorldSnapshot;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A command as issued by the local client; the session adds the player identity. */
export type LocalCommand = DistributiveOmit<Command, 'playerId'>;

/**
 * Application service for one local game: owns the simulation, drives it from real time with a
 * fixed-step accumulator and stamps local commands with the player's identity. In a networked
 * build this is where commands would be sent to the authoritative server instead.
 */
export class GameSession {
  private accumulator = 0;

  private constructor(
    readonly seed: number,
    readonly terrain: Terrain,
    readonly simulation: Simulation,
    readonly localPlayerId: PlayerId,
  ) {}

  static create(seed: number): GameSession {
    return GameSession.fromScenario(createSkirmish(seed));
  }

  static restore(saved: SavedGame): GameSession {
    const terrain = new Terrain({ seed: saved.seed, width: saved.mapSize, height: saved.mapSize });
    const world = restoreWorld(saved.world, terrain, VICTORYAH_RULESET);
    return new GameSession(saved.seed, terrain, new Simulation(world), saved.localPlayerId);
  }

  private static fromScenario(scenario: Scenario): GameSession {
    return new GameSession(scenario.seed, scenario.terrain, new Simulation(scenario.world), scenario.localPlayerId);
  }

  /** Fraction of the next tick already elapsed, for render interpolation. */
  get alpha(): number {
    return this.accumulator / Simulation.DT;
  }

  /** Advances by real elapsed seconds; returns the number of simulation steps executed. */
  advance(realSeconds: number): number {
    this.accumulator += Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
    let steps = 0;
    // A small epsilon keeps accumulated floating-point error from dropping a tick.
    while (this.accumulator >= Simulation.DT - 1e-9) {
      this.simulation.step();
      this.accumulator = Math.max(0, this.accumulator - Simulation.DT);
      steps++;
    }
    return steps;
  }

  submit(command: LocalCommand): void {
    this.simulation.submit({ ...command, playerId: this.localPlayerId } as Command);
  }

  toSavedGame(): SavedGame {
    return {
      version: SAVED_GAME_VERSION,
      scenario: 'skirmish',
      seed: this.seed,
      mapSize: this.terrain.width,
      localPlayerId: this.localPlayerId,
      world: snapshotWorld(this.simulation.world),
    };
  }
}
