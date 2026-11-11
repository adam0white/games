import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5179", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: !process.env.CI,
  },
  projects: ["chromium", "webkit"].flatMap((browserName) => [
    {
      name: `${browserName}-phone`,
      use: {
        browserName: browserName as "chromium" | "webkit",
        viewport: { width: 360, height: 690 },
      },
    },
    {
      name: `${browserName}-desktop`,
      use: {
        browserName: browserName as "chromium" | "webkit",
        viewport: { width: 1280, height: 800 },
      },
    },
  ]),
});
