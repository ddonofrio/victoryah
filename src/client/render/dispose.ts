import * as THREE from 'three';

/**
 * Releases the GPU buffers of every geometry below an object. Three.js never frees them on its
 * own when an object leaves the scene. Materials are left alone because the views share them;
 * do not use it on objects whose geometry is shared with objects that stay in the scene.
 */
export function disposeGeometries(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
  });
}
