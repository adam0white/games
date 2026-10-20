// Run against the dev server. PLAYWRIGHT_MODULE may point to an installed Playwright ESM entry.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  for (const viewport of [{ width: 360, height: 690 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(process.env.CLARITY_URL || 'http://127.0.0.1:5178');
    await page.evaluate(() => document.fonts.ready);
    const inside = async (locator, name) => {
      const box = await locator.boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= viewport.height, `${name} fits ${viewport.width}: ${JSON.stringify(box)}`);
    };
    const targets = async (name) => {
      const undersized = await page.locator('button,summary').evaluateAll(elements => elements.filter(e => e.checkVisibility()).flatMap(e => {
        const r = e.getBoundingClientRect();
        return r.width < 43.99 || r.height < 43.99 ? [`${e.textContent.trim()}: ${r.width}x${r.height}`] : [];
      }));
      assert.deepEqual(undersized, [], `DL-23 ${name} controls are 44px`);
    };
    await inside(page.getByRole('button', { name: /^Carry/ }), 'DL-6 first repair action');
    await targets('opening');
    const conversation = page.locator('.recent-conversation');
    assert.equal(await conversation.getAttribute('open'), null, 'DL-6 conversation starts optional');
    await conversation.locator('summary').click();
    await targets('conversation');
    assert.equal(await page.getByRole('button', { name: 'Ask Sam to watch', exact: true }).count(), 1, 'conversation remains reachable');
    await conversation.locator('summary').click();
    await page.getByRole('button', { name: /^Carry/ }).click();
    await targets('cover');
    await page.getByRole('button', { name: /^Look inside/ }).click();
    await page.getByRole('button', { name: 'Select Contact', exact: true }).click();
    await page.getByRole('button', { name: /^Look closely/ }).click();
    await page.getByRole('tab', { name: 'meter', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await inside(page.getByRole('button', { name: /^Read meter/ }), 'DL-22 meter response');
    await inside(page.locator('.probe-tabs'), 'DL-22 probe selectors');
    await inside(page.locator('.terminal-strip'), 'DL-22 terminals');
    await targets('meter');
    const selectedFill = await page.getByRole('button', { name: 'voltage', exact: true }).evaluate(e => getComputedStyle(e).backgroundColor);
    assert.equal(selectedFill, 'rgba(0, 0, 0, 0)', 'DL-3 selection has no accent fill');
    await page.getByRole('button', { name: 'Place red probe on terminal A', exact: true }).click();
    await page.getByRole('button', { name: 'Place black probe on terminal 0', exact: true }).click();
    await page.getByRole('button', { name: /^Read meter/ }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await inside(page.getByRole('button', { name: /^Read meter/ }), 'DL-22 comparison response');
    await targets('comparison');
    await inside(page.locator('.meter-screen'), 'DL-22 measured reading');
    await inside(page.locator('.guide-cue'), 'DL-22 measurement instruction');
    const continuity = page.getByRole('button', { name: 'continuity', exact: true });
    await continuity.click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await inside(page.getByRole('button', { name: /^Read meter/ }), 'DL-22 power conflict response');
    await inside(page.locator('.power-hint'), 'DL-22 power conflict reason');
    await continuity.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focus = await continuity.evaluate(e => ({ focused: e.matches(':focus-visible'), offset: getComputedStyle(e).outlineOffset }));
    assert.deepEqual(focus, { focused: true, offset: '2px' }, 'selected control retains distinct keyboard focus');

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await page.close();
    console.log(`PASS F-210 ${viewport.width}x${viewport.height}`);
  }
} finally { await browser.close(); }
