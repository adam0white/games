import { expect, test } from "@playwright/test";

test("opening choices wait for continuity and record the first action", async ({
  page,
  baseURL,
}) => {
  let releaseIdentity!: () => void;
  const identityGate = new Promise<void>((resolve) => {
    releaseIdentity = resolve;
  });
  let identityRequested!: () => void;
  const identityPending = new Promise<void>((resolve) => {
    identityRequested = resolve;
  });
  await page.route("**/*", (route) => route.abort());
  await page.route("https://play.adamwhite.work/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: new URL(`${url.pathname}${url.search}`, baseURL).href }),
    });
  });
  await page.route("https://human.adamwhite.work/lab/identity/**", async (route) => {
    identityRequested();
    await identityGate;
    await route.abort();
  });
  try {
    await page.goto("https://play.adamwhite.work/days/", { waitUntil: "domcontentloaded" });
    await identityPending;
    await page.getByRole("button", { name: "Begin with Recording off" }).click();
    const choice = page.locator("#choices .choice").first();
    await expect(choice).toBeVisible();
    await expect(choice).toBeDisabled();
    releaseIdentity();
    await expect(choice).toBeEnabled({ timeout: 10000 });
    const action = await choice.getAttribute("data-action");
    await choice.click();
    const nextChoice = page.locator("#choices .choice").first();
    await expect(nextChoice).toBeEnabled();
    const nextAction = await nextChoice.getAttribute("data-action");
    await nextChoice.click();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Export this play" }).click();
    const run = JSON.parse(await page.locator("#export-data").inputValue());
    expect(run.inputs).toEqual([action, nextAction]);
  } finally {
    releaseIdentity();
  }
});
