import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { CONSTRUCTION_VIDEO_POSTER, CONSTRUCTION_VIDEO_SRC } from "../config/video";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";
import { isDebugBuildingMode, isDebugMode } from "../lib/queryFlags";
import { getLenis } from "../lib/useLenis";

export interface VideoRevealHandle {
  update(progress: number): void;
}

/**
 * Full-screen layer for the supplied Native Haus construction video —
 * the public building reveal, replacing the procedural Three.js
 * construction (buildingBuilder.ts, dev-only behind ?debugBuilding=1).
 *
 * Crossfades in as Mapbox's arrival sequence completes
 * (SCENE_WINDOWS.plotHold), then — unlike the previous scroll-scrubbed
 * version — plays through ONCE on its own, muted, the moment the
 * crossfade finishes. Scroll is locked for those few real seconds (both
 * Lenis and native scroll), so the section stays visually pinned while
 * it plays; when the video ends it holds its final frame and scroll
 * unlocks, letting the visitor continue into the hero reveal exactly
 * where they left off. Never re-triggers on a revisit to this point in
 * the same page load.
 */
export const VideoReveal = forwardRef<VideoRevealHandle>(function VideoReveal(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasTriggeredRef = useRef(false);
  const isLockedRef = useRef(false);

  // Debug/debugBuilding modes keep the video fully out of the way so the
  // Mapbox-only verification/reference experiences stay undisturbed.
  const disabled = useMemo(() => isDebugMode() || isDebugBuildingMode(), []);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const releaseScrollLock = () => {
    if (!isLockedRef.current) return;
    isLockedRef.current = false;
    getLenis()?.start();
    document.body.style.removeProperty("overflow");
  };

  const acquireScrollLock = () => {
    if (isLockedRef.current) return;
    isLockedRef.current = true;
    getLenis()?.stop();
    // Belt-and-braces: also blocks native scroll (keyboard, programmatic,
    // or anything else that bypasses Lenis) for the handful of real
    // seconds the video plays — a hard guarantee the section stays put,
    // not just a soft Lenis pause.
    document.body.style.overflow = "hidden";
  };

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (disabled || !rootRef.current) return;

      const crossfadeT = windowProgress(progress, SCENE_WINDOWS.plotHold.window);
      rootRef.current.style.opacity = String(crossfadeT);

      const video = videoRef.current;
      if (!video || reducedMotion || hasTriggeredRef.current) return;

      // Trigger exactly once, right as the Mapbox->video crossfade
      // finishes — never re-plays on a later revisit to this point.
      if (progress >= SCENE_WINDOWS.plotHold.window[1]) {
        hasTriggeredRef.current = true;
        acquireScrollLock();
        video.currentTime = 0;
        video.play().catch(() => {
          // Autoplay blocked for some reason despite muted+playsInline —
          // never leave the visitor stuck unable to scroll.
          releaseScrollLock();
        });
      }
    },
  }));

  // Safety net: release the lock on unmount no matter what state
  // playback was in, so navigating away never leaves scrolling disabled.
  useEffect(() => releaseScrollLock, []);

  if (disabled) return null;

  return (
    <div ref={rootRef} className="video-reveal" aria-hidden="true">
      <video
        ref={videoRef}
        className="video-reveal__video"
        src={CONSTRUCTION_VIDEO_SRC}
        poster={CONSTRUCTION_VIDEO_POSTER}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (reducedMotion) {
            // Reduced motion: skip the autoplay entirely, just show the
            // completed final frame.
            video.pause();
            video.currentTime = Math.max(0, video.duration - 0.05);
          }
        }}
        onEnded={() => {
          // Holds on its last rendered frame on its own (not looping);
          // just release the scroll lock so the visitor can continue.
          releaseScrollLock();
        }}
        onError={() => {
          // Never leave scrolling disabled if the video fails to load.
          releaseScrollLock();
        }}
      />
    </div>
  );
});
