# Park Master — The Courtyard

A desktop and mobile parking puzzle built with React, TypeScript, and PlayCanvas. Drive through a narrow courtyard entrance, negotiate the bend, and reverse into the green bay between two parked cars.

## Run locally

Requires Node.js 22.23.2 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:5173 in a browser with WebGL2 support. The main menu offers **Play campaign** or **Map builder**. Choose a campaign level, click **Start level**, then **Start**. The 90-second countdown starts when the car first moves; waiting or steering while stationary keeps the initial time and score.

## Controls and rules

At viewport widths of 1024px or less (or on devices with a coarse touch pointer), the game shows **Accelerate**, **Reverse**, **Stop**, and left/right steering buttons. Hold buttons to control the car; steering and a pedal can be held together. Releasing or cancelling a touch clears that input, and pause, restart, or focus loss clears all held controls. Both portrait and landscape support play; rotating clears held inputs without pausing. Mobile driving tips appear once, then stay hidden after dismissal or starting. **Settings** pauses active play and contains **Help**, **Restart**, **Fullscreen**, and **Level select** (or **Back to builder** in a test drive). Help reopens tips; **Resume** returns to driving. Tip dismissal is saved locally when storage is available. Fullscreen optionally attempts a landscape orientation lock where supported, but is not required. Mobile gameplay shows only time/score, Settings and Pause, parking feedback, and touch controls—no logo or secondary navigation buttons. Opening the builder on mobile, including direct links, shows an **Open on desktop** notice instead of editing tools; existing drafts are preserved.

`src/ui/GameMenu.tsx` chooses independent `MobileGameMenu` and `DesktopGameMenu` components using the same screen-size/touch detection as gameplay. Mobile owns its layout and styles in `mobile-menu.css`: compact header filter, two-column portrait / three-column landscape grids, and one-tap play with no map preview or separate launch panel. Unlocked tiles start the attempt once loading finishes; locked tiles remain visible but disabled. Desktop retains selection, map previews and a separate launch action. Campaign rules and records are shared, not duplicated.

`src/ui/GameHud.tsx` similarly selects independent `MobileHud` and `DesktopHud` components. Mobile presentation lives in `mobile-hud.css`, with touch controls in `mobile-controls.css`; it does not render a desktop HUD and hide pieces with media queries. The wrapper shares the session subscription, input clearing, tips persistence and settings behavior. `GameSettings` provides the paused menu with keyboard focus containment and Escape-to-resume on both devices. Desktop retains its scoreboard, steering instruments, route briefing and keyboard controls.

| Input    | Action                                                         |
| -------- | -------------------------------------------------------------- |
| W / Up   | Accelerate forward; brake first when reversing                 |
| S / Down | Brake, then reverse                                            |
| A/D or Left/Right | Steer in Buttons mode                                 |
| Mouse    | Precise mode: move up to 240 pixels left/right of canvas center |
| Space    | Brake                                                          |
| Escape   | Pause / resume                                                 |
| R        | Restart the attempt and restore all movable props              |

**Settings → Steering** switches between **Buttons** (A/D or Left/Right arrow keys on desktop, left/right touch buttons on mobile) and **Precise steering** (mouse on desktop, a touch slider on mobile). The choice is saved locally when storage is available. Defaults are Precise steering on desktop and Buttons on mobile. Pedals and braking are unchanged. Buttons return steering to center when released; the slider also centers on release or cancellation. Pause, restart, focus loss, and mobile rotation clear held inputs.

In Precise steering, center the mouse to straighten the wheels. Full steering lock takes only 240 pixels from center, regardless of screen width. Reversing changes the direction the car turns, as it does with a steering wheel. Steering alone does not move or rotate the car. Once the car moves, the countdown continues during stops until you park, pause, or run out of time.

Park the whole car inside the highlighted bay, facing its arrow within 10 degrees, and remain below 0.15 m/s for one continuous second. The timer stops on success. Running out of time ends the attempt with zero points.

A large parking meter appears in a fixed HUD position as soon as any part of the car's footprint overlaps the target bay: above the driving controls on desktop and portrait mobile, or in the upper-left HUD on landscape mobile to keep the centre clear. It stays steady while the car and camera move, guides containment, alignment, and braking, and fills only when all parking conditions are satisfied. Leaving the bay hides the meter and resets the hold. Mobile level tiles launch directly from a scrollable grid, and result popups keep replay and return actions accessible on small screens.

The score is `max(0, round(1000 × remainingSeconds / timeLimit) − accumulatedImpactPoints)`. The courtyard uses a 90-second limit. By default, small objects (cones and boxes) cost 10 points per bump; hard obstacles (vehicles, signs, curbs, fences, and boundary barriers) cost 25 points per hit. Custom maps save their own time limit and penalties. A continuous contact costs one penalty; separating and hitting the same obstacle again costs another. Parked vehicles, signs, curbs, and fences are fixed. Cones and boxes can move and topple. Losing window focus pauses the game and clears held inputs.

## Implementation and tuning

- `src/game/level.ts`: level definition, spawn, target bay, time limit, penalty, and model placement.
- `src/game/assets.ts`: shared asset catalog with labels, builder categories, physics defaults, impact classes, measured model bounds, uniform scales, pivot compensation, and asset URLs. The sedan is 4.2 metres long. Models face +Z; the camera follows at a fixed world orientation.
- `src/game/driving.ts`: forward/reverse speed caps, acceleration, braking, steering, and grip tuning.
- `src/game/runtime.ts`: Engine update loop, input, actual rigid-body velocity, wheel animation, collision events, reset, and camera follow. Countdown time uses elapsed wall time and excludes pauses.
- `src/game/session.ts` and `rules.ts`: gameplay state, parking geometry, scoring, and contact tracking. React subscribes to HUD snapshots rather than rendering every simulation frame.
- `src/game/Scene.tsx`: React-owned scene entities, model loading, simple measured colliders, lighting, surfaces, and parking markings. PlayCanvas React loads the installed `sync-ammo` peer through `usePhysics`.

`public/assets/kenney` holds the single canonical copy of catalogued GLBs, their preview PNGs, and each pack’s `Textures/colormap.png`; the relative texture paths must stay intact. The duplicate source library and excluded models were removed to reduce project size. Gameplay loads only the selected player vehicle and the distinct models used by the current map, not the entire catalog. No model compression decoder is needed for these assets. Missing required resources show a retry screen, with a 25-second startup timeout for stalled initialization.

The supplied courtyard uses a player sedan. Custom maps can choose a sedan, SUV, taxi, sports hatchback, sports sedan, van, or pickup. All seven are also available as parked obstacles in the builder. The sports hatchback is calibrated to 3.9 metres long; the van and pickup offer larger parking footprints. Moving traffic, community level discovery, and online scores are outside this version.

Models are supplied Kenney assets: [Car Kit](https://kenney.nl/assets/car-kit), [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads), and [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban).

### Onboarding unused objects

The builder now includes House A, C, D, F, and G plus a Garden planter. Houses and the planter are fixed obstacles with the normal hard-impact penalty. Existing campaign maps are unchanged; choose these objects from the builder to use them in new maps. The original trees remain non-colliding decoration.

Street furniture adds stop and street signs, a bare sign post, six streetlight variants, a traffic light, dumpster, and construction barrier, cone, fence, and light. These appear under **Props & barriers**. The construction cone moves and uses the small-impact penalty; the other additions are fixed hard-impact obstacles. Streetlights use narrow pole colliders rather than blocking the whole footprint of their overhead arms. Lights are decorative, with no signal cycling or additional illumination. Hanging/highway signs are also available with compound colliders; loose component parts are excluded from scope. `ASSET-IMPLEMENTATION.tmp.md` tracks all 124 retained models (implemented), the 61 excluded models, and validation results.

All supplied suburban houses A–U are now available as fixed hard-impact obstacles. **Paths & driveways** contains five path variants and short/long driveways. These are non-colliding decorative overlays, not supporting floors or connected road tiles: place them on existing solid ground, and set Y in the inspector for raised surfaces. Paths use the suburban 6x scale; driveways use 8x for a 2.88-metre width. All eight remaining fences are now available with separate segment colliders: U-shaped enclosures open toward local -Z, while the low fence pair is open at both ends. Smaller fence interiors may still be too short to fit a car.

The hanging sign post, hanging traffic light, and three highway signs use 8x scale for overhead clearance. Posts and elevated arms/panels have separate compound boxes rather than one solid box across the opening. Each object remains one fixed hard-impact obstacle. These assets do not add traffic rules or animated signals.

The road palette includes crossings, bend/junction variants, road ends, driveway entrances, plaza/ground tiles, three large curves, a roundabout, split, wide-side variants, and a half straight. Tiles keep their measured size at 5x scale: large curves are 10 × 10 m, roundabouts 15 × 15 m, splits 5 × 10 m, and half straights 2.5 × 5 m. Supports and editor footprints match these sizes and rotate together. **Road snap** defaults to 5 m; choose 1.25 m for fine placement. Overlapping road footprints are rejected even at different grid anchors. Connectivity warnings compare measured lane endpoints on touching edges, including both split branches. Driveway curb cuts are not extra full-width lane ports; plaza/ground tiles have no lane ports. Flat tiles do not create invisible walls. Ramps and bridges are excluded.

Nineteen rail-only models are available separately under **Props & barriers**. Place them on supporting ground alongside roads; they do not create a floor. Their static concave mesh colliders match the rails and openings rather than blocking the whole footprint. Rail models retain one hard-impact body, a fixed 5x scale, and no resizing. Side rails and half rails have different authored orientations from their ground counterparts; rotate them as needed when lining them up.

The remaining car-kit additions are parked ambulance, police car, fire engine, garbage truck, delivery truck/flatbed, luxury SUV and flatbed pickup, plus a movable low traffic cone. Vehicles use hard-impact penalties; the cone uses the small-impact penalty. These additions are not new player vehicles; the existing seven drivable choices are unchanged. Rail-only models use `colliderMesh` in the catalog; this is limited to static assets with one imported render mesh, at a fixed scale.

For ordinary objects from the supplied packs, keep their files in the canonical public directory and register a single entry in `src/game/assets.ts`:

1. Place the selected GLB under `public/assets/kenney/<pack>/` with its matching `preview/<model>.png` and pack texture. Do not keep a second source copy in the project.
2. Measure it with the offline inspector:

   ```sh
    node .agents/skills/inspect-glb/scripts/inspect.mjs public/assets/kenney/city-kit-suburban/building-type-h.glb
   ```

   Use `dims`, `center`, and `groundOffset` only when `boundsSource` is `vertices`. Skinned, morphed, compressed, or incompletely measured objects need additional support and should not be blindly registered.

3. Add a stable, unique catalog ID. For example, after inspecting House H, fill in its measured values:

   ```ts
   houseH: {
       label: 'House H', category: 'Buildings', body: 'static',
       pack: 'city-kit-suburban', file: 'building-type-h.glb',
       dimensions: [/* measured X, Y, Z */],
       center: [/* measured X, Y, Z */],
       groundOffset: 0, // replace with the inspected value
       scale: 6, yaw: 0
   }
   ```

    Categories are `Vehicles`, `Buildings`, `Nature`, `Paths & driveways`, `Props & barriers`, and `Roads`. Omit `body` for non-colliding scenery; use `static` for solid obstacles or `dynamic` plus a positive `mass` for movable props. Impacts default to `hard`; set `impactKind: 'small'` for small props. Match the pack's existing scale where appropriate (suburban scenery generally uses 6); otherwise choose a deliberate metre-based size. `groundOffset` is unscaled and defaults to zero. Yaw is the visual correction relative to the object's authored heading, not its placement rotation.

4. Preserve the model's relative `Textures/colormap.png` reference in the same public pack directory. Preview URLs and categories are derived from the catalog; no extra label, preview import, placement, or scoring registration is needed. No source-to-public sync step is required.

5. Add E2E assertions in `tests/game.spec.ts` for palette/preview availability, placement, export/import, actual mesh grounding and footprint, and collision or reset behavior as appropriate. Run `pnpm test:e2e` (set `CHROME_PATH` when Chrome isn't at `/usr/bin/google-chrome`). Commit the catalog entry, copied public files, and tests together.

**Limits:** ordinary solid objects use one bounding-box collider, with an optional calibrated `collider` override for dimensions and centre relative to the grounded, pivot-compensated visual. Streetlights use this for their poles. `colliderBoxes` defines multiple boxes in that same coordinate space for fences and overhead structures, attached to one compound collision component and rigid body on the semantic root. Objects with openings must leave those openings clear rather than use a full box. A visual yaw correction of 90°/270° also needs collider/editor footprint support for swapped X/Z dimensions. New road tiles additionally require `RoadAsset` registration in `src/game/types.ts` and lane ports in `ROAD_ASSETS` in `src/game/maps.ts`, with 5-metre grid calibration. Adding a parked vehicle does not make it drivable; new player vehicles also need wheel, handling, parking geometry, and picker support. Custom uploads and automatic in-app asset onboarding are not implemented.

## Campaign and records

The title screen is a game menu, not a landing page. Its car display renders the calibrated sedan GLB with a lit parking platform, not an enlarged preview image. Preview rendering stops while the menu is hidden; a failed preview never blocks mode selection. **Play campaign** opens a level selector grouped into **Easy / Medium / Hard**, with map previews, challenge labels, personal bests, and earned stars. Locked levels remain browsable but cannot start. **Continue campaign** starts the first unlocked unplayed level, then recommends an unlocked level with stars left to improve. Filters show All levels, Unplayed, or Improve stars. Arrow keys browse filtered levels, Enter activates the focused control, and Escape returns to the main menu.

Easy is open immediately. Medium requires two stars per authored Easy level; Hard requires two stars per authored Medium level. For example, five Easy levels require 10 of their 15 stars to open Medium. Only each level's best stars count, so replaying a one-star result does not farm additional stars. A missing preceding tier cannot unlock the next one. The threshold is configured centrally by `UNLOCK_STARS_PER_LEVEL` in `src/game/campaign.ts`. Earned difficulty unlocks are retained in the local save even if records are later invalidated or levels are added. Empty difficulty groups show a coming-soon message; adding metadata does not add new maps.

Stars use the final score of a successful attempt:

| Result | Stars |
| ------ | ----- |
| Incomplete, timeout, or zero points | 0 |
| Park successfully, 1–300 points | 1 |
| Park successfully, 301–600 points | 2 |
| Park successfully, 601–1000 points | 3 |

Successful campaign attempts save the highest score for each level in this browser, under `park-master.campaign-progress.v1`. Lower-scoring replays and timeouts never reduce records. Stars on level selection reflect the best score; result-screen stars reflect the current attempt. Progress is local, not an online leaderboard. If saving is unavailable, the menu explains that records last only for the session. Changing a level's gameplay content invalidates its old record so scores from different layouts are not mixed; changing difficulty, challenge label, or campaign order does not invalidate scores. Existing v1 records remain compatible.

**Level select** is available in Settings during campaign play, in the paused menu, and inside result and error overlays. Completing a level offers **Next level** when a later unlocked authored level exists; locked tiers cannot be bypassed. **Map builder** is an independent sandbox; its drafts and Test drive scores never create campaign levels or records. Builder **Main menu** returns to mode selection without deleting the draft. JSON export/import remains available for sharing files; a community library is not implemented yet.

### Adding authored campaign levels

Use the builder to author and test a map. In the left sidebar's **Map settings** tab, set **Difficulty**, a short **Challenge label** (such as “Reverse parking”), and **Campaign order**, then **Export JSON**. As the developer, add the export to `src/game/levels/`, with a unique `id` and clear `name`. The game discovers JSON files automatically and sorts by difficulty, then ascending campaign order. Ties retain the original filename order (`courtyard.json` first, then alphabetically). Optional JSON fields are `difficulty` (`easy`, `medium`, or `hard`, default Easy), `challenge` (1–100 characters), and `campaignOrder` (integer 0–10000, default 0). Difficulty is an authored judgment based on maneuver complexity and clearances, not automatically inferred. No promote/publish control exists in the builder; local drafts never automatically join the campaign. Committing and deploying the files distributes those levels with the game.

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

### Navigation and hosting

Screen navigation uses React Router with clean URLs: `/` (main menu), `/campaign` (level selection), `/play/:levelId` (an authored campaign level), `/builder`, and `/builder/test`. Browser Back/Forward works between screens. Opening or refreshing a campaign URL starts a fresh attempt at the briefing; pause and result overlays do not create history entries. Unknown or locked level IDs return to level selection, unknown routes return home, and opening a test-drive URL without an in-memory test map returns to the builder's saved draft. Builder state stays mounted across screen navigation; test drives use a copy of the draft and never save campaign records.

Configure the production host to serve `index.html` for non-file app paths (SPA fallback), while serving `/assets/` files normally. Without this fallback, refreshing or opening a deep link can return a server 404. Vite's development and preview servers already support this behavior. The router respects Vite's `BASE_URL` when deploying under a subdirectory.

## Map builder

Choose **Map builder** from the main menu to open the level workshop. **Reset map** starts an empty lot: no roads, props, or extra parking bays, only the base ground/floor, required player spawn and target bay. **Load courtyard template** replaces the draft with the supplied courtyard. Both actions clear selection, placement previews, editor locks/hiding and reset the canvas view; both autosave and support **Undo** to recover the previous map. The builder uses a top-down drafting view; **Test drive** opens the same 3D scene and physics used by the game.

- Pick a road, prop, ground surface, spawn, or bay from the palette, then click the grid to place it. Road centres snap to a fixed 5-metre grid and rotate in 90-degree steps. Prop snapping defaults to 0.25 metres and can be changed or disabled.
- Target bays and newly placed parking bays have no raised wheel stop, leaving approaches clear for parallel parking. Decorative parking bays can opt in using **Wheel stop** in the inspector; existing authored stops are preserved.
- Use **Select & move** to drag items. The inspector also edits coordinates, headings, surface dimensions, collider settings, prop mass, and parking-bay dimensions. **Scene item** selects objects that overlap or are outside the current view.
- The searchable asset library groups roads, gameplay markers, vehicles, buildings, nature, props, and ground surfaces. Model cards use the supplied preview photos and show their calibrated footprint.
- **Right-click an item** for Select, Duplicate, Duplicate & place, Rotate 90°, Focus, and Delete. Duplicate & place follows the cursor until you click; Escape cancels. Spawn and target cannot be duplicated or deleted.
- Drag the selected item's circular handle to rotate around its centre. Roads remain locked to quarter turns; other items snap to 15° (1° with snapping off). Corner handles resize surfaces, bays, and the playable zone around the opposite corner. Props keep their default model size and cannot be stretched. A completed gesture is one undo step; Escape cancels without saving it.
- **Lock in editor** prevents edits; **Hide in editor only** removes an item from the drafting view, not from Test drive or exported files. The ground starts locked. The expandable **Scene list** provides focus, lock, and hide controls. These visibility and lock settings last for the current editor session and reset on a new map or import.
- Press **R** to rotate, **Delete** to remove, arrow keys to nudge, or **Ctrl/Cmd + D** to duplicate. Use **Ctrl/Cmd + Z** to undo and **Ctrl/Cmd + Shift + Z** to redo. New maps and imports are undoable too. Spawn and target are unique markers; move them rather than deleting them.
- **Alt + drag** or middle drag pans the map. Right-click opens object actions. Scroll the mouse wheel or use a trackpad scroll/pinch over the canvas to zoom around the pointer; the zoom buttons and **Fit map** also remain available. Increasing X moves right; increasing Z moves down in the drafting view. A heading of zero faces +Z, and a positive heading turns toward +X.
- Right-click selects the item under the pointer and offers **Deselect**, layer actions, **Lock / Unlock**, **Hide in editor**, and **Delete**. **Bring forward / Send backward** move one layer; **Bring to front / Send to back** move to either end. These actions also appear in the inspector; the scene list shows frontmost items first. New items default to floors below roads and paths, then parking markings, curbs, obstacles, and spawn, even after other items have been reordered. Existing explicit ordering is preserved. Ordering is saved as optional `editorOrder` metadata in drafts and JSON, supports undo/redo, and changes only the drafting canvas—not physical height, gameplay rendering, collisions, or campaign records. Locked items cannot be reordered or deleted. Hidden items can be restored from the inspector or scene list. Duplicate, duplicate-and-place, and rotation remain available through the inspector, handles, toolbar, and existing shortcuts.
- The left sidebar has **Assets** and **Map settings** tabs. Assets contains placement tools and the scene list; Map settings contains the level ID, time limit (1–3600 whole seconds), small/hard impact penalties (0–1000 whole points each), grid origin, player vehicle, playable zone, and level validation. Settings remain available while an element is selected; switching tabs preserves the selection. The right sidebar is only for element inspection. Use Left/Right arrow keys, Home, or End on the tabs to switch panels. Zero disables a penalty. Fields save on Enter or blur; clearing a field temporarily is allowed, but leaving it blank restores the saved value. All settings are included in local drafts and JSON exports. Road cell size is read-only at 5 metres to match the assets.
- Choose **Player vehicle** in map settings. Each model uses its calibrated body dimensions, wheelbase, and parking footprint. If the target is too small, resize it before choosing the larger car; the builder never silently enlarges the bay.
- **Add playable zone** creates a rectangular boundary. Move it and resize its corners, or enter exact dimensions in the inspector. Test drive adds visible solid perimeter barriers, with normal collision penalties. The full spawn footprint and target bay must fit inside before Test drive is enabled. The validation panel links relevant issues to their items; scenery outside the zone is advisory. Old maps without a zone retain their existing behavior.
- Drafts save automatically in this browser on this device. **Export JSON** downloads a portable level file; **Import JSON** validates a file before replacing the draft. Export files to keep backups or share maps. Local saving is not a server upload or a write to the repository.
- **Test drive** creates a fresh session from a copy of the draft. Click **Let’s park** to drive, and **Back to builder** to edit again. Physics movement, restart, and scoring never change the authored draft. Attempts use the map's saved time limit and small/hard impact penalties; parking rules are unchanged. Restart restores the configured timer and clears all impact deductions.

The supplied level lives in `src/game/levels/courtyard.json`. `src/game/maps.ts` validates versioned map files and resolves road cells into world positions, calibrated visuals, and flat supporting colliders. `src/game/level.ts` loads the default map; `src/editor/` owns the drafting tools and history. Floors, curbs, islands, decoration, parked vehicles, spawn, and parking markings all come from level data. Asset dimensions, scales, and grounding stay in `src/game/assets.ts`.

Map files save `timeLimit`, `impactPenalty` (hard-object points), and `smallImpactPenalty` (small-object points). New templates default to 90 seconds and 25/10 points. Old v1 files without `smallImpactPenalty` default to 10 small-object points; their formerly fixed `impactPenalty: 50` is migrated to 25. Exports always include both penalties, so an explicitly authored 50-point hard penalty with `smallImpactPenalty` remains 50.

Map files use `schemaVersion: 1`, with `id`, `name`, `timeLimit`, `impactPenalty`, `smallImpactPenalty`, `grid`, `roads`, `objects`, `surfaces`, `spawn`, `bay`, and `parkingBays`. Optional `playerVehicle` is `sedan`, `suv`, `taxi`, `hatchbackSports`, `sedanSports`, `van`, or `pickup` (default sedan); optional `playableZone` has metre-based `x`, `z`, `width`, and `length` (dimensions 5–500 metres). Existing v1 maps remain compatible. Road `[column, row]` anchors support quarter-cell increments: authored pivot `x = origin[0] + column × 5`, `z = origin[1] + row × 5`; offset models have a rotated calibrated visual/support centre around that pivot. Duplicate anchors and overlapping footprints are rejected. Supported roads are registered in `ROAD_ASSETS` in `src/game/maps.ts` and the `RoadAsset` type in `src/game/types.ts`, including all 26 retained ground tiles; rotations are 0, 90, 180, or 270 degrees. Rail-only barriers are props, not road tiles. Props use metre-based `[x, y, z]` positions. Supporting surfaces are solid floor colliders excluded from impact penalties; solid curbs remain obstacles. `bay` is the target, while `parkingBays` contains decorative bays with optional wheel stops.

Imports reject unsupported versions/assets, duplicate or reserved object IDs, overlapping road cells, invalid coordinates/dimensions, and target bays smaller than the car. Files are limited to 2 MB and 2,000 authored items. Road connection notes flag neighboring tiles with incompatible lane openings; they are advisory and do not prove a level is driveable. The first version edits flat levels with the supplied asset catalog; YAML, custom asset uploads, terrain, and automatic route generation are deferred.
