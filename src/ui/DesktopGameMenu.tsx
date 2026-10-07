import { useEffect, useRef, useState } from 'react';
import { ASSETS, vehicleGeometry } from '../game/assets.ts';
import { CAMPAIGN, DIFFICULTY_LABELS, canPlayLevel, difficultyStatus, levelRecord, recommendedLevel, scoreStars } from '../game/campaign.ts';
import { roadPosition } from '../game/maps.ts';
import type { MapDefinition } from '../game/types.ts';
import { Stars } from './Stars.tsx';
import type { GameMenuProps } from './menuTypes.ts';
import './menu.css';

function LevelPreview({ map }: { map: MapDefinition }) {
    const vehicle = vehicleGeometry(map.playerVehicle);
    const footprints = [
        { x: map.spawn.position[0], z: map.spawn.position[2], width: vehicle.width, length: vehicle.length, heading: map.spawn.heading }, map.bay,
        ...map.objects.map((o) => ({ x: o.position[0], z: o.position[2], width: ASSETS[o.asset].dimensions[0] * ASSETS[o.asset].scale, length: ASSETS[o.asset].dimensions[2] * ASSETS[o.asset].scale, heading: o.heading })),
        ...map.surfaces.filter((s) => s.id !== 'ground').map((s) => ({ x: s.position[0], z: s.position[2], width: s.size[0], length: s.size[2], heading: s.heading })),
        ...map.roads.map((r) => { const [x, z] = roadPosition(map, r); return { x, z, width: 5, length: 5, heading: 0 }; }),
        ...(map.playableZone ? [{ ...map.playableZone, heading: 0 }] : [])
    ];
    const bounds = footprints.map((item) => {
        const angle = item.heading * Math.PI / 180;
        return { x: item.x, z: item.z, halfX: (Math.abs(Math.cos(angle)) * item.width + Math.abs(Math.sin(angle)) * item.length) / 2, halfZ: (Math.abs(Math.sin(angle)) * item.width + Math.abs(Math.cos(angle)) * item.length) / 2 };
    });
    const minX = Math.min(...bounds.map((p) => p.x - p.halfX)) - 2;
    const minZ = Math.min(...bounds.map((p) => p.z - p.halfZ)) - 2;
    const width = Math.max(...bounds.map((p) => p.x + p.halfX)) - minX + 2;
    const length = Math.max(...bounds.map((p) => p.z + p.halfZ)) - minZ + 2;
    return <svg className="level-preview" viewBox={`${minX} ${minZ} ${width} ${length}`} role="img" aria-label={`${map.name} map preview`}>
        <rect x={minX} y={minZ} width={width} height={length} fill="#a2b28c" />
        {map.surfaces.filter((s) => s.id !== 'ground').map((s) => <rect key={s.id} x={-s.size[0] / 2} y={-s.size[2] / 2} width={s.size[0]} height={s.size[2]} fill={s.color} transform={`translate(${s.position[0]} ${s.position[2]}) rotate(${-s.heading})`} />)}
        {map.roads.map((road) => { const [x, z] = roadPosition(map, road); return <rect key={road.id} x={x - 2.5} y={z - 2.5} width="5" height="5" fill="#66716b" stroke="#dddac4" strokeWidth="0.08" />; })}
        {map.objects.map((object) => {
            const asset = ASSETS[object.asset];
            const w = asset.dimensions[0] * asset.scale, l = asset.dimensions[2] * asset.scale;
            return <rect key={object.id} x={-w / 2} y={-l / 2} width={w} height={l} rx="0.15" fill={object.asset.startsWith('tree') ? '#587342' : object.asset.startsWith('house') ? '#c4b397' : '#d4d4bc'} stroke="#344b3b" strokeWidth="0.06" transform={`translate(${object.position[0]} ${object.position[2]}) rotate(${-object.heading})`} />;
        })}
        <g transform={`translate(${map.bay.x} ${map.bay.z}) rotate(${-map.bay.heading})`}><rect x={-map.bay.width / 2} y={-map.bay.length / 2} width={map.bay.width} height={map.bay.length} fill="#d9ef82" stroke="#f7f1cd" strokeWidth="0.15" /><text textAnchor="middle" dominantBaseline="central" fontSize="2" fill="#304430">P</text></g>
        <rect x={-vehicle.width / 2} y={-vehicle.length / 2} width={vehicle.width} height={vehicle.length} rx="0.3" fill="#304b43" stroke="#f4f0c9" strokeWidth="0.15" transform={`translate(${map.spawn.position[0]} ${map.spawn.position[2]}) rotate(${-map.spawn.heading})`} />
        {map.playableZone && <rect x={map.playableZone.x - map.playableZone.width / 2} y={map.playableZone.z - map.playableZone.length / 2} width={map.playableZone.width} height={map.playableZone.length} fill="none" stroke="#f1cf79" strokeWidth="0.2" strokeDasharray="0.7 0.4" />}
    </svg>;
}

export function DesktopGameMenu({ hidden, screen, progress, unlocked, selected, notice, onCampaign, onHome, onBuilder, onSelect, onPlay, onContinue }: GameMenuProps) {
    const primary = useRef<HTMLButtonElement>(null);
    const [filter, setFilter] = useState('all');
    const level = CAMPAIGN[selected];
    const record = levelRecord(progress, level);
    const totalStars = CAMPAIGN.reduce((total, item) => total + scoreStars(levelRecord(progress, item)?.bestScore ?? 0, Boolean(levelRecord(progress, item))), 0);
    const completed = CAMPAIGN.filter((item) => levelRecord(progress, item)).length;
    const groups = difficultyStatus(progress, unlocked);
    const recommended = recommendedLevel(progress, unlocked);
    const open = canPlayLevel(selected, progress, unlocked);
    const selectedGroup = groups.find((group) => group.difficulty === (level.map.difficulty ?? 'easy'))!;
    const lockMessage = (group: typeof selectedGroup) => group.required > 0
        ? `Unlock: ${group.earned}/${group.required} ${DIFFICULTY_LABELS[groups[groups.indexOf(group) - 1].difficulty]} stars`
        : 'Previous difficulty has no levels yet.';
    const visible = CAMPAIGN.map((item, index) => ({ item, index })).filter(({ item }) => {
        const best = levelRecord(progress, item);
        return filter === 'all' || (filter === 'unplayed' ? !best : Boolean(best) && scoreStars(best?.bestScore ?? 0, true) < 3);
    });
    useEffect(() => { if (!hidden) primary.current?.focus(); }, [screen, hidden]);
    useEffect(() => {
        if (hidden) return;
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && screen === 'campaign') { event.preventDefault(); onHome(); }
            if (screen === 'campaign' && (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
                if ((event.target as HTMLElement)?.matches('input, select, textarea')) return;
                if (!visible.length) return;
                event.preventDefault();
                const current = visible.findIndex(({ index }) => index === selected);
                const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
                onSelect(visible[(current + direction + visible.length) % visible.length].index);
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [hidden, screen, selected, onHome, onSelect, visible]);
    return <main className="game-menu desktop-game-menu" hidden={hidden} aria-label={screen === 'home' ? 'Main menu' : 'Campaign level select'}>
        <div className="menu-road" aria-hidden="true"><div /><div /></div>
        <header className="menu-header"><span className="menu-logo"><b>P</b> PARK MASTER</span><div className="menu-total"><span aria-hidden="true">★</span> {totalStars} / {CAMPAIGN.length * 3}<small>CAMPAIGN STARS</small></div></header>
        <div className="title-screen" hidden={screen !== 'home'}>
            <section className="title-actions"><h1>PARK<br /><span>MASTER</span><i aria-hidden="true">↗</i></h1>
                <button ref={screen === 'home' ? primary : undefined} className="mode-button campaign-button" onClick={onCampaign} aria-label="Play campaign"><span className="mode-icon" aria-hidden="true">▶</span><span><strong>PLAY CAMPAIGN</strong><small>{completed} / {CAMPAIGN.length} cleared</small></span><b aria-hidden="true">→</b></button>
                <button className="menu-back continue-home" onClick={onContinue}>Continue → <span>{CAMPAIGN[recommended].map.name}</span></button>
                <button className="mode-button workshop-button" onClick={onBuilder} aria-label="Map builder"><span className="mode-icon" aria-hidden="true">▦</span><span><strong>MAP BUILDER</strong></span><b aria-hidden="true">→</b></button>
            </section>
            <div className="menu-showcase" aria-hidden="true" />
        </div>
        {screen === 'campaign' && <section className="campaign-screen" aria-label="Campaign">
            <div className="campaign-heading"><button className="menu-back" onClick={onHome}>← Main menu</button><h1>SELECT LEVEL</h1><p>{completed} / {CAMPAIGN.length} cleared</p></div>
            <div className="campaign-toolbar"><label>Show <select aria-label="Filter levels" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All levels</option><option value="unplayed">Unplayed</option><option value="improve">Improve stars</option></select></label><button className="menu-back" onClick={() => { setFilter('all'); onSelect(recommended); }}>Recommended → {CAMPAIGN[recommended].map.name}</button></div>
            <div className="campaign-layout"><div className="campaign-levels" aria-label="Campaign levels">{groups.map((group) => <section className={`difficulty-group ${group.open ? '' : 'locked'}`} key={group.difficulty} aria-label={`${DIFFICULTY_LABELS[group.difficulty]} levels`}>
                <div className="difficulty-heading"><h2>{DIFFICULTY_LABELS[group.difficulty]} <span>{group.open ? 'OPEN' : 'LOCKED'}</span></h2><strong>★ {group.stars}/{group.maximum}</strong></div>
                {!group.open && <p className="unlock-message">{lockMessage(group)}</p>}
                {visible.filter(({ item }) => (item.map.difficulty ?? 'easy') === group.difficulty).map(({ item, index }) => {
                const best = levelRecord(progress, item);
                return <button key={item.map.id} className={`level-tile ${index === selected ? 'selected' : ''}`} aria-label={`Select level ${index + 1}: ${item.map.name}`} aria-pressed={index === selected} onClick={() => onSelect(index)}>
                    <span className="level-number">{String(index + 1).padStart(2, '0')}</span><span className="level-tile-info"><strong>{item.map.name}</strong><small>{!group.open ? 'LOCKED' : best ? `BEST ${best.bestScore} PTS` : 'NOT CLEARED'}{index === recommended ? ' · RECOMMENDED' : ''}</small></span><Stars count={scoreStars(best?.bestScore ?? 0, Boolean(best))} />
                </button>;
            })}
                {!CAMPAIGN.some((item) => (item.map.difficulty ?? 'easy') === group.difficulty) && <p className="group-empty">No levels yet.</p>}
            </section>)}{!visible.length && <p className="group-empty" role="status">No matches. Choose All levels.</p>}</div>
                <div className="level-briefing" role="region" aria-label="Selected level"><div className="level-map-frame"><LevelPreview map={level.map} /><span className="map-label">{String(selected + 1).padStart(2, '0')} / {level.map.playerVehicle?.toUpperCase() ?? 'SEDAN'}</span></div><div className="briefing-details"><div><p className="menu-kicker">LEVEL {String(selected + 1).padStart(2, '0')}</p><h2>{level.map.name}</h2></div><Stars count={scoreStars(record?.bestScore ?? 0, Boolean(record))} /><p className="level-mission">Green bay · Face the arrow · Stop for 1s</p><dl><div><dt>TIME LIMIT</dt><dd>{level.map.timeLimit}<span> SEC</span></dd></div><div><dt>BEST SCORE</dt><dd>{record ? record.bestScore : '—'}<span> PTS</span></dd></div><div><dt>IMPACT</dt><dd>−{level.map.smallImpactPenalty ?? 10}<span> SMALL</span><br />−{level.map.impactPenalty}<span> HARD</span></dd></div></dl>
                    <p className="challenge-label">{DIFFICULTY_LABELS[level.map.difficulty ?? 'easy']} · {level.map.challenge ?? 'Parking precision'}</p>
                    {!open && <p className="briefing-lock" role="status">{lockMessage(selectedGroup)}</p>}
                    <p className="star-goals">★ 1–300 <span>★★ 301–600</span> <span>★★★ 601+</span></p></div><button ref={primary} className="menu-launch" onClick={onPlay} disabled={!open}>{!open ? 'LEVEL LOCKED' : record ? 'REPLAY LEVEL' : 'START LEVEL'}<span aria-hidden="true">{open ? '▶' : '⊘'}</span></button></div>
            </div>
        </section>}
        <footer className="menu-footer"><span><kbd>ENTER</kbd> Select <kbd>↑</kbd><kbd>↓</kbd> Browse <kbd>ESC</kbd> Back</span><span>KEYBOARD + MOUSE <i /> LOCAL SAVE</span></footer>
        {notice && <p className="menu-save-notice" role="status">{notice}</p>}
    </main>;
}
