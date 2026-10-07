import { useCallback, useEffect, useRef, useState } from 'react';

import { CAMPAIGN, DIFFICULTY_LABELS, difficultyStatus, readProgress, recordCompletion, saveProgress } from '../game/campaign.ts';
import type { ParkingGame } from '../game/session.ts';

/** Campaign saves belong to campaign attempts, never builder test drives. */
export function useCampaignProgress() {
    const [saved, setSaved] = useState(readProgress);
    const savedRef = useRef(saved);
    const record = useCallback((levelIndex: number, score: number) => {
        const current = savedRef.current;
        const progress = recordCompletion(current.progress, CAMPAIGN[levelIndex], score);
        if (progress === current.progress) return;
        const unlocked = difficultyStatus(progress, current.unlocked)
            .filter((group) => group.open).map((group) => group.difficulty);
        let notice = '';
        try { saveProgress(progress, unlocked); }
        catch { notice = 'Local saving is unavailable. Your records will last only this session.'; }
        const next = { progress, unlocked, notice };
        savedRef.current = next;
        setSaved(next);
    }, []);
    const locked = difficultyStatus(saved.progress, saved.unlocked)
        .find((group) => !group.open && group.required > 0);
    const needed = locked ? Math.max(0, locked.required - locked.earned) : 0;
    const progressionNotice = locked
        ? `${DIFFICULTY_LABELS[locked.difficulty]} is locked. Earn ${needed} more ${needed === 1 ? 'star' : 'stars'} in the previous difficulty (${locked.earned}/${locked.required}).`
        : 'All available challenges are unlocked. Replay to improve your stars.';
    return { ...saved, record, progressionNotice };
}

export function useCampaignCompletion(game: ParkingGame, levelIndex: number | undefined, record: (index: number, score: number) => void) {
    useEffect(() => {
        if (levelIndex === undefined) return;
        const onChange = () => {
            const state = game.getSnapshot();
            if (state.phase === 'won') record(levelIndex, state.score);
        };
        onChange();
        return game.subscribe(onChange);
    }, [game, levelIndex, record]);
}
