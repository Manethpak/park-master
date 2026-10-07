import { useState } from 'react';
import type { MapDefinition } from '../game/types.ts';

type EditMap = (change: (draft: MapDefinition) => void) => boolean;

function SettingField({ label, value, onCommit, min, max, step = 1 }: {
    label: string; value: string | number; onCommit: (value: string) => void;
    min?: number; max?: number; step?: number;
}) {
    const [editing, setEditing] = useState<string | null>(null);
    return <label className="builder-field"><span>{label}</span><input
        aria-label={label}
        type={typeof value === 'number' ? 'number' : 'text'}
        value={editing ?? value}
        min={min} max={max} step={step} maxLength={100}
        onChange={(event) => setEditing(event.target.value)}
        onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== String(value)) onCommit(next);
            setEditing(null);
        }}
        onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        }}
    /></label>;
}

export function MapSettings({ map, edit }: { map: MapDefinition; edit: EditMap }) {
    return <div className="builder-map-settings" aria-label="Map settings">
        <h2>Map settings</h2>
        <p>Global rules and layout. Saved with your draft and JSON template, independent of the selected element.</p>
        <SettingField label="Level ID" value={map.id} onCommit={(value) => edit((draft) => { draft.id = value; })} />
        <h2>Campaign discovery</h2>
        <label className="builder-field"><span>Difficulty</span><select aria-label="Difficulty" value={map.difficulty ?? 'easy'} onChange={(event) => edit((draft) => { draft.difficulty = event.target.value as MapDefinition['difficulty']; })}>
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select></label>
        <SettingField label="Challenge label" value={map.challenge ?? 'Parking precision'} onCommit={(value) => edit((draft) => { draft.challenge = value; })} />
        <SettingField label="Campaign order" value={map.campaignOrder ?? 0} min={0} max={10000} onCommit={(value) => edit((draft) => { draft.campaignOrder = Number(value); })} />
        <p>Difficulty is authored, not inferred. Lower order comes first within a difficulty. Only developer-supplied campaign files count toward unlocks; test drives never count.</p>
        <h2>Attempt rules</h2>
        <SettingField label="Time limit (seconds)" value={map.timeLimit} min={1} max={3600} onCommit={(value) => edit((draft) => { draft.timeLimit = Number(value); })} />
        <SettingField label="Small impact penalty" value={map.smallImpactPenalty ?? 10} min={0} max={1000} onCommit={(value) => edit((draft) => { draft.smallImpactPenalty = Number(value); })} />
        <SettingField label="Hard impact penalty" value={map.impactPenalty} min={0} max={1000} onCommit={(value) => edit((draft) => { draft.impactPenalty = Number(value); })} />
        <p>Points per distinct hit. Small: cones and boxes. Hard: vehicles, signs, curbs, fences, and boundaries. Zero disables that penalty.</p>
        <h2>Road grid</h2>
        <div className="builder-field-grid">{[0, 1].map((axis) => <SettingField
            key={axis} label={`Grid origin ${axis === 0 ? 'X' : 'Z'}`} value={map.grid.origin[axis]}
            min={-500} max={500} step={0.25}
            onCommit={(value) => edit((draft) => { draft.grid.origin[axis] = Number(value); })}
        />)}</div>
        <label className="builder-field"><span>Road cell size (m)</span><input aria-label="Road cell size (m)" value={map.grid.cellSize} readOnly /></label>
        <p>Road centres follow this origin. Tile size stays at 5 m to match the models. Props, spawn, and bays keep their world positions.</p>
    </div>;
}
