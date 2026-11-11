import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('reads only this game’s remembered feedback name and leaves old and other keys untouched', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.evaluate(() => {
      localStorage.setItem('hf-lab-feedback-name', 'legacy');
      localStorage.setItem('glance-hf-lab-feedback-name', 'other game');
      localStorage.setItem('hf-lab-feedback-name:goodhands', 'own name');
    });
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    expect(await page.locator('[data-feedback-name]').inputValue()).toBe('own name');
    expect(await page.evaluate(() => localStorage.getItem('hf-lab-feedback-name'))).toBe('legacy');
    expect(await page.evaluate(() => localStorage.getItem('glance-hf-lab-feedback-name'))).toBe('other game');
  } finally {
    await browser.close();
    await server.close();
  }
}, 60_000);
