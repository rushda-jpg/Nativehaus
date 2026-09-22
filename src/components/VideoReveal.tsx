import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { CONSTRUCTION_VIDEO_SRC } from "../config/video";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";
import { isDebugBuildingMode, isDebugMode } from "../lib/queryFlags";

export interface VideoRevealHandle {
  update(progress: number): void;
}

// How far the video's displayed currentTime chases its scroll-derived
// target on each animation frame (0..1 — higher is snappier/more literal
// to raw scroll, lower is smoother but laggier). This is what keeps
// scrubbing from feeling jerky: a raw scroll->currentTime mapping seeks
// on every scroll tick, which for a compressed H.264 clip means
// re-decoding from the nearest keyframe each time; chasing a target once
// per rendered frame instead collapses a burst of scroll ticks into one
// smooth seek per frame.
const CATCH_UP_RATE = 0.22;
const SNAP_EPSILON = 0.004;

/**
 * Full-screen, scroll-scrubbed layer for the supplied Native Haus
 * construction video — the public building reveal, replacing the
 * procedural Three.js construction (buildingBuilder.ts, now dev-only
 * behind ?debugBuilding=1). Crossfades in as Mapbox's arrival sequence
 * completes (SCENE_WINDOWS.plotHold), then its `currentTime` is driven
 * directly by scroll progress within SCENE_WINDOWS.videoConstruction.
 * `.play()` is never called for scrubbing — construction only advances
 * or reverses because the user is scrolling, and holds exactly where
 * they stop.
 */
export const VideoReveal = forwardRef<VideoRevealHandle>(function VideoReveal(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const targetTimeRef = useRef(0);
  const appliedTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Debug/debugBuilding modes keep the video fully out of the way so the
  // Mapbox-only verification/reference experiences stay undisturbed.
  const disabled = useMemo(() => isDebugMode() || isDebugBuildingMode(), []);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (disabled || !rootRef.current) return;

      const crossfadeT = windowProgress(progress, SCENE_WINDOWS.plotHold.window);
      rootRef.current.style.opacity = String(crossfadeT);

      if (!reducedMotion && durationRef.current > 0) {
        const videoT = windowProgress(progress, SCENE_WINDOWS.videoConstruction.window);
        targetTimeRef.current = videoT * durationRef.current;
      }
    },
  }));

  // A persistent rAF loop (not re-created per scroll event) smooths the
  // currentTime chase described above. Reduced-motion users skip it
  // entirely — the video is pinned to its final frame once and never
  // touched again (see onLoadedMetadata).
  useEffect(() => {
    if (disabled || reducedMotion) return;

    function tick() {
      const video = videoRef.current;
      if (video && durationRef.current > 0) {
        const target = targetTimeRef.current;
        const current = appliedTimeRef.current;
        const delta = target - current;
        const next = Math.abs(delta) < SNAP_EPSILON ? target : current + delta * CATCH_UP_RATE;
        if (Math.abs(next - current) > 0.0005) {
          appliedTimeRef.current = next;
          video.currentTime = next;
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    }
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [disabled, reducedMotion]);

  if (disabled) return null;

  return (
    <div ref={rootRef} className="video-reveal" aria-hidden="true">
      <video
        ref={videoRef}
        className="video-reveal__video"
        src={CONSTRUCTION_VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
          video.pause();
          const startTime = reducedMotion ? Math.max(0, video.duration - 0.05) : 0;
          video.currentTime = startTime;
          targetTimeRef.current = startTime;
          appliedTimeRef.current = startTime;
        }}
        onPlay={(event) => {
          // Belt-and-braces against autoplay policies/stray interaction:
          // this layer is scroll-scrubbed only, never independently
          // playing.
          event.currentTarget.pause();
        }}
      />
    </div>
  );
});
