// Follow actual controls without reading instruction/body text. Native origin keeps its real history bridge;
// only this app's assets use local source. Geometry is checked before locator clicks can scroll.
import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local = process.env.ROPE_LOCAL || 'http://127.0.0.1:60073';
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
async function first(page, viewport, practice) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!practice) {
    await page.context().route('https://rope.adamwhite.work/**', async (route) => {
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.continue();
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: local + url.pathname + url.search });
      await route.fulfill({ response });
    });
  }
  await page.goto(practice ? `${local}/file/?tutorial=1` : 'https://rope.adamwhite.work/');
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
  await context.route('https://rope.adamwhite.work/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: local + url.pathname + url.search });
    await route.fulfill({ response });
  });
  try {
    const page = await context.newPage();
    await page.goto('https://rope.adamwhite.work/');
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
    assert.equal(new URL(popup.url()).pathname, '/file/');
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
for (const browserType of [chromium, webkit]) {
  browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 360, height: 690 },
      { width: 1280, height: 800 },
    ]) {
      for (const practice of [false, true]) {
        const page = await browser.newPage({ viewport, extraHTTPHeaders: { DNT: '1' } });
        await first(page, viewport, practice);
        await page.close();
      }
      await skipAndReplay(viewport);
    }
    console.log(
      `${browserType.name()}: native bridge, practice, fresh Skip and actual replay passed at phone and desktop sizes.`,
    );
  } finally {
    await browser.close();
  }
}
