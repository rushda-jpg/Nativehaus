import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { isCalibrateMode } from "./queryFlags";

gsap.registerPlugin(ScrollTrigger);

// Module-level singleton so components outside the hook (level/unit
// click handlers that need to smooth-scroll the page to a timeline
// position) can reach the same Lenis instance without prop-drilling or
// a context provider. Set on mount, cleared on unmount.
let activeLenis: Lenis | null = null;

/** The active Lenis instance, or null in calibration mode / before
 * useLenis() has mounted. Used for programmatic `scrollTo` navigation
 * (e.g. clicking a level or unit smooth-scrolls rather than jumping). */
export function getLenis(): Lenis | null {
  return activeLenis;
}

/**
 * Wires Lenis smooth-scroll into GSAP's ticker so ScrollTrigger stays in
 * sync with Lenis's (not the browser's) scroll position. Standard
 * Lenis + GSAP recipe. Mount once near the app root.
 *
 * Skipped entirely in calibration mode (`?calibrate=1`), where the map
 * needs raw wheel/touch input for its own pan/zoom instead of Lenis
 * intercepting it for page scroll.
 */
export function useLenis() {
  useEffect(() => {
    if (isCalibrateMode()) return;

    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });
    activeLenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
      activeLenis = null;
    };
  }, []);
}
