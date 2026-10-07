import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN, DIFFICULTY_LABELS, difficultyStatus, levelRecord, recommendedLevel, scoreStars } from '../game/campaign.ts';
import { Stars } from './Stars.tsx';
import type { GameMenuProps } from './menuTypes.ts';
import './mobile-menu.css';

export function MobileGameMenu({ hidden, screen, progress, unlocked, notice, onCampaign, onHome, onBuilder, onQuickPlay, onContinue }: GameMenuProps) {
    const [filter, setFilter] = useState('all');
    const primary = useRef<HTMLButtonElement>(null);
    const groups = difficultyStatus(progress, unlocked);
    const recommended = recommendedLevel(progress, unlocked);
    const completed = CAMPAIGN.filter((item) => levelRecord(progress, item)).length;
    const visible = CAMPAIGN.map((item, index) => ({ item, index })).filter(({ item }) => {
        const best = levelRecord(progress, item);
        return filter === 'all' || (filter === 'unplayed' ? !best : Boolean(best) && scoreStars(best?.bestScore ?? 0, true) < 3);
    });

    useEffect(() => { if (!hidden) primary.current?.focus(); }, [screen, hidden]);
    useEffect(() => {
        if (hidden || screen !== 'campaign') return;
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onHome(); }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [hidden, screen, onHome]);

    return <main className="mobile-game-menu" hidden={hidden} aria-label={screen === 'home' ? 'Main menu' : 'Campaign level select'}>
        {screen === 'home' ? <section className="mobile-home">
            <h1>PARK<br /><span>MASTER</span></h1>
            <button ref={primary} className="mobile-menu-primary" onClick={onCampaign} aria-label="Play campaign">Play campaign <span aria-hidden="true">▶</span></button>
            <span className="mobile-menu-progress">{completed} / {CAMPAIGN.length} cleared</span>
            <button className="mobile-menu-button" onClick={onContinue}>Continue → {CAMPAIGN[recommended].map.name}</button>
            <button className="mobile-menu-button" onClick={onBuilder} aria-label="Map builder">Map builder <span aria-hidden="true">▦</span></button>
        </section> : <>
            <header className="mobile-campaign-header">
                <button ref={primary} className="mobile-menu-button" onClick={onHome} aria-label="Main menu">←</button>
                <h1>SELECT LEVEL</h1>
                <select aria-label="Filter levels" value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="all">All levels</option>
                    <option value="unplayed">Unplayed</option>
                    <option value="improve">Improve stars</option>
                </select>
            </header>
            <div className="mobile-campaign-levels" aria-label="Campaign levels">
                {groups.map((group, groupIndex) => <section className="mobile-difficulty-group" key={group.difficulty} aria-label={`${DIFFICULTY_LABELS[group.difficulty]} levels`}>
                    <div className="mobile-difficulty-heading">
                        <h2>{DIFFICULTY_LABELS[group.difficulty]} <small>{group.open ? 'OPEN' : 'LOCKED'}</small></h2>
                        <span>★ {group.stars}/{group.maximum}</span>
                    </div>
                    {!group.open && <p className="mobile-menu-note">{group.required > 0 ? `Unlock: ${group.earned}/${group.required} ${DIFFICULTY_LABELS[groups[groupIndex - 1].difficulty]} stars` : 'Previous difficulty has no levels yet.'}</p>}
                    <div className="mobile-level-grid">
                        {visible.filter(({ item }) => (item.map.difficulty ?? 'easy') === group.difficulty).map(({ item, index }) => {
                            const best = levelRecord(progress, item);
                            return <button key={item.map.id} className="mobile-level-tile" aria-label={`Select level ${index + 1}: ${item.map.name}`} disabled={!group.open} onClick={() => onQuickPlay(index)}>
                                <span className="mobile-level-number">{String(index + 1).padStart(2, '0')}</span>
                                <strong>{item.map.name}</strong>
                                <Stars count={scoreStars(best?.bestScore ?? 0, Boolean(best))} />
                                <span className="mobile-level-action" aria-hidden="true">{group.open ? '▶' : '⊘'}</span>
                            </button>;
                        })}
                    </div>
                    {!CAMPAIGN.some((item) => (item.map.difficulty ?? 'easy') === group.difficulty) && <p className="mobile-menu-note">No levels yet.</p>}
                </section>)}
                {!visible.length && <p className="mobile-menu-note" role="status">No matches. Choose All levels.</p>}
            </div>
        </>}
        {notice && <p className="mobile-menu-note mobile-save-notice" role="status">{notice}</p>}
    </main>;
}
