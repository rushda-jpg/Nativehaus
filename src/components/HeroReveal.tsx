import { forwardRef, useImperativeHandle, useRef } from "react";
import { SCENE_WINDOWS, windowProgress, type ProgressWindow } from "../config/scenes";

export interface HeroRevealHandle {
  update(progress: number): void;
}

interface HeroRevealProps {
  onExplore?: () => void;
}

// Staggered sub-beats within the heroReveal window (0.95-1.0): the camera
// has already settled into the front three-quarter position by the time
// any of this becomes visible — title, then place, then a restrained
// tagline, then (once scroll has fully settled) the entry point into the
// Residence Explorer.
const [heroStart, heroEnd] = SCENE_WINDOWS.heroReveal.window;
const heroSpan = heroEnd - heroStart;
const TITLE_WINDOW: ProgressWindow = [heroStart, heroStart + heroSpan * 0.4];
const META_WINDOW: ProgressWindow = [heroStart + heroSpan * 0.35, heroStart + heroSpan * 0.7];
const TAGLINE_WINDOW: ProgressWindow = [heroStart + heroSpan * 0.65, heroStart + heroSpan * 0.9];
const CTA_WINDOW: ProgressWindow = [heroStart + heroSpan * 0.85, heroEnd];

export const HeroReveal = forwardRef<HeroRevealHandle, HeroRevealProps>(function HeroReveal({ onExplore }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const taglineRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      if (rootRef.current) {
        // The whole group only exists visually inside the heroReveal window
        // itself — nothing lingers once the user scrolls back out of it.
        rootRef.current.style.opacity = progress >= heroStart ? "1" : "0";
      }

      const titleT = windowProgress(progress, TITLE_WINDOW);
      const metaT = windowProgress(progress, META_WINDOW);
      const taglineT = windowProgress(progress, TAGLINE_WINDOW);
      const ctaT = windowProgress(progress, CTA_WINDOW);

      if (titleRef.current) {
        titleRef.current.style.opacity = String(titleT);
        titleRef.current.style.transform = `translateY(${(1 - titleT) * 16}px)`;
      }
      if (metaRef.current) {
        metaRef.current.style.opacity = String(metaT);
        metaRef.current.style.transform = `translateY(${(1 - metaT) * 12}px)`;
      }
      if (taglineRef.current) {
        taglineRef.current.style.opacity = String(taglineT);
        taglineRef.current.style.transform = `translateY(${(1 - taglineT) * 10}px)`;
      }
      if (ctaRef.current) {
        ctaRef.current.style.opacity = String(ctaT);
        ctaRef.current.style.transform = `translateY(${(1 - ctaT) * 8}px)`;
        // Only actually clickable once fully settled — this is a
        // deliberate entry point, not something to brush past mid-scroll.
        ctaRef.current.style.pointerEvents = ctaT >= 1 ? "auto" : "none";
      }
    },
  }));

  return (
    <div ref={rootRef} className="hero-reveal">
      <span ref={titleRef} className="hero-reveal__title">
        NATIVE HAUS
      </span>
      <span ref={metaRef} className="hero-reveal__meta">
        JUMEIRAH VILLAGE TRIANGLE
      </span>
      <span ref={taglineRef} className="hero-reveal__tagline">
        A NEW WAY TO LIVE JVT
      </span>
      {onExplore && (
        <button ref={ctaRef} type="button" className="hero-reveal__cta" onClick={onExplore}>
          EXPLORE NATIVE HAUS
        </button>
      )}
    </div>
  );
});
