import { forwardRef, useImperativeHandle, useRef } from "react";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";

export interface SceneTypographyHandle {
  update(progress: number): void;
}

// The environment's dimming is handled geographically by MapCanvas's dim
// mask (which leaves the actual parcel untouched); this component is just
// the restrained text overlay.
export const SceneTypography = forwardRef<SceneTypographyHandle>(function SceneTypography(_, ref) {
  const textRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      // Site-identification label: appears as the plot boundary draws in,
      // then clears well before construction gets going so it never
      // lingers over the rising building.
      const fadeIn = windowProgress(progress, SCENE_WINDOWS.plotBoundary.window);
      const fadeOutRange: [number, number] = [SCENE_WINDOWS.plotBoundary.window[1], SCENE_WINDOWS.slab.window[1]];
      const fadeOut = 1 - windowProgress(progress, fadeOutRange);
      const visibility = Math.min(fadeIn, fadeOut);

      if (textRef.current) {
        textRef.current.style.opacity = String(visibility);
        textRef.current.style.transform = `translateY(${(1 - fadeIn) * 18}px)`;
      }
    },
  }));

  return (
    <div ref={textRef} className="site-typography">
      <span className="site-typography__eyebrow">
        <span className="site-typography__accent" aria-hidden="true" />
        THE SITE
      </span>
      <span className="site-typography__title">NATIVE HAUS</span>
      <span className="site-typography__meta">JUMEIRAH VILLAGE TRIANGLE</span>
    </div>
  );
});
