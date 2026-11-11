import { expect, test } from "@playwright/test";

test("guides actual choices without reading the story", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addLocatorHandler(
    page.getByRole("complementary", { name: "Play recording" }),
    async () => {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    },
  );
  await page.goto("/child/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const cue = page.locator("[data-guide-cue]");
  const target = page.locator("[data-guide-target]");
  await expect(cue).toBeVisible();
  for (const element of [cue, target, page.locator("[data-guide-skip]")]) {
    expect(
      await element.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          (hit === el || el.contains(hit))
        );
      }),
    ).toBe(true);
  }
  for (let i = 0; i < 3; i++) {
    await expect(cue).toContainText(`${3 - i} left`);
    await page.locator("[data-guide-target]").click();
    for (const element of [cue, target, page.locator("[data-guide-skip]")]) {
      const box = await element.boundingBox();
      expect(
        box && box.y >= 0 && box.y + box.height <= page.viewportSize()!.height,
      ).toBe(true);
    }
  }
  await expect(page.locator("[data-guide-target]")).toContainText("Let her go");
  await page.locator("[data-guide-target]").click();
  await expect(page.locator("[data-guide-result]")).toBeVisible();
  await page.locator("[data-guide-skip]").click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Replay guide", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replay guide", exact: true }).click();
  await expect(cue).toBeVisible();
});
