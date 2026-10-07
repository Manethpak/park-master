import { ASSETS, vehicleGeometry } from '../game/assets.ts';
import { ROAD_ASSETS, roadPosition } from '../game/maps.ts';
import type { MapDefinition, RoadAsset } from '../game/types.ts';

export type Selection = { kind: 'road' | 'object' | 'surface' | 'parking' | 'spawn' | 'target' | 'zone'; id: string };
export type Item = Selection & { x: number; z: number; y: number; heading: number; width: number; length: number; height?: number; asset?: string; color?: string; body?: string; mass?: number; solid?: boolean; support?: boolean; wheelStop?: boolean };
export type Tool = 'select' | 'spawn' | 'target' | 'parking' | 'floor' | 'curb' | `road:${RoadAsset}` | `object:${string}`;

export const PROP_LABELS: Record<string, string> = Object.fromEntries(Object.entries(ASSETS).filter(([, asset]) => asset.category !== 'Roads').map(([id, asset]) => [id, asset.label]));

export function items(map: MapDefinition): Item[] {
    const result: Item[] = [
        ...map.surfaces.map((s) => ({ kind: 'surface' as const, id: s.id, x: s.position[0], y: s.position[1], z: s.position[2], heading: s.heading, width: s.size[0], height: s.size[1], length: s.size[2], color: s.color, solid: s.solid, support: s.support })),
        ...map.roads.map((r) => { const [x, z] = roadPosition(map, r), a = ASSETS[r.asset]; return { kind: 'road' as const, id: r.id, x, z, y: 0, heading: r.rotation, width: a.dimensions[0] * a.scale, length: a.dimensions[2] * a.scale, asset: r.asset }; }),
        ...map.parkingBays.map((b) => ({ ...b, kind: 'parking' as const, y: 0 })),
        { ...map.bay, kind: 'target' as const, id: 'target', y: 0 },
        ...map.objects.map((o) => {
            const a = ASSETS[o.asset];
            return { kind: 'object' as const, id: o.id, x: o.position[0], y: o.position[1], z: o.position[2], heading: o.heading, width: a.dimensions[0] * a.scale, length: a.dimensions[2] * a.scale, asset: o.asset, body: o.body, mass: o.mass };
        }),
        { kind: 'spawn' as const, id: 'spawn', x: map.spawn.position[0], y: map.spawn.position[1], z: map.spawn.position[2], heading: map.spawn.heading, width: vehicleGeometry(map.playerVehicle).width, length: vehicleGeometry(map.playerVehicle).length },
        ...(map.playableZone ? [{ ...map.playableZone, kind: 'zone' as const, id: 'playable-zone', y: 0, heading: 0 }] : [])
    ];
    if (!map.editorOrder) return result;
    const order = new Map(map.editorOrder.map((key, index) => [key, index]));
    return result.sort((a, b) => (order.get(`${a.kind}:${a.id}`) ?? map.editorOrder!.length) - (order.get(`${b.kind}:${b.id}`) ?? map.editorOrder!.length));
}

export function reorderItem(map: MapDefinition, selected: Selection, direction: number) {
    const order = items(map).map((item) => `${item.kind}:${item.id}`);
    const index = order.indexOf(`${selected.kind}:${selected.id}`);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    map.editorOrder = order;
}

export function moveItem(map: MapDefinition, selection: Selection, x: number, z: number) {
    switch (selection.kind) {
        case 'zone': if (map.playableZone) { map.playableZone.x = x; map.playableZone.z = z; } break;
        case 'road': {
            const road = map.roads.find((r) => r.id === selection.id)!;
            const [cx, cz] = roadPosition(map, road);
            road.cell = [Math.round((road.cell[0] + (x - cx) / 5) * 4) / 4, Math.round((road.cell[1] + (z - cz) / 5) * 4) / 4]; break;
        }
        case 'object': { const o = map.objects.find((o) => o.id === selection.id)!; o.position[0] = x; o.position[2] = z; break; }
        case 'surface': { const s = map.surfaces.find((s) => s.id === selection.id)!; s.position[0] = x; s.position[2] = z; break; }
        case 'parking': { const b = map.parkingBays.find((b) => b.id === selection.id)!; b.x = x; b.z = z; break; }
        case 'spawn': map.spawn.position[0] = x; map.spawn.position[2] = z; break;
        case 'target': map.bay.x = x; map.bay.z = z; break;
    }
}

export function setProperty(map: MapDefinition, selection: Selection, key: string, value: number | string | boolean) {
    const item = items(map).find((i) => i.kind === selection.kind && i.id === selection.id)!;
    if (key === 'x' || key === 'z') { moveItem(map, selection, key === 'x' ? Number(value) : item.x, key === 'z' ? Number(value) : item.z); return; }
    if (selection.kind === 'zone') {
        if (map.playableZone && ['width', 'length'].includes(key)) Object.assign(map.playableZone, { [key]: value });
    } else if (selection.kind === 'road') {
        const r = map.roads.find((r) => r.id === selection.id)!;
        if (key === 'heading') r.rotation = Number(value);
        else if (key === 'column') r.cell[0] = Number(value);
        else if (key === 'row') r.cell[1] = Number(value);
    } else if (selection.kind === 'spawn') {
        if (key === 'heading') map.spawn.heading = Number(value);
        if (key === 'y') map.spawn.position[1] = Number(value);
    } else if (selection.kind === 'target' || selection.kind === 'parking') {
        const b = selection.kind === 'target' ? map.bay : map.parkingBays.find((b) => b.id === selection.id)!;
        Object.assign(b, { [key]: value });
    } else if (selection.kind === 'object') {
        const o = map.objects.find((o) => o.id === selection.id)!;
        if (key === 'y') o.position[1] = Number(value);
        else if (key === 'body' && value === 'none') { delete o.body; delete o.mass; }
        else Object.assign(o, { [key]: value });
    } else {
        const s = map.surfaces.find((s) => s.id === selection.id)!;
        if (key === 'y') s.position[1] = Number(value);
        else if (['width', 'height', 'length'].includes(key)) s.size[{ width: 0, height: 1, length: 2 }[key as 'width' | 'height' | 'length']] = Number(value);
        else { Object.assign(s, { [key]: value }); if (key === 'support' && value) s.solid = true; if (key === 'solid' && !value) s.support = false; }
    }
}

export function freshId(map: MapDefinition, prefix: string) {
    const ids = new Set(items(map).map((i) => i.id));
    for (let i = 1; ; i++) if (!ids.has(`${prefix}-${i}`)) return `${prefix}-${i}`;
}

export function placeItem(map: MapDefinition, tool: Tool, x: number, z: number, heading: number): Selection {
    if (tool.startsWith('road:')) {
        const asset = tool.slice(5) as RoadAsset;
        const id = freshId(map, 'road');
        map.roads.push({ id, asset, cell: [Math.round((x - map.grid.origin[0]) / 5 * 4) / 4, Math.round((z - map.grid.origin[1]) / 5 * 4) / 4], rotation: heading });
        return { kind: 'road', id };
    }
    if (tool.startsWith('object:')) {
        const asset = tool.slice(7), id = freshId(map, asset);
        const definition = ASSETS[asset];
        map.objects.push({ id, asset, position: [x, 0, z], heading, ...(definition.body ? { body: definition.body } : {}), ...(definition.mass !== undefined ? { mass: definition.mass } : {}) });
        return { kind: 'object', id };
    }
    if (tool === 'spawn') { map.spawn = { position: [x, 0, z], heading }; return { kind: 'spawn', id: 'spawn' }; }
    if (tool === 'target') { map.bay.x = x; map.bay.z = z; map.bay.heading = heading; return { kind: 'target', id: 'target' }; }
    if (tool === 'parking') {
        const id = freshId(map, 'parking');
        map.parkingBays.push({ id, x, z, width: 3.4, length: 5.7, heading, wheelStop: false });
        return { kind: 'parking', id };
    }
    const id = freshId(map, tool);
    map.surfaces.push({ id, position: [x, tool === 'floor' ? -0.15 : 0.22, z], size: tool === 'floor' ? [5, 0.3, 5] : [5, 0.44, 0.45], heading, color: tool === 'floor' ? '#747d7c' : '#e2decf', solid: true, support: tool === 'floor' });
    return { kind: 'surface', id };
}

export function deleteItem(map: MapDefinition, selected: Selection) {
    if (selected.kind === 'zone') delete map.playableZone;
    if (selected.kind === 'road') map.roads = map.roads.filter((r) => r.id !== selected.id);
    if (selected.kind === 'object') map.objects = map.objects.filter((o) => o.id !== selected.id);
    if (selected.kind === 'surface') map.surfaces = map.surfaces.filter((s) => s.id !== selected.id);
    if (selected.kind === 'parking') map.parkingBays = map.parkingBays.filter((b) => b.id !== selected.id);
}

export function duplicateItem(map: MapDefinition, selected: Selection, offset: number): Selection {
    const item = items(map).find((i) => i.kind === selected.kind && i.id === selected.id)!;
    const id = freshId(map, item.kind);
    if (selected.kind === 'road') {
        const source = map.roads.find((r) => r.id === selected.id)!;
        let column = source.cell[0] + 1;
        while (map.roads.some((r) => r.cell[0] === column && r.cell[1] === source.cell[1])) column++;
        map.roads.push({ ...source, id, cell: [column, source.cell[1]] });
    } else if (selected.kind === 'object') map.objects.push({ ...structuredClone(map.objects.find((o) => o.id === selected.id)!), id, position: [item.x + offset, item.y, item.z + offset] });
    else if (selected.kind === 'surface') map.surfaces.push({ ...structuredClone(map.surfaces.find((s) => s.id === selected.id)!), id, position: [item.x + offset, item.y, item.z + offset] });
    else if (selected.kind === 'parking') map.parkingBays.push({ ...map.parkingBays.find((b) => b.id === selected.id)!, id, x: item.x + offset, z: item.z + offset });
    return { ...selected, id };
}

export function toolLabel(tool: Tool) {
    if (tool.startsWith('road:')) return ROAD_ASSETS[tool.slice(5) as RoadAsset].label;
    if (tool.startsWith('object:')) return PROP_LABELS[tool.slice(7)];
    return { select: 'Select & move', spawn: 'Player spawn', target: 'Target bay', parking: 'Parking bay', floor: 'Asphalt floor', curb: 'Curb / island' }[tool as 'select' | 'spawn' | 'target' | 'parking' | 'floor' | 'curb'];
}
