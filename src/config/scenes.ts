// Single source of truth for the 0..1 scroll timeline. Every consumer
// (camera, typography, building construction, debug HUD) reads its
// window from here instead of hard-coding progress numbers.

export type ProgressWindow = readonly [start: number, end: number];

export interface SceneWindow {
  id: string;
  label: string;
  window: ProgressWindow;
}

export const SCENE_WINDOWS = {
  deepSpace: { id: "deepSpace", label: "ARRIVAL — DEEP SPACE", window: [0, 0.12] },
  descentToDubai: { id: "descentToDubai", label: "ARRIVAL — DESCENT TO DUBAI", window: [0.12, 0.3] },
  intoJvt: { id: "intoJvt", label: "ARRIVAL — JUMEIRAH VILLAGE TRIANGLE", window: [0.3, 0.48] },
  jvtOblique: { id: "jvtOblique", label: "ARRIVAL — OBLIQUE AERIAL", window: [0.48, 0.55] },
  siteApproach: { id: "siteApproach", label: "THE SITE — APPROACH", window: [0.55, 0.64] },
  plotBoundary: { id: "plotBoundary", label: "THE SITE — BOUNDARY", window: [0.64, 0.7] },
  slab: { id: "slab", label: "THE SITE — SLAB", window: [0.7, 0.735] },
  groundFloor: { id: "groundFloor", label: "THE SITE — GROUND FLOOR", window: [0.735, 0.77] },
  floorsRising: { id: "floorsRising", label: "THE SITE — FLOORS RISING", window: [0.77, 0.85] },
  balconyBands: { id: "balconyBands", label: "THE SITE — BALCONY BANDS", window: [0.85, 0.885] },
  facadeFins: { id: "facadeFins", label: "THE SITE — FAÇADE FINS", window: [0.885, 0.92] },
  glazing: { id: "glazing", label: "THE SITE — GLAZING", window: [0.92, 0.95] },
  lighting: { id: "lighting", label: "THE SITE — LIGHTING", window: [0.95, 0.975] },
  landscaping: { id: "landscaping", label: "THE SITE — LANDSCAPE", window: [0.975, 1.0] },
} as const satisfies Record<string, SceneWindow>;

export type SceneId = keyof typeof SCENE_WINDOWS;

export const SCENE_ORDER: SceneId[] = Object.keys(SCENE_WINDOWS) as SceneId[];

// The whole "building" super-phase, used to hand BuildingModel.setProgress
// a single local 0..1 spanning all eight construction stages.
export const BUILDING_WINDOW: ProgressWindow = [
  SCENE_WINDOWS.slab.window[0],
  SCENE_WINDOWS.landscaping.window[1],
];

export const SCENE_2_WINDOW: ProgressWindow = [
  SCENE_WINDOWS.siteApproach.window[0],
  SCENE_WINDOWS.landscaping.window[1],
];

export const TOTAL_SCROLL_VH = 500;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Re-normalizes global progress `p` into the local 0..1 range of `win`. */
export function windowProgress(p: number, win: ProgressWindow): number {
  const [start, end] = win;
  if (end <= start) return p >= end ? 1 : 0;
  return clamp01((p - start) / (end - start));
}

export function sceneNameForProgress(p: number): string {
  for (const id of SCENE_ORDER) {
    const { window: win } = SCENE_WINDOWS[id];
    if (p < win[1] || id === SCENE_ORDER[SCENE_ORDER.length - 1]) {
      return SCENE_WINDOWS[id].label;
    }
  }
  return SCENE_WINDOWS[SCENE_ORDER[0]].label;
}

export function sceneIdForProgress(p: number): SceneId {
  for (const id of SCENE_ORDER) {
    const { window: win } = SCENE_WINDOWS[id];
    if (p < win[1] || id === SCENE_ORDER[SCENE_ORDER.length - 1]) {
      return id;
    }
  }
  return SCENE_ORDER[0];
}
