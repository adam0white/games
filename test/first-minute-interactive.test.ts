import type { Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser } from './browser.ts';

let server: ViteDevServer;
let browser: Browser;
let origin: string;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  browser = await launchBrowser();
}, 30_000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

it('guides the first choice through actual controls without reading body text', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  try {
    await page.goto(origin);
    await page.locator('#new').click();
    const prompt = page.locator('[data-tutorial-target]');
    await expect.poll(() => prompt.count()).toBe(1);
    const target = page.locator('.tutorial-target');
    await expect.poll(() => target.count()).toBe(1);
    await page.waitForTimeout(350);
    await target.click();
    await expect.poll(() => page.locator('.journal .record-yours').count()).toBe(1);
    await expect.poll(() => page.locator('[data-tutorial-consequence]').count()).toBe(1);
    await page.locator('[data-tutorial-skip]').click();
    await expect.poll(() => page.locator('[data-tutorial-target]').count()).toBe(0);
    await page.locator('#menu').click();
    await expect.poll(() => page.locator('#bp-tutorial').count()).toBe(1);
  } finally {
    await page.close();
  }
}, 30_000);

it('offers a mute for the ten-second warning', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.locator('#menu').click();
    const mute = page.locator('#bp-sound');
    await expect.poll(() => mute.count()).toBe(1);
    await mute.click();
    expect(await mute.getAttribute('aria-pressed')).toBe('true');
    await page.locator('#bp-close').click();
    await page.locator('#menu').click();
    expect(await page.locator('#bp-sound').getAttribute('aria-pressed')).toBe('true');
  } finally {
    await page.close();
  }
}, 30_000);

it('labels the two voices separately from the choices', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.locator('#new').click();
    await page.locator('.opt').first().waitFor();
    expect(await page.locator('[data-voice="other"]').count()).toBe(1);
    expect(await page.locator('[data-voice="you"]').count()).toBe(1);
  } finally {
    await page.close();
  }
}, 30_000);

it('sounds once near ten seconds and stays silent when muted', async () => {
  for (const muted of [false, true]) {
    const page = await browser.newPage();
    try {
      await page.addInitScript((isMuted) => {
        if (isMuted) localStorage.setItem('murmur-warning-muted', '1');
        const host = window as unknown as { __tones: number; AudioContext: unknown };
        host.__tones = 0;
        host.AudioContext = class {
          state = 'running';
          currentTime = 0;
          destination = {};
          createOscillator() {
            return {
              frequency: { value: 0 },
              connect: (gain: unknown) => gain,
              start: () => host.__tones++,
              stop: () => {},
            };
          }
          createGain() {
            return {
              gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
              connect: () => {},
            };
          }
        };
      }, muted);
      await page.goto(origin);
      await page.locator('#new').click();
      await page.locator('.opt').first().waitFor();
      await page.evaluate(() => {
        const state = window.__murmur.state;
        if (!state?.card) throw new Error('Expected a card');
        state.minute = state.card.closesAt;
      });
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBe(0);
      await page.waitForTimeout(4_000);
      expect(await page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBe(
        muted ? 0 : 2,
      );
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBe(
        muted ? 0 : 2,
      );
    } finally {
      await page.close();
    }
  }
}, 60_000);

it('skip ahead stops at the next choice without answering it', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.locator('#new').click();
    await page.locator('.opt').first().waitFor();
    await page.waitForTimeout(350);
    await page.locator('.opt').first().click();
    await page.locator('#hurry').click();
    await page.locator('.opt').first().waitFor();
    const state = await page.evaluate(() => ({
      card: window.__murmur.state?.card,
      inputs: window.__murmur.state?.inputs,
    }));
    expect(state.card).not.toBeNull();
    expect(state.inputs).toHaveLength(1);
  } finally {
    await page.close();
  }
}, 30_000);

it('keeps the consequence visible until the player advances or skips the guide', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.locator('#new').click();
    await page.locator('.opt').first().waitFor();
    await page.waitForTimeout(350);
    await page.locator('.opt').first().click();
    await page.waitForTimeout(8000);
    expect(await page.locator('[data-tutorial-consequence]').count()).toBe(1);
    expect(await page.locator('#hurry').count()).toBe(1);
    await page.locator('#hurry').click();
    await page.locator('.opt').first().waitFor();
  } finally {
    await page.close();
  }
}, 30_000);

it('keeps the consequence and next control visible on a phone', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 }, reducedMotion: 'reduce' });
  try {
    await page.goto(origin);
    await page.locator('#new').click();
    await page.locator('.opt').first().waitFor();
    await page.waitForTimeout(350);
    await page.locator('.opt').first().click();
    const consequence = await page.locator('[data-tutorial-consequence]').boundingBox();
    const next = await page.locator('#hurry').boundingBox();
    expect(consequence).not.toBeNull();
    expect(next).not.toBeNull();
    expect(next!.y + next!.height).toBeLessThanOrEqual(690);
    expect(
      await page.locator('#hurry').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
  } finally {
    await page.close();
  }
}, 30_000);
