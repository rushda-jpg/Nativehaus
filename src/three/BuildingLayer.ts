import mapboxgl from "mapbox-gl";
import * as THREE from "three";
import type { LngLat } from "../config/geo";
import type { BuildingModel } from "./buildingBuilder";

/**
 * A Mapbox GL custom layer that renders a Three.js scene inside Mapbox's
 * own WebGL context, anchored to a real-world coordinate. Because
 * `render()` rebuilds the camera's projection matrix from the matrix
 * Mapbox hands it every frame, the Three.js camera *is* the Mapbox camera
 * — there is no separate sync step, and no drift as the map scrolls,
 * zooms, tilts or rotates.
 *
 * This layer only knows about the `BuildingModel` interface (an
 * `object3D` + `setProgress`), not how it was built — see
 * `buildingBuilder.ts` and PLAN.md §4 for how a GLB model swaps in later
 * without touching this file's Mapbox integration.
 */
export class BuildingLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: "custom";
  renderingMode: "3d";

  private origin: LngLat;
  private model: BuildingModel;
  private rotationRad: number;
  private mercatorOrigin!: mapboxgl.MercatorCoordinate;
  private scale = 1;

  private camera = new THREE.PerspectiveCamera();
  private scene = new THREE.Scene();
  private renderer?: THREE.WebGLRenderer;
  private map?: mapboxgl.Map;

  /**
   * @param rotationDeg Rotates the building's footprint (around its own
   * vertical axis) to match the plot's real-world orientation — same
   * convention/value as `PLOT_ROTATION_DEG` in plotGeometry.ts, degrees,
   * CCW. 0 leaves the model's authored +X (width) axis pointing East.
   */
  constructor(id: string, origin: LngLat, model: BuildingModel, rotationDeg = 0) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "3d";
    this.origin = origin;
    this.model = model;
    this.rotationRad = (rotationDeg * Math.PI) / 180;
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.mercatorOrigin = mapboxgl.MercatorCoordinate.fromLngLat([this.origin[0], this.origin[1]], 0);
    this.scale = this.mercatorOrigin.meterInMercatorCoordinateUnits();

    this.scene.add(this.model.object3D);

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setProgress(progress: number) {
    this.model.setProgress(progress);
  }

  render(_gl: WebGL2RenderingContext, matrix: Array<number>) {
    if (!this.renderer || !this.map) return;

    // three.js scene is authored Y-up in meters; Mapbox's world is a
    // Z-up mercator space. Rotate X by +90deg to reconcile the two, then
    // translate to the site's mercator position and scale meters ->
    // mercator units (Y flips sign to match mercator's south-positive Y).
    // rotationY (applied first, while still Y-up) orients the footprint
    // to match the plot's real-world bearing.
    const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), this.rotationRad);
    const translation = new THREE.Matrix4().makeTranslation(
      this.mercatorOrigin.x,
      this.mercatorOrigin.y,
      this.mercatorOrigin.z ?? 0,
    );
    const scaleMatrix = new THREE.Matrix4().makeScale(this.scale, -this.scale, this.scale);

    const modelMatrix = translation.multiply(scaleMatrix).multiply(rotationX).multiply(rotationY);
    const projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(modelMatrix);

    this.camera.projectionMatrix = projectionMatrix;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }

  onRemove(_map: mapboxgl.Map, _gl: WebGL2RenderingContext) {
    this.model.dispose();
    this.renderer = undefined;
  }
}
