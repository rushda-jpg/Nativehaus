# Native Haus — Opening Scenes: Architecture Plan

Scope: Scene 1 (Arrival) and Scene 2 (The Site) only. One continuous,
scroll-driven camera move from orbital space down to a procedurally
constructed building mass on the Native Haus plot in Jumeirah Village
Triangle (JVT), Dubai. No cards, no navbars, no generic sections — a single
pinned WebGL stage.

## 1. High-level structure

```
<Experience>                          500vh scroll spacer + fixed stage
  <ScrollSpacer style={height: 500vh}/>
  <Stage>                             position: fixed, 100vw x 100vh, z-stacked
    <MapCanvas/>                      z-0  — Mapbox GL globe → satellite → JVT → site
      └ BuildingLayer (custom layer)  — Three.js scene rendered inside Mapbox's
                                         own GL context, geo-anchored on the plot
    <SceneTypography/>                z-10 — "THE SITE / NATIVE HAUS / JVT"
    <DebugHUD/>                       z-20 — progress + scene name
  </Stage>
</Experience>
```

`Stage` is `position: fixed; inset: 0`. It is never pinned by ScrollTrigger —
it doesn't need to be, since fixed positioning already keeps it in the
viewport for as long as the page has scrollable height. The `ScrollSpacer`
below it is the only thing that creates the 500vh of scroll distance;
nothing is ever rendered inside it.

### File layout

```
src/
  config/
    geo.ts          Lng/lat waypoints, site polygon, camera keyframes
    scenes.ts        Scroll progress boundaries (0–1) per scene/stage + names
  lib/
    math.ts           lerp/clamp/easing + piecewise camera interpolation
    useLenis.ts        Lenis <-> GSAP ticker <-> ScrollTrigger wiring
    useScrollProgress.ts  ScrollTrigger scrub over the spacer, imperative
                           onUpdate(progress) — no per-frame React state
  components/
    Experience.tsx     Spacer + Stage composition, owns the progress source
    Stage.tsx           Fixed viewport container
    MapCanvas.tsx        Mapbox init/lifecycle, camera-per-progress, site layer
    SceneTypography.tsx  Scene 2 text, GSAP-driven opacity/transform
    DebugHUD.tsx          Progress readout, DOM-mutated (not state-driven)
  three/
    BuildingLayer.ts     mapboxgl.CustomLayerInterface wrapping a THREE scene
    buildingBuilder.ts    Procedural G+6 mass, exposes setProgress(0..1)
```

## 2. Scroll timeline

One `ScrollTrigger` (`trigger: spacer`, `start: 'top top'`, `end: 'bottom bottom'`,
`scrub: true`, no pin) is the single source of truth. Its `onUpdate` hands a
`progress` float (0–1) to `Experience`, which forwards it imperatively (via
refs/callbacks, not `setState`) to `MapCanvas` and `BuildingLayer` every
frame. Lenis owns the actual smooth-scroll physics; GSAP's ticker drives
`lenis.raf()` and `lenis.on('scroll', ScrollTrigger.update)` keeps
ScrollTrigger in sync (the standard Lenis+GSAP recipe), with
`ScrollTrigger.config({ ignoreMobileResize: true })` and
`gsap.ticker.lagSmoothing(0)`.

`config/scenes.ts` defines named progress windows consumed by every
consumer (camera keyframes, typography, building stages, HUD label):

| Window | Range | Scene name (HUD) |
|---|---|---|
| Deep space | 0.00 – 0.12 | ARRIVAL — DEEP SPACE |
| Descent to Dubai | 0.12 – 0.30 | ARRIVAL — DESCENT TO DUBAI |
| Into JVT | 0.30 – 0.48 | ARRIVAL — JUMEIRAH VILLAGE TRIANGLE |
| JVT oblique settle | 0.48 – 0.55 | ARRIVAL — OBLIQUE AERIAL |
| Site approach | 0.55 – 0.64 | THE SITE — APPROACH |
| Plot boundary draw | 0.64 – 0.70 | THE SITE — BOUNDARY |
| Slab | 0.70 – 0.735 | THE SITE — SLAB |
| Ground floor | 0.735 – 0.77 | THE SITE — GROUND FLOOR |
| Floors rising | 0.77 – 0.85 | THE SITE — FLOORS RISING |
| Balcony bands | 0.85 – 0.885 | THE SITE — BALCONY BANDS |
| Façade fins | 0.885 – 0.92 | THE SITE — FAÇADE FINS |
| Glazing | 0.92 – 0.95 | THE SITE — GLAZING |
| Architectural lighting | 0.95 – 0.975 | THE SITE — LIGHTING |
| Landscaping | 0.975 – 1.00 | THE SITE — LANDSCAPE |

Every window is just a `[start, end]` pair; a helper `windowProgress(p, [a,b])`
returns the clamped, re-normalized 0–1 local progress used by whichever
system owns that phase. Adding/resizing a phase later is a one-line change
in `scenes.ts` — nothing downstream needs to know about absolute page
scroll positions.

## 3. Mapbox camera strategy

* Style: `mapbox://styles/mapbox/satellite-v9` — pure satellite imagery with
  no vector/label layers at all, so there is nothing to strip. (Defensively,
  `MapCanvas` still walks `map.getStyle().layers` on load and hides any
  `symbol` type layers, in case the style is ever swapped for one that has
  them.)
* Projection: `map.setProjection('globe')`.
* Atmosphere: `map.setFog({ color: '#0a1622', 'high-color': '#0b1d33',
  'space-color': '#000208', 'star-intensity': 0.2, 'horizon-blend': 0.15 })`
  — this is what produces the dark navy space + restrained stars + glow;
  the map container background is set to `#000` so first paint isn't white.
* All built-in interaction handlers are disabled (`scrollZoom`, `dragPan`,
  `dragRotate`, `doubleClickZoom`, `boxZoom`, `keyboard`,
  `touchZoomRotate`) and no controls (`NavigationControl`,
  `GeolocateControl`, etc.) are added — the page scroll is the only camera
  input. The Mapbox attribution control is kept (required by Mapbox ToS)
  but styled to a small, unobtrusive corner mark.
* Camera path: `config/geo.ts` defines an ordered list of keyframes,
  each `{ progress, center: [lng, lat], zoom, pitch, bearing }`, spanning
  every window above. `MapCanvas` interpolates piecewise-linearly between
  the two keyframes bracketing the current progress and calls
  `map.jumpTo({ center, zoom, pitch, bearing })` every frame.
  `jumpTo` (not `flyTo`/`easeTo`) is used deliberately: those methods run
  their own internal animation clock, which fights a scroll-scrubbed
  camera. `jumpTo` is synchronous and lets scroll position map 1:1 to
  camera state, which is what makes the motion feel continuous and
  "scrubbable" (including backwards on scroll-up) rather than
  section-triggered.
* Key waypoints (approximate, WGS84):
  * Deep space: centered high above the Gulf, `zoom ≈ 0.4`, `pitch 0`.
  * Dubai approach: `[55.27, 25.20]` (Dubai coastline), `zoom ≈ 9`.
  * JVT arrival: `[55.199, 25.049]`, `zoom ≈ 15.6`, `pitch 60`, bearing
    rotated so Al Khail Road (E44), which bounds JVT to the east, reads on
    the right/east side of frame — this is the required "oblique aerial
    with E44 visible to the east" end state for Scene 1.
  * Site approach/final: `[55.2012, 25.0479]` (the plot, east edge of JVT
    near Sunmarke School and E44), `zoom ≈ 17.6 → 18.4`, `pitch ≈ 62`.
* Scene 2 dimming: a full-viewport `<div>` above the map (`SceneTypography`'s
  own backdrop) fades its `background: rgba(3,6,12,alpha)` in via GSAP as
  `windowProgress` moves through the site-approach window — cheap, and
  keeps the darkening independent of map paint layers.
* Plot polygon: a `GeoJSON` `Polygon` source + `fill` + `line` layer added
  once on map load (opacity/line width start at 0). During the "Plot
  boundary draw" window its `line-width`/`line-opacity`/`fill-opacity`
  paint properties are tweened by GSAP, plus the line layer's line-dasharray
  offset is animated to read as a sweeping/drawing stroke rather than a
  flat fade-in.

## 4. Building geometry: procedural now, GLB-ready later

`BuildingLayer.ts` implements `mapboxgl.CustomLayerInterface`
(`id`, `type: 'custom'`, `renderingMode: '3d'`). On `onAdd(map, gl)` it
creates a `THREE.Scene`, a `THREE.PerspectiveCamera`, and a
`THREE.WebGLRenderer` constructed **against Mapbox's own canvas and GL
context** (`{ canvas: map.getCanvas(), context: gl, antialias: true }`,
`autoClear: false`). On every `render(gl, matrix)` call from Mapbox, it
rebuilds the camera's projection matrix from the supplied matrix combined
with a model transform derived from
`mapboxgl.MercatorCoordinate.fromLngLat(siteCenter, 0)` (translation +
`meterInMercatorCoordinateUnits()` scale). This is the standard
"three.js model anchored to a real-world coordinate inside Mapbox GL"
pattern — it means the building's camera is *always* exactly Mapbox's
camera, with zero custom sync code and zero drift, for the life of the
layer.

The layer never builds geometry itself. It holds one object with a fixed
shape:

```ts
interface BuildingModel {
  object3D: THREE.Object3D;      // what BuildingLayer adds to its scene
  setProgress(progress: number): void; // the SAME overall 0..1 scroll progress
  dispose(): void;
}
```

`setProgress` deliberately takes the raw overall scroll progress, not a
pre-renormalized "building-local" value — every implementation resolves
its own construction phases from it using the same `windowProgress` +
`SCENE_WINDOWS` helpers the scroll engine and camera already use. That
keeps the contract to a single number with one meaning everywhere, and
means a future GLB implementation stays free to interpret timing however
its authored clip needs (e.g. `windowProgress(progress, BUILDING_WINDOW)`
before scrubbing `mixer`), without the interface itself changing.

`buildingBuilder.ts` exports `createProceduralBuilding(): BuildingModel`,
today's implementation:

* Geometry is grouped by construction phase (`slab`, `groundFloor`,
  `floors[0..5]`, `balconyBands[0..5]`, `fins[]`, `glazingPanels[]`,
  `lights[]`, `landscaping[]`), each a `THREE.Group` positioned at its
  final resting transform from the start.
* `setProgress` maps the incoming 0–1 into the 8 local phase windows
  (same `windowProgress` helper as the scroll timeline) and drives, per
  phase, a **scale-from-base** grow (`scale.y` 0→1 on geometry authored
  with its pivot at y=0, so each slab/floor/fin visibly extrudes upward
  or outward rather than cross-fading), plus emissive/point-light
  intensity ramps for the lighting phase. Nothing is animated by opacity
  alone except the glazing's final "settle" polish, layered on top of its
  own scale grow.

Because every consumer of the building — `BuildingLayer`, the scroll
timeline, `DebugHUD` — only ever talks to the `BuildingModel` interface
(`object3D` + `setProgress`), swapping the temporary procedural mass for
the real GLB later is isolated to one new file:

```ts
// three/buildingBuilder.gltf.ts (future)
export async function createGLBBuilding(url: string): Promise<BuildingModel> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations[0]; // authored "construction" clip
  const action = mixer.clipAction(clip).play();
  action.paused = true;
  return {
    object3D: gltf.scene,
    setProgress(p) {
      const local = windowProgress(p, BUILDING_WINDOW); // same helper, same constant
      mixer.setTime(local * clip.duration);
    },
    dispose() { mixer.stopAllAction(); },
  };
}
```

`BuildingLayer.ts` changes by exactly one line (which factory it calls);
`MapCanvas`, the scroll engine, `config/scenes.ts` and every other file are
untouched. If the GLB has no baked animation, `setProgress` can instead
drive per-mesh visibility/scale keyed by mesh name, using the same
phase-window approach already proven by the procedural version.

## 5. Debug HUD

`DebugHUD` is a fixed-position overlay (top-left) rendered once. It is
handed the same `progress` value as the map/building, but never re-renders
React on scroll: it holds a `ref` to its text nodes and mutates
`textContent` directly inside the shared `onUpdate` callback
(`0.00–1.00` formatted progress, plus the current scene name resolved from
`config/scenes.ts`). A `?debug=0` query param / exported `DEBUG_HUD`
constant toggles it off later without touching the animation code.

## 6. Performance notes

* Single `requestAnimationFrame`-driven update path (GSAP ticker → Lenis →
  ScrollTrigger → one `onUpdate` → Mapbox `jumpTo` + `BuildingModel.setProgress`);
  no redundant rAF loops.
* No React state updates on scroll — React renders once; everything after
  is imperative canvas/DOM mutation, keeping the JS thread free for
  Mapbox + Three.js paint work.
* Three.js renderer shares Mapbox's WebGL context and canvas (no second
  canvas, no extra compositing layer).
* `three/buildingBuilder.ts` builds all geometry once up front (hidden via
  `scale`/`visible`, not created/destroyed per frame).
