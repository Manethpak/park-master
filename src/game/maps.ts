import { ASSETS, vehicleGeometry } from './assets.ts';
import type { LevelDefinition, MapDefinition, ParkingBay, RoadAsset, RoadTile } from './types.ts';

export const ROAD_SIZE = 5;
export const DRAFT_KEY = 'park-master.map-draft.v1';
export const OBJECT_BODIES: Record<string, 'static' | 'dynamic' | undefined> = {
    sedan: 'static', suv: 'static', taxi: 'static', house: 'static', houseWide: 'static',
    fence: 'static', sign: 'static', cone: 'dynamic', box: 'dynamic', tree: undefined, treeSmall: undefined
};
export const ROAD_ASSETS: Record<RoadAsset, { label: string; ports: number[] }> = {
    // Edge lane geometry measured in the source GLBs. Directions: +Z, +X, -Z, -X.
    road: { label: 'Straight road', ports: [1, 3] },
    roadBend: { label: 'Road bend', ports: [0, 3] },
    roadIntersection: { label: 'T junction', ports: [0, 1, 3] },
    roadCrossroad: { label: 'Crossroads', ports: [0, 1, 2, 3] }
};

export function roadPosition(map: MapDefinition, road: RoadTile): [number, number] {
    return [map.grid.origin[0] + road.cell[0] * ROAD_SIZE, map.grid.origin[1] + road.cell[1] * ROAD_SIZE];
}

export function roadPorts(road: RoadTile) {
    return ROAD_ASSETS[road.asset].ports.map((port) => (port + road.rotation / 90) % 4);
}

/** One conversion path for imported files, the editor, and gameplay. */
export function resolveMap(map: MapDefinition): LevelDefinition {
    return {
        id: map.id, name: map.name, timeLimit: map.timeLimit, impactPenalty: map.impactPenalty,
        spawn: structuredClone(map.spawn), bay: structuredClone(map.bay),
        playerVehicle: map.playerVehicle, playableZone: map.playableZone && { ...map.playableZone },
        objects: [
            ...structuredClone(map.objects),
            ...map.roads.map((road) => {
                const [x, z] = roadPosition(map, road);
                return { id: road.id, asset: road.asset, position: [x, -0.092, z] as [number, number, number], heading: road.rotation };
            })
        ],
        surfaces: [
            ...structuredClone(map.surfaces),
            ...map.roads.map((road) => {
                const [x, z] = roadPosition(map, road);
                return { id: `road-support-${road.id}`, position: [x, -0.15, z] as [number, number, number], size: [5, 0.3, 5] as [number, number, number], heading: 0, color: '#747d7c', solid: true, support: true };
            })
        ],
        parkingBays: structuredClone(map.parkingBays)
    };
}

/** Validate untrusted JSON before it can reach asset loading or physics. */
export function parseMap(value: unknown): MapDefinition {
    const fail = (message: string): never => { throw new Error(message); };
    const record = (v: unknown, path: string): Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail(`${path} must be an object.`);
    const number = (v: unknown, path: string, min = -500, max = 500): number =>
        typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail(`${path} must be a finite number between ${min} and ${max}.`);
    const string = (v: unknown, path: string): string =>
        typeof v === 'string' && v.trim().length > 0 && v.length <= 100 ? v : fail(`${path} must be a nonempty string, at most 100 characters.`);
    const boolean = (v: unknown, path: string): boolean => typeof v === 'boolean' ? v : fail(`${path} must be true or false.`);
    const tuple = (v: unknown, path: string, count: number, min = -500): number[] => {
        if (!Array.isArray(v) || v.length !== count) fail(`${path} must contain ${count} numbers.`);
        return (v as unknown[]).map((n, i) => number(n, `${path}[${i}]`, min));
    };
    const array = (v: unknown, path: string): unknown[] => Array.isArray(v) && v.length <= 2000 ? v : fail(`${path} must be an array with at most 2000 entries.`);
    const ids = new Set(['player', 'camera', 'sun', 'parking-target', 'spawn', 'target']);
    const id = (v: unknown, path: string): string => {
        const result = string(v, path);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(result) || result.startsWith('road-support-') || result.startsWith('zone-boundary-') || result === 'playable-zone') fail(`${path} contains an unsupported or reserved ID.`);
        if (ids.has(result)) fail(`Duplicate or reserved ID: ${result}.`);
        ids.add(result);
        return result;
    };
    const heading = (v: unknown, path: string) => number(v, path, -360, 360);
    const bay = (v: unknown, path: string): ParkingBay => {
        const b = record(v, path);
        return { x: number(b.x, `${path}.x`), z: number(b.z, `${path}.z`), width: number(b.width, `${path}.width`, 0.1), length: number(b.length, `${path}.length`, 0.1), heading: heading(b.heading, `${path}.heading`) };
    };
    const m = record(value, 'Map');
    if (m.schemaVersion !== 1) fail('Unsupported schemaVersion. Expected 1.');
    if (m.timeLimit !== 90 || m.impactPenalty !== 50) fail('Levels must use a 90-second attempt and a 50-point impact penalty.');
    const grid = record(m.grid, 'grid');
    if (grid.cellSize !== ROAD_SIZE) fail('Road cellSize must be 5 metres to match the calibrated tiles.');
    const spawn = record(m.spawn, 'spawn');
    const target = bay(m.bay, 'bay');
    if (m.playerVehicle !== undefined && !['sedan', 'suv', 'taxi'].includes(m.playerVehicle as string)) fail('Unsupported player vehicle.');
    const vehicle = vehicleGeometry(m.playerVehicle as MapDefinition['playerVehicle']);
    if (target.width < vehicle.width || target.length < vehicle.length) fail('The target bay must fit the entire player car.');
    const occupied = new Set<string>();
    const map: MapDefinition = {
        schemaVersion: 1, id: string(m.id, 'id'), name: string(m.name, 'name'), timeLimit: 90, impactPenalty: 50,
        grid: { cellSize: ROAD_SIZE, origin: tuple(grid.origin, 'grid.origin', 2) as [number, number] },
        spawn: { position: tuple(spawn.position, 'spawn.position', 3) as [number, number, number], heading: heading(spawn.heading, 'spawn.heading') },
        bay: target,
        roads: array(m.roads, 'roads').map((value, i) => {
            const r = record(value, `roads[${i}]`);
            if (typeof r.asset !== 'string' || !Object.hasOwn(ROAD_ASSETS, r.asset)) fail(`roads[${i}].asset is not a supported road tile.`);
            const cell = tuple(r.cell, `roads[${i}].cell`, 2, -100) as [number, number];
            if (!cell.every((n) => Number.isInteger(n) && n <= 100)) fail('Road cells must be integers between -100 and 100.');
            if (occupied.has(cell.join(','))) fail(`Two roads occupy cell ${cell.join(',')}.`);
            occupied.add(cell.join(','));
            if (![0, 90, 180, 270].includes(r.rotation as number)) fail('Road rotation must be 0, 90, 180, or 270 degrees.');
            const result = { id: id(r.id, `roads[${i}].id`), asset: r.asset as RoadAsset, cell, rotation: r.rotation as number };
            const position = roadPosition({ grid: { origin: grid.origin as [number, number], cellSize: 5 } } as MapDefinition, result);
            position.forEach((n) => number(n, 'Road world position'));
            return result;
        }),
        objects: array(m.objects, 'objects').map((value, i) => {
            const o = record(value, `objects[${i}]`);
            if (typeof o.asset !== 'string' || !Object.hasOwn(ASSETS, o.asset) || Object.hasOwn(ROAD_ASSETS, o.asset)) fail(`objects[${i}].asset is not a supported prop.`);
            if (o.body !== OBJECT_BODIES[o.asset as string]) fail(`objects[${i}].body must match the asset: ${OBJECT_BODIES[o.asset as string] || 'decoration'}.`);
            return { id: id(o.id, `objects[${i}].id`), asset: o.asset as string, position: tuple(o.position, `objects[${i}].position`, 3) as [number, number, number], heading: heading(o.heading, `objects[${i}].heading`), ...(o.body ? { body: o.body as 'static' | 'dynamic' } : {}), ...(o.mass !== undefined ? { mass: number(o.mass, `objects[${i}].mass`, 0.1, 10000) } : {}) };
        }),
        surfaces: array(m.surfaces, 'surfaces').map((value, i) => {
            const s = record(value, `surfaces[${i}]`);
            if (typeof s.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.color)) fail('Surface color must use #RRGGBB.');
            const solid = boolean(s.solid, `surfaces[${i}].solid`);
            const support = boolean(s.support, `surfaces[${i}].support`);
            if (support && !solid) fail('A supporting surface must be solid.');
            return { id: id(s.id, `surfaces[${i}].id`), position: tuple(s.position, `surfaces[${i}].position`, 3) as [number, number, number], size: tuple(s.size, `surfaces[${i}].size`, 3, 0.01) as [number, number, number], heading: heading(s.heading, `surfaces[${i}].heading`), color: s.color as string, solid, support };
        }),
        parkingBays: array(m.parkingBays, 'parkingBays').map((value, i) => {
            const b = record(value, `parkingBays[${i}]`);
            return { ...bay(b, `parkingBays[${i}]`), id: id(b.id, `parkingBays[${i}].id`), wheelStop: boolean(b.wheelStop, `parkingBays[${i}].wheelStop`) };
        })
    };
    if (m.playerVehicle !== undefined) map.playerVehicle = m.playerVehicle as MapDefinition['playerVehicle'];
    if (m.playableZone !== undefined) {
        const zone = record(m.playableZone, 'playableZone');
        map.playableZone = { x: number(zone.x, 'playableZone.x'), z: number(zone.z, 'playableZone.z'), width: number(zone.width, 'playableZone.width', 5, 500), length: number(zone.length, 'playableZone.length', 5, 500) };
    }
    if (map.objects.length + map.roads.length + map.surfaces.length + map.parkingBays.length > 2000) fail('A map can contain at most 2000 items.');
    return map;
}

export function readMapJson(text: string) {
    if (text.length > 2_000_000) throw new Error('The map file must be smaller than 2 MB.');
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
    return parseMap(value);
}

export function mapWarnings(map: MapDefinition): string[] {
    const warnings: string[] = [];
    const cells = new Map(map.roads.map((r) => [r.cell.join(','), r]));
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (const road of map.roads) {
        const ports = roadPorts(road);
        for (let direction = 0; direction < 2; direction++) {
            const [dx, dz] = directions[direction];
            const neighbor = cells.get([road.cell[0] + dx, road.cell[1] + dz].join(','));
            if (neighbor && ports.includes(direction) !== roadPorts(neighbor).includes((direction + 2) % 4)) warnings.push(`${road.id} and ${neighbor.id}: lanes do not connect.`);
        }
    }
    if (!map.surfaces.some((s) => s.support)) warnings.push('Add a solid ground surface to support the car and props.');
    return warnings;
}

export function footprintInside(zone: NonNullable<MapDefinition['playableZone']>, x: number, z: number, width: number, length: number, heading = 0) {
    const angle = heading * Math.PI / 180;
    const halfX = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * length) / 2;
    const halfZ = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * length) / 2;
    return Math.abs(x - zone.x) + halfX <= zone.width / 2 && Math.abs(z - zone.z) + halfZ <= zone.length / 2;
}

export function mapErrors(map: MapDefinition): string[] {
    const zone = map.playableZone;
    if (!zone) return [];
    const errors: string[] = [];
    const vehicle = vehicleGeometry(map.playerVehicle);
    if (!footprintInside(zone, map.spawn.position[0], map.spawn.position[2], vehicle.width, vehicle.length, map.spawn.heading)) errors.push('Player spawn must fit entirely inside the playable zone.');
    if (!footprintInside(zone, map.bay.x, map.bay.z, map.bay.width, map.bay.length, map.bay.heading)) errors.push('Target bay must fit entirely inside the playable zone.');
    return errors;
}
