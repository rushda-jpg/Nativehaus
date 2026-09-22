import * as THREE from "three";
import { parsePolygonPoints } from "../lib/svgPolygon";

/**
 * Converts an SVG point (in a plate's `viewBox` pixel space — the same
 * coordinates already stored on `Unit.floorPlatePolygon`, see
 * units.ts/floors.ts) into local plate-space: centered on the viewBox's
 * own center, uniformly scaled, with Y flipped so "up" on the plan is
 * +Y in local shape space. Shapes built this way share their parent's
 * single rotateX(-90deg) (applied once, in ResidenceExplorer3D) with the
 * plate's own background plane, so a unit polygon always lines up with
 * the plan texture underneath it — including while both move/rotate
 * together during the level-select/unit-select animation.
 */
export function svgPointToLocal(
  x: number,
  y: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  scale: number,
): [number, number] {
  return [(x - viewBoxWidth / 2) * scale, (viewBoxHeight / 2 - y) * scale];
}

export function svgPolygonToShape(points: string, viewBoxWidth: number, viewBoxHeight: number, scale: number): THREE.Shape {
  const vertices = parsePolygonPoints(points).map(({ x, y }) => svgPointToLocal(x, y, viewBoxWidth, viewBoxHeight, scale));
  const shape = new THREE.Shape();
  shape.moveTo(vertices[0][0], vertices[0][1]);
  for (let i = 1; i < vertices.length; i++) shape.lineTo(vertices[i][0], vertices[i][1]);
  shape.closePath();
  return shape;
}

/** Vertex-average centroid of an SVG polygon, converted to the same
 * local plate-space as svgPolygonToShape — used to position/animate a
 * unit's "lift" and its expanded plan from the right starting point. */
export function svgPolygonLocalCentroid(
  points: string,
  viewBoxWidth: number,
  viewBoxHeight: number,
  scale: number,
): [number, number] {
  const vertices = parsePolygonPoints(points);
  const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 });
  return svgPointToLocal(sum.x / vertices.length, sum.y / vertices.length, viewBoxWidth, viewBoxHeight, scale);
}
