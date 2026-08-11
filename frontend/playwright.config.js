import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,

  // The app holds a Socket.IO connection open, and WebKit can take tens of
  // seconds to tear a context down when all three browser projects run at once.
  // Playwright charges that teardown to the test, so 30s is not enough here.
  timeout: 60_000,

  forbidOnly: !!process.env.CI,

  // This is a heavy SPA (Socket.IO, Firebase, Maps). Playwright's default of one
  // worker per core saturates a developer machine that is also running an IDE,
  // and the resulting timeouts look like product bugs. Cap it and allow one
  // retry so genuine failures still stand out from load-induced flake.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 3,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Read-only checks — safe against any environment.
    { name: 'smoke-chromium', testDir: './e2e/smoke', use: { ...devices['Desktop Chrome'] } },
    { name: 'smoke-firefox', testDir: './e2e/smoke', use: { ...devices['Desktop Firefox'] } },
    { name: 'smoke-webkit', testDir: './e2e/smoke', use: { ...devices['Desktop Safari'] } },

    // Multi-role journeys that write to the database. One browser is enough:
    // these assert backend workflow behaviour, not rendering differences, and
    // running them three times would triple the test data created.
    { name: 'flows', testDir: './e2e/flows', use: { ...devices['Desktop Chrome'] } },
  ],

  // Skipped when E2E_BASE_URL points at an already-running or deployed app.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
})
