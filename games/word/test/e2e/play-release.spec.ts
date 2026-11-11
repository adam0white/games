import { expect, test } from '@playwright/test';

test('published lab client requests scoped release metadata', async ({ page, baseURL }) => {
  const manifests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://play.adamwhite.work') return route.abort();
    if (url.pathname.endsWith('/release.json')) {
      manifests.push(url.pathname);
      return route.fulfill({
        json: { game: 'word', app: '0.1.0', framework: '4.17.0', commit: '0'.repeat(40), dirty: false },
      });
    }
    const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  await page.goto('https://play.adamwhite.work/word/');
  await expect.poll(() => manifests.length).toBeGreaterThan(0);
  expect(manifests).toEqual(['/word/release.json']);
});

test('canonical file document opens the chooser before reading native keys', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ['his-word-save-v1', 'his-word-notice-v1', 'his-word-guide-v1'])
      localStorage.setItem(key, 'occupied');
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('his-word-')) throw new Error(`Unexpected native read: ${key}`);
      return get.call(this, key);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/word/file/index.html');
  await expect(page.getByRole('heading', { name: 'Open a His Word file' })).toBeVisible();
  expect(errors).toEqual([]);
});
