// Shared ?debug=1 / ?calibrate=1 URL-flag reads. Both are opt-in developer
// tools — absent by default, so normal visitors never see them.

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
