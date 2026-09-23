import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

// Small, dependency-free pan/zoom primitive for the unit-plan viewer.
// Pointer Events unify mouse/touch/pen, so wheel-zoom (desktop) and
// one-finger pan / two-finger pinch (touch) share the same state without
// separate touch-specific code paths.

interface PanZoomState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const WHEEL_SENSITIVITY = 0.0016;
const PINCH_ZOOM_STEP = 1.3;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function usePanZoom() {
  const [state, setState] = useState<PanZoomState>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    pointers.current.clear();
    lastPanRef.current = null;
    lastPinchDistRef.current = null;
    setState({ scale: 1, x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setState((prev) => {
      const next = clampScale(prev.scale * factor);
      return next <= MIN_SCALE ? { scale: MIN_SCALE, x: 0, y: 0 } : { ...prev, scale: next };
    });
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent) => {
    event.preventDefault();
    setState((prev) => {
      const next = clampScale(prev.scale - event.deltaY * WHEEL_SENSITIVITY);
      return next <= MIN_SCALE ? { scale: MIN_SCALE, x: 0, y: 0 } : { ...prev, scale: next };
    });
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      lastPanRef.current = { x: event.clientX, y: event.clientY };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      lastPinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
        const ratio = dist / lastPinchDistRef.current;
        setState((prev) => ({ ...prev, scale: clampScale(prev.scale * ratio) }));
      }
      lastPinchDistRef.current = dist;
      return;
    }

    if (pointers.current.size === 1 && lastPanRef.current) {
      const { clientX, clientY } = event;
      setState((prev) => {
        if (prev.scale <= MIN_SCALE) return prev;
        const dx = clientX - lastPanRef.current!.x;
        const dy = clientY - lastPanRef.current!.y;
        lastPanRef.current = { x: clientX, y: clientY };
        return { ...prev, x: prev.x + dx, y: prev.y + dy };
      });
    }
  }, []);

  const endPointer = useCallback((event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) lastPinchDistRef.current = null;
    if (pointers.current.size === 1) {
      const [remaining] = Array.from(pointers.current.values());
      lastPanRef.current = remaining;
    } else if (pointers.current.size === 0) {
      lastPanRef.current = null;
    }
  }, []);

  return {
    scale: state.scale,
    x: state.x,
    y: state.y,
    isZoomed: state.scale > MIN_SCALE,
    reset,
    zoomIn: () => zoomBy(PINCH_ZOOM_STEP),
    zoomOut: () => zoomBy(1 / PINCH_ZOOM_STEP),
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
    },
  };
}
