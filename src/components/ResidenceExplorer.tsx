import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FLOORS, FLOOR_PLATE_ASSETS, FLOOR_PLATE_VIEWBOX, floorById, type FloorId } from "../config/floors";
import { BEDROOM_CATEGORIES, UNITS, unitTypeById } from "../config/units";
import { CONSTRUCTION_VIDEO_FINAL_FRAME } from "../config/video";
import { usePanZoom } from "../hooks/usePanZoom";

// Flat, image-backed hover/click explorer per the locked interaction
// spec: BUILDING -> hover/click floor -> FLOOR PLATE -> hover/click unit
// -> UNIT PLAN. The real building photograph and the floor
// plate/unit-plan artwork never move; only transparent SVG polygons
// layered on top of them respond to the pointer, and views crossfade in
// place (see index.css's `.residence-explorer[data-view=...]` rules).
// No WebGL, no Three.js, no Spline — React + SVG + CSS only.
//
// This is a PROTOTYPE of one full path only (Level 02 -> Unit 214). The
// other five interactive levels (06-01) are present and hoverable (the
// building must read as fully explorable) but only Level 02 is
// clickable; the rest show a "coming soon" cue instead of opening a
// plate that doesn't exist yet. Ground is shown but not interactive.

const PROTOTYPE_FLOOR_ID: FloorId = "2";
// The one figure supplied for the Level 02 prototype panel — not derived
// or estimated (units.ts doesn't carry a per-floor residence count yet).
const PROTOTYPE_FLOOR_RESIDENCE_COUNT = 28;

// Hit-zone polygons for the six interactive floor bands, in the real
// hero photograph's own pixel space (1290x714 — see
// native-haus-build-reveal-final.jpg). Each floor has TWO polygons — a
// front-facade band and a side-facade band — so the hover highlight
// wraps around the building's corner rather than covering one face
// only. All boundaries were measured from the image itself, not
// guessed: the vertical (floor-height) boundaries come from a
// brightness scan down the front facade that locates each dark balcony
// datum line; the corner x (~960px) comes from a color/warmth scan (the
// warmly floodlit front facade vs. the cooler, shadowed side facade)
// at Level 02's row; the side facade's outer edge (~1240px) is
// interpolated from two further warmth/sky-transition scans (near the
// roofline and near ground level, since perspective shifts it by row).
const BUILDING_VIEWBOX = "0 0 1290 714";
const FRONT_LEFT_X = 206;
const CORNER_X = 960;
const SIDE_RIGHT_X = 1240;

const FLOOR_BAND_Y: Record<FloorId, { top: number; bottom: number }> = {
  "6": { top: 184, bottom: 240 },
  "5": { top: 240, bottom: 283 },
  "4": { top: 283, bottom: 326 },
  "3": { top: 326, bottom: 369 },
  "2": { top: 369, bottom: 413 },
  "1": { top: 413, bottom: 457 },
  ground: { top: 457, bottom: 543 },
};

function floorZonePolygons(floorId: FloorId): { front: string; side: string } {
  const { top, bottom } = FLOOR_BAND_Y[floorId];
  return {
    front: `${FRONT_LEFT_X},${top} ${CORNER_X},${top} ${CORNER_X},${bottom} ${FRONT_LEFT_X},${bottom}`,
    side: `${CORNER_X},${top} ${SIDE_RIGHT_X},${top} ${SIDE_RIGHT_X},${bottom} ${CORNER_X},${bottom}`,
  };
}

const INTERACTIVE_FLOORS = FLOORS.filter((f) => f.id !== "ground");
const GROUND_FLOOR = FLOORS.find((f) => f.id === "ground")!;

const prototypeUnit = UNITS.find((u) => u.floor === PROTOTYPE_FLOOR_ID)!;
const prototypeUnitType = unitTypeById(prototypeUnit.unitTypeId)!;
const prototypeFloor = floorById(PROTOTYPE_FLOOR_ID);

type View = "building" | "floorplate" | "unitplan";

export function ResidenceExplorer() {
  const [view, setView] = useState<View>("building");
  const [hoveredFloorId, setHoveredFloorId] = useState<FloorId | null>(null);
  const [unitSelected, setUnitSelected] = useState(false);
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
    setUnitSelected(false);
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

  // Click/tap is one control that does double duty for mouse and touch:
  // hover (mouse) already selects a floor before the click fires, so a
  // desktop click on an already-hovered floor opens it immediately. On
  // touch, there's no hover, so the first tap only selects/highlights
  // (matching STEP 10's "tap once selects... tap EXPLORE FLOOR opens");
  // a second tap on the zone (now already selected) opens it too.
  const handleFloorInteraction = useCallback(
    (floorId: FloorId) => {
      if (hoveredFloorId !== floorId) {
        setHoveredFloorId(floorId);
        return;
      }
      if (floorId === PROTOTYPE_FLOOR_ID) enterFloorplate();
    },
    [hoveredFloorId, enterFloorplate],
  );

  const handleUnitInteraction = useCallback(() => {
    if (!unitSelected) {
      setUnitSelected(true);
      return;
    }
    enterUnitPlan();
  }, [unitSelected, enterUnitPlan]);

  const hoveredFloor = hoveredFloorId ? floorById(hoveredFloorId) : null;

  return (
    <section className="residence-explorer" data-view={view}>
      {/* BUILDING VIEW */}
      <div className="rex-building" data-dimmed={hoveredFloorId ? "true" : "false"} aria-hidden={view !== "building"}>
        <img className="rex-building__image" src={CONSTRUCTION_VIDEO_FINAL_FRAME} alt="Native Haus — completed building" />

        <svg
          className="rex-building__zones"
          viewBox={BUILDING_VIEWBOX}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {[...INTERACTIVE_FLOORS, GROUND_FLOOR].map((floor) => {
            const isActive = floor.id === PROTOTYPE_FLOOR_ID;
            const isHovered = hoveredFloorId === floor.id;
            const { front, side } = floorZonePolygons(floor.id);
            const zoneClass = [
              "rex-zone",
              isActive ? "rex-zone--active" : "rex-zone--inert",
              isHovered ? "rex-zone--hover" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const pointerProps = {
              onMouseEnter: () => setHoveredFloorId(floor.id),
              onMouseLeave: () => setHoveredFloorId((prev) => (prev === floor.id ? null : prev)),
              onClick: () => handleFloorInteraction(floor.id),
            };
            const onKeyDown = isActive
              ? (event: ReactKeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleFloorInteraction(floor.id);
                  }
                }
              : undefined;
            return (
              <g key={floor.id} className={zoneClass}>
                {/* Front facade carries the one keyboard-focusable stop per
                    floor; the side facade shares the same hover/click
                    handlers so the highlight wraps the corner, without
                    doubling up on tab order. */}
                <polygon points={front} role={isActive ? "button" : undefined} tabIndex={isActive ? 0 : -1} onKeyDown={onKeyDown} {...pointerProps} />
                <polygon points={side} {...pointerProps} />
              </g>
            );
          })}
        </svg>

        {hoveredFloor && (
          <aside className="rex-floor-panel">
            <span className="rex-floor-panel__eyebrow">
              <span className="rex-floor-panel__accent" aria-hidden="true" />
              LEVEL {hoveredFloor.label}
            </span>
            {hoveredFloor.id === PROTOTYPE_FLOOR_ID && (
              <span className="rex-floor-panel__count">{PROTOTYPE_FLOOR_RESIDENCE_COUNT} RESIDENCES</span>
            )}
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
      <div className="rex-plate" data-dimmed={unitSelected ? "true" : "false"} aria-hidden={view === "building"}>
        <img
          className="rex-plate__image"
          src={FLOOR_PLATE_ASSETS.typical}
          alt={`Level ${prototypeFloor.label} floor plate`}
        />

        <svg className="rex-plate__zones" viewBox={FLOOR_PLATE_VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <polygon
            points={prototypeUnit.floorPlatePolygon}
            className={`rex-unit-zone${unitSelected ? " rex-unit-zone--hover" : ""}`}
            role="button"
            tabIndex={view === "floorplate" ? 0 : -1}
            onMouseEnter={() => setUnitSelected(true)}
            onMouseLeave={() => setUnitSelected(false)}
            onClick={handleUnitInteraction}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleUnitInteraction();
              }
            }}
          />
        </svg>

        {unitSelected && view === "floorplate" && (
          <div className="rex-unit-chip">
            <span className="rex-unit-chip__number">{prototypeUnit.unitNumber}</span>
            <span className="rex-unit-chip__type">{prototypeUnitType.label.toUpperCase()}</span>
            <span className="rex-unit-chip__area">{prototypeUnitType.areaSqFt} SQ FT</span>
            <button type="button" className="rex-unit-chip__cta" onClick={enterUnitPlan}>
              VIEW PLAN
            </button>
          </div>
        )}

        <button type="button" className="rex-back" onClick={backToBuilding}>
          BACK TO BUILDING
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
              UNIT {prototypeUnit.unitNumber} · LEVEL {prototypeFloor.label}
            </span>
            <span className="rex-unitplan__info-area">{prototypeUnitType.areaSqFt} SQ FT</span>
          </div>

          <button type="button" className="rex-back" onClick={backToFloorplate}>
            BACK TO FLOOR
          </button>
        </div>
      )}
    </section>
  );
}
