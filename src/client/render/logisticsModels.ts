import * as THREE from 'three';
import type { ModelKit, UnitModel } from './modelKit';
import type { Builder } from './unitModels';

const group = (...children: THREE.Object3D[]): THREE.Group => {
  const g = new THREE.Group();
  g.add(...children);
  return g;
};

const prospector: Builder = (kit, team) => {
  const dish = kit.cylinder(0.2, 0.04, kit.hull, -0.15, 0.62, 0, 10);
  dish.rotation.z = 0.6;
  const root = group(kit.box(0.75, 0.2, 0.42, team, 0, 0.28, 0), kit.wheels(0.52, 0.45, kit.dark), dish);
  return { root, spinners: [dish], height: 0.8 };
};

const harvester: Builder = (kit, team) => {
  const root = group(
    kit.box(1.0, 0.45, 0.7, kit.hazard, 0, 0.4, 0),
    kit.box(0.35, 0.3, 0.6, team, -0.3, 0.75, 0),
    kit.box(0.25, 0.2, 0.8, kit.dark, 0.6, 0.2, 0),
    kit.tracks(1.0, 0.72, kit.dark),
  );
  return { root, spinners: [], height: 1 };
};

const drillingUnit: Builder = (kit, team) => {
  const drill = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 6), kit.dark);
  drill.rotation.x = Math.PI;
  drill.position.set(0.35, 0.3, 0);
  const tower = kit.box(0.2, 0.7, 0.2, kit.hazard, 0.35, 0.8, 0);
  const root = group(kit.box(0.9, 0.35, 0.65, team, 0, 0.32, 0), kit.tracks(0.9, 0.68, kit.dark), tower, drill);
  return { root, spinners: [drill], height: 1.2 };
};

const transportVehicle: Builder = (kit, team) => {
  const root = group(
    kit.box(0.35, 0.35, 0.5, team, 0.45, 0.38, 0),
    kit.box(0.85, 0.45, 0.55, kit.hull, -0.2, 0.45, 0),
    kit.box(0.86, 0.06, 0.56, team, -0.2, 0.7, 0),
    kit.wheels(0.8, 0.55, kit.dark),
  );
  return { root, spinners: [], height: 0.9 };
};

const mobileRefinery: Builder = (kit, team) => {
  const root = group(
    kit.box(1.3, 0.4, 0.9, kit.hull, 0, 0.38, 0),
    kit.cylinder(0.22, 0.6, team, -0.3, 0.85, -0.2, 8),
    kit.cylinder(0.22, 0.6, team, -0.3, 0.85, 0.22, 8),
    kit.cylinder(0.08, 0.9, kit.dark, 0.35, 1.0, 0, 6),
    kit.sphere(0.07, kit.glow, 0.35, 1.5, 0),
    kit.tracks(1.3, 0.9, kit.dark),
  );
  return { root, spinners: [], height: 1.5 };
};

const salvageUnit: Builder = (kit, team) => {
  const arm = group(
    kit.box(0.8, 0.07, 0.07, kit.hazard, 0.35, 0, 0),
    kit.box(0.08, 0.25, 0.08, kit.dark, 0.75, -0.12, 0),
  );
  arm.position.set(-0.2, 0.75, 0);
  arm.rotation.z = 0.35;
  const root = group(kit.box(0.9, 0.35, 0.6, team, 0, 0.35, 0), kit.wheels(0.65, 0.62, kit.dark), arm);
  return { root, spinners: [], height: 1.1 };
};

const mobileEnergyExtractor: Builder = (kit, team) => {
  const coil = group(
    kit.cylinder(0.08, 0.7, kit.dark, 0, 0, 0, 6),
    ...[0, 0.2, 0.4].map((y) => kit.cylinder(0.18, 0.05, kit.glow, 0, y - 0.2, 0, 8)),
  );
  coil.position.set(0.1, 0.85, 0);
  const root = group(kit.box(0.9, 0.35, 0.6, team, 0, 0.32, 0), kit.tracks(0.9, 0.62, kit.dark), coil);
  return { root, spinners: [coil], height: 1.3 };
};

export const LOGISTICS_BUILDERS: Readonly<Record<string, Builder>> = {
  prospector,
  harvester,
  drillingUnit,
  transportVehicle,
  mobileRefinery,
  salvageUnit,
  mobileEnergyExtractor,
};

/** Fallback for unit types without a dedicated model. */
export const fallbackModel = (kit: ModelKit, team: THREE.Material): UnitModel => ({
  root: group(kit.box(0.6, 0.4, 0.6, team, 0, 0.2, 0)),
  spinners: [],
  height: 0.6,
});
