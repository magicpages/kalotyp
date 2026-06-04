import { defineConfig, devices } from '@playwright/test';

const ghostBaseUrl = process.env.GHOST_BASE_URL ?? 'http://localhost:2368';
const kalotypAssetsUrl = process.env.KALOTYP_ASSETS_URL ?? 'http://localhost:5174';
const axeHostUrl = process.env.KALOTYP_AXE_HOST_URL ?? 'http://localhost:5175';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ghostBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Re-runs the axe spec under an iPhone 13 profile (390×844) to
    // catch narrow-viewport-specific violations (mobile-only styles,
    // touch-target sizing, focus-ring obscuration). Uses chromium so
    // CI only installs one engine; axe checks DOM/ARIA, not engine
    // rendering.
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
      },
      testMatch: /axe\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      // Serves packages/ghost/dist so Ghost can fetch /kalotyp.js + .css.
      command:
        'pnpm --filter @magicpages/kalotyp-ghost-test exec http-server ../../packages/ghost/dist -p 5174 --cors -s',
      url: kalotypAssetsUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Serves the axe host page, which loads the same bundle Ghost
      // would and exposes `window.openEditor()` so specs can drive
      // panels without a real Ghost instance.
      command:
        'pnpm --filter @magicpages/kalotyp-ghost-test exec http-server ./tests/fixtures/axe-host -p 5175 --cors -s',
      url: axeHostUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
