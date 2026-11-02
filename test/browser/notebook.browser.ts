import { expect, test } from '@playwright/test';

test('opening voices preserve the default and the tally has no pregame preference', async ({ page }) => {
  await page.goto('/');
  const pace = page.locator('input[name="pace"][value="nevin"]');
  const normal = page.locator('input[name="pace"][value="normal"]');
  await expect(normal).toBeChecked();
  await expect(pace).not.toBeChecked();
  await expect(
    page.getByText('Nevin’s pace gives customers more time to wait for all four weeks.'),
  ).toBeVisible();
  await pace.check();
  await expect(pace).toBeChecked();
  await normal.check();
  await expect(pace).not.toBeChecked();
  await page.locator('#game-menu').click();
  await expect(page.locator('#keep-tally')).toHaveCount(0);
  await page.locator('#menu-back').click();
  const help = page.getByRole('button', { name: 'Information', exact: true });
  await help.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#phase-help')).toBeVisible();
  await expect(page.locator('#phase-help')).toContainText(
    'Press and keep holding the job button to ask more firmly',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('#phase-help')).not.toBeVisible();
  await page.locator('#new').click();
  await expect(page.locator('#ending-tally')).toHaveCount(0);
  const boardHelp = page.getByRole('button', { name: 'Information', exact: true });
  await boardHelp.click();
  await expect(page.locator('#phase-help')).toContainText('If you change the plan');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const app = (window as unknown as { __pass: { state: { phase: string } | null; refresh(): void } })
      .__pass;
    if (!app.state) throw new Error('Missing kitchen');
    app.state.phase = 'end';
    app.refresh();
  });
  const tally = page.locator('#ending-tally');
  await expect(page.getByText('See the tally', { exact: true })).toBeVisible();
  await expect(tally).not.toBeVisible();
  await page.getByText('See the tally', { exact: true }).click();
  await expect(tally).toContainText('The kitchen’s tally');
  await expect(tally).toBeVisible();
});

// These controls inject storage failures; they do not reproduce a player's device failure.
test('a simulated journal read failure blocks replacement until a successful read and confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('#game-menu')).toBeVisible();
  const before = await journalRecords(page);
  expect(before.current).not.toBeUndefined();

  await page.addInitScript(() => {
    if (sessionStorage.getItem('pass-test-read-failed')) return;
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (
        this.name === 'pass-journal' &&
        args[1] === 'readonly' &&
        !sessionStorage.getItem('pass-test-read-failed')
      ) {
        sessionStorage.setItem('pass-test-read-failed', 'yes');
        throw new DOMException('Simulated journal read failure', 'UnknownError');
      }
      return transaction.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.locator('#title-status')).toContainText(/sav|storage/i);
  const newGame = page.locator('#new');
  if (await newGame.isEnabled()) await newGame.click();
  await expect(page.locator('#title-confirm')).not.toBeVisible();
  expect(await journalRecords(page)).toEqual(before);

  // Reload permits the real read; only the subsequent explicit confirmation may replace it.
  await page.reload();
  await expect(page.locator('#cont')).toBeVisible();
  await page.locator('#new').click();
  await expect(page.locator('#title-confirm')).toBeVisible();
  expect(await journalRecords(page)).toEqual(before);
  await page.locator('#title-confirm-yes').click();
  await expect.poll(async () => (await journalRecords(page)).current).not.toEqual(before.current);
});

test('a simulated invalid current journal stays intact after failed Resume and confirmed replacement', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('#game-menu')).toBeVisible();
  // Keep the compatible host header and chunks, but make the journal opening invalid.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('head', 'readwrite');
      const store = tx.objectStore('head');
      const request = store.get('current');
      request.onsuccess = () => store.put({ ...request.result, opening: null }, 'current');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const original = await journalRecords(page);
  expect(original.current).not.toBeUndefined();
  expect(original.chunks.length).toBeGreaterThan(0);
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('#title-status')).toContainText('could not be opened');
  expect(await journalRecords(page)).toEqual(original);
  await page.locator('#new').click();
  await expect(page.locator('#title-confirm')).toBeVisible();
  await page.locator('#title-confirm-yes').click();
  await expect.poll(async () => (await journalRecords(page)).current).not.toEqual(original.current);
  const after = await journalRecords(page);
  const lineage = (original.current as { head: { lineage: string } }).head.lineage;
  expect(after.kept).toContainEqual([`kept:${lineage}`, original.current]);
  expect(after.chunks.filter((chunk) => (chunk as { lineage: string }).lineage === lineage)).toEqual(
    original.chunks.filter((chunk) => (chunk as { lineage: string }).lineage === lineage),
  );
});

// Read all three values in one actual IndexedDB transaction after each UI action.
async function journalRecords(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ current: unknown; kept: [IDBValidKey, unknown][]; chunks: unknown[] }>(
      (resolve, reject) => {
        const tx = db.transaction(['head', 'chunks'], 'readonly');
        const heads = tx.objectStore('head');
        const current = heads.get('current');
        const keys = heads.getAllKeys();
        const values = heads.getAll();
        const chunks = tx.objectStore('chunks').getAll();
        tx.oncomplete = () =>
          resolve({
            current: current.result,
            kept: keys.result
              .map((key, index): [IDBValidKey, unknown] => [key, values.result[index]])
              .filter(([key]) => String(key).startsWith('kept:')),
            chunks: chunks.result,
          });
        tx.onabort = tx.onerror = () => reject(tx.error);
      },
    );
    db.close();
    return result;
  });
}

// Abort after the replacement writes are queued, so this checks actual transaction rollback.
test('an aborted replacement transaction keeps the failed journal and its raw chunks', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('#game-menu')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('head', 'readwrite');
      const store = tx.objectStore('head');
      const request = store.get('current');
      request.onsuccess = () => store.put({ ...request.result, opening: null }, 'current');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const original = await journalRecords(page);
  expect(original.current).not.toBeUndefined();
  expect(original.chunks.length).toBeGreaterThan(0);
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('#title-status')).toContainText('could not be opened');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (this.transaction.db.name === 'pass-journal' && this.name === 'head' && key === 'current') {
        IDBObjectStore.prototype.put = put;
        this.transaction.abort();
      }
      return request;
    };
  });
  await page.locator('#new').click();
  await expect(page.locator('#title-confirm')).toBeVisible();
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('.run-status')).toContainText('could not save');
  expect(await journalRecords(page)).toEqual(original);
});
