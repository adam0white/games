/** Follow only the guide and visible controls; do not read body copy. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch();
try {
  const phone = process.argv.includes('--phone');
  const page = await browser.newPage({
    viewport: phone ? { width: 360, height: 690 } : { width: 1280, height: 800 },
  });
  await page.goto(process.argv.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5189/');
  await page.locator('#new').click();
  await page.locator('#first-guide:not([hidden])').waitFor();
  const inView = async (selector) => {
    const result = await page.locator(selector).evaluate((element) => {
      const r = element.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        visible:
          r.width > 0 &&
          r.height > 0 &&
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight,
        unobscured: hit === element || element.contains(hit),
      };
    });
    assert.ok(
      result.visible && result.unobscured,
      `${selector} must be in view and unobscured before interaction`,
    );
  };
  for (const selector of ['#first-guide strong', '#guide-skip', '[data-tool="chalk"]'])
    await inView(selector);
  assert.match(await page.locator('#first-guide strong').textContent(), /Choose chalk/);
  await page.locator('[data-tool="chalk"]').click();
  assert.match(await page.locator('#first-guide strong').textContent(), /outlined stone/);
  await inView('#first-guide strong');
  await inView('#guide-skip');
  const r = await page.locator('#guide-target').boundingBox();
  assert.ok(
    r &&
      r.x >= 0 &&
      r.y >= 0 &&
      r.x + r.width <= (phone ? 360 : 1280) &&
      r.y + r.height <= (phone ? 690 : 800),
  );
  assert.equal(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
    }),
    'cv',
  );
  await page.locator('[data-tool="look"]').click();
  assert.match(await page.locator('#first-guide strong').textContent(), /Choose chalk/);
  await page.locator('[data-tool="chalk"]').click();
  await page.locator('#book').click();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('#cont').click();
  await page.locator('#cv').waitFor();
  if (await page.locator('#cell-detail').isVisible()) await page.locator('#cellx').click();
  await page.locator('#first-guide:not([hidden])').waitFor();
  assert.match(await page.locator('#first-guide strong').textContent(), /Choose chalk/);
  await page.locator('[data-tool="chalk"]').click();
  const countMarks = () =>
    page.evaluate(() => window.__warren.game.s.hill.chalk.reduce((n, mark) => n + Number(Boolean(mark)), 0));
  const before = await countMarks();
  const target = await page.locator('#guide-target').boundingBox();
  assert(target);
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForFunction(
    () => document.querySelector('#first-guide strong')?.textContent === 'Chalk marked',
  );
  assert.ok((await countMarks()) > before, 'the real hill gained a chalk mark');
  await page.locator('#guide-done').click();
  await page.locator('#book').click();
  await page.locator('#replay-guide').click();
  assert.match(await page.locator('#first-guide strong').textContent(), /Choose chalk/);
  await page.locator('#guide-skip').click();
  assert.equal(await page.locator('#first-guide').isHidden(), true);
  console.log('PASS: chalk control, real mark, consequence, menu replay and skip');
} finally {
  await browser.close();
}
