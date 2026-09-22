import * as THREE from "three";
import { BUILDING_FOOTPRINT_DEPTH_M, BUILDING_FOOTPRINT_WIDTH_M } from "../config/buildingTransform";
import { FRONT_DIRECTION_BUILDING_LOCAL } from "../config/plotGeometry";
import type { Stage } from "./buildingBuilder";

/**
 * Curated "premium local context" around Native Haus for the front hero
 * reveal — deliberately NOT an attempt to model the real neighborhood.
 * The flat satellite basemap is faded out over the same progress window
 * (see MapCanvas.tsx / HERO_ENVIRONMENT_WINDOW in scenes.ts) and replaced
 * with this: a simplified ground plane, near-field road/curb/planting
 * dressing along the real digitized road corner, and a handful of soft,
 * deliberately under-detailed midground masses. Everything here stays
 * darker, flatter and less detailed than Native Haus itself — the
 * building remains the visual focus, this only supports it.
 *
 * Dial `HERO_ENVIRONMENT_INTENSITY` down later (e.g. once the real GLB
 * model replaces this whole proxy) to keep a light surrounding context
 * or fade this dressing out almost entirely — every opacity/scale below
 * is scaled by it, so nothing else needs to change.
 */
export const HERO_ENVIRONMENT_INTENSITY = 1;

const FOOTPRINT_WIDTH = BUILDING_FOOTPRINT_WIDTH_M;
const FOOTPRINT_DEPTH = BUILDING_FOOTPRINT_DEPTH_M;
// Stays clear of the building's own footprint and in-plot landscaping.
const CLEARANCE_RADIUS = Math.hypot(FOOTPRINT_WIDTH, FOOTPRINT_DEPTH) / 2 + 2;

// The real road-corner direction, in the building's own local X/Z frame
// (see plotGeometry.ts) — the near-field road context is centered here,
// not guessed. The camera's exact sightline sits within this wedge too,
// so nothing here is tall or dense enough to block the building itself.
const [FRONT_X, FRONT_Z] = FRONT_DIRECTION_BUILDING_LOCAL;
const FRONT_ANGLE = Math.atan2(FRONT_Z, FRONT_X);
const FRONT_WEDGE_HALF_ANGLE = (62 * Math.PI) / 180;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function baseBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

/** Flat annulus-sector band in the X/Z plane (up = +Y), built from
 * explicit vertices rather than a rotated THREE.RingGeometry so the
 * angle convention matches FRONT_ANGLE (atan2(z, x)) exactly, with no
 * ambiguity from a rotateX's sign flip. DoubleSide materials cover any
 * winding-order slip since this can't be visually spot-checked here. */
function buildSectorBand(innerR: number, outerR: number, centerAngle: number, halfAngle: number, y: number): THREE.BufferGeometry {
  const segments = 32;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = centerAngle - halfAngle + (2 * halfAngle * i) / segments;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    positions.push(ca * innerR, y, sa * innerR, ca * outerR, y, sa * outerR);
  }
  for (let i = 0; i < segments; i++) {
    const a0 = i * 2;
    const b0 = i * 2 + 1;
    const a1 = (i + 1) * 2;
    const b1 = (i + 1) * 2 + 1;
    indices.push(a0, b0, a1, b0, b1, a1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sectorMaterial(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 0, side: THREE.DoubleSide });
}

interface FadeTarget {
  material: THREE.MeshStandardMaterial;
  targetOpacity: number;
}

/** Ground plane that visually replaces the satellite imagery as it fades
 * — sized generously so it reads as continuous ground at the hero
 * framing, not a disc floating on a void. */
function buildGroundPlane(): { mesh: THREE.Mesh; fade: FadeTarget } {
  const geometry = new THREE.CircleGeometry(150, 48);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.95, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.03; // just beneath the building's own contact shadow
  return { mesh, fade: { material, targetOpacity: 0.95 } };
}

interface NearField {
  group: THREE.Group;
  fades: FadeTarget[];
  poleLights: THREE.Mesh[];
  palms: THREE.Group[];
  vehicles: THREE.Mesh[];
}

/** Road, sidewalk and planting strip curving around the real road corner,
 * plus a few palms, streetlights and simple vehicle silhouettes along it
 * — a simplified architectural context, not a modeled street. */
function buildNearField(): NearField {
  const group = new THREE.Group();
  const fades: FadeTarget[] = [];
  const poleLights: THREE.Mesh[] = [];
  const palms: THREE.Group[] = [];
  const vehicles: THREE.Mesh[] = [];

  const innerPlanting = CLEARANCE_RADIUS + 0.5;
  const outerPlanting = innerPlanting + 1.8;
  const innerSidewalk = outerPlanting;
  const outerSidewalk = innerSidewalk + 2.6;
  const innerRoad = outerSidewalk;
  const outerRoad = innerRoad + 8.5;

  function band(inner: number, outer: number, material: THREE.MeshStandardMaterial, targetOpacity: number): void {
    const geometry = buildSectorBand(inner, outer, FRONT_ANGLE, FRONT_WEDGE_HALF_ANGLE, -0.02);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    fades.push({ material, targetOpacity });
  }

  band(innerPlanting, outerPlanting, sectorMaterial(0x223423, 1), 0.85);
  band(innerSidewalk, outerSidewalk, sectorMaterial(0x3c3c40, 0.9), 0.8);
  band(innerRoad, outerRoad, sectorMaterial(0x1e1d20, 0.8, 0.05), 0.85);
  const markingRadius = (innerRoad + outerRoad) / 2;
  band(markingRadius - 0.12, markingRadius + 0.12, sectorMaterial(0x6b675c, 0.7), 0.5);

  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.9 });
  const palmCount = 4;
  for (let i = 0; i < palmCount; i++) {
    const t = i / (palmCount - 1);
    const angle = FRONT_ANGLE - FRONT_WEDGE_HALF_ANGLE * 0.7 + FRONT_WEDGE_HALF_ANGLE * 1.4 * t;
    const radius = (innerPlanting + outerPlanting) / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const palm = new THREE.Group();
    const trunkHeight = 3.6 + pseudoRandom(i * 7.1) * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, trunkHeight, 7), palmTrunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.rotation.z = (pseudoRandom(i * 3.3) - 0.5) * 0.12;
    palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 5), palmFrondMat);
      frond.position.y = trunkHeight;
      frond.rotation.z = Math.PI / 2.3;
      frond.rotation.y = (f / 6) * Math.PI * 2;
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    palm.scale.setScalar(0);
    group.add(palm);
    palms.push(palm);
  }

  const poleMetalMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4, metalness: 0.6 });
  const lightCount = 3;
  for (let i = 0; i < lightCount; i++) {
    const t = i / (lightCount - 1);
    const angle = FRONT_ANGLE - FRONT_WEDGE_HALF_ANGLE * 0.55 + FRONT_WEDGE_HALF_ANGLE * 1.1 * t;
    const radius = outerSidewalk + 0.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const poleHeight = 5.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, poleHeight, 8), poleMetalMat);
    pole.position.set(x, poleHeight / 2, z);
    group.add(pole);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe3b0, emissive: 0xffcf8a, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampMat);
    lamp.position.set(x, poleHeight + 0.1, z);
    group.add(lamp);
    poleLights.push(lamp);
  }

  const vehicleMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.3 });
  const vehicleCount = 2;
  for (let i = 0; i < vehicleCount; i++) {
    const angle = FRONT_ANGLE - FRONT_WEDGE_HALF_ANGLE * 0.4 + FRONT_WEDGE_HALF_ANGLE * 0.6 * i;
    const radius = innerRoad + 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const body = new THREE.Mesh(baseBox(4.2, 1.4, 1.8), vehicleMat);
    body.position.set(x, 0, z);
    body.rotation.y = angle + Math.PI / 2;
    body.scale.setScalar(0);
    group.add(body);
    vehicles.push(body);
  }

  return { group, fades, poleLights, palms, vehicles };
}

/** A handful of simple, low-detail dark masses suggesting the wider JVT
 * context — deliberately abstract (single box each, no windows), kept
 * out of the hero camera's direct sightline, and always softer/darker
 * than Native Haus itself. */
function buildMidground(): { group: THREE.Group; boxes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const boxes: THREE.Mesh[] = [];
  const count = 7;
  // Wider than the near-field wedge so nothing sits just behind the road
  // dressing either — keeps the whole front sightline clear.
  const exclusionHalfAngle = FRONT_WEDGE_HALF_ANGLE + (18 * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    let angle = (i / count) * Math.PI * 2 + pseudoRandom(i * 5.7) * 0.4;
    let delta = ((angle - FRONT_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(delta) < exclusionHalfAngle) {
      angle = FRONT_ANGLE + Math.PI + pseudoRandom(i * 9.3) * 0.6 - 0.3;
      delta = ((angle - FRONT_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    }
    const radius = 48 + pseudoRandom(i * 2.9) * 42;
    const width = 14 + pseudoRandom(i * 4.1) * 18;
    const depth = 14 + pseudoRandom(i * 6.3) * 18;
    const height = 7 + pseudoRandom(i * 8.5) * 11; // stays well under Native Haus's own height
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const material = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.95, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(baseBox(width, height, depth), material);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = pseudoRandom(i * 1.7) * Math.PI;
    group.add(mesh);
    boxes.push(mesh);
  }

  return { group, boxes };
}

export function buildHeroEnvironment(): Stage {
  const group = new THREE.Group();

  const { mesh: groundMesh, fade: groundFade } = buildGroundPlane();
  const { group: nearFieldGroup, fades: nearFieldFades, poleLights, palms, vehicles } = buildNearField();
  const { group: midgroundGroup, boxes: midgroundBoxes } = buildMidground();

  group.add(groundMesh, nearFieldGroup, midgroundGroup);

  const setLocal = (t: number) => {
    const i = HERO_ENVIRONMENT_INTENSITY;
    groundFade.material.opacity = t * groundFade.targetOpacity * i;

    nearFieldFades.forEach(({ material, targetOpacity }) => {
      material.opacity = t * targetOpacity * i;
    });

    const growT = Math.min(1, t / 0.7);
    palms.forEach((palm) => palm.scale.setScalar(growT * i));
    vehicles.forEach((vehicle) => vehicle.scale.setScalar(growT * i));

    // Streetlights switch on late, like the building's own architectural
    // lighting beat, rather than being lit from the moment they appear.
    const glowT = Math.max(0, (t - 0.65) / 0.35);
    poleLights.forEach((lamp) => {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = glowT * 1.8 * i;
    });

    midgroundBoxes.forEach((box) => {
      (box.material as THREE.MeshStandardMaterial).opacity = t * 0.5 * i;
    });
  };

  return { group, setLocal };
}
