// Follow actual controls without reading instruction/body text. Native origin keeps its real history bridge;
// local assets preserve the play path. Geometry is checked before clicks can scroll.
// This qualifies controls only; connected shelf and telemetry have separate checks.
import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local = new URL(process.env.ROPE_LOCAL || 'http://127.0.0.1:60073/rope/');
const native = new URL(process.env.ROPE_URL || 'https://play.adamwhite.work/rope/');
let browser;
async function exposed(locator, label) {
  await locator.first().waitFor({ state: 'attached', timeout: 30000 });
  const result = await locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(6, r.width / 4),
      y = Math.min(6, r.height / 4);
    const innerX = Math.min(12, r.width / 4),
      innerY = Math.min(12, r.height / 4);
    const points = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + innerX, r.top + innerY],
      [r.right - innerX, r.top + innerY],
      [r.left + innerX, r.bottom - innerY],
      [r.right - innerX, r.bottom - innerY],
      [r.left + x, r.top + y],
      [r.right - x, r.top + y],
      [r.left + x, r.bottom - y],
      [r.right - x, r.bottom - y],
    ];
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      inside:
        r.width > 0 &&
        r.height > 0 &&
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight,
      hits: points.map(([px, py]) => {
        const hit = document.elementFromPoint(px, py);
        return !!hit && (hit === el || el.contains(hit));
      }),
    };
  });
  console.log(label, JSON.stringify(result));
  assert.ok(result.inside && result.hits.every(Boolean), `${label}: ${JSON.stringify(result)}`);
}
async function testPage(options) {
  const page = await browser.newPage(options);
  await page.context().route(`${native.origin}/**`, async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: local.origin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  return page;
}
async function first(page, viewport, practice) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(practice ? new URL('file/?tutorial=1', native).href : native.href);
  if (!practice) await page.locator('[data-a="new"]').click();
  await page.locator('[data-a="go"]').click({ timeout: 30000 });
  const target = page.locator('.leader-bar .verb.lit');
  const cue = target.locator('.tutorial-cue');
  const skip = page.getByRole('button', { name: 'Skip tutorial' });
  await exposed(target, `${viewport.width} first target`);
  await exposed(cue, `${viewport.width} first cue`);
  await exposed(skip, `${viewport.width} first Skip`);
  await target.click();
  await page.waitForTimeout(400);
  await exposed(page.locator('.sheet .verb.lit'), `${viewport.width} next target`);
  await exposed(page.locator('.sheet .verb.lit .tutorial-cue'), `${viewport.width} next cue`);
  await exposed(skip, `${viewport.width} next Skip`);
  await page.locator('.sheet .verb.lit').click({ timeout: 30000 });
  await page.waitForTimeout(700);
  await exposed(page.locator('.forces .force.lit'), `${viewport.width} request target`);
  await exposed(page.locator('.forces .force.lit .tutorial-cue'), `${viewport.width} request cue`);
  await exposed(skip, `${viewport.width} request Skip`);
  await page.locator('.forces .force.lit').click({ timeout: 30000 });
  await page.locator('.request-result').waitFor({ state: 'visible', timeout: 30000 });
  assert.notEqual(
    await page.locator('.request-result').getAttribute('data-input'),
    null,
    'a recorded response is visible',
  );
  assert.deepEqual(errors, []);
}
async function skipAndReplay(viewport) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { DNT: '1' } });
  const errors = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  await context.route(`${native.origin}/**`, async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: local.origin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  try {
    const page = await context.newPage();
    await page.goto(native.href);
    await page.locator('[data-a="new"]').click();
    await page.locator('[data-a="go"]').click();
    const skip = page.getByRole('button', { name: 'Skip tutorial' });
    await exposed(skip, `${viewport.width} fresh Skip`);
    await skip.click();
    assert.equal(await skip.count(), 0, 'Skip dismisses the opening guide');
    await page.getByRole('button', { name: 'Game menu' }).click();
    const replay = page.getByRole('link', { name: 'Replay tutorial in practice' });
    const popupPromise = context.waitForEvent('page');
    await replay.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(new URL(popup.url()).pathname, new URL('file/', native).pathname);
    assert.equal(new URL(popup.url()).searchParams.get('tutorial'), '1');
    await popup.locator('[data-a="go"]').click({ timeout: 30000 });
    await exposed(popup.locator('.leader-bar .verb.lit'), `${viewport.width} replay target`);
    await exposed(popup.locator('.leader-bar .verb.lit .tutorial-cue'), `${viewport.width} replay cue`);
    const replaySkip = popup.getByRole('button', { name: 'Skip tutorial' });
    await exposed(replaySkip, `${viewport.width} replay Skip`);
    await replaySkip.click();
    assert.equal(await replaySkip.count(), 0, 'replayed guide can be skipped');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
async function enlargedHeader() {
  const page = await testPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(new URL('file/?tutorial=1', native).href);
    await page.locator('[data-a="go"]').click();
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.where, .clock-rate'))
        el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
    });
    const bounds = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        top: rect('.top'),
        where: rect('.where'),
        day: rect('.day-strip'),
        clock: rect('.clock-rate'),
      };
    });
    console.log('enlarged header and pacing', JSON.stringify(bounds));
    assert.ok(bounds.where.top >= bounds.top.top && bounds.where.bottom <= bounds.top.bottom + 1);
    assert.ok(bounds.day.top >= bounds.top.bottom - 1 && bounds.clock.bottom <= bounds.day.bottom + 1);
    await exposed(page.getByRole('button', { name: 'Skip tutorial' }), 'enlarged Skip');
    await exposed(page.locator('.leader-bar .verb.lit'), 'enlarged target');
    await page.locator('.leader-bar .verb.lit').click();
    await page.locator('.sheet .verb.lit').waitFor({ state: 'visible' });
  } finally {
    await page.close();
  }
}
async function compactLandscape(dnt) {
  const page = await testPage({
    viewport: { width: 690, height: 360 },
    ...(dnt ? { extraHTTPHeaders: { DNT: '1' } } : {}),
  });
  try {
    await page.goto(new URL('file/?tutorial=1', native).href);
    await page.locator('[data-a="go"]').click({ timeout: 30000 });
    console.log(
      '690 recording notice',
      dnt ? 'DNT' : 'default',
      await page
        .locator('.recording-footer')
        .evaluate((el) => ({ text: el.textContent.trim(), height: el.getBoundingClientRect().height })),
    );
    const grid = await page.locator('#app').evaluate((el) => getComputedStyle(el).gridTemplateRows);
    console.log('690 landscape grid', grid);
    assert.equal(grid.trim().split(/\s+/).length, 3, 'compact landscape retains three grid rows');
    await exposed(page.locator('.leader-bar .verb.lit'), '690 landscape target');
    await exposed(page.locator('.leader-bar .verb.lit .tutorial-cue'), '690 landscape cue');
    await exposed(page.getByRole('button', { name: 'Skip tutorial' }), '690 landscape Skip');
    await page.locator('.leader-bar .verb.lit').click();
    await page.waitForTimeout(400);
    await exposed(page.locator('.sheet .verb.lit'), '690 landscape next target');
    await exposed(page.locator('.sheet .verb.lit .tutorial-cue'), '690 landscape next cue');
    await exposed(page.getByRole('button', { name: 'Skip tutorial' }), '690 landscape next Skip');
    for (const control of await page.locator('.leader-bar button:not([disabled])').all())
      await exposed(control, '690 landscape next movement control');
    await page.locator('.sheet .verb.lit').click();
    await page.waitForTimeout(700);
    await exposed(page.locator('.forces .force.lit'), '690 landscape request target');
    await exposed(page.locator('.forces .force.lit .tutorial-cue'), '690 landscape request cue');
    await exposed(page.getByRole('button', { name: 'Skip tutorial' }), '690 landscape request Skip');
    for (const control of await page.locator('.leader-bar button:not([disabled])').all())
      await exposed(control, '690 landscape request movement control');
    await page.goto(new URL('file/?tutorial=1', native).href);
    await page.locator('[data-a="go"]').click({ timeout: 30000 });
    await page.getByRole('button', { name: 'Skip tutorial' }).click();
    await page.waitForTimeout(400);
    console.log(
      '690 after Skip recording notice',
      dnt ? 'DNT' : 'default',
      await page
        .locator('.recording-footer')
        .evaluate((el) => ({ text: el.textContent.trim(), height: el.getBoundingClientRect().height })),
    );
    for (const control of await page.locator('.leader-bar button:not([disabled])').all())
      await exposed(control, '690 landscape after Skip movement control');
  } finally {
    await page.close();
  }
}
for (const browserType of [chromium, webkit]) {
  browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 360, height: 690 },
      { width: 1280, height: 800 },
    ]) {
      for (const practice of [false, true]) {
        const page = await testPage({ viewport, extraHTTPHeaders: { DNT: '1' } });
        await first(page, viewport, practice);
        await page.close();
      }
      await skipAndReplay(viewport);
    }
    for (const height of [480, 500, 501, 520]) {
      for (const dnt of [true, false]) {
        const viewport = { width: 360, height };
        const page = await testPage({
          viewport,
          ...(dnt ? { extraHTTPHeaders: { DNT: '1' } } : {}),
        });
        await first(page, viewport, true);
        if (height <= 500) {
          await page.goto(new URL('file/?tutorial=1', native).href);
          await page.locator('[data-a="go"]').click();
          await page.getByRole('button', { name: 'Skip tutorial' }).click();
          await page.waitForTimeout(400);
          for (const control of await page.locator('.leader-bar button:not([disabled])').all())
            await exposed(control, `${height} portrait after Skip movement control`);
        }
        await page.close();
      }
    }
    await enlargedHeader();
    await compactLandscape(true);
    await compactLandscape(false);
    console.log(
      `${browserType.name()}: native bridge, practice, fresh Skip and actual replay passed at phone and desktop sizes.`,
    );
  } finally {
    await browser.close();
  }
}
