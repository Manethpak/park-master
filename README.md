# Park Master — The Courtyard

A desktop parking puzzle built with React, TypeScript, and PlayCanvas. Drive through a narrow courtyard entrance, negotiate the bend, and reverse into the green bay between two parked cars.

## Run locally

Requires Node.js 22.23.2 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:5173 in a browser with WebGL2 support. Click **Let’s park** to enter the level. The 90-second countdown starts when the car first moves; waiting or steering while stationary keeps the initial time and score.

## Controls and rules

| Input    | Action                                                         |
| -------- | -------------------------------------------------------------- |
| W / Up   | Accelerate forward; brake first when reversing                 |
| S / Down | Brake, then reverse                                            |
| Mouse    | Move up to 240 pixels left/right of canvas center to steer      |
| Space    | Brake                                                          |
| Escape   | Pause / resume                                                 |
| R        | Restart the attempt and restore all movable props              |

Center the mouse to straighten the wheels. Full steering lock takes only 240 pixels from center, regardless of screen width. Reversing changes the direction the car turns, as it does with a steering wheel. Steering alone does not move or rotate the car. Once the car moves, the countdown continues during stops until you park, pause, or run out of time.

Park the whole car inside the highlighted bay, facing its arrow within 10 degrees, and remain below 0.15 m/s for one continuous second. The timer stops on success. Running out of time ends the attempt with zero points.

The score is `max(0, round(1000 × remainingSeconds / 90) − 50 × impacts)`. A continuous contact costs one penalty; separating and hitting the same obstacle again costs another. Parked vehicles, signs, curbs, and fences are fixed. Cones and boxes can move and topple. Losing window focus pauses the game and clears held inputs.

## Implementation and tuning

- `src/game/level.ts`: level definition, spawn, target bay, time limit, penalty, and model placement.
- `src/game/assets.ts`: measured model bounds, uniform scales, pivot compensation, and asset URLs. The sedan is 4.2 metres long. Models face +Z; the camera follows at a fixed world orientation.
- `src/game/driving.ts`: forward/reverse speed caps, acceleration, braking, steering, and grip tuning.
- `src/game/runtime.ts`: Engine update loop, input, actual rigid-body velocity, wheel animation, collision events, reset, and camera follow. Countdown time uses elapsed wall time and excludes pauses.
- `src/game/session.ts` and `rules.ts`: gameplay state, parking geometry, scoring, and contact tracking. React subscribes to HUD snapshots rather than rendering every simulation frame.
- `src/game/Scene.tsx`: React-owned scene entities, model loading, simple measured colliders, lighting, surfaces, and parking markings. PlayCanvas React loads the installed `sync-ammo` peer through `usePhysics`.

The original models under `src/assets` are retained. Only the selected GLBs and each pack’s `Textures/colormap.png` are copied under `public/assets/kenney`; the relative texture paths must stay intact. No model compression decoder is needed for these assets. Missing resources show a retry screen, with a 25-second startup timeout for stalled initialization.

This prototype has one level and one player sedan. The level configuration and game runtime can be reused for later challenges. Mobile input, moving traffic, vehicle selection, progression, and online scores are outside this version.

Models are supplied Kenney assets: [Car Kit](https://kenney.nl/assets/car-kit), [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads), and [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban).

## Verification

The project’s default validation is **automated E2E tests only**. Agents must skip manual browser checks, exploratory play-testing, screenshot reviews, and ad hoc browser automation. Playwright running Chrome as part of the E2E suite is permitted. See [AGENTS.md](AGENTS.md) for the persistent agent instructions.

```sh
pnpm test:e2e     # Chrome: models, controls, physics, parking, reset, pause, timeout, errors
```

The suite lives in `tests/game.spec.ts` and is configured in `playwright.config.ts`. It checks asset loading and runtime errors, forward/reverse handling and wheel animation, mouse steering, solid collisions and distinct impacts, movable props and full restart, reverse parking, pause/focus loss, timeout, and loading failures. Add or update E2E assertions when changing those behaviors.

E2E tests use a separate Vite server on port 5174. They default to Chrome at `/usr/bin/google-chrome`; set `CHROME_PATH` to your Chrome executable on another system. The tests enable `VITE_E2E=true` to expose inspection and positioning helpers in the development build. That interface is absent from production. Playwright retains traces on failure; generated reports and results are ignored by version control.

These additional commands remain available when explicitly requested; they are outside the default E2E-only validation workflow:

```sh
pnpm test         # Rules, sessions, scoring, contacts, and handling at 30/60/120 FPS
pnpm typecheck
pnpm lint
pnpm fmt
pnpm build
pnpm start       # Preview the production build
```

The production output is a static site in `dist/`, including the model palette textures. The Engine and physics library produce large bundle chunks; their build size warnings are expected for this prototype.

## Map builder

Click **Map builder** in the game header to open the level workshop. Start from the supplied courtyard or choose **New map**. The builder uses a top-down drafting view; **Test drive** opens the same 3D scene and physics used by the game.

- Pick a road, prop, ground surface, spawn, or bay from the palette, then click the grid to place it. Road centres snap to a fixed 5-metre grid and rotate in 90-degree steps. Prop snapping defaults to 0.25 metres and can be changed or disabled.
- Use **Select & move** to drag items. The inspector also edits coordinates, headings, surface dimensions, collider settings, prop mass, and parking-bay dimensions. **Scene item** selects objects that overlap or are outside the current view.
- Press **R** to rotate, **Delete** to remove, arrow keys to nudge, or **Ctrl/Cmd + D** to duplicate. Use **Ctrl/Cmd + Z** to undo and **Ctrl/Cmd + Shift + Z** to redo. New maps and imports are undoable too. Spawn and target are unique markers; move them rather than deleting them.
- **Alt + drag**, middle drag, or right drag pans the map. Use the zoom buttons or **Fit map** to frame it. Increasing X moves right; increasing Z moves down in the drafting view. A heading of zero faces +Z, and a positive heading turns toward +X.
- Drafts save automatically in this browser on this device. **Export JSON** downloads a portable level file; **Import JSON** validates a file before replacing the draft. Export files to keep backups or share maps. Local saving is not a server upload or a write to the repository.
- **Test drive** creates a fresh session from a copy of the draft. Click **Let’s park** to drive, and **Back to builder** to edit again. Physics movement, restart, and scoring never change the authored draft. Every attempt retains the 90-second timer, 50-point impact penalty, and existing parking rules.

The supplied level lives in `src/game/levels/courtyard.json`. `src/game/maps.ts` validates versioned map files and resolves road cells into world positions, calibrated visuals, and flat supporting colliders. `src/game/level.ts` loads the default map; `src/editor/` owns the drafting tools and history. Floors, curbs, islands, decoration, parked vehicles, spawn, and parking markings all come from level data. Asset dimensions, scales, and grounding stay in `src/game/assets.ts`.

Map files use `schemaVersion: 1`, with `id`, `name`, `timeLimit: 90`, `impactPenalty: 50`, `grid`, `roads`, `objects`, `surfaces`, `spawn`, `bay`, and `parkingBays`. Road cells are integer `[column, row]` pairs: `x = origin[0] + column × 5`, `z = origin[1] + row × 5`. A cell holds one road tile. Supported road assets are `road`, `roadBend`, `roadIntersection`, and `roadCrossroad`; rotations are 0, 90, 180, or 270 degrees. Props use metre-based `[x, y, z]` positions. Supporting surfaces are solid floor colliders excluded from impact penalties; solid curbs remain obstacles. `bay` is the target, while `parkingBays` contains decorative bays with optional wheel stops.

Imports reject unsupported versions/assets, duplicate or reserved object IDs, overlapping road cells, invalid coordinates/dimensions, and target bays smaller than the car. Files are limited to 2 MB and 2,000 authored items. Road connection notes flag neighboring tiles with incompatible lane openings; they are advisory and do not prove a level is driveable. The first version edits flat levels with the supplied asset catalog; YAML, custom asset uploads, terrain, and automatic route generation are deferred.
