import * as THREE from 'three';

/** Shared materials and primitive helpers for procedural low-poly models. */
export class ModelKit {
  readonly hull = new THREE.MeshLambertMaterial({ color: 0x9aa0a8, flatShading: true });
  readonly dark = new THREE.MeshLambertMaterial({ color: 0x3a3d44, flatShading: true });
  readonly glow = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  readonly hazard = new THREE.MeshLambertMaterial({ color: 0xe8b830, flatShading: true });
  private readonly teamMaterials = new Map<number, THREE.MeshLambertMaterial>();

  team(color: number): THREE.MeshLambertMaterial {
    let material = this.teamMaterials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.teamMaterials.set(color, material);
    }
    return material;
  }

  box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  cylinder(r: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, sides = 8): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, sides), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /** A barrel pointing along +x, starting at the given origin. */
  barrel(length: number, radius: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x + length / 2, y, z);
    return mesh;
  }

  sphere(r: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  wheels(length: number, width: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    for (const x of [-length / 2, length / 2]) {
      for (const z of [-width / 2, width / 2]) {
        const wheel = this.cylinder(0.13, 0.08, material, x, 0.13, z, 8);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
      }
    }
    return group;
  }

  /** Tank-style tracks on both sides. */
  tracks(length: number, width: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    for (const z of [-width / 2, width / 2]) group.add(this.box(length, 0.22, 0.18, material, 0, 0.11, z));
    return group;
  }
}

/** A built model: the root group plus an optional rotating head (turrets, cannons). */
export interface UnitModel {
  readonly root: THREE.Group;
  readonly head?: THREE.Object3D;
  /** Rotors and similar parts that spin continuously. */
  readonly spinners: THREE.Object3D[];
  /** Height of the model's top, used to place health bars. */
  readonly height: number;
}
