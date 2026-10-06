import { Application } from '@playcanvas/react';
import { Component, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ErrorInfo, ReactNode } from 'react';

import { COURTYARD } from './game/level.ts';
import { resolveMap } from './game/maps.ts';
import { MapBuilder } from './editor/MapBuilder.tsx';
import { GameScene } from './game/Scene.tsx';
import { ParkingGame } from './game/session.ts';
import type { GameSession, MapDefinition } from './game/types.ts';

function Arrow() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

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

function Controls() {
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
                <span>Steer near screen center</span>
            </div>
            <div>
                <kbd className="wide-key">SPACE</kbd>
                <span>Brake</span>
            </div>
        </div>
    );
}

function Overlay({ state, game, retry }: { state: GameSession; game: ParkingGame; retry: () => void }) {
    const focusCanvas = () => document.querySelector<HTMLCanvasElement>('canvas')?.focus();
    const start = () => {
        game.start();
        focusCanvas();
    };
    const resume = () => {
        game.togglePause();
        focusCanvas();
    };
    if (state.phase === 'playing') return null;
    if (state.phase === 'loading')
        return (
            <div className="loading-screen" role="status">
                <div className="parking-glyph">
                    P<span />
                </div>
                <p>Setting up the courtyard…</p>
                <span className="eyebrow">MODELS · MATERIALS · PHYSICS</span>
            </div>
        );
    if (state.phase === 'error')
        return (
            <div className="modal-backdrop">
                <div className="result-card" role="alert">
                    <span className="eyebrow">LET’S TRY AGAIN</span>
                    <h2>A little roadblock.</h2>
                    <p>{state.error}</p>
                    <button className="primary-button" onClick={retry}>
                        Reload the level
                        <Arrow />
                    </button>
                </div>
            </div>
        );
    if (state.phase === 'ready')
        return (
            <div className="intro-panel" role="dialog" aria-labelledby="intro-title">
                <div className="eyebrow">
                    <span className="tiny-dot" /> A LITTLE DRIVING CHALLENGE
                </div>
                <h1 id="intro-title">
                    Small space.
                    <br />
                    Big precision.
                </h1>
                <p className="intro-description">
                    One car. One parking challenge. Get into your spot before the clock runs out.
                </p>
                <div className="briefing">
                    <span className="briefing-number">01</span>
                    <div>
                        <strong>{game.level.name}</strong>
                        <p>{game.level.id === 'courtyard-01' ? 'Tight turns & reverse parking' : 'Custom parking challenge'}</p>
                    </div>
                    <span className="difficulty-dots">
                        <i />
                        <i />
                        <i className="empty" />
                    </span>
                </div>
                <div className="objective">
                    <span className="objective-icon">P</span>
                    <p>
                        Reverse into the <strong>green bay</strong>, face the arrow, and hold still for one second.
                    </p>
                </div>
                <Controls />
                <button className="primary-button" onClick={start}>
                    Let’s park
                    <Arrow />
                </button>
                <div className="intro-footnote">
                    90 seconds from first movement <span>·</span> −50 points per impact
                </div>
            </div>
        );
    if (state.phase === 'paused')
        return (
            <div className="modal-backdrop">
                <div className="result-card" role="dialog" aria-labelledby="pause-title">
                    <span className="eyebrow">TAKE YOUR TIME</span>
                    <h2 id="pause-title">On a pit stop.</h2>
                    <p>The clock is paused. Your parking spot is waiting.</p>
                    <button className="primary-button" onClick={resume}>
                        Back to driving
                        <Arrow />
                    </button>
                    <button className="text-button" onClick={start}>
                        Restart this attempt
                    </button>
                </div>
            </div>
        );
    const won = state.phase === 'won';
    return (
        <div className="modal-backdrop">
            <div className="result-card" role="dialog" aria-labelledby="result-title">
                <span className="eyebrow">{won ? 'RIGHT WHERE YOU BELONG' : 'THE CLOCK HAS SPOKEN'}</span>
                <div className={`result-symbol ${won ? 'success' : ''}`}>{won ? 'P' : '↺'}</div>
                <h2 id="result-title">{won ? 'Nicely parked.' : 'Another lap?'}</h2>
                <p>
                    {won
                        ? 'A tight spot, a steady hand. That’s how it’s done.'
                        : 'Time’s up. Try a slower approach and leave room to reverse.'}
                </p>
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
                <button className="primary-button" onClick={start}>
                    {won ? 'Park it again' : 'Try again'}
                    <Arrow />
                </button>
                <span className="result-shortcut">
                    Or press <kbd>R</kbd> to restart
                </span>
            </div>
        </div>
    );
}

function Hud({ game, retry, onBuilder, testing }: { game: ParkingGame; retry: () => void; onBuilder: () => void; testing: boolean }) {
    const state = useSyncExternalStore(game.subscribe, game.getSnapshot);
    const active = !['loading', 'error'].includes(state.phase);
    const playing = state.phase === 'playing';
    const timer = Math.ceil(state.remaining);
    return (
        <div className={`hud ${playing ? 'is-driving' : ''}`}>
            <header className="top-bar">
                <div className="wordmark" aria-label="Park Master">
                    <span className="brand-icon">P</span>
                    <span>
                        PARK<span className="wordmark-light">MASTER</span>
                        <small>THE ART OF FITTING IN.</small>
                    </span>
                </div>
                <div className="level-label">
                    <span className="eyebrow">{testing ? 'TEST DRIVE' : 'LEVEL 01'}</span>
                    <strong>{game.level.name}</strong>
                </div>
                <div className="session-actions">
                    <button className="builder-entry" onClick={onBuilder}>{testing ? 'Back to builder' : 'Map builder'}</button>
                    <span className="prototype-tag">DRIVING CLUB</span>
                    {active && (
                        <>
                            <button
                                className="icon-button"
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
                                        strokeDasharray={`${(state.remaining / 90) * 94.25} 94.25`}
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
                    {state.phase !== 'ready' && (
                        <div className="mission-pill">
                            <span className="mission-parking">P</span>
                            <div>
                                <strong>
                                    {state.parkingProgress > 0
                                        ? 'Hold that perfect parking'
                                        : 'Reverse into the green bay'}
                                </strong>
                                <span>{state.parkingHint}</span>
                            </div>
                            <div
                                className="parking-progress"
                                style={{ '--progress': `${state.parkingProgress * 100}%` } as CSSProperties}
                            >
                                <span />
                            </div>
                        </div>
                    )}
                    {state.impactFlash > 0 && (
                        <div className="impact-toast" role="status">
                            A little bump <strong>−50</strong>
                        </div>
                    )}
                    <footer className="bottom-bar">
                        <div className="level-footer">
                            <span className="eyebrow">PRECISION OVER SPEED</span>
                            <span>
                                01 <i /> {game.level.name.toUpperCase()}
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
                            <Controls />
                        </div>
                    )}
                </>
            )}
            <Overlay state={state} game={game} retry={retry} />
        </div>
    );
}

class SceneBoundary extends Component<{ game: ParkingGame; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Parking scene failed', error, info.componentStack);
        this.props.game.fail('The 3D scene could not start. Please reload the level in a browser with WebGL support.');
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default function App() {
    const [mode, setMode] = useState<'game' | 'builder' | 'test'>('game');
    const [game, setGame] = useState(() => new ParkingGame(COURTYARD));
    const [sceneRevision, setSceneRevision] = useState(0);
    const retry = useCallback(() => {
        setGame(new ParkingGame(game.level));
        setSceneRevision((revision) => revision + 1);
    }, [game]);
    useEffect(() => {
        if (mode === 'builder') return;
        const timeout = window.setTimeout(() => {
            if (game.session.phase === 'loading')
                game.fail('The level took too long to load. Check your connection and WebGL support, then retry.');
        }, 25000);
        return () => window.clearTimeout(timeout);
    }, [game, mode, sceneRevision]);
    const enterBuilder = () => {
        game.pause();
        setMode('builder');
    };
    const playCourtyard = () => {
        setGame(new ParkingGame(COURTYARD));
        setSceneRevision((revision) => revision + 1);
        setMode('game');
    };
    const testDrive = (map: MapDefinition) => {
        setGame(new ParkingGame(resolveMap(map)));
        setSceneRevision((revision) => revision + 1);
        setMode('test');
    };
    return <>
        <main className="game-shell" hidden={mode === 'builder'}>
            {/* Keep the graphics/physics owner alive while React replaces level entities.
                Child materials must clean up before the graphics device is destroyed. */}
            <Application usePhysics graphicsDeviceOptions={{ antialias: true, alpha: false }}>
                <SceneBoundary key={sceneRevision} game={game}>
                    {mode !== 'builder' && <GameScene game={game} />}
                </SceneBoundary>
            </Application>
            {mode !== 'builder' && <Hud game={game} retry={retry} onBuilder={enterBuilder} testing={mode === 'test'} />}
            <div className="mobile-notice">Best played with a keyboard and mouse.</div>
        </main>
        {mode !== 'game' && <MapBuilder hidden={mode === 'test'} onExit={playCourtyard} onTestDrive={testDrive} />}
    </>;
}
