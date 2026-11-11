import { expect, test } from "@playwright/test";

test("file replay leaves native storage and lab untouched", async ({
  browser,
}) => {
  const native = await browser.newContext();
  const page = await native.newPage();
  await page.goto("/child/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export playtest" }).click();
  const file = await (await download).path();
  if (!file) throw new Error("Export was not downloaded");
  const fileContext = await browser.newContext();
  await fileContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Unexpected IndexedDB access");
      },
    });
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Unexpected localStorage access");
      },
    });
    Storage.prototype.setItem = () => {
      throw new Error("Unexpected storage write");
    };
  });
  const viewer = await fileContext.newPage();
  const external: string[] = [];
  await viewer.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:5179") {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await viewer.goto("/child/file/");
  await expect(viewer.locator("html")).toHaveAttribute("data-ready", "true");
  await viewer.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "Feedback", exact: true }),
  ).toBeDisabled();
  await expect(
    viewer.getByRole("button", { name: /Recording:/ }),
  ).toBeDisabled();
  await viewer.getByLabel("Replay playtest").setInputFiles(file);
  await expect(
    viewer.getByRole("heading", { name: "She watches your hands." }),
  ).toBeVisible();
  expect(external).toEqual([]);
  await fileContext.close();
  await native.close();
});
