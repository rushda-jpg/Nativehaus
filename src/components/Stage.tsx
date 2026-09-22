import { forwardRef, useImperativeHandle, useRef } from "react";
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas";
import { SceneTypography, type SceneTypographyHandle } from "./SceneTypography";
import { HeroReveal, type HeroRevealHandle } from "./HeroReveal";
import { DebugHUD, type DebugHUDHandle } from "./DebugHUD";

export interface StageHandle {
  update(progress: number): void;
}

/** Fixed 100vw x 100vh visual stage. Never pinned/scrolled itself — the
 * scroll spacer around it is what creates scroll distance; this stays put. */
export const Stage = forwardRef<StageHandle>(function Stage(_, ref) {
  const mapRef = useRef<MapCanvasHandle>(null);
  const typographyRef = useRef<SceneTypographyHandle>(null);
  const heroRevealRef = useRef<HeroRevealHandle>(null);
  const hudRef = useRef<DebugHUDHandle>(null);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      mapRef.current?.update(progress);
      typographyRef.current?.update(progress);
      heroRevealRef.current?.update(progress);
      hudRef.current?.update(progress);
    },
  }));

  return (
    <div className="stage">
      <MapCanvas ref={mapRef} />
      <SceneTypography ref={typographyRef} />
      <HeroReveal ref={heroRevealRef} />
      <DebugHUD ref={hudRef} />
    </div>
  );
});
