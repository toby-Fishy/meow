import { defineConfig } from '@playwright/test';

/**
 * `CHROMIUM_PATH` lets a sandbox point at a preinstalled browser instead of
 * downloading one; unset, Playwright uses its own.
 */
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4321',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    timeout: 120_000,
    // Reusing a server that is serving a stale dist is a real trap: rebuild
    // first, or stop the running preview, before trusting a green run.
    reuseExistingServer: !process.env.CI,
  },
});
