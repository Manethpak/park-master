import type { ParkingGame } from '../game/session.ts';
import type { GameSession } from '../game/types.ts';

export type GameHudProps = {
    game: ParkingGame;
    retry: () => void;
    onBuilder: () => void;
    onCampaign: () => void;
    testing: boolean;
    levelNumber: number;
    bestScore?: number;
    onNext?: () => void;
    progressionNotice?: string;
};

export type HudViewProps = GameHudProps & {
    state: GameSession;
    onSettings: () => void;
    settingsVisible: boolean;
};
