# Agent instructions

## Validation preference

- Use **automated E2E tests only** as the default validation workflow: `pnpm test:e2e`.
- Skip manual browser checks, exploratory play-testing, screenshot or pixel reviews, browser MCP inspections, and standalone browser automation scripts. Do not open the app for an extra visual check before or after E2E tests.
- Chrome launched by the Playwright E2E suite is allowed; the instruction to skip browser checks does not prohibit E2E tests.
- Do not automatically run unit tests, typecheck, lint, formatting checks, production builds, or preview checks. These commands remain available when the user explicitly requests them. A later explicit user instruction takes precedence over this default.
- For documentation-only edits, read and review the changed text; no gameplay E2E run is needed unless requested.
- For gameplay changes, update meaningful assertions in `tests/game.spec.ts` and run the E2E suite. Report failures or environment blockers accurately; do not substitute manual browser checks.

## Project context

Park Master is a desktop and mobile parking puzzle using React, TypeScript, Vite, `@playcanvas/react`, PlayCanvas Engine, and `sync-ammo`. Keep the React-owned `<Application usePhysics>` architecture. Mobile gameplay uses width-aware touch pedals and steering buttons, with a portrait pause prompt and optional fullscreen landscape lock. Traffic and online scores are deferred; the map builder remains desktop-oriented.

Read [README.md](README.md) for setup, controls, scoring, and available commands. Use pnpm; Node.js must satisfy the version in `package.json`.

## Code ownership

- `src/App.tsx` and `src/index.css`: HUD, instructions, overlays, and presentation.
- `src/game/Scene.tsx`: React-owned entities, asset/physics loading, colliders, lighting, and parking markings.
- `src/game/runtime.ts`: PlayCanvas update loop, input, rigid-body control, camera, wheel animation, collision listeners, and resets. Clean up listeners and runtime resources on teardown.
- `src/game/driving.ts`: handling functions and tuning. Current defaults are 35-degree steering, 6 m/s forward, and 3 m/s reverse.
- `src/game/rules.ts`: parking containment/alignment, scoring, hold time, and distinct-impact tracking. Preserve the 0.3-second separation debounce that prevents repeated penalties from contact jitter.
- `src/game/session.ts`: session transitions, timer, parking progress, and HUD snapshots. Countdown uses elapsed wall time while playing and excludes pauses.
- `src/game/types.ts`, `assets.ts`, and `level.ts`: reusable definitions, calibrated models, and authored level configuration.

Keep simulation work in Engine callbacks and React subscribed to HUD snapshots. Use actual body velocity for handling; let physics resolve obstacle contact. Prevent stationary rotation and preserve natural reverse steering. Restart must restore the car, movable props, timer, score, and contact state. Clear held inputs on pause or focus loss.

Preserve the parking rules: the entire car footprint must be inside the bay, heading within 10 degrees of its arrow, speed below 0.15 m/s, continuously for one second. The default attempt lasts 90 seconds; maps save a configurable `timeLimit`. Score is `max(0, round(1000 × remainingSeconds / timeLimit) − accumulatedImpactPoints)`; success freezes the score and timeout scores zero. Maps save `smallImpactPenalty` (default 10 for cones and boxes) and `impactPenalty` (default 25 for hard obstacles). Successful scores earn 0 stars at zero, 1 star at 1–300, 2 stars at 301–600, and 3 stars at 601–1000. Global map settings, player vehicle, playable zone, and level validation belong in the left sidebar's Map settings tab; placement tools and the scene list belong in its Assets tab. The right sidebar is reserved for element inspection. Switching sidebar tabs preserves the selected element.

## Assets and scene conventions

- Keep supplied source assets under `src/assets` intact. Copy only selected models and textures to `public/assets/kenney/<pack>/`.
- Preserve each GLB’s relative `Textures/colormap.png` reference. Keep asset URLs compatible with Vite’s `BASE_URL`.
- Inspect and calibrate new models once in `src/game/assets.ts` before repeated placement. Existing models face +Z; the player sedan is normalized to 4.2 metres long. Grounding, pivots, visual dimensions, and colliders must agree.
- Give each object one semantic entity root with its imported visual and simple measured collider. Cars, buildings, fences, and mounted signs are static obstacles; cones and boxes are dynamic props.
- Keep the fixed-orientation orthographic follow camera and the low-poly daylight appearance. Preserve visibility around tight turns and the parking bay.
- Apply relevant local PlayCanvas skills under `.agents/skills` when changing Engine behavior. Their suggested browser or visual QA does not override the user’s E2E-only validation preference.

## E2E setup

`playwright.config.ts` runs `tests/game.spec.ts` with one worker and starts Vite on `127.0.0.1:5174` with `VITE_E2E=true`. Chrome defaults to `/usr/bin/google-chrome`; use `CHROME_PATH` for another installation. Keep port 5174 available, or ensure any reused server has the same E2E configuration.

`window.__parkTest` provides controlled inspection and positioning helpers only in development with `VITE_E2E=true`. Keep this interface absent from production. Exercise user controls in E2E tests when verifying driving behavior rather than relying only on teleportation. Retained failure traces, `test-results/`, and `playwright-report/` are generated artifacts; do not commit them. Do not commit secrets or local environment credentials.
