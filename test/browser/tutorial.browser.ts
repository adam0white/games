import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('first minute uses only controls to change the real staffing plan', async ({ page }) => {
      await page.goto('/');
      await page.locator('#new').click();
      await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
      await page.locator('.board-change').first().click();
      await expect(page.locator('[data-tutorial-step="station"]')).toBeVisible();
      await page.locator('[data-field="station"][data-value="cold"]').click();
      await expect(page.locator('[data-tutorial-step="break"]')).toBeVisible();
      await page.locator('[data-field="break"][aria-pressed="false"]').first().click();
      await expect(page.locator('[data-tutorial-step="cover"]')).toBeVisible();
      await page.locator('[data-field="cover"][data-value=""]').click();
      await expect(page.locator('[data-tutorial-step="done"]')).toBeVisible();
      await expect(page.locator('.tutorial-plan [data-gap="true"]')).toBeVisible();
      await page.locator('#board-done').click();
      await page.locator('#ask-board').click();
      await expect(page.locator('[data-tutorial-step="open"]')).toBeVisible();
      await page.locator('#open-service').click();
      await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
      await page.locator('[data-pick]').first().click();
      await expect(page.locator('[data-tutorial-step="ask"]')).toBeVisible();
      await page.locator('#close').click();
      await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
      await page.locator('[data-pick]').first().click();
      await page.locator('[data-v]:not([disabled])').first().click();
      await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible();
      await page.locator('#close').click();
      await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible();
      await expect(page.locator('[data-tutorial-finish]')).toHaveCount(0);
      await page.locator('[data-pick]').first().click();
      await page.locator('[data-tutorial-finish]').click();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
      await page.locator('[data-tutorial-skip]').click();
      await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    });

    test('practice replay before starting and after dismissing an editor stays visible and skippable', async ({
      page,
    }) => {
      await page.goto('/');
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
      await page.locator('#new').click();
      await page.locator('.board-change').first().click();
      await expect(page.locator('[data-tutorial-step="station"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
      await expect(page.locator('.tutorial-stakes meter')).toBeVisible();
      await page.locator('[data-tutorial-skip]').click();
      await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    });
  });
}
