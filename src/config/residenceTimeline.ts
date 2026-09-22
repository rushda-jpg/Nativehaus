// Scroll timeline for the spatial Residence Explorer (ResidenceExplorer3D).
// A single pinned section, scrubbed exactly like the cinematic
// experience's own progress (see scenes.ts) — a pure function of scroll
// position, so scrubbing backward reverses every stage automatically.

export const RESIDENCE_SCROLL_VH = 420;

export interface StageWindow {
  start: number;
  end: number;
}

// Stage A (0.00-0.15): the 7-level stack forms/settles, floor numbers
// appear. Stage B (0.15-0.55): Level 02 highlights, separates from the
// stack, tilts toward a near-top-down reading angle while the camera
// follows, and the official floorplate fades onto its slab. Stage C
// (0.55-0.88): Unit 214 highlights and lifts off the plate, the camera
// pushes in, and the Studio Type A plan grows from the unit's position
// toward a legible, camera-facing pose. Stage D (0.88-1.00): restrained
// unit info fades in around the settled plan.
export const RESIDENCE_STAGES = {
  stackForm: { start: 0, end: 0.15 },
  levelSelect: { start: 0.15, end: 0.55 },
  unitSelect: { start: 0.55, end: 0.88 },
  detail: { start: 0.88, end: 1.0 },
} as const satisfies Record<string, StageWindow>;

// Prototype scope: only this one floor/unit animates through the full
// building -> floor -> unit -> plan journey. Every other level/unit is
// visually present (the stack, the selector) but inert — see
// ResidenceExplorer3D.tsx and units.ts's file header.
export const PROTOTYPE_FLOOR_ID = "2";
export const PROTOTYPE_UNIT_ID = "unit-214";

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Re-normalizes global (0..1) progress into a stage's own local 0..1. */
export function stageProgress(progress: number, stage: StageWindow): number {
  const { start, end } = stage;
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}
