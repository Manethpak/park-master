import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { COURTYARD_MAP } from '../game/level.ts';
import { DRAFT_KEY, footprintInside, mapErrors, mapWarnings, parseMap, readMapJson, ROAD_ASSETS } from '../game/maps.ts';
import { ASSETS, VEHICLE_TUNING, vehicleGeometry } from '../game/assets.ts';
import { PLAYER_VEHICLES } from '../game/types.ts';
import type { MapDefinition, RoadAsset } from '../game/types.ts';
import { deleteItem, duplicateItem, items, moveItem, placeItem, PROP_LABELS, reorderItem, setProperty, toolLabel } from './model.ts';
import type { Item, Selection, Tool } from './model.ts';
import { PREVIEWS } from './previews.ts';
import { MapSettings } from './MapSettings.tsx';
import './builder.css';

type History = { past: MapDefinition[]; map: MapDefinition; future: MapDefinition[] };
type Gesture = { type: 'move' | 'pan' | 'rotate' | 'resize'; start: [number, number]; center: [number, number]; item?: Item; corner?: [number, number] };

const CATEGORIES: { label: string; tools: Tool[] }[] = [
    { label: 'Roads', tools: (Object.keys(ROAD_ASSETS) as RoadAsset[]).map((a) => `road:${a}`) },
    { label: 'Parking & gameplay', tools: ['spawn', 'target', 'parking'] },
    ...(['Vehicles', 'Buildings', 'Nature', 'Paths & driveways', 'Props & barriers'] as const).map((category) => ({
        label: category,
        tools: Object.entries(ASSETS).filter(([, asset]) => asset.category === category).map(([id]): Tool => `object:${id}`)
    })),
    { label: 'Ground surfaces', tools: ['floor', 'curb'] }
];
const keyOf = (item: Selection) => `${item.kind}:${item.id}`;

function initialDraft() {
    try {
        const saved = localStorage.getItem(DRAFT_KEY);
        return { map: saved ? readMapJson(saved) : structuredClone(COURTYARD_MAP), message: saved ? 'Restored your local draft.' : 'Reset to an empty lot, or load the courtyard template.' };
    } catch (error) {
        return { map: structuredClone(COURTYARD_MAP), message: `Could not restore the draft: ${error instanceof Error ? error.message : String(error)}` };
    }
}

function Symbol({ item }: { item: Item }) {
    const { kind, width: w, length: l, asset } = item;
    if (kind === 'zone') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="none" stroke="#b37a38" strokeWidth="0.15" strokeDasharray="0.6 0.3" />;
    if (kind === 'road') {
        const definition = ROAD_ASSETS[asset as RoadAsset], tuning = ASSETS[asset!];
        return <>
            <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#757e7b" stroke="#b7beb0" strokeWidth="0.05" />
            {definition.ports.flatMap((port) => (definition.offsets?.[port] ?? [0]).map((offset, index) => {
                const x = port % 2 ? (port === 1 ? 1 : -1) * w / 2 : (offset - tuning.center[0]) * tuning.scale;
                const z = port % 2 ? (offset - tuning.center[2]) * tuning.scale : (port === 0 ? 1 : -1) * l / 2;
                const length = (port % 2 ? w : l) / 2;
                return <g key={`${port}-${index}`} transform={`translate(${x} ${z}) rotate(${-port * 90})`}>
                    <path d={`M -1.75,0 V ${-length} M 1.75,0 V ${-length}`} stroke="#e8e5d3" strokeWidth="0.08" fill="none" />
                    <path d={`M 0,0 V ${-length}`} stroke="#eee8be" strokeWidth="0.06" strokeDasharray="0.5 0.4" />
                </g>;
            }))}
        </>;
    }
    if (kind === 'target' || kind === 'parking') return <>
        <rect x={-w / 2} y={-l / 2} width={w} height={l} fill={kind === 'target' ? '#b0c775' : '#d4d4c466'} stroke={kind === 'target' ? '#425b38' : '#f5eed5'} strokeWidth="0.1" />
        <text x="0" y="0.1" fontSize="1.3" textAnchor="middle" fill="#344b35" dominantBaseline="middle">P</text>
        {kind === 'target' && <path d="M0,0.8 V2 M-0.4,1.5 L0,2 L0.4,1.5" fill="none" stroke="#344b35" strokeWidth="0.13" />}
        {item.wheelStop && <rect x="-0.9" y={-l / 2 + 0.2} width="1.8" height="0.22" fill="#8c927b" />}
    </>;
    if (kind === 'surface') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill={item.color} stroke={item.solid && !item.support ? '#9d9989' : '#7e8e7533'} strokeWidth="0.08" />;
    if (asset === 'tree' || asset === 'treeSmall') return <>
        <circle r={w / 2 + 0.2} fill="#6e8b57" stroke="#496f48" strokeWidth="0.1" />
        <circle cx="-0.15" cy="-0.2" r={w / 3} fill="#8fa16a" />
    </>;
    if (asset === 'cone') return <><rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#c58b59" /><circle r={w / 3} fill="#edba80" /></>;
    if (asset === 'box') return <><rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#b29572" stroke="#725e47" strokeWidth="0.05" /><path d={`M${-w / 2},0 H${w / 2}`} stroke="#725e47" strokeWidth="0.05" /></>;
    if (asset && ASSETS[asset]?.category === 'Buildings') return <>
        <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#c2b3a0" stroke="#8f8272" strokeWidth="0.08" />
        <path d={`M0,${-l / 2} V${l / 2}`} stroke="#8f8272" strokeWidth="0.12" />
    </>;
    if (asset === 'fence' || asset === 'sign') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#e4dac5" stroke="#7c8170" strokeWidth="0.06" />;
    if (asset && ASSETS[asset]?.category !== 'Vehicles') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#8fa16a" stroke="#496f48" strokeWidth="0.08" />;
    return <>
        <rect x={-w / 2} y={-l / 2} width={w} height={l} rx="0.22" fill={kind === 'spawn' ? '#314e43' : asset === 'taxi' ? '#cbaa63' : '#a1adb0'} stroke="#3c5148" strokeWidth="0.08" />
        <rect x={-w * 0.35} y={-l * 0.15} width={w * 0.7} height={l * 0.35} rx="0.15" fill="#dce4dd" />
        <path d={`M-0.35,${l * 0.32} L0,${l * 0.43} L0.35,${l * 0.32}`} fill="none" stroke={kind === 'spawn' ? '#d6e7a9' : '#516159'} strokeWidth="0.12" />
    </>;
}

export function MapBuilder({ hidden, onExit, onTestDrive }: { hidden: boolean; onExit: () => void; onTestDrive: (map: MapDefinition) => void }) {
    const [initial] = useState(initialDraft);
    const [history, setHistory] = useState<History>(() => ({ past: [], map: initial.map, future: [] }));
    const map = history.map;
    const [editingName, setEditingName] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'assets' | 'settings'>('assets');
    const [selected, setSelected] = useState<Selection | null>(null);
    const [tool, setTool] = useState<Tool>('select');
    const [rotation, setRotation] = useState(0);
    const [snap, setSnap] = useState(0.25);
    const [roadSnap, setRoadSnap] = useState(5);
    const [center, setCenter] = useState<[number, number]>([0, 1]);
    const [viewWidth, setViewWidth] = useState(56);
    const [viewport, setViewport] = useState([800, 600]);
    const [pointer, setPointer] = useState<[number, number] | null>(null);
    const [drag, setDrag] = useState<Item | null>(null);
    const [search, setSearch] = useState('');
    const [locked, setLocked] = useState<Set<string>>(() => new Set(['surface:ground']));
    const [invisible, setInvisible] = useState<Set<string>>(() => new Set());
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [copySource, setCopySource] = useState<Item | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState(initial.message);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const board = useRef<SVGSVGElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const allItems = useMemo(() => items(map), [map]);
    const current = selected ? allItems.find((i) => i.kind === selected.kind && i.id === selected.id) : undefined;
    const warnings = useMemo(() => {
        const notes = mapWarnings(map);
        if (map.playableZone) for (const item of allItems.filter((i) => ['object', 'road', 'parking'].includes(i.kind))) {
            if (!footprintInside(map.playableZone, item.x, item.z, item.width, item.length, item.heading)) notes.push(`${item.id}: extends outside the playable zone.`);
        }
        return notes;
    }, [map, allItems]);
    const validationErrors = useMemo(() => mapErrors(map), [map]);
    const isLocked = current ? locked.has(keyOf(current)) : false;
    const layerIndex = current ? allItems.findIndex((item) => keyOf(item) === keyOf(current)) : -1;
    function changeLayer(direction: number) {
        if (!selected || isLocked) return;
        edit((draft) => reorderItem(draft, selected, direction), direction > 0 ? 'Brought item forward in editor.' : 'Sent item backward in editor.');
        setMenu(null);
    }
    const shown = (item: Item) => drag && keyOf(drag) === keyOf(item) ? drag : item;
    const visibleItems = allItems.filter((item) => !invisible.has(keyOf(item)));
    const viewHeight = viewWidth * viewport[1] / viewport[0];

    useEffect(() => {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(map)); setSaved('Saved on this device'); }
        catch { setSaved('Local saving unavailable · export to keep your draft'); }
    }, [map]);
    useEffect(() => {
        const svg = board.current;
        if (!svg) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width && entry.contentRect.height) setViewport([entry.contentRect.width, entry.contentRect.height]);
        });
        observer.observe(svg);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const svg = board.current;
        if (!svg || hidden) return;
        const zoom = (event: WheelEvent) => {
            event.preventDefault();
            if (gesture.current || !event.deltaY) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
            const nextWidth = Math.min(240, Math.max(10, viewWidth * Math.exp(Math.max(-1, Math.min(1, delta * 0.002)))));
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            setCenter([center[0] + x * (viewWidth - nextWidth), center[1] + y * (viewWidth - nextWidth) * rect.height / rect.width]);
            setViewWidth(nextWidth);
            setPointer(null);
            setMenu(null);
        };
        // React wheel handlers are passive; a native listener prevents page scrolling and browser pinch zoom.
        svg.addEventListener('wheel', zoom, { passive: false });
        return () => svg.removeEventListener('wheel', zoom);
    }, [hidden, center, viewWidth]);
    useEffect(() => {
        if (!menu) return;
        menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
        window.addEventListener('pointerdown', dismiss);
        return () => window.removeEventListener('pointerdown', dismiss);
    }, [menu]);

    function commit(next: MapDefinition, text = 'Draft updated.') {
        try {
            const validated = parseMap(next);
            if (JSON.stringify(validated) !== JSON.stringify(map)) setHistory((h) => ({ past: [...h.past.slice(-79), h.map], map: validated, future: [] }));
            setCopySource(null); setError(''); setMessage(text);
            return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
    }
    function edit(change: (draft: MapDefinition) => void, text?: string) {
        const next = structuredClone(map); change(next); return commit(next, text);
    }
    function undo() {
        gesture.current = null; setDrag(null); setCopySource(null); setMenu(null);
        setHistory((h) => h.past.length ? { past: h.past.slice(0, -1), map: h.past[h.past.length - 1], future: [h.map, ...h.future] } : h);
        setError(''); setMessage('Undid the last edit.');
    }
    function redo() {
        gesture.current = null; setDrag(null); setCopySource(null); setMenu(null);
        setHistory((h) => h.future.length ? { past: [...h.past, h.map], map: h.future[0], future: h.future.slice(1) } : h);
        setError(''); setMessage('Redid the last edit.');
    }
    function rotate() {
        if (tool !== 'select') { setRotation((r) => (r + 90) % 360); return; }
        if (current && selected && !isLocked && current.kind !== 'zone') edit((draft) => setProperty(draft, selected, 'heading', ((current.heading + 90) % 360 + 360) % 360), 'Rotated a quarter turn.');
    }
    function remove() {
        if (!selected || isLocked || ['spawn', 'target'].includes(selected.kind)) return;
        edit((draft) => deleteItem(draft, selected), 'Removed the selected item.'); setSelected(null);
    }
    function duplicate() {
        if (!selected || isLocked || ['spawn', 'target', 'zone'].includes(selected.kind)) return;
        let nextSelection = selected;
        if (edit((draft) => { nextSelection = duplicateItem(draft, selected, snap || 0.25); }, 'Duplicated the selected item.')) setSelected(nextSelection);
    }
    function duplicateAndPlace() {
        if (!current || isLocked || ['spawn', 'target', 'zone'].includes(current.kind)) return;
        setCopySource(current); setPointer([current.x, current.z]); setMenu(null); setMessage('Click to place the duplicate. Escape cancels.');
    }
    function property(key: string, value: number | string | boolean) {
        if (selected && !isLocked) edit((draft) => setProperty(draft, selected, key, value));
    }
    function focusItem(item: Item) { setSelected({ kind: item.kind, id: item.id }); setTool('select'); setCopySource(null); setCenter([item.x, item.z]); }
    function resetEditor() {
        gesture.current = null; setDrag(null); setRotation(0);
        setSelected(null); setTool('select'); setCopySource(null); setPointer(null); setMenu(null);
        setInvisible(new Set()); setLocked(new Set(['surface:ground']));
    }
    function toggle(setter: typeof setLocked, set: Set<string>, id: string) {
        const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); setter(next);
    }
    function fit() {
        const content = allItems.filter((i) => i.id !== 'ground');
        const minX = Math.min(...content.map((i) => i.x - Math.max(i.width, i.length) / 2));
        const maxX = Math.max(...content.map((i) => i.x + Math.max(i.width, i.length) / 2));
        const minZ = Math.min(...content.map((i) => i.z - Math.max(i.width, i.length) / 2));
        const maxZ = Math.max(...content.map((i) => i.z + Math.max(i.width, i.length) / 2));
        setCenter([(minX + maxX) / 2, (minZ + maxZ) / 2]);
        setViewWidth(Math.min(240, Math.max(15, maxX - minX + 8, (maxZ - minZ + 8) * viewport[0] / viewport[1])));
    }
    useEffect(() => {
        if (hidden) return;
        const keydown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return;
            if (event.code === 'Escape') { gesture.current = null; setDrag(null); setCopySource(null); setMenu(null); setTool('select'); setPointer(null); board.current?.focus(); }
            else if (menu) return;
            else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
            else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') { event.preventDefault(); redo(); }
            else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyD') { event.preventDefault(); duplicate(); }
            else if (event.code === 'Delete' || event.code === 'Backspace') { event.preventDefault(); remove(); }
            else if (event.code === 'KeyR') { event.preventDefault(); rotate(); }
            else if (event.code === 'KeyV') { gesture.current = null; setDrag(null); setCopySource(null); setTool('select'); setPointer(null); board.current?.focus(); }
            else if (current && selected && !isLocked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
                event.preventDefault();
                const step = current.kind === 'road' ? roadSnap : snap || 0.25;
                edit((draft) => moveItem(draft, selected, current.x + (event.code === 'ArrowRight' ? step : event.code === 'ArrowLeft' ? -step : 0), current.z + (event.code === 'ArrowDown' ? step : event.code === 'ArrowUp' ? -step : 0)));
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    });

    function world(event: ReactPointerEvent<SVGSVGElement>): [number, number] {
        const matrix = board.current!.getScreenCTM()!;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        return [point.x, point.y];
    }
    function snapped(x: number, z: number, road: boolean): [number, number] {
        if (road) return [map.grid.origin[0] + Math.round((x - map.grid.origin[0]) / roadSnap) * roadSnap, map.grid.origin[1] + Math.round((z - map.grid.origin[1]) / roadSnap) * roadSnap];
        return snap ? [Math.round(x / snap) * snap, Math.round(z / snap) * snap] : [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
    }
    function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
        event.currentTarget.focus();
        const point = world(event);
        if (event.button === 2) return;
        setMenu(null);
        if (event.button === 1 || event.altKey) {
            event.preventDefault(); gesture.current = { type: 'pan', start: [event.clientX, event.clientY], center }; event.currentTarget.setPointerCapture(event.pointerId); return;
        }
        if (copySource) {
            const [x, z] = snapped(...point, copySource.kind === 'road');
            let selection: Selection = copySource;
            if (edit((draft) => { selection = duplicateItem(draft, copySource, snap || 0.25); moveItem(draft, selection, x, z); }, 'Placed a duplicate.')) {
                setSelected(selection); setCopySource(null); setPointer(null);
            }
            return;
        }
        const handle = event.target instanceof Element ? event.target.closest('[data-handle]') : null;
        if (handle && current && !isLocked) {
            gesture.current = { type: handle.getAttribute('data-handle') as 'rotate' | 'resize', start: point, center, item: current,
                corner: [Number(handle.getAttribute('data-corner-x')), Number(handle.getAttribute('data-corner-z'))] };
            event.currentTarget.setPointerCapture(event.pointerId); return;
        }
        if (tool !== 'select') {
            const [x, z] = snapped(...point, tool.startsWith('road:'));
            let selection: Selection | null = null;
            if (edit((draft) => { selection = placeItem(draft, tool, x, z, rotation); }, `Placed ${toolLabel(tool).toLowerCase()}.`)) setSelected(selection);
            return;
        }
        const element = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-item-id]') : null;
        const item = element ? allItems.find((i) => i.id === element.dataset.itemId && i.kind === element.dataset.kind) : undefined;
        setSelected(item ? { id: item.id, kind: item.kind } : null);
        if (item && !locked.has(keyOf(item))) { gesture.current = { type: 'move', start: point, center, item }; event.currentTarget.setPointerCapture(event.pointerId); }
    }
    function transformed(g: Gesture, point: [number, number]): Item {
        const item = g.item!;
        if (g.type === 'rotate') {
            const angle = Math.atan2(point[0] - item.x, point[1] - item.z) - Math.atan2(g.start[0] - item.x, g.start[1] - item.z);
            const step = item.kind === 'road' ? 90 : snap ? 15 : 1;
            return { ...item, heading: ((Math.round((item.heading + angle * 180 / Math.PI) / step) * step) % 360 + 360) % 360 };
        }
        if (g.type === 'resize') {
            const [cx, cz] = g.corner!;
            const radians = item.heading * Math.PI / 180;
            const c = Math.cos(radians), s = Math.sin(radians);
            const dx = point[0] - item.x, dz = point[1] - item.z;
            const localX = c * dx - s * dz, localZ = s * dx + c * dz;
            const min = item.kind === 'zone' ? 5 : 0.1;
            const vehicle = vehicleGeometry(map.playerVehicle);
            const quantize = (n: number, minimum: number) => Math.max(minimum, Math.round(n / (snap || 0.01)) * (snap || 0.01));
            const width = quantize(cx * localX + item.width / 2, item.kind === 'target' ? vehicle.width : min);
            const length = quantize(cz * localZ + item.length / 2, item.kind === 'target' ? vehicle.length : min);
            const shiftX = cx * (width - item.width) / 2, shiftZ = cz * (length - item.length) / 2;
            return { ...item, width, length, x: item.x + c * shiftX + s * shiftZ, z: item.z - s * shiftX + c * shiftZ };
        }
        const [x, z] = snapped(item.x + point[0] - g.start[0], item.z + point[1] - g.start[1], item.kind === 'road');
        return { ...item, x, z };
    }
    function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
        const g = gesture.current;
        if (g?.type === 'pan') {
            const scale = viewWidth / viewport[0];
            setCenter([g.center[0] - (event.clientX - g.start[0]) * scale, g.center[1] - (event.clientY - g.start[1]) * scale]); return;
        }
        const point = world(event);
        if (g?.item) {
            setDrag(transformed(g, point));
        } else setPointer(snapped(...point, copySource?.kind === 'road' || tool.startsWith('road:')));
    }
    function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
        const g = gesture.current;
        if (g?.item) {
            const point = world(event);
            const next = transformed(g, point);
            // A selection click must not move an authored, unsnapped object.
            if (Math.hypot(point[0] - g.start[0], point[1] - g.start[1]) > 0.08) edit((draft) => {
                moveItem(draft, next, next.x, next.z);
                if (g.type === 'rotate') setProperty(draft, next, 'heading', next.heading);
                if (g.type === 'resize') { setProperty(draft, next, 'width', next.width); setProperty(draft, next, 'length', next.length); }
            }, g.type === 'rotate' ? 'Rotated the selected item.' : g.type === 'resize' ? 'Resized the selected item.' : 'Moved the selected item.');
        }
        gesture.current = null; setDrag(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    async function importFile(file: File) {
        try {
            if (file.size > 2_000_000) throw new Error('The map file must be smaller than 2 MB.');
            const next = readMapJson(await file.text());
            if (commit(next, `Imported ${file.name}.`)) resetEditor();
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    }
    function exportFile() {
        const blob = new Blob([JSON.stringify(map, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${map.id.replace(/[^a-zA-Z0-9_-]/g, '-') || 'level'}.json`; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Exported the level as JSON.');
    }
    function blank() {
        const next: MapDefinition = { schemaVersion: 1, id: 'custom-level', name: 'Untitled lot', timeLimit: 90, impactPenalty: 25, smallImpactPenalty: 10, grid: { cellSize: 5, origin: [0, 0] }, roads: [], objects: [], parkingBays: [], spawn: { position: [-5, 0, 5], heading: 0 }, bay: { x: 5, z: -5, width: 3.4, length: 5.7, heading: 0 }, surfaces: [{ id: 'ground', position: [0, -0.4, 0], size: [90, 0.5, 90], heading: 0, color: '#9eaf8a', solid: true, support: true }, { id: 'court-floor', position: [0, -0.15, 0], size: [30, 0.3, 30], heading: 0, color: '#747d7c', solid: true, support: true }] };
        if (commit(next, 'Reset to an empty lot. Undo restores the previous draft.')) { resetEditor(); setCenter([0, 0]); setViewWidth(42); }
    }
    function loadCourtyardTemplate() {
        if (commit(structuredClone(COURTYARD_MAP), 'Loaded the courtyard template. Undo restores the previous draft.')) {
            resetEditor(); setCenter([0, 1]); setViewWidth(56);
        }
    }
    const numeric = (label: string, key: string, value: number, step = snap || 0.25) => <label className="builder-field" key={key}><span>{label}</span><input type="number" aria-label={label} value={Math.round(value * 10000) / 10000} step={step} onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) property(key, event.target.valueAsNumber); }} /></label>;
    const palette = (value: Tool) => {
        const asset = value.includes(':') ? value.split(':')[1] : value === 'spawn' ? map.playerVehicle ?? 'sedan' : undefined;
        const definition = asset ? ASSETS[asset] : undefined;
        return <button key={value} className={`asset-card ${tool === value ? 'is-active' : ''}`} aria-label={toolLabel(value)} aria-pressed={tool === value} onClick={() => { setTool(value); setCopySource(null); setPointer(null); setMenu(null); }}>
            {asset ? <img src={PREVIEWS[asset]} alt="" loading="lazy" /> : <span className="palette-mark" aria-hidden="true">{value === 'select' ? '↖' : value === 'floor' ? '▧' : value === 'curb' ? '▬' : 'P'}</span>}
            <span>{toolLabel(value)}</span>{definition && <small>{(definition.dimensions[0] * definition.scale).toFixed(1)} × {(definition.dimensions[2] * definition.scale).toFixed(1)} m</small>}
        </button>;
    };
    const road = current?.kind === 'road' ? map.roads.find((r) => r.id === current.id) : undefined;
    let ghost: Item | undefined;
    if (pointer && copySource) ghost = { ...copySource, x: pointer[0], z: pointer[1] };
    if (pointer && !copySource && tool !== 'select') {
        const copy = structuredClone(map);
        const selection = placeItem(copy, tool, pointer[0], pointer[1], rotation);
        ghost = items(copy).find((i) => i.id === selection.id && i.kind === selection.kind);
    }
    const active = current && shown(current);
    const handleSize = viewWidth / viewport[0] * 7;
    return <section className="map-builder" aria-label="Map builder" hidden={hidden}>
        <header className="builder-header">
            <div className="builder-brand"><span className="brand-icon">P</span><div><strong>PARK MASTER</strong><span>LEVEL WORKSHOP</span></div></div>
            <label className="builder-name"><span className="eyebrow">DRAFT NAME</span><input
                aria-label="Level name"
                value={editingName ?? map.name}
                maxLength={100}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== map.name) edit((draft) => { draft.name = name; });
                    setEditingName(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                }}
            /></label>
            <div className="builder-header-actions"><button onClick={onExit}>Main menu</button><button className="builder-test" disabled={validationErrors.length > 0} onClick={() => { try { onTestDrive(parseMap(map)); } catch (cause) { setError(String(cause)); } }}>Test drive <span aria-hidden="true">↗</span></button></div>
        </header>
        <aside className="builder-palette" aria-label="Builder sidebar">
            <div className="builder-sidebar-tabs" role="tablist" aria-label="Builder panels" onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                event.stopPropagation();
                const next = event.key === 'Home' ? 'assets' : event.key === 'End' ? 'settings' : sidebarTab === 'assets' ? 'settings' : 'assets';
                setSidebarTab(next);
                if (next === 'settings') { setTool('select'); setCopySource(null); }
                event.currentTarget.querySelector<HTMLButtonElement>(`#builder-${next}-tab`)?.focus();
            }}>
                {(['assets', 'settings'] as const).map((tab) => <button key={tab}
                    id={`builder-${tab}-tab`} role="tab" aria-selected={sidebarTab === tab}
                    aria-controls={`builder-${tab}-panel`} tabIndex={sidebarTab === tab ? 0 : -1}
                    onClick={() => { setSidebarTab(tab); if (tab === 'settings') { setTool('select'); setCopySource(null); } }}
                >{tab === 'assets' ? 'Assets' : 'Map settings'}</button>)}
            </div>
            <div id="builder-assets-panel" className="builder-sidebar-panel" role="tabpanel" aria-labelledby="builder-assets-tab" hidden={sidebarTab !== 'assets'}>
            {palette('select')}
            <input aria-label="Search assets" type="search" placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {CATEGORIES.map((category) => {
                const tools = category.tools.filter((t) => toolLabel(t).toLowerCase().includes(search.toLowerCase()));
                return tools.length ? <details className="asset-category" key={category.label} open><summary>{category.label}<span>{tools.length}</span></summary><div className="asset-grid">{tools.map(palette)}</div></details> : null;
            })}
            {!CATEGORIES.some((c) => c.tools.some((t) => toolLabel(t).toLowerCase().includes(search.toLowerCase()))) && <p>No matching assets.</p>}
            <details className="scene-list"><summary>Scene list · {allItems.length}</summary>{[...allItems].reverse().map((item) => <div key={keyOf(item)}><button aria-label={`Focus ${item.id}`} onClick={() => focusItem(item)}>{item.id}</button><button aria-label={`Lock ${item.id}`} aria-pressed={locked.has(keyOf(item))} onClick={() => toggle(setLocked, locked, keyOf(item))}>L</button><button aria-label={`Hide ${item.id}`} aria-pressed={invisible.has(keyOf(item))} onClick={() => toggle(setInvisible, invisible, keyOf(item))}>H</button></div>)}<p>Frontmost first · L locks · H hides in editor only</p></details>
            </div>
            <div id="builder-settings-panel" className="builder-sidebar-panel" role="tabpanel" aria-labelledby="builder-settings-tab" hidden={sidebarTab !== 'settings'}>
                <MapSettings map={map} edit={edit} />
                <div className="builder-map-settings"><h2>Player vehicle</h2><div className="vehicle-picker">{PLAYER_VEHICLES.map((vehicle) => <button key={vehicle} aria-label={`Drive ${vehicle}`} aria-pressed={(map.playerVehicle ?? 'sedan') === vehicle} className={(map.playerVehicle ?? 'sedan') === vehicle ? 'is-active' : ''} onClick={() => edit((draft) => { draft.playerVehicle = vehicle; }, `Player vehicle: ${VEHICLE_TUNING[vehicle].label}.`)}><img src={PREVIEWS[vehicle]} alt="" /><span>{VEHICLE_TUNING[vehicle].label}</span></button>)}</div><p>The target bay must fit the selected vehicle.</p>
                    <h2>Playable zone</h2><button onClick={() => {
                        if (!map.playableZone && !edit((draft) => { draft.playableZone = { x: 0, z: 0, width: 30, length: 30 }; }, 'Added a solid playable boundary.')) return;
                        setSelected({ kind: 'zone', id: 'playable-zone' }); setTool('select');
                    }}>{map.playableZone ? 'Edit playable zone' : 'Add playable zone'}</button><p>Drag corners to resize. Barriers contain the car in Test drive.</p>
                </div>
                <div className="builder-warnings" role="status"><strong>Level validation</strong>{!validationErrors.length && !warnings.length && <p>No issues found.</p>}{[...validationErrors, ...warnings].map((warning) => {
                    const item = allItems.find((i) => warning.startsWith(i.id + ':') || warning.startsWith(i.id + ' and') || i.kind === 'spawn' && warning.startsWith('Player spawn') || i.kind === 'target' && warning.startsWith('Target bay'));
                    return <p key={warning}>{item ? <button onClick={() => focusItem(item)}>{warning}</button> : warning}</p>;
                })}{validationErrors.length > 0 && <p>Fix boundary errors to Test drive.</p>}</div>
            </div>
            <div className="builder-files"><button onClick={blank} title="Start from an empty lot with only the ground, spawn and target bay. Undo restores your draft.">Reset map</button><button onClick={loadCourtyardTemplate} title="Replace the draft with the supplied courtyard template. Undo restores your draft.">Load courtyard template</button><button onClick={() => fileInput.current?.click()}>Import JSON</button><button onClick={exportFile}>Export JSON</button></div>
            <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import level file" className="builder-file-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }} />
        </aside>
        <div className="builder-workspace">
            <div className="builder-toolbar"><div><button disabled={!history.past.length} onClick={undo} title="Ctrl / Cmd + Z">Undo</button><button disabled={!history.future.length} onClick={redo} title="Ctrl / Cmd + Shift + Z">Redo</button><span className="toolbar-divider" /><button onClick={rotate} disabled={tool === 'select' && (!current || isLocked || current.kind === 'zone')}>Rotate 90°</button></div><label>Road snap <select aria-label="Road snap" value={roadSnap} onChange={(e) => setRoadSnap(Number(e.target.value))}><option value="5">5 m</option><option value="1.25">1.25 m</option></select></label><label>Prop snap <select aria-label="Prop snap" value={snap} onChange={(e) => setSnap(Number(e.target.value))}><option value="0.25">0.25 m</option><option value="0.5">0.5 m</option><option value="1">1 m</option><option value="0">Off</option></select></label></div>
            <div className="builder-board">
                <div className="board-caption"><span className="eyebrow">TOP VIEW · METRES</span><strong>{copySource ? 'Click to place duplicate · Esc cancels' : toolLabel(tool)}{tool !== 'select' ? ` / ${rotation}°` : ''}</strong></div>
                <svg ref={board} tabIndex={0} role="img" aria-label="Level drafting grid" viewBox={`${center[0] - viewWidth / 2} ${center[1] - viewHeight / 2} ${viewWidth} ${viewHeight}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; setDrag(null); }} onPointerLeave={() => setPointer(null)} onContextMenu={(e) => {
                    e.preventDefault();
                    const element = e.target instanceof Element ? e.target.closest<SVGGElement>('[data-item-id]') : null;
                    const item = element && allItems.find((i) => i.id === element.dataset.itemId && i.kind === element.dataset.kind);
                    if (!item && !current) { setMenu(null); return; }
                    if (item) setSelected({ id: item.id, kind: item.kind });
                    setTool('select'); setCopySource(null);
                    setMenu({ x: Math.max(8, Math.min(e.clientX, window.innerWidth - 196)), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 355)) });
                }}>
                    <defs><pattern id="workshop-small-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 H 0 V 1" fill="none" stroke="#526b4930" strokeWidth="0.025" /></pattern><pattern id="workshop-road-grid" x={map.grid.origin[0] - 2.5} y={map.grid.origin[1] - 2.5} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 H 0 V 5" fill="none" stroke="#344b4570" strokeWidth="0.045" /></pattern></defs>
                    <rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="#bcc7ad" />
                    <g pointerEvents="none"><rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="url(#workshop-small-grid)" /><rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="url(#workshop-road-grid)" /><path d={`M${center[0] - viewWidth / 2},0 H${center[0] + viewWidth / 2} M0,${center[1] - viewHeight / 2} V${center[1] + viewHeight / 2}`} stroke="#47635366" strokeWidth="0.035" /></g>
                    {visibleItems.map(shown).map((i) => <g key={`${i.kind}:${i.id}`} data-item-id={i.id} data-kind={i.kind} transform={`translate(${i.x} ${i.z}) rotate(${-i.heading})`}><Symbol item={i} /></g>)}
                    {map.playableZone && <g pointerEvents="none"><path fill="#273c3340" fillRule="evenodd" d={`M${center[0] - viewWidth / 2},${center[1] - viewHeight / 2} h${viewWidth} v${viewHeight} h${-viewWidth} Z M${map.playableZone.x - map.playableZone.width / 2},${map.playableZone.z - map.playableZone.length / 2} h${map.playableZone.width} v${map.playableZone.length} h${-map.playableZone.width} Z`} /></g>}
                    {active && !invisible.has(keyOf(active)) && <g transform={`translate(${active.x} ${active.z}) rotate(${-active.heading})`}>
                        <rect pointerEvents="none" x={-active.width / 2 - 0.15} y={-active.length / 2 - 0.15} width={active.width + 0.3} height={active.length + 0.3} fill="none" stroke="#f9f6cf" strokeWidth="0.13" strokeDasharray="0.4 0.2" />
                        {!isLocked && active.kind !== 'zone' && <><path pointerEvents="none" d={`M0,${-active.length / 2} V${-active.length / 2 - handleSize * 4}`} stroke="#273c33" strokeWidth={handleSize / 4} /><circle role="button" aria-label="Rotation handle" data-handle="rotate" cx="0" cy={-active.length / 2 - handleSize * 4} r={handleSize} fill="#f6f4e9" stroke="#273c33" strokeWidth={handleSize / 4} /></>}
                        {!isLocked && ['surface', 'parking', 'target', 'zone'].includes(active.kind) && [-1, 1].flatMap((x) => [-1, 1].map((z) => <rect key={`${x}:${z}`} role="button" aria-label={`Resize handle ${x} ${z}`} data-handle="resize" data-corner-x={x} data-corner-z={z} x={x * active.width / 2 - handleSize} y={z * active.length / 2 - handleSize} width={handleSize * 2} height={handleSize * 2} fill="#f6f4e9" stroke="#273c33" strokeWidth={handleSize / 4} />))}
                        {drag && <text pointerEvents="none" x="0" y={active.length / 2 + handleSize * 4} textAnchor="middle" fontSize={handleSize * 2} fill="#273c33">{gesture.current?.type === 'rotate' ? `${active.heading}°` : `${active.width.toFixed(2)} × ${active.length.toFixed(2)} m`}</text>}
                    </g>}
                    {ghost && <g opacity="0.6" pointerEvents="none" transform={`translate(${ghost.x} ${ghost.z}) rotate(${-ghost.heading})`}><Symbol item={ghost} /><rect x={-ghost.width / 2} y={-ghost.length / 2} width={ghost.width} height={ghost.length} fill="none" stroke="#253e32" strokeWidth="0.1" /></g>}
                </svg>
                {menu && current && <div ref={menuRef} className="builder-context-menu" role="menu" aria-label="Object actions" style={{ left: menu.x, top: menu.y }} onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.stopPropagation(); setMenu(null); board.current?.focus(); }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault(); e.stopPropagation();
                        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                        buttons[(index + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
                    }
                }}>
                    <strong>{current.id}</strong>
                    <button role="menuitem" onClick={() => { setSelected(null); setMenu(null); board.current?.focus(); }}>Deselect</button>
                    <button role="menuitem" disabled={isLocked || layerIndex === allItems.length - 1} onClick={() => changeLayer(1)}>Bring forward</button>
                    <button role="menuitem" disabled={isLocked || layerIndex <= 0} onClick={() => changeLayer(-1)}>Send backward</button>
                    <button role="menuitem" disabled={isLocked || layerIndex === allItems.length - 1} onClick={() => changeLayer(allItems.length)}>Bring to front</button>
                    <button role="menuitem" disabled={isLocked || layerIndex <= 0} onClick={() => changeLayer(-allItems.length)}>Send to back</button>
                    <button role="menuitem" onClick={() => { toggle(setLocked, locked, keyOf(current)); setMenu(null); }}>{isLocked ? 'Unlock' : 'Lock'}</button>
                    <button role="menuitem" onClick={() => { toggle(setInvisible, invisible, keyOf(current)); setMenu(null); }}>{invisible.has(keyOf(current)) ? 'Show in editor' : 'Hide in editor'}</button>
                    <button role="menuitem" disabled={isLocked || ['spawn', 'target'].includes(current.kind)} onClick={() => { remove(); setMenu(null); }}>Delete</button>
                </div>}
                <div className="board-navigation"><span>+Z ↓ <i /> +X →</span><div><button aria-label="Zoom out" onClick={() => setViewWidth((w) => Math.min(240, w * 1.25))}>−</button><button onClick={fit}>Fit map</button><button aria-label="Zoom in" onClick={() => setViewWidth((w) => Math.max(10, w / 1.25))}>+</button></div></div>
            </div>
            <div className="builder-help"><span>Drag to move · Handles rotate / resize · Right-click for actions</span><span>Alt / middle drag to pan · R rotate · Delete remove · Esc cancel</span></div>
        </div>
        <aside className="builder-inspector" aria-label="Selection inspector">
            <p className="eyebrow">INSPECTOR</p>
            <label className="builder-field"><span>Scene item</span><select aria-label="Scene item" value={current ? `${current.kind}:${current.id}` : ''} onChange={(e) => { const i = allItems.find((i) => `${i.kind}:${i.id}` === e.target.value); setSelected(i ? { kind: i.kind, id: i.id } : null); setTool('select'); }}><option value="">No selection</option>{allItems.map((i) => <option key={`${i.kind}:${i.id}`} value={`${i.kind}:${i.id}`}>{i.id}</option>)}</select></label>
            {current ? <>
                <h2>{current.asset ? PROP_LABELS[current.asset] || ROAD_ASSETS[current.asset as RoadAsset]?.label : current.kind === 'target' ? 'Target bay' : current.kind === 'spawn' ? 'Player spawn' : current.kind === 'parking' ? 'Parking bay' : current.kind === 'zone' ? 'Playable zone' : 'Surface'}</h2>
                <code className="inspector-id">{current.id}</code>
                <label className="builder-checkbox"><input aria-label="Lock selected item" type="checkbox" checked={isLocked} onChange={() => toggle(setLocked, locked, keyOf(current))} />Lock in editor</label>
                <label className="builder-checkbox"><input aria-label="Hide selected item" type="checkbox" checked={invisible.has(keyOf(current))} onChange={() => toggle(setInvisible, invisible, keyOf(current))} />Hide in editor only</label>
                <fieldset className="builder-properties" disabled={isLocked}>
                <div className="builder-field-grid">{road ? <>{numeric('Column', 'column', road.cell[0], 0.25)}{numeric('Row', 'row', road.cell[1], 0.25)}</> : <>{numeric('X (m)', 'x', current.x)}{numeric('Z (m)', 'z', current.z)}</>}
                    {['object', 'surface', 'spawn'].includes(current.kind) && numeric('Y (m)', 'y', current.y)}
                    {['target', 'parking', 'surface', 'zone'].includes(current.kind) && <>{numeric('Width (m)', 'width', current.width)}{numeric('Length (m)', 'length', current.length)}</>}
                    {current.height !== undefined && numeric('Height (m)', 'height', current.height, 0.05)}
                </div>
                {road ? <label className="builder-field"><span>Rotation</span><select aria-label="Rotation" value={road.rotation} onChange={(e) => property('heading', Number(e.target.value))}>{[0, 90, 180, 270].map((n) => <option key={n} value={n}>{n}°</option>)}</select></label> : current.kind !== 'zone' && numeric('Heading (°)', 'heading', current.heading, 15)}
                {current.kind === 'object' && <><div className="builder-field"><span>Physics</span><strong>{current.body === 'dynamic' ? 'Movable prop' : current.body === 'static' ? 'Static obstacle' : 'Decoration'}</strong></div>{current.body === 'dynamic' && numeric('Mass (kg)', 'mass', current.mass ?? 1000, 1)}</>}
                {current.kind === 'surface' && <><label className="builder-field"><span>Color</span><input aria-label="Surface color" type="color" value={current.color} onChange={(e) => property('color', e.target.value)} /></label><label className="builder-checkbox"><input type="checkbox" checked={current.solid} onChange={(e) => property('solid', e.target.checked)} />Solid collider</label><label className="builder-checkbox"><input type="checkbox" checked={current.support} onChange={(e) => property('support', e.target.checked)} />Driving surface</label></>}
                {current.kind === 'parking' && <label className="builder-checkbox"><input type="checkbox" checked={current.wheelStop} onChange={(e) => property('wheelStop', e.target.checked)} />Wheel stop</label>}
                {current.kind === 'object' && <p className="asset-size-note">Fixed model size</p>}
                <div className="inspector-actions"><button disabled={layerIndex === allItems.length - 1} onClick={() => changeLayer(1)}>Bring forward</button><button disabled={layerIndex <= 0} onClick={() => changeLayer(-1)}>Send backward</button></div>
                <div className="inspector-actions"><button disabled={layerIndex === allItems.length - 1} onClick={() => changeLayer(allItems.length)}>Bring to front</button><button disabled={layerIndex <= 0} onClick={() => changeLayer(-allItems.length)}>Send to back</button></div>
                <div className="inspector-actions"><button disabled={['spawn', 'target', 'zone'].includes(current.kind)} onClick={duplicate}>Duplicate</button><button disabled={['spawn', 'target', 'zone'].includes(current.kind)} onClick={duplicateAndPlace}>Duplicate & place</button><button disabled={['spawn', 'target'].includes(current.kind)} onClick={remove}>Delete</button></div>
                </fieldset>
            </> : <div className="inspector-empty"><span aria-hidden="true">↖</span><h2>No selection</h2><p>Select an item on the map or scene list.</p></div>}
        </aside>
        <footer className="builder-status"><span className={error ? 'builder-error' : ''} role={error ? 'alert' : 'status'}>{error || message}</span><span>{map.roads.length} roads · {map.objects.length} props <i /> {saved}</span></footer>
    </section>;
}
