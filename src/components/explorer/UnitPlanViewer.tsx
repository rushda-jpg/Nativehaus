import { useEffect, useRef, useState } from "react";
import { usePanZoom } from "../../hooks/usePanZoom";

interface UnitPlanViewerProps {
  src: string;
  alt: string;
}

/**
 * Large, crisp unit-plan viewer: zoom (wheel/pinch) and pan (drag/touch)
 * on top of an image that's never stretched to fill its container — the
 * image keeps its own intrinsic aspect ratio (`max-width/max-height:
 * 100%`, centered) exactly like `object-fit: contain`, and pan/zoom is
 * applied to the wrapper transform, not the image's own sizing.
 */
export function UnitPlanViewer({ src, alt }: UnitPlanViewerProps) {
  const { scale, x, y, isZoomed, reset, zoomIn, zoomOut, handlers } = usePanZoom();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported] = useState(() => typeof document !== "undefined" && document.fullscreenEnabled);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Reset the view whenever a different plan is shown, so a zoomed-in
  // state from a previous unit never leaks into the next one.
  useEffect(() => {
    reset();
  }, [src, reset]);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen?.();
    }
  }

  return (
    <div ref={containerRef} className="unit-plan-viewer">
      <div className="unit-plan-viewer__stage" {...handlers}>
        <img
          src={src}
          alt={alt}
          className="unit-plan-viewer__image"
          style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
          draggable={false}
        />
      </div>
      <div className="unit-plan-viewer__controls">
        <button type="button" className="unit-plan-viewer__button" onClick={zoomOut} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="unit-plan-viewer__button"
          onClick={reset}
          aria-label="Reset zoom"
          disabled={!isZoomed}
        >
          RESET
        </button>
        <button type="button" className="unit-plan-viewer__button" onClick={zoomIn} aria-label="Zoom in">
          +
        </button>
        {fullscreenSupported && (
          <button type="button" className="unit-plan-viewer__button" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
          </button>
        )}
      </div>
    </div>
  );
}
