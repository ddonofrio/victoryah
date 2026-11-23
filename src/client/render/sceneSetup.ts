import * as THREE from 'three';
import { SKY_COLOR } from './palette';

export interface SceneBundle {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
}

/** Creates the renderer, scene and lighting: a warm primary sun and a cool companion star. */
export function createScene(container: HTMLElement): SceneBundle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, 90, 230);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.5, 600);

  scene.add(new THREE.HemisphereLight(0xb8a8d8, 0x3a2418, 0.9));
  const primary = new THREE.DirectionalLight(0xffd2a0, 1.9);
  primary.position.set(80, 120, 40);
  const companion = new THREE.DirectionalLight(0x8fb8ff, 0.7);
  companion.position.set(-90, 60, -70);
  scene.add(primary, companion);

  const resize = () => {
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', resize);
  return { renderer, scene, camera };
}
