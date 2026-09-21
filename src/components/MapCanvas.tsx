import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CAMERA_KEYFRAMES, NATIVE_HAUS_SITE, SITE_PLOT_RING } from "../config/geo";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";
import { interpolateCamera } from "../lib/math";
import { BuildingLayer } from "../three/BuildingLayer";
import { createProceduralBuilding } from "../three/buildingBuilder";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const SITE_SOURCE_ID = "native-haus-plot";
const SITE_FILL_LAYER_ID = "native-haus-plot-fill";
const SITE_LINE_LAYER_ID = "native-haus-plot-line";
const BUILDING_LAYER_ID = "native-haus-building";

export interface MapCanvasHandle {
  update(progress: number): void;
}

export const MapCanvas = forwardRef<MapCanvasHandle>(function MapCanvas(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const buildingLayerRef = useRef<BuildingLayer | null>(null);
  const readyRef = useRef(false);
  const [tokenMissing] = useState(() => !MAPBOX_TOKEN);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;

      const camera = interpolateCamera(progress, CAMERA_KEYFRAMES);
      map.jumpTo({
        center: camera.center as [number, number],
        zoom: camera.zoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
      });

      const drawProgress = windowProgress(progress, SCENE_WINDOWS.plotBoundary.window);
      if (map.getLayer(SITE_LINE_LAYER_ID)) {
        map.setPaintProperty(SITE_LINE_LAYER_ID, "line-opacity", drawProgress);
        map.setPaintProperty(SITE_LINE_LAYER_ID, "line-width", 1.5 + drawProgress * 1.5);
      }
      if (map.getLayer(SITE_FILL_LAYER_ID)) {
        map.setPaintProperty(SITE_FILL_LAYER_ID, "fill-opacity", drawProgress * 0.08);
      }

      buildingLayerRef.current?.setProgress(progress);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initial = interpolateCamera(0, CAMERA_KEYFRAMES);
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      projection: "globe",
      center: initial.center as [number, number],
      zoom: initial.zoom,
      pitch: initial.pitch,
      bearing: initial.bearing,
      attributionControl: true,
      interactive: false,
      scrollZoom: false,
      dragPan: false,
      dragRotate: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoomRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      // Defensive: satellite-v9 ships no label layers, but hide any
      // symbol layers if the style is ever swapped for one that does.
      const layers = map.getStyle()?.layers ?? [];
      for (const layer of layers) {
        if (layer.type === "symbol") {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      map.setFog({
        color: "#0a1622",
        "high-color": "#0b1d33",
        "space-color": "#00020a",
        "horizon-blend": 0.15,
        "star-intensity": 0.25,
      });

      map.addSource(SITE_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [SITE_PLOT_RING] },
        },
      });

      map.addLayer({
        id: SITE_FILL_LAYER_ID,
        type: "fill",
        source: SITE_SOURCE_ID,
        paint: { "fill-color": "#d7b98a", "fill-opacity": 0 },
      });

      map.addLayer({
        id: SITE_LINE_LAYER_ID,
        type: "line",
        source: SITE_SOURCE_ID,
        paint: {
          "line-color": "#f4e3bd",
          "line-width": 1.5,
          "line-opacity": 0,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      const buildingModel = createProceduralBuilding();
      const buildingLayer = new BuildingLayer(BUILDING_LAYER_ID, NATIVE_HAUS_SITE, buildingModel);
      buildingLayerRef.current = buildingLayer;
      map.addLayer(buildingLayer as unknown as mapboxgl.CustomLayerInterface);

      readyRef.current = true;
    });

    return () => {
      readyRef.current = false;
      buildingLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  if (tokenMissing) {
    return (
      <div className="map-canvas map-canvas--missing-token">
        <p>
          Set <code>VITE_MAPBOX_TOKEN</code> in <code>.env.local</code> to load the Mapbox scene.
          <br />
          See <code>.env.example</code>.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="map-canvas" />;
});
