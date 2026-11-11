import { expect, test } from "@playwright/test";

test("file view replays the current export without native storage or Lab", async ({
  browser,
  baseURL,
}) => {
  const native = await browser.newContext({ baseURL });
  const page = await native.newPage();
  await page.route("https://human.adamwhite.work/**", (route) => route.abort());
  await page.goto("/days/");
  await page.getByRole("button", { name: "Begin the three days" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Export this play" }).click();
  const saved = await page.locator("#export-data").inputValue();
  const fileContext = await browser.newContext({ baseURL });
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
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Unexpected sessionStorage access");
      },
    });
  });
  const viewer = await fileContext.newPage();
  const errors: string[] = [];
  const external: string[] = [];
  viewer.on("pageerror", (error) => errors.push(error.message));
  await viewer.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== new URL(baseURL!).origin) {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await viewer.goto("/days/file/");
  await viewer.getByRole("button", { name: "Begin the three days" }).click();
  await viewer.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(viewer.getByRole("button", { name: "Feedback", exact: true })).toBeDisabled();
  await expect(viewer.getByRole("checkbox", { name: "Recording" })).toBeDisabled();
  await viewer
    .getByLabel("Open saved play")
    .setInputFiles({ name: "days.json", mimeType: "application/json", buffer: Buffer.from(saved) });
  await expect(viewer.locator("#save-notice")).toContainText("File view");
  await viewer.getByRole("button", { name: "Menu", exact: true }).click();
  await viewer.getByRole("button", { name: "Export this play" }).click();
  expect(JSON.parse(await viewer.locator("#export-data").inputValue())).toEqual(JSON.parse(saved));
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await fileContext.close();
  await native.close();
});
