import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  BUILDING_ANCHOR,
  BUILDING_FOOTPRINT_RING,
  CAMERA_KEYFRAMES,
  NATIVE_HAUS_SITE,
  SETBACK_ENVELOPE_RING,
  SITE_DIM_MASK_RINGS,
  SITE_PLOT_RING,
} from "../config/geo";
import { PLOT_ROTATION_DEG } from "../config/plotGeometry";
import { SCENE_WINDOWS, windowProgress } from "../config/scenes";
import { NATIVE_RED } from "../config/brand";
import { interpolateCamera } from "../lib/math";
import { isCalibrateMode, isDebugMode } from "../lib/queryFlags";
import { BuildingLayer } from "../three/BuildingLayer";
import { createProceduralBuilding } from "../three/buildingBuilder";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const SITE_SOURCE_ID = "native-haus-plot";
const SITE_FILL_LAYER_ID = "native-haus-plot-fill";
const SITE_LINE_LAYER_ID = "native-haus-plot-line";
const SITE_DIM_MASK_SOURCE_ID = "native-haus-dim-mask";
const SITE_DIM_MASK_LAYER_ID = "native-haus-dim-mask-fill";
const SITE_PULSE_SOURCE_ID = "native-haus-plot-pulse";
const SITE_PULSE_LAYER_ID = "native-haus-plot-pulse-line";
const BUILDING_LAYER_ID = "native-haus-building";

const DEBUG_ANCHOR_SOURCE_ID = "native-haus-debug-anchor";
const DEBUG_ANCHOR_LAYER_ID = "native-haus-debug-anchor-point";
const DEBUG_ENVELOPE_SOURCE_ID = "native-haus-debug-envelope";
const DEBUG_ENVELOPE_LAYER_ID = "native-haus-debug-envelope-line";
const DEBUG_FOOTPRINT_SOURCE_ID = "native-haus-debug-footprint";
const DEBUG_FOOTPRINT_LAYER_ID = "native-haus-debug-footprint-line";

const PULSE_TRANSPARENT = "rgba(193,39,45,0)";

export interface MapCanvasHandle {
  update(progress: number): void;
}

interface ClickedCoord {
  lng: number;
  lat: number;
}

/** Builds a strictly-increasing `line-gradient` stop list for a single
 * bright band traveling along the line at `center` (0..1). */
function pulseGradientExpression(center: number): unknown {
  const halfWidth = 0.05;
  const c = Math.min(1, Math.max(0, center));
  const lo = Math.max(0, c - halfWidth);
  const hi = Math.min(1, c + halfWidth);
  const raw: [number, string][] = [
    [0, PULSE_TRANSPARENT],
    [lo, PULSE_TRANSPARENT],
    [c, NATIVE_RED],
    [hi, PULSE_TRANSPARENT],
    [1, PULSE_TRANSPARENT],
  ];
  const stops: [number, string][] = [];
  for (const [pos, color] of raw) {
    if (stops.length === 0 || pos > stops[stops.length - 1][0]) {
      stops.push([pos, color]);
    } else {
      stops[stops.length - 1] = [pos, color];
    }
  }
  if (stops.length < 2) stops.push([1, PULSE_TRANSPARENT]);
  return ["interpolate", ["linear"], ["line-progress"], ...stops.flat()];
}

export const MapCanvas = forwardRef<MapCanvasHandle>(function MapCanvas(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const buildingLayerRef = useRef<BuildingLayer | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const readyRef = useRef(false);
  const [tokenMissing] = useState(() => !MAPBOX_TOKEN);
  const calibrate = useMemo(() => isCalibrateMode(), []);
  const debug = useMemo(() => isDebugMode(), []);
  const [clicked, setClicked] = useState<ClickedCoord | null>(null);
  const [copied, setCopied] = useState(false);

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      const map = mapRef.current;
      if (!map || !readyRef.current || calibrate) return;

      const camera = interpolateCamera(progress, CAMERA_KEYFRAMES);
      map.jumpTo({
        center: camera.center as [number, number],
        zoom: camera.zoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
      });

      // In debug mode the plot outline/fill stay at their verification
      // baseline (set once on load) rather than following the scroll
      // reveal, and the surroundings are never dimmed, so the overlays
      // stay legible however far the page is scrolled.
      if (!debug) {
        const dimT = windowProgress(progress, SCENE_WINDOWS.siteApproach.window);
        if (map.getLayer(SITE_DIM_MASK_LAYER_ID)) {
          map.setPaintProperty(SITE_DIM_MASK_LAYER_ID, "fill-opacity", dimT * 0.38);
        }

        const drawT = windowProgress(progress, SCENE_WINDOWS.plotBoundary.window);
        const outlineT = Math.min(1, drawT / 0.6);
        const pulseT = Math.max(0, Math.min(1, (drawT - 0.6) / 0.4));

        if (map.getLayer(SITE_LINE_LAYER_ID)) {
          map.setPaintProperty(SITE_LINE_LAYER_ID, "line-opacity", outlineT);
          map.setPaintProperty(SITE_LINE_LAYER_ID, "line-width", 1.5 + outlineT * 1.5);
        }
        if (map.getLayer(SITE_FILL_LAYER_ID)) {
          map.setPaintProperty(SITE_FILL_LAYER_ID, "fill-opacity", outlineT * 0.08);
        }
        if (map.getLayer(SITE_PULSE_LAYER_ID)) {
          if (pulseT <= 0 || pulseT >= 1) {
            map.setPaintProperty(SITE_PULSE_LAYER_ID, "line-opacity", 0);
          } else {
            map.setPaintProperty(SITE_PULSE_LAYER_ID, "line-opacity", 1);
            // line-gradient's typed expression shape isn't worth fighting here.
            map.setPaintProperty(SITE_PULSE_LAYER_ID, "line-gradient", pulseGradientExpression(pulseT) as never);
          }
        }
      }

      buildingLayerRef.current?.setProgress(progress);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Calibration mode opens on a clean top-down view of the current
    // anchor so clicks can be judged precisely against the imagery.
    const initial = calibrate
      ? { center: NATIVE_HAUS_SITE as [number, number], zoom: 17.5, pitch: 0, bearing: 0 }
      : interpolateCamera(0, CAMERA_KEYFRAMES);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      projection: "globe",
      center: initial.center as [number, number],
      zoom: initial.zoom,
      pitch: initial.pitch,
      bearing: initial.bearing,
      attributionControl: true,
      interactive: calibrate,
      scrollZoom: calibrate,
      dragPan: calibrate,
      dragRotate: calibrate,
      doubleClickZoom: calibrate,
      boxZoom: calibrate,
      keyboard: calibrate,
      touchZoomRotate: calibrate,
      touchPitch: calibrate,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      // Defensive: satellite-v9 ships no label layers, but hide any
      // symbol layers if the style is ever swapped for one that does.
      // Also locate the raster (satellite imagery) layer(s) to apply the
      // cinematic color grade directly at the Mapbox level — this only
      // touches the environment, never the Three.js building it's
      // rendered underneath.
      const layers = map.getStyle()?.layers ?? [];
      for (const layer of layers) {
        if (layer.type === "symbol") {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
        if (layer.type === "raster") {
          map.setPaintProperty(layer.id, "raster-saturation", -0.32);
          map.setPaintProperty(layer.id, "raster-contrast", 0.22);
          map.setPaintProperty(layer.id, "raster-brightness-min", 0.02);
          map.setPaintProperty(layer.id, "raster-brightness-max", 0.88);
        }
      }

      map.setFog({
        color: "#0a1622",
        "high-color": "#0b1d33",
        "space-color": "#00020a",
        "horizon-blend": 0.15,
        "star-intensity": 0.25,
      });

      // Surrounding-JVT dim mask: a large box with the actual parcel cut
      // out as a hole, so the plot itself is never covered — it stays
      // "slightly brighter" than what's dimmed around it, automatically.
      map.addSource(SITE_DIM_MASK_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: SITE_DIM_MASK_RINGS },
        },
      });
      map.addLayer({
        id: SITE_DIM_MASK_LAYER_ID,
        type: "fill",
        source: SITE_DIM_MASK_SOURCE_ID,
        paint: { "fill-color": "#050a14", "fill-opacity": 0 },
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
        paint: { "fill-color": "#d7b98a", "fill-opacity": debug ? 0.06 : 0 },
      });

      map.addLayer({
        id: SITE_LINE_LAYER_ID,
        type: "line",
        source: SITE_SOURCE_ID,
        paint: {
          "line-color": "#f4e3bd",
          "line-width": debug ? 2 : 1.5,
          "line-opacity": debug ? 1 : 0,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      // Dedicated LineString source (needs lineMetrics for line-gradient)
      // that drives the single red pulse traveling once around the plot.
      map.addSource(SITE_PULSE_SOURCE_ID, {
        type: "geojson",
        lineMetrics: true,
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: SITE_PLOT_RING },
        },
      });
      map.addLayer({
        id: SITE_PULSE_LAYER_ID,
        type: "line",
        source: SITE_PULSE_SOURCE_ID,
        paint: {
          "line-width": 3,
          "line-opacity": 0,
          "line-gradient": pulseGradientExpression(0) as never,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      if (debug) {
        // ?debug=1 only — verification overlays, never shown to normal
        // visitors. Anchor dot at the confirmed geographic anchor, the
        // road-setback envelope, and the fitted building footprint.
        map.addSource(DEBUG_ANCHOR_SOURCE_ID, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: NATIVE_HAUS_SITE } },
        });
        map.addLayer({
          id: DEBUG_ANCHOR_LAYER_ID,
          type: "circle",
          source: DEBUG_ANCHOR_SOURCE_ID,
          paint: {
            "circle-radius": 6,
            "circle-color": NATIVE_RED,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.addSource(DEBUG_ENVELOPE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [SETBACK_ENVELOPE_RING] },
          },
        });
        map.addLayer({
          id: DEBUG_ENVELOPE_LAYER_ID,
          type: "line",
          source: DEBUG_ENVELOPE_SOURCE_ID,
          paint: { "line-color": "#38bdf8", "line-width": 1.5, "line-dasharray": [2, 2] },
        });

        map.addSource(DEBUG_FOOTPRINT_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [BUILDING_FOOTPRINT_RING] },
          },
        });
        map.addLayer({
          id: DEBUG_FOOTPRINT_LAYER_ID,
          type: "line",
          source: DEBUG_FOOTPRINT_SOURCE_ID,
          paint: { "line-color": "#a3e635", "line-width": 2 },
        });
      }

      const buildingModel = createProceduralBuilding();
      const buildingLayer = new BuildingLayer(BUILDING_LAYER_ID, BUILDING_ANCHOR, buildingModel, PLOT_ROTATION_DEG);
      buildingLayerRef.current = buildingLayer;
      map.addLayer(buildingLayer as unknown as mapboxgl.CustomLayerInterface);

      readyRef.current = true;

      if (calibrate) {
        map.on("click", (e) => {
          const { lng, lat } = e.lngLat;
          // eslint-disable-next-line no-console
          console.log("[calibrate] clicked coordinate:", [lng, lat]);
          setClicked({ lng, lat });
          setCopied(false);
          if (!markerRef.current) {
            markerRef.current = new mapboxgl.Marker({ color: NATIVE_RED }).setLngLat([lng, lat]).addTo(map);
          } else {
            markerRef.current.setLngLat([lng, lat]);
          }
        });
      }
    });

    return () => {
      readyRef.current = false;
      buildingLayerRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [calibrate, debug]);

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

  return (
    <>
      <div ref={containerRef} className="map-canvas" />
      {calibrate && (
        <div className="calibration-panel">
          <div className="calibration-panel__title">CALIBRATION MODE</div>
          <div className="calibration-panel__row">
            <span className="calibration-panel__label">ANCHOR</span>
            <span className="calibration-panel__value">
              [{NATIVE_HAUS_SITE[0].toFixed(6)}, {NATIVE_HAUS_SITE[1].toFixed(6)}]
            </span>
          </div>
          <div className="calibration-panel__row">
            <span className="calibration-panel__label">CLICKED</span>
            <span className="calibration-panel__value">
              {clicked ? `[${clicked.lng.toFixed(6)}, ${clicked.lat.toFixed(6)}]` : "click the map…"}
            </span>
          </div>
          <button
            type="button"
            className="calibration-panel__copy"
            disabled={!clicked}
            onClick={() => {
              if (!clicked) return;
              const text = `[${clicked.lng.toFixed(6)}, ${clicked.lat.toFixed(6)}]`;
              navigator.clipboard
                .writeText(text)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? "Copied" : "Copy coordinates"}
          </button>
          <div className="calibration-panel__hint">
            Pan/zoom freely, click the exact Native Haus plot. Logged to console on every click.
          </div>
        </div>
      )}
    </>
  );
});
