// Small helpers for working with SVG `points="x1,y1 x2,y2 ..."` strings,
// shared by FloorPlateViewer's interaction layer and its debug labels.

export function parsePolygonPoints(points: string): { x: number; y: number }[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
}

/** Simple vertex-average centroid — accurate enough for the roughly
 * rectangular unit polygons this is used to label/position a tooltip
 * against; not an area-weighted centroid. */
export function polygonCentroid(points: string): { x: number; y: number } {
  const vertices = parsePolygonPoints(points);
  const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 });
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}
