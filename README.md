# Native Haus — Opening Scenes

A scroll-driven, cinematic WebGL property experience for Native Haus in
Jumeirah Village Triangle (JVT), Dubai. This build contains only the first
two scenes — Arrival and The Site — for approval before the rest of the
experience is built.

See [`PLAN.md`](./PLAN.md) for the full architecture: component structure,
the scroll timeline, the Mapbox camera strategy, and how the temporary
procedural building will later be swapped for a real GLB model.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in a real Mapbox token
npm run dev
```

You need a [Mapbox access token](https://account.mapbox.com/access-tokens/)
in `.env.local` as `VITE_MAPBOX_TOKEN` — the map won't load without one.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck and build for production
- `npm run lint` — run oxlint
- `npm run preview` — preview the production build locally

## What to look at

- Scroll through the full page (≈500vh) to play the Arrival → Site →
  construction sequence.
- The top-left HUD shows live scroll progress (0.00–1.00) and the current
  scene name — set `DEBUG_HUD_ENABLED` in `src/components/DebugHUD.tsx` to
  `false` to hide it later.
- `src/config/scenes.ts` is the single place that defines every scene's
  scroll-progress window, if timing needs adjusting.
