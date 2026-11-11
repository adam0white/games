import { expect, type Locator, test } from '@playwright/test';

async function visibleTogether(cue: Locator, target: Locator) {
  for (const locator of [cue, target]) {
    const result = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
        clear: [
          [r.left + 2, r.top + 2],
          [r.right - 2, r.top + 2],
          [r.left + 2, r.bottom - 2],
          [r.right - 2, r.bottom - 2],
          [r.left + r.width / 2, r.top + r.height / 2],
        ].every(([x, y]) => {
          const hit = document.elementFromPoint(x!, y!);
          return hit === el || (!!hit && el.contains(hit));
        }),
      };
    });
    expect(result).toEqual({ inView: true, clear: true });
  }
}

test('tutorial follows real choices and can be skipped and replayed', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.locator('#start').click();
  const cue = page.locator('#tutorial');
  const resident = page.locator('.people button:not(:disabled)').first();
  await expect(cue).toContainText('neighbour');
  await visibleTogether(cue, resident);
  await page.locator('#tutorial-skip').focus();
  await page.waitForTimeout(300);
  await expect(page.locator('#tutorial-skip')).toBeFocused();
  await resident.click();
  await expect(cue).toContainText('near');
  await expect(page.locator('[data-action="come"]')).toBeEnabled({ timeout: 30000 });
  await expect(cue).toContainText('say');
  await visibleTogether(cue, page.locator('[data-action="come"]'));
  await page.locator('[data-action="come"]').click();
  await expect(cue).toContainText('Read their answer.');
  const currentLine = await page.evaluate(() => {
    const game = window.smoke.getState();
    return game.people.find(
      (p) => p.id === document.querySelector('.people button.active')?.getAttribute('data-id'),
    )?.line;
  });
  await expect(page.locator('#line')).toContainText(currentLine!);
  await visibleTogether(cue, page.locator('#line'));
  await page.locator('#tutorial-skip').click();
  await expect(cue).toBeHidden();
  await page.locator('#menu').click();
  await page.locator('#tutorial-replay').click();
  await expect(cue).toBeVisible();
  await page.locator('#menu').click();
  await page.locator('#resume').click();
  await expect(cue).toBeVisible();
});

test('interrupting the guide does not reset the run or strand another selection', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.locator('#start').click();
  await page.locator('[data-id="sevim"]').click();
  await expect(page.locator('#tutorial')).toContainText('near');
  await page.locator('#menu').click();
  await expect(page.locator('#resume')).toBeVisible();
  const tick = await page.evaluate(() => window.smoke.getState().tick);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.smoke.getState().tick)).toBe(tick);
  await page.locator('#resume').click();
  await page.locator('[data-id="derya"]').click();
  await expect(page.locator('#tutorial')).toContainText('near');
  await expect(page.locator('[data-id="derya"]')).toHaveClass(/tutorial-target/);
  expect(await page.evaluate(() => window.smoke.getState().tick)).toBeGreaterThanOrEqual(tick);
});

test('a speech click immediately acknowledges that its request is queued', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.locator('#start').click();
  await page.locator('[data-id="sevim"]').click();
  await expect(page.locator('[data-action="books"]')).toBeEnabled({ timeout: 30000 });
  const immediate = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-action="books"]')!.click();
    return document.querySelector('#line')!.textContent;
  });
  expect(immediate).toContain('Request queued');
  await expect(page.locator('#line')).toContainText(/tie|bundle/, { timeout: 10000 });
});

test('a repeated request keeps the actual reply visible after it is checked', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.locator('#start').click();
  await page.locator('[data-id="sevim"]').click();
  const action = page.locator('[data-action="come"]');
  await expect(action).toBeEnabled({ timeout: 30000 });
  await page.locator('#tutorial-skip').click();
  let sawDeduplicatedReply = false;
  for (let i = 0; i < 4; i++) {
    const count = await page.evaluate(() => window.smoke.getState().log.length);
    await action.click();
    await expect.poll(() => page.evaluate(() => window.smoke.getState().log.length)).toBeGreaterThan(count);
    const result = await page.evaluate(() => ({
      line: document.querySelector('#line')!.textContent!,
      resident: window.smoke.getState().people.find((p) => p.id === 'sevim')!.line,
    }));
    if (result.line.includes('Request checked')) {
      sawDeduplicatedReply = true;
      expect(result.line).toContain(result.resident);
      break;
    }
  }
  expect(sawDeduplicatedReply).toBe(true);
});
