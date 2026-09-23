import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FLOORS, FLOOR_PLATE_ASSETS, FLOOR_PLATE_VIEWBOX } from "../config/floors";
import { UNITS, unitTypeById } from "../config/units";
import { CONSTRUCTION_VIDEO_FINAL_FRAME } from "../config/video";
import { parsePolygonPoints } from "../lib/svgPolygon";

gsap.registerPlugin(ScrollTrigger);

// Bottom-to-top stacking order for the visual stack — deliberately
// separate from FLOORS (floors.ts), which is ordered top-to-bottom for
// display. Index 0 = Ground at the base, index 6 = Level 6 at the top.
const STACK_ORDER_FLOOR_IDS = ["ground", "1", "2", "3", "4", "5", "6"];
const PROTOTYPE_FLOOR_ID = "2";
const LEVEL02_INDEX = STACK_ORDER_FLOOR_IDS.indexOf(PROTOTYPE_FLOOR_ID);

const prototypeUnit = UNITS.find((u) => u.floor === PROTOTYPE_FLOOR_ID)!;
const prototypeUnitType = unitTypeById(prototypeUnit.unitTypeId)!;

// Stack index the vertical layout centers around, so the 7-floor stack
// sits symmetrically in the middle of the viewport rather than growing
// only upward from a single anchor point.
const STACK_CENTER_INDEX = (STACK_ORDER_FLOOR_IDS.length - 1) / 2;
function stackY(index: number, gap: number, slabHeight: number): number {
  return -(index - STACK_CENTER_INDEX) * (slabHeight + gap);
}

const [, , vbWidthStr, vbHeightStr] = FLOOR_PLATE_VIEWBOX.split(" ");
const VB_WIDTH = Number(vbWidthStr);
const VB_HEIGHT = Number(vbHeightStr);

/** The unit polygon's axis-aligned bounding box, as percentages of the
 * plate's own viewBox — computed from the same `floorPlatePolygon` data
 * already in units.ts, never re-guessed. Used to place the unit overlay
 * so it's positioned relative to `.floor-plane__plate` (which is itself
 * sized to the viewBox's real aspect ratio), so it stays correctly
 * aligned as that plate grows during the reveal — plain CSS percentage
 * nesting standing in for "the polygon moves with the floorplate". */
function polygonBoundsPercent(points: string) {
  const vertices = parsePolygonPoints(points);
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    left: (minX / VB_WIDTH) * 100,
    top: (minY / VB_HEIGHT) * 100,
    width: ((maxX - minX) / VB_WIDTH) * 100,
    height: ((maxY - minY) / VB_HEIGHT) * 100,
  };
}

const unitBounds = polygonBoundsPercent(prototypeUnit.floorPlatePolygon);

// ---- Local scene constants (CSS px/deg, not meters) --------------------
const SLAB_HEIGHT = 44;
const REST_GAP = 7;
const SEPARATED_GAP = 24; // subtle — the brief is explicit this must not read as a big gap
const STACK_TILT_DEG = 50; // static tilt on the whole stack
const LEVEL02_Z_ADVANCE = 230;
const OTHER_Z_RECEDE = -50;
const PLATE_EXPANDED_HEIGHT = 300; // px — the slab's readable, expanded plan height

export function FloorExplorer() {
  const spacerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const floorRefs = useRef<(HTMLDivElement | null)[]>([]);
  const level02BodyRef = useRef<HTMLDivElement>(null);
  const level02PlateRef = useRef<HTMLDivElement>(null);
  const level02DimRef = useRef<HTMLDivElement>(null);
  const unitOverlayRef = useRef<HTMLDivElement>(null);
  const unitPlanStageRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spacer = spacerRef.current;
    const pinTarget = pinRef.current;
    const stack = stackRef.current;
    if (!spacer || !pinTarget || !stack) return;

    const floors = floorRefs.current.filter((el): el is HTMLDivElement => !!el);
    const otherFloors = floors.filter((_, i) => i !== LEVEL02_INDEX);
    const level02 = floors[LEVEL02_INDEX];

    // ---- Resting state: tightly stacked, still reads as one building.
    gsap.set(stack, { rotateX: STACK_TILT_DEG, transformStyle: "preserve-3d" });
    floors.forEach((el, i) => {
      gsap.set(el, {
        y: stackY(i, REST_GAP, SLAB_HEIGHT),
        z: 0,
        opacity: 0,
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
      });
    });
    gsap.set(level02PlateRef.current, { height: "100%", opacity: 0, filter: "blur(10px)" });
    gsap.set(level02DimRef.current, { opacity: 0 });
    gsap.set(unitOverlayRef.current, { opacity: 0, scale: 0.92 });
    gsap.set(unitPlanStageRef.current, { opacity: 0, scale: 0.7 });
    gsap.set(detailRef.current, { opacity: 0, y: 14 });
    gsap.set(introRef.current, { opacity: 0, y: 16 });
    gsap.set(backgroundRef.current, { filter: "blur(0px) brightness(1) saturate(1)" });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        pin: pinTarget,
      },
    });

    // ---- Intro: "EXPLORE RESIDENCES", background starts to recede.
    tl.to(introRef.current, { opacity: 1, y: 0, duration: 0.06 }, 0.01);
    tl.to(backgroundRef.current, { filter: "blur(20px) brightness(0.4) saturate(0.85)", duration: 0.3 }, 0.02);

    // ---- Stack forms (floors fade in at their resting positions).
    tl.to(floors, { opacity: 1, stagger: 0.012, duration: 0.14 }, 0.06);
    tl.to(introRef.current, { opacity: 0, y: -14, duration: 0.06 }, 0.17);

    // ---- Floors separate slightly; Level 02 begins to stand out.
    floors.forEach((el, i) => {
      tl.to(el, { y: stackY(i, SEPARATED_GAP, SLAB_HEIGHT), duration: 0.16 }, 0.2);
    });
    tl.to(otherFloors, { opacity: 0.45, filter: "brightness(0.55)", duration: 0.14 }, 0.24);
    tl.to(level02, { filter: "brightness(1.25)", duration: 0.12 }, 0.24);

    // ---- Level 02 advances and rotates to face the viewer; the rest
    // recede a little further into the depth of the stack.
    tl.to(level02, { z: LEVEL02_Z_ADVANCE, rotateX: -STACK_TILT_DEG, duration: 0.22 }, 0.34);
    tl.to(otherFloors, { z: OTHER_Z_RECEDE, opacity: 0.3, duration: 0.2 }, 0.34);

    // ---- The slab becomes the floorplate: it grows from a thin edge
    // into a properly-proportioned, sharpening plan.
    tl.to(
      level02PlateRef.current,
      { height: PLATE_EXPANDED_HEIGHT, opacity: 1, filter: "blur(0px)", duration: 0.22 },
      0.42,
    );
    tl.to(level02BodyRef.current, { opacity: 0.08, duration: 0.2 }, 0.42);

    // ---- Unit 214 highlights; the rest of the plate dims around it.
    tl.to(level02DimRef.current, { opacity: 0.55, duration: 0.1 }, 0.62);
    tl.to(unitOverlayRef.current, { opacity: 1, scale: 1, duration: 0.1 }, 0.62);

    // ---- Unit 214 hands off to the expanded Studio Type A plan (a
    // separate, correctly-proportioned element — crossfading rather
    // than stretching the thin polygon shape avoids distorting it).
    tl.to(unitOverlayRef.current, { opacity: 0, duration: 0.1 }, 0.74);
    tl.to(unitPlanStageRef.current, { opacity: 1, scale: 1, duration: 0.18 }, 0.76);

    // ---- Restrained unit detail.
    tl.to(detailRef.current, { opacity: 1, y: 0, duration: 0.1 }, 0.9);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  const floorLabel = (id: string) => FLOORS.find((f) => f.id === id)?.label ?? id;
  const prototypeFloorLabel = FLOORS.find((f) => f.id === prototypeUnit.floor)?.label ?? prototypeUnit.floor;

  return (
    <div ref={spacerRef} className="floor-explorer-spacer" style={{ height: "420vh" }}>
      <div ref={pinRef} className="floor-explorer">
        <div
          ref={backgroundRef}
          className="floor-explorer__background"
          style={{ backgroundImage: `url(${CONSTRUCTION_VIDEO_FINAL_FRAME})` }}
        />
        <div className="floor-explorer__scrim" />

        <div ref={introRef} className="floor-explorer__intro">
          <span className="floor-explorer__eyebrow">
            <span className="floor-explorer__accent" aria-hidden="true" />
            NATIVE HAUS
          </span>
          <h2 className="floor-explorer__heading">EXPLORE RESIDENCES</h2>
        </div>

        <div className="floor-explorer__perspective">
          <div ref={stackRef} className="floor-stack">
            {STACK_ORDER_FLOOR_IDS.map((id, i) => {
              const isLevel02 = id === PROTOTYPE_FLOOR_ID;
              return (
                <div
                  key={id}
                  ref={(el) => {
                    floorRefs.current[i] = el;
                  }}
                  className={isLevel02 ? "floor-plane floor-plane--active" : "floor-plane"}
                >
                  {isLevel02 ? (
                    <>
                      <div ref={level02BodyRef} className="floor-plane__body" />
                      <div
                        ref={level02PlateRef}
                        className="floor-plane__plate"
                        style={{ backgroundImage: `url(${FLOOR_PLATE_ASSETS.typical})` }}
                      >
                        <div ref={level02DimRef} className="floor-plane__dim" />
                        <div
                          ref={unitOverlayRef}
                          className="unit-overlay"
                          style={{
                            left: `${unitBounds.left}%`,
                            top: `${unitBounds.top}%`,
                            width: `${unitBounds.width}%`,
                            height: `${unitBounds.height}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="floor-plane__body" />
                  )}
                  <span className="floor-plane__label">{floorLabel(id)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={unitPlanStageRef} className="unit-plan-stage">
          <img className="unit-plan-stage__image" src={prototypeUnitType.floorPlanAsset} alt={`${prototypeUnitType.label} plan`} />
        </div>

        <div ref={detailRef} className="floor-explorer__detail">
          <span className="floor-explorer__detail-type">{prototypeUnitType.label.toUpperCase()}</span>
          <span className="floor-explorer__detail-area">{prototypeUnitType.areaSqFt} SQ FT</span>
          <span className="floor-explorer__detail-meta">
            UNIT {prototypeUnit.unitNumber} · LEVEL {prototypeFloorLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
