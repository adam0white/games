import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('asks for the Warren release on the shared play origin', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const local = server.resolvedUrls!.local[0]!;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const manifests: string[] = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://play.adamwhite.work') return route.abort();
      if (url.pathname.endsWith('/release.json')) {
        manifests.push(url.pathname);
        return route.fulfill({
          json: { game: 'warren', app: '0.7.0', framework: '4.17.0', commit: '0'.repeat(40), dirty: false },
        });
      }
      const response = await route.fetch({ url: new URL(url.pathname + url.search, local).href });
      return route.fulfill({ response });
    });
    await page.goto('https://play.adamwhite.work/warren/');
    await page.locator('#new').waitFor();
    await expect.poll(() => manifests.length).toBeGreaterThan(0);
    expect(manifests).toEqual(['/warren/release.json']);
  } finally {
    await browser.close();
    await server.close();
  }
}, 30000);
