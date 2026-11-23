import type { World } from '../world';

/** Recomputes every player's vision from their own units and reveals underground deposits. */
export function updatePerception(world: World): void {
  const entities = world.entitiesList();
  for (const player of world.playersList()) {
    const vision = world.visibility(player.id);
    vision.beginUpdate();
    for (const entity of entities) {
      if (entity.owner !== player.id) continue;
      const def = world.def(entity.typeId);
      const sight = entity.built >= 1 ? def.sightRange : Math.min(2, def.sightRange);
      vision.reveal(entity.x, entity.y, sight);
    }
    vision.endUpdate();
  }
  revealDeposits(world);
}

function revealDeposits(world: World): void {
  const prospectors = world.entitiesList().filter((e) => (world.def(e.typeId).prospectRange ?? 0) > 0);
  if (prospectors.length === 0) return;
  for (const deposit of world.depositsList()) {
    if (!deposit.hidden) continue;
    for (const prospector of prospectors) {
      if (deposit.revealedTo.includes(prospector.owner)) continue;
      const range = world.def(prospector.typeId).prospectRange!;
      if (Math.hypot(deposit.x - prospector.x, deposit.y - prospector.y) > range) continue;
      deposit.revealedTo.push(prospector.owner);
      world.emit({ type: 'depositRevealed', depositId: deposit.id, owner: prospector.owner });
    }
  }
}
