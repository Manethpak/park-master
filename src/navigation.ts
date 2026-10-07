import { matchRoutes, useLocation } from 'react-router-dom';

export type Screen =
    | { mode: 'home' | 'campaign' | 'builder' | 'test' }
    | { mode: 'game'; levelId: string }
    | { mode: 'not-found' };

export const levelPath = (id: string) => `/play/${encodeURIComponent(id)}`;

const routes = [
    { path: '/', handle: 'home' },
    { path: '/campaign', handle: 'campaign' },
    { path: '/builder', handle: 'builder' },
    { path: '/builder/test', handle: 'test' },
    { path: '/play/:levelId', handle: 'game' }
] as const;

export function useScreen(): Screen {
    const location = useLocation();
    const match = matchRoutes([...routes], location)?.[0];
    if (!match) return { mode: 'not-found' };
    const mode = match.route.handle;
    return mode === 'game'
        ? { mode, levelId: match.params.levelId! }
        : { mode };
}
