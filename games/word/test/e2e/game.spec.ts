import { expect, test } from '@playwright/test';

async function takeSeat(page: import('@playwright/test').Page) {
  await page.goto('/word/');
  await expect(page.getByRole('heading', { name: 'A note about recording' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Record my play for the lab' }).uncheck();
  await page.getByRole('button', { name: 'Take a seat' }).click();
}

test('the table, notebook and menu work with public, collapsed diagnostics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await takeSeat(page);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-choice]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open notebook', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The notebook' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the table' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('.menu-footer details')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Replay tools' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Open a file' })).toHaveAttribute('href', '/word/file/');
  await expect(page.getByRole('checkbox', { name: 'Record my play for the lab' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(page.getByRole('button', { name: "I'm stopping", exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm confused", exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to the table' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByText('Debug', { exact: true }).click();
  await page.getByRole('button', { name: 'Export playtest', exact: true }).click();
  await expect((await downloaded).suggestedFilename()).toBe('his-word-playtest.json');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start another meeting?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep this meeting' }).click();
  expect(errors).toEqual([]);
});

test('lab replay rejects malformed imports and retains the current meeting', async ({ page }) => {
  await takeSeat(page);
  const title = await page.locator('main h1').textContent();
  await page.goto('/word/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByText('Debug', { exact: true }).click();
  await page.getByRole('button', { name: 'Replay tools', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Replay tools' })).toBeVisible();
  await page
    .getByLabel('Import a playtest export')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('status')).toContainText('could not be replayed');
  await page.getByRole('button', { name: 'Resume replay' }).click();
  await expect(page.locator('main h1')).toHaveText(title ?? '');
});

async function choice(page: import('@playwright/test').Page, text: string) {
  await page.locator('[data-choice]').filter({ hasText: text }).click();
}

async function ask(page: import('@playwright/test').Page, name: string) {
  await choice(page, 'Hear what');
  await choice(page, `Ask ${name}`);
}

async function signatures(page: import('@playwright/test').Page) {
  for (let person = 0; person < 4; person++) await choice(page, 'next person');
}

test('careful asking and the letter reach an agreement, while ending the meeting loses', async ({ page }) => {
  await takeSeat(page);
  await choice(page, 'Put the notebook');
  for (const name of ['Halil', 'Rıza', 'Osman', 'Ferda']) await ask(page, name);
  await choice(page, 'Fetch Nuri');
  await choice(page, 'Write an agreement');
  await choice(page, 'Use the clothing order for a smaller late service');
  await expect(page.locator('main')).toContainText('4 minutes needed');
  await signatures(page);
  await expect(page.getByText('AGREED', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('month');
  await expect(page.locator('main')).toContainText('₺40');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Begin again', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game', exact: true }).click();
  await choice(page, 'Put the notebook');
  await choice(page, 'Let Osman leave');
  await expect(page.getByText('NO AGREEMENT', { exact: true })).toBeVisible();
});

test('an uninformed agreement receives an actionable refusal and all actions show time', async ({ page }) => {
  await takeSeat(page);
  await choice(page, 'Put the notebook');
  await choice(page, 'Write an agreement');
  await choice(page, 'Morning work. Rent an outside');
  for (let person = 0; person < 4; person++) {
    const before = await page.locator('.eyebrow').textContent();
    await choice(page, 'next person');
    if ((await page.locator('main').textContent())?.includes('refuses')) {
      expect(await page.locator('.eyebrow').textContent()).not.toBe(before);
      break;
    }
  }
  await expect(page.locator('main')).toContainText('Ferda refuses:');
  await expect(page.getByText('AGREED', { exact: true })).toHaveCount(0);
  const labels = await page.locator('[data-choice]').allTextContents();
  expect(labels.every((label) => /\(\d+ minutes?\)/.test(label))).toBe(true);
  for (let n = 0; n < 24; n++) {
    if ((await page.locator('.eyebrow').textContent())?.startsWith('1 minute before')) break;
    await choice(page, 'next person');
  }
  await expect(page.locator('.eyebrow')).toHaveText('1 minute before Osman leaves');
  await choice(page, 'next person');
  await expect(page.getByText('NO AGREEMENT', { exact: true })).toBeVisible();
});

test('private assurances have a cash payoff during the delivery round', async ({ page }) => {
  await takeSeat(page);
  await choice(page, 'Put the notebook');
  await choice(page, 'in private');
  await choice(page, 'Tell Halil');
  await choice(page, 'in private');
  await choice(page, 'Tell Rıza');
  await ask(page, 'Osman');
  await ask(page, 'Ferda');
  await choice(page, 'Write an agreement');
  await choice(page, 'Small repairs and cart inside. Smaller service');
  await expect(page.locator('main')).toContainText('delivery round');
  await choice(page, 'next person');
  await choice(page, 'Let Halil return');
  for (let n = 0; n < 2; n++) await choice(page, 'next person');
  await expect(page.locator('main')).toContainText('2 minutes needed');
  await choice(page, 'Wait for Rıza');
  await choice(page, 'next person');
  await expect(page.getByText('AGREED', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('₺0');
});

// The same policy is driven from DOM text here; it gets no state or export.
for (const approach of ['ask-first', 'repair-refusal'] as const) {
  test(`screen-only policy wins in the browser: ${approach}`, async ({ page }) => {
    const { coldPolicy } = await import('../support/cold-policy');
    const decide = coldPolicy(approach);
    await takeSeat(page);
    for (let step = 0; step < 80; step++) {
      if (await page.getByText('AGREED', { exact: true }).count()) break;
      const text = (await page.locator('main').textContent()) ?? '';
      const choices = await page.locator('[data-choice]').evaluateAll((nodes) =>
        nodes.map((node) => ({
          id: (node as HTMLElement).dataset.choice ?? '',
          text: node.textContent ?? '',
        })),
      );
      const id = decide({ text, choices });
      await page.locator(`[data-choice="${id}"]`).click();
    }
    await expect(page.getByText('AGREED', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('draft choices show terms and costs before writing uses time', async ({ page }) => {
  await takeSeat(page);
  await choice(page, 'Put the notebook');
  await choice(page, 'Fetch Nuri');
  await choice(page, 'Write an agreement');
  const before = await page.locator('.eyebrow').textContent();
  const late = page
    .locator('[data-choice]')
    .filter({ hasText: 'Use the clothing order for a smaller late service' });
  await expect(late).toContainText('without a paid break');
  await expect(late).toContainText('₺40');
  await expect(late).toContainText('2 minutes');
  await expect(late).toContainText(/unknown|not yet|not asked/i);
  expect(await page.locator('.eyebrow').textContent()).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await choice(page, 'Return to the table');
  await ask(page, 'Halil');
  await choice(page, 'Write an agreement');
  await expect(late).toContainText('with a paid break');
  await expect(late).toContainText('Halil asked: paid break');
  await late.click();
  await expect(page.locator('main')).toContainText('with a paid break');
  await expect(page.locator('.eyebrow')).toContainText('14 minutes');
});

// This control fails if the file route reads/writes native keys, accepts stale
// selection, or downloads a partial state. It uses only a fresh test context.
test('file meetings preserve occupied native storage and ordinary import still persists', async ({
  page,
}) => {
  const { act, createGame, exportRun, replayRun, view } = await import('../../src/game');
  const source = createGame(42);
  for (const text of ['Put the notebook', 'Hear what', 'Ask Halil', 'Fetch Nuri']) {
    const selected = view(source).choices.find((item) => item.text.includes(text));
    if (!selected) throw new Error(`Missing choice: ${text}`);
    act(source, { choice: selected.id });
  }
  const original = exportRun(source);
  await page.addInitScript(() => {
    const save = 'his-word-save-v1';
    const notice = 'his-word-notice-v1';
    const guide = 'his-word-guide-v1';
    localStorage.setItem(save, 'occupied-native-meeting');
    localStorage.setItem(notice, 'occupied-native-notice');
    localStorage.setItem(guide, 'occupied-guide-preference');
    const trace: string[] = [];
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === save || key === notice || key === guide) trace.push(`read:${key}`);
      return read.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === save || key === notice || key === guide) trace.push(`write:${key}`);
      return write.call(this, key, value);
    };
    Object.assign(window, { nativeTrace: trace });
  });
  await page.goto('/word/file/?labRunSource=agent');
  await expect(page.getByRole('heading', { name: 'Open a His Word file' })).toBeVisible();
  const recording = page.getByRole('checkbox', { name: 'Record my play for the lab' });
  await expect(recording).not.toBeChecked();
  await recording.click();
  await expect(page.getByText(/Recording is blocked/)).toBeVisible();
  await expect(recording).toBeDisabled();
  await expect(page.locator('[data-choice]')).toHaveCount(0);
  expect(await page.locator('iframe').count()).toBe(0);
  const input = page.getByLabel('Choose a playtest file');
  await input.setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(`\uFEFF${JSON.stringify(original)}`),
  });
  await expect(page.locator('[data-choice]').first()).toBeVisible();
  await choice(page, 'Hear what');
  const next = view(source).choices.find((item) => item.text.includes('Hear what'));
  if (!next) throw new Error('The continuation choice is missing.');
  act(source, { choice: next.id });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Replay guide' }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay tools', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose another file' }).click();
  await expect(page.getByText(/Original file: .*SHA-256:/)).toBeVisible();
  await page
    .getByLabel('Choose a playtest file')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('status')).toContainText('could not be replayed');
  await page.getByLabel('Choose a playtest file').dispatchEvent('cancel');
  await expect(page.getByRole('status')).toContainText('canceled');
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      if (this.name !== 'slow.json') return read.call(this);
      return new Promise<ArrayBuffer>((resolve) => {
        Object.assign(window, { releaseSlowFile: async () => resolve(await read.call(this)) });
      });
    };
  });
  await page.getByLabel('Choose a playtest file').setInputFiles({
    name: 'slow.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.getByRole('status')).toContainText('Checking');
  await page.getByRole('button', { name: 'Resume opened meeting' }).click();
  await page.evaluate(async () => {
    await (window as Window & { releaseSlowFile?: () => Promise<void> }).releaseSlowFile?.();
  });
  await expect(page.locator('main h1')).toHaveText(view(source).title);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByText('Debug', { exact: true }).click();
  await page.getByRole('button', { name: 'Export playtest', exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const continued = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(replayRun(continued)).toEqual(source);
  await page.getByRole('button', { name: 'Choose another file' }).click();
  await page.getByLabel('Choose a playtest file').setInputFiles({
    name: 'slow.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await page.getByRole('button', { name: 'Close file', exact: true }).click();
  await page.evaluate(async () => {
    await (window as Window & { releaseSlowFile?: () => Promise<void> }).releaseSlowFile?.();
  });
  await expect(page.getByRole('heading', { name: 'Open a His Word file' })).toBeVisible();
  await expect(page.locator('[data-choice]')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await page.evaluate(() => (window as Window & { nativeTrace?: string[] }).nativeTrace)).toEqual([]);
  expect(
    await page.evaluate(() => [
      localStorage.getItem('his-word-save-v1'),
      localStorage.getItem('his-word-notice-v1'),
      localStorage.getItem('his-word-guide-v1'),
    ]),
  ).toEqual(['occupied-native-meeting', 'occupied-native-notice', 'occupied-guide-preference']);

  // Ordinary startup reads native storage, and ordinary import writes the save.
  await page.goto('/word/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByText('Debug', { exact: true }).click();
  await page.getByRole('button', { name: 'Replay tools', exact: true }).click();
  await page.getByLabel('Import a playtest export').setInputFiles({
    name: 'continued.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(continued)),
  });
  await expect(page.getByRole('status')).toContainText('Replay verified');
  expect(await page.evaluate(() => (window as Window & { nativeTrace?: string[] }).nativeTrace)).toContain(
    'write:his-word-save-v1',
  );
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('his-word-save-v1') ?? 'null'))).toEqual(
    continued,
  );
});

// The real host must leave the SDK's async pagehide snapshot alive. Synthetic
// receiver replies are test receipts only; every linked piece uses its exact id.
test('pagehide captures the complete changed file meeting with the real SDK', async ({ page, baseURL }) => {
  // One transport control. WebKit's Playwright protocol omits this beacon body.
  test.skip(test.info().project.name !== 'phone-chromium', 'Inspect the compressed beacon once in Chromium.');
  const { gunzipSync } = await import('node:zlib');
  const { act, createGame, exportRun, view } = await import('../../src/game');
  const origin = 'https://word-file-test.invalid';
  type Piece = { upload: string; index: number; total: number; text: string };
  const runs = new Map<string, Map<number, Piece>>();
  const snapshots = () =>
    [...runs.values()].flatMap((pieces) => {
      const ordered = [...pieces.values()].sort((a, b) => a.index - b.index);
      if (!ordered[0] || ordered.length !== ordered[0].total) return [];
      return [JSON.parse(ordered.map((piece) => piece.text).join(''))];
    });
  // Serve the actual built Word bundle on a synthetic HTTPS test origin so the
  // public SDK is eligible. All other requests are handled here or aborted.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      const response = await page.request.get(new URL(url.pathname + url.search, baseURL).href);
      await route.fulfill({ response });
      return;
    }
    if (url.href === 'https://human.adamwhite.work/lab/api/linked') {
      const headers = {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      expect(request.method()).toBe('POST');
      const body = request.postDataBuffer();
      if (!body) throw new Error('The linked test request has no compressed body.');
      const envelope = JSON.parse(gunzipSync(body).toString('utf8'));
      expect(envelope.v).toBe(2);
      expect(envelope.id).toMatch(/^[a-f0-9]{32}$/);
      expect(envelope.game).toBe('word');
      expect(envelope.runSource).toBe('agent');
      if (envelope.kind === 'run') {
        const piece = envelope.data as Piece;
        expect(piece.upload).toMatch(/^[a-f0-9]{32}$/);
        const pieces = runs.get(piece.upload) ?? new Map<number, Piece>();
        pieces.set(piece.index, piece);
        runs.set(piece.upload, pieces);
      }
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: envelope.id }),
      });
      return;
    }
    await route.abort();
  });
  await page.addInitScript(() => {
    // Fresh test-context fixture, never read from or copied out of an owner profile.
    localStorage.setItem('hf-lab-player', '11111111111111111111111111111111');
    sessionStorage.setItem('hf-lab-session:word', `22222222222222222222222222222222:${Date.now()}`);
    sessionStorage.setItem('hf-lab-run:word', '33333333333333333333333333333333');
  });
  const source = createGame(42);
  const first = view(source).choices.find((item) => item.text.includes('Put the notebook'));
  if (!first) throw new Error('The opening choice is missing.');
  act(source, { choice: first.id });
  const initial = exportRun(source);
  await page.goto(`${origin}/word/file/?labRunSource=agent`);
  const recording = page.getByRole('checkbox', { name: 'Record my play for the lab' });
  await expect(recording).not.toBeChecked();
  await recording.check();
  await expect(recording).toBeChecked();
  await page.getByLabel('Choose a playtest file').setInputFiles({
    name: 'meeting.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(initial)),
  });
  await expect.poll(() => snapshots()).toContainEqual(initial);
  await choice(page, 'Hear what');
  const next = view(source).choices.find((item) => item.text.includes('Hear what'));
  if (!next) throw new Error('The continuation choice is missing.');
  act(source, { choice: next.id });
  const final = exportRun(source);
  expect(final).not.toEqual(initial);
  expect(snapshots()).not.toContainEqual(final);
  // Dispatch through both real listeners, including the host listener after SDK.
  // This isolates pagehide before the SDK's sixty-second periodic snapshot.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect.poll(() => snapshots()).toContainEqual(final);
});

test('a quiet label opens a reviewable draft and sends nothing until Submit', async ({ page }) => {
  const external: string[] = [];
  await page.route(/^(?!http:\/\/127\.0\.0\.1:4173)/, (route) => {
    external.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  await takeSeat(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  await page.getByRole('button', { name: "I'm confused", exact: true }).click();
  const draft = page.getByRole('dialog');
  await expect(draft).toBeVisible();
  await expect(draft.getByRole('textbox', { name: 'A note (optional)' })).toHaveValue(/I'm confused/);
  await expect(draft.getByRole('button', { name: 'Submit' })).toBeVisible();
  await draft.getByRole('button', { name: 'Not now' }).click();
  await expect(draft).toBeHidden();
  expect(external.filter((request) => request.startsWith('POST'))).toEqual([]);
});
