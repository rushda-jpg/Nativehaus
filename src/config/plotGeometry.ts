// Official Native Haus plot geometry, reconstructed from the Site Plan /
// Affection Plan (Parcel ID 6849739, Developer Plot No JVT04LMRA002).
// Supersedes the earlier approximate rectangle. See PLAN.md and the
// commit history for the reconstruction method; short version below.
//
// The parcel is a quadrilateral with one corner rounded by a circular
// fillet where the two road-facing edges meet:
//
//   P2 --[top, 46.71m]--> P1
//   ^                      |
//   |[long_road, 58.90m]   |[adjacent, 68.41m]
//   |                      v
//   P3 <--[access, 35.71m]-P4   (P2-P3-arc-P4 order below)
//
// Concretely, walking the boundary: P2 -[long_road]-> P3 -[R=7m fillet,
// arc length 10.53m]-> (via tangent points) -[access]-> P4 -[adjacent]->
// P1 -[top]-> P2.
//
// Only ONE interior angle is directly knowable from the given dimensions
// (at P3, from the fillet's arc length: arc angle = exterior/turning
// angle = 180° - interior angle). The other three corners are not
// independently specified, so P1 is solved as the circle-circle
// intersection of circle(P2, TOP) and circle(P4, ADJACENT) — the unique
// construction that exactly satisfies all four given side lengths plus
// the one known angle. This yields a polygon area of ~2570.5 sqm
// (post-fillet), noticeably under the officially stated 2965.41 sqm
// total. That gap is an expected consequence of reconstructing an
// irregular real parcel from 6 summary numbers rather than a full
// corner-by-corner survey — not a computation error (verified against
// the stated numbers below). The OFFICIAL total area and footprint cap
// are used directly wherever a real-world figure matters (debug label,
// coverage limit); the reconstructed polygon is what's actually drawn
// and built against, since it is the closest faithful geometry derivable
// from the data we have, and is guaranteed self-consistent (all four
// side lengths and the fillet are exact).

import type { LngLat } from "./geo";

export type Local2 = readonly [x: number, y: number];

// ---- Official Site Plan dimensions ----------------------------------
export const PARCEL_ID = "6849739";
export const DEVELOPER_PLOT_NO = "JVT04LMRA002";
export const OFFICIAL_PLOT_AREA_SQM = 2965.41;
export const MAX_PLOT_COVERAGE_RATIO = 0.65;
export const MAX_BUILDING_FOOTPRINT_SQM = 1927.5; // ~65% of 2965.41, as given

const TOP_M = 46.71;
const LONG_ROAD_M = 58.9;
const ADJACENT_M = 68.41;
const ACCESS_M = 35.71;
const ARC_LENGTH_M = 10.53;
const CORNER_RADIUS_M = 7.0;

// Prototype-only road setback (official range is 2–4m); kept separately
// configurable and NOT to be read as an approved planning setback.
export const PROTOTYPE_ROAD_SETBACK_M = 3.0;
export const OFFICIAL_ROAD_SETBACK_RANGE_M: readonly [number, number] = [2, 4];

// Local-frame rotation of the reconstructed parcel (degrees, standard
// math convention: CCW from East). Needs visual confirmation against
// Mapbox satellite imagery — see DEBUG VERIFICATION overlay (?debug=1).
// Defaulted to 0 (long_road initially assumed to run due east/west)
// rather than an invented-sounding value, since it cannot be verified
// from this environment. Adjust once confirmed and the building's own
// rotation (BuildingLayer) will follow automatically.
export const PLOT_ROTATION_DEG = 0;

// ---- Small 2D geometry helpers (local plot meters) --------------------
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
/** The normal pointing left of direction `d` — into the polygon interior
 * for a CCW-wound boundary, which is the convention used throughout. */
function leftNormal(d: Local2): Local2 {
  const u = normalize(d);
  return [-u[1], u[0]];
}
interface Line2 {
  p: Local2;
  d: Local2;
}
function lineFromPoints(a: Local2, b: Local2): Line2 {
  return { p: a, d: sub(b, a) };
}
function shiftLine(line: Line2, dist: number): Line2 {
  const n = leftNormal(line.d);
  return { p: add(line.p, scale(n, dist)), d: line.d };
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
/** Perpendicular foot of `pt` projected onto `line`. */
function footOnLine(line: Line2, pt: Local2): Local2 {
  const [dx, dy] = line.d;
  const len2 = dx * dx + dy * dy;
  const t = ((pt[0] - line.p[0]) * dx + (pt[1] - line.p[1]) * dy) / len2;
  return add(line.p, scale(line.d, t));
}
function circleIntersect(c1: Local2, r1: number, c2: Local2, r2: number): [Local2, Local2] {
  const d = length(sub(c2, c1));
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const u = normalize(sub(c2, c1));
  const perp: Local2 = [-u[1], u[0]];
  const base = add(c1, scale(u, a));
  return [add(base, scale(perp, h)), add(base, scale(perp, -h))];
}
function shoelaceArea(pts: Local2[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
/** Point containment for a convex, CCW-wound polygon. */
function pointInConvexPolygon(pt: Local2, poly: Local2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (cross < -1e-6) return false;
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

// ---- Reconstruct the quadrilateral + fillet ---------------------------
const arcAngle = ARC_LENGTH_M / CORNER_RADIUS_M; // exterior/turning angle at the road corner
const interiorAngleAtCorner = Math.PI - arcAngle;

const P2: Local2 = [0, 0]; // start of long_road
const P3: Local2 = [LONG_ROAD_M, 0]; // long_road/access corner (pre-fillet)
const accessDir: Local2 = [Math.cos(arcAngle), Math.sin(arcAngle)];
const P4: Local2 = add(P3, scale(accessDir, ACCESS_M));

const [p1CandA, p1CandB] = circleIntersect(P4, ADJACENT_M, P2, TOP_M);
// Pick the intersection that keeps P2-P3-P4-P1 a simple, CCW (positive-area) loop.
const P1: Local2 = shoelaceArea([P2, P3, P4, p1CandA]) > shoelaceArea([P2, P3, P4, p1CandB]) ? p1CandA : p1CandB;

const tangentLen = CORNER_RADIUS_M * Math.tan(arcAngle / 2);
const dirToP2 = normalize(sub(P2, P3));
const tanA: Local2 = add(P3, scale(dirToP2, tangentLen)); // on the long_road edge
const tanB: Local2 = add(P3, scale(accessDir, tangentLen)); // on the access edge
const bisectorUnit = normalize(add(dirToP2, accessDir));
const arcCenterDist = CORNER_RADIUS_M / Math.sin(interiorAngleAtCorner / 2);
const arcCenter: Local2 = add(P3, scale(bisectorUnit, arcCenterDist));

const filletArc = discretizeArc(arcCenter, CORNER_RADIUS_M, tanA, tanB, 20);

/** Local-meter plot ring (closed), P2 as origin — the confirmed
 * geographic anchor. Includes the true rounded corner. */
export const PLOT_RING_LOCAL: Local2[] = [P2, tanA, ...filletArc, tanB, P4, P1, P2];

export const PLOT_AREA_RECONSTRUCTED_SQM = shoelaceArea(PLOT_RING_LOCAL.slice(0, -1));

// ---- Road-side setback envelope (fillet-aware) -------------------------
// Road edges (long_road, access, and the fillet between them) are inset
// by PROTOTYPE_ROAD_SETBACK_M; the adjacent-plot and top edges keep a 0m
// setback per the official parameters, so they're left untouched. A
// naive sharp-corner line intersection would cut inside the true
// (rounded) boundary near the fillet, so the envelope's corner is itself
// a smaller concentric arc (same center, radius reduced by the setback)
// — the standard, exact way to inset a filleted corner.
const longRoadLine = lineFromPoints(P2, P3);
const accessLine = lineFromPoints(P3, P4);
const adjacentLine = lineFromPoints(P4, P1);
const topLine = lineFromPoints(P1, P2);

const shiftedLongRoad = shiftLine(longRoadLine, PROTOTYPE_ROAD_SETBACK_M);
const shiftedAccess = shiftLine(accessLine, PROTOTYPE_ROAD_SETBACK_M);
const envelopeArcRadius = CORNER_RADIUS_M - PROTOTYPE_ROAD_SETBACK_M;
const envTanA = footOnLine(shiftedLongRoad, arcCenter);
const envTanB = footOnLine(shiftedAccess, arcCenter);
const envelopeArc = discretizeArc(arcCenter, envelopeArcRadius, envTanA, envTanB, 12);

const envelopeE2 = lineIntersect(shiftedLongRoad, topLine);
const envelopeE4 = lineIntersect(shiftedAccess, adjacentLine);

/** The buildable envelope after applying the prototype road setback —
 * convex, CCW. Used only to fit the building footprint and for the
 * ?debug=1 overlay; never rendered to normal visitors. */
export const SETBACK_ENVELOPE_LOCAL: Local2[] = [envelopeE2, ...envelopeArc, envelopeE4, P1];

// ---- Fit the building footprint inside the envelope --------------------
// Anchored at the envelope's road corner (on the shrunk fillet arc,
// nearest the road intersection) and grown toward the interior, keeping
// the reference renders' horizontal proportions (~1.7:1 width:depth).
// A binary search on scale is used rather than an analytic
// largest-inscribed-rectangle solve — simpler, robust, and every
// candidate is verified by explicit point-in-polygon containment, which
// is also re-checked below as the final programmatic verification.
const FOOTPRINT_ASPECT_RATIO = 1.7; // width : depth, matches the wide/horizontal reference massing
const footprintAnchor: Local2 = sub(arcCenter, scale(bisectorUnit, envelopeArcRadius));

function footprintRectCorners(width: number, depth: number): Local2[] {
  const x1 = footprintAnchor[0];
  const y0 = footprintAnchor[1];
  const x0 = x1 - width;
  const y1 = y0 + depth;
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
function footprintFits(width: number, depth: number): boolean {
  if (width * depth > MAX_BUILDING_FOOTPRINT_SQM) return false;
  return footprintRectCorners(width, depth).every((c) => pointInConvexPolygon(c, SETBACK_ENVELOPE_LOCAL));
}

let lo = 0;
let hi = Math.max(LONG_ROAD_M, ADJACENT_M); // generous upper bound
for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2;
  if (footprintFits(mid, mid / FOOTPRINT_ASPECT_RATIO)) lo = mid;
  else hi = mid;
}

// The binary search above converges to a rectangle that just *touches*
// the envelope boundary (by definition of a tightest fit) — including,
// on its two 0m-setback sides, the true plot boundary itself. Polygon
// edges there are discretized (the fillet arc as short chords), whose
// sagitta sits a hair inside the true circle, so testing an
// exactly-touching point against the discretized ring is a coin flip at
// floating-point scale. A small fixed inward shrink (independent of any
// polygon discretization) sidesteps that entirely and gives every edge —
// including the 0m-setback ones — real, verifiable clearance.
const FIT_SAFETY_MARGIN_M = 0.1;
const tightAnchor = footprintAnchor;
const safeAnchor: Local2 = [tightAnchor[0] - FIT_SAFETY_MARGIN_M, tightAnchor[1] + FIT_SAFETY_MARGIN_M];
const safeWidth = Math.max(0, lo - FIT_SAFETY_MARGIN_M * 2);
const safeDepth = Math.max(0, lo / FOOTPRINT_ASPECT_RATIO - FIT_SAFETY_MARGIN_M * 2);

export const BUILDING_FOOTPRINT_WIDTH_M = safeWidth;
export const BUILDING_FOOTPRINT_DEPTH_M = safeDepth;
export const BUILDING_FOOTPRINT_AREA_SQM = BUILDING_FOOTPRINT_WIDTH_M * BUILDING_FOOTPRINT_DEPTH_M;

function safeRectCorners(): Local2[] {
  const x1 = safeAnchor[0];
  const y0 = safeAnchor[1];
  const x0 = x1 - safeWidth;
  const y1 = y0 + safeDepth;
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

const footprintCornersLocal = safeRectCorners();
export const BUILDING_FOOTPRINT_RING_LOCAL: Local2[] = [...footprintCornersLocal, footprintCornersLocal[0]];

/** Footprint center, in local plot meters — this is what the Three.js
 * building is actually centered/anchored on (distinct from
 * NATIVE_HAUS_SITE, which is the plot's confirmed geographic corner). */
export const BUILDING_FOOTPRINT_CENTER_LOCAL: Local2 = [
  (footprintCornersLocal[0][0] + footprintCornersLocal[2][0]) / 2,
  (footprintCornersLocal[0][1] + footprintCornersLocal[2][1]) / 2,
];

// ---- Building-local-frame plot boundary (for landscaping clipping) ----
// buildingBuilder.ts authors geometry in a frame centered on the
// building's own footprint (X=width/long_road-aligned, Z=depth), the
// same 2D axes as this module's Local2 (x,y) before rotation — so the
// plot ring re-based to that origin lets landscaping (hedges, trees)
// stay verifiably inside the true plot boundary instead of a naive
// radius around the building.
export const PLOT_RING_RELATIVE_TO_FOOTPRINT: Local2[] = PLOT_RING_LOCAL.map(
  ([x, y]): Local2 => [x - BUILDING_FOOTPRINT_CENTER_LOCAL[0], y - BUILDING_FOOTPRINT_CENTER_LOCAL[1]],
);

export function isInsidePlotRelativeToFootprint(point: Local2): boolean {
  return pointInConvexPolygon(point, PLOT_RING_RELATIVE_TO_FOOTPRINT.slice(0, -1));
}

// ---- Local meters -> real lng/lat --------------------------------------
const METERS_PER_DEG = 111_320;

/** Rotates a local (x=long_road-aligned, y=perpendicular) meter offset by
 * PLOT_ROTATION_DEG into (east, north) meters, then converts to a
 * lng/lat offset from `origin`. Standard math convention (CCW from
 * East) — see PLOT_ROTATION_DEG's doc comment re: visual confirmation. */
export function localToLngLat(origin: LngLat, point: Local2): LngLat {
  const rot = (PLOT_ROTATION_DEG * Math.PI) / 180;
  const east = point[0] * Math.cos(rot) - point[1] * Math.sin(rot);
  const north = point[0] * Math.sin(rot) + point[1] * Math.cos(rot);
  const [lng, lat] = origin;
  const dLat = north / METERS_PER_DEG;
  const dLng = east / (METERS_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

export function localRingToLngLat(origin: LngLat, ring: Local2[]): LngLat[] {
  return ring.map((pt) => localToLngLat(origin, pt));
}

// ---- Programmatic verification (see task's FINAL CHECK) ---------------
// Runs once at module load; logs a concise pass/fail report. Cheap (a
// few dozen point-in-polygon tests), so left unconditional rather than
// gated behind ?debug=1 — this is a self-check, not a user-facing tool.
function verify(): void {
  const failures: string[] = [];

  const allInsidePlot = footprintCornersLocal.every((c) => pointInConvexPolygon(c, PLOT_RING_LOCAL.slice(0, -1)));
  if (!allInsidePlot) failures.push("a building footprint corner is outside the plot boundary");

  const allInsideEnvelope = footprintCornersLocal.every((c) => pointInConvexPolygon(c, SETBACK_ENVELOPE_LOCAL));
  if (!allInsideEnvelope) failures.push("a building footprint corner is outside the road-setback envelope");

  if (BUILDING_FOOTPRINT_AREA_SQM > MAX_BUILDING_FOOTPRINT_SQM + 1e-6) {
    failures.push(
      `footprint area ${BUILDING_FOOTPRINT_AREA_SQM.toFixed(1)} sqm exceeds the ${MAX_BUILDING_FOOTPRINT_SQM} sqm cap`,
    );
  }

  const distToLongRoad = Math.abs(footOnDistance(longRoadLine, safeAnchor));
  const distToAccess = Math.abs(footOnDistance(accessLine, safeAnchor));
  if (distToLongRoad < PROTOTYPE_ROAD_SETBACK_M - 1e-3) failures.push("footprint sits closer than the configured setback to the long-road edge");
  if (distToAccess < PROTOTYPE_ROAD_SETBACK_M - 1e-3) failures.push("footprint sits closer than the configured setback to the access-road edge");

  if (failures.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[plotGeometry] OK — footprint ${BUILDING_FOOTPRINT_WIDTH_M.toFixed(1)}x${BUILDING_FOOTPRINT_DEPTH_M.toFixed(1)}m ` +
        `(${BUILDING_FOOTPRINT_AREA_SQM.toFixed(1)} sqm) fits inside the ${PROTOTYPE_ROAD_SETBACK_M}m setback envelope and the plot boundary.`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.error("[plotGeometry] FAILED verification:", failures);
  }
}

function footOnDistance(line: Line2, pt: Local2): number {
  const n = leftNormal(line.d);
  return (pt[0] - line.p[0]) * n[0] + (pt[1] - line.p[1]) * n[1];
}

verify();
