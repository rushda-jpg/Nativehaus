import { useCallback, useRef } from "react";
import { TOTAL_SCROLL_VH } from "../config/scenes";
import { useLenis } from "../lib/useLenis";
import { useScrollProgress } from "../lib/useScrollProgress";
import { Stage, type StageHandle } from "./Stage";

interface ExperienceProps {
  onExplore?: () => void;
}

export function Experience({ onExplore }: ExperienceProps) {
  useLenis();

  const spacerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle>(null);

  const handleUpdate = useCallback((progress: number) => {
    stageRef.current?.update(progress);
  }, []);

  useScrollProgress(spacerRef, handleUpdate);

  return (
    <>
      <div ref={spacerRef} className="scroll-spacer" style={{ height: `${TOTAL_SCROLL_VH}vh` }} />
      <Stage ref={stageRef} onExplore={onExplore} />
    </>
  );
}
