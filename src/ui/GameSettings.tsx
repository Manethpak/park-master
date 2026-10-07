import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './game-settings.css';

export function GameSettings({ title, mobile, resumeLabel, onClose, onRestart, onLeave, leaveLabel, onFullscreen, renderHelp }: {
    title: string;
    mobile: boolean;
    resumeLabel: string;
    onClose: () => void;
    onRestart: () => void;
    onLeave: () => void;
    leaveLabel: string;
    onFullscreen?: () => void;
    renderHelp: (closeHelp: () => void) => ReactNode;
}) {
    const [helpShown, setHelpShown] = useState(false);
    const card = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        card.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                close.current();
            }
            if (event.key !== 'Tab') return;
            const buttons = [...(card.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (!card.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', keydown, true);
        return () => {
            document.removeEventListener('keydown', keydown, true);
            if (previous?.isConnected) previous.focus();
        };
    }, []);
    return <div className={`game-settings-backdrop ${mobile ? 'mobile-settings' : 'desktop-settings'}`}>
        <div ref={card} className="game-settings-card" role="dialog" aria-modal="true" aria-labelledby="game-settings-title">
            <h2 id="game-settings-title">{title}</h2>
            <button className="game-settings-resume" onClick={onClose}>{resumeLabel}<span aria-hidden="true">▶</span></button>
            <div className="game-settings-actions">
                <button onClick={onRestart}>Restart</button>
                <button onClick={() => setHelpShown(!helpShown)} aria-expanded={helpShown} aria-controls="game-settings-help">Help</button>
                {onFullscreen && <button onClick={onFullscreen}>Fullscreen</button>}
                <button onClick={onLeave}>{leaveLabel}</button>
            </div>
            {helpShown && <div id="game-settings-help" className="game-settings-help">{renderHelp(() => {
                setHelpShown(false);
                card.current?.querySelector<HTMLButtonElement>('[aria-controls="game-settings-help"]')?.focus();
            })}</div>}
        </div>
    </div>;
}
