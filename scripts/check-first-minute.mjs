// A scripted player follows highlighted controls and reads no body copy.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 360, height: 690 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.CLARITY_URL || 'http://127.0.0.1:5178') + '/file/?tutorial=1');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('.guide-try .physical-use-action').click();
    await page.locator('.guide-open .physical-cover-latch').waitFor();
    assert.equal(await page.locator('.physical-scene.has-output').count(), 0, 'failed carry visibly darkens lantern');
    assert(await page.locator('.physical-observation').isVisible(), 'result remains visible');
    assert(await page.getByRole('button', { name: 'Skip tutorial' }).isVisible(), 'skip is available');
    await page.locator('.guide-open .physical-cover-latch').click();
    assert.equal(await page.locator('.physical-scene.is-open').count(), 1);
    const part = page.getByRole('button', { name: 'Select 6 V cell pack', exact: true });
    const box = await part.boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= viewport.height, 'first part is visible without scrolling');
    const ratio = await part.evaluate(el => new Promise(resolve => { const observer = new IntersectionObserver(([entry]) => { resolve(entry.intersectionRatio); observer.disconnect(); }, { threshold: [0, 1] }); observer.observe(el); }));
    assert(ratio >= 0.98, 'first part is not clipped by the scrolling panel');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const replay = page.getByRole('link', { name: 'Replay tutorial in a practice workshop' });
    assert.equal(await replay.getAttribute('href'), '/file/?tutorial=1');
    assert.equal(await replay.getAttribute('target'), '_blank');
    assert.deepEqual(errors, []);
    await page.close();
    const off = await browser.newPage({ viewport });
    await off.goto((process.env.CLARITY_URL || 'http://127.0.0.1:5178') + '/file/?tutorial=1');
    await off.getByRole('button', { name: 'Resume', exact: true }).click();
    await off.locator('.physical-power-switch').click();
    await off.locator('.guide-try .physical-use-action').click();
    await off.locator('.guide-power-on .physical-power-switch').click();
    await off.locator('.guide-try .physical-use-action').click();
    await off.locator('.guide-open .physical-cover-latch').waitFor();
    await off.close();
  }
  console.log('First-minute no-body-reading check passed at phone and desktop sizes.');
} finally { await browser.close(); }
