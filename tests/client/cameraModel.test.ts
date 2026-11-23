import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, CameraModel } from '../../src/client/camera/cameraModel';

const bounds = { width: 256, height: 256 };

describe('CameraModel', () => {
  it('places the eye at the configured distance from the target', () => {
    const camera = new CameraModel(bounds, { targetX: 50, targetZ: 60, yaw: 0.3, pitch: 1, distance: 40 });
    const eye = camera.eye();
    expect(Math.hypot(eye.x - 50, eye.y, eye.z - 60)).toBeCloseTo(40, 6);
    expect(eye.y).toBeGreaterThan(0);
  });

  it('clamps zoom and inclination', () => {
    const camera = new CameraModel(bounds, { targetX: 50, targetZ: 50, yaw: 0, pitch: 1, distance: 40 });
    camera.zoom(1000);
    expect(camera.state.distance).toBe(CAMERA_LIMITS.maxDistance);
    camera.zoom(0.0001);
    expect(camera.state.distance).toBe(CAMERA_LIMITS.minDistance);
    camera.tilt(10);
    expect(camera.state.pitch).toBe(CAMERA_LIMITS.maxPitch);
    camera.tilt(-10);
    expect(camera.state.pitch).toBe(CAMERA_LIMITS.minPitch);
  });

  it('pans relative to the current rotation', () => {
    const camera = new CameraModel(bounds, { targetX: 100, targetZ: 100, yaw: 0, pitch: 1, distance: 40 });
    const before = { ...camera.state };
    camera.pan(0, 1); // "forward": away from the eye
    const eye = camera.eye();
    const movedAway = Math.hypot(camera.state.targetX - eye.x, camera.state.targetZ - eye.z);
    expect(camera.state.targetZ).not.toBe(before.targetZ);
    camera.rotate(Math.PI / 2);
    const rotated = { ...camera.state };
    camera.pan(0, 1);
    expect(camera.state.targetX).not.toBe(rotated.targetX);
    expect(movedAway).toBeGreaterThan(0);
  });

  it('keeps the target inside the map', () => {
    const camera = new CameraModel(bounds, { targetX: 10, targetZ: 10, yaw: 0, pitch: 1, distance: 40 });
    camera.focus(-500, 9999);
    expect(camera.state.targetX).toBe(0);
    expect(camera.state.targetZ).toBe(256);
  });
});
