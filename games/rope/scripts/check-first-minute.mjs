// Follow prefixed first-minute controls at the production play origin using local assets.
// This does not qualify shelf, recording or central receipt behavior.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local = new URL(process.env.ROPE_LOCAL || 'http://127.0.0.1:60073/rope/');
const native = new URL(process.env.ROPE_URL || 'https://play.adamwhite.work/rope/');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ]) {
    for (const practice of [false, true]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (!practice) {
        await page.route(`${native.origin}/**`, async (route) => {
          const url = new URL(route.request().url());
          const response = await route.fetch({ url: local.origin + url.pathname + url.search });
          await route.fulfill({ response });
        });
      }
      await page.goto(practice ? new URL('file/?tutorial=1', local).href : native.href);
      if (!practice) await page.locator('[data-a="new"]').click();
      await page.locator('[data-a="go"]').click({ timeout: 30000 });
      await page.locator('.leader-bar .verb.lit').click({ timeout: 30000 });
      await page.locator('.sheet .verb.lit').click({ timeout: 30000 });
      // The game deliberately ignores repeat taps for 450 ms after sending an input.
      await page.waitForTimeout(700);
      await page.locator('.forces .force.lit').click({ timeout: 30000 });
      await page.locator('.request-result').waitFor({ state: 'visible', timeout: 30000 });
      assert.notEqual(
        await page.locator('.request-result').getAttribute('data-input'),
        null,
        'a recorded response is visible',
      );
      assert.deepEqual(errors, []);
      if (!practice) {
        await page.getByRole('button', { name: 'Game menu' }).click();
        const replay = page.getByRole('link', { name: 'Replay tutorial in practice' });
        assert.equal(await replay.getAttribute('href'), '/rope/file/?tutorial=1');
        assert.equal(await replay.getAttribute('target'), '_blank');
      }
      await page.close();
    }
  }
  console.log(
    'Rope prefixed first-minute and practice checks passed at phone and desktop sizes; shelf and telemetry remain separate gates.',
  );
} finally {
  await browser.close();
}
