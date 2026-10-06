import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // Physics loads dynamically inside @playcanvas/react. Discover it before the
    // first page loads so dependency re-optimization cannot interrupt startup.
    optimizeDeps: { include: ['sync-ammo'] }
});
