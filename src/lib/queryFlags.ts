// Shared ?debug=1 / ?calibrate=1 / ?debugBuilding=1 URL-flag reads. All
// three are opt-in developer tools — absent by default, so normal
// visitors never see them.

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
