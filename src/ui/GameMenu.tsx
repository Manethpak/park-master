import { useEffect, useRef } from 'react';
import { ASSETS, vehicleGeometry } from '../game/assets.ts';
import { CAMPAIGN, levelRecord, scoreStars } from '../game/campaign.ts';
import type { CampaignProgress } from '../game/campaign.ts';
import { roadPosition } from '../game/maps.ts';
import type { MapDefinition } from '../game/types.ts';
import sedan from '../assets/car-kit/preview/sedan.png';
import './menu.css';

export function Stars({ count, label = `${count} of 3 stars` }: { count: number; label?: string }) {
    return <span className="game-stars" role="img" aria-label={label}>{[1, 2, 3].map((star) => <span key={star} className={star <= count ? 'earned' : ''} aria-hidden="true">★</span>)}</span>;
}

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

export function GameMenu({ screen, progress, selected, notice, onCampaign, onHome, onBuilder, onSelect, onPlay }: {
    screen: 'home' | 'campaign'; progress: CampaignProgress; selected: number; notice: string;
    onCampaign: () => void; onHome: () => void; onBuilder: () => void; onSelect: (index: number) => void; onPlay: () => void;
}) {
    const primary = useRef<HTMLButtonElement>(null);
    const level = CAMPAIGN[selected];
    const record = levelRecord(progress, level);
    const totalStars = CAMPAIGN.reduce((total, item) => total + scoreStars(levelRecord(progress, item)?.bestScore ?? 0, Boolean(levelRecord(progress, item))), 0);
    const completed = CAMPAIGN.filter((item) => levelRecord(progress, item)).length;
    useEffect(() => { primary.current?.focus(); }, [screen]);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && screen === 'campaign') { event.preventDefault(); onHome(); }
            if (screen === 'campaign' && (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
                event.preventDefault(); onSelect((selected + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : CAMPAIGN.length - 1)) % CAMPAIGN.length);
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [screen, selected, onHome, onSelect]);
    return <main className="game-menu" aria-label={screen === 'home' ? 'Main menu' : 'Campaign level select'}>
        <div className="menu-road" aria-hidden="true"><div /><div /></div>
        <header className="menu-header"><span className="menu-logo"><b>P</b> PARK MASTER</span><div className="menu-total"><span aria-hidden="true">★</span> {totalStars} / {CAMPAIGN.length * 3}<small>CAMPAIGN STARS</small></div></header>
        {screen === 'home' ? <div className="title-screen">
            <section className="title-actions"><p className="menu-kicker">THE PARKING CHALLENGE</p><h1>PARK<br /><span>MASTER</span><i aria-hidden="true">↗</i></h1><p className="title-tagline">One car. Tight spaces. Make it fit.</p>
                <button ref={primary} className="mode-button campaign-button" onClick={onCampaign} aria-label="Play campaign"><span className="mode-icon" aria-hidden="true">▶</span><span><strong>PLAY CAMPAIGN</strong><small>{completed ? `${completed} / ${CAMPAIGN.length} levels cleared · keep your streak going` : 'Pick a level. Park clean. Earn your stars.'}</small></span><b aria-hidden="true">→</b></button>
                <button className="mode-button workshop-button" onClick={onBuilder} aria-label="Map builder"><span className="mode-icon" aria-hidden="true">▦</span><span><strong>MAP BUILDER</strong><small>Your space. Your rules. Build & test drive.</small></span><b aria-hidden="true">→</b></button>
            </section>
            <div className="menu-showcase" aria-hidden="true"><div className="showcase-bay"><span>P</span></div><img src={sedan} alt="" /><span className="showcase-sticker">NO SPACE?<br />NO PROBLEM.</span><span className="showcase-cone">▲</span></div>
        </div> : <section className="campaign-screen" aria-label="Campaign">
            <div className="campaign-heading"><button className="menu-back" onClick={onHome}>← Main menu</button><h1>SELECT LEVEL</h1><p>{completed} / {CAMPAIGN.length} cleared</p></div>
            <div className="campaign-layout"><div className="campaign-levels" aria-label="Campaign levels">{CAMPAIGN.map((item, index) => {
                const best = levelRecord(progress, item);
                return <button key={item.map.id} className={`level-tile ${index === selected ? 'selected' : ''}`} aria-label={`Select level ${index + 1}: ${item.map.name}`} aria-pressed={index === selected} onClick={() => onSelect(index)}>
                    <span className="level-number">{String(index + 1).padStart(2, '0')}</span><span className="level-tile-info"><strong>{item.map.name}</strong><small>{best ? `BEST ${best.bestScore} PTS` : 'NOT CLEARED'}</small></span><Stars count={scoreStars(best?.bestScore ?? 0, Boolean(best))} />
                </button>;
            })}<div className="more-levels"><span aria-hidden="true">⚑</span><p>More parking challenges<br />coming down the road.</p></div></div>
                <div className="level-briefing"><div className="level-map-frame"><LevelPreview map={level.map} /><span className="map-label">{String(selected + 1).padStart(2, '0')} / {level.map.playerVehicle?.toUpperCase() ?? 'SEDAN'}</span></div><div className="briefing-details"><div><p className="menu-kicker">PARKING CHALLENGE {String(selected + 1).padStart(2, '0')}</p><h2>{level.map.name}</h2></div><Stars count={scoreStars(record?.bestScore ?? 0, Boolean(record))} /><p className="level-mission">Find the green bay. Face the arrow. Hold for one second.</p><dl><div><dt>TIME LIMIT</dt><dd>90<span> SEC</span></dd></div><div><dt>BEST SCORE</dt><dd>{record ? record.bestScore : '—'}<span> PTS</span></dd></div><div><dt>IMPACT</dt><dd>−50<span> PTS</span></dd></div></dl>
                    <p className="star-goals">★ Park successfully <span>★★ 500+</span> <span>★★★ 800+</span></p><button ref={primary} className="menu-launch" onClick={onPlay}>{record ? 'REPLAY LEVEL' : 'START LEVEL'}<span aria-hidden="true">▶</span></button></div></div>
            </div>
        </section>}
        <footer className="menu-footer"><span><kbd>ENTER</kbd> Select <kbd>↑</kbd><kbd>↓</kbd> Browse <kbd>ESC</kbd> Back</span><span>KEYBOARD + MOUSE <i /> LOCAL SAVE</span></footer>
        {notice && <p className="menu-save-notice" role="status">{notice}</p>}
    </main>;
}
