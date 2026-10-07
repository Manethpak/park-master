import type { GameSession } from '../game/types.ts';

export function Arrow() {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ParkingMeter({ state }: { state: GameSession }) {
    if (state.phase !== 'playing' || !state.parkingInBay) return null;
    const progress = Math.round(state.parkingProgress * 100);
    return <div className="game-parking-meter">
        <div className="parking-meter-label"><span aria-hidden="true">P</span><strong>{state.parkingHint}</strong></div>
        <div className="parking-meter-track" role="progressbar" aria-label="Parking hold" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={progress > 0 ? `${progress}% of 1 second` : state.parkingHint}>
            <span style={{ width: `${progress}%` }} />
        </div>
    </div>;
}
