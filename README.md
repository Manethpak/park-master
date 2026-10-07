# Park Master — The Courtyard

A desktop parking puzzle built with React, TypeScript, and PlayCanvas. Drive through a narrow courtyard entrance, negotiate the bend, and reverse into the green bay between two parked cars.

## Run locally

Requires Node.js 22.23.2 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:5173 in a browser with WebGL2 support. The main menu offers **Play campaign** or **Map builder**. Choose a campaign level, click **Start level**, then **Let’s park**. The 90-second countdown starts when the car first moves; waiting or steering while stationary keeps the initial time and score.

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

The supplied courtyard uses a player sedan. Custom maps can choose a sedan, SUV, or taxi. Mobile input, moving traffic, progression, and online scores are outside this version.

Models are supplied Kenney assets: [Car Kit](https://kenney.nl/assets/car-kit), [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads), and [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban).

## Campaign and records

The title screen is a game menu, not a landing page. **Play campaign** opens a level selector with a map preview, personal best, and earned stars. All supplied levels are selectable; there are no progression locks. Currently the campaign contains **The Courtyard**. Arrow keys browse levels, Enter activates the focused control, and Escape returns from level selection to the main menu.

Stars use the existing final score; driving, parking, timers, and penalties are unchanged:

| Result | Stars |
| ------ | ----- |
| Incomplete or timeout | 0 |
| Park successfully, below 500 points (including zero after penalties) | 1 |
| Park successfully, 500–799 points | 2 |
| Park successfully, 800–1000 points | 3 |

Successful campaign attempts save the highest score for each level in this browser, under `park-master.campaign-progress.v1`. Lower-scoring replays and timeouts never reduce records. Stars on level selection reflect the best score; result-screen stars reflect the current attempt. Progress is local, not an online leaderboard. If saving is unavailable, the menu explains that records last only for the session. Changing a level's authored content invalidates its old record so scores from different layouts are not mixed.

**Level select** is available during campaign play and inside pause, result, and error overlays. Completing a level offers **Next level** when another authored level exists. **Map builder** is an independent sandbox; its drafts and Test drive scores never create campaign levels or records. Builder **Main menu** returns to mode selection without deleting the draft. JSON export/import remains available for sharing files; a community library is not implemented yet.

### Adding authored campaign levels

Use the builder to author and test a map, then **Export JSON**. As the game developer, add that exported file to `src/game/levels/`, with a unique level `id` and a clear `name`. The game discovers JSON files in that directory automatically; `courtyard.json` is first, then other filenames sort alphabetically. Numbered filenames such as `02-alley.json` and `03-depot.json` set the order of additional levels. No promote/publish control exists in the user-facing builder, and local drafts are never automatically added to the campaign. Committing and deploying the authored files distributes those levels with the game.

## Verification

The project’s default validation is **automated E2E tests only**. Agents must skip manual browser checks, exploratory play-testing, screenshot reviews, and ad hoc browser automation. Playwright running Chrome as part of the E2E suite is permitted. See [AGENTS.md](AGENTS.md) for the persistent agent instructions.

```sh
pnpm test:e2e     # Chrome: models, controls, physics, parking, reset, pause, timeout, errors
```

The suite lives in `tests/game.spec.ts` and is configured in `playwright.config.ts`. It checks menu navigation, campaign scores and star thresholds, record persistence and storage failures, sandbox isolation, builder tools, asset loading and runtime errors, forward/reverse handling and wheel animation, mouse steering, solid collisions and distinct impacts, movable props and full restart, reverse parking, pause/focus loss, timeout, and loading failures. Add or update E2E assertions when changing those behaviors.

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

Choose **Map builder** from the main menu to open the level workshop. Start from the supplied courtyard or choose **New map**. The builder uses a top-down drafting view; **Test drive** opens the same 3D scene and physics used by the game.

- Pick a road, prop, ground surface, spawn, or bay from the palette, then click the grid to place it. Road centres snap to a fixed 5-metre grid and rotate in 90-degree steps. Prop snapping defaults to 0.25 metres and can be changed or disabled.
- Use **Select & move** to drag items. The inspector also edits coordinates, headings, surface dimensions, collider settings, prop mass, and parking-bay dimensions. **Scene item** selects objects that overlap or are outside the current view.
- The searchable asset library groups roads, gameplay markers, vehicles, buildings, nature, props, and ground surfaces. Model cards use the supplied preview photos and show their calibrated footprint.
- **Right-click an item** for Select, Duplicate, Duplicate & place, Rotate 90°, Focus, and Delete. Duplicate & place follows the cursor until you click; Escape cancels. Spawn and target cannot be duplicated or deleted.
- Drag the selected item's circular handle to rotate around its centre. Roads remain locked to quarter turns; other items snap to 15° (1° with snapping off). Corner handles resize surfaces, bays, and the playable zone around the opposite corner. Props keep their default model size and cannot be stretched. A completed gesture is one undo step; Escape cancels without saving it.
- **Lock in editor** prevents edits; **Hide in editor only** removes an item from the drafting view, not from Test drive or exported files. The ground starts locked. The expandable **Scene list** provides focus, lock, and hide controls. These visibility and lock settings last for the current editor session and reset on a new map or import.
- Press **R** to rotate, **Delete** to remove, arrow keys to nudge, or **Ctrl/Cmd + D** to duplicate. Use **Ctrl/Cmd + Z** to undo and **Ctrl/Cmd + Shift + Z** to redo. New maps and imports are undoable too. Spawn and target are unique markers; move them rather than deleting them.
- **Alt + drag** or middle drag pans the map. Right-click opens object actions. Use the zoom buttons or **Fit map** to frame it. Increasing X moves right; increasing Z moves down in the drafting view. A heading of zero faces +Z, and a positive heading turns toward +X.
- Choose **Player vehicle** in map settings. Each model uses its calibrated body dimensions, wheelbase, and parking footprint. If the target is too small, resize it before choosing the larger car; the builder never silently enlarges the bay.
- **Add playable zone** creates a rectangular boundary. Move it and resize its corners, or enter exact dimensions in the inspector. Test drive adds visible solid perimeter barriers, with normal collision penalties. The full spawn footprint and target bay must fit inside before Test drive is enabled. The validation panel links relevant issues to their items; scenery outside the zone is advisory. Old maps without a zone retain their existing behavior.
- Drafts save automatically in this browser on this device. **Export JSON** downloads a portable level file; **Import JSON** validates a file before replacing the draft. Export files to keep backups or share maps. Local saving is not a server upload or a write to the repository.
- **Test drive** creates a fresh session from a copy of the draft. Click **Let’s park** to drive, and **Back to builder** to edit again. Physics movement, restart, and scoring never change the authored draft. Every attempt retains the 90-second timer, 50-point impact penalty, and existing parking rules.

The supplied level lives in `src/game/levels/courtyard.json`. `src/game/maps.ts` validates versioned map files and resolves road cells into world positions, calibrated visuals, and flat supporting colliders. `src/game/level.ts` loads the default map; `src/editor/` owns the drafting tools and history. Floors, curbs, islands, decoration, parked vehicles, spawn, and parking markings all come from level data. Asset dimensions, scales, and grounding stay in `src/game/assets.ts`.

Map files use `schemaVersion: 1`, with `id`, `name`, `timeLimit: 90`, `impactPenalty: 50`, `grid`, `roads`, `objects`, `surfaces`, `spawn`, `bay`, and `parkingBays`. Optional `playerVehicle` is `sedan`, `suv`, or `taxi` (default sedan); optional `playableZone` has metre-based `x`, `z`, `width`, and `length` (dimensions 5–500 metres). Existing v1 maps remain compatible. Road cells are integer `[column, row]` pairs: `x = origin[0] + column × 5`, `z = origin[1] + row × 5`. A cell holds one road tile. Supported road assets are `road`, `roadBend`, `roadIntersection`, and `roadCrossroad`; rotations are 0, 90, 180, or 270 degrees. Props use metre-based `[x, y, z]` positions. Supporting surfaces are solid floor colliders excluded from impact penalties; solid curbs remain obstacles. `bay` is the target, while `parkingBays` contains decorative bays with optional wheel stops.

Imports reject unsupported versions/assets, duplicate or reserved object IDs, overlapping road cells, invalid coordinates/dimensions, and target bays smaller than the car. Files are limited to 2 MB and 2,000 authored items. Road connection notes flag neighboring tiles with incompatible lane openings; they are advisory and do not prove a level is driveable. The first version edits flat levels with the supplied asset catalog; YAML, custom asset uploads, terrain, and automatic route generation are deferred.
