// Real-world reference geometry for the Arrival + Site scenes.
// Coordinates are WGS84 [lng, lat], matching Mapbox GL's convention.

import { BUILDING_ANCHOR, BUILDING_FOOTPRINT_WIDTH_M } from "./buildingTransform";
import {
  ACCESS_FRONT_ARROW_LOCAL,
  ACCESS_LABEL_LOCAL,
  BUILDING_FOOTPRINT_RING_LOCAL,
  CONTROL_POINTS_LOCAL,
  CORNER_LABEL_LOCAL,
  FRONT_VIEW_BEARING_DEG,
  FRONT_VIEW_TARGET_LOCAL,
  GOOGLE_VALIDATION_POINT,
  LONG_ROAD_LABEL_LOCAL,
  PLOT_RING_LOCAL,
  SETBACK_ENVELOPE_LOCAL,
  localRingToLngLat,
  localToLngLat,
} from "./plotGeometry";

export type LngLat = readonly [lng: number, lat: number];

export interface CameraKeyframe {
  progress: number;
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

// Jumeirah Village Triangle, Dubai — bounded to the east by Al Khail Road
// (E44). Sunmarke School sits near JVT's eastern edge, close to E44.
export const SUNMARKE_SCHOOL: LngLat = [55.1933, 25.047];
export const JVT_CENTER: LngLat = [55.199, 25.049];
export const E44_REFERENCE: LngLat = [55.2075, 25.0505];

// Google-confirmed validation point — used to sanity-check the
// georeferenced parcel below (see plotGeometry.ts), never as its origin.
export const NATIVE_HAUS_SITE: LngLat = GOOGLE_VALIDATION_POINT;

// The official plot boundary, digitized from the Site Plan's own
// EPSG:3997 grid (quadrilateral + true R=7m fillet) — see plotGeometry.ts
// for the georeferencing method and validation.
export const SITE_PLOT_RING: LngLat[] = localRingToLngLat([...PLOT_RING_LOCAL, PLOT_RING_LOCAL[0]]);

// Debug-only (?debug=1): the road-setback envelope the building footprint
// was fitted inside.
export const SETBACK_ENVELOPE_RING: LngLat[] = localRingToLngLat([...SETBACK_ENVELOPE_LOCAL, SETBACK_ENVELOPE_LOCAL[0]]);

// Debug-only (?debug=1): the fitted building footprint outline.
export const BUILDING_FOOTPRINT_RING: LngLat[] = localRingToLngLat(BUILDING_FOOTPRINT_RING_LOCAL);

export { BUILDING_ANCHOR, BUILDING_FOOTPRINT_WIDTH_M };

// Hero-reveal camera target — see plotGeometry.ts. The point the final
// front-three-quarter camera looks at (biased toward the rounded road
// corner), and the compass bearing it faces, both derived from the same
// digitized site geometry as the approved building placement.
export const FRONT_VIEW_TARGET: LngLat = localToLngLat(FRONT_VIEW_TARGET_LOCAL);
// Normalized to (-180, 180] to match this file's existing bearing style.
export const FRONT_VIEW_BEARING = ((FRONT_VIEW_BEARING_DEG + 180) % 360) - 180;

// Debug-only (?debug=1) verification aids — see plotGeometry.ts.
export const CONTROL_POINTS: { label: string; point: LngLat }[] = CONTROL_POINTS_LOCAL.map(({ label, point }) => ({
  label,
  point: localToLngLat(point),
}));
export const LONG_ROAD_LABEL_POINT: LngLat = localToLngLat(LONG_ROAD_LABEL_LOCAL);
export const ACCESS_LABEL_POINT: LngLat = localToLngLat(ACCESS_LABEL_LOCAL);
export const CORNER_LABEL_POINT: LngLat = localToLngLat(CORNER_LABEL_LOCAL);
export const ACCESS_FRONT_ARROW: LngLat[] = localRingToLngLat(ACCESS_FRONT_ARROW_LOCAL);

// Large box (well outside any framed viewport from siteApproach onward)
// with the plot cut out as a hole, used to dim the surroundings while
// leaving the actual parcel untouched — see MapCanvas's dim-mask layer.
// Exterior ring wound CCW, hole (the plot) wound CW, per the GeoJSON
// right-hand rule; SITE_PLOT_RING comes out CCW from plotGeometry (same
// winding as the local reconstruction), so it's reversed for use as a hole.
function boxRing(center: LngLat, halfWidthDeg: number, halfHeightDeg: number): LngLat[] {
  const [lng, lat] = center;
  return [
    [lng - halfWidthDeg, lat - halfHeightDeg],
    [lng + halfWidthDeg, lat - halfHeightDeg],
    [lng + halfWidthDeg, lat + halfHeightDeg],
    [lng - halfWidthDeg, lat + halfHeightDeg],
    [lng - halfWidthDeg, lat - halfHeightDeg],
  ];
}

const plotRingCW = [...SITE_PLOT_RING].reverse();
export const SITE_DIM_MASK_RINGS: LngLat[][] = [boxRing(BUILDING_ANCHOR, 0.025, 0.025), plotRingCW];

// Scene 2's approach waypoint (previously progress 0.64, now 0.32 — see
// the compressed arrival timing below) is offset from the building anchor
// by the same relative amount used before the site correction, so the
// camera's approach motion/feel is unchanged — only translated onto the
// corrected location.
const APPROACH_WAYPOINT_OFFSET: LngLat = [-0.0007, 0.0004];
const approachWaypoint: LngLat = [
  BUILDING_ANCHOR[0] + APPROACH_WAYPOINT_OFFSET[0],
  BUILDING_ANCHOR[1] + APPROACH_WAYPOINT_OFFSET[1],
];

function lerpPoint(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function lerpDeg(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---- Public experience: arrival + hold, then the video takes over ------
// Same approved geography/feel as before (globe -> Dubai -> JVT -> plot),
// rescaled from its old [0, 0.35] span into [0, 0.40] per the new
// timeline (SCENE_WINDOWS.plotBoundary ends at 0.40). The last keyframe
// is the hand-off hold: interpolateCamera clamps to it for any progress
// beyond 0.40, so the camera simply stops moving through plotHold
// (0.40-0.45) while Mapbox crossfades into the construction video — no
// separate "hold" keyframe needed. Framing (aerial oblique, pitch ~63°,
// plot filling most of the view) is chosen to broadly match the supplied
// video's own first frame, though exact pixel alignment isn't achievable
// since that frame comes from a different map provider (Google Earth) —
// the crossfade, not the camera math, is what has to bridge that gap.
export const CAMERA_KEYFRAMES: CameraKeyframe[] = [
  { progress: 0.0, center: [55.4, 24.6], zoom: 0.4, pitch: 0, bearing: 0 },
  { progress: 0.069, center: [55.35, 24.9], zoom: 2.4, pitch: 0, bearing: 0 },
  { progress: 0.171, center: [55.27, 25.15], zoom: 9.2, pitch: 20, bearing: -6 },
  { progress: 0.274, center: [55.205, 25.055], zoom: 14.4, pitch: 48, bearing: -14 },
  { progress: 0.314, center: JVT_CENTER, zoom: 15.6, pitch: 60, bearing: -18 },
  { progress: 0.366, center: approachWaypoint, zoom: 16.6, pitch: 62, bearing: -18 },
  { progress: 0.4, center: BUILDING_ANCHOR, zoom: 17.6, pitch: 63, bearing: -16 },
];

// ---- Retired: full descent-to-hero camera (?debugBuilding=1 only) ------
// Unchanged from the previous round — paired with the procedural
// building + hero environment (buildingBuilder.ts/heroEnvironment.ts),
// kept for development/reference now that the supplied construction
// video is the public building reveal.
export const LEGACY_CAMERA_KEYFRAMES: CameraKeyframe[] = [
  { progress: 0.0, center: [55.4, 24.6], zoom: 0.4, pitch: 0, bearing: 0 },
  { progress: 0.06, center: [55.35, 24.9], zoom: 2.4, pitch: 0, bearing: 0 },
  { progress: 0.15, center: [55.27, 25.15], zoom: 9.2, pitch: 20, bearing: -6 },
  { progress: 0.24, center: [55.205, 25.055], zoom: 14.4, pitch: 48, bearing: -14 },
  { progress: 0.275, center: JVT_CENTER, zoom: 15.6, pitch: 60, bearing: -18 },
  { progress: 0.32, center: approachWaypoint, zoom: 16.6, pitch: 62, bearing: -18 },
  { progress: 0.35, center: BUILDING_ANCHOR, zoom: 17.6, pitch: 63, bearing: -16 },
  { progress: 0.55, center: BUILDING_ANCHOR, zoom: 17.8, pitch: 63.5, bearing: -13 },
  { progress: 0.75, center: BUILDING_ANCHOR, zoom: 17.95, pitch: 64, bearing: -10 },
  {
    progress: 0.8,
    center: lerpPoint(BUILDING_ANCHOR, FRONT_VIEW_TARGET, 0.25),
    zoom: 18.15,
    pitch: 70,
    bearing: lerpDeg(-10, FRONT_VIEW_BEARING, 0.25),
  },
  {
    progress: 0.85,
    center: lerpPoint(BUILDING_ANCHOR, FRONT_VIEW_TARGET, 0.55),
    zoom: 18.35,
    pitch: 75,
    bearing: lerpDeg(-10, FRONT_VIEW_BEARING, 0.55),
  },
  {
    progress: 0.9,
    center: lerpPoint(BUILDING_ANCHOR, FRONT_VIEW_TARGET, 0.8),
    zoom: 18.6,
    pitch: 79,
    bearing: lerpDeg(-10, FRONT_VIEW_BEARING, 0.8),
  },
  { progress: 0.96, center: FRONT_VIEW_TARGET, zoom: 18.85, pitch: 82, bearing: FRONT_VIEW_BEARING },
  { progress: 1.0, center: FRONT_VIEW_TARGET, zoom: 19.0, pitch: 81, bearing: FRONT_VIEW_BEARING },
];
