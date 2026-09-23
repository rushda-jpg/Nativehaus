// Building placement/scale configuration — the ONE place that controls
// where and how the temporary procedural proxy (and, later, the real
// Native Haus GLB) sits on the corrected parcel. Never hardcode a manual
// position/rotation/scale directly in Three.js or Mapbox code — read it
// from here instead, so a future GLB swap only needs to change
// buildingBuilder.ts, not the geographic wiring in MapCanvas/BuildingLayer.
//
// BUILDING_ANCHOR and BUILDING_BEARING are DERIVED from the digitized
// parcel (plotGeometry.ts) — the fitted footprint's center and the real
// measured long-road bearing, not chosen by hand. The four knobs below
// (OFFSET_X/Y, SCALE_X/Y) are genuinely free variables, at identity
// defaults; HEIGHT documents the current massing's ceiling.

import type { LngLat } from "./geo";
import {
  BUILDING_FOOTPRINT_CENTER_LOCAL,
  BUILDING_BEARING_DEG,
  DEPTH_AXIS,
  FITTED_FOOTPRINT_DEPTH_M,
  FITTED_FOOTPRINT_WIDTH_M,
  WIDTH_AXIS,
  localToLngLat,
  type Local2,
} from "./plotGeometry";

/** Nudge the building within its permitted envelope, in meters along the
 * plot's own axes (+X = further along the long-road direction, +Y =
 * deeper into the site interior). 0,0 = the geometric fit's own center. */
export const BUILDING_OFFSET_X_METERS = 0;
export const BUILDING_OFFSET_Y_METERS = 0;

/** Multiplies the fitted footprint's width/depth. 1,1 = use the fitted
 * size as-is (already the largest that respects setbacks and the
 * 1927.5 sqm coverage cap — growing this back out is the caller's
 * responsibility to re-verify). */
export const BUILDING_SCALE_X = 1;
export const BUILDING_SCALE_Y = 1;

/** Documented ceiling for the current Ground + 6 upper floors + modest
 * rooftop structure massing (well under the 35m planning maximum;
 * G+6 only — there is no podium or mezzanine level) — informational for
 * the debug HUD and for a future GLB to target, not an active rescale of
 * buildingBuilder's own floor-height constants. */
export const BUILDING_HEIGHT_M = 25.1;

function offsetLocal(): Local2 {
  const [cx, cy] = BUILDING_FOOTPRINT_CENTER_LOCAL;
  return [
    cx + WIDTH_AXIS[0] * BUILDING_OFFSET_X_METERS + DEPTH_AXIS[0] * BUILDING_OFFSET_Y_METERS,
    cy + WIDTH_AXIS[1] * BUILDING_OFFSET_X_METERS + DEPTH_AXIS[1] * BUILDING_OFFSET_Y_METERS,
  ];
}

/** Real-world bearing (degrees, CCW from East) the building's local
 * width (+X) axis is rotated to, so it matches the parcel's actual
 * long-road-facing edge. Consumed directly by BuildingLayer. */
export const BUILDING_BEARING = BUILDING_BEARING_DEG;

/** Where the building is anchored — the fitted footprint's center (plus
 * any configured offset), converted to WGS84 for Mapbox. */
export const BUILDING_ANCHOR: LngLat = localToLngLat(offsetLocal());

export const BUILDING_FOOTPRINT_WIDTH_M = FITTED_FOOTPRINT_WIDTH_M * BUILDING_SCALE_X;
export const BUILDING_FOOTPRINT_DEPTH_M = FITTED_FOOTPRINT_DEPTH_M * BUILDING_SCALE_Y;
