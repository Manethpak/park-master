import type { AssetDefinition } from './types.ts';

// Vertex bounds measured with the project's offline GLB inspector. Facing is +Z.
export const ASSETS: Record<string, AssetDefinition> = {
    sedan: {
        pack: 'car-kit',
        file: 'sedan.glb',
        dimensions: [1.5, 1.3, 2.55],
        center: [0, 0.65, -0.025],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    suv: {
        pack: 'car-kit',
        file: 'suv.glb',
        dimensions: [1.5, 1.3, 2.7],
        center: [0, 0.65, 0],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    taxi: {
        pack: 'car-kit',
        file: 'taxi.glb',
        dimensions: [1.5, 1.5, 2.75],
        center: [0, 0.75, -0.025],
        scale: 4.2 / 2.55,
        yaw: 0
    },
    cone: {
        pack: 'car-kit',
        file: 'cone.glb',
        dimensions: [0.4762, 0.5952, 0.4762],
        center: [0, 0.2976, 0],
        scale: 1.2,
        yaw: 0
    },
    box: {
        pack: 'car-kit',
        file: 'box.glb',
        dimensions: [0.715, 0.715, 0.715],
        center: [0, 0.3575, 0],
        scale: 1.2,
        yaw: 0
    },
    house: {
        pack: 'city-kit-suburban',
        file: 'building-type-e.glb',
        dimensions: [1.3, 1.1375, 1.028],
        center: [0, 0.5688, 0],
        scale: 6,
        yaw: 0
    },
    houseWide: {
        pack: 'city-kit-suburban',
        file: 'building-type-b.glb',
        dimensions: [1.828, 1.1375, 1.14],
        center: [0, 0.5688, 0],
        scale: 5,
        yaw: 0
    },
    tree: {
        pack: 'city-kit-suburban',
        file: 'tree-large.glb',
        dimensions: [0.2104, 0.767, 0.243],
        center: [0, 0.3835, 0],
        scale: 6,
        yaw: 0
    },
    treeSmall: {
        pack: 'city-kit-suburban',
        file: 'tree-small.glb',
        dimensions: [0.2104, 0.567, 0.243],
        center: [0, 0.2835, 0],
        scale: 6,
        yaw: 0
    },
    fence: {
        pack: 'city-kit-suburban',
        file: 'fence.glb',
        dimensions: [0.475, 0.27, 0.075],
        center: [0, 0.135, 0],
        scale: 6,
        yaw: 0
    },
    sign: {
        pack: 'city-kit-road',
        file: 'road-sign-warning.glb',
        dimensions: [0.0773, 0.4986, 0.1472],
        center: [-0.0126, 0.2493, 0],
        scale: 5,
        yaw: 0
    },
    road: {
        pack: 'city-kit-road',
        file: 'road-straight.glb',
        dimensions: [1, 0.02, 1],
        center: [0, 0.01, 0],
        scale: 5,
        yaw: 0
    },
    roadBend: {
        pack: 'city-kit-road', file: 'road-bend.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    },
    roadIntersection: {
        pack: 'city-kit-road', file: 'road-intersection.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    },
    roadCrossroad: {
        pack: 'city-kit-road', file: 'road-crossroad.glb',
        dimensions: [1, 0.02, 1], center: [0, 0.01, 0], scale: 5, yaw: 0
    }
};

export function assetUrl(definition: AssetDefinition) {
    return `${import.meta.env.BASE_URL}assets/kenney/${definition.pack}/${definition.file}`;
}

export const CAR_WIDTH = ASSETS.sedan.dimensions[0] * ASSETS.sedan.scale;
export const CAR_LENGTH = 4.2;
