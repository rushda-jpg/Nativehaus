// Native Haus residential unit-data model. The 11 unit types below (id,
// label, area, count) are the official figures supplied for this task —
// entered verbatim, not derived or estimated. Per-unit records (unit
// numbers, individual polygons) are a SEPARATE, much sparser list: the
// official unit-number schedule hasn't been supplied yet, so this file
// does not invent one. Only the one agreed sample (Studio Type A) has a
// real Unit record, used to prove out the interaction end-to-end; the
// other 161 are added the same way once the interaction/design is
// approved and the real schedule + plan art are supplied (see
// FloorPlateViewer.tsx's ?debugPlans=1 mode for how they'll be traced).

import type { FloorId } from "./floors";

export type BedroomCategory = "studio" | "1-bed" | "1-bed-study" | "2-bed-study";

export interface BedroomCategoryDef {
  id: BedroomCategory;
  /** Customer-facing label used by the "Browse by Residence" grid. */
  browseLabel: string;
}

// The 1.5-bed / 2.5-bed unit types in the supplied schedule are this
// developer's "+ Study" configurations — same units, browse-facing name.
export const BEDROOM_CATEGORIES: BedroomCategoryDef[] = [
  { id: "studio", browseLabel: "Studios" },
  { id: "1-bed", browseLabel: "1 Bedroom" },
  { id: "1-bed-study", browseLabel: "1 Bed + Study" },
  { id: "2-bed-study", browseLabel: "2 Bed + Study" },
];

export interface UnitTypeDef {
  id: string;
  /** As named in the official unit schedule. */
  label: string;
  bedroomCategory: BedroomCategory;
  areaSqFt: number;
  /** Total units of this type across the whole building. */
  unitCount: number;
  /** Representative plan for this type, shown in the Residence Browser
   * until each individual unit has its own confirmed plan asset. */
  floorPlanAsset: string;
}

export const UNIT_TYPES: UnitTypeDef[] = [
  { id: "studio-a", label: "Studio Type A", bedroomCategory: "studio", areaSqFt: 403, unitCount: 70, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "studio-b", label: "Studio Type B", bedroomCategory: "studio", areaSqFt: 479, unitCount: 5, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "studio-c", label: "Studio Type C", bedroomCategory: "studio", areaSqFt: 422, unitCount: 6, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1bed-a", label: "1 Bed Type A", bedroomCategory: "1-bed", areaSqFt: 664, unitCount: 5, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1bed-b", label: "1 Bed Type B", bedroomCategory: "1-bed", areaSqFt: 697, unitCount: 1, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1.5bed-a", label: "1.5 Bed Type A", bedroomCategory: "1-bed-study", areaSqFt: 678, unitCount: 54, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1.5bed-b", label: "1.5 Bed Type B", bedroomCategory: "1-bed-study", areaSqFt: 832, unitCount: 2, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1.5bed-c", label: "1.5 Bed Type C", bedroomCategory: "1-bed-study", areaSqFt: 906, unitCount: 6, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "1.5bed-d", label: "1.5 Bed Type D", bedroomCategory: "1-bed-study", areaSqFt: 911, unitCount: 1, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "2.5bed-a", label: "2.5 Bed Type A", bedroomCategory: "2-bed-study", areaSqFt: 1034, unitCount: 6, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
  { id: "2.5bed-b", label: "2.5 Bed Type B", bedroomCategory: "2-bed-study", areaSqFt: 1016, unitCount: 6, floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg" },
];

export const TOTAL_RESIDENTIAL_UNITS = 162;

const summedUnitCount = UNIT_TYPES.reduce((sum, t) => sum + t.unitCount, 0);
if (summedUnitCount !== TOTAL_RESIDENTIAL_UNITS) {
  // eslint-disable-next-line no-console
  console.error(
    `[units] UNIT_TYPES counts sum to ${summedUnitCount}, expected ${TOTAL_RESIDENTIAL_UNITS} — check the schedule for a transcription error.`,
  );
}

/** A single physical apartment. `unitNumber` is `null` until the
 * official unit-number schedule is supplied — never guessed. */
export interface Unit {
  id: string;
  floor: FloorId;
  unitNumber: string | null;
  unitTypeId: string;
  /** Large individual plan for this unit — falls back to the type's
   * representative plan (UnitTypeDef.floorPlanAsset) if not yet supplied. */
  floorPlanAsset?: string;
  /** Polygon on the floor plate this unit occupies, in the same
   * coordinate space as the plate's own SVG viewBox (see
   * FloorPlateViewer.tsx) — an SVG `points` attribute value. */
  floorPlatePolygon: string;
  specialAttributes?: string[];
}

// Exactly one real sample this round — see file header. Placed on Floor
// 2 (a "typical" floor, floors 2-6) since that's the repeated stack the
// supplied schedule describes; the polygon is the plate's first bay
// (see typical-floor-placeholder.svg).
export const UNITS: Unit[] = [
  {
    id: "sample-studio-a",
    floor: "2",
    unitNumber: null,
    unitTypeId: "studio-a",
    floorPlanAsset: "/assets/unit-plans/studio-a-schematic.svg",
    floorPlatePolygon: "60,65 245,65 245,460 60,460",
    specialAttributes: [],
  },
];

export function unitTypeById(id: string): UnitTypeDef | undefined {
  return UNIT_TYPES.find((t) => t.id === id);
}

export function unitTypesByCategory(category: BedroomCategory): UnitTypeDef[] {
  return UNIT_TYPES.filter((t) => t.bedroomCategory === category);
}

export function unitsByFloor(floor: FloorId): Unit[] {
  return UNITS.filter((u) => u.floor === floor);
}

/** First mapped unit of a given type, if any — used by the Residence
 * Browser to link through to a real interactive unit where one exists
 * (currently only Studio Type A). */
export function sampleUnitForType(typeId: string): Unit | undefined {
  return UNITS.find((u) => u.unitTypeId === typeId);
}
