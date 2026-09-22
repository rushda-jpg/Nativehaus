// Real-world reference geometry for the Arrival + Site scenes.
// Coordinates are WGS84 [lng, lat], matching Mapbox GL's convention.

import {
  BUILDING_FOOTPRINT_CENTER_LOCAL,
  BUILDING_FOOTPRINT_RING_LOCAL,
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

// Confirmed geographic anchor for the official Native Haus plot (Parcel
// ID 6849739 / JVT04LMRA002), from the Site Plan / Affection Plan. This
// is the local-geometry origin — see plotGeometry.ts.
export const NATIVE_HAUS_SITE: LngLat = [55.195435, 25.045633];

// The true official plot boundary (quadrilateral + R=7m fillet),
// projected from plotGeometry's local-meter reconstruction.
export const SITE_PLOT_RING: LngLat[] = localRingToLngLat(NATIVE_HAUS_SITE, PLOT_RING_LOCAL);

// Debug-only (?debug=1): the road-setback envelope the building footprint
// was fitted inside.
export const SETBACK_ENVELOPE_RING: LngLat[] = localRingToLngLat(NATIVE_HAUS_SITE, [
  ...SETBACK_ENVELOPE_LOCAL,
  SETBACK_ENVELOPE_LOCAL[0],
]);

// Debug-only (?debug=1): the fitted building footprint outline.
export const BUILDING_FOOTPRINT_RING: LngLat[] = localRingToLngLat(NATIVE_HAUS_SITE, BUILDING_FOOTPRINT_RING_LOCAL);

// Where the Three.js building is actually anchored (its footprint
// center) — distinct from NATIVE_HAUS_SITE, which is the plot's
// confirmed geographic corner (local origin), not the building's center.
export const BUILDING_ANCHOR: LngLat = localToLngLat(NATIVE_HAUS_SITE, BUILDING_FOOTPRINT_CENTER_LOCAL);

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

// Scene 2's approach waypoint (progress 0.64) is offset from the
// building anchor by the same relative amount used before the site
// correction, so the camera's approach motion/feel is unchanged — only
// translated onto the corrected location.
const APPROACH_WAYPOINT_OFFSET: LngLat = [-0.0007, 0.0004];
const approachWaypoint: LngLat = [
  BUILDING_ANCHOR[0] + APPROACH_WAYPOINT_OFFSET[0],
  BUILDING_ANCHOR[1] + APPROACH_WAYPOINT_OFFSET[1],
];

export const CAMERA_KEYFRAMES: CameraKeyframe[] = [
  // Deep space — far above the Gulf, near-flat globe view.
  { progress: 0.0, center: [55.4, 24.6], zoom: 0.4, pitch: 0, bearing: 0 },
  { progress: 0.12, center: [55.35, 24.9], zoom: 2.4, pitch: 0, bearing: 0 },
  // Descent toward the Dubai coastline.
  { progress: 0.3, center: [55.27, 25.15], zoom: 9.2, pitch: 20, bearing: -6 },
  // Continue, uninterrupted, into JVT.
  { progress: 0.48, center: [55.205, 25.055], zoom: 14.4, pitch: 48, bearing: -14 },
  // Scene 1 final: oblique aerial over JVT, E44 visible to the east (right).
  { progress: 0.55, center: JVT_CENTER, zoom: 15.6, pitch: 60, bearing: -18 },
  // Scene 2: continue toward the Native Haus plot.
  { progress: 0.64, center: approachWaypoint, zoom: 16.6, pitch: 62, bearing: -18 },
  { progress: 0.7, center: BUILDING_ANCHOR, zoom: 17.6, pitch: 63, bearing: -16 },
  // Building construction: slow, subtle settle/dolly-in around the mass.
  { progress: 0.85, center: BUILDING_ANCHOR, zoom: 17.95, pitch: 64, bearing: -10 },
  { progress: 1.0, center: BUILDING_ANCHOR, zoom: 18.35, pitch: 62, bearing: -4 },
];
