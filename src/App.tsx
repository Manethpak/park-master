import { Application } from '@playcanvas/react';
import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MapBuilder } from './editor/MapBuilder.tsx';
import { GameScene } from './game/Scene.tsx';
import type { ParkingGame } from './game/session.ts';
import type { MapDefinition } from './game/types.ts';
import { CAMPAIGN, canPlayLevel, levelRecord, recommendedLevel } from './game/campaign.ts';
import { useGameSession } from './game/useGameSession.ts';
import { levelPath, useScreen } from './navigation.ts';
import { useCampaignCompletion, useCampaignProgress } from './ui/useCampaignProgress.ts';
import { GameMenu } from './ui/GameMenu.tsx';
import { GameHud } from './ui/GameHud.tsx';
import { Arrow } from './ui/GameHudParts.tsx';
import { useMobileLayout } from './ui/MobileControls.tsx';

class SceneBoundary extends Component<{ game: ParkingGame; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Parking scene failed', error, info.componentStack);
        this.props.game.fail('The 3D scene could not start. Please reload the level in a browser with WebGL support.');
    }
    render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
    const { mobile } = useMobileLayout();
    const screen = useScreen();
    const { mode } = screen;
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedLevel, setSelectedLevel] = useState(0);
    const [builderOpened, setBuilderOpened] = useState(false);
    const [testMap, setTestMap] = useState<MapDefinition>();
    const { progress, unlocked, notice: storageNotice, record: saveRecord, progressionNotice } = useCampaignProgress();
    const levelIndex = screen.mode === 'game'
        ? CAMPAIGN.findIndex((level) => level.map.id === screen.levelId) : -1;
    const campaignPlay = mode === 'game' && canPlayLevel(levelIndex, progress, unlocked);
    const activeMap = campaignPlay ? CAMPAIGN[levelIndex].map : mode === 'test' ? testMap : undefined;
    const { game, sceneRevision, retry } = useGameSession(location.key, activeMap, location.state?.quickStart === true);
    useCampaignCompletion(game, campaignPlay ? levelIndex : undefined, saveRecord);
    if (!mobile && (mode === 'builder' || (mode === 'test' && testMap)) && !builderOpened) setBuilderOpened(true);
    if (campaignPlay && selectedLevel !== levelIndex) setSelectedLevel(levelIndex);
    const enterBuilder = () => { game.pause(); navigate('/builder'); };
    const openHome = () => { game.pause(); navigate('/'); };
    const openCampaign = () => { game.pause(); navigate('/campaign'); };
    const playLevel = (index: number, quickStart = false) => {
        if (!canPlayLevel(index, progress, unlocked)) return;
        game.pause();
        navigate(levelPath(CAMPAIGN[index].map.id), { state: quickStart ? { quickStart: true } : null });
    };
    const testDrive = (map: MapDefinition) => { setTestMap(structuredClone(map)); navigate('/builder/test'); };
    const inGame = Boolean(activeMap);
    const record = levelRecord(progress, CAMPAIGN[selectedLevel]);
    const nextIndex = CAMPAIGN.findIndex((_, index) => index > selectedLevel && canPlayLevel(index, progress, unlocked));
    return <>
        {mode === 'not-found' && <Navigate to="/" replace />}
        {mode === 'game' && !campaignPlay && <Navigate to="/campaign" replace />}
        {mode === 'test' && !testMap && <Navigate to="/builder" replace />}
        <main className="game-shell" hidden={!inGame}>
            {/* Keep the graphics/physics owner alive while React replaces level entities.
                Child materials must clean up before the graphics device is destroyed. */}
            <Application usePhysics autoRender={inGame} renderNextFrame={false} graphicsDeviceOptions={{ antialias: true, alpha: false }}>
                <SceneBoundary key={sceneRevision} game={game}>
                    {inGame && <GameScene game={game} />}
                </SceneBoundary>
            </Application>
            {inGame && <GameHud game={game} retry={retry} onBuilder={enterBuilder} onCampaign={openCampaign} testing={mode === 'test'} levelNumber={selectedLevel + 1} bestScore={record?.bestScore} onNext={nextIndex >= 0 ? () => playLevel(nextIndex) : undefined} progressionNotice={progressionNotice} />}
        </main>
        <GameMenu hidden={mode !== 'home' && mode !== 'campaign'} screen={mode === 'campaign' ? 'campaign' : 'home'} progress={progress} unlocked={unlocked} selected={selectedLevel} notice={storageNotice} onCampaign={openCampaign} onHome={openHome} onBuilder={enterBuilder} onSelect={setSelectedLevel} onContinue={() => playLevel(recommendedLevel(progress, unlocked))} onPlay={() => playLevel(selectedLevel)} onQuickPlay={(index) => playLevel(index, true)} />
        {builderOpened && <MapBuilder hidden={mode !== 'builder' || mobile} onExit={openHome} onTestDrive={testDrive} />}
        {mode === 'builder' && mobile && <main className="builder-desktop-screen" aria-label="Map builder desktop notice">
            <section className="result-card" aria-labelledby="builder-desktop-title">
                <h2 id="builder-desktop-title">Open on desktop</h2>
                <p>Map builder needs a desktop screen, keyboard and mouse.</p>
                <button className="primary-button" onClick={openCampaign}>Play campaign<Arrow /></button>
                <button className="text-button" onClick={openHome}>Main menu</button>
            </section>
        </main>}
    </>;
}
