import * as THREE from "three";
import { BUILDING_FOOTPRINT_DEPTH_M, BUILDING_FOOTPRINT_WIDTH_M } from "../config/buildingTransform";
import { isInsidePlotRelativeToFootprint, type Local2 } from "../config/plotGeometry";
import { HERO_ENVIRONMENT_WINDOW, LEGACY_BUILDING_WINDOWS, windowProgress } from "../config/scenes";
import { buildHeroEnvironment } from "./heroEnvironment";

/**
 * Shape all Three.js consumers of "the building" talk to. The Mapbox
 * custom layer only ever touches `object3D` + `setProgress`. Swapping the
 * temporary procedural mass for a real GLB later means writing one new
 * factory with this exact shape — see PLAN.md §4.
 */
export interface BuildingModel {
  object3D: THREE.Object3D;
  /** Overall scroll progress (0..1); stages are resolved internally. */
  setProgress(progress: number): void;
  dispose(): void;
}

// Footprint is fitted (in plotGeometry.ts) inside the official road-setback
// envelope of the real parcel — not an arbitrary size. Wide, horizontal,
// low-rise massing: width is much larger than the overall height so the
// building reads as long and horizontal even from an oblique angle.
const FOOTPRINT_WIDTH = BUILDING_FOOTPRINT_WIDTH_M; // long facade, along the 58.90m road edge
const FOOTPRINT_DEPTH = BUILDING_FOOTPRINT_DEPTH_M;
const CORNER_RADIUS = 6; // generous rounded-corner curvature

// Official massing: Ground + 6 upper residential levels + a modest
// rooftop structure. There is NO podium and NO mezzanine level — every
// upper floor shares the same footprint/inset, reading as a continuous
// run of repeated residential levels. Max height stays well under the
// 35m planning limit (2 basement levels are part of the approved massing
// but not modeled — they aren't visible above grade).
const GROUND_FLOOR_HEIGHT = 4.8; // tall sculptural ground floor (arches/columns)
const FLOOR_HEIGHT = 3.0;
const UPPER_FLOOR_COUNT = 6;
const ROOF_PARAPET_HEIGHT = 0.5; // thin flat cap along the roofline
const ROOF_STRUCTURE_HEIGHT = 1.8; // small lift/stair overrun only — must not dominate
const FLOOR_INSET = { width: FOOTPRINT_WIDTH - 4, depth: FOOTPRINT_DEPTH - 4 };
// The rooftop structure reads as a minor architectural element sitting on
// the flat roof, not a second building — a fraction of the floor plate.
const ROOF_STRUCTURE_SIZE = { width: FOOTPRINT_WIDTH * 0.3, depth: FOOTPRINT_DEPTH * 0.42 };

const GROUND_TOP = GROUND_FLOOR_HEIGHT;
const FLOORS_TOP = GROUND_TOP + UPPER_FLOOR_COUNT * FLOOR_HEIGHT;
const PARAPET_TOP = FLOORS_TOP + ROOF_PARAPET_HEIGHT;

// Ground-floor warm-lighting target intensity; landscaping adds a small
// final bump on top of this once construction completes (see below).
const GROUND_LIGHT_TARGET = 1.1;

const materials = {
  // Warm sandstone/taupe ground floor — the "sculptural, illuminated" base.
  ground: new THREE.MeshStandardMaterial({
    color: 0xc7b299,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0xf4c98a,
    emissiveIntensity: 0,
  }),
  // Bronze/champagne upper-floor and podium facade.
  facade: new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.55, metalness: 0.25 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xb9a47e, roughness: 0.7, metalness: 0.15 }),
  // Dark charcoal balcony bands (not pure black).
  balcony: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.15 }),
  // Bronze vertical facade fins.
  fin: new THREE.MeshStandardMaterial({ color: 0x9c8154, roughness: 0.35, metalness: 0.5 }),
  // Ground-floor colonnade — warm stone columns, illuminated last.
  column: new THREE.MeshStandardMaterial({
    color: 0xc9b18f,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0xffd9a0,
    emissiveIntensity: 0,
  }),
  coveLight: new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xffcf99,
    emissiveIntensity: 0,
  }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x1f3322, roughness: 1 }),
  treeTrunk: new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }),
  treeCanopy: new THREE.MeshStandardMaterial({ color: 0x274a2c, roughness: 1 }),
};

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

/** Centers a geometry on X/Z and pins its lowest point to y=0, whatever
 * rotation/extrusion produced it — makes scale.y-from-base grows reliable. */
function normalizeBaseAtZero(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geometry.translate(-cx, -box.min.y, -cz);
  return geometry;
}

function extrudedRoundedMass(width: number, depth: number, height: number, radius: number): THREE.BufferGeometry {
  const shape = roundedRectShape(width, depth, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
  geometry.rotateX(-Math.PI / 2);
  return normalizeBaseAtZero(geometry);
}

function baseBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  return normalizeBaseAtZero(new THREE.BoxGeometry(width, height, depth));
}

/** A mesh that grows from its base (scale.y 0→1) — the "visible assembly" primitive. */
function growFromBase(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.scale.y = 0;
  return mesh;
}

export interface Stage {
  group: THREE.Group;
  setLocal(t: number): void;
}

/** A soft radial-falloff "contact shadow" plane — no hard rectangular
 * edge, so it reads as the building settling onto the ground rather than
 * a platform. Sized to the building footprint itself (no bleed beyond
 * it) since the footprint already sits flush with the plot boundary on
 * its two 0m-setback sides — any larger and the shadow would visibly
 * cross onto neighbouring land there. */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.42)");
  gradient.addColorStop(0.42, "rgba(0,0,0,0.2)");
  gradient.addColorStop(0.75, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function buildContactShadow(): Stage {
  const group = new THREE.Group();
  const texture = createContactShadowTexture();
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
  const geometry = new THREE.PlaneGeometry(FOOTPRINT_WIDTH, FOOTPRINT_DEPTH);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.02;
  mesh.scale.set(0.4, 1, 0.4);
  group.add(mesh);

  const setLocal = (t: number) => {
    material.opacity = t * 0.9;
    const s = 0.4 + t * 0.6;
    mesh.scale.set(s, 1, s);
  };

  return { group, setLocal };
}

function buildGroundFloor(): { stage: Stage; columns: THREE.Mesh[] } {
  const group = new THREE.Group();
  const mesh = growFromBase(
    extrudedRoundedMass(FOOTPRINT_WIDTH, FOOTPRINT_DEPTH, GROUND_FLOOR_HEIGHT, CORNER_RADIUS),
    materials.ground,
    0,
  );
  group.add(mesh);

  // Sculptural ground-floor colonnade — slender columns along the two
  // long facades, illuminated as part of the "ground floor activates
  // last" lighting beat.
  const columns: THREE.Mesh[] = [];
  const columnHeight = GROUND_FLOOR_HEIGHT - 0.6;
  const columnCountPerSide = 12;
  const spacing = (FOOTPRINT_WIDTH - 6) / (columnCountPerSide - 1);
  const z = FOOTPRINT_DEPTH / 2 - 0.4;
  for (const side of [1, -1]) {
    for (let i = 0; i < columnCountPerSide; i++) {
      const x = -(FOOTPRINT_WIDTH - 6) / 2 + spacing * i;
      const column = growFromBase(new THREE.CylinderGeometry(0.28, 0.32, columnHeight, 12), materials.column, 0.3);
      column.position.x = x;
      column.position.z = side * z;
      group.add(column);
      columns.push(column);
    }
  }

  const setLocal = (t: number) => {
    mesh.scale.y = t;
    columns.forEach((column) => (column.scale.y = t));
  };

  return { stage: { group, setLocal }, columns };
}

/** The 6 upper residential floors, a thin flat roof parapet, and a small
 * rooftop structure, rising sequentially floor by floor. Every upper
 * floor shares the same footprint (no podium, no top-floor setback) so
 * the massing reads as continuous repeated residential levels topped by
 * a restrained, non-dominant roofline — not the earlier oversized
 * capsule roof. */
function buildMassing(): Stage {
  const group = new THREE.Group();

  const floorMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < UPPER_FLOOR_COUNT; i++) {
    const y = GROUND_TOP + i * FLOOR_HEIGHT;
    const mesh = growFromBase(
      extrudedRoundedMass(FLOOR_INSET.width, FLOOR_INSET.depth, FLOOR_HEIGHT, CORNER_RADIUS),
      materials.facade,
      y,
    );
    group.add(mesh);
    floorMeshes.push(mesh);
  }

  const parapetMesh = growFromBase(
    extrudedRoundedMass(FLOOR_INSET.width, FLOOR_INSET.depth, ROOF_PARAPET_HEIGHT, CORNER_RADIUS),
    materials.roof,
    FLOORS_TOP,
  );
  group.add(parapetMesh);

  const roofStructureMesh = growFromBase(
    extrudedRoundedMass(ROOF_STRUCTURE_SIZE.width, ROOF_STRUCTURE_SIZE.depth, ROOF_STRUCTURE_HEIGHT, 1.5),
    materials.roof,
    PARAPET_TOP,
  );
  group.add(roofStructureMesh);

  const riseSequence = [...floorMeshes, parapetMesh, roofStructureMesh];
  const setLocal = (t: number) => {
    const slot = 1 / riseSequence.length;
    riseSequence.forEach((mesh, i) => {
      const localStart = i * slot;
      mesh.scale.y = Math.min(1, Math.max(0, (t - localStart) / slot));
    });
  };

  return { group, setLocal };
}

function buildBalconyBands(): Stage {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const bandWidth = FLOOR_INSET.width - 4;
  const bandDepth = 2.0;
  const bandHeight = 0.32;
  const offsetZ = FLOOR_INSET.depth / 2 + bandDepth / 2 - 0.2;

  // Continuous horizontal balcony bands run across every upper floor —
  // there is no recessed/setback top floor in the G+6 massing.
  const balconyFloorCount = UPPER_FLOOR_COUNT;
  for (let i = 0; i < balconyFloorCount; i++) {
    const y = GROUND_TOP + i * FLOOR_HEIGHT + 0.1;
    for (const side of [1, -1]) {
      const mesh = new THREE.Mesh(baseBox(bandWidth, bandHeight, bandDepth), materials.balcony);
      mesh.position.set(0, y, side * offsetZ);
      mesh.scale.x = 0; // grows outward from the centerline — "extends", and reads continuous
      group.add(mesh);
      meshes.push(mesh);
    }
  }

  const setLocal = (t: number) => {
    const slot = 1 / balconyFloorCount;
    meshes.forEach((mesh, i) => {
      const floorIndex = Math.floor(i / 2);
      const localStart = floorIndex * slot;
      mesh.scale.x = Math.min(1, Math.max(0, (t - localStart) / slot));
    });
  };

  return { group, setLocal };
}

function buildFacadeFins(): Stage {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const finHeight = FLOORS_TOP - GROUND_TOP;
  const finCountPerSide = 13;
  const spacing = FLOOR_INSET.width / (finCountPerSide + 1);
  const z = FLOOR_INSET.depth / 2 + 0.15;

  for (const side of [1, -1]) {
    for (let i = 0; i < finCountPerSide; i++) {
      const x = -FLOOR_INSET.width / 2 + spacing * (i + 1);
      const mesh = growFromBase(baseBox(0.3, finHeight, 0.3), materials.fin, GROUND_TOP);
      mesh.position.x = x;
      mesh.position.z = side * z;
      group.add(mesh);
      meshes.push(mesh);
    }
  }

  const setLocal = (t: number) => {
    const slot = 1 / meshes.length;
    meshes.forEach((mesh, i) => {
      const localStart = i * slot * 0.6; // gentle stagger, not a hard sequence
      mesh.scale.y = Math.min(1, Math.max(0, (t - localStart) / (slot * 0.6 + 0.15)));
    });
  };

  return { group, setLocal };
}

/** Deterministic pseudo-random in [0,1) — used to pick which windows
 * light up so every reload/scroll direction looks the same. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Per-window target emissive intensity: most windows light warmly at
 * varying strength, a minority stay dark — "avoid making every window
 * equally bright" without modeling individual apartment interiors. */
function selectiveWindowTarget(seed: number): number {
  if (pseudoRandom(seed) < 0.22) return 0;
  return 0.5 + pseudoRandom(seed + 0.37) * 1.3;
}

interface GlazingSegment {
  material: THREE.MeshPhysicalMaterial;
  targetIntensity: number;
}

const GLAZING_SEGMENTS_PER_SIDE = 5;

/** Per-floor glazing, split into a few segments per facade (rather than
 * one tall panel, and well short of individually-modeled windows) so the
 * lighting stage can vary warmth window-by-window and floor-by-floor.
 * Every upper floor shares the same footprint (no podium, no top-floor
 * setback). */
function buildGlazing(): { stage: Stage; floorSegments: GlazingSegment[][] } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const floorSegments: GlazingSegment[][] = [];
  const panelHeight = FLOOR_HEIGHT - 0.4;
  const depth = 0.15;
  const zOffset = FLOOR_INSET.depth / 2 - 0.05;
  const segmentWidth = (FLOOR_INSET.width - 2) / GLAZING_SEGMENTS_PER_SIDE;
  const segmentSpan = segmentWidth * 0.8; // small gap between segments reads as mullions

  for (let floor = 0; floor < UPPER_FLOOR_COUNT; floor++) {
    const y = GROUND_TOP + floor * FLOOR_HEIGHT + 0.2;
    const segments: GlazingSegment[] = [];
    for (const side of [1, -1]) {
      for (let seg = 0; seg < GLAZING_SEGMENTS_PER_SIDE; seg++) {
        const x = -(FLOOR_INSET.width - 2) / 2 + segmentWidth * (seg + 0.5);
        const material = new THREE.MeshPhysicalMaterial({
          color: 0x8a95a3,
          roughness: 0.12,
          metalness: 0,
          transparent: true,
          opacity: 0,
          transmission: 0.35,
          reflectivity: 0.7,
          emissive: 0xffc98a,
          emissiveIntensity: 0,
        });
        const mesh = growFromBase(baseBox(segmentSpan, panelHeight, depth), material, y);
        mesh.position.x = x;
        mesh.position.z = side * zOffset;
        group.add(mesh);
        meshes.push(mesh);
        segments.push({ material, targetIntensity: selectiveWindowTarget(floor * 97 + side * 31 + seg) });
      }
    }
    floorSegments.push(segments);
  }

  const setLocal = (t: number) => {
    meshes.forEach((mesh) => {
      mesh.scale.y = t;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      mat.opacity = 0.5 * t;
    });
  };

  return { stage: { group, setLocal }, floorSegments };
}

function buildLighting(floorSegments: GlazingSegment[][], columns: THREE.Mesh[]): Stage {
  const group = new THREE.Group();
  const lights: THREE.PointLight[] = [];
  const coveMeshes: THREE.Mesh[] = [];

  const positions: [number, number][] = [
    [FOOTPRINT_WIDTH / 2 - 4, FOOTPRINT_DEPTH / 2 - 4],
    [-(FOOTPRINT_WIDTH / 2 - 4), FOOTPRINT_DEPTH / 2 - 4],
    [FOOTPRINT_WIDTH / 2 - 4, -(FOOTPRINT_DEPTH / 2 - 4)],
    [-(FOOTPRINT_WIDTH / 2 - 4), -(FOOTPRINT_DEPTH / 2 - 4)],
  ];
  for (const [x, z] of positions) {
    const light = new THREE.PointLight(0xffcf8a, 0, 18);
    light.position.set(x, GROUND_TOP - 1, z);
    group.add(light);
    lights.push(light);
  }

  const roofLight = new THREE.PointLight(0xffe3b0, 0, 24);
  roofLight.position.set(0, PARAPET_TOP + ROOF_STRUCTURE_HEIGHT + 2, 0);
  group.add(roofLight);

  const coveWidth = FOOTPRINT_WIDTH - 5;
  for (const side of [1, -1]) {
    const mesh = new THREE.Mesh(baseBox(coveWidth, 0.12, 0.12), materials.coveLight.clone());
    mesh.position.set(0, GROUND_TOP - 0.1, (side * FOOTPRINT_DEPTH) / 2 - 0.3);
    group.add(mesh);
    coveMeshes.push(mesh);
  }

  const setLocal = (t: number) => {
    // Warm interior lights switch on floor-by-floor across the first 70%
    // of this phase, each window ramping toward its own selective target
    // (see selectiveWindowTarget) rather than a single uniform intensity.
    const floorWindow = 0.7;
    const floorSlot = floorWindow / UPPER_FLOOR_COUNT;
    floorSegments.forEach((segments, i) => {
      const localStart = i * floorSlot;
      const localT = Math.min(1, Math.max(0, (t - localStart) / floorSlot));
      segments.forEach(({ material, targetIntensity }) => {
        material.emissiveIntensity = localT * targetIntensity;
      });
    });

    // ...ground-floor architectural lighting (columns, cove, roof accent)
    // activates last, over the remaining 30%.
    const groundStart = floorWindow;
    const groundT = Math.min(1, Math.max(0, (t - groundStart) / (1 - groundStart)));
    materials.ground.emissiveIntensity = groundT * GROUND_LIGHT_TARGET;
    columns.forEach((column) => {
      (column.material as THREE.MeshStandardMaterial).emissiveIntensity = groundT * 1.3;
    });
    coveMeshes.forEach((mesh) => {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = groundT * 2.2;
    });
    lights.forEach((light) => (light.intensity = groundT * 1.6));
    roofLight.intensity = t * 1.4;
  };

  return { group, setLocal };
}

/** Candidate landscaping positions (hedges around the perimeter, a few
 * trees further out), each kept only if it verifiably falls inside the
 * true plot boundary — never a naive radius around the building that
 * could spill onto neighbouring land. */
function buildLandscaping(): Stage {
  const group = new THREE.Group();

  const hedges: THREE.Mesh[] = [];
  const hedgeRadiusX = FOOTPRINT_WIDTH / 2 + 6;
  const hedgeRadiusZ = FOOTPRINT_DEPTH / 2 + 6;
  const hedgeCandidateCount = 24;
  for (let i = 0; i < hedgeCandidateCount; i++) {
    const angle = (i / hedgeCandidateCount) * Math.PI * 2;
    const spot: Local2 = [Math.cos(angle) * hedgeRadiusX, Math.sin(angle) * hedgeRadiusZ];
    if (!isInsidePlotRelativeToFootprint(spot)) continue;
    const mesh = growFromBase(baseBox(2.2, 0.7, 0.7), materials.hedge, 0);
    mesh.position.set(spot[0], 0, spot[1]);
    mesh.rotation.y = angle;
    group.add(mesh);
    hedges.push(mesh);
  }

  const trees: THREE.Group[] = [];
  const treeCandidateSpots: Local2[] = [
    [FOOTPRINT_WIDTH / 2 + 9, FOOTPRINT_DEPTH / 2 + 7],
    [-(FOOTPRINT_WIDTH / 2 + 9), FOOTPRINT_DEPTH / 2 + 7],
    [FOOTPRINT_WIDTH / 2 + 9, -(FOOTPRINT_DEPTH / 2 + 7)],
    [-(FOOTPRINT_WIDTH / 2 + 9), -(FOOTPRINT_DEPTH / 2 + 7)],
    [0, FOOTPRINT_DEPTH / 2 + 10],
    [0, -(FOOTPRINT_DEPTH / 2 + 10)],
  ];
  for (const spot of treeCandidateSpots) {
    if (!isInsidePlotRelativeToFootprint(spot)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), materials.treeTrunk);
    trunk.position.y = 1.1;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 8), materials.treeCanopy);
    canopy.position.y = 3.4;
    tree.add(trunk, canopy);
    tree.position.set(spot[0], 0, spot[1]);
    tree.scale.setScalar(0);
    group.add(tree);
    trees.push(tree);
  }

  const setLocal = (t: number) => {
    hedges.forEach((mesh, i) => {
      const localStart = (i / Math.max(1, hedges.length)) * 0.5;
      mesh.scale.y = Math.min(1, Math.max(0, (t - localStart) / 0.5));
    });
    trees.forEach((tree, i) => {
      const localStart = 0.3 + (i / Math.max(1, trees.length)) * 0.5;
      const s = Math.min(1, Math.max(0, (t - localStart) / 0.5));
      tree.scale.setScalar(s);
    });
    // Final brightness increases slightly relative to the surrounding
    // satellite imagery, once the building has finished assembling.
    materials.ground.emissiveIntensity = GROUND_LIGHT_TARGET + t * 0.15;
  };

  return { group, setLocal };
}

export interface CreateBuildingOptions {
  /** ?debug=1: the hero environment (ground plane + road dressing that
   * replaces the satellite imagery) stays hidden so the real satellite
   * imagery remains visible for geometry verification at any scroll
   * position — matching MapCanvas's existing "surroundings are never
   * dimmed" debug behavior. */
  debug?: boolean;
}

export function createProceduralBuilding(options: CreateBuildingOptions = {}): BuildingModel {
  const root = new THREE.Object3D();

  const ambient = new THREE.AmbientLight(0xb8a98c, 0.5);
  const sun = new THREE.DirectionalLight(0xffdfb0, 1.05);
  sun.position.set(40, 60, -20);
  root.add(ambient, sun);

  const contactShadow = buildContactShadow();
  const { stage: ground, columns } = buildGroundFloor();
  const massing = buildMassing();
  const balconies = buildBalconyBands();
  const fins = buildFacadeFins();
  const { stage: glazing, floorSegments } = buildGlazing();
  const lighting = buildLighting(floorSegments, columns);
  const landscaping = buildLandscaping();
  const heroEnvironment = buildHeroEnvironment();

  root.add(
    contactShadow.group,
    ground.group,
    massing.group,
    balconies.group,
    fins.group,
    glazing.group,
    lighting.group,
    landscaping.group,
    heroEnvironment.group,
  );

  function setProgress(progress: number) {
    contactShadow.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.slab.window));
    ground.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.groundFloor.window));
    massing.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.floorsRising.window));
    balconies.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.balconyBands.window));
    fins.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.facadeFins.window));
    glazing.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.glazing.window));
    lighting.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.lighting.window));
    landscaping.setLocal(windowProgress(progress, LEGACY_BUILDING_WINDOWS.landscaping.window));
    if (!options.debug) {
      heroEnvironment.setLocal(windowProgress(progress, HERO_ENVIRONMENT_WINDOW));
    }
  }

  function dispose() {
    root.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }

  return { object3D: root, setProgress, dispose };
}
