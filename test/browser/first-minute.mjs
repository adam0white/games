// Uses a fresh synthetic file opening and never reads body copy.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { newGame } from '../../src/sim/dam.ts';
import { exportCurrent } from '../../src/sim/run.ts';

const run = JSON.stringify({
  run: exportCurrent(newGame(7)),
  runId: 'synthetic-test',
  heads: [],
  fileOrigin: false,
  sources: [],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    localStorage.setItem('hf-lab-player', '1234567890abcdef1234567890abcdef');
    localStorage.setItem('hf-lab-recording-off', '1');
  });
  await page.goto(process.env.GLANCE_TEST_URL ?? 'http://127.0.0.1:5189/?file=1');
  await page
    .locator('#file')
    .setInputFiles({ name: 'opening.json', mimeType: 'application/json', buffer: Buffer.from(run) });
  await page.locator('.tutorial-cue[data-cue=read]').waitFor({ timeout: 30000 });
  await page.locator('.tutorial-target[data-job=level]').click();
  await page.locator('.tutorial-cue[data-cue=radio]').waitFor();
  for (let i = 0; i < 120 && !(await page.locator('.tutorial-cue[data-cue=gate]').count()); i++) {
    if (
      (await page.locator('#skip').isEnabled()) &&
      (await page.locator('#skip').innerText()).includes('Skip')
    )
      await page.locator('#skip').click();
    await page.waitForTimeout(500);
  }
  await page.locator('.tutorial-cue[data-cue=gate]').waitFor({ timeout: 1000 });
  assert.match(await page.locator('.tutorial-cue').innerText(), /New report since the request: Level:/);
  await page.locator('.tutorial-target[data-g=gate]').click();
  await page.locator('.tutorial-target[data-job=gate]').click();
  await page.locator('.tutorial-cue[data-cue=radio]').waitFor();
  for (let i = 0; i < 120 && !(await page.locator('.tutorial-cue[data-cue=answer]').count()); i++) {
    if (
      (await page.locator('#skip').isEnabled()) &&
      (await page.locator('#skip').innerText()).includes('Skip')
    )
      await page.locator('#skip').click();
    await page.waitForTimeout(500);
  }
  await page.locator('.tutorial-cue[data-cue=answer]').waitFor({ timeout: 1000 });
  assert.match(await page.locator('.tutorial-cue').innerText(), /New report since the request: Gate: 1/);
  assert.match(await page.locator('[data-g=gate]').innerText(), /1\s*\/\s*6/);
  await page.locator('.tutorial-cue button').click();
  assert.equal(await page.locator('.tutorial-cue').count(), 0);
  await page.locator('#menu').click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await page.locator('.tutorial-cue').waitFor();
  await page.locator('.tutorial-cue button').click();
  assert.equal(await page.locator('.tutorial-cue').count(), 0);
  const early = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await early.addInitScript(() => {
    localStorage.setItem('hf-lab-player', 'abcdef0123456789abcdef0123456789');
    localStorage.setItem('hf-lab-recording-off', '1');
  });
  await early.goto(process.env.GLANCE_TEST_URL ?? 'http://127.0.0.1:5189/?file=1');
  await early
    .locator('#file')
    .setInputFiles({ name: 'opening.json', mimeType: 'application/json', buffer: Buffer.from(run) });
  await early.locator('.tutorial-target[data-job=level]').click();
  await early.locator('.tutorial-cue[data-cue=radio]').waitFor();
  await early.locator('[data-g=gate]').click();
  await early.locator('.tutorial-cue[data-cue=gate-choice]').waitFor();
  assert.match(await early.locator('.tutorial-cue').innerText(), /Overtopping ends the watch/);
  await early.locator('.tutorial-target[data-job=gate]').click();
  const direct = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await direct.addInitScript(() => {
    localStorage.setItem('hf-lab-player', 'fedcba9876543210fedcba9876543210');
    localStorage.setItem('hf-lab-recording-off', '1');
  });
  await direct.goto(process.env.GLANCE_TEST_URL ?? 'http://127.0.0.1:5189/?file=1');
  await direct
    .locator('#file')
    .setInputFiles({ name: 'opening.json', mimeType: 'application/json', buffer: Buffer.from(run) });
  await direct.locator('[data-g=gate]').click();
  await direct.locator('.tutorial-cue[data-cue=gate-choice]').waitFor();
  await direct.evaluate(() => window.__glance.step(1));
  assert.equal(
    await direct.locator('[data-job=gate]').first().getAttribute('aria-describedby'),
    'tutorial-cue',
  );
  assert.equal(
    await direct
      .locator('[data-job=gate]')
      .first()
      .evaluate((el) => el.classList.contains('tutorial-target')),
    true,
  );
  await direct.locator('.tutorial-target[data-job=gate]').click();
  console.log('PASS: real requests, newer reports, direct gate risk cue, skip and replay');
} finally {
  await browser.close();
}
