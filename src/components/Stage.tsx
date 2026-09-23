import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas";
import { VideoReveal, type VideoRevealHandle } from "./VideoReveal";
import { SceneTypography, type SceneTypographyHandle } from "./SceneTypography";
import { HeroReveal, type HeroRevealHandle } from "./HeroReveal";
import { DebugHUD, type DebugHUDHandle } from "./DebugHUD";
import { SCENE_WINDOWS } from "../config/scenes";
import { isDebugBuildingMode, isDebugMode } from "../lib/queryFlags";

export interface StageHandle {
  update(progress: number): void;
}

interface StageProps {
  onExplore?: () => void;
}

/** Fixed 100vw x 100vh visual stage. Never pinned/scrolled itself — the
 * scroll spacer around it is what creates scroll distance; this stays put. */
export const Stage = forwardRef<StageHandle, StageProps>(function Stage({ onExplore }, ref) {
  const mapRef = useRef<MapCanvasHandle>(null);
  const videoRef = useRef<VideoRevealHandle>(null);
  const typographyRef = useRef<SceneTypographyHandle>(null);
  const heroRevealRef = useRef<HeroRevealHandle>(null);
  const hudRef = useRef<DebugHUDHandle>(null);

  // ?debug=1/?debugBuilding=1 keep Mapbox mounted permanently (live
  // geometry verification / the retired procedural-building reference
  // both need it at any scroll position). Normal visitors get a one-way
  // teardown: once the Mapbox->video crossfade finishes, Mapbox is
  // fully unmounted (React runs MapCanvas's own cleanup — map.remove(),
  // listeners, canvas removal) before the <video> element is even
  // created, so the WebGL context and the video decoder are never alive
  // together. This is deliberately one-way — scrolling back up does not
  // re-mount Mapbox — traded for GPU/memory stability.
  const keepMapboxMounted = useMemo(() => isDebugMode() || isDebugBuildingMode(), []);
  const [mapboxMounted, setMapboxMounted] = useState(true);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (!keepMapboxMounted && mapboxMounted && progress >= SCENE_WINDOWS.plotHold.window[1]) {
        setMapboxMounted(false);
      }
      mapRef.current?.update(progress);
      videoRef.current?.update(progress);
      typographyRef.current?.update(progress);
      heroRevealRef.current?.update(progress);
      hudRef.current?.update(progress);
    },
  }));

  return (
    <div className="stage">
      {mapboxMounted && <MapCanvas ref={mapRef} />}
      <VideoReveal ref={videoRef} />
      <SceneTypography ref={typographyRef} />
      <HeroReveal ref={heroRevealRef} onExplore={onExplore} />
      <DebugHUD ref={hudRef} />
    </div>
  );
});
