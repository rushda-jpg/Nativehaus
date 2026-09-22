import { forwardRef, useImperativeHandle, useRef } from "react";
import { sceneNameForProgress } from "../config/scenes";
import { isDebugMode } from "../lib/queryFlags";

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
    </div>
  );
});
