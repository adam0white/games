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

test('failed Resume custody survives another reload before confirmed different-lineage New game', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
  );
  await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await expect(page.locator('#game-menu')).toBeVisible();
  const saved = await journalRecords(page);
  expect(saved.current).not.toBeUndefined();
  expect(saved.chunks.length).toBeGreaterThan(0);
  const initial = saved.current as {
    host: { game: string; seed: number; hf4Host: { schema: string } };
    opening: { digest: string };
    head: { lineage: string };
  };
  expect(initial.host.game).toBe('pass@20');
  expect(initial.host.hf4Host.schema).toBe('pass-hf4/2');
  expect(initial.opening.digest).toBe(initial.head.lineage);

  // Change only the opening. Preserve the actual compatible host, head and chunks.
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
  expect(await journalRecords(page)).toEqual({
    ...saved,
    current: { ...initial, opening: null },
  });
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('#title-status')).toContainText('could not be opened');
  const original = await journalRecords(page);
  expect(original).toEqual({ ...saved, current: { ...initial, opening: null } });
  const rawHead = JSON.stringify(original.current);
  const lineage = initial.head.lineage;
  const oldChunks = original.chunks.filter((chunk) => (chunk as { lineage: string }).lineage === lineage);
  expect(oldChunks.length).toBeGreaterThan(0);
  const rawChunks = JSON.stringify(oldChunks);

  // Clear page-local failure custody. Do not Resume again before replacing the journal.
  await page.reload();
  await expect(page.locator('#cont')).toBeVisible();
  expect(await journalRecords(page)).toEqual(original);
  await page.locator('#new').click();
  await expect(page.locator('#title-confirm')).toBeVisible();
  expect(await journalRecords(page)).toEqual(original);
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('#game-menu')).toBeVisible();
  await expect(page.locator('.run-status').filter({ hasText: 'could not save' })).toHaveCount(0);
  await expect
    .poll(async () => (await journalRecords(page)).current, {
      message: 'Replacement must actually commit before checking custody of the original',
    })
    .not.toEqual(original.current);
  const after = await journalRecords(page);
  const current = after.current as typeof initial;
  // Equal openings are a separate collision prerequisite failure, never a custody RED.
  expect(current.head.lineage, 'New game must save a different opening lineage').not.toBe(lineage);
  expect(
    current.host.seed,
    'The public start must generate a different seed; no forced seed or retry',
  ).not.toBe(initial.host.seed);
  expect(current.host.game).toBe(initial.host.game);
  expect(current.host.hf4Host.schema).toBe(initial.host.hf4Host.schema);
  expect(current.opening).not.toBeNull();
  expect(current.opening.digest).toBe(current.head.lineage);
  expect(
    after.chunks.filter((chunk) => (chunk as { lineage: string }).lineage === current.head.lineage).length,
  ).toBeGreaterThan(0);
  await page.locator('#game-menu').click();
  await page.getByText('Debug', { exact: true }).click();
  await page.locator('#debug-verify').click();
  await expect(page.locator('#debug-result')).toHaveText('The replay matches this game.');
  expect(await journalRecords(page)).toEqual(after);

  const kept = after.kept.find(([key]) => key === `kept:${lineage}`);
  expect(
    kept,
    'Failed journal head must remain archived after reload and successful replacement',
  ).toBeDefined();
  expect(JSON.stringify(kept?.[1])).toBe(rawHead);
  expect(
    JSON.stringify(after.chunks.filter((chunk) => (chunk as { lineage: string }).lineage === lineage)),
  ).toBe(rawChunks);
});

// I/O component control: only pages routing metadata is authored. The prefix is an
// actual public-input prefix. This is not a real Sunday or full-week journey.
test('I/O component: confirmed native prefix rewind replaces an admitted valid same-opening journal', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
  );
  await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  await page.goto('/?lab=1');
  await page.locator('input[name="pace"][value="nevin"]').check();
  await page.locator('#new').click();
  await expect(page.locator('#open-service')).toBeVisible();
  const prefixRecord = await journalRecords(page);
  const prefix = prefixRecord.current as {
    host: { inputs: unknown[]; minute: number; state: unknown; pages: { week: number; k: number }[] };
    opening: unknown;
    head: { lineage: string; digest: string; ordinal: number; at: number };
  };
  expect(prefix.host.inputs).toHaveLength(1);
  expect(prefix.host.inputs[0]).toMatchObject({ kind: 'pace', value: 'nevin' });
  const prefixFingerprint = await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const simPath = '/src/sim/kitchen.ts';
    const app = await import(appPath);
    const { fingerprint } = await import(simPath);
    return fingerprint(app._debug.state);
  });

  // Ask about one changed meal break on the actual board. No service clock runs.
  await page.locator('[data-board-cook="selim"] .board-change').click();
  await page.locator('.board-editor [data-field="break"][aria-pressed="false"]').first().click();
  await page.locator('#board-done').click();
  await page.locator('#ask-board').click();
  await page.locator('#game-menu').click();
  await expect(page.locator('#save-result')).toHaveText(
    'The game is saved and paused while this menu is open.',
  );
  const advanced = await journalRecords(page);
  const head = advanced.current as typeof prefix;
  expect(head.host.inputs.length).toBeGreaterThan(prefix.host.inputs.length);
  expect(head.host.inputs.slice(0, prefix.host.inputs.length)).toEqual(prefix.host.inputs);
  expect(head.host.minute).toBe(prefix.host.minute);
  expect(head.opening).toEqual(prefix.opening);
  expect(head.head.lineage).toBe(prefix.head.lineage);
  expect(head.head).not.toEqual(prefix.head);

  // Author only the host notebook route to that already recorded prefix.
  await page.evaluate(async (k) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('head', 'readwrite');
      const store = tx.objectStore('head');
      const request = store.get('current');
      request.onsuccess = () => {
        const record = request.result;
        store.put({ ...record, host: { ...record.host, pages: [{ week: 1, k }] } }, 'current');
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, prefix.host.inputs.length);
  const routed = await journalRecords(page);
  expect(routed).toEqual({
    ...advanced,
    current: { ...head, host: { ...head.host, pages: [{ week: 1, k: prefix.host.inputs.length }] } },
  });
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('#open-service')).toBeVisible();
  const active = await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const personPath = '/src/sim/hf4-person.ts';
    const app = await import(appPath);
    const { communityRun } = await import(personPath);
    const state = app._debug.state;
    const run = communityRun(state.chef);
    (window as unknown as { __rewindRun: unknown }).__rewindRun = run;
    return { inputs: state.inputs, head: run.journal().head };
  });
  expect(active.inputs).toEqual(head.host.inputs);
  // Journal chunk packing changes its digest; position and native replay do not.
  expect(active.head).toMatchObject({
    lineage: head.head.lineage,
    ordinal: head.head.ordinal,
    at: head.head.at,
  });
  await page.locator('#game-menu').click();
  await expect(page.locator('#save-result')).toContainText('saved and paused');
  await page.getByText('Debug', { exact: true }).click();
  await page.locator('#debug-verify').click();
  await expect(page.locator('#debug-result')).toHaveText('The replay matches this game.');
  const admitted = await journalRecords(page);
  expect((admitted.current as typeof prefix).head).toEqual(head.head);

  // The existing Debug import navigation returns to title without reloading the
  // page or importing a file, so successful Resume/adopt custody remains in memory.
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await chooser).setFiles([]);
  await expect(page.locator('#cont')).toBeVisible();
  await page.locator('#other-ways').click();
  await page.locator('[data-page="1"]').click();
  await expect(page.locator('#title-confirm')).toBeVisible();
  expect(await journalRecords(page)).toEqual(admitted);
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('#open-service')).toBeVisible();
  const rewound = await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const personPath = '/src/sim/hf4-person.ts';
    const app = await import(appPath);
    const { communityRun } = await import(personPath);
    const simPath = '/src/sim/kitchen.ts';
    const { fingerprint } = await import(simPath);
    const state = app._debug.state;
    const run = communityRun(state.chef);
    return {
      newRun: run !== (window as unknown as { __rewindRun: unknown }).__rewindRun,
      fingerprint: fingerprint(state),
      inputs: state.inputs,
      head: run.journal().head,
    };
  });
  expect(rewound.newRun).toBe(true);
  expect(rewound.fingerprint).toBe(prefixFingerprint);
  expect(rewound.inputs).toEqual(prefix.host.inputs);
  expect(rewound.head).toEqual(prefix.head);
  const persisted = await journalRecords(page);
  if (JSON.stringify(persisted.current) === JSON.stringify(admitted.current)) {
    await expect(page.locator('.run-status')).toContainText('could not save');
    expect(persisted).toEqual(admitted);
  }
  expect(
    (persisted.current as typeof prefix).head,
    'Confirmed valid same-opening replacement must commit; blanket retention aborts and keeps the old head',
  ).toEqual(rewound.head);
  expect((persisted.current as typeof prefix).host.inputs).toEqual(prefix.host.inputs);
  expect((persisted.current as typeof prefix).opening).toEqual(prefix.opening);
  expect(persisted.kept).toEqual(admitted.kept);
  await page.locator('#game-menu').click();
  await expect(page.locator('#save-result')).toContainText('saved and paused');
  await page.getByText('Debug', { exact: true }).click();
  await page.locator('#debug-verify').click();
  await expect(page.locator('#debug-result')).toHaveText('The replay matches this game.');
});
