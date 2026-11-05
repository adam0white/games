import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:5190/');
  await page.getByText('Other ways to begin').click();
  await page.locator('[data-action=local]').click();
  await page.locator('#cg-tutorial').waitFor();
  assert.equal(await page.locator('.cg-tutorial-target[data-person]').count(), 1);
  await page.locator('.cg-tutorial-target[data-person]').click();
  assert.equal(await page.locator('.cg-tutorial-target[data-action=listen]').count(), 1);
  await page.locator('.cg-tutorial-target').click();
  assert.equal(await page.locator('.cg-tutorial-target[data-action=finish]').count(), 1);
  await page.locator('.cg-tutorial-target').click();
  assert.equal(await page.locator('.cg-tutorial-target[data-action=support]').count(), 1);
  await page.locator('.cg-tutorial-target').click();
  assert.equal(await page.locator('.cg-tutorial-target').count(), 1);
  assert.ok(await page.locator('.cg-confidence + p').textContent());
  await page.locator('#cg-tutorial button').click();
  assert.equal(await page.locator('#cg-tutorial').count(), 0);
  await page.locator('[data-action=menu]').click();
  await page.locator('[data-action=tutorial-replay]').click();
  assert.equal(await page.locator('#cg-tutorial').count(), 1);
  await page.locator('#cg-tutorial button').click();
  const automatic = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await automatic.clock.install();
  await automatic.goto('http://127.0.0.1:5190/');
  await automatic.getByText('Other ways to begin').click();
  await automatic.locator('[data-action=local]').click();
  await automatic.locator('#cg-tutorial').waitFor();
  await automatic.locator('.cg-tutorial-target[data-person]').click();
  await automatic.locator('.cg-tutorial-target[data-action=listen]').click();
  await automatic.locator('#cg-tutorial button').focus();
  await automatic.clock.runFor(3000);
  assert.equal(
    await automatic.locator('#cg-tutorial button').evaluate((button) => document.activeElement === button),
    true,
  );
  await automatic.clock.runFor(22000);
  assert.equal(await automatic.locator('.cg-tutorial-target[data-action=support]').count(), 1);
  await automatic.close();
  const refusal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await refusal.goto('http://127.0.0.1:5190/');
  await refusal.getByText('Other ways to begin').click();
  await refusal.locator('[data-action=local]').click();
  await refusal.locator('#cg-tutorial').waitFor();
  await refusal.locator('.cg-tutorial-target[data-person]').click();
  await refusal.locator('[data-action=pry]').click();
  assert.equal(await refusal.locator('.cg-tutorial-target.cg-notice').count(), 1);
  assert.equal(await refusal.locator('[data-action=finish]').count(), 0);
  await refusal.close();
  console.log('First-minute choices, refusal, automatic completion, result, skip and replay passed.');
} finally {
  await browser.close();
}
