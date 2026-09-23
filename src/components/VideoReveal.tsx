import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CONSTRUCTION_VIDEO_FINAL_FRAME, CONSTRUCTION_VIDEO_FIRST_FRAME, CONSTRUCTION_VIDEO_SRC } from "../config/video";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";
import { isDebugBuildingMode, isDebugMode } from "../lib/queryFlags";
import { getLenis } from "../lib/useLenis";

export interface VideoRevealHandle {
  update(progress: number): void;
}

/**
 * Full-screen construction-video sequence: Mapbox crossfades into a
 * static first-frame <img> (not the <video> element — decoupling the
 * crossfade from video load time entirely), the video plays through
 * once, automatically, then crossfades into a static final-frame image
 * that persists as the backdrop for the hero text and the floor
 * explorer. The <video> element itself isn't mounted at all until the
 * same instant Stage.tsx tears Mapbox down (`videoReady`, a real state
 * flip so it's an actual mount, not just an opacity change) — Mapbox's
 * WebGL context and the video's decoder are never alive together.
 *
 * `currentTime` is never scroll-scrubbed — this plays forward normally,
 * once, muted+playsInline, with scroll locked (Lenis and native) for
 * those few real seconds so the section stays visually pinned.
 */
export const VideoReveal = forwardRef<VideoRevealHandle>(function VideoReveal(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const firstFrameRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finalFrameRef = useRef<HTMLImageElement>(null);
  const hasTriggeredRef = useRef(false);
  const hasEndedRef = useRef(false);
  const isLockedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  // Debug/debugBuilding modes keep this whole layer out of the way so
  // the Mapbox-only verification/reference experiences stay undisturbed.
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

  const showFinalFrame = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    videoRef.current?.pause();
    if (finalFrameRef.current) finalFrameRef.current.style.opacity = "1";
    releaseScrollLock();
  };

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (disabled || !rootRef.current) return;

      const crossfadeT = windowProgress(progress, SCENE_WINDOWS.plotHold.window);
      rootRef.current.style.opacity = String(crossfadeT);

      if (reducedMotion || hasTriggeredRef.current) return;

      // Mount the <video> element for the first time — and only —
      // right as the Mapbox->first-frame crossfade finishes. This is a
      // real state flip (not just an opacity change), so the element
      // genuinely doesn't exist in the DOM, and isn't buffering, before
      // this point; Stage.tsx tears Mapbox down off the same threshold.
      if (progress >= SCENE_WINDOWS.plotHold.window[1]) {
        hasTriggeredRef.current = true;
        setVideoReady(true);
      }
    },
  }));

  // Runs once, right after the <video> element above actually mounts —
  // playback can't be started any earlier than that.
  useEffect(() => {
    if (!videoReady || disabled || reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;
    acquireScrollLock();
    video.currentTime = 0;
    video.play().catch(() => {
      // Autoplay blocked for some reason despite muted+playsInline —
      // never leave the visitor stuck unable to scroll, and still land
      // on the completed building rather than a blank layer.
      showFinalFrame();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReady, disabled, reducedMotion]);

  // Reduced motion: skip playback entirely, go straight to the held
  // final frame once this layer is first reached.
  useEffect(() => {
    if (disabled || !reducedMotion) return;
    showFinalFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, reducedMotion]);

  // Safety net: release the lock on unmount no matter what state
  // playback was in, so navigating away never leaves scrolling disabled.
  useEffect(() => releaseScrollLock, []);

  if (disabled) return null;

  return (
    <div ref={rootRef} className="video-reveal" aria-hidden="true">
      {/* Static first frame — the actual Mapbox crossfade target. Stays
          mounted (harmless, it's just an <img>) for the rest of the
          page; once the video is playing it's simply covered. */}
      <img ref={firstFrameRef} className="video-reveal__frame" src={CONSTRUCTION_VIDEO_FIRST_FRAME} alt="" />

      {videoReady && !reducedMotion && (
        <video
          ref={videoRef}
          className="video-reveal__video"
          src={CONSTRUCTION_VIDEO_SRC}
          poster={CONSTRUCTION_VIDEO_FIRST_FRAME}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onEnded={showFinalFrame}
          onError={showFinalFrame}
        />
      )}

      {/* Static final frame — crossfades on top once the video ends, so
          the completed building never disappears into empty background;
          this is also what the hero text and floor explorer sit on. */}
      <img ref={finalFrameRef} className="video-reveal__frame video-reveal__frame--final" src={CONSTRUCTION_VIDEO_FINAL_FRAME} alt="" />
    </div>
  );
});
