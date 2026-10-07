import { ASSETS, vehicleGeometry } from './assets.ts';
import { PLAYER_VEHICLES } from './types.ts';
import type { LevelDefinition, MapDefinition, ParkingBay, RoadAsset, RoadTile } from './types.ts';

export const ROAD_SIZE = 5;
export const DRAFT_KEY = 'park-master.map-draft.v1';
export const OBJECT_BODIES = Object.fromEntries(Object.entries(ASSETS).filter(([, asset]) => asset.category !== 'Roads').map(([id, asset]) => [id, asset.body]));
export const ROAD_ASSETS: Record<RoadAsset, { label: string; ports: number[]; offsets?: Partial<Record<number, number[]>> }> = {
    // Edge lane geometry measured in the source GLBs. Directions: +Z, +X, -Z, -X.
    road: { label: ASSETS.road.label, ports: [1, 3] },
    roadBend: { label: ASSETS.roadBend.label, ports: [0, 3] },
    roadIntersection: { label: ASSETS.roadIntersection.label, ports: [0, 1, 3] },
    roadCrossroad: { label: ASSETS.roadCrossroad.label, ports: [0, 1, 2, 3] },
    roadCrossing: { label: ASSETS.roadCrossing.label, ports: [1, 3] },
    roadEnd: { label: ASSETS.roadEnd.label, ports: [1] },
    roadEndRound: { label: ASSETS.roadEndRound.label, ports: [1] },
    roadBendSquare: { label: ASSETS.roadBendSquare.label, ports: [0, 3] },
    roadBendSidewalk: { label: ASSETS.roadBendSidewalk.label, ports: [0, 3] },
    roadCrossroadLine: { label: ASSETS.roadCrossroadLine.label, ports: [0, 1, 2, 3] },
    roadCrossroadPath: { label: ASSETS.roadCrossroadPath.label, ports: [0, 1, 2, 3] },
    roadIntersectionLine: { label: ASSETS.roadIntersectionLine.label, ports: [0, 1, 3] },
    roadIntersectionPath: { label: ASSETS.roadIntersectionPath.label, ports: [0, 1, 3] },
    // Curb cuts are driveways, not additional full-width road-lane ports.
    roadDrivewaySingle: { label: ASSETS.roadDrivewaySingle.label, ports: [1, 3] },
    roadDrivewayDouble: { label: ASSETS.roadDrivewayDouble.label, ports: [1, 3] },
    roadSquare: { label: ASSETS.roadSquare.label, ports: [] },
    roadCurve: { label: ASSETS.roadCurve.label, ports: [0, 3], offsets: { 0: [0.5], 3: [-0.5] } },
    roadCurveIntersection: { label: ASSETS.roadCurveIntersection.label, ports: [0, 1, 3], offsets: { 0: [0.5], 1: [-0.5], 3: [-0.5] } },
    roadCurvePavement: { label: ASSETS.roadCurvePavement.label, ports: [0, 3], offsets: { 0: [0.5], 3: [-0.5] } },
    roadRoundabout: { label: ASSETS.roadRoundabout.label, ports: [0, 1, 2, 3] },
    roadSide: { label: ASSETS.roadSide.label, ports: [1, 3] },
    roadSideEntry: { label: ASSETS.roadSideEntry.label, ports: [1, 3] },
    roadSideExit: { label: ASSETS.roadSideExit.label, ports: [1, 3] },
    roadSplit: { label: ASSETS.roadSplit.label, ports: [1, 3], offsets: { 3: [-0.5, 0.5] } },
    roadHalf: { label: ASSETS.roadHalf.label, ports: [1, 3] },
    tileLow: { label: ASSETS.tileLow.label, ports: [] }
};

function rotateRoadPoint(x: number, z: number, rotation: number): [number, number] {
    const angle = rotation * Math.PI / 180;
    return [x * Math.cos(angle) + z * Math.sin(angle), z * Math.cos(angle) - x * Math.sin(angle)];
}

/** Keep authored lane pivots on the grid; compensated visuals/supports share this centre. */
export function roadPosition(map: MapDefinition, road: RoadTile): [number, number] {
    const asset = ASSETS[road.asset];
    const offset = rotateRoadPoint(asset.center[0] * asset.scale, asset.center[2] * asset.scale, road.rotation);
    return [map.grid.origin[0] + road.cell[0] * ROAD_SIZE + offset[0], map.grid.origin[1] + road.cell[1] * ROAD_SIZE + offset[1]];
}

export function roadBounds(map: MapDefinition, road: RoadTile) {
    const [x, z] = roadPosition(map, road), asset = ASSETS[road.asset];
    const width = asset.dimensions[road.rotation % 180 === 0 ? 0 : 2] * asset.scale;
    const length = asset.dimensions[road.rotation % 180 === 0 ? 2 : 0] * asset.scale;
    return { minX: x - width / 2, maxX: x + width / 2, minZ: z - length / 2, maxZ: z + length / 2 };
}

export function roadsOverlap(map: MapDefinition, a: RoadTile, b: RoadTile) {
    const aa = roadBounds(map, a), bb = roadBounds(map, b);
    return Math.min(aa.maxX, bb.maxX) - Math.max(aa.minX, bb.minX) > 0.001
        && Math.min(aa.maxZ, bb.maxZ) - Math.max(aa.minZ, bb.minZ) > 0.001;
}

export function roadPortPoints(map: MapDefinition, road: RoadTile) {
    const asset = ASSETS[road.asset], definition = ROAD_ASSETS[road.asset];
    const [x, z] = roadPosition(map, road);
    return definition.ports.flatMap((direction) => (definition.offsets?.[direction] ?? [0]).map((offset) => {
        const localX = direction % 2 ? (direction === 1 ? 1 : -1) * asset.dimensions[0] / 2 : offset - asset.center[0];
        const localZ = direction % 2 ? offset - asset.center[2] : (direction === 0 ? 1 : -1) * asset.dimensions[2] / 2;
        const point = rotateRoadPoint(localX * asset.scale, localZ * asset.scale, road.rotation);
        return { x: x + point[0], z: z + point[1], direction: (direction + road.rotation / 90) % 4 };
    }));
}

export function roadPorts(road: RoadTile) {
    return ROAD_ASSETS[road.asset].ports.map((port) => (port + road.rotation / 90) % 4);
}

/** One conversion path for imported files, the editor, and gameplay. */
export function resolveMap(map: MapDefinition): LevelDefinition {
    return {
        id: map.id, name: map.name, difficulty: map.difficulty, challenge: map.challenge, campaignOrder: map.campaignOrder, timeLimit: map.timeLimit, impactPenalty: map.impactPenalty, smallImpactPenalty: map.smallImpactPenalty,
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
                const asset = ASSETS[road.asset];
                return { id: `road-support-${road.id}`, position: [x, -0.15, z] as [number, number, number], size: [asset.dimensions[0] * asset.scale, 0.3, asset.dimensions[2] * asset.scale] as [number, number, number], heading: road.rotation, color: '#747d7c', solid: true, support: true };
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
    if (m.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(m.difficulty as string)) fail('Difficulty must be easy, medium, or hard.');
    const integer = (value: unknown, path: string, min: number, max: number) => {
        const result = number(value, path, min, max);
        if (!Number.isInteger(result)) fail(`${path} must be a whole number.`);
        return result;
    };
    // Older v1 files fixed the penalty at 50; retain the newer forgiving defaults.
    const hardPenalty = m.smallImpactPenalty === undefined && m.impactPenalty === 50 ? 25 : m.impactPenalty;
    const grid = record(m.grid, 'grid');
    if (grid.cellSize !== ROAD_SIZE) fail('Road cellSize must be 5 metres to match the calibrated tiles.');
    const spawn = record(m.spawn, 'spawn');
    const target = bay(m.bay, 'bay');
    if (m.playerVehicle !== undefined && !PLAYER_VEHICLES.some((vehicle) => vehicle === m.playerVehicle)) fail('Unsupported player vehicle.');
    const vehicle = vehicleGeometry(m.playerVehicle as MapDefinition['playerVehicle']);
    if (target.width < vehicle.width || target.length < vehicle.length) fail('The target bay must fit the entire player car.');
    const occupied = new Set<string>();
    const map: MapDefinition = {
        schemaVersion: 1, id: string(m.id, 'id'), name: string(m.name, 'name'),
        timeLimit: integer(m.timeLimit, 'timeLimit', 1, 3600),
        impactPenalty: integer(hardPenalty, 'impactPenalty', 0, 1000),
        smallImpactPenalty: integer(m.smallImpactPenalty === undefined ? 10 : m.smallImpactPenalty, 'smallImpactPenalty', 0, 1000),
        grid: { cellSize: ROAD_SIZE, origin: tuple(grid.origin, 'grid.origin', 2) as [number, number] },
        spawn: { position: tuple(spawn.position, 'spawn.position', 3) as [number, number, number], heading: heading(spawn.heading, 'spawn.heading') },
        bay: target,
        roads: array(m.roads, 'roads').map((value, i) => {
            const r = record(value, `roads[${i}]`);
            if (typeof r.asset !== 'string' || !Object.hasOwn(ROAD_ASSETS, r.asset)) fail(`roads[${i}].asset is not a supported road tile.`);
            const cell = tuple(r.cell, `roads[${i}].cell`, 2, -100) as [number, number];
            if (!cell.every((n) => Number.isInteger(n * 4) && n <= 100)) fail('Road cells must use quarter-cell increments between -100 and 100.');
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
    for (let i = 0; i < map.roads.length; i++) for (let j = i + 1; j < map.roads.length; j++) {
        if (roadsOverlap(map, map.roads[i], map.roads[j])) fail(`${map.roads[i].id} and ${map.roads[j].id}: road footprints overlap.`);
    }
    if (m.playerVehicle !== undefined) map.playerVehicle = m.playerVehicle as MapDefinition['playerVehicle'];
    if (m.editorOrder !== undefined) {
        const keys = new Set([
            ...map.surfaces.map((item) => `surface:${item.id}`), ...map.roads.map((item) => `road:${item.id}`),
            ...map.objects.map((item) => `object:${item.id}`), ...map.parkingBays.map((item) => `parking:${item.id}`),
            'spawn:spawn', 'target:target', ...(m.playableZone !== undefined ? ['zone:playable-zone'] : [])
        ]);
        map.editorOrder = [...new Set(array(m.editorOrder, 'editorOrder').map((value, index) => string(value, `editorOrder[${index}]`)).filter((key) => keys.has(key)))];
    }
    if (m.difficulty !== undefined) map.difficulty = m.difficulty as MapDefinition['difficulty'];
    if (m.challenge !== undefined) map.challenge = string(m.challenge, 'challenge');
    if (m.campaignOrder !== undefined) map.campaignOrder = integer(m.campaignOrder, 'campaignOrder', 0, 10000);
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
    for (let i = 0; i < map.roads.length; i++) for (let j = i + 1; j < map.roads.length; j++) {
        const a = map.roads[i], b = map.roads[j], aa = roadBounds(map, a), bb = roadBounds(map, b);
        const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
        const commonZ = Math.min(aa.maxZ, bb.maxZ) - Math.max(aa.minZ, bb.minZ) > 0.001;
        const commonX = Math.min(aa.maxX, bb.maxX) - Math.max(aa.minX, bb.minX) > 0.001;
        const direction = commonZ && near(aa.maxX, bb.minX) ? 1 : commonZ && near(aa.minX, bb.maxX) ? 3
            : commonX && near(aa.maxZ, bb.minZ) ? 0 : commonX && near(aa.minZ, bb.maxZ) ? 2 : -1;
        if (direction < 0) continue;
        const within = (p: { x: number; z: number }, bounds: typeof aa) => p.x >= bounds.minX - 0.001 && p.x <= bounds.maxX + 0.001 && p.z >= bounds.minZ - 0.001 && p.z <= bounds.maxZ + 0.001;
        const ap = roadPortPoints(map, a).filter((p) => p.direction === direction && within(p, bb));
        const bp = roadPortPoints(map, b).filter((p) => p.direction === (direction + 2) % 4 && within(p, aa));
        if ([...ap, ...bp].some((p) => !(ap.includes(p) ? bp : ap).some((q) => near(p.x, q.x) && near(p.z, q.z)))) warnings.push(`${a.id} and ${b.id}: lanes do not connect.`);
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
