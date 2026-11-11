import type { Page } from 'playwright-core';

/** Explicit local saved-state fixture. This does not test shared cast admission. */
export async function localHill(page: Page) {
  await page.evaluate(`(async () => {
    const { newGame, save } = await import('/warren/src/sim/game.ts');
    const { put } = await import('/warren/src/ui/store.ts');
    await put('hill', save(newGame(7)));
  })()`);
  await page.reload();
  await page.locator('#cont').click();
  if ((await page.locator('#cell-title').textContent()) === 'While you were away')
    await page.locator('#cellx').click();
}
