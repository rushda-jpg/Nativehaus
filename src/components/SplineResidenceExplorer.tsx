import { useEffect, useRef, useState } from "react";

export interface SplineResidenceExplorerProps {
  /**
   * URL for the externally-produced Spline scene/viewer embed. Left
   * undefined until that scene exists — a clean empty container is
   * shown in its place so this section's layout, transition and mount
   * point are already correct and won't need touching once the URL is
   * supplied. Existing unit/floor data (config/units.ts, config/floors.ts)
   * is untouched and ready to wire into the Spline scene's interactions
   * once that connection is built.
   */
  splineUrl?: string;
}

/**
 * Placeholder for the future Spline-authored Residence Explorer — not a
 * Three.js scene. Deliberately minimal: a restrained "EXPLORE THE
 * RESIDENCES" reveal (fading in as it scrolls into view, consistent
 * with the rest of the site's typography treatment) above a clean,
 * correctly-proportioned container the Spline viewer will mount into.
 */
export function SplineResidenceExplorer({ splineUrl }: SplineResidenceExplorerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`spline-explorer${isVisible ? " spline-explorer--visible" : ""}`}>
      <div className="spline-explorer__intro">
        <span className="spline-explorer__eyebrow">
          <span className="spline-explorer__accent" aria-hidden="true" />
          NATIVE HAUS
        </span>
        <h2 className="spline-explorer__heading">
          EXPLORE
          <br />
          THE RESIDENCES
        </h2>
      </div>

      <div className="spline-explorer__viewport">
        {splineUrl ? (
          <iframe
            src={splineUrl}
            className="spline-explorer__iframe"
            title="Native Haus Residence Explorer"
            allow="fullscreen; xr-spatial-tracking"
            loading="lazy"
          />
        ) : (
          <div className="spline-explorer__placeholder">
            <span>Spline scene mounts here</span>
          </div>
        )}
      </div>
    </section>
  );
}
