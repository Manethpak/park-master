import { useState } from 'react';
import { DesktopGameMenu } from './DesktopGameMenu.tsx';
import { MobileGameMenu } from './MobileGameMenu.tsx';
import { CarShowcase } from './CarShowcase.tsx';
import { useMobileLayout } from './MobileControls.tsx';
import type { GameMenuProps } from './menuTypes.ts';

export { Stars } from './Stars.tsx';

// Share campaign rules and callbacks, not device-specific layouts or interactions.
export function GameMenu(props: GameMenuProps) {
    const { mobile } = useMobileLayout();
    const [previewOpened, setPreviewOpened] = useState(!mobile);
    if (!mobile && !previewOpened) setPreviewOpened(true);
    const previewActive = !props.hidden && !mobile && props.screen === 'home';
    return <>
        {mobile ? <MobileGameMenu {...props} /> : <DesktopGameMenu {...props} />}
        {/* Device layouts can unmount, but not this graphics owner: imported
            materials also belong to the persistent gameplay application. */}
        {previewOpened && <div className="menu-showcase-owner" hidden={!previewActive}><CarShowcase active={previewActive} /></div>}
    </>;
}
