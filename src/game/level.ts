import type { LevelDefinition, SceneObject } from './types.ts';

const objects: SceneObject[] = [
    { id: 'parked-left', asset: 'sedan', position: [0.3, 0, -8.1], heading: 0, body: 'static' },
    { id: 'parked-right', asset: 'suv', position: [8.1, 0, -8.1], heading: 0, body: 'static' },
    { id: 'parked-entrance', asset: 'taxi', position: [-2.6, 0, 7.5], heading: 180, body: 'static' },
    { id: 'island-tree', asset: 'treeSmall', position: [-6.1, 0.44, -0.8], heading: 0 },
    { id: 'warning-sign', asset: 'sign', position: [-3.7, 0, 5.8], heading: 90, body: 'static' },
    { id: 'cone-1', asset: 'cone', position: [-6.1, 0, 3.7], heading: 0, body: 'dynamic', mass: 8 },
    { id: 'cone-2', asset: 'cone', position: [-1.5, 0, -2.4], heading: 0, body: 'dynamic', mass: 8 },
    { id: 'cone-3', asset: 'cone', position: [9.8, 0, -3], heading: 0, body: 'dynamic', mass: 8 },
    { id: 'box-1', asset: 'box', position: [10.2, 0, 0.3], heading: 15, body: 'dynamic', mass: 16 },
    { id: 'box-2', asset: 'box', position: [11.2, 0, 0.5], heading: -10, body: 'dynamic', mass: 16 },
    { id: 'house-west', asset: 'house', position: [-16, 0, -6], heading: 90, body: 'static' },
    { id: 'house-north', asset: 'houseWide', position: [2, 0, -18], heading: 0, body: 'static' },
    { id: 'house-east', asset: 'house', position: [18.5, 0, -2.5], heading: -90, body: 'static' }
];

for (let i = 0; i < 8; i++) {
    objects.push({
        id: `fence-north-${i}`,
        asset: 'fence',
        position: [-9.1 + i * 2.85, 0, -12],
        heading: 0,
        body: 'static'
    });
}
for (let i = 0; i < 5; i++) {
    objects.push({
        id: `fence-entry-${i}`,
        asset: 'fence',
        position: [-9.8, 0, 5 + i * 2.85],
        heading: 90,
        body: 'static'
    });
}
for (const [i, [x, z]] of [
    [-12.5, 2],
    [-12.5, -12],
    [12.8, -12],
    [14.8, 4],
    [-14, 13],
    [5, -15],
    [14.5, 11]
].entries()) {
    objects.push({ id: `tree-${i}`, asset: i % 2 ? 'treeSmall' : 'tree', position: [x, 0, z], heading: i * 37 });
}
for (let i = 0; i < 3; i++) {
    objects.push({ id: `road-entry-${i}`, asset: 'road', position: [-7.1, -0.092, 7.5 + i * 5], heading: 0 });
}

export const COURTYARD: LevelDefinition = {
    id: 'courtyard-01',
    name: 'The Courtyard',
    timeLimit: 90,
    impactPenalty: 50,
    spawn: { position: [-7.1, 0, 14], heading: 180 },
    bay: { x: 4.2, z: -8.1, width: 3.4, length: 5.7, heading: 0 },
    objects
};
