import { describe, expect, it } from 'vitest';
import { GameSession, MAX_FRAME_SECONDS } from '../../src/app/gameSession';
import { snapshotWorld } from '../../src/engine/sim/snapshot';

const state = (session: GameSession) => JSON.stringify(snapshotWorld(session.simulation.world));

describe('GameSession timing', () => {
  it('advances the simulation in fixed steps independent of the frame rate', () => {
    const fast = GameSession.create(5);
    const slow = GameSession.create(5);
    for (let i = 0; i < 120; i++) fast.advance(1 / 120);
    for (let i = 0; i < 10; i++) slow.advance(0.1);
    expect(fast.simulation.tick).toBe(20);
    expect(slow.simulation.tick).toBe(20);
    expect(state(fast)).toBe(state(slow));
  });

  it('exposes an interpolation factor between ticks', () => {
    const session = GameSession.create(5);
    session.advance(0.075);
    expect(session.simulation.tick).toBe(1);
    expect(session.alpha).toBeCloseTo(0.5, 5);
  });

  it('caps the work done after a long pause', () => {
    const session = GameSession.create(5);
    session.advance(10);
    expect(session.simulation.tick).toBe(Math.round(MAX_FRAME_SECONDS * 20));
  });
});

describe('GameSession commands and persistence', () => {
  it('issues commands on behalf of the local player only', () => {
    const session = GameSession.create(5);
    const world = session.simulation.world;
    const own = world.entitiesList().find((e) => e.owner === session.localPlayerId && e.typeId === 'scout')!;
    const enemy = world.entitiesList().find((e) => e.owner !== session.localPlayerId && e.typeId === 'infantry')!;
    session.submit({ type: 'move', unitIds: [own.id, enemy.id], x: own.x + 5, y: own.y });
    session.advance(0.05);
    expect(own.order.type).toBe('move');
    expect(enemy.order.type).toBe('idle');
  });

  it('round-trips through a saved game', () => {
    const session = GameSession.create(77);
    session.advance(0.2);
    session.advance(0.2);
    const saved = JSON.parse(JSON.stringify(session.toSavedGame()));
    const restored = GameSession.restore(saved);
    expect(restored.seed).toBe(77);
    expect(state(restored)).toBe(state(session));
    for (let i = 0; i < 10; i++) {
      session.advance(0.2);
      restored.advance(0.2);
    }
    expect(state(restored)).toBe(state(session));
  });
});
