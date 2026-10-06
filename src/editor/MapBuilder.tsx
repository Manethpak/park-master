import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { COURTYARD_MAP } from '../game/level.ts';
import { DRAFT_KEY, mapWarnings, parseMap, readMapJson, ROAD_ASSETS } from '../game/maps.ts';
import type { MapDefinition, RoadAsset } from '../game/types.ts';
import { deleteItem, duplicateItem, items, moveItem, placeItem, PROP_LABELS, setProperty, toolLabel } from './model.ts';
import type { Item, Selection, Tool } from './model.ts';
import './builder.css';

type History = { past: MapDefinition[]; map: MapDefinition; future: MapDefinition[] };
type Gesture = { type: 'move' | 'pan'; start: [number, number]; center: [number, number]; item?: Item };

function initialDraft() {
    try {
        const saved = localStorage.getItem(DRAFT_KEY);
        return { map: saved ? readMapJson(saved) : structuredClone(COURTYARD_MAP), message: saved ? 'Restored your local draft.' : 'Start with the courtyard, or create a new map.' };
    } catch (error) {
        return { map: structuredClone(COURTYARD_MAP), message: `Could not restore the draft: ${error instanceof Error ? error.message : String(error)}` };
    }
}

function Symbol({ item }: { item: Item }) {
    const { kind, width: w, length: l, asset } = item;
    if (kind === 'road') {
        const ports = ROAD_ASSETS[asset as RoadAsset].ports;
        return <>
            <rect x={-2.5} y={-2.5} width={5} height={5} fill="#757e7b" stroke="#b7beb0" strokeWidth="0.05" />
            {ports.map((port) => <g key={port} transform={`rotate(${-port * 90})`}>
                <path d="M -1.75,0 V 2.5 M 1.75,0 V 2.5" stroke="#e8e5d3" strokeWidth="0.08" fill="none" />
                <path d="M 0,0 V 2.5" stroke="#eee8be" strokeWidth="0.06" strokeDasharray="0.5 0.4" />
            </g>)}
        </>;
    }
    if (kind === 'target' || kind === 'parking') return <>
        <rect x={-w / 2} y={-l / 2} width={w} height={l} fill={kind === 'target' ? '#b0c775' : '#d4d4c466'} stroke={kind === 'target' ? '#425b38' : '#f5eed5'} strokeWidth="0.1" />
        <text x="0" y="0.1" fontSize="1.3" textAnchor="middle" fill="#344b35" dominantBaseline="middle">P</text>
        {kind === 'target' && <path d="M0,0.8 V2 M-0.4,1.5 L0,2 L0.4,1.5" fill="none" stroke="#344b35" strokeWidth="0.13" />}
        {(item.wheelStop || kind === 'target') && <rect x="-0.9" y={-l / 2 + 0.2} width="1.8" height="0.22" fill="#8c927b" />}
    </>;
    if (kind === 'surface') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill={item.color} stroke={item.solid && !item.support ? '#9d9989' : '#7e8e7533'} strokeWidth="0.08" />;
    if (asset === 'tree' || asset === 'treeSmall') return <>
        <circle r={w / 2 + 0.2} fill="#6e8b57" stroke="#496f48" strokeWidth="0.1" />
        <circle cx="-0.15" cy="-0.2" r={w / 3} fill="#8fa16a" />
    </>;
    if (asset === 'cone') return <><rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#c58b59" /><circle r={w / 3} fill="#edba80" /></>;
    if (asset === 'box') return <><rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#b29572" stroke="#725e47" strokeWidth="0.05" /><path d={`M${-w / 2},0 H${w / 2}`} stroke="#725e47" strokeWidth="0.05" /></>;
    if (asset === 'house' || asset === 'houseWide') return <>
        <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#c2b3a0" stroke="#8f8272" strokeWidth="0.08" />
        <path d={`M0,${-l / 2} V${l / 2}`} stroke="#8f8272" strokeWidth="0.12" />
    </>;
    if (asset === 'fence' || asset === 'sign') return <rect x={-w / 2} y={-l / 2} width={w} height={l} fill="#e4dac5" stroke="#7c8170" strokeWidth="0.06" />;
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
    const [selected, setSelected] = useState<Selection | null>(null);
    const [tool, setTool] = useState<Tool>('select');
    const [rotation, setRotation] = useState(0);
    const [snap, setSnap] = useState(0.25);
    const [center, setCenter] = useState<[number, number]>([0, 1]);
    const [viewWidth, setViewWidth] = useState(56);
    const [viewport, setViewport] = useState([800, 600]);
    const [pointer, setPointer] = useState<[number, number] | null>(null);
    const [drag, setDrag] = useState<{ item: Item; x: number; z: number } | null>(null);
    const [message, setMessage] = useState(initial.message);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const board = useRef<SVGSVGElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const allItems = items(map);
    const current = selected ? allItems.find((i) => i.kind === selected.kind && i.id === selected.id) : undefined;
    const warnings = mapWarnings(map);
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

    function commit(next: MapDefinition, text = 'Draft updated.') {
        try {
            const validated = parseMap(next);
            if (JSON.stringify(validated) !== JSON.stringify(map)) setHistory((h) => ({ past: [...h.past.slice(-79), h.map], map: validated, future: [] }));
            setError(''); setMessage(text);
            return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
    }
    function edit(change: (draft: MapDefinition) => void, text?: string) {
        const next = structuredClone(map); change(next); return commit(next, text);
    }
    function undo() {
        setHistory((h) => h.past.length ? { past: h.past.slice(0, -1), map: h.past[h.past.length - 1], future: [h.map, ...h.future] } : h);
        setError(''); setMessage('Undid the last edit.');
    }
    function redo() {
        setHistory((h) => h.future.length ? { past: [...h.past, h.map], map: h.future[0], future: h.future.slice(1) } : h);
        setError(''); setMessage('Redid the last edit.');
    }
    function rotate() {
        if (tool !== 'select') { setRotation((r) => (r + 90) % 360); return; }
        if (current && selected) edit((draft) => setProperty(draft, selected, 'heading', ((current.heading + 90) % 360 + 360) % 360), 'Rotated a quarter turn.');
    }
    function remove() {
        if (!selected || ['spawn', 'target'].includes(selected.kind)) return;
        edit((draft) => deleteItem(draft, selected), 'Removed the selected item.'); setSelected(null);
    }
    function duplicate() {
        if (!selected || ['spawn', 'target'].includes(selected.kind)) return;
        let nextSelection = selected;
        if (edit((draft) => { nextSelection = duplicateItem(draft, selected, snap || 0.25); }, 'Duplicated the selected item.')) setSelected(nextSelection);
    }
    function property(key: string, value: number | string | boolean) {
        if (selected) edit((draft) => setProperty(draft, selected, key, value));
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
            if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
            else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') { event.preventDefault(); redo(); }
            else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyD') { event.preventDefault(); duplicate(); }
            else if (event.code === 'Delete' || event.code === 'Backspace') { event.preventDefault(); remove(); }
            else if (event.code === 'KeyR') { event.preventDefault(); rotate(); }
            else if (event.code === 'Escape' || event.code === 'KeyV') { setTool('select'); setPointer(null); }
            else if (current && selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
                event.preventDefault();
                const step = current.kind === 'road' ? 5 : snap || 0.25;
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
        if (road) return [map.grid.origin[0] + Math.round((x - map.grid.origin[0]) / 5) * 5, map.grid.origin[1] + Math.round((z - map.grid.origin[1]) / 5) * 5];
        return snap ? [Math.round(x / snap) * snap, Math.round(z / snap) * snap] : [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
    }
    function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
        event.currentTarget.focus();
        const point = world(event);
        if (event.button === 1 || event.button === 2 || event.altKey) {
            event.preventDefault(); gesture.current = { type: 'pan', start: [event.clientX, event.clientY], center }; event.currentTarget.setPointerCapture(event.pointerId); return;
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
        if (item) { gesture.current = { type: 'move', start: point, center, item }; event.currentTarget.setPointerCapture(event.pointerId); }
    }
    function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
        const g = gesture.current;
        if (g?.type === 'pan') {
            const scale = viewWidth / viewport[0];
            setCenter([g.center[0] - (event.clientX - g.start[0]) * scale, g.center[1] - (event.clientY - g.start[1]) * scale]); return;
        }
        const point = world(event);
        if (g?.item) {
            const [x, z] = snapped(g.item.x + point[0] - g.start[0], g.item.z + point[1] - g.start[1], g.item.kind === 'road');
            setDrag({ item: g.item, x, z });
        } else setPointer(snapped(...point, tool.startsWith('road:')));
    }
    function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
        const g = gesture.current;
        if (g?.item) {
            const point = world(event);
            const [x, z] = snapped(g.item.x + point[0] - g.start[0], g.item.z + point[1] - g.start[1], g.item.kind === 'road');
            // A selection click must not move an authored, unsnapped object.
            if (Math.hypot(point[0] - g.start[0], point[1] - g.start[1]) > 0.08) edit((draft) => moveItem(draft, g.item!, x, z), 'Moved the selected item.');
        }
        gesture.current = null; setDrag(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    async function importFile(file: File) {
        try {
            if (file.size > 2_000_000) throw new Error('The map file must be smaller than 2 MB.');
            const next = readMapJson(await file.text());
            if (commit(next, `Imported ${file.name}.`)) { setSelected(null); setTool('select'); }
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
        const next: MapDefinition = { schemaVersion: 1, id: 'custom-level', name: 'Untitled lot', timeLimit: 90, impactPenalty: 50, grid: { cellSize: 5, origin: [0, 0] }, roads: [], objects: [], parkingBays: [], spawn: { position: [-5, 0, 5], heading: 0 }, bay: { x: 5, z: -5, width: 3.4, length: 5.7, heading: 0 }, surfaces: [{ id: 'ground', position: [0, -0.4, 0], size: [90, 0.5, 90], heading: 0, color: '#9eaf8a', solid: true, support: true }, { id: 'court-floor', position: [0, -0.15, 0], size: [30, 0.3, 30], heading: 0, color: '#747d7c', solid: true, support: true }] };
        commit(next, 'Created a new map. Undo restores the previous draft.'); setSelected(null); setTool('select'); setCenter([0, 0]); setViewWidth(42);
    }
    const numeric = (label: string, key: string, value: number, step = snap || 0.25) => <label className="builder-field" key={key}><span>{label}</span><input type="number" aria-label={label} value={Math.round(value * 10000) / 10000} step={step} onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) property(key, event.target.valueAsNumber); }} /></label>;
    const palette = (value: Tool, mark: string) => <button key={value} className={tool === value ? 'is-active' : ''} aria-pressed={tool === value} onClick={() => { setTool(value); setPointer(null); }}><span className="palette-mark" aria-hidden="true">{mark}</span><span>{toolLabel(value)}</span></button>;
    const road = current?.kind === 'road' ? map.roads.find((r) => r.id === current.id) : undefined;
    let ghost: Item | undefined;
    if (pointer && tool !== 'select') {
        const copy = structuredClone(map);
        const selection = placeItem(copy, tool, pointer[0], pointer[1], rotation);
        ghost = items(copy).find((i) => i.id === selection.id && i.kind === selection.kind);
    }
    return <section className="map-builder" aria-label="Map builder" hidden={hidden}>
        <header className="builder-header">
            <div className="builder-brand"><span className="brand-icon">P</span><div><strong>PARK MASTER</strong><span>LEVEL WORKSHOP</span></div></div>
            <label className="builder-name"><span className="eyebrow">DRAFT NAME</span><input aria-label="Level name" value={map.name} maxLength={100} onChange={(e) => { if (e.target.value.trim()) edit((draft) => { draft.name = e.target.value; }); }} /></label>
            <div className="builder-header-actions"><button onClick={onExit}>Play courtyard</button><button className="builder-test" onClick={() => { try { onTestDrive(parseMap(map)); } catch (cause) { setError(String(cause)); } }}>Test drive <span aria-hidden="true">↗</span></button></div>
        </header>
        <aside className="builder-palette" aria-label="Placement tools">
            <p className="eyebrow">01 / PLACE</p>
            {palette('select', '↖')}
            <h2>Road kit <span>5 m</span></h2>
            {(Object.keys(ROAD_ASSETS) as RoadAsset[]).map((asset) => palette(`road:${asset}`, { road: '━', roadBend: '┗', roadIntersection: '┳', roadCrossroad: '╋' }[asset]))}
            <h2>Parking & ground</h2>
            {palette('spawn', '↑')}{palette('target', 'P')}{palette('parking', '▯')}{palette('floor', '▧')}{palette('curb', '▬')}
            <h2>Props & scenery</h2>
            {Object.keys(PROP_LABELS).map((asset) => palette(`object:${asset}`, ['cone', 'box'].includes(asset) ? '◇' : '▫'))}
            <div className="builder-files"><button onClick={blank}>New map</button><button onClick={() => { commit(structuredClone(COURTYARD_MAP), 'Restored the supplied courtyard. Undo restores your draft.'); setSelected(null); }}>Load courtyard</button><button onClick={() => fileInput.current?.click()}>Import JSON</button><button onClick={exportFile}>Export JSON</button></div>
            <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import level file" className="builder-file-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }} />
        </aside>
        <div className="builder-workspace">
            <div className="builder-toolbar"><div><button disabled={!history.past.length} onClick={undo} title="Ctrl / Cmd + Z">Undo</button><button disabled={!history.future.length} onClick={redo} title="Ctrl / Cmd + Shift + Z">Redo</button><span className="toolbar-divider" /><button onClick={rotate} disabled={tool === 'select' && !current}>Rotate 90°</button></div><label>Prop snap <select aria-label="Prop snap" value={snap} onChange={(e) => setSnap(Number(e.target.value))}><option value="0.25">0.25 m</option><option value="0.5">0.5 m</option><option value="1">1 m</option><option value="0">Off</option></select></label></div>
            <div className="builder-board">
                <div className="board-caption"><span className="eyebrow">TOP VIEW · METRES</span><strong>{toolLabel(tool)}{tool !== 'select' ? ` / ${rotation}°` : ''}</strong></div>
                <svg ref={board} tabIndex={0} role="img" aria-label="Level drafting grid" viewBox={`${center[0] - viewWidth / 2} ${center[1] - viewHeight / 2} ${viewWidth} ${viewHeight}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; setDrag(null); }} onPointerLeave={() => setPointer(null)} onContextMenu={(e) => e.preventDefault()}>
                    <defs><pattern id="workshop-small-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 H 0 V 1" fill="none" stroke="#526b4930" strokeWidth="0.025" /></pattern><pattern id="workshop-road-grid" x={map.grid.origin[0] - 2.5} y={map.grid.origin[1] - 2.5} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 H 0 V 5" fill="none" stroke="#344b4570" strokeWidth="0.045" /></pattern></defs>
                    <rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="#bcc7ad" />
                    {allItems.filter((i) => i.kind === 'surface').map((i) => <g key={`${i.kind}:${i.id}`} data-item-id={i.id} data-kind={i.kind} transform={`translate(${drag?.item.id === i.id ? drag.x : i.x} ${drag?.item.id === i.id ? drag.z : i.z}) rotate(${-i.heading})`}><Symbol item={i} /></g>)}
                    <g pointerEvents="none"><rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="url(#workshop-small-grid)" /><rect x={center[0] - viewWidth / 2} y={center[1] - viewHeight / 2} width={viewWidth} height={viewHeight} fill="url(#workshop-road-grid)" /><path d={`M${center[0] - viewWidth / 2},0 H${center[0] + viewWidth / 2} M0,${center[1] - viewHeight / 2} V${center[1] + viewHeight / 2}`} stroke="#47635366" strokeWidth="0.035" /></g>
                    {allItems.filter((i) => i.kind !== 'surface').map((i) => <g key={`${i.kind}:${i.id}`} data-item-id={i.id} data-kind={i.kind} transform={`translate(${drag?.item.id === i.id ? drag.x : i.x} ${drag?.item.id === i.id ? drag.z : i.z}) rotate(${-i.heading})`}><Symbol item={i} /></g>)}
                    {current && <g pointerEvents="none" transform={`translate(${drag ? drag.x : current.x} ${drag ? drag.z : current.z}) rotate(${-current.heading})`}><rect x={-current.width / 2 - 0.15} y={-current.length / 2 - 0.15} width={current.width + 0.3} height={current.length + 0.3} fill="none" stroke="#f9f6cf" strokeWidth="0.13" strokeDasharray="0.4 0.2" /></g>}
                    {ghost && <g opacity="0.6" pointerEvents="none" transform={`translate(${ghost.x} ${ghost.z}) rotate(${-ghost.heading})`}><Symbol item={ghost} /><rect x={-ghost.width / 2} y={-ghost.length / 2} width={ghost.width} height={ghost.length} fill="none" stroke="#253e32" strokeWidth="0.1" /></g>}
                </svg>
                <div className="board-navigation"><span>+Z ↓ <i /> +X →</span><div><button aria-label="Zoom out" onClick={() => setViewWidth((w) => Math.min(240, w * 1.25))}>−</button><button onClick={fit}>Fit map</button><button aria-label="Zoom in" onClick={() => setViewWidth((w) => Math.max(10, w / 1.25))}>+</button></div></div>
            </div>
            <div className="builder-help"><span>Drag to move · R rotate · Delete remove</span><span>Alt + drag to pan · Arrows nudge · Ctrl / Cmd + D duplicate</span></div>
        </div>
        <aside className="builder-inspector" aria-label="Selection inspector">
            <p className="eyebrow">02 / INSPECT</p>
            <label className="builder-field"><span>Scene item</span><select aria-label="Scene item" value={current ? `${current.kind}:${current.id}` : ''} onChange={(e) => { const i = allItems.find((i) => `${i.kind}:${i.id}` === e.target.value); setSelected(i ? { kind: i.kind, id: i.id } : null); setTool('select'); }}><option value="">Choose an item…</option>{allItems.map((i) => <option key={`${i.kind}:${i.id}`} value={`${i.kind}:${i.id}`}>{i.id}</option>)}</select></label>
            {current ? <>
                <h2>{current.asset ? PROP_LABELS[current.asset] || ROAD_ASSETS[current.asset as RoadAsset]?.label : current.kind === 'target' ? 'Target bay' : current.kind === 'spawn' ? 'Player spawn' : current.kind === 'parking' ? 'Parking bay' : 'Surface'}</h2>
                <code className="inspector-id">{current.id}</code>
                <div className="builder-field-grid">{road ? <>{numeric('Column', 'column', road.cell[0], 1)}{numeric('Row', 'row', road.cell[1], 1)}</> : <>{numeric('X (m)', 'x', current.x)}{numeric('Z (m)', 'z', current.z)}</>}
                    {['object', 'surface', 'spawn'].includes(current.kind) && numeric('Y (m)', 'y', current.y)}
                    {['target', 'parking', 'surface'].includes(current.kind) && <>{numeric('Width (m)', 'width', current.width)}{numeric('Length (m)', 'length', current.length)}</>}
                    {current.height !== undefined && numeric('Height (m)', 'height', current.height, 0.05)}
                </div>
                {road ? <label className="builder-field"><span>Rotation</span><select aria-label="Rotation" value={road.rotation} onChange={(e) => property('heading', Number(e.target.value))}>{[0, 90, 180, 270].map((n) => <option key={n} value={n}>{n}°</option>)}</select></label> : numeric('Heading (°)', 'heading', current.heading, 15)}
                {current.kind === 'object' && <><div className="builder-field"><span>Physics</span><strong>{current.body === 'dynamic' ? 'Movable prop' : current.body === 'static' ? 'Static obstacle' : 'Decoration'}</strong></div>{current.body === 'dynamic' && numeric('Mass (kg)', 'mass', current.mass ?? 1000, 1)}</>}
                {current.kind === 'surface' && <><label className="builder-field"><span>Color</span><input aria-label="Surface color" type="color" value={current.color} onChange={(e) => property('color', e.target.value)} /></label><label className="builder-checkbox"><input type="checkbox" checked={current.solid} onChange={(e) => property('solid', e.target.checked)} />Solid collider</label><label className="builder-checkbox"><input type="checkbox" checked={current.support} onChange={(e) => property('support', e.target.checked)} />Driving surface</label></>}
                {current.kind === 'parking' && <label className="builder-checkbox"><input type="checkbox" checked={current.wheelStop} onChange={(e) => property('wheelStop', e.target.checked)} />Wheel stop</label>}
                <div className="inspector-actions"><button disabled={['spawn', 'target'].includes(current.kind)} onClick={duplicate}>Duplicate</button><button disabled={['spawn', 'target'].includes(current.kind)} onClick={remove}>Delete</button></div>
            </> : <div className="inspector-empty"><span>↖</span><h2>A place for everything.</h2><p>Select an item on the map to adjust its position, rotation, or dimensions.</p></div>}
            <div className="builder-map-settings"><h2>Map settings</h2><label className="builder-field"><span>Level ID</span><input aria-label="Level ID" value={map.id} maxLength={100} onChange={(e) => { if (e.target.value.trim()) edit((draft) => { draft.id = e.target.value; }); }} /></label><div className="builder-field-grid">{[0, 1].map((axis) => <label className="builder-field" key={axis}><span>Grid origin {axis === 0 ? 'X' : 'Z'}</span><input aria-label={`Grid origin ${axis === 0 ? 'X' : 'Z'}`} type="number" value={map.grid.origin[axis]} step="0.25" onChange={(e) => { if (e.target.value !== '') edit((draft) => { draft.grid.origin[axis] = e.target.valueAsNumber; }); }} /></label>)}</div><p>Road centres follow this origin. Roads use 5 m tiles; each level has one spawn and one target.</p></div>
            {warnings.length > 0 && <div className="builder-warnings" role="status"><strong>{warnings.length} map {warnings.length === 1 ? 'note' : 'notes'}</strong>{warnings.slice(0, 8).map((warning) => <p key={warning}>{warning}</p>)}</div>}
        </aside>
        <footer className="builder-status"><span className={error ? 'builder-error' : ''} role={error ? 'alert' : 'status'}>{error || message}</span><span>{map.roads.length} roads · {map.objects.length} props <i /> {saved}</span></footer>
    </section>;
}
