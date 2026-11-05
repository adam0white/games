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
  console.log('First-minute control path, result, skip and replay passed.');
} finally {
  await browser.close();
}
