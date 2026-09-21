import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scrubs a single ScrollTrigger over the scroll spacer and hands raw
 * progress (0..1) to `onUpdate` every frame. Deliberately does not touch
 * React state — callers drive Mapbox/Three.js/DOM imperatively so scroll
 * stays 60fps.
 */
export function useScrollProgress(
  spacerRef: RefObject<HTMLElement | null>,
  onUpdate: (progress: number) => void,
) {
  useEffect(() => {
    const spacer = spacerRef.current;
    if (!spacer) return;

    const trigger = ScrollTrigger.create({
      trigger: spacer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => onUpdate(self.progress),
    });

    onUpdate(trigger.progress);

    return () => {
      trigger.kill();
    };
  }, [spacerRef, onUpdate]);
}
