// Real-world reference geometry for the Arrival + Site scenes.
// Coordinates are WGS84 [lng, lat], matching Mapbox GL's convention.

export type LngLat = readonly [lng: number, lat: number];

export interface CameraKeyframe {
  progress: number;
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

// Jumeirah Village Triangle, Dubai — bounded to the east by Al Khail Road
// (E44). Sunmarke School sits near JVT's eastern edge, close to E44; the
// Native Haus plot is placed just north of the school, between it and E44.
export const SUNMARKE_SCHOOL: LngLat = [55.1933, 25.047];
export const JVT_CENTER: LngLat = [55.199, 25.049];
export const E44_REFERENCE: LngLat = [55.2075, 25.0505];
export const NATIVE_HAUS_SITE: LngLat = [55.2012, 25.0479];

// Small quadrilateral plot on the eastern edge of JVT, near Sunmarke
// School and E44. Approximate footprint ~90m x 55m.
export const SITE_PLOT_RING: LngLat[] = [
  [55.2008, 25.04815],
  [55.20165, 25.048],
  [55.20172, 25.04765],
  [55.20085, 25.0477],
  [55.2008, 25.04815],
];

// Large box (well outside any framed viewport from siteApproach onward)
// with the plot cut out as a hole, used to dim the surroundings while
// leaving the actual parcel untouched — see MapCanvas's dim-mask layer.
// Exterior ring wound CCW, hole (the plot) wound CW, per the GeoJSON
// right-hand rule; SITE_PLOT_RING is already CW so it's used as-is.
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

export const SITE_DIM_MASK_RINGS: LngLat[][] = [boxRing(NATIVE_HAUS_SITE, 0.025, 0.025), SITE_PLOT_RING];

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
  { progress: 0.64, center: [55.2005, 25.0483], zoom: 16.6, pitch: 62, bearing: -18 },
  { progress: 0.7, center: NATIVE_HAUS_SITE, zoom: 17.6, pitch: 63, bearing: -16 },
  // Building construction: slow, subtle settle/dolly-in around the mass.
  { progress: 0.85, center: NATIVE_HAUS_SITE, zoom: 17.95, pitch: 64, bearing: -10 },
  { progress: 1.0, center: NATIVE_HAUS_SITE, zoom: 18.35, pitch: 62, bearing: -4 },
];
