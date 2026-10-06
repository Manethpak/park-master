import { readFile } from 'node:fs/promises';
import type { MapDefinition } from '../src/game/types.ts';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Snapshot = {
    level: { id: string; name: string; spawn: { position: number[]; heading: number }; bay: { x: number; z: number; heading: number } };
    roads: { id: string; position: number[]; heading: number; dimensions: number[] }[];
    phase: string;
    hasMoved: boolean;
    remaining: number;
    score: number;
    impacts: number;
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
    await page.getByRole('button', { name: 'Let’s park' }).click();
    await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
}

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
        const canvas = (await page.locator('canvas').boundingBox())!;
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

test('mouse steering rotates the moving car, reverses naturally, and cannot rotate a stopped car', async ({ page }) => {
    await start(page);
    await teleport(page, 4, -1, 0);
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2 + 240, canvas.y + canvas.height / 2);
    await page.waitForTimeout(400);
    expect((await snapshot(page)).heading).toBeCloseTo(0, 1);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).heading).toBeGreaterThan(15);
    await page.keyboard.up('w');
    expect((await snapshot(page)).steering).toBeGreaterThan(0.8);
    await teleport(page, 4, -1, 0);
    await page.keyboard.down('s');
    await expect.poll(async () => (await snapshot(page)).heading).toBeGreaterThan(300);
    await page.keyboard.up('s');
    expect((await snapshot(page)).heading).toBeLessThan(360);
});

test('solid obstacles block movement and a sustained impact is penalized once', async ({ page }) => {
    await start(page);
    await teleport(page, 4.2, 2.2, 0);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBe(1);
    await page.waitForTimeout(1700);
    const blocked = await snapshot(page);
    expect(blocked.impacts).toBe(1);
    expect(blocked.car[2]).toBeLessThan(2.9);
    expect(blocked.score).toBeLessThan(950);
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
    await page.keyboard.up('w');
});

test('small props move on impact and restart restores their positions and the car', async ({ page }) => {
    await start(page);
    const original = (await snapshot(page)).props.find((prop) => prop.id === 'cone-2')!;
    await teleport(page, -1.5, 0.3, 180);
    await page.keyboard.down('w');
    await expect.poll(async () => (await snapshot(page)).impacts).toBeGreaterThan(0);
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
    await expect(page.getByRole('heading', { name: 'A little roadblock.' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Reload the level' })).toBeVisible();
});

async function openBuilder(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Map builder', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map builder' })).toBeVisible();
}

const savedDraft = (page: Page): Promise<MapDefinition> => page.evaluate(() => JSON.parse(localStorage.getItem('park-master.map-draft.v1')!));

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
    const canvas = (await page.locator('canvas').boundingBox())!;
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
