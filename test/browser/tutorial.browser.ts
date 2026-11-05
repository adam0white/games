import { expect, test } from '@playwright/test';

// Preserve a seed when a native startup fails before the guide can render.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const seed = await page
    .evaluate(() => (window as unknown as { __pass?: { state?: { seed: number } } }).__pass?.state?.seed)
    .catch(() => undefined);
  if (seed !== undefined)
    await info.attach('failed-kitchen-seed', {
      body: JSON.stringify({ seed }),
      contentType: 'application/json',
    });
});

for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('first minute uses only controls to change the real staffing plan', async ({ page }) => {
      await page.goto('/?lab=1');
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
      await page.evaluate(() => {
        const game = (window as unknown as { __pass: { state: { till: number }; draw(): void } }).__pass;
        game.state.till = 321;
        game.draw();
      });
      await expect(page.locator('.tutorial-stakes meter')).toHaveAttribute('value', '321');
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

    test('menu replay keeps an unsubmitted plan and opening directly still teaches service', async ({
      page,
    }) => {
      await page.goto('/');
      await page.locator('#new').click();
      await page.locator('.board-change').first().click();
      await page.locator('[data-field="station"][data-value="cold"]').click();
      await page.locator('[data-field="break"][aria-pressed="false"]').first().click();
      const chosenBreak = await page
        .locator('[data-field="break"][aria-pressed="true"]')
        .getAttribute('data-value');
      await page.locator('#board-done').click();
      await expect(page.locator('#ask-board')).toBeVisible();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expect(page.locator('#ask-board')).toBeVisible();
      await page.locator('.board-change').first().click();
      await expect(page.locator('[data-field="station"][data-value="cold"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator(`[data-field="break"][data-value="${chosenBreak}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.locator('#board-done').click();
      await page.locator('#ask-board').click();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await page.locator('#open-service').click();
      await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
      await page.locator('[data-tutorial-skip]').click();
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

test('starting a new kitchen resets a replayed guide after an earlier skip', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await page.locator('[data-tutorial-skip]').click();
  await page.locator('#open-service').click();
  await page.locator('#game-menu').click();
  await page.locator('#menu-tutorial').click();
  await page.locator('[data-pick]').first().click();
  await page.locator('[data-v]:not([disabled])').first().click();
  await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible();
  await page.locator('#game-menu').click();
  await page.locator('#menu-new').click();
  await page.locator('#menu-new-yes').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});

// DOM-only phase control: this isolates guide recovery, not native night progression.
test('unfinished service practice remains dismissible at evening and the next board', async ({ page }) => {
  await page.goto('/');
  for (const serviceStep of ['crew', 'waiting', 'result']) {
    await page.evaluate(async (phase) => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML =
        '<main class="people-service"><button data-pick="selim" aria-pressed="true">Selim</button><div class="panel-reply"></div></main>';
      teaching.beginTeaching('service', true);
      if (phase !== 'crew') {
        document.querySelector<HTMLButtonElement>('[data-pick]')?.click();
        teaching.teachingRequestSent(() => phase === 'result', 'selim');
      }
      teaching.refreshTeaching();
      teaching.mountTeaching();
    }, serviceStep);
    await expect(page.locator(`[data-tutorial-step="${serviceStep}"]`)).toBeVisible();
    await page.evaluate(async () => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML = '<button id="open">Open on Friday</button>';
      teaching.mountTeaching();
    });
    await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-skip]')).toBeVisible();
    await page.evaluate(async () => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML = '<button class="board-change">Change Selim’s plan</button>';
      teaching.mountTeaching();
    });
    await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
    await page.locator('[data-tutorial-skip]').click();
    await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
  }
});

test('native closing time keeps unfinished practice on the evening continuation', async ({ page }) => {
  await page.addInitScript(() => {
    Date.now = () => 42;
    Math.random = () => 0;
  });
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await page.locator('#open-service').click();
  await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
  // Advance real native minutes, not a fabricated phase or report. The ordinary frame closes service.
  await page.evaluate(() => {
    const game = (window as unknown as { __pass: { step(n: number): void } }).__pass;
    game.step(600);
  });
  await expect(page.locator('#open')).toBeVisible();
  await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
  await page.locator('#open').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});

test('replaying practice from the saved-game title points to Resume', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('.board-change').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('#cont')).toBeVisible();
  await page.locator('#game-menu').click();
  await page.locator('#menu-tutorial').click();
  await expect(page.locator('#cont')).toHaveClass(/teaching-target/);
  await page.locator('#cont').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});
