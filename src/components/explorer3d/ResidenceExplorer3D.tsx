import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FLOORS, FLOOR_PLATE_ASSETS, FLOOR_PLATE_VIEWBOX } from "../../config/floors";
import { UNITS, unitTypeById } from "../../config/units";
import { PROTOTYPE_FLOOR_ID, PROTOTYPE_UNIT_ID, RESIDENCE_SCROLL_VH, RESIDENCE_STAGES } from "../../config/residenceTimeline";
import { loadPlanTexture, textureAspect } from "../../three/planTexture";
import { svgPolygonLocalCentroid, svgPolygonToShape } from "../../three/svgToShape";
import { getLenis } from "../../lib/useLenis";
import { LevelSelectorOverlay } from "./LevelSelectorOverlay";

gsap.registerPlugin(ScrollTrigger);

// ---- Local scene constants ------------------------------------------
// A stylized 2.5D representation, not the geo-anchored real building
// (see buildingBuilder.ts/plotGeometry.ts for that, retired behind
// ?debugBuilding=1) — these are clean local scene units, not meters.
const LEVEL_COUNT = 7; // Ground + 6
// Bottom-to-top stacking order for the 3D scene — deliberately separate
// from FLOORS (floors.ts), which is ordered top-to-bottom for the
// elevation selector's display. Index 0 = Ground at the base of the
// stack, index 6 = Level 6 at the top.
const STACK_ORDER_FLOOR_IDS = ["ground", "1", "2", "3", "4", "5", "6"];
const LEVEL02_INDEX = STACK_ORDER_FLOOR_IDS.indexOf(PROTOTYPE_FLOOR_ID);
const SLAB_WIDTH = 6.4;
const SLAB_DEPTH = 3.6;
const SLAB_THICKNESS = 0.32;
const REST_GAP = 0.14;
const SEPARATED_GAP = 0.62;
const SEPARATION_X = 2.6;
const LEVEL_TILT_RAD = (16 * Math.PI) / 180;
const UNIT_LIFT_HEIGHT = 0.22;
const PLAN_READING_SCALE = 2.4;

const [, , VB_WIDTH, VB_HEIGHT] = FLOOR_PLATE_VIEWBOX.split(" ").map(Number);
const PLATE_SCALE = SLAB_WIDTH / VB_WIDTH;
const PLATE_HEIGHT = VB_HEIGHT * PLATE_SCALE;

const prototypeUnit = UNITS.find((u) => u.id === PROTOTYPE_UNIT_ID)!;
const prototypeUnitType = unitTypeById(prototypeUnit.unitTypeId)!;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

interface CameraKeyframe {
  t: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

// Hand-authored camera path spanning the whole sequence — building stack
// overview -> follow Level 02 out and down toward plan-reading angle ->
// push toward Unit 214 -> settle facing the expanded plan. Aesthetic
// values chosen without the ability to render WebGL in this environment
// (same constraint noted throughout this project's Mapbox camera work)
// — needs a visual pass once you can see it live.
const CAMERA_PATH: CameraKeyframe[] = [
  { t: 0.0, position: [4.6, 2.6, 7.8], lookAt: [0, 1.5, 0] },
  { t: 0.15, position: [4.3, 2.5, 7.0], lookAt: [0, 1.6, 0] },
  { t: 0.42, position: [2.8, 3.6, 4.3], lookAt: [1.4, 2.0, 0] },
  { t: 0.55, position: [1.8, 4.4, 3.0], lookAt: [1.7, 1.95, -0.2] },
  { t: 0.72, position: [0.9, 5.0, 2.1], lookAt: [1.8, 1.9, -0.4] },
  { t: 1.0, position: [0.1, 3.4, 3.2], lookAt: [0, 2.0, 0] },
];

function interpolateCameraPath(t: number): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
  const clamped = clamp01(t);
  if (clamped <= CAMERA_PATH[0].t) {
    return { position: new THREE.Vector3(...CAMERA_PATH[0].position), lookAt: new THREE.Vector3(...CAMERA_PATH[0].lookAt) };
  }
  const last = CAMERA_PATH[CAMERA_PATH.length - 1];
  if (clamped >= last.t) {
    return { position: new THREE.Vector3(...last.position), lookAt: new THREE.Vector3(...last.lookAt) };
  }
  for (let i = 0; i < CAMERA_PATH.length - 1; i++) {
    const from = CAMERA_PATH[i];
    const to = CAMERA_PATH[i + 1];
    if (clamped >= from.t && clamped <= to.t) {
      const span = to.t - from.t;
      const localT = span <= 0 ? 0 : (clamped - from.t) / span;
      return {
        position: new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position), localT),
        lookAt: new THREE.Vector3(...from.lookAt).lerp(new THREE.Vector3(...to.lookAt), localT),
      };
    }
  }
  return { position: new THREE.Vector3(...last.position), lookAt: new THREE.Vector3(...last.lookAt) };
}

function roundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  return shape;
}

interface LevelRig {
  group: THREE.Group;
  body: THREE.Mesh;
  edge: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.MeshStandardMaterial;
}

interface ExplorerParams {
  stackReveal: number;
  stackSpacing: number;
  levelHighlight: number;
  levelSeparation: number;
  levelTilt: number;
  floorplateOpacity: number;
  unitHighlight: number;
  unitLift: number;
  planExpand: number;
  detailReveal: number;
}

/**
 * The spatial Residence Explorer: one continuous, scroll-scrubbed
 * camera/geometry sequence (building stack -> Level 02 -> Unit 214 ->
 * Studio Type A plan), pinned via GSAP ScrollTrigger and driven entirely
 * by a plain `params` object that GSAP tweens and a persistent render
 * loop reads — nothing here is a one-shot animation, so scrubbing
 * backward reverses every stage for free (see PR notes / plan message).
 */
export function ResidenceExplorer3D() {
  const spacerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);

  useEffect(() => {
    const spacer = spacerRef.current;
    const pinTarget = pinRef.current;
    const host = canvasHostRef.current;
    if (!spacer || !pinTarget || !host) return;

    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0d);
    scene.fog = new THREE.Fog(0x0a0b0d, 9, 18);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    const ambient = new THREE.AmbientLight(0x8a8478, 0.55);
    const key = new THREE.DirectionalLight(0xffdfb0, 0.9);
    key.position.set(5, 8, 4);
    scene.add(ambient, key);

    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const bodyGeometry = new THREE.ExtrudeGeometry(roundedRectShape(SLAB_WIDTH, SLAB_DEPTH, 0.5), {
      depth: SLAB_THICKNESS,
      bevelEnabled: false,
      curveSegments: 8,
    });
    bodyGeometry.rotateX(-Math.PI / 2);
    const edgeGeometry = new THREE.BoxGeometry(SLAB_WIDTH - 0.3, 0.035, 0.06);

    const levels: LevelRig[] = [];
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const group = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.85, metalness: 0.08 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a241c,
        emissive: 0xffb066,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.3,
      });
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.position.set(0, SLAB_THICKNESS + 0.005, SLAB_DEPTH / 2 - 0.03);
      group.add(body, edge);
      group.scale.y = 0.001;
      buildingGroup.add(group);
      levels.push({ group, body, edge, bodyMaterial, edgeMaterial });
    }

    // ---- Level 02: floorplate + Unit 214 polygon, parented to its own
    // rig group so they inherit its separation/tilt transform exactly —
    // "the polygons move with the floorplate" is true by construction.
    const level02 = levels[LEVEL02_INDEX];
    const floorplateGroup = new THREE.Group();
    floorplateGroup.position.set(0, SLAB_THICKNESS / 2 + 0.01, 0);
    level02.group.add(floorplateGroup);

    const floorplateMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0,
    });
    const floorplateGeometry = new THREE.PlaneGeometry(SLAB_WIDTH, PLATE_HEIGHT);
    floorplateGeometry.rotateX(-Math.PI / 2);
    const floorplateMesh = new THREE.Mesh(floorplateGeometry, floorplateMaterial);
    floorplateGroup.add(floorplateMesh);

    const unit214Shape = svgPolygonToShape(prototypeUnit.floorPlatePolygon, VB_WIDTH, VB_HEIGHT, PLATE_SCALE);
    const unit214Geometry = new THREE.ShapeGeometry(unit214Shape);
    unit214Geometry.rotateX(-Math.PI / 2);
    const unit214Material = new THREE.MeshStandardMaterial({
      color: 0xc1272d,
      emissive: 0xc1272d,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0,
      roughness: 0.6,
    });
    const unit214Mesh = new THREE.Mesh(unit214Geometry, unit214Material);
    unit214Mesh.position.y = 0.006;
    floorplateGroup.add(unit214Mesh);

    const [centroidX, centroidY] = svgPolygonLocalCentroid(prototypeUnit.floorPlatePolygon, VB_WIDTH, VB_HEIGHT, PLATE_SCALE);

    // ---- Studio Type A expanded plan — a child of the same floorplate
    // group (so it rides its parent's already-settled near-top-down
    // orientation), animating from the unit's own position/scale toward
    // a larger, centered, legible reading pose.
    const planMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0 });
    const planGeometry = new THREE.PlaneGeometry(1, 1);
    planGeometry.rotateX(-Math.PI / 2);
    const planMesh = new THREE.Mesh(planGeometry, planMaterial);
    planMesh.position.set(centroidX, 0.02, centroidY);
    planMesh.scale.set(0.001, 1, 0.001);
    floorplateGroup.add(planMesh);

    loadPlanTexture(FLOOR_PLATE_ASSETS.typical!).then((texture) => {
      if (disposed) return;
      floorplateMaterial.map = texture;
      floorplateMaterial.needsUpdate = true;
    });
    loadPlanTexture(prototypeUnitType.floorPlanAsset).then((texture) => {
      if (disposed) return;
      planMaterial.map = texture;
      planMaterial.needsUpdate = true;
      const aspect = textureAspect(texture);
      planMesh.userData.aspect = aspect;
    });

    const params: ExplorerParams = {
      stackReveal: 0,
      stackSpacing: REST_GAP,
      levelHighlight: 0,
      levelSeparation: 0,
      levelTilt: 0,
      floorplateOpacity: 0,
      unitHighlight: 0,
      unitLift: 0,
      planExpand: 0,
      detailReveal: 0,
    };
    const progressRef = { current: 0 };

    // ---- Raycasting: Level 02's body (jump into the floor) and Unit
    // 214's polygon (jump into the unit) are clickable independent of
    // exactly where the scroll sequence currently sits.
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let hovered: THREE.Object3D | null = null;

    // ScrollTrigger's `end: "bottom bottom"` reaches progress=1 when the
    // spacer's bottom meets the viewport's bottom — i.e. after scrolling
    // (spacerHeight - viewportHeight), not the full spacerHeight. Any
    // progress->scrollY conversion has to subtract the viewport height
    // too, or it overshoots for every progress short of exactly 1.
    const pageScrollTargetFor = (localProgress: number): number => {
      return spacer.offsetTop + localProgress * (spacer.offsetHeight - window.innerHeight);
    };
    const scrollToStage = (localProgress: number) => {
      const lenis = getLenis();
      const target = pageScrollTargetFor(localProgress);
      if (lenis) lenis.scrollTo(target, { duration: 1.3 });
      else window.scrollTo({ top: target, behavior: "smooth" });
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const targets = [level02.body, unit214Mesh];
      const hits = raycaster.intersectObjects(targets, false);
      hovered = hits.length > 0 ? hits[0].object : null;
      host.style.cursor = hovered ? "pointer" : "grab";
    };

    const onClick = () => {
      if (hovered === level02.body) {
        scrollToStage(RESIDENCE_STAGES.levelSelect.end);
      } else if (hovered === unit214Mesh) {
        scrollToStage(RESIDENCE_STAGES.unitSelect.end);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    // ---- GSAP timeline: every animated numeric property lives on
    // `params`; the render loop below is the only thing that turns
    // those numbers into actual Three.js transforms/materials. Because
    // scrub maps timeline position directly to scroll position (in
    // both directions), scrolling back up reverses every stage with no
    // extra code.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        pin: pinTarget,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const stage = self.progress >= RESIDENCE_STAGES.levelSelect.start ? PROTOTYPE_FLOOR_ID : null;
          setActiveLevelId((prev) => (prev === stage ? prev : stage));
        },
      },
    });

    const S = RESIDENCE_STAGES;
    tl.to(params, { stackReveal: 1, duration: S.stackForm.end - S.stackForm.start }, S.stackForm.start);
    tl.to(
      params,
      { stackSpacing: SEPARATED_GAP, levelHighlight: 1, levelSeparation: 1, levelTilt: 1, duration: 0.27 },
      S.levelSelect.start,
    );
    tl.to(params, { floorplateOpacity: 1, duration: 0.25 }, S.levelSelect.start + 0.15);
    tl.to(params, { unitHighlight: 1, duration: 0.13 }, S.unitSelect.start);
    tl.to(params, { unitLift: 1, duration: 0.12 }, S.unitSelect.start + 0.05);
    tl.to(params, { planExpand: 1, duration: S.unitSelect.end - (S.unitSelect.start + 0.1) }, S.unitSelect.start + 0.1);
    tl.to(params, { detailReveal: 1, duration: S.detail.end - S.detail.start }, S.detail.start);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const level02BodyColor = new THREE.Color(0x232323);
    const restBodyColorBright = new THREE.Color(0x1a1b1f);
    const restBodyColorDim = new THREE.Color(0x0d0e10);
    const scratchColor = new THREE.Color();

    let rafId = 0;
    function renderFrame() {
      const cam = interpolateCameraPath(progressRef.current);
      camera.position.copy(cam.position);
      camera.lookAt(cam.lookAt);

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        level.group.scale.y = Math.max(0.001, params.stackReveal);
        const isLevel02 = i === LEVEL02_INDEX;
        const spacing = isLevel02 ? lerp(REST_GAP, SEPARATED_GAP, params.levelSeparation) : params.stackSpacing;
        level.group.position.y = i * (SLAB_THICKNESS + spacing);

        if (isLevel02) {
          level.group.position.x = lerp(0, SEPARATION_X, params.levelSeparation);
          level.group.rotation.x = lerp(0, -LEVEL_TILT_RAD, params.levelTilt);
          level.edgeMaterial.emissiveIntensity = lerp(0.35, 2.4, params.levelHighlight);
          level.bodyMaterial.color.copy(level02BodyColor);
        } else {
          level.edgeMaterial.emissiveIntensity = lerp(0.35, 0.06, params.levelHighlight);
          scratchColor.lerpColors(restBodyColorBright, restBodyColorDim, params.levelHighlight);
          level.bodyMaterial.color.copy(scratchColor);
        }
      }

      floorplateMaterial.opacity = params.floorplateOpacity;
      unit214Material.opacity = params.floorplateOpacity * (0.16 + params.unitHighlight * 0.55);
      unit214Material.emissiveIntensity = 0.1 + params.unitHighlight * 0.6 + (hovered === unit214Mesh ? 0.3 : 0);
      unit214Mesh.position.y = 0.006 + lerp(0, UNIT_LIFT_HEIGHT, params.unitLift);

      const planT = params.planExpand;
      planMaterial.opacity = planT > 0.01 ? Math.min(1, planT * 1.4) : 0;
      const aspect = (planMesh.userData.aspect as number | undefined) ?? PLATE_HEIGHT / SLAB_WIDTH;
      const startSize = 0.55;
      const easedT = planT * planT * (3 - 2 * planT); // smoothstep
      const width = lerp(startSize, PLAN_READING_SCALE, easedT);
      const height = lerp(startSize, PLAN_READING_SCALE * aspect, easedT);
      planMesh.scale.set(width, 1, height);
      planMesh.position.x = lerp(centroidX, 0, easedT);
      planMesh.position.z = lerp(centroidY, 0, easedT);
      planMesh.position.y = lerp(0.02, 0.62, easedT);

      if (detailRef.current) {
        detailRef.current.style.opacity = String(params.detailReveal);
        detailRef.current.style.transform = `translateY(${(1 - params.detailReveal) * 14}px)`;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderFrame);
    }
    rafId = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      tl.scrollTrigger?.kill();
      tl.kill();
      host.removeChild(renderer.domElement);
      renderer.dispose();
      bodyGeometry.dispose();
      edgeGeometry.dispose();
      floorplateGeometry.dispose();
      unit214Geometry.dispose();
      planGeometry.dispose();
    };
  }, []);

  function handleLevelSelect(floorId: string) {
    if (floorId !== PROTOTYPE_FLOOR_ID) return;
    const spacer = spacerRef.current;
    if (!spacer) return;
    // See pageScrollTargetFor's comment in the effect above — same
    // "bottom bottom" viewport-height correction applies here.
    const target = spacer.offsetTop + RESIDENCE_STAGES.levelSelect.end * (spacer.offsetHeight - window.innerHeight);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target, { duration: 1.3 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  }

  return (
    <div ref={spacerRef} className="residence3d-spacer" style={{ height: `${RESIDENCE_SCROLL_VH}vh` }}>
      <div ref={pinRef} className="residence3d-pin">
        <div ref={canvasHostRef} className="residence3d-canvas" />

        <LevelSelectorOverlay activeLevelId={activeLevelId} onSelect={handleLevelSelect} />

        <div ref={detailRef} className="residence3d-detail" data-stage-target="detail">
          <span className="residence3d-detail__type">{prototypeUnitType.label.toUpperCase()}</span>
          <span className="residence3d-detail__area">{prototypeUnitType.areaSqFt} SQ FT</span>
          <span className="residence3d-detail__meta">
            UNIT {prototypeUnit.unitNumber} · LEVEL {FLOORS.find((f) => f.id === prototypeUnit.floor)?.label}
          </span>
        </div>
      </div>
    </div>
  );
}
