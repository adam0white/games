import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const base = process.env.FIRST_MINUTE_URL ?? 'http://127.0.0.1:52310';
const output = process.env.FIRST_MINUTE_OUTPUT ?? '/tmp/valley-first-minute';
mkdirSync(output, { recursive: true });
const receipts = [];
async function shown(locator) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.evaluate((element) => {
    const b = element.getBoundingClientRect();
    const points = [
      [b.x + b.width / 2, b.y + b.height / 2],
      [b.left + 10, b.top + 10],
      [b.right - 10, b.bottom - 10],
      [b.left + 10, b.bottom - 10],
      [b.right - 10, b.top + 10],
    ];
    return (
      b.width > 0 &&
      b.height > 0 &&
      b.left >= 0 &&
      b.top >= 0 &&
      b.right <= innerWidth &&
      b.bottom <= innerHeight &&
      points.every(([x, y]) => element.contains(document.elementFromPoint(x, y)))
    );
  });
  assert.ok(box, 'Control must be in the viewport and unobscured before a click');
}
async function click(locator) {
  await shown(locator);
  const b = await locator.boundingBox();
  await locator.page().mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function retainClockFocus(locator) {
  await locator.focus();
  const page = locator.page();
  const before = await page.locator('[data-pace-menu]').textContent();
  await page.waitForFunction(
    (value) => document.querySelector('[data-pace-menu]')?.textContent !== value,
    before,
    { timeout: 20000 },
  );
  assert.ok(
    await locator.evaluate((element) => document.activeElement === element),
    'Guide focus must survive a real clock update',
  );
}
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  if (process.env.FIRST_MINUTE_BROWSER && process.env.FIRST_MINUTE_BROWSER !== name) continue;
  const browser = await engine.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 360, height: 690 },
      { width: 1280, height: 800 },
    ]) {
      if (process.env.FIRST_MINUTE_WIDTH && Number(process.env.FIRST_MINUTE_WIDTH) !== viewport.width)
        continue;
      const context = await browser.newContext({ viewport, extraHTTPHeaders: { DNT: '1' } });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(base);
        await page.locator('[data-go="new"]').click();
        const cue = page.locator('#morning-guide');
        await cue.waitFor({ state: 'visible', timeout: 30000 });
        await shown(cue);
        await shown(cue.locator('[data-guide-skip]'));
        await retainClockFocus(cue.locator('[data-guide-skip]'));
        await page.screenshot({ path: `${output}/${name}-${viewport.width}-opening.png` });
        const calledHouse = await page.locator('.morning-target').first().getAttribute('data-h');
        assert.ok(
          (await page.locator('.morning-target').first().getAttribute('aria-describedby')).includes(
            'morning-instruction',
          ),
        );
        assert.equal(await page.locator('#morning-guide-status').getAttribute('role'), 'status');
        await click(page.locator('.morning-target').first());
        await shown(cue);
        await click(page.locator('.morning-target').first());
        // A low-food warning requires the same real second confirmation as ordinary play.
        if ((await cue.getAttribute('data-step')) === 'request')
          await click(page.locator('.morning-target').first());
        await page.locator('#morning-guide[data-step="reply"]').waitFor({ state: 'visible', timeout: 30000 });
        await shown(cue);
        await shown(page.locator('.morning-target').first());
        const publicResult = page.locator('.house-response .note').first();
        await publicResult.waitFor({ state: 'attached', timeout: 10000 });
        const result = await publicResult.evaluate((element) => {
          const copy = element.cloneNode(true);
          copy.querySelectorAll('.t, .w').forEach((node) => {
            node.remove();
          });
          return copy.textContent.trim();
        });
        assert.equal(
          (await page.locator('.morning-answer').textContent()).trim(),
          result,
          'Guide must show the recorded public result, without substituting an ambiguous quotation or another verdict',
        );
        await page.screenshot({ path: `${output}/${name}-${viewport.width}-reply.png` });
        await retainClockFocus(cue.locator('[data-guide-finish]'));
        await click(cue.locator('[data-guide-finish]'));
        assert.equal(await cue.count(), 0);
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('button', { name: 'Replay first morning guide', exact: true }).click();
        await shown(cue);
        await click(page.locator(`#houses button[data-h="${calledHouse}"]`));
        assert.ok(
          ['house', 'request'].includes(await cue.getAttribute('data-step')),
          'Replay must not present an old answer as a new request result',
        );
        await click(cue.locator('[data-guide-skip]'));
        assert.ok(
          await page.evaluate(
            () => document.activeElement !== document.body && document.activeElement?.isConnected,
          ),
          'Skip must return focus to a game control',
        );
        assert.equal(await cue.count(), 0);
        assert.deepEqual(errors, []);
        receipts.push({
          name,
          viewport,
          actualRequestAndReply: true,
          replayAndSkip: true,
          historicalRequestNotReplayed: true,
          exactPublicResult: true,
          clockFocusRetained: true,
          errors,
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(`${output}/receipt.json`, JSON.stringify(receipts, null, 2));
console.log(JSON.stringify({ passed: receipts.length }));
