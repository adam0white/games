import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { newGame, save } from '../src/sim/game.ts';

it('opens a current file without native storage, shelf or lab writes', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const external: string[] = [];
    await page.route('https://human.adamwhite.work/**', (route) => {
      external.push(route.request().url());
      return route.abort();
    });
    await page.addInitScript(() => {
      const attempts: string[] = [];
      (window as unknown as { fileWrites: string[] }).fileWrites = attempts;
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        attempts.push(`idb:${args[0]}`);
        return open(...args);
      };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        attempts.push(`storage:${key}`);
        return set.call(this, key, value);
      };
    });
    await page.goto(`${server.resolvedUrls!.local[0]}file/`);
    await page.locator('#hill-file').setInputFiles({
      name: 'hill.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(save(newGame(7)))),
    });
    await page.locator('#cv').waitFor();
    expect(await page.evaluate('window.__warren.game.fileOrigin')).toBe(true);
    await page.locator('#book').click();
    expect(await page.locator('#record-play').isDisabled()).toBe(true);
    expect(await page.locator('#send').isDisabled()).toBe(true);
    expect(await page.evaluate('window.fileWrites')).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
  }
}, 60000);
