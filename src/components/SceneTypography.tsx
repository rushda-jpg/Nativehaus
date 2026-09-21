import { forwardRef, useImperativeHandle, useRef } from "react";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";

export interface SceneTypographyHandle {
  update(progress: number): void;
}

export const SceneTypography = forwardRef<SceneTypographyHandle>(function SceneTypography(_, ref) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      const dim = windowProgress(progress, SCENE_WINDOWS.siteApproach.window);
      if (backdropRef.current) {
        backdropRef.current.style.opacity = String(dim * 0.55);
      }

      const fadeIn = windowProgress(progress, SCENE_WINDOWS.plotBoundary.window);
      const fadeOutRange: [number, number] = [SCENE_WINDOWS.glazing.window[0], SCENE_WINDOWS.landscaping.window[1]];
      const fadeOut = 1 - windowProgress(progress, fadeOutRange);
      const visibility = Math.min(fadeIn, fadeOut);

      if (textRef.current) {
        textRef.current.style.opacity = String(visibility);
        textRef.current.style.transform = `translateY(${(1 - fadeIn) * 18}px)`;
      }
    },
  }));

  return (
    <>
      <div ref={backdropRef} className="scene-backdrop" />
      <div ref={textRef} className="site-typography">
        <span className="site-typography__eyebrow">THE SITE</span>
        <span className="site-typography__title">NATIVE HAUS</span>
        <span className="site-typography__meta">JUMEIRAH VILLAGE TRIANGLE</span>
      </div>
    </>
  );
});
