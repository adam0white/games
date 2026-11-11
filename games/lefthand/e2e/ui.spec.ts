import { expect, test } from "@playwright/test";

// Exercise DOM and host scheduling without starting a Godot renderer.
test("controls, clock, pause menu and desktop evening fit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1" });
    localStorage.setItem("lefthand-notice-v1", "1");
  });
  await page.route("**/engine.json", (route) =>
    route.fulfill({
      json: { executable: "stub", script: "/stub-engine.js", pack: "stub" },
    }),
  );
  await page.route("**/stub-engine.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.Engine = class { async startGame() { window.HFBridge.ready(); } };",
    }),
  );
  await page.clock.install();
  await page.goto("/lefthand/");
  await expect(page.locator("#loading")).toBeHidden();
  if ((page.viewportSize()?.width ?? 0) > 480) {
    const bottom = await page
      .locator(".village")
      .evaluate((node) => node.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  }
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  // The first-visit notice is part of the height budget at both retest sizes.
  await page.locator("#recording-notice").evaluate((node) => {
    (node as HTMLElement).hidden = false;
  });
  await page.locator("#route-door").click();
  await page.clock.runFor(100);
  await expect(page.locator("#lantern")).toHaveText("Lantern lit · hide (L)");
  const arrowsBefore = await page.locator(".directions").boundingBox();
  expect(arrowsBefore).not.toBeNull();
  expect(
    (arrowsBefore?.y ?? 0) + (arrowsBefore?.height ?? 0),
  ).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  const lanternBefore = await page.locator("#lantern").boundingBox();
  const actBefore = await page.locator("#act").boundingBox();
  expect(lanternBefore?.y).toBe(actBefore?.y);
  await page.locator("#lantern").click();
  await page.clock.runFor(100);
  await expect(page.locator("#lantern")).toHaveText(
    "Lantern hidden · light (L)",
  );
  const arrowsAfter = await page.locator(".directions").boundingBox();
  expect(arrowsBefore).not.toBeNull();
  expect(arrowsAfter).not.toBeNull();
  if (!arrowsBefore || !arrowsAfter)
    throw new Error("Missing direction controls");
  for (const dimension of ["x", "y", "width", "height"] as const)
    expect(
      Math.abs(arrowsAfter[dimension] - arrowsBefore[dimension]),
    ).toBeLessThan(1);
  const lanternAfter = await page.locator("#lantern").boundingBox();
  const actAfter = await page.locator("#act").boundingBox();
  expect(lanternAfter?.y).toBe(actAfter?.y);
  const before = await page.evaluate(
    () => window.Lefthand.snapshot().nightTick,
  );
  // Uneven callback times must retain fractional tick time instead of losing it.
  for (let i = 0; i < 80; i++) await page.clock.fastForward(115);
  const after = await page.evaluate(() => window.Lefthand.snapshot().nightTick);
  expect(after - before).toBeGreaterThanOrEqual(91);
  expect(after - before).toBeLessThanOrEqual(93);
  // About nine hidden seconds empty part of the warmth bar beside the lantern.
  await expect(page.locator("#cold-warning")).toContainText("hidden");
  const warmth = await page
    .locator("#warmth-fill")
    .evaluate((node) => Number.parseFloat((node as HTMLElement).style.width));
  expect(warmth).toBeGreaterThan(70);
  expect(warmth).toBeLessThan(90);
  await page.locator("#menu-open").click();
  await expect(page.locator("#menu")).toHaveCSS(
    "background-color",
    "rgb(16, 28, 41)",
  );
  await expect(page.locator("#debug")).not.toHaveAttribute("open", "");
  await expect(page.locator("#download")).toBeVisible();
  await expect(page.locator("#verify")).toBeHidden();
  await page.locator("#debug summary").click();
  await expect(page.locator("#verify")).toBeVisible();
  await page.locator("#verify").click();
  await expect(page.locator("#menu-status")).toContainText("Replay verified:");
  const paused = await page.evaluate(
    () => window.Lefthand.snapshot().nightTick,
  );
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.Lefthand.snapshot().nightTick)).toBe(
    paused,
  );
  await page.locator("#menu-close").click();
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  await page.clock.runFor(100);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
});

test("Play again describes a different seeded opening", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1" });
    localStorage.setItem("lefthand-notice-v1", "1");
    // Repeated entropy reproduces the old same-opening bug deterministically.
    crypto.getRandomValues = ((array: Uint32Array) => {
      array.fill(17);
      return array;
    }) as typeof crypto.getRandomValues;
  });
  await page.route("**/engine.json", (route) =>
    route.fulfill({
      json: { executable: "stub", script: "/stub-engine.js", pack: "stub" },
    }),
  );
  await page.route("**/stub-engine.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.Engine = class { async startGame() { window.HFBridge.ready(); } };",
    }),
  );
  await page.clock.install();
  await page.goto("/lefthand/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const before = await page.evaluate(() => window.Lefthand.snapshot().seed);
  for (let night = 1; night <= 3; night++) {
    await page.locator("#route-well").click();
    await page.clock.runFor(61000);
    await expect(page.locator("#morning")).toBeVisible();
    await page.locator("#next").click();
    await page.clock.runFor(100);
  }
  await expect(page.locator("#ending")).toBeVisible();
  await page.locator("#again").click();
  await expect(page.locator("#evening")).toBeVisible();
  const after = await page.evaluate(() => window.Lefthand.snapshot().seed);
  expect(after).not.toBe(before);
  expect(after & 3).toBe((before ^ 3) & 3);
  await expect(page.locator("#status")).toContainText("Tariq walks");
  await expect(page.locator("#status")).toContainText("first neighbour");
});
