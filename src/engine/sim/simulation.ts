import { applyCommand, type Command } from './commands';
import { updateEntity } from './systems/orders';
import { separateUnits } from './systems/movement';
import { updatePerception } from './systems/perception';
import type { SimEvent } from './types';
import type { World } from './world';

/**
 * Fixed-timestep driver for one World. Game rules advance only through `step()`, never with the
 * rendering frame rate, so outcomes are identical on any client and on a future server.
 */
export class Simulation {
  static readonly TICK_RATE = 20;
  static readonly DT = 1 / Simulation.TICK_RATE;
  private queue: Command[] = [];

  constructor(readonly world: World) {
    updatePerception(world);
  }

  get tick(): number {
    return this.world.tick;
  }

  /** Queues a command; it is validated and applied at the start of the next step. */
  submit(command: Command): void {
    this.queue.push(command);
  }

  step(): void {
    const world = this.world;
    const commands = this.queue;
    this.queue = [];
    for (const command of commands) applyCommand(world, command);
    updatePerception(world);
    for (const entity of world.entitiesList()) {
      if (world.entity(entity.id)) updateEntity(world, entity, Simulation.DT);
    }
    separateUnits(world);
    world.tick++;
  }

  drainEvents(): SimEvent[] {
    return this.world.drainEvents();
  }
}
