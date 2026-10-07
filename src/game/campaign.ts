import { mapErrors, parseMap } from './maps.ts';
import type { Difficulty, MapDefinition } from './types.ts';

export const PROGRESS_KEY = 'park-master.campaign-progress.v1';
export const STAR_THRESHOLDS = [1, 301, 601] as const;
export type CampaignLevel = { map: MapDefinition; fingerprint: string };
export type CampaignRecord = { fingerprint: string; bestScore: number; completed: true };
export type CampaignProgress = Record<string, CampaignRecord>;
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
// Two stars per level opens the next tier, without requiring perfect runs.
export const UNLOCK_STARS_PER_LEVEL = 2;

function fingerprint(map: MapDefinition) {
    const gameplay = { ...map };
    delete gameplay.difficulty;
    delete gameplay.challenge;
    delete gameplay.campaignOrder;
    delete gameplay.editorOrder;
    let hash = 2166136261;
    for (const character of JSON.stringify(gameplay)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16);
}

// Filename order breaks ties after authored difficulty and campaign order.
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
    })
    .sort((a, b) => DIFFICULTIES.indexOf(a.map.difficulty ?? 'easy') - DIFFICULTIES.indexOf(b.map.difficulty ?? 'easy') || (a.map.campaignOrder ?? 0) - (b.map.campaignOrder ?? 0));

export function difficultyStatus(progress: CampaignProgress, unlocked: Difficulty[] = [], levels = CAMPAIGN) {
    let previousUnlocked = true;
    return DIFFICULTIES.map((difficulty, index) => {
        const group = levels.filter((level) => (level.map.difficulty ?? 'easy') === difficulty);
        const stars = group.reduce((sum, level) => sum + scoreStars(levelRecord(progress, level)?.bestScore ?? 0, Boolean(levelRecord(progress, level))), 0);
        const previous = index ? levels.filter((level) => (level.map.difficulty ?? 'easy') === DIFFICULTIES[index - 1]) : [];
        const earned = previous.reduce((sum, level) => sum + scoreStars(levelRecord(progress, level)?.bestScore ?? 0, Boolean(levelRecord(progress, level))), 0);
        const required = previous.length * UNLOCK_STARS_PER_LEVEL;
        const open = index === 0 || unlocked.includes(difficulty) || (previousUnlocked && required > 0 && earned >= required);
        previousUnlocked = open;
        return { difficulty, stars, maximum: group.length * 3, earned, required, open };
    });
}

export function canPlayLevel(index: number, progress: CampaignProgress, unlocked: Difficulty[] = [], levels = CAMPAIGN) {
    const level = levels[index];
    return Boolean(level && difficultyStatus(progress, unlocked, levels).find((group) => group.difficulty === (level.map.difficulty ?? 'easy'))?.open);
}

export function recommendedLevel(progress: CampaignProgress, unlocked: Difficulty[] = [], levels = CAMPAIGN) {
    const available = levels.map((_, index) => index).filter((index) => canPlayLevel(index, progress, unlocked, levels));
    return available.find((index) => !levelRecord(progress, levels[index]))
        ?? available.find((index) => scoreStars(levelRecord(progress, levels[index])?.bestScore ?? 0, true) < 3)
        ?? available[0] ?? 0;
}

export function scoreStars(score: number, completed: boolean) {
    return completed && score >= STAR_THRESHOLDS[0] ? score >= STAR_THRESHOLDS[2] ? 3 : score >= STAR_THRESHOLDS[1] ? 2 : 1 : 0;
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

export function readProgress(): { progress: CampaignProgress; unlocked: Difficulty[]; notice: string } {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return { progress: {}, unlocked: ['easy'], notice: '' };
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !saved.levels || typeof saved.levels !== 'object' || Array.isArray(saved.levels)) throw new Error('Invalid progress');
        const progress: CampaignProgress = Object.create(null);
        for (const level of CAMPAIGN) {
            const value = saved.levels[level.map.id];
            if (value?.fingerprint === level.fingerprint && value.completed === true && Number.isInteger(value.bestScore) && value.bestScore >= 0 && value.bestScore <= 1000) {
                progress[level.map.id] = { fingerprint: value.fingerprint, bestScore: value.bestScore, completed: true };
            }
        }
        const retained = Array.isArray(saved.unlockedDifficulties) ? DIFFICULTIES.filter((difficulty) => saved.unlockedDifficulties.includes(difficulty)) : [];
        const unlocked = difficultyStatus(progress, retained).filter((group) => group.open).map((group) => group.difficulty);
        // Migrate old records without losing a tier earned before the next content update.
        if (unlocked.some((difficulty) => !retained.includes(difficulty))) {
            try { saveProgress(progress, unlocked); }
            catch { return { progress, unlocked, notice: 'Local saving is unavailable. Your records will last only this session.' }; }
        }
        return { progress, unlocked, notice: '' };
    } catch {
        return { progress: {}, unlocked: ['easy'], notice: 'Saved progress is unavailable. You can still play; records may last only this session.' };
    }
}

export function saveProgress(progress: CampaignProgress, unlocked: Difficulty[] = []) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, levels: progress, unlockedDifficulties: difficultyStatus(progress, unlocked).filter((group) => group.open).map((group) => group.difficulty) }));
}
