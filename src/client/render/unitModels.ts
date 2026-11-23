import * as THREE from 'three';
import type { ModelKit, UnitModel } from './modelKit';

type Builder = (kit: ModelKit, team: THREE.Material) => UnitModel;

const model = (root: THREE.Group, height: number, head?: THREE.Object3D, spinners: THREE.Object3D[] = []): UnitModel =>
  head ? { root, head, spinners, height } : { root, spinners, height };

const group = (...children: THREE.Object3D[]): THREE.Group => {
  const g = new THREE.Group();
  g.add(...children);
  return g;
};

const infantry: Builder = (kit, team) => {
  const root = group(
    kit.cylinder(0.12, 0.38, team, 0, 0.27, 0, 6),
    kit.sphere(0.1, kit.hull, 0, 0.53, 0),
    kit.barrel(0.28, 0.025, kit.dark, 0.02, 0.32, 0.1),
  );
  return model(root, 0.7);
};

const engineer: Builder = (kit, team) => {
  const root = group(
    kit.cylinder(0.13, 0.38, team, 0, 0.27, 0, 6),
    kit.sphere(0.11, kit.hazard, 0, 0.54, 0),
    kit.box(0.16, 0.18, 0.2, kit.hazard, -0.15, 0.3, 0),
  );
  return model(root, 0.72);
};

const scout: Builder = (kit, team) => {
  const root = group(
    kit.box(0.7, 0.16, 0.4, team, 0, 0.25, 0),
    kit.box(0.25, 0.14, 0.32, kit.dark, -0.05, 0.38, 0),
    kit.cylinder(0.015, 0.5, kit.dark, -0.25, 0.6, 0.12, 4),
    kit.wheels(0.5, 0.42, kit.dark),
  );
  return model(root, 0.8);
};

const lightArmoredVehicle: Builder = (kit, team) => {
  const head = group(kit.box(0.34, 0.16, 0.3, team, 0, 0, 0), kit.barrel(0.4, 0.04, kit.dark, 0.1, 0, 0));
  head.position.y = 0.52;
  const root = group(kit.box(0.95, 0.26, 0.55, kit.hull, 0, 0.32, 0), kit.wheels(0.7, 0.6, kit.dark), head);
  return model(root, 0.75, head);
};

const heavyTank: Builder = (kit, team) => {
  const head = group(kit.box(0.55, 0.24, 0.5, team, -0.05, 0, 0), kit.barrel(0.75, 0.06, kit.dark, 0.15, 0, 0));
  head.position.y = 0.6;
  const root = group(kit.box(1.1, 0.3, 0.75, kit.hull, 0, 0.34, 0), kit.tracks(1.15, 0.78, kit.dark), head);
  return model(root, 0.85, head);
};

const siegeUnit: Builder = (kit, team) => {
  const gun = kit.barrel(1.0, 0.07, kit.dark, 0, 0, 0);
  const head = group(kit.box(0.45, 0.22, 0.5, team, 0, 0, 0), gun);
  head.rotation.z = 0.45;
  head.position.y = 0.6;
  const pivot = group(head);
  const root = group(kit.box(1.1, 0.3, 0.7, kit.hull, 0, 0.32, 0), kit.tracks(1.1, 0.74, kit.dark), pivot);
  return model(root, 1.1, pivot);
};

const drone = (scale: number): Builder => {
  return (kit, team) => {
    const rotor = group(kit.box(0.9 * scale, 0.02, 0.08, kit.dark), kit.box(0.08, 0.02, 0.9 * scale, kit.dark));
    rotor.position.y = 0.18 * scale;
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * scale, 0), team);
    body.scale.y = 0.5;
    const root = group(body, kit.sphere(0.07 * scale, kit.glow, 0.2 * scale, 0, 0), rotor);
    return model(root, 0.5, undefined, [rotor]);
  };
};

const turretBase = (kit: ModelKit, team: THREE.Material): THREE.Mesh[] => [
  kit.cylinder(0.48, 0.35, kit.hull, 0, 0.17, 0, 8),
  kit.cylinder(0.3, 0.12, team, 0, 0.4, 0, 8),
];

const automaticTurret: Builder = (kit, team) => {
  const head = group(
    kit.box(0.42, 0.26, 0.38, team),
    kit.barrel(0.45, 0.035, kit.dark, 0.15, 0.02, 0.08),
    kit.barrel(0.45, 0.035, kit.dark, 0.15, 0.02, -0.08),
  );
  head.position.y = 0.6;
  return model(group(...turretBase(kit, team), head), 0.85, head);
};

const longRangeTurret: Builder = (kit, team) => {
  const head = group(kit.box(0.5, 0.3, 0.42, team), kit.barrel(1.1, 0.06, kit.dark, 0.15, 0.06, 0));
  head.position.y = 0.66;
  return model(group(...turretBase(kit, team), kit.cylinder(0.2, 0.3, kit.dark, 0, 0.5, 0), head), 0.95, head);
};

const antiAirTurret: Builder = (kit, team) => {
  const launcher = group(
    kit.box(0.36, 0.3, 0.42, team),
    kit.barrel(0.5, 0.05, kit.dark, 0.1, 0.12, 0.12),
    kit.barrel(0.5, 0.05, kit.dark, 0.1, 0.12, -0.12),
  );
  launcher.rotation.z = 0.7;
  const head = group(launcher);
  head.position.y = 0.62;
  return model(group(...turretBase(kit, team), head), 1, head);
};

const commandCenter: Builder = (kit, team) => {
  const dish = kit.cylinder(0.35, 0.05, kit.hull, 0.6, 1.75, 0.4, 10);
  dish.rotation.z = 0.5;
  const root = group(
    kit.cylinder(1.45, 0.6, kit.hull, 0, 0.3, 0, 6),
    kit.cylinder(1.05, 0.55, team, 0, 0.85, 0, 6),
    kit.sphere(0.55, kit.dark, 0, 1.25, 0),
    kit.cylinder(0.04, 1.0, kit.dark, 0.6, 1.4, 0.4, 4),
    dish,
    kit.sphere(0.08, kit.glow, -0.7, 1.15, -0.6),
  );
  return model(root, 2);
};

export const MILITARY_BUILDERS: Readonly<Record<string, Builder>> = {
  infantry,
  militaryEngineer: engineer,
  scout,
  lightArmoredVehicle,
  heavyTank,
  siegeUnit,
  surveillanceDrone: drone(1),
  automaticTurret,
  longRangeTurret,
  antiAirTurret,
  commandCenter,
  collectionDrone: drone(0.7),
};

export type { Builder };
