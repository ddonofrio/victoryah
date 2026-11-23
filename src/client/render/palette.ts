import type { ResourceKind } from '../../engine/sim/definitions';
import { TileKind } from '../../engine/world/terrain';

/** Visual palette of the planetary surface (a rust-coloured world under two suns). */
export const TILE_COLORS: Readonly<Record<TileKind, number>> = {
  [TileKind.Plains]: 0x9a6a48,
  [TileKind.Highland]: 0x7f5a44,
  [TileKind.Rock]: 0x5e4a40,
  [TileKind.Mountain]: 0x6c5d58,
  [TileKind.Cliff]: 0x4f4140,
  [TileKind.CraterRim]: 0x8a6c58,
  [TileKind.CraterFloor]: 0x6e4c3a,
};

const TEAM_COLORS: Readonly<Record<number, number>> = {
  1: 0x39b4ff,
  2: 0xff5a46,
};

export const teamColor = (owner: number): number => TEAM_COLORS[owner] ?? 0xd0d0d0;

export const RESOURCE_COLORS: Readonly<Record<ResourceKind, number>> = {
  crystal: 0x5ff0ff,
  ore: 0xff8a3d,
  energy: 0xb98cff,
  salvage: 0xb8b8a8,
};

export const SKY_COLOR = 0x120e18;
