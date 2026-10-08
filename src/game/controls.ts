export type ControlMode = 'buttons' | 'precise';

const CONTROL_KEY = 'park-master.controls.v1';

export function loadControlMode(): ControlMode {
    try {
        const saved = localStorage.getItem(CONTROL_KEY);
        if (saved === 'buttons' || saved === 'precise') return saved;
    } catch { /* Use device defaults when storage is unavailable. */ }
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches ? 'buttons' : 'precise';
}

export function saveControlMode(mode: ControlMode) {
    try { localStorage.setItem(CONTROL_KEY, mode); }
    catch { /* The setting still applies to the current game. */ }
}
