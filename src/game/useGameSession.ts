import { useEffect, useState } from 'react';

import { COURTYARD } from './level.ts';
import { resolveMap } from './maps.ts';
import { ParkingGame } from './session.ts';
import type { MapDefinition } from './types.ts';

/** Each history entry starts a fresh attempt; overlays and retries stay on its URL. */
export function useGameSession(entryKey: string, map: MapDefinition | undefined, quickStart = false) {
    const [attempt, setAttempt] = useState(() => ({
        entryKey,
        game: new ParkingGame(map ? resolveMap(structuredClone(map)) : COURTYARD),
        revision: 0
    }));
    // Synchronize before commit so an old result cannot be recorded for a new level.
    // Remember non-game entries too: Forward must not reuse the paused old attempt.
    if (attempt.entryKey !== entryKey) {
        setAttempt(map
            ? { entryKey, game: new ParkingGame(resolveMap(structuredClone(map))), revision: attempt.revision + 1 }
            : { ...attempt, entryKey });
    }
    const { game, revision } = attempt;
    const active = Boolean(map);
    useEffect(() => {
        if (!active || !quickStart) return;
        let started = false;
        const startWhenReady = () => {
            if (started || game.session.phase !== 'ready') return;
            started = true;
            game.start();
            document.querySelector<HTMLCanvasElement>('.game-shell canvas')?.focus();
        };
        const unsubscribe = game.subscribe(startWhenReady);
        startWhenReady();
        return unsubscribe;
    }, [game, active, quickStart]);
    useEffect(() => {
        if (!active) return;
        const timeout = window.setTimeout(() => {
            if (game.session.phase === 'loading')
                game.fail('The level took too long to load. Check your connection and WebGL support, then retry.');
        }, 25000);
        return () => {
            window.clearTimeout(timeout);
            game.pause();
        };
    }, [game, active, revision]);
    const retry = () => setAttempt((current) => ({
        ...current,
        game: new ParkingGame(current.game.level),
        revision: current.revision + 1
    }));
    return { game, sceneRevision: revision, retry };
}
