import type { ParkingGame } from '../game/session.ts';
import type { GameSession } from '../game/types.ts';
import { DIFFICULTY_LABELS, scoreStars } from '../game/campaign.ts';
import { Stars } from './Stars.tsx';
import { Arrow, ParkingMeter } from './GameHudParts.tsx';
import type { HudViewProps } from './hudTypes.ts';

function SteeringWheel({ value }: { value: number }) {
    return (
        <svg
            className="wheel-icon"
            viewBox="0 0 48 48"
            fill="none"
            style={{ transform: `rotate(${value * 110}deg)` }}
            aria-hidden="true"
        >
            <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="3" />
            <circle cx="24" cy="24" r="5" stroke="currentColor" strokeWidth="2.5" />
            <path d="m6 17 14 6m22-6-14 6m-4 6v13" stroke="currentColor" strokeWidth="3" />
        </svg>
    );
}

function RouteMap() {
    return (
        <div
            className="route-map"
            aria-label="Route: enter the courtyard, turn right around the island, then reverse into the green bay"
        >
            <div className="map-caption">
                <span>YOUR ROUTE</span>
                <span>01 → P</span>
            </div>
            <svg viewBox="0 0 210 160" fill="none" aria-hidden="true">
                <path d="M30 115V24h155v91H73v31H30v-31Z" fill="#e1dfd3" stroke="#b6b8aa" strokeWidth="1.5" />
                <rect x="41" y="73" width="34" height="30" rx="3" fill="#a5b695" />
                <path
                    d="M52 143v-29q0-5 10-5h43q15 0 15-17V66"
                    stroke="#586449"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                />
                <path d="m116 71 4-5 4 5" stroke="#586449" strokeWidth="2" />
                <rect x="107" y="31" width="25" height="35" rx="2" fill="#a0b979" stroke="#70824f" />
                <text x="119.5" y="54" textAnchor="middle" fill="#34422d" fontSize="17" fontWeight="700">
                    P
                </text>
                <rect x="75" y="34" width="18" height="28" rx="3" fill="#818a84" />
                <rect x="146" y="34" width="18" height="28" rx="3" fill="#818a84" />
                <circle cx="52" cy="133" r="7" fill="#2d3f37" />
                <text x="52" y="136" textAnchor="middle" fill="#fff" fontSize="8">
                    1
                </text>
            </svg>
        </div>
    );
}

export function DesktopControls() {
    return (
        <div className="controls">
            <div>
                <span className="key-pair">
                    <kbd>W</kbd>
                    <kbd>S</kbd>
                </span>
                <span>Drive / reverse</span>
            </div>
            <div>
                <svg viewBox="0 0 20 24" fill="none" aria-hidden="true">
                    <rect x="4" y="2" width="12" height="19" rx="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 2v7" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span>Mouse near center to steer</span>
            </div>
            <div>
                <kbd className="wide-key">SPACE</kbd>
                <span>Brake</span>
            </div>
        </div>
    );
}

function Overlay({ state, game, retry, onBuilder, onCampaign, bestScore, onNext, progressionNotice }: { state: GameSession; game: ParkingGame; retry: () => void; onBuilder?: () => void; onCampaign?: () => void; bestScore?: number; onNext?: () => void; progressionNotice?: string }) {
    const leave = onBuilder ?? onCampaign;
    const returnLabel = onBuilder ? 'Back to builder' : 'Level select';
    const focusCanvas = () => document.querySelector<HTMLCanvasElement>('canvas')?.focus();
    const start = () => {
        game.start();
        focusCanvas();
    };
    if (state.phase === 'playing' || state.phase === 'paused') return null;
    if (state.phase === 'loading')
        return (
            <div className="loading-screen" role="status">
                <div className="parking-glyph">
                    P<span />
                </div>
                <p>Loading level…</p>
            </div>
        );
    if (state.phase === 'error')
        return (
            <div className="modal-backdrop">
                <div className="result-card" role="alert">
                    <h2>Level couldn’t load</h2>
                    <p>{state.error}</p>
                    <button className="primary-button" onClick={retry}>
                        Reload
                        <Arrow />
                    </button>
                    {leave && <button className="text-button" onClick={leave}>{returnLabel}</button>}
                </div>
            </div>
        );
    if (state.phase === 'ready')
        return (
            <div className="intro-panel" role="dialog" aria-labelledby="intro-title">
                <h1 id="intro-title">{game.level.name}</h1>
                <div className="briefing">
                    <div>
                        <strong>{DIFFICULTY_LABELS[game.level.difficulty ?? 'easy']}</strong>
                        <p>{game.level.challenge ?? 'Parking precision'}</p>
                    </div>
                    <span className="difficulty-dots" aria-label={`${DIFFICULTY_LABELS[game.level.difficulty ?? 'easy']} difficulty`}>
                        <i />
                        <i className={(game.level.difficulty ?? 'easy') === 'easy' ? 'empty' : ''} />
                        <i className={game.level.difficulty === 'hard' ? '' : 'empty'} />
                    </span>
                </div>
                <div className="objective">
                    <span className="objective-icon">P</span>
                    <p>
                        Park in the <strong>green bay</strong> · Face the arrow · Stop for 1s
                    </p>
                </div>
                <DesktopControls />
                <button className="primary-button" onClick={start}>
                    Start
                    <Arrow />
                </button>
                <div className="intro-footnote">
                    {game.level.timeLimit}s from first movement <span>·</span> Hits: −{game.level.smallImpactPenalty ?? 10} small / −{game.level.impactPenalty} hard
                </div>
            </div>
        );
    const won = state.phase === 'won';
    return (
        <div className="modal-backdrop">
            <div className="result-card" role="dialog" aria-labelledby="result-title">
                <div className={`result-symbol ${won ? 'success' : ''}`}>{won ? 'P' : '↺'}</div>
                <h2 id="result-title">{won ? 'Parked!' : 'Time’s up'}</h2>
                {!onBuilder && <Stars count={scoreStars(state.score, won)} />}
                <div className="result-stats">
                    <div>
                        <span>FINAL SCORE</span>
                        <strong>{state.score.toString().padStart(3, '0')}</strong>
                    </div>
                    <div>
                        <span>TIME LEFT</span>
                        <strong>
                            {state.remaining.toFixed(1)}
                            <small>s</small>
                        </strong>
                    </div>
                    <div>
                        <span>IMPACTS</span>
                        <strong>{state.impacts}</strong>
                    </div>
                </div>
                {!onBuilder && bestScore !== undefined && <p className="campaign-best">PERSONAL BEST · {bestScore} PTS</p>}
                {won && !onBuilder && !onNext && progressionNotice && <p className="campaign-best">{progressionNotice}</p>}
                <div className="result-actions">
                {won && onNext && <button className="primary-button" onClick={onNext}>Next level<Arrow /></button>}
                <button className={won && onNext ? 'text-button' : 'primary-button'} onClick={start}>
                    {won ? 'Replay' : 'Retry'}
                    <Arrow />
                </button>
                {leave && <button className="text-button" onClick={leave}>{returnLabel}</button>}
                </div>
                <span className="result-shortcut">
                    <kbd>R</kbd> Restart
                </span>
            </div>
        </div>
    );
}

export function DesktopHud({ game, state, retry, onBuilder, onCampaign, testing, levelNumber, bestScore, onNext, progressionNotice, onSettings, settingsVisible }: HudViewProps) {
    const active = !['loading', 'error'].includes(state.phase);
    const playing = state.phase === 'playing';
    const timer = Math.ceil(state.remaining);
    return (
        <>
        <div className={`hud desktop-hud ${playing ? 'is-driving' : ''}`}>
            <header className="top-bar">
                <div className="wordmark" aria-label="Park Master">
                    <span className="brand-icon">P</span>
                    <span>
                        PARK<span className="wordmark-light">MASTER</span>
                    </span>
                </div>
                <div className="level-label">
                    <span className="eyebrow">{testing ? 'TEST DRIVE' : `LEVEL ${String(levelNumber).padStart(2, '0')}`}</span>
                    <strong>{game.level.name}</strong>
                </div>
                <div className="session-actions">
                    {active && <button className="icon-button" onClick={onSettings} aria-label="Settings" title="Settings">⚙</button>}
                    {active && (
                        <>
                            <button
                                className="icon-button secondary-action"
                                onClick={game.start}
                                aria-label="Restart level"
                                title="Restart (R)"
                            >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path
                                        d="M5 9a8 8 0 1 1-1 6m1-6V4m0 5h5"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                            <button
                                className="icon-button"
                                onClick={game.togglePause}
                                disabled={state.phase !== 'playing' && state.phase !== 'paused'}
                                aria-label={state.phase === 'paused' ? 'Resume game' : 'Pause game'}
                                title="Pause (Esc)"
                            >
                                {state.phase === 'paused' ? '▷' : 'Ⅱ'}
                            </button>
                        </>
                    )}
                </div>
            </header>
            {active && (
                <>
                    <div className="scoreboard">
                        <div className={`timer-stat ${timer <= 15 ? 'urgent' : ''}`}>
                            <span className="eyebrow">
                                <span className="timer-dot" /> TIME LEFT
                            </span>
                            <div>
                                <strong>
                                    {String(Math.floor(timer / 60)).padStart(2, '0')}:
                                    {String(timer % 60).padStart(2, '0')}
                                </strong>
                                <svg viewBox="0 0 38 38" aria-hidden="true">
                                    <circle cx="19" cy="19" r="15" fill="none" stroke="#d7d6c9" strokeWidth="2" />
                                    <circle
                                        cx="19"
                                        cy="19"
                                        r="15"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeDasharray={`${(state.remaining / game.level.timeLimit) * 94.25} 94.25`}
                                        transform="rotate(-90 19 19)"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="small-stats">
                            <div>
                                <span className="eyebrow">SCORE</span>
                                <strong>{state.score.toString().padStart(4, '0')}</strong>
                            </div>
                            <div>
                                <span className="eyebrow">IMPACTS</span>
                                <strong className={state.impactFlash > 0 ? 'impact-number' : ''}>
                                    {String(state.impacts).padStart(2, '0')}
                                </strong>
                            </div>
                        </div>
                        {state.phase === 'ready' && game.level.id === 'courtyard-01' && <RouteMap />}
                    </div>
                    {playing && !state.parkingInBay && (
                        <div className="mission-pill">
                            <span className="mission-parking">P</span>
                            <div>
                                <strong>
                                    {state.parkingProgress > 0
                                        ? 'Hold still'
                                        : 'Park in the green bay'}
                                </strong>
                                <span>{state.parkingHint}</span>
                            </div>
                        </div>
                    )}
                    <ParkingMeter state={state} />
                    {state.impactFlash > 0 && (
                        <div className="impact-toast" role="status">
                            {state.lastImpactKind === 'small' ? 'Bump' : 'Hit'} <strong>−{state.lastImpactPenalty}</strong>
                        </div>
                    )}
                    <footer className="bottom-bar">
                        <div className="level-footer">
                            <span>
                                {testing ? 'TEST' : String(levelNumber).padStart(2, '0')} <i /> {game.level.name.toUpperCase()}
                            </span>
                        </div>
                        {state.phase !== 'ready' && (
                            <div className="driving-instruments">
                                <div className="speed-readout">
                                    <strong>
                                        {Math.round(Math.abs(state.speed) * 3.6)
                                            .toString()
                                            .padStart(2, '0')}
                                    </strong>
                                    <span>KM/H</span>
                                </div>
                                <div className="instrument-divider" />
                                <div className="steering-readout">
                                    <SteeringWheel value={state.steering} />
                                    <div>
                                        <span className="eyebrow">STEERING</span>
                                        <div className="steering-track">
                                            <span style={{ left: `${50 + state.steering * 45}%` }} />
                                            <i />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="footer-controls">
                            <span>
                                <kbd>R</kbd> Restart
                            </span>
                            <span>
                                <kbd>ESC</kbd> Pause
                            </span>
                        </div>
                    </footer>
                    {playing && (
                        <div className="compact-controls">
                            <DesktopControls />
                        </div>
                    )}
                </>
            )}
            {!settingsVisible && <Overlay state={state} game={game} retry={retry} onBuilder={testing ? onBuilder : undefined} onCampaign={testing ? undefined : onCampaign} bestScore={bestScore} onNext={testing ? undefined : onNext} progressionNotice={progressionNotice} />}
        </div>
        </>
    );
}
