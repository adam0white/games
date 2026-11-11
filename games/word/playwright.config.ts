import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 360, height: 690 } } },
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'phone-webkit', use: { browserName: 'webkit', viewport: { width: 360, height: 690 } } },
    { name: 'desktop-webkit', use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
