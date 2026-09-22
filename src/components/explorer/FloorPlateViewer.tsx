import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { unitTypeById, type Unit } from "../../config/units";
import { isDebugPlansMode } from "../../lib/queryFlags";
import { polygonCentroid } from "../../lib/svgPolygon";

interface FloorPlateViewerProps {
  floorLabel: string;
  units: Unit[];
  backgroundSrc: string;
  viewBox: string;
  onSelectUnit: (unit: Unit) => void;
}

/**
 * High-resolution (eventually) floor plan + a transparent SVG
 * interaction layer sharing its coordinate space exactly — polygons are
 * authored in the same viewBox as the background plate, so they line up
 * regardless of container size. Only `units` (already filtered to this
 * floor) get interactive polygons; everything else on the plate is
 * inert background art.
 */
export function FloorPlateViewer({ floorLabel, units, backgroundSrc, viewBox, onSelectUnit }: FloorPlateViewerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debugPlans = useMemo(() => isDebugPlansMode(), []);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  const hoveredUnit = units.find((u) => u.id === hoveredId) ?? null;
  const hoveredType = hoveredUnit ? unitTypeById(hoveredUnit.unitTypeId) : null;

  return (
    <div
      ref={containerRef}
      className="floor-plate"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setHoveredId(null);
        setPointer(null);
      }}
    >
      <img
        src={backgroundSrc}
        alt={`Floor ${floorLabel} plate`}
        className="floor-plate__background"
        draggable={false}
      />

      <svg className="floor-plate__overlay" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden={units.length === 0}>
        {units.map((unit) => {
          const isHovered = unit.id === hoveredId;
          const isDimmed = hoveredId !== null && !isHovered;
          const classNames = [
            "floor-plate__unit",
            isHovered && "floor-plate__unit--hovered",
            isDimmed && "floor-plate__unit--dimmed",
            debugPlans && "floor-plate__unit--debug",
          ]
            .filter(Boolean)
            .join(" ");
          const centroid = debugPlans ? polygonCentroid(unit.floorPlatePolygon) : null;

          return (
            <g key={unit.id}>
              <polygon
                points={unit.floorPlatePolygon}
                className={classNames}
                onPointerEnter={() => setHoveredId(unit.id)}
                onPointerLeave={() => setHoveredId((id) => (id === unit.id ? null : id))}
                onClick={() => onSelectUnit(unit)}
              />
              {centroid && (
                <text className="floor-plate__debug-label" x={centroid.x} y={centroid.y} textAnchor="middle">
                  {unit.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {debugPlans && (
        <div className="floor-plate__debug-badge">
          ?debugPlans=1 — {units.length} polygon{units.length === 1 ? "" : "s"} mapped on floor {floorLabel}
        </div>
      )}

      {hoveredUnit && hoveredType && pointer && (
        <div className="floor-plate__tooltip" style={{ left: pointer.x + 18, top: pointer.y + 18 }}>
          <div className="floor-plate__tooltip-number">{hoveredUnit.unitNumber ?? "Unit number pending"}</div>
          <div className="floor-plate__tooltip-type">{hoveredType.label}</div>
          <div className="floor-plate__tooltip-area">{hoveredType.areaSqFt} sq ft</div>
        </div>
      )}

      {units.length === 0 && !debugPlans && (
        <div className="floor-plate__pending-note">Unit polygons for this floor are being mapped.</div>
      )}
    </div>
  );
}
