import { expect, type Locator, test } from "@playwright/test";

async function hit(locator: Locator) {
  const result = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(12, r.width / 4),
      y = Math.min(12, r.height / 4);
    const points: [number, number][] = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + x, r.top + y],
      [r.right - x, r.top + y],
      [r.left + x, r.bottom - y],
      [r.right - x, r.bottom - y],
    ];
    const unobscured = points.every(([px, py]) => {
      const top = document.elementFromPoint(px, py);
      return !!top && (top === el || el.contains(top));
    });
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.left >= 0 &&
      r.top >= 0 &&
      r.right <= innerWidth &&
      r.bottom <= innerHeight &&
      unobscured
    );
  });
  expect(result).toBe(true);
}

test("first delivery guide waits for real choices and can replay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1" });
    localStorage.setItem("lefthand-notice-v1", "1");
  });
  if (!process.env.REAL_RENDERER) {
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
  }
  await page.goto("/lefthand/");
  const guide = page.locator("#guide");
  const skip = page.locator("#guide-skip");
  await expect(page.locator("#loading")).toBeHidden();
  await hit(guide);
  await hit(skip);
  await hit(page.locator("#route-door"));
  await page.locator("#route-door").click();
  await expect(page.locator("#night")).toBeVisible();
  await hit(guide);
  await hit(skip);
  await hit(page.locator('[data-move="0,-1"]'));
  const before = await page.evaluate(() => window.Lefthand.snapshot().player);
  await page.locator('[data-move="0,-1"]').click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.Lefthand.snapshot().player)).y,
    )
    .not.toBe(before.y);
  await hit(guide);
  await hit(skip);
  await hit(page.locator("#lantern"));
  await page.locator("#lantern").click();
  await expect(page.locator("#guide-continue")).toBeVisible();
  await expect(page.locator("#lantern")).toContainText("hidden");
  await page.locator("#guide-continue").click();
  await expect(guide).toBeHidden();
  await page.locator("#menu-open").click();
  await page.locator("#guide-replay").click();
  await expect(guide).toBeVisible();
  await page.locator("#guide-skip").click();
  await expect(guide).toBeHidden();
});

test("loading makes unavailable controls clear until the village is ready", async ({
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
      body: "window.Engine = class { async startGame() { window.finishLoading = () => window.HFBridge.ready(); } };",
    }),
  );
  await page.goto("/lefthand/");
  await page.locator("#route-door").click();
  await expect(page.locator("#lantern")).toBeDisabled();
  await expect(page.locator('[data-move="0,-1"]')).toBeDisabled();
  await expect(page.locator("#guide-skip")).toBeEnabled();
  await expect(page.locator("#guide-text")).toContainText("loading");
  await page.evaluate(() =>
    (window as unknown as { finishLoading(): void }).finishLoading(),
  );
  await expect(page.locator("#lantern")).toBeEnabled();
});

test("the game starts and guide controls work when storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    Object.defineProperty(navigator, "doNotTrack", { value: "1" });
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
  await page.goto("/lefthand/");
  await expect(page.locator("#guide")).toBeVisible();
  await page.locator("#guide-skip").click();
  await expect(page.locator("#guide")).toBeHidden();
  await page.locator("#menu-open").click();
  await page.locator("#guide-replay").click();
  await expect(page.locator("#guide")).toBeVisible();
});
