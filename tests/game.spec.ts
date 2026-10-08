import { readFile } from 'node:fs/promises';
import type { MapDefinition } from '../src/game/types.ts';
import { ASSETS } from '../src/game/assets.ts';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const authoredMap = JSON.parse(await readFile(new URL('../src/game/levels/courtyard.json', import.meta.url), 'utf8')) as MapDefinition;
const firstLevelLabel = `Select level 1: ${authoredMap.name}`;

type Snapshot = {
    level: { id: string; name: string; timeLimit: number; impactPenalty: number; smallImpactPenalty: number; playerVehicle: string; playableZone?: { x: number; z: number; width: number; length: number }; spawn: { position: number[]; heading: number }; bay: { x: number; z: number; heading: number } };
    vehicle: { width: number; height: number; length: number; wheelbase: number };
    carCollider: number[];
    objects: { id: string; asset: string; body?: string; colliderType?: string; collider?: number[]; colliderOffset?: number[]; colliderParts?: { position: number[]; dimensions: number[] }[]; min: number[]; max: number[] }[];
    roads: { id: string; position: number[]; heading: number; dimensions: number[]; supportCollider?: number[] }[];
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
    parkingInBay: boolean;
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

async function leaveGame(page: Page, name = 'Level select') {
    const leave = page.getByRole('button', { name, exact: true });
    if (!await leave.isVisible()) await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await leave.click();
}

async function start(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    const launch = page.getByRole('button', { name: /START LEVEL|REPLAY LEVEL/ });
    if (await launch.isVisible()) {
        await launch.click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
    } else {
        await page.getByRole('button', { name: firstLevelLabel, exact: true }).click();
        await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
    }
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
}

test('routes support history, direct campaign links, fresh attempts and persistent physics ownership', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await start(page);
    const path = `/play/${encodeURIComponent(authoredMap.id)}`;
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    const canvas = await page.locator('.game-shell canvas').elementHandle();
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).hasMoved).toBe(true);
    await page.goBack();
    await page.keyboard.up('w');
    await expect(page).toHaveURL(/\/campaign$/);
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
    expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    expect((await snapshot(page)).hasMoved).toBe(false);
    expect((await snapshot(page)).remaining).toBe(authoredMap.timeLimit);
    expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    expect((await snapshot(page)).phase).toBe('ready');
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    expect((await snapshot(page)).level.id).toBe(authoredMap.id);
    await page.goto('/play/missing-level');
    await expect(page).toHaveURL(/\/campaign$/);
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    await page.goto('/unknown-screen');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('main', { name: 'Main menu', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('builder routes preserve the draft, tabs and undo history across navigation and guard test-drive refresh', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/builder');
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
    await page.getByLabel('Level name', { exact: true }).fill('Routing draft');
    await page.getByLabel('Level name', { exact: true }).press('Enter');
    const draft = await savedDraft(page);
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/builder$/);
    await expect(page.getByRole('tab', { name: 'Map settings', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByLabel('Level name', { exact: true })).not.toHaveValue('Routing draft');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await expect(page).toHaveURL(/\/builder\/test$/);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.goBack();
    await expect(page).toHaveURL(/\/builder$/);
    expect(await savedDraft(page)).toEqual(draft);
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/builder$/);
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('Routing draft');
    expect(await savedDraft(page)).toEqual(draft);
    expect(await page.evaluate(() => localStorage.getItem('park-master.campaign-progress.v1'))).toBeNull();
    expect(errors).toEqual([]);
});

test('mobile builder entry and deep links show a desktop notice without touching saved drafts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByLabel('Level name', { exact: true }).fill('Desktop-only draft');
    await page.getByLabel('Level name', { exact: true }).press('Enter');
    const draft = await savedDraft(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Open on desktop', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Map builder', exact: true })).toBeHidden();
    expect(await savedDraft(page)).toEqual(draft);
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Open on desktop', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Open on desktop', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Map builder', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page).toHaveURL(/\/campaign$/);
    await page.goto('/builder/test');
    await expect(page).toHaveURL(/\/builder$/);
    await expect(page.getByRole('heading', { name: 'Open on desktop', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 750 });
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('Desktop-only draft');
    expect(await savedDraft(page)).toEqual(draft);
    expect(errors).toEqual([]);
});

test('mobile level grids launch directly and keep locked levels visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/src/game/campaign.ts*', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + `\nCAMPAIGN.push(
            {map: {...CAMPAIGN[0].map, id: 'mobile-easy', name: 'Second parking', difficulty: 'easy'}, fingerprint: 'mobile-easy'},
            {map: {...CAMPAIGN[0].map, id: 'mobile-medium', name: 'Locked parking', difficulty: 'medium'}, fingerprint: 'mobile-medium'}
        );` });
    });
    await page.goto('/campaign');
    const first = page.getByRole('button', { name: firstLevelLabel, exact: true });
    const second = page.getByRole('button', { name: 'Select level 2: Second parking', exact: true });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    const firstBox = (await first.boundingBox())!;
    const secondBox = (await second.boundingBox())!;
    expect(secondBox.y).toBeCloseTo(firstBox.y, 1);
    expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width);
    await expect(page.getByRole('button', { name: 'Select level 3: Locked parking', exact: true })).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Medium levels', exact: true })).toContainText('0/4 Easy stars');
    await expect(page.getByRole('region', { name: 'Selected level', exact: true })).toBeHidden();
    const filter = (await page.getByLabel('Filter levels').boundingBox())!;
    expect(filter.width).toBeLessThan(180);
    expect(filter.height).toBe(44);
    await second.click();
    await expect(page).toHaveURL(/\/play\/mobile-easy$/);
    await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).level.id).toBe('mobile-easy');
});

test('menu wrapper switches device-specific components without changing desktop selection behavior', async ({ page }) => {
    await page.goto('/campaign');
    await expect(page.locator('.desktop-game-menu')).toBeVisible();
    await expect(page.locator('.mobile-game-menu')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Selected level', exact: true })).toBeVisible();
    await page.getByRole('button', { name: firstLevelLabel, exact: true }).click();
    await expect(page).toHaveURL(/\/campaign$/);
    await expect(page.getByRole('button', { name: 'START LEVEL', exact: true })).toBeVisible();
    const previewCanvas = await page.locator('.car-showcase canvas').elementHandle();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.mobile-game-menu')).toBeVisible();
    await expect(page.locator('.desktop-game-menu')).toHaveCount(0);
    expect(await previewCanvas!.evaluate((node) => node.isConnected)).toBe(true);
    await expect(page.getByRole('region', { name: 'Selected level', exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1100, height: 750 });
    await expect(page.locator('.desktop-game-menu')).toBeVisible();
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: `${authoredMap.name} map preview`, exact: true })).toBeVisible();
});

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
        await expect(page.getByRole('heading', { name: 'Rotate to landscape' })).toHaveCount(0);
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        expect((await snapshot(page)).phase).toBe('playing');
        await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await page.setViewportSize({ width: 844, height: 390 });
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Restart', exact: true }).click();
        await page.waitForTimeout(300);
        expect((await snapshot(page)).hasMoved).toBe(false);
        expect((await snapshot(page)).remaining).toBe(90);
        expect(errors).toEqual([]);
    });

    test('portrait supports play, touch-sized navigation and one-time tips across reloads', async ({ page, context }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.getByRole('button', { name: /Continue/ }).click();
        await expect(page.getByRole('group', { name: 'Driving tips' })).toBeVisible();
        await page.getByRole('button', { name: 'Got it', exact: true }).click();
        await expect(page.getByRole('group', { name: 'Driving tips' })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Driving tips' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        expect((await snapshot(page)).phase).toBe('playing');
        await expect(page.locator('.mobile-hud .wordmark')).toBeHidden();
        await expect(page.locator('.desktop-hud')).toHaveCount(0);
        for (const name of ['Help', 'Fullscreen', 'Level select', 'Restart level']) {
            await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
        }
        await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toHaveCSS('opacity', '1');
        const client = await context.newCDPSession(page);
        const pedal = (await page.getByRole('button', { name: 'Accelerate', exact: true }).boundingBox())!;
        const initial = await snapshot(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pedal.x + pedal.width / 2, y: pedal.y + pedal.height / 2, id: 1 }] });
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeLessThan(initial.car[2] - 0.3);
        await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        for (const name of ['Accelerate', 'Reverse', 'Stop', 'Steer left', 'Steer right']) {
            const button = page.getByRole('button', { name, exact: true });
            await expect(button).toBeVisible();
            const box = (await button.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(844);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(390);
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        expect((await snapshot(page)).phase).toBe('paused');
        await page.getByRole('dialog').getByRole('button', { name: 'Help', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveCSS('opacity', '1');
        await expect(page.getByRole('group', { name: 'Driving tips' })).toBeVisible();
        for (const name of ['Got it', 'Resume', 'Restart', 'Level select']) {
            const box = (await page.getByRole('dialog').getByRole('button', { name, exact: true }).boundingBox())!;
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        await page.setViewportSize({ width: 320, height: 568 });
        for (const name of ['Settings', 'Pause game', 'Accelerate', 'Reverse', 'Stop', 'Steer left', 'Steer right']) {
            const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(320);
            expect(box.y + box.height).toBeLessThanOrEqual(568);
        }
        await page.setViewportSize({ width: 844, height: 390 });
        expect((await snapshot(page)).phase).toBe('playing');
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
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-fullscreen-requested', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-orientation-requested', 'landscape');
        expect((await snapshot(page)).phase).toBe('paused');
        await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click();
        expect((await snapshot(page)).phase).toBe('playing');
        expect(errors).toEqual([]);
    });
});

test('touch controls respond to viewport width while desktop keyboard controls remain available', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await start(page);
    await expect(page.locator('.desktop-hud')).toBeVisible();
    await expect(page.locator('.mobile-hud')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Touch driving controls' })).toHaveCount(0);
    await page.setViewportSize({ width: 800, height: 600 });
    await expect(page.locator('.mobile-hud')).toBeVisible();
    await expect(page.locator('.desktop-hud')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 750 });
    await expect(page.locator('.desktop-hud')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Touch driving controls' })).toHaveCount(0);
    await page.locator('.game-shell canvas').focus();
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0.3);
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1100, height: 750 }]) {
    test(`settings pause play, contain navigation and trap focus at ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await start(page);
        await expect(page.getByRole('button', { name: 'Level select', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Help', exact: true })).toHaveCount(0);
        await page.locator('.game-shell canvas').focus();
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).hasMoved).toBe(true);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.keyboard.up('w');
        const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
        await expect(dialog).toBeVisible();
        expect((await snapshot(page)).phase).toBe('paused');
        const remaining = (await snapshot(page)).remaining;
        await page.waitForTimeout(350);
        expect((await snapshot(page)).remaining).toBe(remaining);
        for (const name of ['Resume', 'Restart', 'Help', 'Level select']) {
            const button = dialog.getByRole('button', { name, exact: true });
            await expect(button).toBeVisible();
            const box = (await button.boundingBox())!;
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
        await expect(dialog.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(dialog.getByRole('button', { name: 'Level select', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(dialog.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
        await dialog.getByRole('button', { name: 'Help', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Help', exact: true })).toHaveAttribute('aria-expanded', 'true');
        if (viewport.width <= 1024) {
            await expect(dialog.getByRole('group', { name: 'Driving tips', exact: true })).toBeVisible();
            await dialog.getByRole('button', { name: 'Got it', exact: true }).click();
            await expect(dialog.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
        } else await expect(dialog).toContainText('Mouse near center to steer');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        expect((await snapshot(page)).phase).toBe('playing');
        await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await dialog.getByRole('button', { name: 'Restart', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect((await snapshot(page)).remaining).toBe(authoredMap.timeLimit);
        expect((await snapshot(page)).hasMoved).toBe(false);
        await leaveGame(page);
        await expect(page).toHaveURL(/\/campaign$/);
    });
}

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
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Easy levels', exact: true })).toContainText('RECOMMENDED');
    await expect(page.getByRole('region', { name: 'Medium levels', exact: true })).toContainText('0/2 Easy stars');
    await page.getByLabel('Filter levels').selectOption('improve');
    await expect(page.getByRole('button', { name: firstLevelLabel, exact: true })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('No matches');
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
    await page.goto('/play/test-medium');
    await expect(page).toHaveURL(/\/campaign$/);
    await expect(page.getByRole('heading', { name: 'SELECT LEVEL', exact: true })).toBeVisible();
    await page.getByRole('button', { name: firstLevelLabel, exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const level = (await snapshot(page)).level;
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.evaluate(() => window.__parkTest.setRemaining(18));
        await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
        await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
        await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0);
        await expect(page.getByRole('dialog')).toContainText('Medium is locked. Earn 1 more star');
        await leaveGame(page);
        await expect(page.getByRole('region', { name: 'Medium levels', exact: true })).toContainText('1/2');
        await page.getByRole('button', { name: 'REPLAY LEVEL', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
    }
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Next level', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    expect((await snapshot(page)).level.id).toBe('test-medium');
    await leaveGame(page);
    await page.getByRole('button', { name: 'Select level 3: Hard test', exact: true }).click();
    await expect(page.getByRole('button', { name: 'LEVEL LOCKED', exact: true })).toBeDisabled();
    await expect(page.locator('.briefing-lock')).toContainText('0/2 Medium stars');
    await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('park-master.campaign-progress.v1')!);
        for (const record of Object.values(saved.levels) as { fingerprint: string }[]) record.fingerprint = 'changed-layout';
        localStorage.setItem('park-master.campaign-progress.v1', JSON.stringify(saved));
    });
    await page.reload();
    await expect(page).toHaveURL(/\/campaign$/);
    await page.getByRole('button', { name: /START LEVEL|REPLAY LEVEL/ }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await leaveGame(page);
    await page.getByRole('button', { name: 'Select level 2: Medium test', exact: true }).click();
    await expect(page.getByRole('button', { name: 'START LEVEL', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await page.getByRole('button', { name: 'Next level', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
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
    await expect(page).toHaveURL(/\/builder$/);
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
        await expect(page.getByRole('heading', { name: 'Parked!', exact: true })).toBeVisible();
        expect((await snapshot(page)).score).toBe(score);
        await expect(page.getByRole('dialog').getByRole('img', { name: `${stars} of 3 stars`, exact: true })).toBeVisible();
        await leaveGame(page);
        const tile = page.getByRole('button', { name: firstLevelLabel, exact: true });
        await expect(tile).toContainText(`BEST ${score} PTS`);
        await expect(tile.getByRole('img', { name: `${stars} of 3 stars`, exact: true })).toBeVisible();
        expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
        await page.reload();
        await expect(page).toHaveURL(/\/campaign$/);
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
            await expect(page).toHaveURL(/\/campaign$/);
            await expect(tile).toContainText('BEST 301 PTS');
            await expect(page.locator('.challenge-label')).toContainText('Updated label');
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
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(45));
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await expect(page.getByRole('dialog').getByRole('img', { name: '2 of 3 stars', exact: true })).toBeVisible();
    await expect(page.getByText('PERSONAL BEST · 800 PTS', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(0));
    await expect(page.getByRole('heading', { name: 'Time’s up', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('img', { name: '0 of 3 stars', exact: true })).toBeVisible();
    await leaveGame(page);
    const tile = page.getByRole('button', { name: firstLevelLabel, exact: true });
    await expect(tile).toContainText('BEST 800 PTS');
    await expect(tile.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
});

test('builder test drives do not create campaign progress or campaign entries', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await page.getByLabel('Level name', { exact: true }).fill('My private sandbox');
    await page.getByLabel('Level name', { exact: true }).press('Enter');
    const draft = await savedDraft(page);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await teleport(page, draft.bay.x, draft.bay.z, draft.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    expect(await page.evaluate(() => localStorage.getItem('park-master.campaign-progress.v1'))).toBeNull();
    await leaveGame(page, 'Back to builder');
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
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const level = (await snapshot(page)).level;
    await teleport(page, level.bay.x, level.bay.z, level.bay.heading);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
    await leaveGame(page);
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

test('loads only campaign models and palettes without runtime errors, and waits to start the timer', async ({ page }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    const palettes = new Set<string>();
    const models = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });
    page.on('response', (response) => {
        if (!response.url().includes('/assets/kenney/')) return;
        if (!response.ok() && response.status() !== 304) failedAssets.push(response.url());
        if (response.url().endsWith('Textures/colormap.png')) palettes.add(response.url());
        if (response.url().endsWith('.glb')) models.add(new URL(response.url()).pathname);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await expect(page.getByRole('heading', { name: authoredMap.name, exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    const state = await snapshot(page);
    expect(state.phase).toBe('ready');
    expect(state.remaining).toBe(90);
    expect(state.meshes).toBeGreaterThan(70);
    expect(state.wheelAngles).toHaveLength(4);
    expect(palettes.size).toBe(3);
    const usedIds = new Set([authoredMap.playerVehicle ?? 'sedan', ...authoredMap.objects.map((object) => object.asset), ...authoredMap.roads.map((road) => road.asset)]);
    expect([...models].sort()).toEqual([...usedIds].map((id) => `/assets/kenney/${ASSETS[id].pack}/${ASSETS[id].file}`).sort());
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
    // Ammo stores float32 positions; allow 1 cm at the contact boundary.
    expect(blocked.car[2]).toBeLessThan(2.91);
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
    await teleport(page, original.position[0] - 3.5, original.position[2], 90);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts, { intervals: [50] }).toBeGreaterThan(0);
    const bumped = await snapshot(page);
    expect(bumped.lastImpactPenalty).toBe(10);
    expect(bumped.impactPoints).toBe(bumped.impacts * 10);
    expect(bumped.score).toBe(Math.max(0, Math.round(1000 * bumped.remaining / 90) - bumped.impactPoints));
    await expect
        .poll(async () => {
            const cone = (await snapshot(page)).props.find((prop) => prop.id === 'cone-2')!;
            return Math.hypot(cone.position[0] - original.position[0], cone.position[2] - original.position[2]);
        }, { intervals: [50] })
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
    expect(restarted.car[0]).toBeCloseTo(authoredMap.spawn.position[0], 1);
    expect(restarted.car[2]).toBeCloseTo(authoredMap.spawn.position[2], 1);
    const resetCone = restarted.props.find((prop) => prop.id === 'cone-2')!;
    expect(resetCone.position[0]).toBeCloseTo(original.position[0], 2);
    expect(resetCone.position[2]).toBeCloseTo(original.position[2], 2);
});

test('reverse parking requires containment and facing, then succeeds after stopping', async ({ page }) => {
    await start(page);
    const bay = authoredMap.bay;
    const forward = [Math.sin(bay.heading * Math.PI / 180), Math.cos(bay.heading * Math.PI / 180)];
    await teleport(page, bay.x, bay.z, (bay.heading + 180) % 360);
    await page.waitForTimeout(1200);
    expect((await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).parkingProgress).toBe(0);
    // Start outside the bay's containment margin, but inside the adjacent curb.
    await teleport(page, bay.x + forward[0] * 1.2, bay.z + forward[1] * 1.2, bay.heading);
    await page.keyboard.down('s');
    await expect.poll(async () => {
        const { car } = await snapshot(page);
        return (car[0] - bay.x) * forward[0] + (car[2] - bay.z) * forward[1];
    }, { intervals: [50], timeout: 7000 }).toBeLessThan(0.5);
    await page.keyboard.up('s');
    await page.keyboard.down('Space');
    await expect(page.getByRole('heading', { name: 'Parked!' })).toBeVisible({ timeout: 7000 });
    await page.keyboard.up('Space');
    const won = await snapshot(page);
    expect(won.phase).toBe('won');
    expect(won.parkingProgress).toBe(1);
    expect(won.impacts).toBe(0);
    await page.waitForTimeout(400);
    expect((await snapshot(page)).score).toBe(won.score);
});

test('parking meter appears on partial bay overlap, guides alignment and hides on exit or restart', async ({ page }) => {
    await start(page);
    const bay = authoredMap.bay;
    const radians = bay.heading * Math.PI / 180;
    const meter = page.getByRole('progressbar', { name: 'Parking hold', exact: true });
    await expect(meter).toHaveCount(0);
    await teleport(page, bay.x + Math.sin(radians) * 1.2, bay.z + Math.cos(radians) * 1.2, bay.heading);
    await expect(meter).toBeVisible();
    await expect(page.locator('.game-parking-meter')).toContainText('Move fully inside');
    await page.waitForTimeout(1100);
    expect((await snapshot(page)).parkingProgress).toBe(0);
    expect((await snapshot(page)).phase).toBe('playing');
    const size = (await meter.boundingBox())!;
    expect(size.width).toBeGreaterThanOrEqual(240);
    expect(size.height).toBeGreaterThanOrEqual(20);
    await teleport(page, bay.x, bay.z, (bay.heading + 180) % 360);
    await expect(page.locator('.game-parking-meter')).toContainText('Face the arrow');
    await expect(meter).toHaveAttribute('aria-valuenow', '0');
    const fixed = (await page.locator('.game-parking-meter').boundingBox())!;
    const initial = (await snapshot(page)).car;
    await page.keyboard.down('w');
    await expect.poll(async () => Math.hypot((await snapshot(page)).car[0] - initial[0], (await snapshot(page)).car[2] - initial[2])).toBeGreaterThan(0.1);
    await page.keyboard.up('w');
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).speed).toBeLessThan(0.05);
    await page.keyboard.up('Space');
    const moved = (await page.locator('.game-parking-meter').boundingBox())!;
    expect(moved.x).toBeCloseTo(fixed.x, 1);
    expect(moved.y).toBeCloseTo(fixed.y, 1);
    await teleport(page, bay.x, bay.z, bay.heading);
    await expect.poll(async () => Number(await meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    const card = (await page.locator('.game-parking-meter').boundingBox())!;
    expect(card.x).toBeCloseTo(fixed.x, 1);
    expect(card.y).toBeCloseTo(fixed.y, 1);
    await teleport(page, authoredMap.spawn.position[0], authoredMap.spawn.position[2], authoredMap.spawn.heading);
    await expect(meter).toHaveCount(0);
    expect((await snapshot(page)).parkingProgress).toBe(0);
    await page.getByRole('button', { name: 'Restart level', exact: true }).click();
    await expect(meter).toHaveCount(0);
    expect((await snapshot(page)).parkingInBay).toBe(false);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`mobile level selection, parking meter and results fit ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/campaign');
        await expect(page.locator('.menu-logo')).toBeHidden();
        await expect(page.locator('.mobile-level-grid').first()).toHaveCSS('display', 'grid');
        const columns = await page.locator('.mobile-level-grid').first().evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
        expect(columns).toBe(viewport.width > viewport.height ? 3 : 2);
        await expect(page.getByRole('region', { name: 'Selected level', exact: true })).toHaveCount(0);
        await expect(page.locator('.desktop-game-menu')).toHaveCount(0);
        const launch = page.getByRole('button', { name: firstLevelLabel, exact: true });
        const withinScreen = async (locator: ReturnType<Page['getByRole']>) => {
            await expect(locator).toBeVisible();
            const box = (await locator.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        };
        await withinScreen(launch);
        const levels = page.locator('.mobile-campaign-levels');
        await levels.evaluate((node) => { node.scrollTop = node.scrollHeight; });
        await launch.scrollIntoViewIfNeeded();
        await withinScreen(launch);
        expect(await page.locator('.mobile-game-menu').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        await launch.click();
        await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
        await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
        const bay = authoredMap.bay;
        await teleport(page, bay.x, bay.z, (bay.heading + 180) % 360);
        await withinScreen(page.getByRole('progressbar', { name: 'Parking hold', exact: true }));
        await teleport(page, bay.x, bay.z, bay.heading);
        await expect(page.getByRole('heading', { name: 'Parked!', exact: true })).toBeVisible();
        const results = page.getByRole('dialog');
        await withinScreen(results.getByRole('button', { name: 'Replay', exact: true }));
        await withinScreen(results.getByRole('button', { name: 'Level select', exact: true }));
        expect(await results.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        await results.getByRole('button', { name: 'Replay', exact: true }).click();
        await page.evaluate(() => window.__parkTest.setRemaining(0));
        await expect(page.getByRole('heading', { name: 'Time’s up', exact: true })).toBeVisible();
        await withinScreen(results.getByRole('button', { name: 'Retry', exact: true }));
        await withinScreen(results.getByRole('button', { name: 'Level select', exact: true }));
    });
}

test('pause and focus loss freeze the timer; timeout ends the attempt and permits restart', async ({ page }) => {
    await start(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    const paused = await snapshot(page);
    await page.waitForTimeout(500);
    expect((await snapshot(page)).remaining).toBe(paused.remaining);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
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
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).remaining).toBeLessThan(paused.remaining);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect((await snapshot(page)).phase).toBe('paused');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.evaluate(() => window.__parkTest.setRemaining(0.2));
    await expect(page.getByRole('heading', { name: 'Time’s up' })).toBeVisible();
    expect((await snapshot(page)).score).toBe(0);
    await page.getByRole('button', { name: 'Retry' }).click();
    expect((await snapshot(page)).phase).toBe('playing');
});

test('a failed model load shows a readable retry screen', async ({ page }) => {
    await page.route('**/assets/kenney/car-kit/sedan.glb', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Play campaign', exact: true }).click();
    await page.getByRole('button', { name: 'START LEVEL', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Level couldn’t load' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});

async function openBuilder(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
}

const savedDraft = (page: Page): Promise<MapDefinition> => page.evaluate(() => JSON.parse(localStorage.getItem('park-master.map-draft.v1')!));

test('builder reset starts an empty lot and courtyard template loading is undoable and saved', async ({ page }) => {
    await openBuilder(page);
    const template = await savedDraft(page);
    const object = template.objects[0];
    await page.getByLabel('Scene item').selectOption(`object:${object.id}`);
    await page.getByLabel('Lock selected item').check();
    await page.getByLabel('Hide selected item').check();
    await page.getByLabel('Level name', { exact: true }).fill('Draft to recover');
    await page.getByLabel('Level name', { exact: true }).press('Enter');
    const previous = await savedDraft(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await expect(page.getByLabel('Scene item')).toHaveValue('');
    await expect(page.getByRole('status')).toContainText('Reset to an empty lot');
    const empty = await savedDraft(page);
    expect(empty.name).toBe('Untitled lot');
    expect(empty.objects).toEqual([]);
    expect(empty.roads).toEqual([]);
    expect(empty.parkingBays).toEqual([]);
    expect(empty.editorOrder).toBeUndefined();
    expect(empty.playableZone).toBeUndefined();
    expect(empty.surfaces.every((surface) => surface.support)).toBe(true);
    await expect(page.getByRole('button', { name: 'Test drive', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => savedDraft(page)).toEqual(previous);
    await page.getByLabel('Scene item').selectOption(`object:${object.id}`);
    await expect(page.getByLabel('Lock selected item')).not.toBeChecked();
    await expect(page.getByLabel('Hide selected item')).not.toBeChecked();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(() => savedDraft(page)).toEqual(empty);
    await page.getByRole('button', { name: 'Load courtyard template', exact: true }).click();
    await expect.poll(() => savedDraft(page)).toEqual(template);
    await expect(page.getByLabel('Scene item')).toHaveValue('');
    await expect(page.getByRole('status')).toContainText('Loaded the courtyard template');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => savedDraft(page)).toEqual(empty);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(() => savedDraft(page)).toEqual(template);
    await page.reload();
    await expect(page).toHaveURL(/\/builder$/);
    await expect.poll(() => savedDraft(page)).toEqual(template);
});

test('editor wheel zoom follows the pointer without changing the draft', async ({ page }) => {
    await openBuilder(page);
    const grid = page.getByRole('img', { name: 'Level drafting grid', exact: true });
    const draft = await savedDraft(page);
    const view = async () => (await grid.getAttribute('viewBox'))!.split(' ').map(Number);
    const initial = await view();
    const bounds = (await grid.boundingBox())!;
    const mouseX = Math.floor(bounds.x + bounds.width * 0.75);
    const mouseY = Math.floor(bounds.y + bounds.height * 0.3);
    const fractionX = (mouseX - bounds.x) / bounds.width;
    const fractionY = (mouseY - bounds.y) / bounds.height;
    await page.mouse.move(mouseX, mouseY);
    await page.mouse.wheel(0, -240);
    await expect.poll(async () => (await view())[2]).toBeLessThan(initial[2]);
    const zoomed = await view();
    expect(zoomed[0] + zoomed[2] * fractionX).toBeCloseTo(initial[0] + initial[2] * fractionX, 5);
    expect(zoomed[1] + zoomed[3] * fractionY).toBeCloseTo(initial[1] + initial[3] * fractionY, 5);
    await page.mouse.wheel(0, 240);
    await expect.poll(async () => (await view())[2]).toBeCloseTo(initial[2], 5);
    // Trackpad pinch is delivered as a control-modified wheel event.
    await grid.dispatchEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 });
    await expect.poll(async () => (await view())[2]).toBeLessThan(initial[2]);
    await page.mouse.wheel(0, -10000);
    await expect.poll(async () => (await view())[2]).toBeLessThan(20);
    await page.mouse.wheel(0, -10000);
    await expect.poll(async () => (await view())[2]).toBe(10);
    for (let index = 0; index < 4; index++) {
        await page.mouse.wheel(0, 10000);
        await page.waitForTimeout(50);
    }
    await expect.poll(async () => (await view())[2]).toBe(240);
    expect(await savedDraft(page)).toEqual(draft);
});

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
    await expect(page).toHaveURL(/\/builder$/);
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

test('new catalog objects have previews, persist through JSON and reload, load calibrated colliders, and penalize collisions', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        if (response.url().includes('/assets/kenney/') && !response.ok() && response.status() !== 304) failedAssets.push(response.url());
    });
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const ids = ['houseA', 'houseC', 'houseD', 'houseF', 'houseG', 'planter', 'hatchbackSports', 'sedanSports', 'van', 'pickup'];
    for (const [index, id] of ids.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[id].label);
        const card = page.getByRole('button', { name: ASSETS[id].label, exact: true });
        await expect(card).toBeVisible();
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 3 - 1) * 10, -7 + Math.floor(index / 3) * 7);
    }
    const draft = await savedDraft(page);
    expect(draft.objects.map((object) => object.asset)).toEqual(ids);
    expect(draft.objects.every((object) => object.body === 'static' && object.mass === undefined)).toBe(true);
    const exported = await exportMap(page);
    expect(exported).toEqual(draft);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, exported);
    await expect.poll(() => savedDraft(page)).toEqual(exported);
    await page.reload();
    await expect(page).toHaveURL(/\/builder$/);
    expect(await savedDraft(page)).toEqual(exported);

    // Spread the buildings out and put the planter on an isolated collision course.
    const map: MapDefinition = { ...exported, spawn: { position: [0, 0, -8], heading: 0 }, bay: { ...exported.bay, x: 10, z: 0 }, objects: exported.objects.map((object, index) => ({ ...object, position: index === 5 ? [0, 0, 0] : [-20 + index * 10, 0, 20] })) };
    await importMap(page, map);
    await expect.poll(() => savedDraft(page)).toEqual(map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.objects).toHaveLength(ids.length);
    for (const object of state.objects) {
        const definition = ASSETS[object.asset];
        expect(object.body).toBe('static');
        expect(object.min[1]).toBeCloseTo(0, 2);
        for (const axis of [0, 1, 2]) {
            const size = definition.dimensions[axis] * definition.scale;
            expect(object.collider![axis]).toBeCloseTo(size, 3);
            expect(object.max[axis] - object.min[axis]).toBeCloseTo(size, 2);
            if (axis !== 1) expect((object.max[axis] + object.min[axis]) / 2).toBeCloseTo(map.objects.find((item) => item.id === object.id)!.position[axis], 2);
        }
    }
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
    await page.waitForTimeout(300);
    await page.keyboard.up('w');
    const hit = await snapshot(page);
    expect(hit.lastImpactPenalty).toBe(25);
    expect(hit.impacts).toBe(1);
    expect(hit.car[2]).toBeLessThan(-2.8);
    await page.keyboard.press('r');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(0);
    expect((await snapshot(page)).car[2]).toBeCloseTo(-8, 2);
    expect(failedAssets).toEqual([]);
    expect(errors).toEqual([]);
});

const FLAT_ROAD_ADDITIONS = ['roadCrossing', 'roadEnd', 'roadEndRound', 'roadBendSquare', 'roadBendSidewalk', 'roadCrossroadLine', 'roadCrossroadPath', 'roadIntersectionLine', 'roadIntersectionPath', 'roadDrivewaySingle', 'roadDrivewayDouble', 'roadSquare'] as const;

test('new flat roads have previews, snap, round-trip, retain quarter turns and support penalty-free driving', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        if (response.url().includes('/assets/kenney/') && !response.ok() && response.status() !== 304) failedAssets.push(response.url());
    });
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const [index, asset] of FLAT_ROAD_ADDITIONS.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[asset].label);
        const card = page.getByRole('button', { name: ASSETS[asset].label, exact: true });
        await expect(card).toBeVisible();
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 4 - 2) * 5 + 0.7, -5 + Math.floor(index / 4) * 5 + 0.4);
    }
    const exported = await exportMap(page);
    expect(exported.roads.map((road) => road.asset)).toEqual(FLAT_ROAD_ADDITIONS);
    expect(exported.objects).toEqual([]);
    exported.roads.forEach((road, index) => expect(road.cell).toEqual([index % 4 - 2, -1 + Math.floor(index / 4)]));
    await page.getByLabel('Scene item').selectOption(`road:${exported.roads[0].id}`);
    await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
    expect((await savedDraft(page)).roads[0].rotation).toBe(90);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).roads[0].rotation).toBe(0);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, exported);
    await expect.poll(() => savedDraft(page)).toEqual(exported);
    await page.reload();
    expect(await savedDraft(page)).toEqual(exported);
    const map: MapDefinition = {
        ...exported, spawn: { position: [0, 0, -32], heading: 0 },
        surfaces: exported.surfaces.map((surface) => surface.id === 'court-floor' ? { ...surface, size: [30, 0.3, 90] } : surface),
        roads: exported.roads.map((road, index) => ({ ...road, cell: [0, index - 5], rotation: 90 }))
    };
    await importMap(page, map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.roads).toHaveLength(FLAT_ROAD_ADDITIONS.length);
    state.roads.forEach((road, index) => {
        expect(road.heading).toBeCloseTo(90, 2);
        expect(road.position[0]).toBeCloseTo(0, 3);
        expect(road.position[2]).toBeCloseTo((index - 5) * 5, 3);
        expect(road.dimensions[0]).toBeCloseTo(5, 3);
        expect(road.dimensions[1]).toBeCloseTo(0.1, 3);
        expect(road.dimensions[2]).toBeCloseTo(5, 3);
        expect(road.supportCollider).toEqual([5, 0.3, 5]);
    });
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).car[2], { timeout: 20000 }).toBeGreaterThan(36);
    await page.keyboard.up('w');
    expect((await snapshot(page)).impacts).toBe(0);
    expect((await snapshot(page)).phase).toBe('playing');
    await page.keyboard.press('r');
    expect((await snapshot(page)).car[2]).toBeCloseTo(-32, 2);
    expect((await snapshot(page)).impacts).toBe(0);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
});

test('new road ports rotate correctly and invalid road imports preserve the draft', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const empty = await exportMap(page);
    const map: MapDefinition = { ...empty, roads: [
        { id: 'end', asset: 'roadEndRound', cell: [0, 0], rotation: 0 },
        { id: 'crossing', asset: 'roadCrossing', cell: [1, 0], rotation: 0 }
    ] };
    await importMap(page, map);
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await expect(page.getByText('end and crossing: lanes do not connect.', { exact: true })).toHaveCount(0);
    await page.getByLabel('Scene item').selectOption('road:end');
    await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
    await expect(page.getByText('end and crossing: lanes do not connect.', { exact: true })).toBeVisible();
    const rotated = await exportMap(page);
    await importMap(page, { ...rotated, roads: rotated.roads.map((road, index) => index === 0 ? { ...road, rotation: 45 } : road) });
    await expect(page.getByRole('alert')).toHaveText('Road rotation must be 0, 90, 180, or 270 degrees.');
    expect(await savedDraft(page)).toEqual(rotated);
    await importMap(page, { ...rotated, roads: [...rotated.roads, { id: 'duplicate', asset: 'roadSquare', cell: [0, 0], rotation: 0 }] });
    await expect(page.getByRole('alert')).toHaveText('Two roads occupy cell 0,0.');
    expect(await savedDraft(page)).toEqual(rotated);
    await importMap(page, { ...rotated, objects: [{ id: 'wrong-role', asset: 'roadCrossing', position: [0, 0, 0], heading: 0 }] });
    await expect(page.getByRole('alert')).toHaveText('objects[0].asset is not a supported prop.');
    expect(await savedDraft(page)).toEqual(rotated);
});

const REMAINING_CAR_PROPS = ['ambulance', 'deliveryFlat', 'delivery', 'firetruck', 'garbageTruck', 'police', 'suvLuxury', 'pickupFlat', 'coneFlat'];

const EXTENDED_ROADS = ['roadCurve', 'roadCurveIntersection', 'roadCurvePavement', 'roadRoundabout', 'roadSide', 'roadSideEntry', 'roadSideExit', 'roadSplit', 'roadHalf', 'tileLow'] as const;
const RAIL_CONTACTS: Record<string, number> = { barrierBend: 2.5, barrierBendSquare: 2.5, barrierCrossroad: 2.35, barrierCurve: 5, barrierCurveIntersection: -0.15, barrierDrivewayDouble: 2.35, barrierDrivewaySingle: 2.35, barrierEnd: -2.5, barrierEndRound: -2.5, barrierIntersection: 2.35, barrierRoundabout: 2.5, barrierSide: -2.5, barrierSideEntry: -2.5, barrierSideExit: 2.5, barrierSplit: 2.3526, barrierSquare: -2.5, barrierStraightEnd: -2.5, barrierHalf: -1.25, barrierStraight: -2.5 };

test('extended road and rail previews load; fine placement, footprint rejection, rotation and persistence agree', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const asset of [...EXTENDED_ROADS, ...Object.keys(RAIL_CONTACTS)]) {
        await page.getByLabel('Search assets').fill(ASSETS[asset].label);
        const card = page.getByRole('button', { name: ASSETS[asset].label, exact: true });
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    await page.getByLabel('Search assets').fill('Half straight road');
    await page.getByRole('button', { name: 'Half straight road', exact: true }).click();
    await page.getByLabel('Road snap').selectOption('1.25');
    await placeOnGrid(page, 1.3, 0.1);
    expect((await savedDraft(page)).roads[0].cell).toEqual([0.25, 0]);
    await page.getByRole('button', { name: 'Select & move', exact: true }).click();
    await page.getByLabel('Scene item').selectOption('road:road-1');
    await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
    expect((await savedDraft(page)).roads[0].rotation).toBe(90);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).roads[0].rotation).toBe(0);
    const empty = await exportMap(page);
    const map: MapDefinition = { ...empty,
        roads: EXTENDED_ROADS.map((asset, index) => ({ id: `tile-${index}`, asset, cell: [(index % 3 - 1) * 4, (Math.floor(index / 3) - 1) * 4], rotation: index % 2 ? 90 : 0 })),
        objects: Object.keys(RAIL_CONTACTS).map((asset, index) => ({ id: `rail-${index}`, asset, position: [60 + index % 5 * 20, 0, Math.floor(index / 5) * 20], heading: index % 2 ? 90 : 0, body: 'static' }))
    };
    await importMap(page, map);
    await expect.poll(() => savedDraft(page)).toEqual(map);
    await page.reload();
    expect(await savedDraft(page)).toEqual(map);
    await importMap(page, { ...map, roads: [...map.roads, { id: 'overlap', asset: 'road', cell: [-3, -4], rotation: 0 }] });
    await expect(page.getByRole('alert')).toHaveText('tile-0 and overlap: road footprints overlap.');
    expect(await savedDraft(page)).toEqual(map);
    await importMap(page, { ...map, roads: [{ id: 'bad-fraction', asset: 'roadHalf', cell: [0.1, 0], rotation: 0 }] });
    await expect(page.getByRole('alert')).toHaveText('Road cells must use quarter-cell increments between -100 and 100.');
    expect(await savedDraft(page)).toEqual(map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.roads).toHaveLength(10);
    for (const [index, road] of state.roads.entries()) {
        const definition = ASSETS[EXTENDED_ROADS[index]];
        expect(road.heading).toBeCloseTo(map.roads[index].rotation, 2);
        expect(road.supportCollider![0]).toBeCloseTo(definition.dimensions[0] * 5, 3);
        expect(road.supportCollider![2]).toBeCloseTo(definition.dimensions[2] * 5, 3);
        for (const axis of [0, 1, 2]) expect(road.dimensions[axis]).toBeCloseTo(definition.dimensions[index % 2 && axis !== 1 ? 2 - axis : axis] * 5, 2);
    }
    for (const object of state.objects.filter((object) => object.asset.startsWith('barrier'))) {
        const definition = ASSETS[object.asset], placed = map.objects.find((item) => item.id === object.id)!;
        expect(object.body).toBe('static');
        expect(object.colliderType).toBe('compound');
        expect(object.min[1]).toBeCloseTo(0, 2);
        for (const axis of [0, 1, 2]) expect(object.max[axis] - object.min[axis]).toBeCloseTo(definition.dimensions[placed.heading === 90 && axis !== 1 ? 2 - axis : axis] * 5, 2);
    }
});

test('extended road ports connect curves, splits, half tiles and widened lanes across fractional cells', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const map = await exportMap(page);
    await importMap(page, { ...map, roads: [
        { id: 'curve', asset: 'roadCurve', cell: [0, 0], rotation: 0 },
        { id: 'curve-out', asset: 'road', cell: [0.5, 1.5], rotation: 90 },
        { id: 'split', asset: 'roadSplit', cell: [5, 0], rotation: 0 },
        { id: 'branch-a', asset: 'road', cell: [4, -0.5], rotation: 0 },
        { id: 'branch-b', asset: 'road', cell: [4, 0.5], rotation: 0 },
        { id: 'half-a', asset: 'roadHalf', cell: [0, 5], rotation: 0 },
        { id: 'half-b', asset: 'roadHalf', cell: [0.5, 5], rotation: 0 },
        { id: 'wide', asset: 'roadSideEntry', cell: [5, 5], rotation: 0 },
        { id: 'wide-out', asset: 'road', cell: [6, 5], rotation: 0 }
    ] });
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await expect(page.getByText(/lanes do not connect\./)).toHaveCount(0);
    await page.getByLabel('Scene item').selectOption('road:curve-out');
    await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
    await expect(page.getByText('curve and curve-out: lanes do not connect.', { exact: true })).toBeVisible();
});

for (const [asset, z] of Object.entries(RAIL_CONTACTS)) {
    test(`${asset} mesh rails block driving with a hard penalty and restart clears contact`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        const map = await exportMap(page), edge = ASSETS[asset].dimensions[0] * 2.5;
        await importMap(page, { ...map, spawn: { position: [edge + 5, 0, z], heading: 270 }, objects: [{ id: 'rails', asset, position: [0, 0, 0], heading: 0, body: 'static' }] });
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
        await page.waitForTimeout(200);
        await page.keyboard.up('w');
        expect((await snapshot(page)).lastImpactPenalty).toBe(25);
        expect((await snapshot(page)).car[0]).toBeGreaterThan(edge);
        await page.keyboard.press('r');
        expect((await snapshot(page)).impacts).toBe(0);
        expect((await snapshot(page)).car[0]).toBeCloseTo(edge + 5, 2);
    });
}

test('straight mesh rails keep the lane open and large and half tiles support penalty-free driving', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const map = await exportMap(page);
    await importMap(page, { ...map, spawn: { position: [0, 0, -8], heading: 0 }, surfaces: map.surfaces.map((surface) => surface.id === 'court-floor' ? { ...surface, size: [30, 0.3, 80] } : surface), roads: [{ id: 'road', asset: 'road', cell: [0, 0], rotation: 90 }, { id: 'roundabout', asset: 'roadRoundabout', cell: [0, 2], rotation: 0 }, { id: 'half', asset: 'roadHalf', cell: [0, 4], rotation: 90 }], objects: [{ id: 'rails', asset: 'barrierStraight', position: [0, 0, 0], heading: 0, body: 'static' }] });
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).car[2], { timeout: 15000 }).toBeGreaterThan(24);
    await page.keyboard.up('w');
    expect((await snapshot(page)).impacts).toBe(0);
});

test('remaining car props have previews, round-trip and grounded matching colliders', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const [index, asset] of REMAINING_CAR_PROPS.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[asset].label);
        const card = page.getByRole('button', { name: ASSETS[asset].label, exact: true });
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 3 - 1) * 8, Math.floor(index / 3) * 8 - 8);
    }
    const map = await exportMap(page);
    expect(map.objects.map((object) => object.asset)).toEqual(REMAINING_CAR_PROPS);
    await importMap(page, map);
    await page.reload();
    expect(await savedDraft(page)).toEqual(map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    for (const object of state.objects) {
        const definition = ASSETS[object.asset];
        expect(object.body).toBe(definition.body);
        expect(object.min[1]).toBeCloseTo(0, 1);
        for (const axis of [0, 1, 2]) {
            expect(object.max[axis] - object.min[axis]).toBeCloseTo(definition.dimensions[axis] * definition.scale, 2);
            expect(object.collider![axis]).toBeCloseTo(definition.dimensions[axis] * definition.scale, 3);
        }
    }
});

for (const asset of REMAINING_CAR_PROPS) {
    test(`${asset} blocks or moves on contact with the correct penalty and resets`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        const map = await exportMap(page);
        const definition = ASSETS[asset];
        await importMap(page, { ...map, spawn: { position: [0, 0, -8], heading: 0 }, objects: [{ id: 'prop', asset, position: [0, 0, 0], heading: 0, body: definition.body, ...(definition.mass ? { mass: definition.mass } : {}) }] });
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
        await page.keyboard.up('w');
        expect((await snapshot(page)).lastImpactPenalty).toBe(asset === 'coneFlat' ? 10 : 25);
        if (asset !== 'coneFlat') expect((await snapshot(page)).car[2]).toBeLessThan(-3);
        else await expect.poll(async () => Math.abs((await snapshot(page)).props.find((prop) => prop.id === 'prop')!.position[2])).toBeGreaterThan(0.1);
        await page.keyboard.press('r');
        expect((await snapshot(page)).impacts).toBe(0);
        expect((await snapshot(page)).car[2]).toBeCloseTo(-8, 2);
        if (asset === 'coneFlat') expect((await snapshot(page)).props.find((prop) => prop.id === 'prop')!.position[2]).toBeCloseTo(0, 2);
    });
}

const COMPOUND_ADDITIONS = ['fenceLow', 'fence1x2', 'fence1x3', 'fence1x4', 'fence2x2', 'fence2x3', 'fence3x2', 'fence3x3', 'hangingSignPost', 'hangingTrafficLight', 'highwaySign', 'highwaySignWide', 'highwaySignDetailed'];

test('compound assets have previews, persist and retain grounded rotated meshes and child colliders', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const [index, id] of COMPOUND_ADDITIONS.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[id].label);
        const card = page.getByRole('button', { name: ASSETS[id].label, exact: true });
        await expect(card).toBeVisible();
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 3 - 1) * 8, -12 + Math.floor(index / 3) * 6);
    }
    const exported = await exportMap(page);
    expect(exported.objects.map((object) => object.asset)).toEqual(COMPOUND_ADDITIONS);
    expect(exported.objects.every((object) => object.body === 'static')).toBe(true);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, exported);
    await expect.poll(() => savedDraft(page)).toEqual(exported);
    await page.reload();
    expect(await savedDraft(page)).toEqual(exported);
    const map: MapDefinition = {
        ...exported, spawn: { position: [-28, 0, -28], heading: 0 },
        surfaces: exported.surfaces.map((surface) => surface.id === 'court-floor' ? { ...surface, size: [60, 0.3, 60] } : surface),
        objects: exported.objects.map((object, index) => ({ ...object, position: [-21 + index % 4 * 14, 0, -21 + Math.floor(index / 4) * 14], heading: index % 2 ? 90 : 0 }))
    };
    await importMap(page, map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.objects).toHaveLength(COMPOUND_ADDITIONS.length);
    for (const object of state.objects) {
        const definition = ASSETS[object.asset];
        const placed = map.objects.find((item) => item.id === object.id)!;
        expect(object.body).toBe('static');
        expect(object.colliderType).toBe('compound');
        expect(object.colliderParts).toHaveLength(definition.colliderBoxes!.length);
        expect(object.min[1]).toBeCloseTo(0, 2);
        for (const axis of [0, 1, 2]) {
            const visualAxis = placed.heading === 90 && axis !== 1 ? 2 - axis : axis;
            expect(object.max[axis] - object.min[axis]).toBeCloseTo(definition.dimensions[visualAxis] * definition.scale, 2);
            if (axis !== 1) expect((object.min[axis] + object.max[axis]) / 2).toBeCloseTo(placed.position[axis], 2);
        }
        object.colliderParts!.forEach((part, index) => {
            const box = definition.colliderBoxes![index];
            for (const axis of [0, 1, 2]) {
                expect(part.dimensions[axis]).toBeCloseTo(box.dimensions[axis] * definition.scale, 3);
                expect(part.position[axis]).toBeCloseTo((box.center[axis] - (axis === 1 ? definition.dimensions[1] / 2 : 0)) * definition.scale, 3);
            }
        });
    }
    expect(errors).toEqual([]);
});

for (const asset of ['fenceLow', 'fence3x3']) {
    test(`${asset} leaves its centre open while fence segments block and charge one hard impact`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        const map = await exportMap(page);
        await importMap(page, { ...map, spawn: { position: [0, 0, -8], heading: 0 }, objects: [{ id: 'enclosure', asset, position: [0, 0, 0], heading: 0, body: 'static' }] });
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeGreaterThan(-0.5);
        expect((await snapshot(page)).impacts).toBe(0);
        if (asset === 'fenceLow') {
            await expect.poll(async () => (await snapshot(page)).car[2]).toBeGreaterThan(7);
            expect((await snapshot(page)).impacts).toBe(0);
        } else {
            await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
            expect((await snapshot(page)).car[2]).toBeLessThan(1.3);
        }
        await page.keyboard.up('w');
        await page.keyboard.press('r');
        await teleport(page, 0, 0, 90);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
        await page.waitForTimeout(300);
        await page.keyboard.up('w');
        const hit = await snapshot(page);
        expect(hit.lastImpactPenalty).toBe(25);
        expect(hit.impacts).toBe(1);
        expect(hit.car[0]).toBeLessThan(1.4);
        await page.keyboard.press('r');
        expect((await snapshot(page)).impacts).toBe(0);
        expect((await snapshot(page)).car[2]).toBeCloseTo(-8, 2);
    });
}

for (const asset of ['hangingSignPost', 'hangingTrafficLight', 'highwaySign', 'highwaySignWide', 'highwaySignDetailed']) {
    test(`${asset} preserves overhead clearance but its posts block and score as one obstacle`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        const map = await exportMap(page);
        const highway = asset.startsWith('highway');
        const laneX = highway ? 0 : -1.2;
        const postX = highway ? 3.8 : 0.82;
        await importMap(page, { ...map, spawn: { position: [laneX, 0, -8], heading: 0 }, objects: [{ id: 'overhead', asset, position: [0, 0, 0], heading: 90, body: 'static' }] });
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).car[2], { timeout: 7000 }).toBeGreaterThan(8);
        await page.keyboard.up('w');
        expect((await snapshot(page)).impacts).toBe(0);
        await page.keyboard.press('r');
        await teleport(page, postX, -8, 0);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
        await page.waitForTimeout(300);
        await page.keyboard.up('w');
        const hit = await snapshot(page);
        expect(hit.lastImpactPenalty).toBe(25);
        expect(hit.impacts).toBe(1);
        expect(hit.car[2]).toBeLessThan(-2);
        await page.keyboard.press('r');
        expect((await snapshot(page)).impacts).toBe(0);
    });
}

const SUBURBAN_ADDITIONS = ['houseH', 'houseI', 'houseJ', 'houseK', 'houseL', 'houseM', 'houseN', 'houseO', 'houseP', 'houseQ', 'houseR', 'houseS', 'houseT', 'houseU', 'pathShort', 'pathLong', 'pathStonesShort', 'pathStonesLong', 'pathStonesMessy', 'drivewayShort', 'drivewayLong'];

test('remaining suburban houses and overlays have previews, persist and load matching grounded footprints', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        if (response.url().includes('/assets/kenney/') && !response.ok() && response.status() !== 304) failedAssets.push(response.url());
    });
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const [index, id] of SUBURBAN_ADDITIONS.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[id].label);
        const card = page.getByRole('button', { name: ASSETS[id].label, exact: true });
        await expect(card).toBeVisible();
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 3 - 1) * 10, -12 + Math.floor(index / 3) * 4);
    }
    const exported = await exportMap(page);
    expect(exported.objects.map((object) => object.asset)).toEqual(SUBURBAN_ADDITIONS);
    for (const object of exported.objects) expect(object.body).toBe(ASSETS[object.asset].body);
    expect(exported.objects.filter((object) => object.body === 'static')).toHaveLength(14);
    expect(exported.objects.filter((object) => object.body === undefined)).toHaveLength(7);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, exported);
    await expect.poll(() => savedDraft(page)).toEqual(exported);
    await page.reload();
    expect(await savedDraft(page)).toEqual(exported);
    const map: MapDefinition = {
        ...exported,
        spawn: { position: [-38, 0, -38], heading: 0 },
        surfaces: exported.surfaces.map((surface) => surface.id === 'court-floor' ? { ...surface, size: [90, 0.3, 90] } : surface),
        objects: exported.objects.map((object, index) => ({ ...object, position: [(index % 5 - 2) * 14, 0, -28 + Math.floor(index / 5) * 14], heading: index % 2 ? 90 : 0 }))
    };
    await importMap(page, map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.objects).toHaveLength(SUBURBAN_ADDITIONS.length);
    for (const object of state.objects) {
        const definition = ASSETS[object.asset];
        const placed = map.objects.find((item) => item.id === object.id)!;
        expect(object.body).toBe(definition.body);
        expect(object.min[1]).toBeCloseTo(0, 2);
        for (const axis of [0, 1, 2]) {
            const visualAxis = placed.heading === 90 && axis !== 1 ? 2 - axis : axis;
            expect(object.max[axis] - object.min[axis]).toBeCloseTo(definition.dimensions[visualAxis] * definition.scale, 2);
            if (definition.body) expect(object.collider![axis]).toBeCloseTo(definition.dimensions[axis] * definition.scale, 3);
            else expect(object.collider).toBeUndefined();
            if (axis !== 1) expect((object.min[axis] + object.max[axis]) / 2).toBeCloseTo(placed.position[axis], 2);
        }
    }
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
});

test('suburban overlays do not obstruct driving or charge impacts; offset houses still block and reset', async ({ page }) => {
    test.setTimeout(60000);
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const map = await exportMap(page);
    const overlays = SUBURBAN_ADDITIONS.filter((asset) => ASSETS[asset].category === 'Paths & driveways');
    await importMap(page, {
        ...map,
        spawn: { position: [-10, 0, -10], heading: 0 },
        objects: [
            ...overlays.map((asset, index) => ({ id: asset, asset, position: [-10, 0, -4 + index * 2] as [number, number, number], heading: 0 })),
            { id: 'house-q', asset: 'houseQ', position: [0, 0, 0], heading: 0, body: 'static' },
            { id: 'house-t', asset: 'houseT', position: [10, 0, 0], heading: 90, body: 'static' }
        ]
    });
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).car[2], { timeout: 8000 }).toBeGreaterThan(12);
    await page.keyboard.up('w');
    expect((await snapshot(page)).impacts).toBe(0);
    for (const x of [0, 10]) {
        await page.keyboard.press('r');
        await teleport(page, x, -10, 0);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
        await page.waitForTimeout(300);
        await page.keyboard.up('w');
        const hit = await snapshot(page);
        expect(hit.lastImpactPenalty).toBe(25);
        expect(hit.impacts).toBe(1);
        expect(hit.car[2]).toBeLessThan(-4);
    }
    await page.keyboard.press('r');
    const reset = await snapshot(page);
    expect(reset.impacts).toBe(0);
    expect(reset.car[0]).toBeCloseTo(-10, 2);
    expect(reset.car[2]).toBeCloseTo(-10, 2);
});

const STREET_FURNITURE = ['stopSign', 'streetSign', 'signPost', 'streetlightCurved', 'streetlightCurvedDouble', 'streetlightCurvedCross', 'streetlightSquare', 'streetlightSquareDouble', 'streetlightSquareCross', 'trafficLight', 'dumpster', 'constructionBarrier', 'constructionCone', 'constructionFence', 'constructionLight'];

test('street furniture previews, placement, JSON, reload, grounding and calibrated colliders agree', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        if (response.url().includes('/assets/kenney/') && !response.ok() && response.status() !== 304) failedAssets.push(response.url());
    });
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    for (const [index, id] of STREET_FURNITURE.entries()) {
        await page.getByLabel('Search assets').fill(ASSETS[id].label);
        const card = page.getByRole('button', { name: ASSETS[id].label, exact: true });
        await expect(card).toBeVisible();
        await expect.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await card.click();
        await placeOnGrid(page, (index % 3 - 1) * 8, -10 + Math.floor(index / 3) * 5);
    }
    const exported = await exportMap(page);
    expect(exported.objects.map((object) => object.asset)).toEqual(STREET_FURNITURE);
    for (const object of exported.objects) {
        expect(object.body).toBe(ASSETS[object.asset].body);
        expect(object.mass).toBe(ASSETS[object.asset].mass);
    }
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, exported);
    await expect.poll(() => savedDraft(page)).toEqual(exported);
    await page.reload();
    expect(await savedDraft(page)).toEqual(exported);
    const map: MapDefinition = { ...exported, objects: exported.objects.map((object, index) => ({ ...object, position: [(index % 5 - 2) * 6, 0, -10 + Math.floor(index / 5) * 10], heading: index % 2 ? 90 : 0 })) };
    await importMap(page, map);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const state = await snapshot(page);
    expect(state.objects).toHaveLength(STREET_FURNITURE.length);
    for (const object of state.objects) {
        const definition = ASSETS[object.asset];
        const placed = map.objects.find((item) => item.id === object.id)!;
        expect(object.body).toBe(definition.body);
        expect(object.min[1]).toBeCloseTo(0, 2);
        for (const axis of [0, 1, 2]) {
            const visualAxis = placed.heading === 90 && axis !== 1 ? 2 - axis : axis;
            expect(object.max[axis] - object.min[axis]).toBeCloseTo(definition.dimensions[visualAxis] * definition.scale, 2);
            expect(object.collider![axis]).toBeCloseTo((definition.collider?.dimensions ?? definition.dimensions)[axis] * definition.scale, 3);
            expect(object.colliderOffset![axis]).toBeCloseTo(definition.collider ? (definition.collider.center[axis] - (axis === 1 ? definition.dimensions[1] / 2 : 0)) * definition.scale : 0, 3);
            if (axis !== 1) expect((object.min[axis] + object.max[axis]) / 2).toBeCloseTo(placed.position[axis], 2);
        }
    }
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
});

for (const asset of ['streetlightCurvedCross', 'streetlightSquareCross']) {
    test(`${asset} allows driving beneath its arms but its pole blocks and penalizes contact`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        const map = await exportMap(page);
        await importMap(page, { ...map, spawn: { position: [1.5, 0, -6], heading: 0 }, objects: [{ id: 'lamp', asset, position: [0, 0, 0], heading: 0, body: 'static' }] });
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeGreaterThan(5);
        await page.keyboard.up('w');
        expect((await snapshot(page)).impacts).toBe(0);
        await page.keyboard.press('r');
        await teleport(page, 0, -6, 0);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
        await page.waitForTimeout(300);
        await page.keyboard.up('w');
        const hit = await snapshot(page);
        expect(hit.lastImpactPenalty).toBe(25);
        expect(hit.impacts).toBe(1);
        expect(hit.car[2]).toBeLessThan(-2);
        await page.keyboard.press('r');
        expect((await snapshot(page)).impacts).toBe(0);
    });
}

test('street signs, signals, dumpster and construction obstacles block cars; the cone moves and resets', async ({ page }) => {
    test.setTimeout(60000);
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const map = await exportMap(page);
    const ids = ['stopSign', 'streetSign', 'signPost', 'trafficLight', 'dumpster', 'constructionBarrier', 'constructionFence', 'constructionLight', 'constructionCone'];
    // Keep every fixture on the court floor, including the dynamic cone.
    await importMap(page, { ...map, spawn: { position: [0, 0, -6], heading: 0 }, objects: ids.map((asset, index) => ({ id: asset, asset, position: [(index - 4) * 3, 0, 0], heading: 0, body: ASSETS[asset].body, ...(ASSETS[asset].mass ? { mass: ASSETS[asset].mass } : {}) })) });
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    const coneBefore = (await snapshot(page)).props.find((prop) => prop.id === 'constructionCone')!.position;
    for (const [index, asset] of ids.entries()) {
        await page.keyboard.press('r');
        await teleport(page, (index - 4) * 3, -6, 0);
        await page.keyboard.down('w');
        await expect.poll(async () => (await snapshot(page)).impacts, { message: `Impact with ${asset}` }).toBe(1);
        await page.waitForTimeout(350);
        await page.keyboard.up('w');
        const hit = await snapshot(page);
        expect(hit.lastImpactPenalty).toBe(asset === 'constructionCone' ? 10 : 25);
        expect(hit.impacts).toBe(1);
        if (asset !== 'constructionCone') expect(hit.car[2]).toBeLessThan(-1.8);
        else expect(Math.hypot(...hit.props.find((prop) => prop.id === asset)!.position.map((value, axis) => value - coneBefore[axis]))).toBeGreaterThan(0.1);
    }
    await page.keyboard.press('r');
    const reset = await snapshot(page);
    expect(reset.impacts).toBe(0);
    reset.props.find((prop) => prop.id === 'constructionCone')!.position.forEach((value, axis) => expect(value).toBeCloseTo(coneBefore[axis], 2));
    expect(reset.car[2]).toBeCloseTo(-6, 2);
});

test('an empty map does not request unused catalog models, even when those resources are unavailable', async ({ page }) => {
    const requests = new Set<string>();
    page.on('request', (request) => {
        if (request.url().includes('/assets/kenney/') && request.url().endsWith('.glb')) requests.add(new URL(request.url()).pathname);
    });
    await page.route('**/assets/kenney/**/*.glb', (route) => route.request().url().endsWith('/sedan.glb') ? route.continue() : route.abort());
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    expect((await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).objects).toEqual([]);
    expect([...requests]).toEqual(['/assets/kenney/car-kit/sedan.glb']);
});

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
    await expect(page).toHaveURL(/\/builder$/);
    await settingsTab.click();
    await expect(page.getByLabel('Time limit (seconds)', { exact: true })).toHaveValue('120');
    await expect(page.getByLabel('Small impact penalty', { exact: true })).toHaveValue('7');
    await expect(page.getByLabel('Hard impact penalty', { exact: true })).toHaveValue('40');
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
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
    await expect(page.getByText('120s from first movement', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    expect((await snapshot(page)).remaining).toBe(120);
    expect((await snapshot(page)).level).toMatchObject({ timeLimit: 120, smallImpactPenalty: 7, impactPenalty: 40 });
    const canvas = (await page.locator('.game-shell canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    const cone = (await snapshot(page)).props.find((prop) => prop.id === 'cone-2')!;
    await teleport(page, cone.position[0] - 3.5, cone.position[2], 90);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts, { intervals: [50] }).toBeGreaterThan(0);
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
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        if (kind === 'parking') {
            await page.getByRole('button', { name: 'Parking bay', exact: true }).click();
            await placeOnGrid(page, 0, 0);
            await expect(page.getByLabel('Wheel stop', { exact: true })).not.toBeChecked();
        }
        const draft = await savedDraft(page);
        const bay = kind === 'target' ? draft.bay : draft.parkingBays[0];
        if (kind === 'parking') expect(draft.parkingBays[0].wheelStop).toBe(false);
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
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
            await leaveGame(page, 'Back to builder');
            await page.getByLabel('Scene item').selectOption(`parking:${draft.parkingBays[0].id}`);
            await page.getByLabel('Wheel stop', { exact: true }).check();
            expect((await exportMap(page)).parkingBays[0].wheelStop).toBe(true);
            await page.getByRole('button', { name: 'Test drive', exact: true }).click();
            await page.getByRole('button', { name: 'Start', exact: true }).click();
            await teleport(page, bay.x, back - initial.vehicle.length / 2 - 0.5, 0);
            await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
            await page.keyboard.down('w');
            await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
            await page.keyboard.up('w');
            expect((await snapshot(page)).car[2]).toBeLessThan(back + 0.5);
        }
    });
}

test('builder inserts roads and floors below obstacles after reordering and supports front/back actions', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const draft = await savedDraft(page);
    draft.roads = [{ id: 'base-road', asset: 'road', cell: [0, 0], rotation: 0 }];
    draft.surfaces.push({ id: 'curb', position: [0, 0.22, 0], size: [5, 0.44, 0.45], heading: 0, color: '#e2decf', solid: true, support: false });
    draft.objects = [
        { id: 'box', asset: 'box', position: [0, 0, 0], heading: 0, body: 'dynamic', mass: 16 },
        { id: 'cone', asset: 'cone', position: [0, 0, 0], heading: 0, body: 'dynamic', mass: 8 }
    ];
    await importMap(page, draft);
    await expect.poll(() => savedDraft(page)).toEqual(draft);
    const drawn = () => page.locator('svg [data-item-id]').evaluateAll((nodes) => nodes.map((node) => `${node.getAttribute('data-kind')}:${node.getAttribute('data-item-id')}`));
    const defaults = await drawn();
    expect(defaults.indexOf('road:base-road')).toBeLessThan(defaults.indexOf('surface:curb'));
    expect(defaults.indexOf('surface:curb')).toBeLessThan(defaults.indexOf('object:cone'));
    await page.getByLabel('Scene item').selectOption('object:box');
    await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
    const custom = await drawn();
    expect(custom.indexOf('object:cone')).toBeLessThan(custom.indexOf('object:box'));

    await page.getByRole('button', { name: ASSETS.road.label, exact: true }).click();
    await placeOnGrid(page, 5, 0);
    const roadId = (await savedDraft(page)).roads[1].id;
    await page.getByRole('button', { name: 'Asphalt floor', exact: true }).click();
    await placeOnGrid(page, 0, 0);
    const floorId = (await savedDraft(page)).surfaces.at(-1)!.id;
    const added = await drawn();
    expect(added.filter((key) => custom.includes(key))).toEqual(custom);
    expect(added.indexOf(`surface:${floorId}`)).toBeLessThan(added.indexOf('road:base-road'));
    expect(added.indexOf(`road:${roadId}`)).toBeLessThan(added.indexOf('surface:curb'));
    const partial = await savedDraft(page);
    partial.editorOrder = ['object:cone', 'object:box'];
    await importMap(page, partial);
    await expect.poll(() => savedDraft(page)).toEqual(partial);
    const merged = await drawn();
    expect(merged.indexOf('object:cone')).toBeLessThan(merged.indexOf('object:box'));
    expect(merged.indexOf(`surface:${floorId}`)).toBeLessThan(merged.indexOf('road:base-road'));
    expect(merged.indexOf(`road:${roadId}`)).toBeLessThan(merged.indexOf('surface:curb'));
    await page.getByRole('button', { name: 'Select & move', exact: true }).click();
    const origin = await gridPoint(page, 0, 0);
    await page.mouse.click(origin.x, origin.y);
    await expect(page.getByLabel('Scene item')).toHaveValue('object:box');

    await page.getByLabel('Scene item').selectOption('road:base-road');
    await page.getByRole('button', { name: 'Bring to front', exact: true }).click();
    expect((await drawn()).at(-1)).toBe('road:base-road');
    await expect(page.getByRole('button', { name: 'Bring to front', exact: true })).toBeDisabled();
    await page.mouse.click(origin.x, origin.y, { button: 'right' });
    await expect(page.getByLabel('Scene item')).toHaveValue('road:base-road');
    await page.getByRole('menuitem', { name: 'Send to back', exact: true }).click();
    expect((await drawn())[0]).toBe('road:base-road');
    await expect(page.getByRole('button', { name: 'Send to back', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await drawn()).at(-1)).toBe('road:base-road');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await drawn()).toEqual(merged);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    const finalOrder = await drawn();
    const exported = await exportMap(page);
    expect(exported.editorOrder).toEqual(finalOrder);
    await page.reload();
    await expect.poll(drawn).toEqual(finalOrder);
    await importMap(page, exported);
    await expect.poll(drawn).toEqual(finalOrder);
    expect((await savedDraft(page)).objects).toEqual(draft.objects);
});

test('context layering matches scene order, persists with history, and exposes inspector actions', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    const draft = await savedDraft(page);
    draft.objects = [
        { id: 'underneath', asset: 'box', position: [0, 0, 0], heading: 0, body: 'dynamic', mass: 16 },
        { id: 'on-top', asset: 'cone', position: [0, 0, 0], heading: 0, body: 'dynamic', mass: 8 }
    ];
    await importMap(page, draft);
    await expect.poll(async () => (await savedDraft(page)).objects.length).toBe(2);
    const origin = await gridPoint(page, 0, 0);
    const context = async () => { await page.mouse.click(origin.x, origin.y, { button: 'right' }); };
    await context();
    await expect(page.getByLabel('Scene item')).toHaveValue('object:on-top');
    await page.getByRole('menuitem', { name: 'Send backward', exact: true }).click();
    const order = (await savedDraft(page)).editorOrder!;
    expect(order.indexOf('object:on-top')).toBeLessThan(order.indexOf('object:underneath'));
    expect((await savedDraft(page)).objects).toEqual(draft.objects);
    const drawn = await page.locator('svg [data-kind="object"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-item-id')));
    expect(drawn).toEqual(['on-top', 'underneath']);
    await page.locator('.scene-list summary').click();
    const listed = await page.locator('.scene-list button[aria-label^="Focus "]').allTextContents();
    expect(listed.indexOf('underneath')).toBeLessThan(listed.indexOf('on-top'));
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await savedDraft(page)).editorOrder).toBeUndefined();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect((await savedDraft(page)).editorOrder).toEqual(order);
    await page.reload();
    await expect(page).toHaveURL(/\/builder$/);
    expect((await savedDraft(page)).editorOrder).toEqual(order);
    // Imported ordering must use the same parser as exported/reloaded maps.
    const ordered = await savedDraft(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, ordered);
    await expect.poll(async () => (await savedDraft(page)).editorOrder).toEqual(order);
    const point = await gridPoint(page, 0, 0);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect(page.getByLabel('Scene item')).toHaveValue('object:underneath');
    await page.getByRole('menuitem', { name: 'Lock', exact: true }).click();
    await expect(page.getByLabel('Lock selected item')).toBeChecked();
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Send backward', exact: true })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeDisabled();
    await page.getByRole('menuitem', { name: 'Unlock', exact: true }).click();
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Hide in editor', exact: true }).click();
    await expect(page.getByLabel('Hide selected item')).toBeChecked();
    await expect(page.locator('svg [data-item-id="underneath"]')).toHaveCount(0);
    expect((await savedDraft(page)).objects).toEqual(draft.objects);
});

test('builder previews, context actions, handles, locks and editor-only hiding', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
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
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Deselect', exact: true }).click();
    await expect(page.getByLabel('Scene item')).toHaveValue('');
    await page.getByLabel('Scene item').selectOption('object:cone-1');
    await page.getByRole('img', { name: 'Level drafting grid', exact: true }).focus();
    await page.keyboard.press('ControlOrMeta+d');
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
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Duplicate & place', exact: true }).click();
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
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeDisabled();
    expect(errors).toEqual([]);
});

test('playable zone validates footprints, resizes with history and survives export/import', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
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
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    await importMap(page, draft);
    await expect.poll(() => savedDraft(page)).toEqual(draft);
    await importMap(page, { ...draft, playerVehicle: 'unknown' });
    await expect(page.getByRole('alert')).toHaveText('Unsupported player vehicle.');
    expect(await savedDraft(page)).toEqual(draft);
    await importMap(page, { ...draft, playableZone: { ...draft.playableZone, width: -1 } });
    await expect(page.getByRole('alert')).toHaveText(/playableZone.width must be a finite number/);
    expect(await savedDraft(page)).toEqual(draft);
});

for (const [vehicle, length, wheelbase, scale] of [
    ['suv', 2.7, 1.32, 4.2 / 2.55],
    ['taxi', 2.75, 1.52, 4.2 / 2.55],
    ['hatchbackSports', 2.85, 1.62, 3.9 / 2.85],
    ['sedanSports', 2.55, 1.32, 4.2 / 2.55],
    ['van', 2.75, 1.52, 4.2 / 2.55],
    ['pickup', 2.95, 1.62, 4.2 / 2.55]
] as const) {
    test(`${vehicle} test drive uses matching geometry, hits the boundary, resets and parks`, async ({ page }) => {
        await openBuilder(page);
        await page.getByRole('button', { name: 'Reset map', exact: true }).click();
        await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
        await page.getByRole('button', { name: `Drive ${vehicle}`, exact: true }).click();
        const selected = page.getByRole('button', { name: `Drive ${vehicle}`, exact: true });
        await expect(selected).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => selected.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Add playable zone', exact: true }).click();
        await page.getByLabel('Scene item').selectOption('spawn:spawn');
        await page.getByLabel('Hide selected item').check();
        const draft = await exportMap(page);
        expect(draft.playerVehicle).toBe(vehicle);
        await importMap(page, draft);
        await expect.poll(() => savedDraft(page)).toEqual(draft);
        await page.getByRole('button', { name: 'Test drive', exact: true }).click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        const initial = await snapshot(page);
        expect(initial.level.playerVehicle).toBe(vehicle);
        expect(initial.level.playableZone).toEqual(draft.playableZone);
        expect(initial.vehicle.length).toBeCloseTo(length * scale, 4);
        expect(initial.vehicle.wheelbase).toBeCloseTo(wheelbase * scale, 4);
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
        await page.keyboard.down('s');
        await expect.poll(async () => (await snapshot(page)).car[2]).toBeLessThan(4);
        await page.keyboard.up('s');
        await page.keyboard.press('r');
        await teleport(page, draft.bay.x, draft.bay.z, draft.bay.heading);
        await expect.poll(async () => (await snapshot(page)).phase).toBe('won');
        await leaveGame(page, 'Back to builder');
        expect(await exportMap(page)).toEqual(draft);
    });
}

test('builder snaps roads and props, edits with history, exports/imports, and restores local drafts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openBuilder(page);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
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
    await page.getByRole('tab', { name: 'Map settings', exact: true }).click();
    await expect(page.getByText('road-1 and road-2: lanes do not connect.', { exact: true })).toBeVisible();
    const exported = await exportMap(page);
    expect(exported).toEqual(await savedDraft(page));
    expect(exported.schemaVersion).toBe(1);
    expect(exported.objects[0].heading).toBe(90);
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
    expect((await savedDraft(page)).objects).toHaveLength(0);
    await importMap(page, exported);
    await expect(page.getByLabel('Level name', { exact: true })).toHaveValue('Workshop lot');
    expect(await savedDraft(page)).toEqual(exported);
    await page.reload();
    await expect(page).toHaveURL(/\/builder$/);
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
    await page.getByRole('button', { name: 'Reset map', exact: true }).click();
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
    await page.getByRole('button', { name: 'Start', exact: true }).click();
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
    await leaveGame(page, 'Back to builder');
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
    expect(await exportMap(page)).toEqual(draft);
    expect(await page.evaluate(() => '__parkTest' in window)).toBe(false);
    await page.getByRole('button', { name: 'Test drive', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    expect((await snapshot(page)).remaining).toBe(90);
    expect((await snapshot(page)).impacts).toBe(0);
    expect((await snapshot(page)).car[2]).toBeCloseTo(5, 2);
    expect(errors).toEqual([]);
});
