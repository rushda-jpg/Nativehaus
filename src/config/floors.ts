// Native Haus is Ground + 6 residential floors — no podium, no mezzanine
// (see plotGeometry.ts / buildingBuilder.ts for the same correction on
// the massing side). Ground-floor functions (retail/amenity/co-working)
// are handled separately later; it appears in the level selector for
// completeness but isn't a browsable residential floor yet.

export type FloorId = "ground" | "1" | "2" | "3" | "4" | "5" | "6";

export interface FloorDef {
  id: FloorId;
  label: string;
  /** Residential floors only. Floor 1 has a distinct layout (it includes
   * the project's amenity/pool area); floors 2-6 repeat the same unit
   * stack per the supplied schedules, so they share one floor-plate
   * asset key. This grouping is an internal data/asset optimization —
   * never surface "typical floor" as customer-facing copy until the
   * repetition is confirmed against the final approved plates. */
  floorPlateId: "ground" | "floor-1" | "typical" | null;
  residential: boolean;
}

// Ordered top-to-bottom to match the elevation selector (06 down to
// GROUND).
export const FLOORS: FloorDef[] = [
  { id: "6", label: "06", floorPlateId: "typical", residential: true },
  { id: "5", label: "05", floorPlateId: "typical", residential: true },
  { id: "4", label: "04", floorPlateId: "typical", residential: true },
  { id: "3", label: "03", floorPlateId: "typical", residential: true },
  { id: "2", label: "02", floorPlateId: "typical", residential: true },
  { id: "1", label: "01", floorPlateId: "floor-1", residential: true },
  { id: "ground", label: "GROUND", floorPlateId: "ground", residential: false },
];

export function floorById(id: FloorId): FloorDef {
  const floor = FLOORS.find((f) => f.id === id);
  if (!floor) throw new Error(`Unknown floor id: ${id}`);
  return floor;
}

// All floor-plate SVGs (real or placeholder) share this viewBox, so a
// unit's `floorPlatePolygon` (units.ts) lines up with the background
// regardless of container size — see FloorPlateViewer.tsx.
export const FLOOR_PLATE_VIEWBOX = "0 0 1600 1000";

// Only "typical" has a plate asset (a placeholder schematic — see
// units.ts's file header) so far. Floor 1's layout is genuinely
// different (it includes the amenity/pool area) and Ground's functions
// haven't been designed yet, so there's no honest placeholder to show
// for either — FloorPlateViewer's caller shows a "pending" state instead
// of fabricating one. Add entries here as real/placeholder plates exist.
export const FLOOR_PLATE_ASSETS: Partial<Record<NonNullable<FloorDef["floorPlateId"]>, string>> = {
  typical: "/assets/floorplates/typical-floor-placeholder.svg",
};
