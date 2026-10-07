import { mapErrors, parseMap } from './maps.ts';
import type { MapDefinition } from './types.ts';

export const PROGRESS_KEY = 'park-master.campaign-progress.v1';
export const STAR_THRESHOLDS = [0, 500, 800] as const;
export type CampaignLevel = { map: MapDefinition; fingerprint: string };
export type CampaignRecord = { fingerprint: string; bestScore: number; completed: true };
export type CampaignProgress = Record<string, CampaignRecord>;

function fingerprint(map: MapDefinition) {
    let hash = 2166136261;
    for (const character of JSON.stringify(map)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16);
}

// Courtyard first; additional builder exports are ordered by filename.
const files = import.meta.glob('./levels/*.json', { eager: true, import: 'default' });
const ids = new Set<string>();
export const CAMPAIGN: CampaignLevel[] = Object.entries(files)
    .sort(([a], [b]) => a.endsWith('/courtyard.json') ? -1 : b.endsWith('/courtyard.json') ? 1 : a.localeCompare(b))
    .map(([path, value]) => {
        const map = parseMap(value);
        if (ids.has(map.id)) throw new Error(`Duplicate campaign level ID in ${path}: ${map.id}`);
        if (mapErrors(map).length) throw new Error(`Invalid campaign level ${path}: ${mapErrors(map).join(' ')}`);
        ids.add(map.id);
        return { map, fingerprint: fingerprint(map) };
    });

export function scoreStars(score: number, completed: boolean) {
    return completed ? score >= STAR_THRESHOLDS[2] ? 3 : score >= STAR_THRESHOLDS[1] ? 2 : 1 : 0;
}

export function levelRecord(progress: CampaignProgress, level: CampaignLevel) {
    const record = progress[level.map.id];
    return record?.fingerprint === level.fingerprint ? record : undefined;
}

export function recordCompletion(progress: CampaignProgress, level: CampaignLevel, score: number): CampaignProgress {
    const current = levelRecord(progress, level);
    const bestScore = Math.max(0, Math.min(1000, Math.round(score)));
    if (current && current.bestScore >= bestScore) return progress;
    return { ...progress, [level.map.id]: { fingerprint: level.fingerprint, bestScore, completed: true } };
}

export function readProgress(): { progress: CampaignProgress; notice: string } {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return { progress: {}, notice: '' };
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !saved.levels || typeof saved.levels !== 'object' || Array.isArray(saved.levels)) throw new Error('Invalid progress');
        const progress: CampaignProgress = Object.create(null);
        for (const level of CAMPAIGN) {
            const value = saved.levels[level.map.id];
            if (value?.fingerprint === level.fingerprint && value.completed === true && Number.isInteger(value.bestScore) && value.bestScore >= 0 && value.bestScore <= 1000) {
                progress[level.map.id] = { fingerprint: value.fingerprint, bestScore: value.bestScore, completed: true };
            }
        }
        return { progress, notice: '' };
    } catch {
        return { progress: {}, notice: 'Saved progress is unavailable. You can still play; records may last only this session.' };
    }
}

export function saveProgress(progress: CampaignProgress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, levels: progress }));
}
