import type { CampaignProgress } from '../game/campaign.ts';
import type { Difficulty } from '../game/types.ts';

export type GameMenuProps = {
    hidden: boolean;
    screen: 'home' | 'campaign';
    progress: CampaignProgress;
    unlocked: Difficulty[];
    selected: number;
    notice: string;
    onCampaign: () => void;
    onHome: () => void;
    onBuilder: () => void;
    onSelect: (index: number) => void;
    onPlay: () => void;
    onQuickPlay: (index: number) => void;
    onContinue: () => void;
};
