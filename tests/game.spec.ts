import { readFile } from 'node:fs/promises';
import type { MapDefinition } from '../src/game/types.ts';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const authoredMap = JSON.parse(await readFile(new URL('../src/game/levels/courtyard.json', import.meta.url), 'utf8')) as MapDefinition;
const firstLevelLabel = `Select level 1: ${authoredMap.name}`;

type Snapshot = {
    level: { id: string; name: string; timeLimit: number; impactPenalty: number; smallImpactPenalty: number; playerVehicle: string; playableZone?: { x: number; z: number; width: number; length: number }; spawn: { position: number[]; heading: number }; bay: { x: number; z: number; heading: number } };
    vehicle: { width: number; height: number; length: number; wheelbase: number };
    carCollider: number[];
    roads: { id: string; position: number[]; heading: number; dimensions: number[] }[];
    phase: string;
    hasMoved: boolean;
    remaining: number;
    score: number;
    impacts: number;
    impactPoints: number;
    lastImpactPenalty: number;
    speed: number;
    steering: number;
    parkingProgress: number;
    car: number[];
    heading: number;
    meshes: number;
    wheelAngles: number[][];
    props: { id: string; position: number[] }[];
};

type TestApi = {
    snapshot: () => Snapshot;
    teleport: (x: number, z: number, heading: number) => void;
    setRemaining: (remaining: number) => void;
    addImpacts: (count: number) => void;
};

declare global {
    // Window augmentation requires an interface for declaration merging.
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Window {
        __parkTest: TestApi;
    }
}

const snapshot = (page: Page) => page.evaluate(() => window.__parkTest.snapshot());
const teleport = (page: Page, x: number, z: number, heading: number) =>
    page.evaluate(([x, z, heading]) => window.__parkTest.teleport(x, z, heading), [x, z, heading]);

async function start(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: /START LEVEL|REPLAY LEVEL/ }).click();
    await page.getByRole('button', { name: 'Let’s park' }).click();
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
}

test.describe('mobile driving', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

    test('touch pedals support simultaneous steering, stopping, reverse and cancelled touches', async ({ page, context }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await start(page);
        const client = await context.newCDPSession(page);
        const points = new Map<number, { x: number; y: number; id: number }>();
        const hold = async (name: string, id: number) => {
            const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
            points.set(id, { x: box.x + box.width / 2, y: box.y + box.height / 2, id });
            await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...points.values()] });
        };
        const release = async (id: number) => {
            const released = points.get(id)!;
            points.delete(id);
            // CDP touchEnd lists the contacts being lifted, not those still held.
            await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [released] });
        };
        const initial = await snapshot(page);
        await hold('Accelerate', 1);
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeLessThan(initial.car[2] - 0.3);
        await hold('Steer right', 2);
        await expect.poll(async () => (await snapshot(page)).steering).toBeGreaterThan(0.8);
        await expect.poll(async () => Math.abs((await snapshot(page)).heading - initial.heading)).toBeGreaterThan(3);
        await release(2);
        await expect.poll(async () => Math.abs((await snapshot(page)).steering)).toBeLessThan(0.05);
        await hold('Stop', 3);
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await release(1);
        await release(3);
        const stopped = await snapshot(page);
        await hold('Reverse', 4);
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeGreaterThan(stopped.car[2] + 0.3);
        await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        points.clear();
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await hold('Accelerate', 5);
        await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0.2);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByRole('heading', { name: 'Rotate to landscape' })).toBeVisible();
        await expect.poll(async () => (await snapshot(page)).phase).toBe('paused');
        const paused = await snapshot(page);
        await page.waitForTimeout(400);
        expect((await snapshot(page)).remaining).toBe(paused.remaining);
        await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await page.setViewportSize({ width: 844, height: 390 });
        await page.getByRole('button', { name: 'Back to driving', exact: true }).click();
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await page.getByRole('button', { name: 'Restart level', exact: true }).click();
        await page.waitForTimeout(300);
        expect((await snapshot(page)).hasMoved).toBe(false);
        expect((await snapshot(page)).remaining).toBe(90);
        expect(errors).toEqual([]);
    });

    test('portrait blocks starting until rotated and gameplay fits the landscape viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.getByRole('button', { name: /Continue campaign/ }).click();
        await expect(page.getByRole('heading', { name: 'Rotate to landscape' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Let’s park' })).toHaveCount(0);
        await page.setViewportSize({ width: 844, height: 390 });
        await page.getByRole('button', { name: 'Let’s park' }).click();
        for (const name of ['Accelerate', 'Reverse', 'Stop', 'Steer left', 'Steer right']) {
            const button = page.getByRole('button', { name, exact: true });
            await expect(button).toBeVisible();
            const box = (await button.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(390);
            expect(box.width).toBeGreaterThanOrEqual(44);
        }
        expect(await page.locator('.game-shell').evaluate((node) => node.getBoundingClientRect().height)).toBe(390);
    });

    test('fullscreen requests landscape and gracefully handles unsupported orientation locking', async ({ page }) => {
        await page.addInitScript(() => {
            HTMLElement.prototype.requestFullscreen = async () => {
                document.documentElement.dataset.fullscreenRequested = 'true';
            };
            Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async (orientation: string) => {
                document.documentElement.dataset.orientationRequested = orientation;
                throw new DOMException('Not supported', 'NotSupportedError');
            } });
        });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await start(page);
        await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-fullscreen-requested', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-orientation-requested', 'landscape');
        expect((await snapshot(page)).phase).toBe('playing');
        expect(errors).toEqual([]);
    });
});

test('touch controls respond to viewport width while desktop keyboard controls remain available', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('group', { name: 'Touch driving controls' })).toHaveCount(0);
    await page.setViewportSize({ width: 800, height: 600 });
    await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 750 });
    await expect(page.getByRole('group', { name: 'Touch driving controls' })).toHaveCount(0);
    await page.locator('.game-shell canvas').focus();
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0.3);
    await page.keyboard.up('w');
});

test('main menu offers campaign or sandbox, with keyboard navigation and a real level preview', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('main', { name: 'Main menu', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play campaign', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Map builder', exact: true })).toBeVisible();
    expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    const level = page.getByRole('button', { name: firstLevelLabel, exact: true });
    await expect(level).toHaveAttribute('aria-pressed', 'true');
    await expect(level.getByRole('img', { name: '0 of 3 stars', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `${authoredMap.name} map preview`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'START LEVEL', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(level).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
    await expect(page.getByRole('button', { name: /promote|publish|add to campaign/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await expect(page.getByRole('main', { name: 'Main menu', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('campaign discovery filters levels and recommends an available challenge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Continue campaign/ })).toBeVisible();
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Easy levels', exact: true })).toContainText('RECOMMENDED');
    await expect(page.getByRole('region', { name: 'Medium levels', exact: true })).toContainText('Earn 2 Easy stars');
    await page.getByLabel('Filter levels').selectOption('improve');
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('No levels match');
    await page.getByRole('button', { name: /Recommended →/ }).click();
    await expect(page.getByLabel('Filter levels')).toHaveValue('all');
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Filter levels').selectOption('unplayed');
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toBeVisible();
});

test('difficulty locks count best stars only, unlock sequentially, and persist after records change', async ({ page }) => {
    test.setTimeout(90000);
    // Supply extra authored tiers only to this E2E browser, not to the shipped campaign.
    await page.route('**/src/game/campaign.ts*', async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        await route.fulfill({ response, body: source + `\nCAMPAIGN.push(
            {map: {...CAMPAIGN[0].map, id: 'test-medium', name: 'Medium test', difficulty: 'medium', challenge: 'Reverse parking'}, fingerprint: 'test-medium'},
            {map: {...CAMPAIGN[0].map, id: 'test-hard', name: 'Hard test', difficulty: 'hard', challenge: 'Tight turns'}, fingerprint: 'test-hard'}
        );` });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'Select level 2: Medium test', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Medium test map preview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'LEVEL LOCKED', exact: true })).toBeDisabled();
    await expect(page.locator('.briefing-lock')).toContainText('0/2');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    await page.getByRole('button', { name: firstLevelLabel, exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    const level = (await snapshot(page)).level;
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.evaluate(() => window.__parkTest.setRemaining(18));
        await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
        await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
        await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0);
        await expect(page.getByRole('dialog')).toContainText('Medium is locked. Earn 1 more star');
        await page.getByRole('button', { name: 'Level select', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Medium levels', exact: true })).toContainText('1/2');
        await page.getByRole('button', { name: 'REPLAY LEVEL', exact: true }).click();
        await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    }
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Next level', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    expect((await snapshot(page)).level.id).toBe('test-medium');
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
    await page.getByRole('button', { name: 'Select level 3: Hard test', exact: true }).click();
    await expect(page.getByRole('button', { name: 'LEVEL LOCKED', exact: true })).toBeDisabled();
    await expect(page.locator('.briefing-lock')).toContainText('Earn 2 Medium stars');
    await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('park-master.campaign-progress.v1')!);
        for (const record of Object.values(saved.levels) as { fingerprint: string }[]) record.fingerprint = 'changed-layout';
        localStorage.setItem('park-master.campaign-progress.v1', JSON.stringify(saved));
    });
    await page.reload();
    await page.getByRole('button', { name: /Continue campaign/ }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
    await page.getByRole('button', { name: 'Select level 2: Medium test', exact: true }).click();
    await expect(page.getByRole('button', { name: 'START LEVEL', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Next level', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    expect((await snapshot(page)).level.id).toBe('test-hard');
});

test('builder saves discovery metadata in drafts and exported JSON', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
    await page.getByLabel('Challenge label', { exact: true }).fill('Tight turns');
    await page.getByLabel('Challenge label', { exact: true }).press('Enter');
    await page.getByLabel('Campaign order', { exact: true }).fill('12');
    await page.getByLabel('Campaign order', { exact: true }).press('Enter');
    await expect.poll(async () => (await savedDraft(page)).difficulty).toBe('hard');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const download = await downloadPromise;
    const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(exported).toMatchObject({ difficulty: 'hard', challenge: 'Tight turns', campaignOrder: 12 });
    await importMap(page, { ...exported, difficulty: 'expert' });
    await expect(page.getByRole('alert')).toHaveText('Difficulty must be easy, medium, or hard.');
    expect((await savedDraft(page)).difficulty).toBe('hard');
    await importMap(page, { ...exported, campaignOrder: 1.5 });
    await expect(page.getByRole('alert')).toHaveText('campaignOrder must be a whole number.');
    await importMap(page, exported);
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await page.reload();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await expect(page.getByLabel('Challenge label', { exact: true })).toHaveValue('Tight turns');
    await expect(page.getByLabel('Campaign order', { exact: true })).toHaveValue('12');
});

test('front page renders the sedan GLB rather than an enlarged thumbnail and keeps its canvas across menus', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const preview = page.getByRole('img', { name: '3D sedan preview', exact: true });
    await expect(preview).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
    await expect.poll(() => preview.getAttribute('data-mesh-count').then(Number)).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.menu-showcase img')).toHaveCount(0);
    await expect(preview.locator('canvas')).toBeVisible();
    const canvas = await preview.locator('canvas').elementHandle();
    const size = await preview.locator('canvas').evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight };
    });
    expect(size.width).toBeGreaterThanOrEqual(size.clientWidth);
    expect(size.height).toBeGreaterThanOrEqual(size.clientHeight);
    expect(size.clientWidth).toBeGreaterThan(250);
    expect(size.clientHeight).toBeGreaterThan(250);
    expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(preview).toBeHidden();
    expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
    await page.getByRole('button', { name: '← Main menu', exact: true }).click();
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('data-state', 'ready');
    expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
    expect(errors).toEqual([]);
});

test('a failed front-page model preview does not block mode selection', async ({ page }) => {
    await page.route('**/assets/kenney/car-kit/sedan.glb', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('img', { name: '3D sedan preview', exact: true })).toHaveAttribute('data-state', 'error', { timeout: 15000 });
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
});

for (const [score, stars] of [[0, 0], [1, 1], [300, 1], [301, 2], [600, 2], [601, 3], [999, 3], [1000, 3]]) {
    test(`campaign completion at ${score} points earns ${stars} stars and survives reload`, async ({ page }) => {
        await start(page);
        const level = (await snapshot(page)).level;
        // A zero-point success is possible after penalties, but zero remaining time is a timeout.
        await page.evaluate((points) => {
            window.__parkTest.setRemaining(points === 0 ? 90 : points * 90 / 1000);
            if (points === 0) window.__parkTest.addImpacts(40);
        }, score);
        await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
        await expect(page.getByRole('heading', { name: 'Nicely parked.', exact: true })).toBeVisible();
        expect((await snapshot(page)).score).toBe(score);
        await expect(page.getByRole('dialog').getByRole('img', { name: `${stars} of 3 stars`, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Level select', exact: true }).click();
        const tile = page.getByRole('button', { name: firstLevelLabel, exact: true });
        await expect(tile).toContainText(`BEST ${score} PTS`);
        await expect(tile.getByRole('img', { name: `${stars} of 3 stars`, exact: true })).toBeVisible();
        expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
        await page.reload();
        await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
        await expect(tile).toContainText(`BEST ${score} PTS`);
        await expect(page.getByRole('button', { name: 'REPLAY LEVEL', exact: true })).toBeVisible();
        if (score === 301) {
            await page.route('**/src/game/levels/courtyard.json*', (route) => route.fulfill({
                contentType: 'application/javascript',
                body: `export default ${JSON.stringify({ ...authoredMap, difficulty: 'easy', challenge: 'Updated label', campaignOrder: 42 })};`
            }));
            await page.evaluate(() => {
                const saved = JSON.parse(localStorage.getItem('park-master.campaign-progress.v1')!);
                delete saved.unlockedDifficulties;
                localStorage.setItem('park-master.campaign-progress.v1', JSON.stringify(saved));
            });
            await page.reload();
            await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
            await expect(tile).toContainText('BEST 301 PTS');
            await expect(tile).toContainText('Updated label');
            const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('park-master.campaign-progress.v1')!));
            expect(migrated.unlockedDifficulties).toEqual(['easy', 'medium']);
        }
    });
}

test('lower-scoring replays and timeouts never reduce campaign records', async ({ page }) => {
    await start(page);
    const level = (await snapshot(page)).level;
    await page.evaluate(() => window.__parkTest.setRemaining(72));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Park it again', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await expect(page.getByRole('dialog').getByRole('img', { name: '2 of 3 stars', exact: true })).toBeVisible();
    await expect(page.getByText('PERSONAL BEST · 800 PTS', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Park it again', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(0));
    await expect(page.getByRole('heading', { name: 'Another lap?', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('img', { name: '0 of 3 stars', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
    const tile = page.getByRole('button', { name: firstLevelLabel, exact: true });
    await expect(tile).toContainText('BEST 800 PTS');
    await expect(tile.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
});

test('builder test drives do not create campaign progress or campaign entries', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await page.getByLabel('Level name', { exact: true }).fill('My private sandbox');
    await page.getByLabel('Level name', { exact: true }).press('Enter');
    const draft = await savedDraft(page);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    await teleport(page, draft.bay.x, draft.bay.z, draft.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    expect(await page.evaluate(() => localStorage.getItem('park-master.campaign-progress.v1'))).toBeNull();
    await page.getByRole('button', { name: 'Back to builder', exact: true }).click();
    expect(await savedDraft(page)).toEqual(draft);
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toBeVisible();
    await expect(page.getByText('My private sandbox', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '← Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('My private sandbox');
});

test('corrupt progress and unavailable storage do not block gameplay', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('park-master.campaign-progress.v1', '{broken');
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === 'park-master.campaign-progress.v1') throw new DOMException('Storage full', 'QuotaExceededError');
            return original.call(this, key, value);
        };
    });
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('Saved progress is unavailable');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    const level = (await snapshot(page)).level;
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Your records will last only this session');
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toContainText('BEST 1000 PTS');
});

for (const pedal of ['w', 's']) {
    test(`time and score wait for ${pedal} movement, then keep counting through stops`, async ({ page }) => {
        await start(page);
        const initial = await snapshot(page);
        await page.waitForTimeout(500);
        expect((await snapshot(page)).remaining).toBe(90);
        expect((await snapshot(page)).score).toBe(1000);
        expect((await snapshot(page)).hasMoved).toBe(false);
        await page.keyboard.down(pedal);
        await expect
            .poll(async () => Math.abs((await snapshot(page)).car[2] - initial.car[2]))
            .toBeGreaterThan(0.1);
        await page.keyboard.up(pedal);
        await expect.poll(async () => (await snapshot(page)).remaining).toBeLessThan(90);
        await expect.poll(async () => (await snapshot(page)).score).toBeLessThan(1000);
        await page.keyboard.down('Space');
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await page.keyboard.up('Space');
        const stopped = await snapshot(page);
        await page.waitForTimeout(400);
        expect((await snapshot(page)).remaining).toBeLessThan(stopped.remaining - 0.2);
        await page.keyboard.press('r');
        await page.waitForTimeout(400);
        const restarted = await snapshot(page);
        expect(restarted.remaining).toBe(90);
        expect(restarted.score).toBe(1000);
        expect(restarted.hasMoved).toBe(false);
    });
}

for (const width of [900, 1600]) {
    test(`steering uses a compact range at ${width}px and leaves a stationary car and score unchanged`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await start(page);
        const initial = await snapshot(page);
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        const center = canvas.x + canvas.width / 2;
        const y = canvas.y + canvas.height / 2;
        await page.mouse.move(center + 120, y);
        await expect.poll(async () => (await snapshot(page)).steering).toBeGreaterThan(0.4);
        expect((await snapshot(page)).steering).toBeLessThan(0.55);
        await page.mouse.move(center + 240, y);
        await expect.poll(async () => (await snapshot(page)).steering).toBeGreaterThan(0.98);
        await page.mouse.move(center - 240, y);
        await expect.poll(async () => (await snapshot(page)).steering).toBeLessThan(-0.98);
        await page.mouse.move(center, y);
        await expect.poll(async () => Math.abs((await snapshot(page)).steering)).toBeLessThan(0.01);
        const steered = await snapshot(page);
        expect(steered.car[0]).toBeCloseTo(initial.car[0], 2);
        expect(steered.car[2]).toBeCloseTo(initial.car[2], 2);
        expect(steered.heading).toBeCloseTo(initial.heading, 2);
        expect(steered.speed).toBeLessThan(0.05);
        expect(steered.hasMoved).toBe(false);
        expect(steered.remaining).toBe(90);
        expect(steered.score).toBe(1000);
    });
}

test('loads every model and palette without runtime errors, and waits to start the timer', async ({ page }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    const palettes = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });
    page.on('response', (response) => {
        if (!response.url().includes('/assets/kenney/')) return;
        if (!response.ok()) failedAssets.push(response.url());
        if (response.url().endsWith('Textures/colormap.png')) palettes.add(response.url());
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Small space. Big precision.' })).toBeVisible();
    await page.waitForTimeout(400);
    const state = await snapshot(page);
    expect(state.phase).toBe('ready');
    expect(state.remaining).toBe(90);
    expect(state.meshes).toBeGreaterThan(70);
    expect(state.wheelAngles).toHaveLength(4);
    expect(palettes.size).toBe(3);
    expect(failedAssets).toEqual([]);
    expect(errors).toEqual([]);
});

test('drives forward, animates wheels, brakes before reversing, and respects the reverse speed limit', async ({
    page
}) => {
    await start(page);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).car[2]).toBeLessThan(12.8);
    await page.keyboard.up('w');
    const forward = await snapshot(page);
    expect(Math.abs(forward.wheelAngles[0][0])).toBeGreaterThan(1);
    expect(forward.speed).toBeGreaterThan(0);
    await page.keyboard.down('s');
    await expect
        .poll(async () => (await snapshot(page)).car[2], { timeout: 7000 })
        .toBeGreaterThan(forward.car[2] + 0.5);
    await page.keyboard.up('s');
    const reverse = await snapshot(page);
    expect(reverse.speed).toBeLessThanOrEqual(3.01);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.15);
    await page.keyboard.up('Space');
});

for (const direction of [-1, 1]) {
    test(`mouse steering ${direction < 0 ? 'left' : 'right'} matches the car, reverses naturally, and cannot rotate a stopped car`, async ({ page }) => {
        await start(page);
        await teleport(page, 4, -1, 0);
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2 + direction * 240, canvas.y + canvas.height / 2);
        await page.waitForTimeout(400);
        expect((await snapshot(page)).heading).toBeCloseTo(0, 1);
        await page.keyboard.down('w');
        await expect.poll(async () => {
            const heading = (await snapshot(page)).heading;
            return direction * ((heading + 180) % 360 - 180);
        }).toBeLessThan(-15);
        await page.keyboard.up('w');
        expect(direction * (await snapshot(page)).steering).toBeGreaterThan(0.8);
        await teleport(page, 4, -1, 0);
        await page.keyboard.down('s');
        await expect.poll(async () => {
            const heading = (await snapshot(page)).heading;
            return direction * ((heading + 180) % 360 - 180);
        }).toBeGreaterThan(15);
        await page.keyboard.up('s');
    });
}

test('solid obstacles block movement and a sustained impact is penalized once', async ({ page }) => {
    await start(page);
    await teleport(page, 4.2, 2.2, 0);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
    await page.waitForTimeout(1700);
    const blocked = await snapshot(page);
    expect(blocked.impacts).toBe(1);
    expect(blocked.car[2]).toBeLessThan(2.9);
    expect(blocked.impactPoints).toBe(25);
    expect(blocked.lastImpactPenalty).toBe(25);
    expect(blocked.score).toBe(Math.max(0, Math.round(1000 * blocked.remaining / 90) - 25));
    await page.keyboard.up('w');
    await page.keyboard.down('s');
    await expect.poll(async () => (await snapshot(page)).car[2]).toBeLessThan(1.9);
    await page.keyboard.up('s');
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.15);
    await page.keyboard.up('Space');
    await page.waitForTimeout(350);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(2);
    expect((await snapshot(page)).impactPoints).toBe(50);
    await page.keyboard.up('w');
});

test('small props move on impact and restart restores their positions and the car', async ({ page }) => {
    await start(page);
    const original = (await snapshot(page)).props.find((prop) => prop.id === 'cone-2')!;
    await teleport(page, -1.5, 0.3, 180);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
    const bumped = await snapshot(page);
    expect(bumped.lastImpactPenalty).toBe(10);
    expect(bumped.impactPoints).toBe(bumped.impacts * 10);
    expect(bumped.score).toBe(Math.max(0, Math.round(1000 * bumped.remaining / 90) - bumped.impactPoints));
    await expect
        .poll(async () => {
            const cone = (await snapshot(page)).props.find((prop) => prop.id === 'cone-2')!;
            return Math.hypot(cone.position[0] - original.position[0], cone.position[2] - original.position[2]);
        })
        .toBeGreaterThan(0.25);
    await page.keyboard.up('w');
    await page.keyboard.press('r');
    const restarted = await snapshot(page);
    expect(restarted.impacts).toBe(0);
    expect(restarted.impactPoints).toBe(0);
    expect(restarted.lastImpactPenalty).toBe(0);
    expect(restarted.remaining).toBe(90);
    expect(restarted.score).toBe(1000);
    expect(restarted.hasMoved).toBe(false);
    expect(restarted.car[0]).toBeCloseTo(-7.1, 1);
    expect(restarted.car[2]).toBeCloseTo(14, 1);
    const resetCone = restarted.props.find((prop) => prop.id === 'cone-2')!;
    expect(resetCone.position[0]).toBeCloseTo(original.position[0], 2);
    expect(resetCone.position[2]).toBeCloseTo(original.position[2], 2);
});

test('reverse parking requires containment and facing, then succeeds after stopping', async ({ page }) => {
    await start(page);
    await teleport(page, 4.2, -8.1, 180);
    await page.waitForTimeout(1200);
    expect((await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).parkingProgress).toBe(0);
    await teleport(page, 4.2, -4.8, 0);
    await page.keyboard.down('s');
    await expect.poll(async () => (await snapshot(page)).car[2], { intervals: [80], timeout: 7000 }).toBeLessThan(-7.4);
    await page.keyboard.up('s');
    await page.keyboard.down('Space');
    await expect(page.getByRole('heading', { name: 'Nicely parked.' })).toBeVisible({ timeout: 7000 });
    await page.keyboard.up('Space');
    const won = await snapshot(page);
    expect(won.phase).toBe('won');
    expect(won.parkingProgress).toBe(1);
    expect(won.impacts).toBe(0);
    await page.waitForTimeout(400);
    expect((await snapshot(page)).score).toBe(won.score);
});

test('pause and focus loss freeze the timer; timeout ends the attempt and permits restart', async ({ page }) => {
    await start(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'On a pit stop.' })).toBeVisible();
    const paused = await snapshot(page);
    await page.waitForTimeout(500);
    expect((await snapshot(page)).remaining).toBe(paused.remaining);
    await page.getByRole('button', { name: 'Back to driving' }).click();
    await page.waitForTimeout(300);
    expect((await snapshot(page)).remaining).toBe(90);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).hasMoved).toBe(true);
    await page.keyboard.up('w');
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
    await page.keyboard.up('Space');
    await page.keyboard.press('Escape');
    const drivingPaused = await snapshot(page);
    await page.waitForTimeout(400);
    expect((await snapshot(page)).remaining).toBe(drivingPaused.remaining);
    await page.getByRole('button', { name: 'Back to driving' }).click();
    await expect.poll(async () => (await snapshot(page)).remaining).toBeLessThan(paused.remaining);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect((await snapshot(page)).phase).toBe('paused');
    await page.getByRole('button', { name: 'Back to driving' }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(0.2));
    await expect(page.getByRole('heading', { name: 'Another lap?' })).toBeVisible();
    expect((await snapshot(page)).score).toBe(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    expect((await snapshot(page)).phase).toBe('playing');
});

test('a failed model load shows a readable retry screen', async ({ page }) => {
    await page.route('**/assets/kenney/car-kit/sedan.glb', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A little roadblock.' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Reload the level' })).toBeVisible();
});

async function openBuilder(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
}

const savedDraft = (page: Page): Promise<MapDefinition> => page.evaluate(() => JSON.parse(localStorage.getItem('park-master.map-draft.v1')!));

test('draft names can be cleared and retyped without saving an invalid blank name', async ({ page }) => {
    await openBuilder(page);
    const name = page.getByLabel('Level name', { exact: true });
    const original = await savedDraft(page);
    await name.fill('');
    await expect(name).toHaveValue('');
    expect((await savedDraft(page)).name).toBe(original.name);
    await name.pressSequentially('Renamed courtyard');
    await name.press('Enter');
    await expect.poll(async () => (await savedDraft(page)).name).toBe('Renamed courtyard');
    await name.fill('');
    await name.press('Tab');
    await expect(name).toHaveValue('Renamed courtyard');
    await name.fill('   ');
    await name.press('Enter');
    await expect(name).toHaveValue('Renamed courtyard');
    await name.fill('  Another lot  ');
    await name.press('Tab');
    await expect(name).toHaveValue('Another lot');
    await expect.poll(async () => (await savedDraft(page)).name).toBe('Another lot');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(name).toHaveValue('Renamed courtyard');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(name).toHaveValue('Another lot');
    await page.reload();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(name).toHaveValue('Another lot');
});

async function gridPoint(page: Page, x: number, z: number) {
    return page.getByRole('img', { name: 'Level drafting grid' }).evaluate((svg, [x, z]) => {
        const point = new DOMPoint(x, z).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
        return { x: point.x, y: point.y };
    }, [x, z]);
}

async function placeOnGrid(page: Page, x: number, z: number) {
    const point = await gridPoint(page, x, z);
    await page.mouse.click(point.x, point.y);
}

async function importMap(page: Page, map: unknown) {
    await page.getByLabel('Import level file').setInputFiles({ name: 'level.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(map)) });
}

async function exportMap(page: Page): Promise<MapDefinition> {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export JSON', exact: true }).click()
    ]);
    return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

test('left sidebar settings stay separate from element inspection and survive draft reload and JSON import/export', async ({ page }) => {
    await openBuilder(page);
    const settingsTab = page.getByRole('tab', { name: 'Map settings', exact: true });
    const assetsTab = page.getByRole('tab', { name: 'Assets', exact: true });
    const inspector = page.getByRole('complementary', { name: 'Selection inspector', exact: true });
    await expect(assetsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toBeHidden();
    await settingsTab.click();
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toBeVisible();
    await page.getByLabel('Scene item').selectOption('spawn:spawn');
    await expect(inspector.getByLabel('X (m)', { exact: true })).toBeVisible();
    await expect(inspector.getByLabel('Time limit (seconds)', { exact: true })).toHaveCount(0);
    await expect(inspector.getByRole('button', { name: 'Drive sedan', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toBeVisible();
    await assetsTab.click();
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toBeHidden();
    await expect(page.getByLabel('Scene item')).toHaveValue('spawn:spawn');
    await assetsTab.press('ArrowRight');
    await expect(settingsTab).toBeFocused();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
    for (const [label, value] of [
        ['Level ID', 'custom-rules'], ['Time limit (seconds)', '120'],
        ['Small impact penalty', '7'], ['Hard impact penalty', '40'],
        ['Grid origin X', '1.5'], ['Grid origin Z', '-2']
    ]) {
        await page.getByLabel(label, { exact: true }).fill(value);
        await page.getByLabel(label, { exact: true }).press('Enter');
    }
    const draft = await exportMap(page);
    expect(draft).toMatchObject({ id: 'custom-rules', timeLimit: 120, smallImpactPenalty: 7, impactPenalty: 40, grid: { origin: [1.5, -2], cellSize: 5 } });
    await page.reload();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await settingsTab.click();
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toHaveValue('120');
    await expect(page.getByLabel('Small impact penalty', { exact: true })).toHaveValue('7');
    await expect(page.getByLabel('Hard impact penalty', { exact: true })).toHaveValue('40');
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await importMap(page, draft);
    await expect.poll(() => savedDraft(page)).toEqual(draft);
    for (const invalid of [{ timeLimit: 0 }, { smallImpactPenalty: -1 }, { impactPenalty: 1.5 }]) {
        await importMap(page, { ...draft, ...invalid });
        await expect(page.getByRole('alert')).toBeVisible();
        expect(await savedDraft(page)).toEqual(draft);
    }
    await importMap(page, { ...draft, smallImpactPenalty: 0, impactPenalty: 0 });
    await expect.poll(async () => (await savedDraft(page)).impactPenalty).toBe(0);
    expect((await exportMap(page)).smallImpactPenalty).toBe(0);
    const legacy = structuredClone(draft);
    delete legacy.smallImpactPenalty;
    await importMap(page, { ...legacy, impactPenalty: 50 });
    await expect.poll(async () => (await savedDraft(page)).impactPenalty).toBe(25);
    expect((await savedDraft(page)).smallImpactPenalty).toBe(10);
});

test('test drive uses authored time limits and both impact penalties, including restart and score normalization', async ({ page }) => {
    await openBuilder(page);
    const original = await savedDraft(page);
    await importMap(page, { ...original, timeLimit: 120, smallImpactPenalty: 7, impactPenalty: 40 });
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await expect(page.getByText('120 seconds from first movement', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).remaining).toBe(120);
    expect((await snapshot(page)).level).toMatchObject({ timeLimit: 120, smallImpactPenalty: 7, impactPenalty: 40 });
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await teleport(page, -1.5, 0.3, 180);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
    await page.keyboard.up('w');
    const small = await snapshot(page);
    expect(small.lastImpactPenalty).toBe(7);
    expect(small.impactPoints).toBe(small.impacts * 7);
    await page.keyboard.press('r');
    await teleport(page, 4.2, 2.2, 0);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
    await page.keyboard.up('w');
    const hard = await snapshot(page);
    expect(hard.lastImpactPenalty).toBe(40);
    expect(hard.score).toBe(Math.max(0, Math.round(1000 * hard.remaining / 120) - 40));
    await page.keyboard.press('r');
    const reset = await snapshot(page);
    expect(reset.remaining).toBe(120);
    expect(reset.score).toBe(1000);
    expect(reset.impactPoints).toBe(0);
    await page.evaluate(() => window.__parkTest.setRemaining(60));
    await teleport(page, reset.level.bay.x, reset.level.bay.z, reset.level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    expect((await snapshot(page)).score).toBe(500);
});

for (const kind of ['target', 'parking'] as const) {
    test(`${kind} bays have no wheel stop by default and can be driven through from the back`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'New map', exact: true }).click();
        if (kind === 'parking') {
            await page.getByRole('button', { name: 'Parking bay', exact: true }).click();
            await placeOnGrid(page, 0, 0);
            await expect(page.getByLabel('Wheel stop', { exact: true })).not.toBeChecked();
        }
        const draft = await savedDraft(page);
        const bay = kind === 'target' ? draft.bay : draft.parkingBays[0];
        if (kind === 'parking') expect(draft.parkingBays[0].wheelStop).toBe(false);
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
        const initial = await snapshot(page);
        const back = bay.z - bay.length / 2;
        await teleport(page, bay.x, back - initial.vehicle.length / 2 - 0.5, 0);
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).car[2], { timeout: 7000 }).toBeGreaterThan(bay.z + bay.length / 2 + initial.vehicle.length / 2);
        await page.keyboard.up('w');
        expect((await snapshot(page)).impacts).toBe(0);
        expect((await snapshot(page)).phase).toBe('playing');

        if (kind === 'parking') {
            await page.getByRole('button', { name: 'Back to builder', exact: true }).click();
            await page.getByLabel('Scene item').selectOption(`parking:${draft.parkingBays[0].id}`);
            await page.getByLabel('Wheel stop', { exact: true }).check();
            expect((await exportMap(page)).parkingBays[0].wheelStop).toBe(true);
            await page.getByRole('button', { name: 'Test drive', exact: true }).click();
            await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
            await teleport(page, bay.x, back - initial.vehicle.length / 2 - 0.5, 0);
            await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
            await page.keyboard.down('w');
            await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
            await page.keyboard.up('w');
            expect((await snapshot(page)).car[2]).toBeLessThan(back + 0.5);
        }
    });
}

test('builder previews, context actions, handles, locks and editor-only hiding', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await page.getByLabel('Search assets').fill('cone');
    const coneCard = page.getByRole('button', { name: 'Traffic cone', exact: true });
    await expect(coneCard.locator('img')).toBeVisible();
    await expect.poll(() => coneCard.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Parked sedan', exact: true })).toHaveCount(0);
    await coneCard.click();
    await placeOnGrid(page, 0, 0);
    const origin = await gridPoint(page, 0, 0);
    await page.mouse.click(origin.x, origin.y, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Object actions' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(2);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByLabel('Scene item').selectOption('object:cone-1');

    const handle = page.getByRole('button', { name: 'Rotation handle', exact: true });
    const box = (await handle.boundingBox())!;
    const radius = origin.y - (box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(origin.x - radius, origin.y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByLabel('Heading (°)', { exact: true })).toHaveValue('90');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).objects[0].heading).toBe(0);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect((await savedDraft(page)).objects[0].heading).toBe(90);
    await expect(page.getByRole('button', { name: /Resize handle/ })).toHaveCount(0);

    // A cancelled rotation must not persist or create a history step.
    const rotatedHandle = (await handle.boundingBox())!;
    await page.mouse.move(rotatedHandle.x + rotatedHandle.width / 2, rotatedHandle.y + rotatedHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(origin.x, origin.y - radius, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await savedDraft(page)).objects[0].heading).toBe(90);

    await page.getByLabel('Lock selected item').check();
    await expect(handle).toHaveCount(0);
    await expect(page.getByLabel('X (m)', { exact: true })).toBeDisabled();
    await page.mouse.click(origin.x, origin.y, { button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByLabel('Lock selected item').uncheck();
    await page.getByLabel('Hide selected item').check();
    await expect(page.locator('svg [data-item-id="cone-1"]')).toHaveCount(0);
    expect((await savedDraft(page)).objects).toHaveLength(1);
    await page.getByLabel('Hide selected item').uncheck();

    await page.mouse.click(origin.x, origin.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Duplicate & place', exact: true }).click();
    await placeOnGrid(page, 5, 5);
    expect((await savedDraft(page)).objects[1].position).toEqual([5, 0, 5]);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(1);
    await page.mouse.click(origin.x, origin.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(0);

    await page.getByLabel('Scene item').selectOption('target:target');
    const before = (await savedDraft(page)).bay;
    const resize = (await page.getByRole('button', { name: 'Resize handle 1 1', exact: true }).boundingBox())!;
    const end = await gridPoint(page, before.x + before.width / 2 + 1, before.z + before.length / 2 + 2);
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
    expect((await savedDraft(page)).bay.width).toBeGreaterThan(before.width + 0.9);
    expect((await savedDraft(page)).bay.length).toBeGreaterThan(before.length + 1.9);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).bay).toEqual(before);
    const spawn = await gridPoint(page, -5, 5);
    await page.mouse.click(spawn.x, spawn.y, { button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeDisabled();
    expect(errors).toEqual([]);
});

test('playable zone validates footprints, resizes with history and survives export/import', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await page.getByLabel('Scene item').selectOption('target:target');
    await page.getByLabel('Length (m)', { exact: true }).fill('4.2');
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await page.getByLabel('Scene item').selectOption('');
    await page.getByRole('button', { name: 'Drive taxi', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The target bay must fit the entire player car.');
    expect((await savedDraft(page)).playerVehicle).toBeUndefined();
    expect((await savedDraft(page)).bay.length).toBe(4.2);
    await page.getByLabel('Scene item').selectOption('target:target');
    await page.getByLabel('Length (m)', { exact: true }).fill('5.7');
    await page.getByLabel('Scene item').selectOption('');
    await page.getByRole('button', { name: 'Add playable zone', exact: true }).click();
    expect((await savedDraft(page)).playableZone).toEqual({ x: 0, z: 0, width: 30, length: 30 });
    await page.getByLabel('Width (m)', { exact: true }).fill('10');
    await expect(page.getByRole('button', { name: 'Test drive', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Player spawn must fit entirely inside the playable zone.', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Test drive', exact: true })).toBeEnabled();
    const zoneBefore = (await savedDraft(page)).playableZone;
    const handle = (await page.getByRole('button', { name: 'Resize handle 1 1', exact: true }).boundingBox())!;
    const end = await gridPoint(page, 18, 16);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
    expect((await savedDraft(page)).playableZone!.width).toBeCloseTo(33, 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).playableZone).toEqual(zoneBefore);
    await page.getByLabel('Scene item').selectOption('');
    await page.getByRole('button', { name: 'Drive taxi', exact: true }).click();
    const draft = await exportMap(page);
    expect(draft.playerVehicle).toBe('taxi');
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await importMap(page, draft);
    await expect.poll(() => savedDraft(page)).toEqual(draft);
    await importMap(page, { ...draft, playerVehicle: 'unknown' });
    await expect(page.getByRole('alert')).toHaveText('Unsupported player vehicle.');
    expect(await savedDraft(page)).toEqual(draft);
    await importMap(page, { ...draft, playableZone: { ...draft.playableZone, width: -1 } });
    await expect(page.getByRole('alert')).toHaveText(/playableZone.width must be a finite number/);
    expect(await savedDraft(page)).toEqual(draft);
});

for (const vehicle of ['suv', 'taxi'] as const) {
    test(`${vehicle} test drive uses matching geometry, hits the boundary, resets and parks`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'New map', exact: true }).click();
        await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
        await page.getByRole('button', { name: `Drive ${vehicle}`, exact: true }).click();
        await page.getByRole('button', { name: 'Add playable zone', exact: true }).click();
        await page.getByLabel('Scene item').selectOption('spawn:spawn');
        await page.getByLabel('Hide selected item').check();
        const draft = await exportMap(page);
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
        const initial = await snapshot(page);
        expect(initial.level.playerVehicle).toBe(vehicle);
        expect(initial.level.playableZone).toEqual(draft.playableZone);
        expect(initial.vehicle.length).toBeCloseTo((vehicle === 'suv' ? 2.7 : 2.75) * 4.2 / 2.55, 4);
        expect(initial.vehicle.wheelbase).toBeCloseTo((vehicle === 'suv' ? 1.32 : 1.52) * 4.2 / 2.55, 4);
        expect(initial.carCollider[0]).toBeCloseTo(initial.vehicle.width, 4);
        expect(initial.carCollider[1]).toBeCloseTo(initial.vehicle.height, 4);
        expect(initial.carCollider[2]).toBeCloseTo(initial.vehicle.length, 4);
        expect(initial.wheelAngles).toHaveLength(4);
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeGreaterThan(6);
        await expect.poll(async () => Math.abs((await snapshot(page)).wheelAngles[0][0])).toBeGreaterThan(1);
        await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
        await page.keyboard.up('w');
        const blocked = await snapshot(page);
        expect(blocked.car[2] + blocked.vehicle.length / 2).toBeLessThan(15.15);
        await page.keyboard.press('r');
        expect((await snapshot(page)).car[2]).toBeCloseTo(5, 2);
        expect((await snapshot(page)).impacts).toBe(0);
        await teleport(page, draft.bay.x, draft.bay.z, draft.bay.heading);
        await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
        await page.getByRole('button', { name: 'Back to builder', exact: true }).click();
        expect(await exportMap(page)).toEqual(draft);
    });
}

test('builder snaps roads and props, edits with history, exports/imports, and restores local drafts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await page.getByLabel('Level name', { exact: true }).fill('Workshop lot');
    await page.getByRole('button', { name: 'Straight road', exact: true }).click();
    await placeOnGrid(page, 0.8, 1.3);
    await placeOnGrid(page, 5.3, 1);
    expect((await savedDraft(page)).roads.map((r) => r.cell)).toEqual([[0, 0], [1, 0]]);
    await page.getByRole('button', { name: 'Traffic cone', exact: true }).click();
    await placeOnGrid(page, 2.13, 2.37);
    expect((await savedDraft(page)).objects[0].position).toEqual([2.25, 0, 2.25]);
    await page.getByRole('button', { name: 'Select & move', exact: true }).click();
    const begin = await gridPoint(page, 2.25, 2.25);
    const end = await gridPoint(page, 3.1, 4.2);
    await page.mouse.move(begin.x, begin.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByLabel('X (m)', { exact: true })).toHaveValue('3');
    await expect(page.getByLabel('Z (m)', { exact: true })).toHaveValue('4.25');
    await page.keyboard.press('r');
    await expect(page.getByLabel('Heading (°)', { exact: true })).toHaveValue('90');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(2);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(2);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(1);
    await page.getByLabel('Scene item').selectOption('road:road-1');
    await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
    expect((await savedDraft(page)).roads[0].rotation).toBe(90);
    await expect(page.getByText('road-1 and road-2: lanes do not connect.', { exact: true })).toBeVisible();
    const exported = await exportMap(page);
    expect(exported).toEqual(await savedDraft(page));
    expect(exported.schemaVersion).toBe(1);
    expect(exported.objects[0].heading).toBe(90);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(0);
    await importMap(page, exported);
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('Workshop lot');
    expect(await savedDraft(page)).toEqual(exported);
    await page.reload();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('Workshop lot');
    expect(await savedDraft(page)).toEqual(exported);
    expect(errors).toEqual([]);
});

test('builder rejects invalid imports and occupied cells while retaining the draft', async ({ page }) => {
    await openBuilder(page);
    const original = await savedDraft(page);
    const invalid: { map: unknown; message: RegExp }[] = [
        { map: { ...original, schemaVersion: 2 }, message: /Unsupported schemaVersion/ },
        { map: { ...original, objects: [{ ...original.objects[0], asset: '../unknown.glb' }] }, message: /not a supported prop/ },
        { map: { ...original, roads: [original.roads[0], { ...original.roads[0], id: 'another-road' }] }, message: /Two roads occupy cell/ },
        { map: { ...original, objects: [original.objects[0], original.objects[0]] }, message: /Duplicate or reserved ID/ },
        { map: { ...original, spawn: { ...original.spawn, position: [null, 0, 0] } }, message: /finite number/ },
        { map: { ...original, bay: { ...original.bay, width: 1 } }, message: /fit the entire player car/ },
        { map: { ...original, grid: { ...original.grid, cellSize: 4 } }, message: /cellSize must be 5/ }
    ];
    for (const value of invalid) {
        await importMap(page, value.map);
        await expect(page.getByRole('alert')).toHaveText(value.message);
        expect(await savedDraft(page)).toEqual(original);
    }
    await page.getByLabel('Import level file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
    await expect(page.getByRole('alert')).toHaveText('The file is not valid JSON.');
    expect(await savedDraft(page)).toEqual(original);
    await page.getByRole('button', { name: 'Straight road', exact: true }).click();
    await placeOnGrid(page, -7.1, 7.5);
    await expect(page.getByRole('alert')).toHaveText(/Two roads occupy cell/);
    expect(await savedDraft(page)).toEqual(original);
});

test('test drive uses authored geometry, resets movable props, parks in a rotated bay, and preserves the draft', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'New map', exact: true }).click();
    await page.getByRole('button', { name: 'Traffic cone', exact: true }).click();
    await placeOnGrid(page, -5, 9);
    await page.getByLabel('Scene item').selectOption('target:target');
    await page.getByLabel('Heading (°)', { exact: true }).fill('90');
    // Exercise all calibrated road assets in the shared scene.
    await page.getByRole('button', { name: 'Straight road', exact: true }).click();
    await placeOnGrid(page, 0, 0);
    await page.getByRole('button', { name: 'Road bend', exact: true }).click();
    await placeOnGrid(page, 5, 0);
    await page.getByRole('button', { name: 'T junction', exact: true }).click();
    await placeOnGrid(page, 0, -5);
    await page.getByRole('button', { name: 'Crossroads', exact: true }).click();
    await placeOnGrid(page, -5, 0);
    const draft = await exportMap(page);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    const initial = await snapshot(page);
    expect(initial.level.id).toBe(draft.id);
    expect(initial.level.bay.heading).toBe(90);
    expect(initial.car[0]).toBeCloseTo(-5, 2);
    expect(initial.car[2]).toBeCloseTo(5, 2);
    expect(initial.roads).toHaveLength(4);
    for (const road of initial.roads) {
        const authored = draft.roads.find((r) => r.id === road.id)!;
        expect(road.position[0]).toBeCloseTo(authored.cell[0] * 5, 3);
        expect(road.position[2]).toBeCloseTo(authored.cell[1] * 5, 3);
        expect(road.dimensions[0]).toBeCloseTo(5, 3);
        expect(road.dimensions[1]).toBeCloseTo(0.1, 3);
        expect(road.dimensions[2]).toBeCloseTo(5, 3);
    }
    const cone = initial.props.find((p) => p.id === 'cone-1')!;
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
    await expect.poll(async () => Math.abs((await snapshot(page)).props.find((p) => p.id === 'cone-1')!.position[2] - cone.position[2])).toBeGreaterThan(0.2);
    await page.keyboard.up('w');
    await page.keyboard.press('r');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(0);
    const reset = await snapshot(page);
    expect(reset.car[2]).toBeCloseTo(5, 2);
    expect(reset.remaining).toBe(90);
    expect(reset.props.find((p) => p.id === 'cone-1')!.position[2]).toBeCloseTo(9, 2);
    // The target heading must drive both the rendered markings and the parking rule.
    await teleport(page, draft.bay.x, draft.bay.z, 0);
    await page.waitForTimeout(1200);
    expect((await snapshot(page)).phase).toBe('playing');
    await teleport(page, draft.bay.x, draft.bay.z, 90);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Back to builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
    expect(await exportMap(page)).toEqual(draft);
    expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s park', exact: true }).click();
    expect((await snapshot(page)).remaining).toBe(90);
    expect((await snapshot(page)).impacts).toBe(0);
    expect((await snapshot(page)).car[2]).toBeCloseTo(5, 2);
    expect(errors).toEqual([]);
});
