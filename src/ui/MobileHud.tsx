import { DIFFICULTY_LABELS, scoreStars } from '../game/campaign.ts';
import { Arrow, ParkingMeter } from './GameHudParts.tsx';
import { MobileControls, MobileTips } from './MobileControls.tsx';
import { Stars } from './Stars.tsx';
import type { HudViewProps } from './hudTypes.ts';
import './mobile-hud.css';

export function MobileHud({ game, state, retry, testing, onBuilder, onCampaign, bestScore, onNext, progressionNotice, onSettings, settingsVisible, showTips, dismissTips }: HudViewProps & { showTips: boolean; dismissTips: () => void }) {
    const playing = state.phase === 'playing';
    const active = !['loading', 'error'].includes(state.phase);
    const timer = Math.ceil(state.remaining);
    const start = () => {
        dismissTips();
        game.start();
        document.querySelector<HTMLCanvasElement>('.game-shell canvas')?.focus();
    };
    const leave = testing ? onBuilder : onCampaign;
    const leaveLabel = testing ? 'Back to builder' : 'Level select';
    const won = state.phase === 'won';

    return <div className="mobile-hud">
        {active && <header className="mobile-game-header">
            <div className={`mobile-game-status ${timer <= 15 ? 'urgent' : ''}`} aria-label="Game status">
                <div><span>TIME</span><strong>{String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}</strong></div>
                <div><span>SCORE</span><strong>{state.score.toString().padStart(4, '0')}</strong></div>
            </div>
            <div className="mobile-game-actions">
                <button aria-label="Settings" onClick={onSettings}><span aria-hidden="true">⚙</span></button>
                {playing && <button aria-label="Pause game" onClick={game.togglePause}><span aria-hidden="true">Ⅱ</span></button>}
            </div>
        </header>}
        {playing && <>
            <ParkingMeter state={state} />
            {state.impactFlash > 0 && <div className="mobile-impact-toast" role="status">{state.lastImpactKind === 'small' ? 'Bump' : 'Hit'} <strong>−{state.lastImpactPenalty}</strong></div>}
            <MobileControls game={game} />
        </>}
        {!settingsVisible && state.phase === 'loading' && <div className="loading-screen" role="status"><div className="parking-glyph">P<span /></div><p>Loading level…</p></div>}
        {!settingsVisible && state.phase === 'ready' && <div className="mobile-overlay">
            <div className="mobile-briefing" role="dialog" aria-labelledby="mobile-intro-title">
                <h1 id="mobile-intro-title">{game.level.name}</h1>
                <p className="mobile-level-meta">{DIFFICULTY_LABELS[game.level.difficulty ?? 'easy']} · {game.level.timeLimit}s</p>
                <p>Green bay · Face the arrow · Stop for 1s</p>
                {showTips && <MobileTips onDismiss={dismissTips} />}
                <button className="primary-button" onClick={start}>Start<Arrow /></button>
            </div>
        </div>}
        {!settingsVisible && state.phase === 'error' && <div className="mobile-overlay">
            <div className="result-card" role="alert"><h2>Level couldn’t load</h2><p>{state.error}</p><button className="primary-button" onClick={retry}>Reload<Arrow /></button><button className="text-button" onClick={leave}>{leaveLabel}</button></div>
        </div>}
        {!settingsVisible && (won || state.phase === 'lost') && <div className="mobile-overlay">
            <div className="result-card" role="dialog" aria-labelledby="mobile-result-title">
                <h2 id="mobile-result-title">{won ? 'Parked!' : 'Time’s up'}</h2>
                {!testing && <Stars count={scoreStars(state.score, won)} />}
                <div className="result-stats">
                    <div><span>FINAL SCORE</span><strong>{state.score.toString().padStart(3, '0')}</strong></div>
                    <div><span>TIME LEFT</span><strong>{state.remaining.toFixed(1)}<small>s</small></strong></div>
                    <div><span>IMPACTS</span><strong>{state.impacts}</strong></div>
                </div>
                {!testing && bestScore !== undefined && <p className="campaign-best">PERSONAL BEST · {bestScore} PTS</p>}
                {won && !testing && !onNext && progressionNotice && <p className="campaign-best">{progressionNotice}</p>}
                <div className="result-actions">
                    {won && !testing && onNext && <button className="primary-button" onClick={onNext}>Next level<Arrow /></button>}
                    <button className={won && !testing && onNext ? 'text-button' : 'primary-button'} onClick={start}>{won ? 'Replay' : 'Retry'}<Arrow /></button>
                    <button className="text-button" onClick={leave}>{leaveLabel}</button>
                </div>
            </div>
        </div>}
    </div>;
}
