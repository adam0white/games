// Run against the dev server. PLAYWRIGHT_MODULE may point to an installed Playwright ESM entry.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const screenshots = process.env.CLARITY_SCREENSHOTS;
if (screenshots) await mkdir(screenshots, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  for (const viewport of [{ width: 360, height: 690 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const screenshot = async name => {
      if (screenshots) await page.screenshot({ path: `${screenshots}/${viewport.width}-${name}.png` });
    };
    const reflow = async name => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal overflow`);
    await page.goto(process.env.CLARITY_URL || 'http://127.0.0.1:5178');
    await page.evaluate(() => document.fonts.ready);
    const inside = async (locator, name) => {
      const box = await locator.boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= viewport.height, `${name} fits ${viewport.width}: ${JSON.stringify(box)}`);
    };
    const targets = async (name) => {
      const undersized = await page.locator('button,summary,select,a,input:not([type=hidden])').evaluateAll(elements => elements.filter(e => e.checkVisibility()).flatMap(e => {
        // A checkbox's associated label is its clickable hit area.
        const target = e.matches('input') && e.labels?.length ? e.labels[0] : e;
        const r = target.getBoundingClientRect();
        return r.width < 43.99 || r.height < 43.99 ? [`${e.textContent.trim()}: ${r.width}x${r.height}`] : [];
      }));
      assert.deepEqual(undersized, [], `DL-23 ${name} controls are 44px`);
    };
    await inside(page.getByRole('button', { name: /^Carry/ }), 'DL-6 first repair action');
    await targets('opening');
    await screenshot('opening');
    if (viewport.width === 360) assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '17px', 'DL-25 phone base');
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
    await screenshot('meter');
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

    await reflow('guided meter');
    await screenshot('conflict');
    // 200% of the intended 17px phone base. Inspect actual control bounds, not CSS declarations.
    await page.evaluate(() => { document.documentElement.style.fontSize = '34px'; });
    await reflow('200% meter');
    for (const selector of ['.meter-settings button', '.focused-tabs button']) {
      const boxes = await page.locator(selector).evaluateAll(els => els.filter(e => e.checkVisibility()).map(e => {
        const r = e.getBoundingClientRect(); return { text: e.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom, scroll: e.scrollWidth, width: e.clientWidth };
      }));
      for (const [i, a] of boxes.entries()) {
        assert(a.scroll <= a.width + 1, `200% label fits: ${a.text}`);
        for (const b of boxes.slice(i + 1)) assert(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `200% controls do not overlap: ${a.text}/${b.text}`);
      }
    }
    await screenshot('text200-meter');
    await page.locator('.meter-controls').scrollIntoViewIfNeeded();
    await screenshot('text200-controls');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    // Use the actual historical export, without rewriting its seed, inputs or state.
    await page.locator('input[type=file]').setInputFiles(new URL('../docs/restart/evidence/mentor-ui-play-2026-10-14.json', import.meta.url).pathname);
    await page.getByRole('navigation', { name: 'Workshop', exact: true }).waitFor();
    for (const width of [320, 360, 1280]) {
      await page.setViewportSize({ width, height: viewport.height });
      await reflow(`progressed ${width}`);
      await targets(`progressed ${width}`);
      const menu = page.locator('.workshop-menu > summary');
      const box = await menu.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width, `Workshop stays on screen ${width}`);
      const current = page.locator('nav [aria-current=page]');
      const colours = await current.evaluate(e => { const s = getComputedStyle(e); return { text: s.color, border: s.borderBottomColor }; });
      assert.notEqual(colours.text, 'rgb(238, 218, 180)', 'navigation text is neutral');
      assert.notEqual(colours.border, 'rgb(220, 180, 110)', 'navigation underline is neutral');
      await page.evaluate(() => window.scrollTo(0, 0));
      if (screenshots) await page.screenshot({ path: `${screenshots}/${width}-progressed-${viewport.width}.png` });
      await page.evaluate(() => { document.documentElement.style.fontSize = '34px'; });
      await reflow(`progressed ${width} 200% text`);
      await targets(`progressed ${width} 200% text`);
      const fragmented = await page.locator('.focused-header nav button').evaluateAll(els => els.flatMap(e => {
        const text = e.firstChild;
        return [...text.textContent.matchAll(/\S+/g)].filter(word => {
          const range = document.createRange();
          range.setStart(text, word.index);
          range.setEnd(text, word.index + word[0].length);
          return range.getClientRects().length > 1;
        }).map(word => word[0]);
      }));
      assert.deepEqual(fragmented, [], 'navigation keeps whole words at 200%');
      const enlargedMenu = await menu.boundingBox();
      assert(enlargedMenu && enlargedMenu.x >= 0 && enlargedMenu.x + enlargedMenu.width <= width, `200% Workshop stays on screen ${width}`);
      if (screenshots) await page.screenshot({ path: `${screenshots}/${width}-progressed-text200-${viewport.width}.png` });
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.setViewportSize(viewport);
    await page.locator('.workshop-menu > summary').click();
    await targets('Workshop menu including links and input labels');
    await page.getByRole('button', { name: 'Verify recorded replay', exact: true }).click();
    await page.getByText('Replayed 48 recorded actions to this exact workshop state.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close for the day', exact: true }).click();
    await page.locator('.workshop-menu > summary').click();
    const newSpeech = page.locator('.recent-conversation > summary');
    assert.match(await newSpeech.innerText(), /new · /, 'new speech has a visible speaker/unread cue');
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot('new-speech');
    await newSpeech.click();
    await page.waitForFunction(() => !document.querySelector('.recent-conversation > summary').textContent.includes('new · '));
    assert.doesNotMatch(await newSpeech.innerText(), /new · /, 'opening conversation acknowledges speech');
    await screenshot('conversation');
    assert.deepEqual(errors, [], 'no browser errors');
    await page.close();
    console.log(`PASS F-210 ${viewport.width}x${viewport.height}`);
  }
} finally { await browser.close(); }
