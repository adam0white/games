import { expect, test } from "@playwright/test";

test("published lab client requests scoped release metadata", async ({ page, baseURL }) => {
  const manifests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://play.adamwhite.work") return route.abort();
    if (url.pathname.endsWith("/release.json")) {
      manifests.push(url.pathname);
      return route.fulfill({
        json: {
          game: "days",
          app: "0.1.0",
          framework: "4.17.0",
          commit: "0".repeat(40),
          dirty: false,
        },
      });
    }
    const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  try {
    await page.goto("https://play.adamwhite.work/days/");
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeEnabled();
    await expect.poll(() => manifests.length).toBeGreaterThan(0);
    expect(manifests).toEqual(["/days/release.json"]);
  } finally {
    // Finish in-flight fetch/fulfill handlers before Playwright disposes their responses.
    await page.unrouteAll({ behavior: "wait" });
  }
});
