import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: 'visual-capture.spec.ts',
  // 68 full-page captures run serially so that fixture data and viewport
  // rendering remain deterministic even on a constrained CI worker.
  timeout: 180_000,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  snapshotPathTemplate: '{testDir}/../tests/visual/baseline/{arg}{ext}',
  outputDir: 'test-results/visual',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  updateSnapshots: 'none',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    colorScheme: 'light',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: { ...process.env, VITE_CAPTURE_MODE: 'true' },
  },
});
