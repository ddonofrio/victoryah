import * as THREE from 'three';
import { FogState, type VisibilityMap } from '../../engine/world/visibility';

/**
 * Fog of war shading shared by every ground-level material: a single-channel texture covering
 * the map (one texel per tile) darkens unexplored ground to black and explored-but-unseen ground
 * to a dim, desaturated tone. Linear filtering gives soft edges at no extra cost.
 */
export class FogOfWarTexture {
  readonly texture: THREE.DataTexture;
  readonly uniforms: { fogMap: { value: THREE.DataTexture }; mapSize: { value: THREE.Vector2 } };
  private readonly data: Uint8Array<ArrayBuffer>;
  private lastVersion = -1;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.data = new Uint8Array(width * height);
    this.texture = new THREE.DataTexture(this.data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.uniforms = { fogMap: { value: this.texture }, mapSize: { value: new THREE.Vector2(width, height) } };
  }

  /** Uploads the player's current vision if it changed since the last call. */
  update(vision: VisibilityMap): void {
    if (vision.version === this.lastVersion) return;
    this.lastVersion = vision.version;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const state = vision.stateAt(x, y);
        this.data[y * this.width + x] = state === FogState.Visible ? 255 : state === FogState.Explored ? 110 : 0;
      }
    }
    this.texture.needsUpdate = true;
  }

  /** Patches a built-in material so its output is shaded by the fog texture. */
  apply<T extends THREE.Material>(material: T): T {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFogUv;\nuniform vec2 mapSize;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${FOG_VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFogUv;\nuniform sampler2D fogMap;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FOG_FRAGMENT}`);
    };
    return material;
  }
}

const FOG_VERTEX = `
  vec4 fogWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    fogWorld = instanceMatrix * fogWorld;
  #endif
  fogWorld = modelMatrix * fogWorld;
  vFogUv = fogWorld.xz / mapSize;
`;

const FOG_FRAGMENT = `
  float fogValue = texture2D(fogMap, vFogUv).r;
  float explored = smoothstep(0.0, 0.43, fogValue);
  float visible = smoothstep(0.43, 1.0, fogValue);
  vec3 dim = vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114))) * vec3(0.55, 0.5, 0.6);
  vec3 shaded = mix(dim * 0.75, gl_FragColor.rgb, visible);
  gl_FragColor.rgb = mix(vec3(0.015, 0.012, 0.02), shaded, explored);
`;
