import { expect, type Locator, test } from '@playwright/test';

async function visibleBeforeClick(target: Locator) {
  const result = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const points: [number, number][] = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 4, r.top + 4],
      [r.right - 4, r.bottom - 4],
      [r.right - 4, r.top + 4],
      [r.left + 4, r.bottom - 4],
    ];
    return (
      r.top >= 0 &&
      r.left >= 0 &&
      r.bottom <= innerHeight &&
      r.right <= innerWidth &&
      points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit === el || el.contains(hit);
      })
    );
  });
  expect(result).toBe(true);
}

test('first decisions show a real reply without reading story text', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('his-word-notice-v1', '1');
  });
  await page.goto('/');
  let step = 0;
  for (const name of [
    'Put the notebook on the table',
    'Hear what someone needs',
    'Ask Halil about the work',
  ]) {
    const target = page.getByRole('button', { name: new RegExp(name) });
    await page.screenshot({ path: test.info().outputPath(`before-${step++}.png`) });
    await visibleBeforeClick(target);
    await visibleBeforeClick(page.getByRole('button', { name: 'Skip guide' }));
    await target.click();
  }
  await expect(page.locator('blockquote')).toBeVisible();
  await expect(page.locator('blockquote')).not.toBeEmpty();
  await expect(page.getByText('22 minutes before Osman leaves')).toBeVisible();
  await page.getByRole('button', { name: /Hear what someone needs/ }).click();
  await expect(page.getByRole('button', { name: 'Skip guide' })).toHaveCount(0);
});

test('skip and menu replay guide on a fresh meeting', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('his-word-notice-v1', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('button', { name: 'Skip guide' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Replay guide' }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.getByRole('button', { name: 'Skip guide' })).toBeVisible();
});

test('guide controls remain keyboard reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('his-word-notice-v1', '1'));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip guide' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Put the notebook/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Hear what someone needs/ })).toBeVisible();
});

test('back from guide replay does not change a later new game', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('his-word-notice-v1', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Replay guide' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.getByRole('button', { name: 'Skip guide' })).toHaveCount(0);
});

test('alternate agreement path restores story before choices', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('his-word-notice-v1', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: /Put the notebook/ }).click();
  await page.getByRole('button', { name: /Write an agreement/ }).click();
  await expect(page.getByRole('button', { name: 'Skip guide' })).toHaveCount(0);
  expect(
    await page.locator('main').evaluate((el) => {
      const prose = el.querySelector('.prose');
      const choices = el.querySelector('.choices');
      return (
        !!prose && !!choices && !!(prose.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);
});
