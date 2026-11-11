import { expect, test } from "@playwright/test";

test("published lab client requests scoped release metadata", async ({
  page,
}) => {
  const manifests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://play.adamwhite.work") return route.abort();
    if (url.pathname.endsWith("/release.json")) {
      manifests.push(url.pathname);
      return route.fulfill({
        json: {
          game: "child",
          app: "0.1.0",
          framework: "4.17.0",
          commit: "0".repeat(40),
          dirty: false,
        },
      });
    }
    const response = await route.fetch({
      url: `http://127.0.0.1:5179${url.pathname}${url.search}`,
    });
    return route.fulfill({ response });
  });
  await page.goto("https://play.adamwhite.work/child/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => manifests.length).toBeGreaterThan(0);
  expect(manifests).toEqual(["/child/release.json"]);
});
