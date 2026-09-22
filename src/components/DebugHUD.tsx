import { forwardRef, useImperativeHandle, useRef } from "react";
import { sceneNameForProgress } from "../config/scenes";
import { isDebugMode } from "../lib/queryFlags";
import {
  BUILDING_FOOTPRINT_AREA_SQM,
  MAX_BUILDING_FOOTPRINT_SQM,
  OFFICIAL_PLOT_AREA_SQM,
  PLOT_ROTATION_DEG,
} from "../config/plotGeometry";

export interface DebugHUDHandle {
  update(progress: number): void;
}

export const DebugHUD = forwardRef<DebugHUDHandle>(function DebugHUD(_, ref) {
  const progressRef = useRef<HTMLSpanElement>(null);
  const sceneRef = useRef<HTMLSpanElement>(null);
  const enabled = isDebugMode();

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (progressRef.current) progressRef.current.textContent = progress.toFixed(2);
      if (sceneRef.current) sceneRef.current.textContent = sceneNameForProgress(progress);
    },
  }));

  if (!enabled) return null;

  return (
    <div className="debug-hud" aria-hidden="true">
      <div className="debug-hud__row">
        <span className="debug-hud__label">SCROLL</span>
        <span ref={progressRef} className="debug-hud__value">
          0.00
        </span>
      </div>
      <div className="debug-hud__row">
        <span className="debug-hud__label">SCENE</span>
        <span ref={sceneRef} className="debug-hud__value">
          {sceneNameForProgress(0)}
        </span>
      </div>
      <div className="debug-hud__row debug-hud__row--divider">
        <span className="debug-hud__label">PLOT AREA</span>
        <span className="debug-hud__value">{OFFICIAL_PLOT_AREA_SQM.toFixed(2)} sqm</span>
      </div>
      <div className="debug-hud__row">
        <span className="debug-hud__label">FOOTPRINT</span>
        <span className="debug-hud__value">
          {BUILDING_FOOTPRINT_AREA_SQM.toFixed(1)} / {MAX_BUILDING_FOOTPRINT_SQM} sqm
        </span>
      </div>
      <div className="debug-hud__row">
        <span className="debug-hud__label">ROTATION</span>
        <span className="debug-hud__value">{PLOT_ROTATION_DEG}°</span>
      </div>
    </div>
  );
});
