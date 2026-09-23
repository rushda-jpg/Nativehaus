import { useCallback, useEffect, useState } from "react";
import { FLOORS, FLOOR_PLATE_ASSETS, FLOOR_PLATE_VIEWBOX, floorById, type FloorId } from "../config/floors";
import { BEDROOM_CATEGORIES, UNITS, unitTypeById } from "../config/units";
import { CONSTRUCTION_VIDEO_FINAL_FRAME } from "../config/video";
import { usePanZoom } from "../hooks/usePanZoom";

// Flat, image-backed hover/click explorer — replaces the rejected
// floating-floor-stack FloorExplorer. The real building photograph and
// the floor plate/unit plan artwork never move or separate; only
// transparent SVG polygons layered on top of them respond to the
// pointer, and views crossfade in place (see index.css's
// `.residence-explorer[data-view=...]` rules).
//
// This is a PROTOTYPE of one full path only (Level 02 -> Unit 214), per
// the brief. The other six floor zones are present (so the building
// reads as fully hoverable) but only Level 02 is clickable; the other
// zones show a "coming soon" cue instead of opening a plate that
// doesn't exist yet — the same honesty pattern used for Ground/Floor 1
// elsewhere in this codebase (see floors.ts's FLOOR_PLATE_ASSETS).

const PROTOTYPE_FLOOR_ID: FloorId = "2";

// Hit-zone polygons for the seven residential floor bands, in the real
// hero photograph's own pixel space (1290x714 — see
// native-haus-build-reveal-final.jpg). Boundaries were measured from the
// image itself (a vertical brightness scan along the facade locates each
// dark balcony datum line) rather than guessed; the horizontal extent is
// an approximate front-facade band, since this is a 3D oblique render,
// not a flat elevation — acceptable for a prototype whose only
// functionally-precise zone is Level 02.
const BUILDING_VIEWBOX = "0 0 1290 714";
const FLOOR_ZONES: Record<FloorId, string> = {
  "6": "206,184 1084,184 1084,240 206,240",
  "5": "206,240 1084,240 1084,283 206,283",
  "4": "206,283 1084,283 1084,326 206,326",
  "3": "206,326 1084,326 1084,369 206,369",
  "2": "206,369 1084,369 1084,413 206,413",
  "1": "206,413 1084,413 1084,457 206,457",
  ground: "206,457 1084,457 1084,543 206,543",
};

const prototypeUnit = UNITS.find((u) => u.floor === PROTOTYPE_FLOOR_ID)!;
const prototypeUnitType = unitTypeById(prototypeUnit.unitTypeId)!;
const prototypeFloor = floorById(PROTOTYPE_FLOOR_ID);

type View = "building" | "floorplate" | "unitplan";

export function ResidenceExplorer() {
  const [view, setView] = useState<View>("building");
  const [hoveredFloorId, setHoveredFloorId] = useState<FloorId | null>(null);
  const [unitHovered, setUnitHovered] = useState(false);
  const panZoom = usePanZoom();

  const enterFloorplate = useCallback(() => {
    setView("floorplate");
  }, []);

  const backToBuilding = useCallback(() => {
    setView("building");
  }, []);

  const enterUnitPlan = useCallback(() => {
    panZoom.reset();
    setView("unitplan");
  }, [panZoom]);

  const backToFloorplate = useCallback(() => {
    panZoom.reset();
    setView("floorplate");
  }, [panZoom]);

  // Back navigation also answers to Escape, one level at a time.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (view === "unitplan") backToFloorplate();
      else if (view === "floorplate") backToBuilding();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, backToFloorplate, backToBuilding]);

  const hoveredFloor = hoveredFloorId ? floorById(hoveredFloorId) : null;

  return (
    <section className="residence-explorer" data-view={view}>
      {/* BUILDING VIEW */}
      <div className="rex-building" aria-hidden={view !== "building"}>
        <img className="rex-building__image" src={CONSTRUCTION_VIDEO_FINAL_FRAME} alt="Native Haus — completed building" />

        <svg
          className="rex-building__zones"
          viewBox={BUILDING_VIEWBOX}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {FLOORS.map((floor) => {
            const isActive = floor.id === PROTOTYPE_FLOOR_ID;
            const isHovered = hoveredFloorId === floor.id;
            return (
              <polygon
                key={floor.id}
                points={FLOOR_ZONES[floor.id]}
                className={[
                  "rex-zone",
                  isActive ? "rex-zone--active" : "rex-zone--inert",
                  isHovered ? "rex-zone--hover" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role={isActive ? "button" : undefined}
                tabIndex={isActive ? 0 : -1}
                onMouseEnter={() => setHoveredFloorId(floor.id)}
                onMouseLeave={() => setHoveredFloorId((prev) => (prev === floor.id ? null : prev))}
                onClick={isActive ? enterFloorplate : undefined}
                onKeyDown={
                  isActive
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          enterFloorplate();
                        }
                      }
                    : undefined
                }
              />
            );
          })}
        </svg>

        {hoveredFloor && (
          <aside className="rex-floor-panel">
            <span className="rex-floor-panel__eyebrow">
              <span className="rex-floor-panel__accent" aria-hidden="true" />
              LEVEL {hoveredFloor.label}
            </span>
            <span className="rex-floor-panel__title">Residences</span>
            <ul className="rex-floor-panel__list">
              {BEDROOM_CATEGORIES.map((category) => (
                <li key={category.id}>{category.browseLabel}</li>
              ))}
            </ul>
            {hoveredFloor.id === PROTOTYPE_FLOOR_ID ? (
              <button type="button" className="rex-floor-panel__cta" onClick={enterFloorplate}>
                EXPLORE FLOOR
              </button>
            ) : (
              <span className="rex-floor-panel__soon">PLATE COMING SOON</span>
            )}
          </aside>
        )}
      </div>

      {/* FLOOR PLATE VIEW */}
      <div className="rex-plate" aria-hidden={view === "building"}>
        <img
          className="rex-plate__image"
          src={FLOOR_PLATE_ASSETS.typical}
          alt={`Level ${prototypeFloor.label} floor plate`}
        />

        <svg className="rex-plate__zones" viewBox={FLOOR_PLATE_VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <polygon
            points={prototypeUnit.floorPlatePolygon}
            className={`rex-unit-zone${unitHovered ? " rex-unit-zone--hover" : ""}`}
            role="button"
            tabIndex={view === "floorplate" ? 0 : -1}
            onMouseEnter={() => setUnitHovered(true)}
            onMouseLeave={() => setUnitHovered(false)}
            onClick={enterUnitPlan}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                enterUnitPlan();
              }
            }}
          />
        </svg>

        {unitHovered && view === "floorplate" && (
          <div className="rex-unit-chip">
            {prototypeUnit.unitNumber} / {prototypeUnitType.label.toUpperCase()} / {prototypeUnitType.areaSqFt} SQ FT
          </div>
        )}

        <button type="button" className="rex-back" onClick={backToBuilding}>
          ← BUILDING
        </button>
      </div>

      {/* UNIT PLAN VIEW */}
      {view === "unitplan" && (
        <div className="rex-unitplan">
          <div className="rex-unitplan__stage" {...panZoom.handlers}>
            <img
              className="rex-unitplan__image"
              src={prototypeUnitType.floorPlanAsset}
              alt={`${prototypeUnitType.label} plan`}
              style={{
                transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})`,
              }}
              draggable={false}
            />
          </div>

          <div className="rex-unitplan__info">
            <span className="rex-unitplan__info-type">{prototypeUnitType.label.toUpperCase()}</span>
            <span className="rex-unitplan__info-meta">
              UNIT {prototypeUnit.unitNumber} · LEVEL {prototypeFloor.label} · {prototypeUnitType.areaSqFt} SQ FT
            </span>
          </div>

          <button type="button" className="rex-back" onClick={backToFloorplate}>
            ← FLOOR PLATE
          </button>
        </div>
      )}
    </section>
  );
}
