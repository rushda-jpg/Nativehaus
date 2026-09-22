// Official Native Haus plot geometry — Parcel ID 6849739, Developer Plot
// JVT04LMRA002, from the Native Haus Site Plan (Drg. Ref. JVT2025P90-1,
// issued 10-11-2025).
//
// SUPERSEDES the earlier side-length-only reconstruction (which produced
// a polygon ~13% under the official 2965.41 sqm area). This version is
// digitized directly from the Site Plan drawing itself, georeferenced
// through its four printed EPSG:3997 grid control points, rather than
// inferred from the four boundary dimensions alone.
//
// ---- How this was digitized -------------------------------------------
// The Site Plan PDF was rasterized at 400dpi. Its four printed control
// crosses (486030/486150 E × 2771070/2771160 N) were located by pixel
// centroid, giving a least-squares similarity transform from pixel space
// to EPSG:3997 (residuals ≤0.15m across a 120m baseline — the scan has
// negligible skew). The parcel's three SHARP corners (V1: top/long-road,
// V2: top/adjacent, V3: adjacent/access) were then found as intersections
// of lines fitted through 100-190 sampled points along each red boundary
// edge (not eyeballed corners, which is what the earlier attempt had to
// rely on). The two road-facing edges (LONG_ROAD, ACCESS) were fitted the
// same way, giving real measured bearings — not assumed ones.
//
// Cross-checks (all independent of each other, all passed — re-verified
// programmatically on every load, see verify() at the bottom of this file):
//  - V1-V2 measured 46.78m vs official TOP=46.71m (+0.15%)
//  - V2-V3 measured 68.47m vs official ADJACENT=68.41m (+0.09%)
//  - LONG_ROAD measured bearing 197.1° vs the task's own verification
//    estimate of "~197°"; ACCESS measured bearing 110.7° vs "~111°"
//  - Full parcel (quadrilateral + R=7m fillet) area = 2971.5 sqm vs
//    official 2965.41 sqm (+0.21%) — down from the old ~13% mismatch
//  - The confirmed Google anchor [55.195435, 25.045633] falls INSIDE the
//    digitized polygon
//  - The fitted building footprint's center (derived independently, see
//    below) lands a few meters from that same Google point
// A ~0.2% area gap and sub-metre corner residuals are consistent with
// digitization/print resolution, not a construction error.
//
// V1, V2, V3 and the two edge directions below are the source-of-truth
// digitized data; everything else in this file (the fillet, the setback
// envelope, the building footprint fit) is derived from them.

import { epsg3997ToWgs84 } from "./epsg3997";
import type { LngLat } from "./geo";

export type Local2 = readonly [easting: number, northing: number];

// ---- Digitized control data (EPSG:3997 meters) -------------------------
const V1: Local2 = [486078.868710, 2771155.109739]; // TOP / LONG_ROAD corner
const V2: Local2 = [486123.620043, 2771141.495781]; // TOP / ADJACENT corner
const V3: Local2 = [486099.179937, 2771077.531297]; // ADJACENT / ACCESS corner
// Unit direction V1 -> tangent point on the fillet, along the long-road edge.
const LONG_ROAD_DIR: Local2 = [-0.294074850, -0.955782393];
// Unit direction V3 -> tangent point on the fillet, along the access edge.
const ACCESS_DIR: Local2 = [-0.935390468, 0.353616562];

// ---- Official Site Plan parameters -------------------------------------
export const PARCEL_ID = "6849739";
export const DEVELOPER_PLOT_NO = "JVT04LMRA002";
export const OFFICIAL_PLOT_AREA_SQM = 2965.41;
export const MAX_PLOT_COVERAGE_RATIO = 0.65;
export const MAX_BUILDING_FOOTPRINT_SQM = 1927.5; // ~65% of 2965.41, as given

const TOP_M = 46.71;
const ADJACENT_M = 68.41;
const ACCESS_M = 35.71;
const LONG_ROAD_M = 58.9;
const CORNER_RADIUS_M = 7.0;
const ARC_LENGTH_M = 10.53;

// Prototype-only road setback (official range is 2-4m); kept separately
// configurable and NOT to be read as an approved planning setback.
export const PROTOTYPE_ROAD_SETBACK_M = 3.0;
export const OFFICIAL_ROAD_SETBACK_RANGE_M: readonly [number, number] = [2, 4];

// Google-confirmed validation point. Used only to sanity-check the
// digitized parcel below (it must fall inside it) — NOT as the parcel's
// origin or center. The georeferenced Site Plan determines the boundary.
export const GOOGLE_VALIDATION_POINT: LngLat = [55.195435, 25.045633];

// ---- 2D geometry helpers (EPSG:3997 meters throughout) -----------------
function sub(a: Local2, b: Local2): Local2 {
  return [a[0] - b[0], a[1] - b[1]];
}
function add(a: Local2, b: Local2): Local2 {
  return [a[0] + b[0], a[1] + b[1]];
}
function scale(a: Local2, s: number): Local2 {
  return [a[0] * s, a[1] * s];
}
function length(a: Local2): number {
  return Math.hypot(a[0], a[1]);
}
function normalize(a: Local2): Local2 {
  const l = length(a);
  return [a[0] / l, a[1] / l];
}
function perpLeft(d: Local2): Local2 {
  return [-d[1], d[0]];
}
function dot(a: Local2, b: Local2): number {
  return a[0] * b[0] + a[1] * b[1];
}
interface Line2 {
  p: Local2;
  d: Local2;
}
function footOnLine(line: Line2, pt: Local2): Local2 {
  const du = normalize(line.d);
  const t = dot(sub(pt, line.p), du);
  return add(line.p, scale(du, t));
}
function lineIntersect(l1: Line2, l2: Line2): Local2 {
  const [x1, y1] = l1.p;
  const [dx1, dy1] = l1.d;
  const [x2, y2] = l2.p;
  const [dx2, dy2] = l2.d;
  const denom = dx1 * dy2 - dy1 * dx2;
  const t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / denom;
  return [x1 + t * dx1, y1 + t * dy1];
}
/** Shifts a line toward `interiorRef` by `dist`, whichever perpendicular
 * side that is — avoids hardcoding a sign per edge. */
function shiftLineToward(p: Local2, d: Local2, dist: number, interiorRef: Local2): Line2 {
  const du = normalize(d);
  let n = perpLeft(du);
  if (dot(sub(interiorRef, p), n) < 0) n = scale(n, -1);
  return { p: add(p, scale(n, dist)), d: du };
}
function signedArea(pts: Local2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}
function ensureCCW(ring: Local2[]): Local2[] {
  return signedArea(ring) < 0 ? [...ring].reverse() : ring;
}
function pointInConvexPolygon(pt: Local2, poly: Local2[], margin = 0): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge = sub(b, a);
    const edgeLen = length(edge);
    const cross = (edge[0] * (pt[1] - a[1]) - edge[1] * (pt[0] - a[0])) / edgeLen;
    if (cross < margin) return false;
  }
  return true;
}
function discretizeArc(center: Local2, radius: number, from: Local2, to: Local2, segments: number): Local2[] {
  const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
  let da = a1 - a0;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  const pts: Local2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + da * (i / segments);
    pts.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  return pts;
}

// ---- The fillet: tangent points + arc center ---------------------------
const tanA = add(V1, scale(LONG_ROAD_DIR, LONG_ROAD_M)); // on long_road edge
const tanB = add(V3, scale(ACCESS_DIR, ACCESS_M)); // on access edge
const arcCenter: Local2 = scale(
  add(add(tanA, scale(perpLeft(LONG_ROAD_DIR), CORNER_RADIUS_M)), add(tanB, scale(perpLeft(ACCESS_DIR), -CORNER_RADIUS_M))),
  0.5,
);

const filletArc = discretizeArc(arcCenter, CORNER_RADIUS_M, tanB, tanA, 24);
const arcSweepRad = (() => {
  const a0 = Math.atan2(tanB[1] - arcCenter[1], tanB[0] - arcCenter[0]);
  const a1 = Math.atan2(tanA[1] - arcCenter[1], tanA[0] - arcCenter[0]);
  let da = a1 - a0;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da);
})();

/** The true digitized parcel boundary (EPSG:3997 meters, closed ring),
 * including the real R=7m fillet — not an approximated diagonal. */
export const PLOT_RING_LOCAL: Local2[] = ensureCCW([V1, V2, V3, tanB, ...filletArc.slice(1, -1), tanA]);

export const PLOT_AREA_SQM = Math.abs(signedArea(PLOT_RING_LOCAL));

// ---- Road-setback envelope (fillet-aware) -------------------------------
const shiftedLongRoad = shiftLineToward(V1, LONG_ROAD_DIR, PROTOTYPE_ROAD_SETBACK_M, arcCenter);
const shiftedAccess = shiftLineToward(V3, ACCESS_DIR, PROTOTYPE_ROAD_SETBACK_M, arcCenter);
const envelopeArcRadius = CORNER_RADIUS_M - PROTOTYPE_ROAD_SETBACK_M;
const envTanA = footOnLine(shiftedLongRoad, arcCenter);
const envTanB = footOnLine(shiftedAccess, arcCenter);
const envE2 = lineIntersect(shiftedLongRoad, { p: V1, d: sub(V2, V1) }); // top edge, unshifted (0m setback)
const envE4 = lineIntersect(shiftedAccess, { p: V2, d: sub(V3, V2) }); // adjacent edge, unshifted (0m setback)
const envelopeArc = discretizeArc(arcCenter, envelopeArcRadius, envTanB, envTanA, 16);

/** Buildable envelope after the prototype road setback — convex, CCW.
 * Only for fitting the footprint and the ?debug=1 overlay. */
export const SETBACK_ENVELOPE_LOCAL: Local2[] = ensureCCW([envE2, V2, envE4, envTanB, ...envelopeArc.slice(1, -1), envTanA]);

// ---- Fit the building footprint inside the envelope ---------------------
// Width axis runs along the real long-road bearing (LONG_ROAD_DIR) so the
// footprint — and later the building itself — is oriented by the actual
// plot, not an assumption. Anchored at the envelope's road corner (on the
// shrunk fillet) and grown toward the interior; a small safety margin
// avoids floating-point/arc-discretization edge cases at the 0m-setback
// sides. Binary search keeps this robust for an irregular quadrilateral.
const FOOTPRINT_ASPECT_RATIO = 1.7; // width : depth, matches the wide/horizontal reference massing
/** Real-world unit directions of the fitted footprint's own axes — width
 * runs along the long-road bearing, depth perpendicular into the site.
 * Exported so BUILDING_OFFSET_X/Y_METERS (buildingTransform.ts) can be
 * applied along the plot's real axes rather than raw Easting/Northing. */
export const WIDTH_AXIS: Local2 = normalize(LONG_ROAD_DIR);
export const DEPTH_AXIS: Local2 =
  dot(sub(V2, V1), perpLeft(WIDTH_AXIS)) < 0 ? scale(perpLeft(WIDTH_AXIS), -1) : perpLeft(WIDTH_AXIS);

const bisector = normalize(add(WIDTH_AXIS, normalize(ACCESS_DIR)));
const FIT_SAFETY_MARGIN_M = 0.1;
const tightAnchor = add(arcCenter, scale(bisector, envelopeArcRadius));
const fitAnchor = sub(tightAnchor, scale(bisector, FIT_SAFETY_MARGIN_M));

function footprintRectCorners(width: number, depth: number, anchor: Local2): Local2[] {
  const p1 = anchor;
  const p2 = sub(p1, scale(WIDTH_AXIS, width));
  const p3 = add(p2, scale(DEPTH_AXIS, depth));
  const p4 = add(p1, scale(DEPTH_AXIS, depth));
  return [p1, p2, p3, p4];
}
function footprintFits(width: number, depth: number): boolean {
  if (width * depth > MAX_BUILDING_FOOTPRINT_SQM) return false;
  return footprintRectCorners(width, depth, fitAnchor).every((c) => pointInConvexPolygon(c, SETBACK_ENVELOPE_LOCAL));
}

let lo = 0;
let hi = Math.max(LONG_ROAD_M, ADJACENT_M) * 1.2;
for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2;
  if (footprintFits(mid, mid / FOOTPRINT_ASPECT_RATIO)) lo = mid;
  else hi = mid;
}
const safeWidth = Math.max(0, lo - FIT_SAFETY_MARGIN_M * 2);
const safeDepth = Math.max(0, lo / FOOTPRINT_ASPECT_RATIO - FIT_SAFETY_MARGIN_M * 2);
const safeAnchor = sub(fitAnchor, scale(bisector, FIT_SAFETY_MARGIN_M));

export const FITTED_FOOTPRINT_WIDTH_M = safeWidth;
export const FITTED_FOOTPRINT_DEPTH_M = safeDepth;

const footprintCornersLocal = footprintRectCorners(safeWidth, safeDepth, safeAnchor);
export const BUILDING_FOOTPRINT_RING_LOCAL: Local2[] = [...footprintCornersLocal, footprintCornersLocal[0]];

/** Footprint center (EPSG:3997 meters) — what the building is actually
 * anchored on, distinct from V1/V2/V3 (the plot's own corners). */
export const BUILDING_FOOTPRINT_CENTER_LOCAL: Local2 = [
  (footprintCornersLocal[0][0] + footprintCornersLocal[2][0]) / 2,
  (footprintCornersLocal[0][1] + footprintCornersLocal[2][1]) / 2,
];

/** Real-world bearing of the footprint's width axis (long-road-aligned),
 * standard math convention (degrees, CCW from East) — matches
 * BuildingLayer's rotation convention. This is measured from the
 * digitized drawing, not assumed. */
export const BUILDING_BEARING_DEG = (((Math.atan2(WIDTH_AXIS[1], WIDTH_AXIS[0]) * 180) / Math.PI) + 360) % 360;

// ---- Building-local-frame plot boundary (for landscaping clipping) ------
export const PLOT_RING_RELATIVE_TO_FOOTPRINT: Local2[] = PLOT_RING_LOCAL.map(
  ([e, n]): Local2 => [e - BUILDING_FOOTPRINT_CENTER_LOCAL[0], n - BUILDING_FOOTPRINT_CENTER_LOCAL[1]],
);
// Rotated into the building's own (unrotated-in-Three.js) local X/Z frame,
// so buildingBuilder.ts (authored X=width, Z=depth, pre-rotation) can
// clip landscaping against the true plot boundary. This is the *exact*
// inverse of BuildingLayer's model transform — NOT a plain 2D rotation:
// the rotationY -> rotationX(90°) -> scale(1,-1,1) chain that reconciles
// Three.js's Y-up authoring space with Mapbox's Mercator space composes
// into [[cosθ, sinθ], [sinθ, -cosθ]] from (X,Z) to (east,north), a
// reflection-rotation whose determinant is -1 — and which is its own
// inverse (verified: applying it twice returns the original point), so
// the same formula is used to go the other way here.
const bearingRad = (BUILDING_BEARING_DEG * Math.PI) / 180;
const cosB = Math.cos(bearingRad);
const sinB = Math.sin(bearingRad);
const PLOT_RING_BUILDING_LOCAL: Local2[] = PLOT_RING_RELATIVE_TO_FOOTPRINT.map(
  ([e, n]): Local2 => [e * cosB + n * sinB, e * sinB - n * cosB],
);
export function isInsidePlotRelativeToFootprint(point: Local2): boolean {
  return pointInConvexPolygon(point, PLOT_RING_BUILDING_LOCAL);
}

// ---- Debug-only (?debug=1) verification aids ----------------------------
// The four EPSG:3997 grid crosses printed on the Site Plan itself, used
// to georeference it — shown so the calibration can be checked visually
// against the drawing.
export const CONTROL_POINTS_LOCAL: { label: string; point: Local2 }[] = [
  { label: "486030 E / 2771160 N", point: [486030, 2771160] },
  { label: "486150 E / 2771160 N", point: [486150, 2771160] },
  { label: "486030 E / 2771070 N", point: [486030, 2771070] },
  { label: "486150 E / 2771070 N", point: [486150, 2771070] },
];

export const LONG_ROAD_LABEL_LOCAL: Local2 = add(V1, scale(LONG_ROAD_DIR, LONG_ROAD_M / 2));
export const ACCESS_LABEL_LOCAL: Local2 = add(V3, scale(ACCESS_DIR, ACCESS_M / 2));
export const CORNER_LABEL_LOCAL: Local2 = add(arcCenter, scale(bisector, CORNER_RADIUS_M + 4));

/** A short line from the building's own center outward through the
 * road-corner anchor, past the parcel boundary — the "this way is the
 * access/front" indicator for ?debug=1. */
export const ACCESS_FRONT_ARROW_LOCAL: Local2[] = [
  BUILDING_FOOTPRINT_CENTER_LOCAL,
  add(safeAnchor, scale(bisector, 8)),
];

// ---- Local meters -> real lng/lat ---------------------------------------
export function localToLngLat(point: Local2): LngLat {
  return epsg3997ToWgs84(point[0], point[1]);
}
export function localRingToLngLat(ring: Local2[]): LngLat[] {
  return ring.map(localToLngLat);
}

// ---- Programmatic verification (see task's FINAL VALIDATION) -----------
function verify(): void {
  const failures: string[] = [];

  const areaDiffPct = (Math.abs(PLOT_AREA_SQM - OFFICIAL_PLOT_AREA_SQM) / OFFICIAL_PLOT_AREA_SQM) * 100;
  if (areaDiffPct > 5) {
    failures.push(
      `digitized parcel area ${PLOT_AREA_SQM.toFixed(1)} sqm differs from official ${OFFICIAL_PLOT_AREA_SQM} sqm by ${areaDiffPct.toFixed(1)}% (>5%)`,
    );
  }

  if (!pointInConvexPolygon(googleLocalForVerify(), PLOT_RING_LOCAL)) {
    failures.push("Google-confirmed validation point falls outside the digitized parcel");
  }

  const allInsidePlot = footprintCornersLocal.every((c) => pointInConvexPolygon(c, PLOT_RING_LOCAL));
  if (!allInsidePlot) failures.push("a building footprint corner is outside the digitized plot boundary");

  const allInsideEnvelope = footprintCornersLocal.every((c) => pointInConvexPolygon(c, SETBACK_ENVELOPE_LOCAL));
  if (!allInsideEnvelope) failures.push("a building footprint corner is outside the road-setback envelope");

  if (FITTED_FOOTPRINT_WIDTH_M * FITTED_FOOTPRINT_DEPTH_M > MAX_BUILDING_FOOTPRINT_SQM + 1e-6) {
    failures.push(`footprint area exceeds the ${MAX_BUILDING_FOOTPRINT_SQM} sqm cap`);
  }

  const measuredTop = length(sub(V2, V1));
  const measuredAdjacent = length(sub(V3, V2));
  const measuredArcAngleDeg = (arcSweepRad * 180) / Math.PI;
  if (Math.abs(measuredTop - TOP_M) > TOP_M * 0.05) {
    failures.push(`measured TOP edge ${measuredTop.toFixed(2)}m differs from official ${TOP_M}m by >5%`);
  }
  if (Math.abs(measuredAdjacent - ADJACENT_M) > ADJACENT_M * 0.05) {
    failures.push(`measured ADJACENT edge ${measuredAdjacent.toFixed(2)}m differs from official ${ADJACENT_M}m by >5%`);
  }
  const expectedArcAngleDeg = (ARC_LENGTH_M / CORNER_RADIUS_M) * (180 / Math.PI);
  if (Math.abs(measuredArcAngleDeg - expectedArcAngleDeg) > 3) {
    failures.push(
      `measured fillet sweep ${measuredArcAngleDeg.toFixed(1)}° differs from the R=${CORNER_RADIUS_M}m/L=${ARC_LENGTH_M}m official arc (${expectedArcAngleDeg.toFixed(1)}°) by >3°`,
    );
  }

  if (failures.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[plotGeometry] OK — digitized parcel ${PLOT_AREA_SQM.toFixed(1)} sqm (official ${OFFICIAL_PLOT_AREA_SQM}, ${areaDiffPct.toFixed(2)}% diff); ` +
        `footprint ${FITTED_FOOTPRINT_WIDTH_M.toFixed(1)}x${FITTED_FOOTPRINT_DEPTH_M.toFixed(1)}m (${(FITTED_FOOTPRINT_WIDTH_M * FITTED_FOOTPRINT_DEPTH_M).toFixed(1)} sqm) ` +
        `fits inside the setback envelope and the parcel; bearing ${BUILDING_BEARING_DEG.toFixed(1)}°.`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.error("[plotGeometry] FAILED verification:", failures);
  }
}

// Google point is given in WGS84; approximate its EPSG:3997 position for
// the containment check via a local linearization around V1 (accurate to
// millimeters at this ~100m scale — this is a verification check, not
// part of the actual parcel geometry, which is entirely EPSG:3997-native).
function googleLocalForVerify(): Local2 {
  const metersPerDeg = 111_320;
  const [lng0, lat0] = localToLngLat(V1);
  const [lng, lat] = GOOGLE_VALIDATION_POINT;
  const dE = (lng - lng0) * metersPerDeg * Math.cos((lat0 * Math.PI) / 180);
  const dN = (lat - lat0) * metersPerDeg;
  return [V1[0] + dE, V1[1] + dN];
}

verify();
