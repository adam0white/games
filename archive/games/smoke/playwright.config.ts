import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5283', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 5283 --strictPort',
    url: 'http://127.0.0.1:5283',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium-phone', use: { browserName: 'chromium', viewport: { width: 360, height: 690 } } },
    { name: 'chromium-wide', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-phone', use: { browserName: 'webkit', viewport: { width: 360, height: 690 } } },
    { name: 'webkit-wide', use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } },
  ],
});
