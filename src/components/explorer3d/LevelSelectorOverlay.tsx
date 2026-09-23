import { FLOORS, type FloorId } from "../../config/floors";
import { PROTOTYPE_FLOOR_ID } from "../../config/residenceTimeline";

interface LevelSelectorOverlayProps {
  activeLevelId: string | null;
  onSelect: (floorId: FloorId) => void;
}

/**
 * The 06..GROUND level list, kept visible throughout the pinned
 * sequence — but unlike a conventional file browser, clicking a level
 * doesn't swap a view. It smooth-scrolls the page to that level's point
 * in the timeline (see ResidenceExplorer3D's scrollToStage), so the
 * spatial motion itself is still what carries you there. Only Level 02
 * has a mapped destination this round; the rest are present (matching
 * the real elevation) but inert.
 */
export function LevelSelectorOverlay({ activeLevelId, onSelect }: LevelSelectorOverlayProps) {
  return (
    <div className="residence3d-levels" aria-label="Select a level">
      {FLOORS.map((floor) => {
        const isPrototype = floor.id === PROTOTYPE_FLOOR_ID;
        const isActive = activeLevelId === floor.id;
        return (
          <button
            key={floor.id}
            type="button"
            className={[
              "residence3d-levels__item",
              isActive && "residence3d-levels__item--active",
              !isPrototype && "residence3d-levels__item--inert",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!isPrototype}
            onClick={() => isPrototype && onSelect(floor.id)}
          >
            {floor.label}
          </button>
        );
      })}
    </div>
  );
}
