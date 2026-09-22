// Shared ?debug=1 / ?calibrate=1 / ?debugBuilding=1 / ?debugPlans=1
// URL-flag reads. All are opt-in developer tools — absent by default, so
// normal visitors never see them.

function readFlag(name: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(name) === "1";
}

export function isDebugMode(): boolean {
  return readFlag("debug");
}

export function isCalibrateMode(): boolean {
  return readFlag("calibrate");
}

/** Opts into the retired procedural-building reference experience (the
 * old Three.js construction + synthetic hero environment + full camera
 * descent) — kept for development/reference only. Normal visitors get
 * the supplied construction video instead (see VideoReveal.tsx). */
export function isDebugBuildingMode(): boolean {
  return readFlag("debugBuilding");
}

/** Shows every floor-plate unit polygon's id as a permanent on-plan
 * label (outlines always visible, not just on hover) — used to trace
 * and verify the remaining unit polygons against the real plan art once
 * it's supplied, without touching FloorPlateViewer's own code. */
export function isDebugPlansMode(): boolean {
  return readFlag("debugPlans");
}
