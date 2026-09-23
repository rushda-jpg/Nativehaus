import { useCallback, useRef } from "react";
import { TOTAL_SCROLL_VH } from "../config/scenes";
import { useLenis, getLenis } from "../lib/useLenis";
import { useScrollProgress } from "../lib/useScrollProgress";
import { Stage, type StageHandle } from "./Stage";
import { SplineResidenceExplorer } from "./SplineResidenceExplorer";

export function Experience() {
  useLenis();

  const cinematicRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle>(null);

  const handleUpdate = useCallback((progress: number) => {
    stageRef.current?.update(progress);
  }, []);

  useScrollProgress(cinematicRef, handleUpdate);

  // "EXPLORE RESIDENCES" doesn't swap to a separate mode — it smooth-
  // scrolls the page to where the (placeholder) Residence Explorer
  // section begins, which sits immediately after this cinematic section
  // in normal document flow (see index.css's sticky .stage). Continuing
  // to scroll manually does exactly the same thing.
  const handleExplore = useCallback(() => {
    const cinematic = cinematicRef.current;
    if (!cinematic) return;
    const target = cinematic.offsetTop + cinematic.offsetHeight;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  }, []);

  return (
    <>
      <div ref={cinematicRef} className="cinematic-sticky-wrapper" style={{ height: `${TOTAL_SCROLL_VH}vh` }}>
        <Stage ref={stageRef} onExplore={handleExplore} />
      </div>
      <SplineResidenceExplorer />
    </>
  );
}
