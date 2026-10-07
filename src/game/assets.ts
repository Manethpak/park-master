import type { AssetDefinition, ColliderBox, PlayerVehicle, Triple } from './types.ts';

// U-shaped fences open toward -Z. The low fence is two separate parallel rails.
// Segment bounds are measured in the source mesh, relative to its compensated centre.
function enclosureFence(file: string, label: string, dimensions: Triple, center: Triple, openBothEnds = false): AssetDefinition {
    const [width, height, length] = dimensions;
    const boxes: ColliderBox[] = [-1, 1].map((side) => ({ dimensions: [0.075, height, length], center: [side * (width / 2 - 0.0375), height / 2, 0] }));
    if (!openBothEnds) boxes.push({ dimensions: [width, height, 0.075], center: [0, height / 2, length / 2 - 0.0375] });
    return { label, category: 'Props & barriers', body: 'static', pack: 'city-kit-suburban', file, dimensions, center, scale: 6, yaw: 0, groundOffset: 0, colliderBoxes: boxes };
}

function highwaySign(file: string, label: string, height: number): AssetDefinition {
    const center: Triple = [-0.0412, height / 2, 0];
    const panelBottom = 0.4676;
    return {
        label, category: 'Props & barriers', body: 'static', pack: 'city-kit-road', file,
        dimensions: [0.1324, height, 1], center, scale: 8, yaw: 0, groundOffset: 0,
        colliderBoxes: [
            ...[-1, 1].map((side): ColliderBox => ({ dimensions: [0.05, 0.6, 0.05], center: [0.0412, 0.3, side * 0.475] })),
            { dimensions: [0.1324, height - panelBottom, 0.85], center: [0, (height + panelBottom) / 2, 0] }
        ]
    };
}

// These flat models all have inspected vertex bounds of 1 x 0.02 x 1.
function flatRoad(file: string, label: string): AssetDefinition {
    return { label, category: 'Roads', pack: 'city-kit-road', file, dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0, groundOffset: 0 };
}

function extendedRoad(file: string, label: string, dimensions: Triple, center: Triple = [0, 0.01, 0]): AssetDefinition {
    return { ...flatRoad(file, label), dimensions, center };
}

// These source GLBs contain rails only: keep them independent from the supporting road.
function roadBarrier(file: string, label: string, dimensions: Triple = [1, 0.08, 1], center: Triple = [0, 0.04, 0]): AssetDefinition {
    return { label, category: 'Props & barriers', body: 'static', colliderMesh: true, pack: 'city-kit-road', file, dimensions, center, scale: 5, yaw: 0, groundOffset: 0 };
}

// Vertex bounds measured with the project's offline GLB inspector. Facing is +Z.
export const ASSETS: Record<string, AssetDefinition> = {
    sedan: {
        label: 'Parked sedan', category: 'Vehicles', body: 'static',
        pack: 'car-kit',
        file: 'sedan.glb',
        dimensions: [1.5, 1.3, 2.55],
        center: [0, 0.65, -0.025],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    suv: {
        label: 'Parked SUV', category: 'Vehicles', body: 'static',
        pack: 'car-kit',
        file: 'suv.glb',
        dimensions: [1.5, 1.3, 2.7],
        center: [0, 0.65, 0],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    taxi: {
        label: 'Parked taxi', category: 'Vehicles', body: 'static',
        pack: 'car-kit',
        file: 'taxi.glb',
        dimensions: [1.5, 1.5, 2.75],
        center: [0, 0.75, -0.025],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    hatchbackSports: {
        label: 'Parked sports hatchback', category: 'Vehicles', body: 'static',
        pack: 'car-kit', file: 'hatchback-sports.glb',
        dimensions: [1.3, 1.1, 2.85], center: [0, 0.55, -0.025],
        scale: 3.9 / 2.85, yaw: 0, groundOffset: 0
    },
    sedanSports: {
        label: 'Parked sports sedan', category: 'Vehicles', body: 'static',
        pack: 'car-kit', file: 'sedan-sports.glb',
        dimensions: [1.3, 1.1, 2.55], center: [0, 0.55, -0.025],
        scale: 4.2 / 2.55, yaw: 0, groundOffset: 0
    },
    van: {
        label: 'Parked van', category: 'Vehicles', body: 'static',
        pack: 'car-kit', file: 'van.glb',
        dimensions: [1.5, 1.35, 2.75], center: [0, 0.675, -0.025],
        scale: 4.2 / 2.55, yaw: 0, groundOffset: 0
    },
    pickup: {
        label: 'Parked pickup', category: 'Vehicles', body: 'static',
        pack: 'car-kit', file: 'truck.glb',
        dimensions: [1.5, 1.3, 2.95], center: [0, 0.65, -0.025],
        scale: 4.2 / 2.55, yaw: 0, groundOffset: 0
    },
    cone: {
        label: 'Traffic cone', category: 'Props & barriers', body: 'dynamic', mass: 8, impactKind: 'small',
        pack: 'car-kit',
        file: 'cone.glb',
        dimensions: [0.4762, 0.5952, 0.4762],
        center: [0, 0.2976, 0],
        scale: 1.2,
        yaw: 0
    },
    ambulance: { label: 'Parked ambulance', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'ambulance.glb', dimensions: [1.5, 1.8, 3.25], center: [0, 0.9, -0.025], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    deliveryFlat: { label: 'Parked flatbed delivery truck', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'delivery-flat.glb', dimensions: [1.5, 1.35, 3.25], center: [0, 0.675, -0.025], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    delivery: { label: 'Parked delivery truck', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'delivery.glb', dimensions: [1.5, 1.65, 3.25], center: [0, 0.825, -0.025], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    firetruck: { label: 'Parked fire engine', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'firetruck.glb', dimensions: [1.5, 1.7, 3.4], center: [0, 0.85, 0], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    garbageTruck: { label: 'Parked garbage truck', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'garbage-truck.glb', dimensions: [1.6, 1.6, 3.45], center: [0, 0.8, 0.025], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    police: { label: 'Parked police car', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'police.glb', dimensions: [1.5, 1.3, 3.1], center: [0, 0.65, 0], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    suvLuxury: { label: 'Parked luxury SUV', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'suv-luxury.glb', dimensions: [1.5, 1.3, 2.85], center: [0, 0.65, 0.025], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    pickupFlat: { label: 'Parked flatbed pickup', category: 'Vehicles', body: 'static', pack: 'car-kit', file: 'truck-flat.glb', dimensions: [1.5, 1.3, 2.7451], center: [0, 0.65, 0], scale: 4.2 / 2.55, yaw: 0, groundOffset: 0 },
    coneFlat: { label: 'Low traffic cone', category: 'Props & barriers', body: 'dynamic', mass: 8, impactKind: 'small', pack: 'car-kit', file: 'cone-flat.glb', dimensions: [0.4762, 0.281, 0.4762], center: [0, 0.1405, 0], scale: 1.2, yaw: 0, groundOffset: 0 },
    box: {
        label: 'Movable box', category: 'Props & barriers', body: 'dynamic', mass: 16, impactKind: 'small',
        pack: 'car-kit',
        file: 'box.glb',
        dimensions: [0.715, 0.715, 0.715],
        center: [0, 0.3575, 0],
        scale: 1.2,
        yaw: 0
    },
    house: {
        label: 'House', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban',
        file: 'building-type-e.glb',
        dimensions: [1.3, 1.1375, 1.028],
        center: [0, 0.5688, 0],
        scale: 6,
        yaw: 0
    },
    houseWide: {
        label: 'Wide house', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban',
        file: 'building-type-b.glb',
        dimensions: [1.828, 1.1375, 1.14],
        center: [0, 0.5688, 0],
        scale: 5,
        yaw: 0
    },
    tree: {
        label: 'Large tree', category: 'Nature',
        pack: 'city-kit-suburban',
        file: 'tree-large.glb',
        dimensions: [0.2104, 0.767, 0.243],
        center: [0, 0.3835, 0],
        scale: 6,
        yaw: 0
    },
    treeSmall: {
        label: 'Small tree', category: 'Nature',
        pack: 'city-kit-suburban',
        file: 'tree-small.glb',
        dimensions: [0.2104, 0.567, 0.243],
        center: [0, 0.2835, 0],
        scale: 6,
        yaw: 0
    },
    fence: {
        label: 'Fence', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-suburban',
        file: 'fence.glb',
        dimensions: [0.475, 0.27, 0.075],
        center: [0, 0.135, 0],
        scale: 6,
        yaw: 0
    },
    fenceLow: enclosureFence('fence-low.glb', 'Low fence pair', [1.275, 0.17, 0.8375], [0, 0.085, -0.0188], true),
    fence1x2: enclosureFence('fence-1x2.glb', 'Enclosure fence 1×2', [0.875, 0.27, 0.4375], [0, 0.135, 0.0188]),
    fence1x3: enclosureFence('fence-1x3.glb', 'Enclosure fence 1×3', [1.275, 0.27, 0.4375], [0, 0.135, 0.0188]),
    fence1x4: enclosureFence('fence-1x4.glb', 'Enclosure fence 1×4', [1.675, 0.27, 0.4375], [0, 0.135, 0.0188]),
    fence2x2: enclosureFence('fence-2x2.glb', 'Enclosure fence 2×2', [0.875, 0.27, 0.8375], [0, 0.135, 0.0188]),
    fence2x3: enclosureFence('fence-2x3.glb', 'Enclosure fence 2×3', [1.275, 0.27, 0.8375], [0, 0.135, 0.0188]),
    fence3x2: enclosureFence('fence-3x2.glb', 'Enclosure fence 3×2', [0.875, 0.27, 1.2375], [0, 0.135, 0.0188]),
    fence3x3: enclosureFence('fence-3x3.glb', 'Enclosure fence 3×3', [1.275, 0.27, 1.2375], [0, 0.135, 0.0188]),
    sign: {
        label: 'Warning sign', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road',
        file: 'road-sign-warning.glb',
        dimensions: [0.0773, 0.4986, 0.1472],
        center: [-0.0126, 0.2493, 0],
        scale: 5,
        yaw: 0
    },
    hangingSignPost: {
        label: 'Hanging sign post', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'road-sign-empty-hanging.glb',
        dimensions: [0.09, 0.475, 0.295], center: [0, 0.2375, -0.1025], scale: 8, yaw: 0, groundOffset: 0,
        colliderBoxes: [
            { dimensions: [0.09, 0.425, 0.09], center: [0, 0.2125, 0.1025] },
            { dimensions: [0.045, 0.06, 0.275], center: [0, 0.445, -0.01] }
        ]
    },
    hangingTrafficLight: {
        label: 'Hanging traffic light', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'traffic-light-hanging.glb',
        dimensions: [0.1176, 0.5091, 0.295], center: [-0.0138, 0.2545, -0.1025], scale: 8, yaw: 0, groundOffset: 0,
        colliderBoxes: [
            { dimensions: [0.09, 0.425, 0.09], center: [0.0138, 0.2125, 0.1025] },
            { dimensions: [0.045, 0.06, 0.275], center: [0.0138, 0.445, -0.01] },
            { dimensions: [0.1176, 0.1432, 0.075], center: [0, 0.4375, -0.11] }
        ]
    },
    highwaySign: highwaySign('sign-highway.glb', 'Highway sign', 0.7074),
    highwaySignWide: highwaySign('sign-highway-wide.glb', 'Wide highway sign', 0.7074),
    highwaySignDetailed: highwaySign('sign-highway-detailed.glb', 'Detailed highway sign', 0.8221),
    stopSign: {
        label: 'Stop sign', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'road-sign-stop.glb',
        dimensions: [0.0775, 0.4941, 0.1382], center: [-0.0127, 0.247, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    streetSign: {
        label: 'Street sign', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'road-sign-street.glb',
        dimensions: [0.1963, 0.475, 0.1962], center: [-0.0731, 0.2375, 0.0731], scale: 5, yaw: 0, groundOffset: 0
    },
    signPost: {
        label: 'Sign post', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'road-sign-empty.glb',
        dimensions: [0.05, 0.475, 0.05], center: [0, 0.2375, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    // Only the ground-mounted pole blocks cars; the overhead lamp arms are scenery.
    streetlightCurved: {
        label: 'Curved streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-curved.glb',
        dimensions: [0.05, 0.675, 0.225], center: [0, 0.3375, -0.0875], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.55, 0.05], center: [0, 0.275, 0.0875] }
    },
    streetlightCurvedDouble: {
        label: 'Double curved streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-curved-double.glb',
        dimensions: [0.05, 0.675, 0.4], center: [0, 0.3375, 0], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.55, 0.05], center: [0, 0.275, 0] }
    },
    streetlightCurvedCross: {
        label: 'Four-arm curved streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-curved-cross.glb',
        dimensions: [0.4, 0.675, 0.4], center: [0, 0.3375, 0], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.55, 0.05], center: [0, 0.275, 0] }
    },
    streetlightSquare: {
        label: 'Square streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-square.glb',
        dimensions: [0.05, 0.6, 0.2375], center: [0, 0.3, -0.0938], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.5, 0.05], center: [0, 0.25, 0.0938] }
    },
    streetlightSquareDouble: {
        label: 'Double square streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-square-double.glb',
        dimensions: [0.05, 0.6, 0.425], center: [0, 0.3, 0], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.5, 0.05], center: [0, 0.25, 0] }
    },
    streetlightSquareCross: {
        label: 'Four-arm square streetlight', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'light-square-cross.glb',
        dimensions: [0.425, 0.6, 0.425], center: [0, 0.3, 0], scale: 5, yaw: 0, groundOffset: 0,
        collider: { dimensions: [0.05, 0.5, 0.05], center: [0, 0.25, 0] }
    },
    trafficLight: {
        label: 'Traffic light', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'traffic-light.glb',
        dimensions: [0.1176, 0.515, 0.09], center: [-0.0138, 0.2575, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    dumpster: {
        label: 'Dumpster', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'dumpster.glb',
        dimensions: [0.275, 0.2094, 0.37], center: [0.0075, 0.1047, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    constructionBarrier: {
        label: 'Construction barrier', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'construction-barrier.glb',
        dimensions: [0.1355, 0.13, 0.225], center: [0, 0.065, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    constructionCone: {
        label: 'Construction cone', category: 'Props & barriers', body: 'dynamic', mass: 8, impactKind: 'small',
        pack: 'city-kit-road', file: 'construction-cone.glb',
        dimensions: [0.075, 0.0938, 0.075], center: [0, 0.0469, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    constructionFence: {
        label: 'Construction fence', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'construction-fence.glb',
        dimensions: [0.075, 0.1787, 0.375], center: [0, 0.0894, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    constructionLight: {
        label: 'Construction light', category: 'Props & barriers', body: 'static',
        pack: 'city-kit-road', file: 'construction-light.glb',
        dimensions: [0.075, 0.2337, 0.075], center: [0, 0.1169, 0], scale: 5, yaw: 0, groundOffset: 0
    },
    road: {
        label: 'Straight road', category: 'Roads',
        pack: 'city-kit-road',
        file: 'road-straight.glb',
        dimensions: [1, 0.02, 1],
        center: [0, 0.01, 0],
        scale: 5,
        yaw: 0
    },
    roadBend: {
        label: 'Road bend', category: 'Roads',
        pack: 'city-kit-road', file: 'road-bend.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    },
    roadIntersection: {
        label: 'T junction', category: 'Roads',
        pack: 'city-kit-road', file: 'road-intersection.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    },
    roadCrossroad: {
        label: 'Crossroads', category: 'Roads',
        pack: 'city-kit-road', file: 'road-crossroad.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    },
    roadCrossing: flatRoad('road-crossing.glb', 'Pedestrian crossing'),
    roadEnd: flatRoad('road-end.glb', 'Road end'),
    roadEndRound: flatRoad('road-end-round.glb', 'Rounded road end'),
    roadBendSquare: flatRoad('road-bend-square.glb', 'Square road bend'),
    roadBendSidewalk: flatRoad('road-bend-sidewalk.glb', 'Sidewalk road bend'),
    roadCrossroadLine: flatRoad('road-crossroad-line.glb', 'Marked crossroads'),
    roadCrossroadPath: flatRoad('road-crossroad-path.glb', 'Crossroads with crossings'),
    roadIntersectionLine: flatRoad('road-intersection-line.glb', 'Marked T junction'),
    roadIntersectionPath: flatRoad('road-intersection-path.glb', 'T junction with crossings'),
    roadDrivewaySingle: flatRoad('road-driveway-single.glb', 'Single driveway entrance'),
    roadDrivewayDouble: flatRoad('road-driveway-double.glb', 'Double driveway entrance'),
    roadSquare: flatRoad('road-square.glb', 'Paved plaza tile'),
    roadCurve: extendedRoad('road-curve.glb', 'Large road curve', [2, 0.02, 2]),
    roadCurveIntersection: extendedRoad('road-curve-intersection.glb', 'Large curve junction', [2, 0.02, 2]),
    roadCurvePavement: extendedRoad('road-curve-pavement.glb', 'Large paved curve', [2, 0.02, 2]),
    roadRoundabout: extendedRoad('road-roundabout.glb', 'Roundabout', [3, 0.02, 3]),
    roadSide: extendedRoad('road-side.glb', 'Wide-side road', [1, 0.02, 1.31], [0, 0.01, -0.155]),
    roadSideEntry: extendedRoad('road-side-entry.glb', 'Wide-side entry', [1, 0.02, 1.31], [0, 0.01, -0.155]),
    roadSideExit: extendedRoad('road-side-exit.glb', 'Wide-side exit', [1, 0.02, 1.31], [0, 0.01, -0.155]),
    roadSplit: extendedRoad('road-split.glb', 'Road split', [1, 0.02, 2]),
    roadHalf: extendedRoad('road-straight-half.glb', 'Half straight road', [0.5, 0.02, 1]),
    tileLow: flatRoad('tile-low.glb', 'Plain ground tile'),
    barrierBend: roadBarrier('road-bend-barrier.glb', 'Curved bend rails'),
    barrierBendSquare: roadBarrier('road-bend-square-barrier.glb', 'Square bend rails'),
    barrierCrossroad: roadBarrier('road-crossroad-barrier.glb', 'Crossroads rails'),
    barrierCurve: roadBarrier('road-curve-barrier.glb', 'Large curve rails', [2, 0.08, 2]),
    barrierCurveIntersection: roadBarrier('road-curve-intersection-barrier.glb', 'Large curve junction rails', [2, 0.08, 2]),
    barrierDrivewayDouble: roadBarrier('road-driveway-double-barrier.glb', 'Double driveway rails'),
    barrierDrivewaySingle: roadBarrier('road-driveway-single-barrier.glb', 'Single driveway rails'),
    barrierEnd: roadBarrier('road-end-barrier.glb', 'Road end rails'),
    barrierEndRound: roadBarrier('road-end-round-barrier.glb', 'Rounded road end rails'),
    barrierIntersection: roadBarrier('road-intersection-barrier.glb', 'T junction rails'),
    barrierRoundabout: roadBarrier('road-roundabout-barrier.glb', 'Roundabout rails', [3, 0.08, 3]),
    barrierSide: roadBarrier('road-side-barrier.glb', 'Wide-side rails', [1.31, 0.08, 1], [-0.155, 0.04, 0]),
    barrierSideEntry: roadBarrier('road-side-entry-barrier.glb', 'Wide-side entry rails', [1.31, 0.08, 1], [-0.155, 0.04, 0]),
    barrierSideExit: roadBarrier('road-side-exit-barrier.glb', 'Wide-side exit rails', [1.31, 0.08, 1], [-0.155, 0.04, 0]),
    barrierSplit: roadBarrier('road-split-barrier.glb', 'Split road rails', [1, 0.08, 2]),
    barrierSquare: roadBarrier('road-square-barrier.glb', 'Plaza perimeter rails'),
    barrierStraightEnd: roadBarrier('road-straight-barrier-end.glb', 'Short-ended straight rails'),
    barrierHalf: roadBarrier('road-straight-barrier-half.glb', 'Half straight rails', [1, 0.08, 0.5]),
    barrierStraight: roadBarrier('road-straight-barrier.glb', 'Straight road rails'),
    // Suburban variants use the same 6x scale as the original house and trees.
    // Static vertex bounds and ground offsets measured with inspect-glb.
    houseA: {
        label: 'House A', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-a.glb',
        dimensions: [1.3, 0.8335, 1.0281], center: [0, 0.4168, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseC: {
        label: 'House C', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-c.glb',
        dimensions: [1.2864, 1.0335, 1.0281], center: [0, 0.5168, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseD: {
        label: 'House D', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-d.glb',
        dimensions: [1.7564, 1.2375, 1.028], center: [0, 0.6188, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseF: {
        label: 'House F', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-f.glb',
        dimensions: [1.428, 1.1375, 1.4059], center: [0, 0.5688, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseG: {
        label: 'House G', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-g.glb',
        dimensions: [1.45, 0.7682, 1.178], center: [0, 0.3841, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseH: {
        label: 'House H', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-h.glb',
        dimensions: [1.3, 0.7375, 0.916], center: [0, 0.3687, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseI: {
        label: 'House I', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-i.glb',
        dimensions: [1.2864, 0.7375, 1.028], center: [0, 0.3687, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseJ: {
        label: 'House J', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-j.glb',
        dimensions: [1.37, 1.0375, 0.916], center: [0, 0.5188, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseK: {
        label: 'House K', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-k.glb',
        dimensions: [0.9209, 1.1496, 1.02], center: [0, 0.5748, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseL: {
        label: 'House L', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-l.glb',
        dimensions: [1.0336, 1.0492, 1.02], center: [0, 0.5246, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseM: {
        label: 'House M', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-m.glb',
        dimensions: [1.428, 0.7375, 1.428], center: [0, 0.3687, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseN: {
        label: 'House N', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-n.glb',
        dimensions: [1.7843, 1.1375, 1.3779], center: [0, 0.5688, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseO: {
        label: 'House O', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-o.glb',
        dimensions: [1.27, 1.1375, 1.028], center: [0, 0.5688, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseP: {
        label: 'House P', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-p.glb',
        dimensions: [1.24, 0.918, 0.99], center: [0, 0.459, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseQ: {
        label: 'House Q', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-q.glb',
        dimensions: [1.24, 0.918, 0.8856], center: [0, 0.459, 0.0208], scale: 6, yaw: 0, groundOffset: 0
    },
    houseR: {
        label: 'House R', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-r.glb',
        dimensions: [1.028, 1.1411, 1.02], center: [0, 0.5706, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseS: {
        label: 'House S', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-s.glb',
        dimensions: [1.406, 1.1375, 1.0864], center: [0, 0.5688, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseT: {
        label: 'House T', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-t.glb',
        dimensions: [1.3136, 1.1563, 1.4064], center: [-0.0068, 0.5782, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    houseU: {
        label: 'House U', category: 'Buildings', body: 'static',
        pack: 'city-kit-suburban', file: 'building-type-u.glb',
        dimensions: [1.428, 1.1375, 1.0869], center: [0, 0.5688, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    // Flat decorative overlays require an existing supporting ground/floor.
    pathShort: {
        label: 'Short path', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'path-short.glb',
        dimensions: [0.2, 0.01, 0.2], center: [0, 0.005, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    pathLong: {
        label: 'Long path', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'path-long.glb',
        dimensions: [0.2, 0.01, 0.4], center: [0, 0.005, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    pathStonesShort: {
        label: 'Short stone path', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'path-stones-short.glb',
        dimensions: [0.14, 0.01, 0.2], center: [0, 0.005, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    pathStonesLong: {
        label: 'Long stone path', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'path-stones-long.glb',
        dimensions: [0.14, 0.01, 0.4], center: [0, 0.005, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    pathStonesMessy: {
        label: 'Scattered stone path', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'path-stones-messy.glb',
        dimensions: [0.1556, 0.01, 0.3614], center: [0, 0.005, 0], scale: 6, yaw: 0, groundOffset: 0
    },
    // 8x gives driveways a 2.88 m width, enough for every current player vehicle.
    drivewayShort: {
        label: 'Short driveway', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'driveway-short.glb',
        dimensions: [0.36, 0.01, 0.2], center: [0, 0.005, 0], scale: 8, yaw: 0, groundOffset: 0
    },
    drivewayLong: {
        label: 'Long driveway', category: 'Paths & driveways',
        pack: 'city-kit-suburban', file: 'driveway-long.glb',
        dimensions: [0.36, 0.01, 0.4], center: [0, 0.005, 0], scale: 8, yaw: 0, groundOffset: 0
    },
    planter: {
        label: 'Garden planter', category: 'Nature', body: 'static',
        pack: 'city-kit-suburban', file: 'planter.glb',
        dimensions: [0.4, 0.1771, 0.3], center: [0, 0.0886, -0.0006], scale: 6, yaw: 0, groundOffset: 0
    }
};

export function assetUrl(definition: AssetDefinition) {
    return `${import.meta.env.BASE_URL}assets/kenney/${definition.pack}/${definition.file}`;
}

export function assetPreviewUrl(definition: AssetDefinition) {
    return `${import.meta.env.BASE_URL}assets/kenney/${definition.pack}/preview/${definition.file.replace(/\.glb$/, '.png')}`;
}

export const CAR_WIDTH = ASSETS.sedan.dimensions[0] * ASSETS.sedan.scale;
export const CAR_LENGTH = 4.2;

// Unscaled axle separation and wheel radius measured from the GLB wheel nodes.
export const VEHICLE_TUNING: Record<PlayerVehicle, { label: string; wheelbase: number; wheelRadius: number }> = {
    sedan: { label: 'Sedan', wheelbase: 1.32, wheelRadius: 0.3 },
    suv: { label: 'SUV', wheelbase: 1.32, wheelRadius: 0.3 },
    taxi: { label: 'Taxi', wheelbase: 1.52, wheelRadius: 0.3 },
    hatchbackSports: { label: 'Sports hatchback', wheelbase: 1.62, wheelRadius: 0.3 },
    sedanSports: { label: 'Sports sedan', wheelbase: 1.32, wheelRadius: 0.3 },
    van: { label: 'Van', wheelbase: 1.52, wheelRadius: 0.3 },
    pickup: { label: 'Pickup', wheelbase: 1.62, wheelRadius: 0.3 }
};

export function vehicleGeometry(vehicle: PlayerVehicle = 'sedan') {
    const asset = ASSETS[vehicle];
    return { width: asset.dimensions[0] * asset.scale, height: asset.dimensions[1] * asset.scale,
        length: asset.dimensions[2] * asset.scale, wheelbase: VEHICLE_TUNING[vehicle].wheelbase * asset.scale,
        wheelRadius: VEHICLE_TUNING[vehicle].wheelRadius * asset.scale };
}
