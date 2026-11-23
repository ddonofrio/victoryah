import { defineConfig } from '@playwright/test';

/**
 * End-to-end smoke tests of critical player journeys against the production build.
 * Uses the locally installed Google Chrome (no browser download) with software WebGL so the
 * tests also run on headless CI machines.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
