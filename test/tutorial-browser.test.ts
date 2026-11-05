import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, test } from 'vitest';
import { newGame } from '../src/sim/index.ts';
import { exportRun } from '../src/ui/export.ts';

test('first minute follows highlighted controls without reading body text', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    await page.goto(server.resolvedUrls!.local[0]!);
    const run = exportRun(newGame(7), []);
    await page.evaluate(`import('/src/ui/store.ts').then(({put}) => put('run', ${JSON.stringify(run)}))`);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    const targets = page.locator('.tutorial-target');
    const target = targets.first();
    await expect.poll(() => targets.count()).toBeGreaterThan(0);
    await target.click();
    await expect.poll(() => target.getAttribute('data-action')).toBe('interview');
    const promptBox = await page.locator('.tutorial-prompt').boundingBox();
    expect(promptBox?.width).toBeGreaterThan(250);
    expect(await page.getByRole('button', { name: 'Skip tutorial' }).isVisible()).toBe(true);
    await target.click();
    await expect.poll(() => target.getAttribute('data-testid')).toBe('scene-choice');
    const before = await page.locator('[data-time]').textContent();
    await target.click();
    await expect.poll(() => target.getAttribute('class')).toContain('exchange');
    const after = await page.locator('[data-time]').textContent();
    expect(after).not.toBe(before);
    expect(await page.locator('.tutorial-prompt').textContent()).toContain(`${before} → ${after}`);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(await targets.count()).toBe(0);
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    expect(await targets.count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Skip tutorial' }).click();
    expect(await targets.count()).toBe(0);
  } finally {
    await browser.close();
    await server.close();
  }
});
