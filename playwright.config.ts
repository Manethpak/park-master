import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: 'game.spec.ts',
    fullyParallel: false,
    workers: 1,
    timeout: 30000,
    use: {
        baseURL: 'http://127.0.0.1:5174',
        viewport: { width: 1100, height: 750 },
        trace: 'retain-on-failure',
        launchOptions: {
            executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader'
            ]
        }
    },
    webServer: {
        command: 'VITE_E2E=true pnpm dev --host 127.0.0.1 --port 5174 --strictPort',
        url: 'http://127.0.0.1:5174',
        reuseExistingServer: true
    }
});
