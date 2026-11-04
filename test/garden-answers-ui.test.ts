import { type Browser, chromium, webkit } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await (process.env.HEARSAY_BROWSER === 'webkit' ? webkit : chromium).launch();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])('shows an Ask reply without opening the record at $width×$height', async (viewport) => {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Play fourteen days with new local people', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByText('Talk about someone else', { exact: true }).click();
    await page.getByRole('button', { name: 'Ask what they have heard', exact: true }).click();
    const answer = page.locator('.cg-panel [role="status"]');
    await expect.poll(() => answer.count()).toBe(1);
    expect(await answer.innerText()).toContain('bread');
    expect(await answer.innerText()).toContain('Invite a quiet conversation');
    expect(await page.locator('.cg-account').getAttribute('open')).toBeNull();
    const bounds = await answer.boundingBox();
    // Chromium rounds scroll offsets to whole pixels, while font bounds can be fractional.
    const header = await page.locator('.cg-header').boundingBox();
    expect(Math.round(bounds?.y ?? -2)).toBeGreaterThanOrEqual(
      Math.max(0, Math.round((header?.y ?? 0) + (header?.height ?? 0))),
    );
    expect(Math.round((bounds?.y ?? -2) + (bounds?.height ?? 0))).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await page.close();
  }
});

it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])(
  'takes Who? and What? by their exact labels and shows the refusal beside the action at $width×$height',
  async (viewport) => {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
      await page.getByText('Other ways to begin', { exact: true }).click();
      await page
        .getByRole('button', { name: 'Play fourteen days with new local people', exact: true })
        .click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Press for private details', exact: true }).click();
      await expect
        .poll(() => page.locator('.cg-panel .cg-notice').textContent())
        .toContain('keep this private');
      const ece = page.locator('.cg-person[data-person="ece"]');
      await ece.click();
      expect(await ece.getAttribute('aria-pressed')).toBe('true');
      await page.getByText('Talk about someone else', { exact: true }).click();
      await page.getByLabel('Who?', { exact: true }).selectOption('osman');
      await page.getByLabel('What?', { exact: true }).selectOption('honest');
      expect(await page.getByLabel('Who?', { exact: true }).inputValue()).toBe('osman');
      expect(await page.getByLabel('What?', { exact: true }).inputValue()).toBe('honest');

      const geometry = async (stage: string) => {
        const facts = await page.evaluate(() => {
          const rect = (element: Element) => {
            const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
            return { x, y, width, height, top, right, bottom, left };
          };
          const elements = {
            grid: document.querySelector('.cg-tables'),
            ece: document.querySelector('.cg-person[data-person="ece"]'),
            panel: document.querySelector('.cg-panel'),
            who: document.querySelector('#cg-about'),
            what: document.querySelector('#cg-trait'),
            header: document.querySelector('.cg-header'),
          };
          return {
            viewport: {
              width: innerWidth,
              height: innerHeight,
              scrollX,
              scrollY,
              documentWidth: document.documentElement.scrollWidth,
            },
            rects: Object.fromEntries(
              Object.entries(elements).map(([key, element]) => [key, element ? rect(element) : null]),
            ),
          };
        });
        console.log(`HEARSAY_PHONE_GEOMETRY ${JSON.stringify({ stage, ...facts })}`);
      };
      await geometry('before-scroll');
      for (const [name, control] of [
        ['ece', ece],
        ['who', page.getByLabel('Who?', { exact: true })],
        ['what', page.getByLabel('What?', { exact: true })],
      ] as const) {
        await control.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await geometry(`after-scroll-${name}`);
        const accessible = await control.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const header = document.querySelector('.cg-header')?.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          let unclipped = true;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const bounds = parent.getBoundingClientRect();
            if (
              /(auto|scroll|hidden|clip)/.test(style.overflowX) &&
              (r.left < bounds.left || r.right > bounds.right)
            )
              unclipped = false;
            if (
              /(auto|scroll|hidden|clip)/.test(style.overflowY) &&
              (r.top < bounds.top || r.bottom > bounds.bottom)
            )
              unclipped = false;
          }
          return {
            inViewport:
              r.width > 0 &&
              r.height > 0 &&
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= innerWidth &&
              r.bottom <= innerHeight,
            clearOfHeader:
              !header ||
              r.right <= header.left ||
              r.left >= header.right ||
              r.bottom <= header.top ||
              r.top >= header.bottom,
            unclipped,
            centerHit: hit === element || element.contains(hit),
            noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
          };
        });
        expect(accessible, name).toEqual({
          inViewport: true,
          clearOfHeader: true,
          unclipped: true,
          centerHit: true,
          noHorizontalOverflow: true,
        });
      }
    } finally {
      await page.close();
    }
  },
);
