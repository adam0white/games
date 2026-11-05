// A first-time player follows visible controls and never reads body copy.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(process.env.STAIRWELL_TEST_URL ?? 'http://127.0.0.1:5179/');
  await page.locator('[data-work-start]').check();
  await page.locator('[data-a=new]').click();
  await page.locator('.tutorial-prompt').waitFor({ timeout: 30000 });
  await page.locator('[data-tab=orders]').click();
  const order = page.locator('.tutorial-target[data-t]');
  await order.waitFor();
  await order.click();
  await page.locator('.tutorial-target[data-a=go]').click();
  await page.locator('.tutorial-target.travel-status').waitFor();
  await page.locator('[data-tab=orders]').waitFor();
  await page.locator('.tutorial-target[data-a=go]').waitFor({ timeout: 60000 });
  await page.locator('.tutorial-target[data-a=go]').click();
  await page.locator('.tutorial-target.order-pips').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.tutorial-prompt').count(), 1);
  await page.locator('.tutorial-prompt button').click();
  assert.equal(await page.locator('.tutorial-prompt').count(), 0);
  await page.locator('.game-menu').click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await page.locator('.tutorial-prompt').waitFor();
  await page.locator('.tutorial-prompt button').click();
  assert.equal(await page.locator('.tutorial-prompt').count(), 0);
  const direct = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await direct.goto(process.env.STAIRWELL_TEST_URL ?? 'http://127.0.0.1:5179/');
  await direct.locator('[data-work-start]').check();
  await direct.locator('[data-a=new]').click();
  await direct.locator('.tutorial-prompt').waitFor({ timeout: 30000 });
  await direct.locator('[data-a=go]').click();
  await direct.locator('.tutorial-target.travel-status').waitFor();
  await direct.locator('.tutorial-target[data-a=go]').waitFor({ timeout: 60000 });
  await direct.locator('.tutorial-target[data-a=go]').click();
  await direct.locator('.tutorial-target.order-pips').waitFor({ timeout: 60000 });
  const late = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await late.goto(process.env.STAIRWELL_TEST_URL ?? 'http://127.0.0.1:5179/');
  await late.locator('[data-work-start]').check();
  await late.locator('[data-a=new]').click();
  await late.locator('.tutorial-prompt').waitFor({ timeout: 30000 });
  for (let i = 0; i < 12 && !(await late.locator('.tutorial-late').count()); i++) {
    await late.locator('[data-rest-trip]').click();
    await late.locator('[data-rest-trip]').waitFor({ timeout: 20000 });
  }
  assert.equal(await late.locator('.tutorial-late').count(), 1);
  await late.locator('[data-a=go]').click();
  await late.locator('.tutorial-target[data-a=go]').waitFor({ timeout: 60000 });
  await late.locator('.tutorial-target[data-a=go]').click();
  await late.locator('.tutorial-target.order-pips').waitFor({ timeout: 60000 });
  assert.equal(await late.locator('.tutorial-prompt.tutorial-late').count(), 1);
  console.log('PASS: first order, on-time and late outcomes, replay, skip and direct Go');
} finally {
  await browser.close();
}
