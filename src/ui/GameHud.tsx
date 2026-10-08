import { useEffect, useState, useSyncExternalStore } from 'react';
import { DesktopControls, DesktopHud } from './DesktopHud.tsx';
import { MobileHud } from './MobileHud.tsx';
import { GameSettings } from './GameSettings.tsx';
import { enterLandscape, MobileTips, useMobileLayout, useMobileTips } from './MobileControls.tsx';
import type { GameHudProps } from './hudTypes.ts';

export function GameHud(props: GameHudProps) {
    const { game } = props;
    const state = useSyncExternalStore(game.subscribe, game.getSnapshot);
    const { mobile, portrait } = useMobileLayout();
    const { showTips, dismissTips } = useMobileTips();
    const [settingsRequested, setSettingsRequested] = useState(false);
    const settingsVisible = (settingsRequested || state.phase === 'paused') && !['loading', 'error'].includes(state.phase);

    useEffect(() => { game.clearTouchInput(); }, [game, mobile, portrait]);
    useEffect(() => { setSettingsRequested(false); }, [game]);
    useEffect(() => {
        if (state.phase === 'playing') setSettingsRequested(false);
    }, [state.phase]);
    useEffect(() => {
        if (mobile && state.phase === 'playing' && showTips) dismissTips();
    }, [mobile, state.phase, showTips, dismissTips]);

    const openSettings = () => {
        game.clearTouchInput();
        game.pause();
        setSettingsRequested(true);
    };
    const closeSettings = () => {
        setSettingsRequested(false);
        if (state.phase === 'paused') game.togglePause();
        document.querySelector<HTMLCanvasElement>('.game-shell canvas')?.focus();
    };
    const restart = () => {
        dismissTips();
        setSettingsRequested(false);
        game.start();
        document.querySelector<HTMLCanvasElement>('.game-shell canvas')?.focus();
    };
    const viewProps = { ...props, state, onSettings: openSettings, settingsVisible };
    return <>
        {mobile ? <MobileHud {...viewProps} showTips={showTips} dismissTips={dismissTips} /> : <DesktopHud {...viewProps} />}
        {settingsVisible && <GameSettings
            title={settingsRequested ? 'Settings' : 'Paused'}
            mobile={mobile}
            controlMode={game.controlMode}
            onControlMode={game.setControlMode}
            resumeLabel={state.phase === 'paused' ? 'Resume' : 'Close settings'}
            onClose={closeSettings}
            onRestart={restart}
            onLeave={props.testing ? props.onBuilder : props.onCampaign}
            leaveLabel={props.testing ? 'Back to builder' : 'Level select'}
            onFullscreen={mobile ? () => void enterLandscape() : undefined}
            renderHelp={(closeHelp) => mobile ? <MobileTips controlMode={game.controlMode} onDismiss={() => { dismissTips(); closeHelp(); }} /> : <DesktopControls controlMode={game.controlMode} />}
        />}
    </>;
}
