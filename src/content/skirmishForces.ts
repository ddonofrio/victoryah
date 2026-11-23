/** Starting forces of the skirmish scenario (balance data). */

/** Starting force of the local player: the full first-milestone roster. */
export const PLAYER_FORCE: readonly [string, number][] = [
  ['scout', 1],
  ['infantry', 6],
  ['lightArmoredVehicle', 2],
  ['heavyTank', 2],
  ['siegeUnit', 1],
  ['surveillanceDrone', 1],
  ['militaryEngineer', 2],
  ['prospector', 1],
  ['harvester', 2],
  ['drillingUnit', 1],
  ['collectionDrone', 2],
  ['transportVehicle', 1],
  ['mobileRefinery', 1],
  ['salvageUnit', 1],
  ['mobileEnergyExtractor', 1],
];

export const PLAYER_DEFENCES: readonly string[] = ['automaticTurret', 'longRangeTurret', 'antiAirTurret'];
export const ENEMY_DEFENCES: readonly string[] = [
  'automaticTurret',
  'automaticTurret',
  'longRangeTurret',
  'antiAirTurret',
];
export const ENEMY_GARRISON: readonly [string, number][] = [
  ['infantry', 5],
  ['lightArmoredVehicle', 2],
  ['heavyTank', 1],
  ['surveillanceDrone', 1],
];
export const ENEMY_PATROL: readonly [string, number][] = [
  ['infantry', 3],
  ['lightArmoredVehicle', 1],
];
