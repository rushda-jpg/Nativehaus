import type { CameraKeyframe, LngLat } from "../config/geo";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Shortest-path bearing interpolation so rotation never spins the long way round. */
function lerpBearing(a: number, b: number, t: number): number {
  let delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

export interface InterpolatedCamera {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * Piecewise-linear interpolation across an ordered list of camera
 * keyframes, keyed by global scroll progress (0..1). Used every frame with
 * `map.jumpTo` so the camera stays perfectly scrubbable in both directions.
 */
export function interpolateCamera(
  progress: number,
  keyframes: CameraKeyframe[],
): InterpolatedCamera {
  const p = clamp(progress, 0, 1);

  if (p <= keyframes[0].progress) {
    return toCamera(keyframes[0]);
  }
  const last = keyframes[keyframes.length - 1];
  if (p >= last.progress) {
    return toCamera(last);
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const from = keyframes[i];
    const to = keyframes[i + 1];
    if (p >= from.progress && p <= to.progress) {
      const span = to.progress - from.progress;
      const t = span <= 0 ? 0 : (p - from.progress) / span;
      return {
        center: [lerp(from.center[0], to.center[0], t), lerp(from.center[1], to.center[1], t)],
        zoom: lerp(from.zoom, to.zoom, t),
        pitch: lerp(from.pitch, to.pitch, t),
        bearing: lerpBearing(from.bearing, to.bearing, t),
      };
    }
  }

  return toCamera(last);
}

function toCamera(k: CameraKeyframe): InterpolatedCamera {
  return { center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing };
}
