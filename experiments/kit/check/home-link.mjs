// A game wired to the small games' home (kit/home.js): opened with ?from=small, it shows the "‹ Small games" link on
// the cards it names, in the page's language. Used by each wired game's own check.mjs:
//   await assertHomeLinks(context, `${base}/lab/night-sand/?from=small&lang=tr`, ['paused', 'result'], '‹ Küçük oyunlar');
// `where` lists the id of the nearest element with an id around each link. Opens its own tab and closes it, so the
// game's other checks are not affected (the "from" is remembered per tab). Note: ?lang= is remembered in kit:lang.
import assert from 'node:assert/strict';

export async function assertHomeLinks(context, url, where, text) {
  const page = await context.newPage();
  try {
    await page.goto(url);
    await page.waitForFunction(n => document.querySelectorAll('a.kit-home').length >= n, where.length, { timeout: 8000 }).catch(() => {});
    const links = await page.evaluate(() => [...document.querySelectorAll('a.kit-home')].map(a => `${a.parentElement.closest('[id]')?.id ?? '-'} ${a.textContent} ${a.getAttribute('href')}`));
    const href = text.includes('Küçük') ? '/small/?lang=tr' : '/small/';
    assert.deepEqual(links.sort(), where.map(id => `${id} ${text} ${href}`).sort(), `opened from the small games' home: a way back on ${where.join(' and ')}`);
  } finally { await page.close(); }
}
