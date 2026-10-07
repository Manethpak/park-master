# Asset implementation tracker (temporary)

Updated: 2026-10-07. Scope: the retained implementation checklist below.
The user removed debris, loose wheels, and go-karts from the car-kit checklist.
The user also approved excluding elevated roads/structures, electrical infrastructure,
loose sign/signal components, tractors, and race cars.
The duplicate source library was subsequently removed at the user's request. Only
the retained models, previews and textures remain in `public/assets/kenney/`.

## Summary

| Pack              |  Models | Implemented | Pending |
| ----------------- | ------: | ----------: | ------: |
| car-kit           |      18 |          18 |       0 |
| city-kit-road     |      66 |          66 |       0 |
| city-kit-suburban |      40 |          40 |       0 |
| **Total**         | **124** |     **124** |   **0** |

`[x]` means registered and synced into the builder/game, not necessarily drivable.
`[ ]` means in scope but not yet available. The original library contained 185
models; 61 were excluded, leaving 124 models now retained solely in the public library.
Measured dimensions, scale, pivot compensation, grounding, collision defaults, and labels
for implemented models live in `src/game/assets.ts`, rather than being duplicated here.
Pending models still need inspection/calibration unless explicitly noted below.

## Scope reductions

Already excluded by the user's checklist edits:

| Category | Source pattern | Excluded models |
| --- | --- | ---: |
| Vehicle debris / spare body parts | car-kit/debris-*.glb | 14 |
| Loose wheels | car-kit/wheel-*.glb | 8 |
| Go-karts | car-kit/kart-*.glb | 5 |
| **Total excluded** | | **27** |

Additional reductions approved by the user and now excluded from the checklist:

| Category | Models | Reason |
| --- | ---: | --- |
| Elevated roads, ramps, raised tiles, bridge/pillars | 15 | Requires elevation-aware driving, placement and connectivity; outside the flat parking focus. |
| Electrical infrastructure | 8 | Poles, attachments and wires add little parking gameplay and require assembly. |
| Loose sign / signal components | 6 | Complete signs and signals are already implemented; component parts need mounting support. |
| Tractors and race cars | 5 | Three tractors and two race models need specialised handling and are less relevant to ordinary parking. |

These four categories exclude another 34 models (61 excluded in total).
Excluded road patterns: `road-slant*.glb`, `road-bridge.glb`, `bridge-pillar*.glb`,
`tile-high.glb`, `tile-slant*.glb`, `electricity-*.glb`, `road-sign-object-*.glb`,
and `traffic-light-object-*.glb`. Excluded additional vehicle patterns:
`tractor*.glb` and `race*.glb`.
Current scope: 124 targets, 124 implemented, zero pending.
Duplicate source assets and excluded models have been removed. The 251 retained public
files (124 GLBs, 124 previews, three textures) were verified byte-for-byte against
their source copies before removal. This removes 10,157,451 bytes from the working
tree. Existing implemented assets and maps are unchanged; no tests were rerun.

## First milestone

- [x] Inventory all 185 GLBs and check preview availability.
- [x] Inspect and calibrate 15 new standalone street-furniture models.
- [x] Register stop/street signs and the bare sign post.
- [x] Register six streetlight variants with narrow, offset pole colliders.
- [x] Register the standalone traffic light and dumpster.
- [x] Register construction barrier, cone, fence, and light.
- [x] Sync GLBs, previews, and palette texture with `pnpm assets:sync`.
- [x] Add E2E assertions for placement, JSON, reload, rotated mesh bounds, grounding,
      collider offsets, pole clearance, hard impacts, and movable cone/reset behavior.
- [ ] Run and pass `pnpm test:e2e` (first run: 64 passed, 1 failed because the
      collision fixture placed the cone beyond its supporting floor; fixture corrected,
      both affected tests now pass in a targeted E2E run; the full 65-test rerun was
      cancelled by the user, so a complete passing rerun is not yet confirmed).

Behavior: signs, signals, dumpsters, lamps, barriers, and fences are static hard-impact
obstacles. The construction cone is dynamic (8 kg), with the small-impact penalty.
Streetlight arms are decorative; only their ground-mounted poles collide. Lights do not
add real illumination or cycle signals. The supplied empty sign is a post, not a blank
sign face. Existing maps and campaign layouts are unchanged. Models still load on demand.

## Second milestone — suburban scenery

- [x] Inspect remaining houses H–U, paths, driveways, and the low fence.
- [x] Register 14 houses with the existing suburban 6x scale and static hard-impact colliders.
- [x] Register five path variants as non-colliding decorative overlays (6x scale).
- [x] Register two driveway variants as non-colliding overlays (8x scale / 2.88 m width).
- [x] Add a focused **Paths & driveways** builder category.
- [x] Sync models, previews, and the suburban palette texture.
- [x] Add E2E coverage for every new preview, placement, JSON/reload, rotated mesh
      footprint, grounding, collision/no-collision policy, driving through overlays,
      offset house collisions, and restart.
- [x] Defer `fence-low.glb`: its separated rails require more than one solid box.
- [ ] Execute the new E2E coverage — intentionally skipped at the user's request.

Paths and driveways do not create support surfaces or charge impact penalties. Place
them on an existing solid floor/ground, using the inspector's Y value when elevated.
All supplied houses A–U are now available. At the end of milestone two, the remaining
eight suburban assets were the low fence pair and seven enclosure fence variants.

### Validation cadence (user override)

As requested, skip E2E execution for this milestone and run the combined suite once
per two subsequent completed milestones. This is the first milestone since that
cadence was requested; the next completed milestone is the next E2E checkpoint.
Continue adding meaningful E2E assertions with every gameplay batch. No unit tests,
typecheck, lint, build, or manual browser validation are substituted for skipped E2E.

## Third milestone — compound obstacles and overhead clearance

- [x] Inspect all eight remaining fences and five overhead sign/signal models.
- [x] Check actual fence layout and overhead post/panel geometry offline; the low
      fence is two separate rails, and the seven enclosure variants are U-shaped.
- [x] Add catalog-owned compound boxes, keeping one semantic root and rigid body.
- [x] Register all eight fences with solid segments and unobstructed interiors.
- [x] Register hanging sign post, hanging traffic light, and three highway signs.
- [x] Use 8x scale for overhead models to preserve clearance for current vehicles.
- [x] Sync models, previews, and palette textures.
- [x] Add E2E coverage for every new preview, JSON/reload, rotated mesh bounds,
      compound part dimensions/offsets, driving through openings, solid post/segment
      impacts, one-penalty continuous contact, and restart.
- [ ] Pass the combined E2E suite for milestones two and three (run finished:
      72 passed, 3 failed; two missing trace-artifact errors and one lost test API during
      renderer teardown / null WebGL buffer cleanup. Development source edits occurred
      during this run, so it was not a clean unchanged-source validation checkpoint).

All 40 supplied suburban models are now implemented. Fences use two or three box
segments; U-shaped fences open toward local -Z. Smaller enclosures do not fit the
entire car merely because their interiors are open. Highway signs have two posts
and an elevated panel; hanging models have a post, arm, and optional signal head.
Signals remain decorative, without cycling. Colliders belong to the single object
body, so contacts should score against the semantic obstacle, not individual boxes.
Validation checkpoint: this milestone completes the requested pair; the next pair
is milestones four and five. No immediate rerun was started. At that checkpoint,
keep source files unchanged until the suite finishes to avoid development reloads.

## Fourth milestone — standard flat road tiles

- [x] Inspect standard flat tiles and shortlist nonstandard footprints separately.
- [x] Register 12 new 5 m × 5 m tiles: crossing, two road ends, two bend variants,
      two crossroads variants, two T-junction variants, two driveway entrances, and plaza.
- [x] Extend `RoadAsset` and `ROAD_ASSETS`, measuring main-lane edge ports offline.
- [x] Preserve 5-metre snapping, quarter-turn rotation, single-cell occupancy,
      flat support colliders, warning generation, and old map compatibility.
- [x] Sync models, previews, and palette texture.
- [x] Add E2E assertions for every preview, snapping, rotation/undo, JSON/reload,
      actual road mesh/support dimensions, driving, restart, connected/disconnected
      ports, and rejection of invalid rotation, occupied cells, and road-as-prop imports.
- [x] Execute milestone-four E2E coverage — its tests passed in the fourth/fifth
  checkpoint and again in the final focused asset suite. Full checkpoint: 64 passed,
  29 failed (details below).

Lane ports: crossing and driveway entrances `[1, 3]`; ends `[1]`; bends `[0, 3]`;
crossroads `[0, 1, 2, 3]`; T junctions `[0, 1, 3]`; plaza `[]`.
Directions are local +Z, +X, -Z, -X. Driveway curb cuts are not additional full-width
road-lane ports. Ports describe markings/connectivity, not invisible driving walls:
all these tiles retain flat, penalty-free support surfaces. Existing maps are unchanged.

Previously deferred nonstandard flat footprints are implemented in milestone six,
without squeezing their dimensions into a single cell.

## Fifth milestone — remaining car-kit targets

- [x] Inspect/calibrate eight commercial, emergency and ordinary parked vehicles,
  plus the dynamic low cone. Preserve existing seven player vehicle choices.
- [x] Sync models/previews; add E2E for previews, JSON/reload, grounding, colliders,
  actual driving contact, correct penalties and restart for all nine assets.
- [x] Execute fourth/fifth checkpoint: **64 passed, 29 failed**. All new car-kit
  and milestone-four tests passed. Failures concerned existing campaign/control tests,
  GPU console messages, fence/overlay timing and missing trace artifacts. This agent
  did not edit source during testing. Those failures remain unresolved.

## Sixth milestone — remaining ground tiles

- [x] Register ten measured ground tiles: three large curves, roundabout, three
  wide-side variants, split, half straight, and plain low tile.
- [x] Keep uniform 5x scale; size and rotate supporting floors to match footprints.
- [x] Add quarter-cell coordinates and optional 1.25 m Road snap (default 5 m).
- [x] Preserve authored lane pivots on the grid for offset side roads.
- [x] Reject road footprint overlap even at different grid anchors.
- [x] Compare measured geometric lane endpoints at touching edges, including curve
  offsets, both split branches, half tiles and widened road transitions.
- [x] E2E covers previews, placement, undo/rotation, JSON/reload, overlap/fraction
  rejection, mesh/support dimensions, lane warnings and penalty-free driving.

## Seventh milestone — nineteen rail-only barriers

- [x] Register rail-only models under Props & barriers; keep supporting roads separate.
- [x] Use one static semantic body with a calibrated concave mesh collision child
  so curved rails and openings agree with the supplied geometry.
- [x] Sync all models, previews and palette textures.
- [x] E2E drives into each of nineteen barriers, checks hard penalties and restart;
  also checks open-lane driving and rotated, grounded visual dimensions.
- [x] Final combined focused asset/compatibility run: **36 passed, 1 failed**.
  New test fixture reloaded before async import finished. Added a persistence wait;
  affected test then passed (**1/1**).
- [x] Rerun combined focused asset/compatibility set after the fix: **37/37 passed**.

The earlier full suite remains **64 passed / 29 failed**, not fully green. No unit
tests, typecheck, lint, builds or manual browser checks ran. Ammo warns that runtime
mesh rescaling is unsupported; these barriers all use a fixed 5x scale and cannot resize.

## Deferred work / dependencies

1. **Mounted and overhead street furniture:** five complete overhead models are
   implemented with compound colliders. Loose sign/signal faces and all electrical
   infrastructure are excluded, not future implementation work.
2. **Component parts:** loose sign/signal parts, electrical attachments, wheels,
   debris, and go-karts are excluded from scope.
3. **Suburban scenery:** all 40 models are implemented; paths/driveways are decorative
   overlays and still require a separate supporting floor.
4. **Enclosure fences:** compound segment colliders are implemented, with open interiors.
   The low fence is specifically a pair of rails, open at both ends.
5. **Flat road variants:** all 26 retained ground tiles and nineteen rail-only barriers
   are implemented with separate support and impact collision behavior.
6. **Raised roads, ramps, bridges, pillars:** excluded from scope; no elevation-aware
   driving or placement work is planned for this asset rollout.
7. **Vehicles:** all retained models are parked obstacles or props. Further drivable
   registration is separate work requiring wheels, handling, body and parking
   geometry. Tractors and race cars are excluded.

Drivable now: sedan, SUV, taxi, sports hatchback, sports sedan, van, and pickup.
For each future batch: inspect → calibrate → register → sync → add E2E → update this file.
Execute E2E at the two-milestone checkpoints described above.
Use only automated E2E validation; no extra manual browser checks or builds.

## car-kit (18 / 18 in scope; 32 excluded)

- [x] `ambulance.glb` — ambulance
- [x] `box.glb` — box
- [x] `cone-flat.glb` — coneFlat
- [x] `cone.glb` — cone
- [x] `delivery-flat.glb` — deliveryFlat
- [x] `delivery.glb` — delivery
- [x] `firetruck.glb` — firetruck
- [x] `garbage-truck.glb` — garbageTruck
- [x] `hatchback-sports.glb` — hatchbackSports
- [x] `police.glb` — police
- [x] `sedan-sports.glb` — sedanSports
- [x] `sedan.glb` — sedan
- [x] `suv-luxury.glb` — suvLuxury
- [x] `suv.glb` — suv
- [x] `taxi.glb` — taxi
- [x] `truck-flat.glb` — pickupFlat
- [x] `truck.glb` — pickup
- [x] `van.glb` — van

## city-kit-road (66 / 66 in scope; 29 excluded)

- [x] `construction-barrier.glb` — constructionBarrier
- [x] `construction-cone.glb` — constructionCone
- [x] `construction-fence.glb` — constructionFence
- [x] `construction-light.glb` — constructionLight
- [x] `dumpster.glb` — dumpster
- [x] `light-curved-cross.glb` — streetlightCurvedCross
- [x] `light-curved-double.glb` — streetlightCurvedDouble
- [x] `light-curved.glb` — streetlightCurved
- [x] `light-square-cross.glb` — streetlightSquareCross
- [x] `light-square-double.glb` — streetlightSquareDouble
- [x] `light-square.glb` — streetlightSquare
- [x] `road-bend-barrier.glb` — barrierBend
- [x] `road-bend-sidewalk.glb` — roadBendSidewalk
- [x] `road-bend-square-barrier.glb` — barrierBendSquare
- [x] `road-bend-square.glb` — roadBendSquare
- [x] `road-bend.glb` — roadBend
- [x] `road-crossing.glb` — roadCrossing
- [x] `road-crossroad-barrier.glb` — barrierCrossroad
- [x] `road-crossroad-line.glb` — roadCrossroadLine
- [x] `road-crossroad-path.glb` — roadCrossroadPath
- [x] `road-crossroad.glb` — roadCrossroad
- [x] `road-curve-barrier.glb` — barrierCurve
- [x] `road-curve-intersection-barrier.glb` — barrierCurveIntersection
- [x] `road-curve-intersection.glb` — roadCurveIntersection
- [x] `road-curve-pavement.glb` — roadCurvePavement
- [x] `road-curve.glb` — roadCurve
- [x] `road-driveway-double-barrier.glb` — barrierDrivewayDouble
- [x] `road-driveway-double.glb` — roadDrivewayDouble
- [x] `road-driveway-single-barrier.glb` — barrierDrivewaySingle
- [x] `road-driveway-single.glb` — roadDrivewaySingle
- [x] `road-end-barrier.glb` — barrierEnd
- [x] `road-end-round-barrier.glb` — barrierEndRound
- [x] `road-end-round.glb` — roadEndRound
- [x] `road-end.glb` — roadEnd
- [x] `road-intersection-barrier.glb` — barrierIntersection
- [x] `road-intersection-line.glb` — roadIntersectionLine
- [x] `road-intersection-path.glb` — roadIntersectionPath
- [x] `road-intersection.glb` — roadIntersection
- [x] `road-roundabout-barrier.glb` — barrierRoundabout
- [x] `road-roundabout.glb` — roadRoundabout
- [x] `road-side-barrier.glb` — barrierSide
- [x] `road-side-entry-barrier.glb` — barrierSideEntry
- [x] `road-side-entry.glb` — roadSideEntry
- [x] `road-side-exit-barrier.glb` — barrierSideExit
- [x] `road-side-exit.glb` — roadSideExit
- [x] `road-side.glb` — roadSide
- [x] `road-sign-empty-hanging.glb` — hangingSignPost
- [x] `road-sign-empty.glb` — signPost
- [x] `road-sign-stop.glb` — stopSign
- [x] `road-sign-street.glb` — streetSign
- [x] `road-sign-warning.glb` — sign
- [x] `road-split-barrier.glb` — barrierSplit
- [x] `road-split.glb` — roadSplit
- [x] `road-square-barrier.glb` — barrierSquare
- [x] `road-square.glb` — roadSquare
- [x] `road-straight-barrier-end.glb` — barrierStraightEnd
- [x] `road-straight-barrier-half.glb` — barrierHalf
- [x] `road-straight-barrier.glb` — barrierStraight
- [x] `road-straight-half.glb` — roadHalf
- [x] `road-straight.glb` — road
- [x] `sign-highway-detailed.glb` — highwaySignDetailed
- [x] `sign-highway-wide.glb` — highwaySignWide
- [x] `sign-highway.glb` — highwaySign
- [x] `tile-low.glb` — tileLow
- [x] `traffic-light-hanging.glb` — hangingTrafficLight
- [x] `traffic-light.glb` — trafficLight

## city-kit-suburban (40 / 40)

- [x] `building-type-a.glb` — houseA
- [x] `building-type-b.glb` — houseWide
- [x] `building-type-c.glb` — houseC
- [x] `building-type-d.glb` — houseD
- [x] `building-type-e.glb` — house
- [x] `building-type-f.glb` — houseF
- [x] `building-type-g.glb` — houseG
- [x] `building-type-h.glb` — houseH
- [x] `building-type-i.glb` — houseI
- [x] `building-type-j.glb` — houseJ
- [x] `building-type-k.glb` — houseK
- [x] `building-type-l.glb` — houseL
- [x] `building-type-m.glb` — houseM
- [x] `building-type-n.glb` — houseN
- [x] `building-type-o.glb` — houseO
- [x] `building-type-p.glb` — houseP
- [x] `building-type-q.glb` — houseQ
- [x] `building-type-r.glb` — houseR
- [x] `building-type-s.glb` — houseS
- [x] `building-type-t.glb` — houseT
- [x] `building-type-u.glb` — houseU
- [x] `driveway-long.glb` — drivewayLong
- [x] `driveway-short.glb` — drivewayShort
- [x] `fence-1x2.glb` — fence1x2
- [x] `fence-1x3.glb` — fence1x3
- [x] `fence-1x4.glb` — fence1x4
- [x] `fence-2x2.glb` — fence2x2
- [x] `fence-2x3.glb` — fence2x3
- [x] `fence-3x2.glb` — fence3x2
- [x] `fence-3x3.glb` — fence3x3
- [x] `fence-low.glb` — fenceLow
- [x] `fence.glb` — fence
- [x] `path-long.glb` — pathLong
- [x] `path-short.glb` — pathShort
- [x] `path-stones-long.glb` — pathStonesLong
- [x] `path-stones-messy.glb` — pathStonesMessy
- [x] `path-stones-short.glb` — pathStonesShort
- [x] `planter.glb` — planter
- [x] `tree-large.glb` — tree
- [x] `tree-small.glb` — treeSmall
