/** Pure state and math of the strategic RTS camera (no Three.js), so it can be unit tested. */
export interface CameraState {
  /** Ground point the camera looks at, in world tiles (x, z = map y). */
  targetX: number;
  targetZ: number;
  /** Rotation around the vertical axis, radians. */
  yaw: number;
  /** Inclination above the ground plane, radians (π/2 = straight down). */
  pitch: number;
  /** Distance from the eye to the target. */
  distance: number;
}

export const CAMERA_LIMITS = {
  minDistance: 10,
  maxDistance: 110,
  minPitch: (30 * Math.PI) / 180,
  maxPitch: (85 * Math.PI) / 180,
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class CameraModel {
  readonly state: CameraState;

  constructor(
    private readonly bounds: { readonly width: number; readonly height: number },
    initial: CameraState,
  ) {
    this.state = { ...initial };
    this.focus(initial.targetX, initial.targetZ);
  }

  eye(): { x: number; y: number; z: number } {
    const { targetX, targetZ, yaw, pitch, distance } = this.state;
    const horizontal = Math.cos(pitch) * distance;
    return {
      x: targetX + Math.sin(yaw) * horizontal,
      y: Math.sin(pitch) * distance,
      z: targetZ + Math.cos(yaw) * horizontal,
    };
  }

  /** Moves the target: `right` and `forward` are in world tiles relative to the view direction. */
  pan(right: number, forward: number): void {
    const { yaw } = this.state;
    const dx = Math.cos(yaw) * right - Math.sin(yaw) * forward;
    const dz = -Math.sin(yaw) * right - Math.cos(yaw) * forward;
    this.focus(this.state.targetX + dx, this.state.targetZ + dz);
  }

  /** Multiplies the distance by `factor` (< 1 zooms in). */
  zoom(factor: number): void {
    this.state.distance = clamp(this.state.distance * factor, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
  }

  rotate(deltaYaw: number): void {
    this.state.yaw = (this.state.yaw + deltaYaw) % (Math.PI * 2);
  }

  tilt(deltaPitch: number): void {
    this.state.pitch = clamp(this.state.pitch + deltaPitch, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch);
  }

  focus(x: number, z: number): void {
    this.state.targetX = clamp(x, 0, this.bounds.width);
    this.state.targetZ = clamp(z, 0, this.bounds.height);
  }
}
