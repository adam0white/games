import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const base = (process.env.FIRST_MINUTE_URL ?? 'http://127.0.0.1:52310/valley').replace(/\/$/, '');
const output = process.env.FIRST_MINUTE_OUTPUT ?? '/tmp/valley-guide-preservation';
const preference = 'valley-first-morning-guide-v1';
mkdirSync(output, { recursive: true });
const receipts = [];
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 690 },
      extraHTTPHeaders: { DNT: '1' },
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort(),
    );
    await context.addInitScript((key) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      window.guidePreferenceAccess = { reads: 0, writes: 0 };
      Storage.prototype.getItem = function (item) {
        if (location.pathname.startsWith('/valley/file') && item === key)
          window.guidePreferenceAccess.reads++;
        return get.call(this, item);
      };
      Storage.prototype.setItem = function (item, value) {
        if (location.pathname.startsWith('/valley/file') && item === key)
          window.guidePreferenceAccess.writes++;
        return set.call(this, item, value);
      };
    }, preference);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${base}/`);
      await page.locator('[data-go="new"]').click();
      await page.locator('#morning-guide').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('#houses .morning-target').click();
      await page.locator('#thumbs .morning-target').click();
      if (await page.locator('#morning-guide[data-step="request"]').count())
        await page.locator('#thumbs .morning-target').click();
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.reload();
      await page.locator('[data-go="open"]').click();
      await page
        .locator('#morning-guide[data-step="waiting"], #morning-guide[data-step="reply"]')
        .waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('[data-guide-skip]').click();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), preference), 'done');
      await page.reload();
      await page.locator('[data-go="open"]').click();
      await page.locator('.play').waitFor();
      assert.equal(
        await page.locator('#morning-guide').count(),
        0,
        'Completed preference survives native reload',
      );
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.locator('.menu-debug summary').click();
      const pending = page.waitForEvent('download', { timeout: 30000 });
      await page.getByRole('button', { name: 'Download this run', exact: true }).click();
      const file = await pending;
      const path = `${output}/${name}-run.json`;
      await file.saveAs(path);
      await page.goto(`${base}/file/`);
      await page.locator('#foreign-run').setInputFiles(path);
      await page.locator('.play').waitFor({ state: 'visible', timeout: 30000 });
      assert.equal(
        await page.locator('#morning-guide').count(),
        0,
        'File mode does not auto-read native guide preference',
      );
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.locator('[data-replay-guide]').click();
      await page.locator('#morning-guide').waitFor();
      await page.locator('[data-guide-skip]').click();
      assert.deepEqual(await page.evaluate(() => window.guidePreferenceAccess), { reads: 0, writes: 0 });
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), preference), 'done');
      assert.deepEqual(errors, []);
      receipts.push({
        name,
        unfinishedResume: true,
        completedPreference: true,
        filePreferenceIsolation: true,
        errors,
      });
    } finally {
      await context.close();
    }
    const blocked = await browser.newContext({
      viewport: { width: 360, height: 690 },
      extraHTTPHeaders: { DNT: '1' },
    });
    await blocked.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort(),
    );
    await blocked.addInitScript((key) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (item) {
        if (item === key) throw new DOMException('Preference denied', 'SecurityError');
        return get.call(this, item);
      };
      Storage.prototype.setItem = function (item, value) {
        if (item === key) throw new DOMException('Preference denied', 'SecurityError');
        return set.call(this, item, value);
      };
    }, preference);
    try {
      const page = await blocked.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/`);
      await page.locator('[data-go="new"]').click();
      await page.locator('#morning-guide').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('[data-guide-skip]').click();
      assert.equal(await page.locator('#morning-guide').count(), 0);
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.locator('[data-replay-guide]').click();
      await page.locator('#morning-guide').waitFor();
      assert.deepEqual(errors, []);
      receipts.push({ name, deniedPreferenceReadAndWrite: true, errors });
    } finally {
      await blocked.close();
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(`${output}/receipt.json`, JSON.stringify(receipts, null, 2));
console.log(JSON.stringify({ passed: receipts.length }));
