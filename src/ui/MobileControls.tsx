import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import type { ParkingGame } from '../game/session.ts';
import './mobile-controls.css';

export function useMobileLayout() {
    const [layout, setLayout] = useState(() => ({
        mobile: window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches,
        portrait: window.matchMedia('(orientation: portrait)').matches
    }));
    useEffect(() => {
        const mobile = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
        const portrait = window.matchMedia('(orientation: portrait)');
        const update = () => setLayout({ mobile: mobile.matches, portrait: portrait.matches });
        mobile.addEventListener('change', update);
        portrait.addEventListener('change', update);
        update();
        return () => {
            mobile.removeEventListener('change', update);
            portrait.removeEventListener('change', update);
        };
    }, []);
    return layout;
}

export async function enterLandscape() {
    try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
        await orientation?.lock?.('landscape');
    } catch {
        // iOS and some embedded browsers require the player to rotate manually.
    }
}

const buttons = [
    ['left', 'Steer left', '←'], ['right', 'Steer right', '→'],
    ['reverse', 'Reverse', '↓'], ['stop', 'Stop', '■'], ['forward', 'Accelerate', '↑']
] as const;

const TIP_KEY = 'park-master.touch-tips.v1';

export function useMobileTips() {
    const [showTips, setShowTips] = useState(() => {
        try { return localStorage.getItem(TIP_KEY) !== 'seen'; }
        catch { return true; }
    });
    const dismissTips = () => {
        setShowTips(false);
        try { localStorage.setItem(TIP_KEY, 'seen'); }
        catch { /* Keep dismissal for this session when storage is unavailable. */ }
    };
    return { showTips, dismissTips, openTips: () => setShowTips(true) };
}

export function MobileTips({ onDismiss }: { onDismiss: () => void }) {
    return <div className="mobile-tips" role="group" aria-label="Driving tips">
        <p>Hold ↑ / ↓ to drive, ■ to brake. Hold ← / → to steer.</p>
        <button className="text-button" onClick={onDismiss}>Got it</button>
    </div>;
}

export function MobileControls({ game }: { game: ParkingGame }) {
    useEffect(() => () => game.touchControls.clear(), [game]);
    const release = (event: PointerEvent<HTMLButtonElement>) => {
        game.touchControls.delete(event.pointerId);
    };
    return <div className="touch-controls" role="group" aria-label="Touch driving controls">
        {buttons.map(([control, label, symbol]) => <button
            key={control}
            className={`touch-button touch-${control}`}
            aria-label={label}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (event.button !== 0 || game.session.phase !== 'playing') return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                game.touchControls.set(event.pointerId, control);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
        ><span aria-hidden="true">{symbol}</span><small>{label}</small></button>)}
    </div>;
}
