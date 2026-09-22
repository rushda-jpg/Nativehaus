import { useState } from "react";
import { FLOORS, type FloorId } from "../../config/floors";

interface FloorSelectorProps {
  onSelect: (floorId: FloorId) => void;
}

/**
 * Clean elevation-style level selector — flat horizontal bands, not a
 * photorealistic 3D cutaway. Ground is shown (it's part of the real
 * elevation) but disabled: its functions are designed separately later.
 */
export function FloorSelector({ onSelect }: FloorSelectorProps) {
  const [hovered, setHovered] = useState<FloorId | null>(null);

  return (
    <div className="floor-selector">
      <div className="floor-selector__eyebrow">
        <span className="floor-selector__accent" aria-hidden="true" />
        SELECT A LEVEL
      </div>
      <div className="floor-selector__levels">
        {FLOORS.map((floor) => (
          <button
            key={floor.id}
            type="button"
            className={[
              "floor-selector__level",
              hovered === floor.id && "floor-selector__level--hovered",
              !floor.residential && "floor-selector__level--disabled",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!floor.residential}
            onMouseEnter={() => setHovered(floor.id)}
            onMouseLeave={() => setHovered((id) => (id === floor.id ? null : id))}
            onFocus={() => setHovered(floor.id)}
            onBlur={() => setHovered((id) => (id === floor.id ? null : id))}
            onClick={() => floor.residential && onSelect(floor.id)}
          >
            <span className="floor-selector__level-label">{floor.label}</span>
            {!floor.residential && <span className="floor-selector__level-note">COMING SOON</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
