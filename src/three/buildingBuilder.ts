import * as THREE from "three";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";

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

const FOOTPRINT_WIDTH = 34; // east-west, meters
const FOOTPRINT_DEPTH = 20; // north-south, meters
const CORNER_RADIUS = 3;
const SLAB_HEIGHT = 0.5;
const GROUND_FLOOR_HEIGHT = 4.2;
const FLOOR_HEIGHT = 3.1;
const FLOOR_COUNT = 6;
const ROOF_HEIGHT = 2.6;
const FLOOR_INSET = { width: FOOTPRINT_WIDTH - 1.5, depth: FOOTPRINT_DEPTH - 1.5 };

const GROUND_TOP = SLAB_HEIGHT + GROUND_FLOOR_HEIGHT;
const FLOORS_TOP = GROUND_TOP + FLOOR_COUNT * FLOOR_HEIGHT;

const materials = {
  slab: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, metalness: 0.05 }),
  ground: new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0xd7b98a,
    emissiveIntensity: 0,
  }),
  facade: new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.75, metalness: 0.05 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xcfccc3, roughness: 0.8, metalness: 0.05 }),
  balcony: new THREE.MeshStandardMaterial({ color: 0xd8d4c9, roughness: 0.6, metalness: 0.1 }),
  fin: new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.5, metalness: 0.3 }),
  glazing: new THREE.MeshPhysicalMaterial({
    color: 0x8fb8c9,
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.0,
    transmission: 0.4,
    reflectivity: 0.6,
  }),
  coveLight: new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xffdfa0,
    emissiveIntensity: 0,
  }),
  paving: new THREE.MeshStandardMaterial({ color: 0x2f2b26, roughness: 1 }),
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

interface Stage {
  group: THREE.Group;
  setLocal(t: number): void;
}

function buildSlab(): Stage {
  const group = new THREE.Group();
  const mesh = growFromBase(
    extrudedRoundedMass(FOOTPRINT_WIDTH + 5, FOOTPRINT_DEPTH + 5, SLAB_HEIGHT, CORNER_RADIUS + 1),
    materials.slab,
    0,
  );
  group.add(mesh);
  return { group, setLocal: (t) => (mesh.scale.y = t) };
}

function buildGroundFloor(): Stage {
  const group = new THREE.Group();
  const mesh = growFromBase(
    extrudedRoundedMass(FOOTPRINT_WIDTH, FOOTPRINT_DEPTH, GROUND_FLOOR_HEIGHT, CORNER_RADIUS),
    materials.ground,
    SLAB_HEIGHT,
  );
  group.add(mesh);
  return {
    group,
    setLocal: (t) => {
      mesh.scale.y = t;
    },
  };
}

function buildFloors(): { stage: Stage; topY: number; roofGroup: THREE.Group } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < FLOOR_COUNT; i++) {
    const y = GROUND_TOP + i * FLOOR_HEIGHT;
    const mesh = growFromBase(
      extrudedRoundedMass(FLOOR_INSET.width, FLOOR_INSET.depth, FLOOR_HEIGHT, CORNER_RADIUS),
      materials.facade,
      y,
    );
    group.add(mesh);
    meshes.push(mesh);
  }

  const roofGroup = new THREE.Group();
  const roofMesh = growFromBase(
    extrudedRoundedMass(FLOOR_INSET.width - 6, FLOOR_INSET.depth - 5, ROOF_HEIGHT, CORNER_RADIUS - 0.5),
    materials.roof,
    FLOORS_TOP,
  );
  roofGroup.add(roofMesh);

  const setLocal = (t: number) => {
    // Each floor rises sequentially inside the phase window; the roof
    // structure completes the sequence right after the top floor.
    const slot = 1 / (FLOOR_COUNT + 1);
    meshes.forEach((mesh, i) => {
      const localStart = i * slot;
      mesh.scale.y = Math.min(1, Math.max(0, (t - localStart) / slot));
    });
    const roofStart = FLOOR_COUNT * slot;
    roofMesh.scale.y = Math.min(1, Math.max(0, (t - roofStart) / slot));
  };

  const merged = new THREE.Group();
  merged.add(group, roofGroup);
  return { stage: { group: merged, setLocal }, topY: FLOORS_TOP, roofGroup };
}

function buildBalconyBands(): Stage {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const bandWidth = FLOOR_INSET.width - 3;
  const bandDepth = 1.7;
  const bandHeight = 0.3;
  const offsetZ = FLOOR_INSET.depth / 2 + bandDepth / 2 - 0.2;

  for (let i = 0; i < FLOOR_COUNT; i++) {
    const y = GROUND_TOP + i * FLOOR_HEIGHT + 0.1;
    for (const side of [1, -1]) {
      const mesh = new THREE.Mesh(baseBox(bandWidth, bandHeight, bandDepth), materials.balcony);
      mesh.position.set(0, y, side * offsetZ);
      mesh.scale.x = 0; // grows outward from the centerline — "extends"
      group.add(mesh);
      meshes.push(mesh);
    }
  }

  const setLocal = (t: number) => {
    const slot = 1 / FLOOR_COUNT;
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
  const finCountPerSide = 9;
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

function buildGlazing(): Stage {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const height = FLOORS_TOP - GROUND_TOP - 0.4;
  const width = FLOOR_INSET.width - 2;
  const depth = 0.15;
  const zOffset = FLOOR_INSET.depth / 2 - 0.05;

  for (const side of [1, -1]) {
    const mesh = growFromBase(baseBox(width, height, depth), materials.glazing.clone(), GROUND_TOP + 0.2);
    mesh.position.z = side * zOffset;
    group.add(mesh);
    meshes.push(mesh);
  }

  const setLocal = (t: number) => {
    meshes.forEach((mesh) => {
      mesh.scale.y = t;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      mat.opacity = 0.55 * t;
    });
  };

  return { group, setLocal };
}

function buildLighting(roofGroup: THREE.Group): Stage {
  const group = new THREE.Group();
  const lights: THREE.PointLight[] = [];
  const coveMeshes: THREE.Mesh[] = [];

  const positions: [number, number][] = [
    [FOOTPRINT_WIDTH / 2 - 3, FOOTPRINT_DEPTH / 2 - 3],
    [-(FOOTPRINT_WIDTH / 2 - 3), FOOTPRINT_DEPTH / 2 - 3],
    [FOOTPRINT_WIDTH / 2 - 3, -(FOOTPRINT_DEPTH / 2 - 3)],
    [-(FOOTPRINT_WIDTH / 2 - 3), -(FOOTPRINT_DEPTH / 2 - 3)],
  ];
  for (const [x, z] of positions) {
    const light = new THREE.PointLight(0xffcf8a, 0, 14);
    light.position.set(x, GROUND_TOP - 1, z);
    group.add(light);
    lights.push(light);
  }

  const roofLight = new THREE.PointLight(0xbfe3ff, 0, 20);
  roofLight.position.set(0, FLOORS_TOP + ROOF_HEIGHT + 2, 0);
  group.add(roofLight);
  lights.push(roofLight);

  const coveWidth = FOOTPRINT_WIDTH - 4;
  for (const side of [1, -1]) {
    const mesh = new THREE.Mesh(baseBox(coveWidth, 0.12, 0.12), materials.coveLight.clone());
    mesh.position.set(0, GROUND_TOP - 0.1, (side * FOOTPRINT_DEPTH) / 2 - 0.3);
    group.add(mesh);
    coveMeshes.push(mesh);
  }
  void roofGroup;

  const setLocal = (t: number) => {
    lights.forEach((light) => {
      light.intensity = t * (light === roofLight ? 2.2 : 1.6);
    });
    materials.ground.emissiveIntensity = t * 0.9;
    coveMeshes.forEach((mesh) => {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = t * 2.4;
    });
  };

  return { group, setLocal };
}

function buildLandscaping(): Stage {
  const group = new THREE.Group();

  const paving = new THREE.Mesh(baseBox(FOOTPRINT_WIDTH + 34, 0.08, FOOTPRINT_DEPTH + 22), materials.paving);
  paving.scale.set(0, 1, 0);
  group.add(paving);

  const hedges: THREE.Mesh[] = [];
  const hedgeRadiusX = FOOTPRINT_WIDTH / 2 + 8;
  const hedgeRadiusZ = FOOTPRINT_DEPTH / 2 + 8;
  const hedgeCount = 14;
  for (let i = 0; i < hedgeCount; i++) {
    const angle = (i / hedgeCount) * Math.PI * 2;
    const x = Math.cos(angle) * hedgeRadiusX;
    const z = Math.sin(angle) * hedgeRadiusZ;
    const mesh = growFromBase(baseBox(2.4, 0.7, 0.7), materials.hedge, 0);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    group.add(mesh);
    hedges.push(mesh);
  }

  const trees: THREE.Group[] = [];
  const treeSpots: [number, number][] = [
    [FOOTPRINT_WIDTH / 2 + 14, FOOTPRINT_DEPTH / 2 + 10],
    [-(FOOTPRINT_WIDTH / 2 + 14), FOOTPRINT_DEPTH / 2 + 10],
    [FOOTPRINT_WIDTH / 2 + 14, -(FOOTPRINT_DEPTH / 2 + 10)],
    [-(FOOTPRINT_WIDTH / 2 + 14), -(FOOTPRINT_DEPTH / 2 + 10)],
    [0, FOOTPRINT_DEPTH / 2 + 16],
    [0, -(FOOTPRINT_DEPTH / 2 + 16)],
  ];
  for (const [x, z] of treeSpots) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), materials.treeTrunk);
    trunk.position.y = 1.1;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 8), materials.treeCanopy);
    canopy.position.y = 3.4;
    tree.add(trunk, canopy);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(0);
    group.add(tree);
    trees.push(tree);
  }

  const setLocal = (t: number) => {
    paving.scale.set(t, 1, t);
    hedges.forEach((mesh, i) => {
      const localStart = (i / hedges.length) * 0.5;
      mesh.scale.y = Math.min(1, Math.max(0, (t - localStart) / 0.5));
    });
    trees.forEach((tree, i) => {
      const localStart = 0.3 + (i / trees.length) * 0.5;
      const s = Math.min(1, Math.max(0, (t - localStart) / 0.5));
      tree.scale.setScalar(s);
    });
  };

  return { group, setLocal };
}

export function createProceduralBuilding(): BuildingModel {
  const root = new THREE.Object3D();

  const ambient = new THREE.AmbientLight(0x8fa3bf, 0.55);
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.1);
  sun.position.set(40, 60, -20);
  root.add(ambient, sun);

  const slab = buildSlab();
  const ground = buildGroundFloor();
  const { stage: floors, roofGroup } = buildFloors();
  const balconies = buildBalconyBands();
  const fins = buildFacadeFins();
  const glazing = buildGlazing();
  const lighting = buildLighting(roofGroup);
  const landscaping = buildLandscaping();

  root.add(
    slab.group,
    ground.group,
    floors.group,
    balconies.group,
    fins.group,
    glazing.group,
    lighting.group,
    landscaping.group,
  );

  function setProgress(progress: number) {
    slab.setLocal(windowProgress(progress, SCENE_WINDOWS.slab.window));
    ground.setLocal(windowProgress(progress, SCENE_WINDOWS.groundFloor.window));
    floors.setLocal(windowProgress(progress, SCENE_WINDOWS.floorsRising.window));
    balconies.setLocal(windowProgress(progress, SCENE_WINDOWS.balconyBands.window));
    fins.setLocal(windowProgress(progress, SCENE_WINDOWS.facadeFins.window));
    glazing.setLocal(windowProgress(progress, SCENE_WINDOWS.glazing.window));
    lighting.setLocal(windowProgress(progress, SCENE_WINDOWS.lighting.window));
    landscaping.setLocal(windowProgress(progress, SCENE_WINDOWS.landscaping.window));
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
