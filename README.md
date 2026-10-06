# Park Master — The Courtyard

A desktop parking puzzle built with React, TypeScript, and PlayCanvas. Drive through a narrow courtyard entrance, negotiate the bend, and reverse into the green bay between two parked cars.

## Run locally

Requires Node.js 22.23.2 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:5173 in a browser with WebGL2 support. Click **Let’s park** to begin the 90-second attempt.

## Controls and rules

| Input    | Action                                                         |
| -------- | -------------------------------------------------------------- |
| W / Up   | Accelerate forward; brake first when reversing                 |
| S / Down | Brake, then reverse                                            |
| Mouse    | Move left/right of the canvas center to steer the front wheels |
| Space    | Brake                                                          |
| Escape   | Pause / resume                                                 |
| R        | Restart the attempt and restore all movable props              |

Center the mouse to straighten the wheels. Reversing changes the direction the car turns, as it does with a steering wheel. The car cannot turn in place.

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

```sh
pnpm test         # Rules, sessions, scoring, contacts, and handling at 30/60/120 FPS
pnpm test:e2e     # Chrome: models, controls, physics, parking, reset, pause, timeout, errors
pnpm typecheck
pnpm lint
pnpm fmt
pnpm build
pnpm start       # Preview the production build
```

Browser tests use a separate Vite server on port 5174. They default to Chrome at `/usr/bin/google-chrome`; set `CHROME_PATH` to your Chrome executable on another system. The tests enable `VITE_E2E=true` to expose inspection and positioning helpers in the development build. That interface is absent from production.

The production output is a static site in `dist/`, including the model palette textures. The Engine and physics library produce large bundle chunks; their build size warnings are expected for this prototype.
