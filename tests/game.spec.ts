import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Snapshot = {
    phase: string;
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
    await page.mouse.move(550, 400);
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
    await page.mouse.move(900, 400);
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
    expect(restarted.remaining).toBeGreaterThan(89);
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
