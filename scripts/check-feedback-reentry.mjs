// Run against the dev server; PLAYWRIGHT_MODULE may name an installed Playwright ESM entry.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 360, height: 690 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    await page.route('https://human.adamwhite.work/**', route => route.fulfill({ status: 204, body: '' }));
    await page.goto(process.env.FEEDBACK_URL || 'http://127.0.0.1:5198');
    await page.evaluate(async () => {
      const { lab } = await import('/src/lab.ts');
      const { continuity } = await import('/src/continuity.ts');
      lab.setPersonaRecording('unverified-feedback-fixture');
      window.recordingChoices = [];
      continuity.recording = allow => {
        window.recordingChoices.push(allow);
        return window.recordingChoices.length === 1 ? new Promise(() => {}) : Promise.reject(new Error('epoch changed'));
      };
      window.feedbackNotes = [];
      lab.sendFeedback = async note => {
        window.feedbackNotes.push(note);
        return `receipt-${window.feedbackNotes.length}`;
      };
    });
    const openFeedback = async () => {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('button', { name: /^Send word/ }).click();
    };
    await openFeedback();
    const sheet = page.locator('.sw-feedback');
    await sheet.getByRole('checkbox', { name: /Link all continuing histories/ }).click();
    await page.waitForFunction(() => window.recordingChoices.length === 1);
    await sheet.locator('textarea').fill('First note');
    await sheet.getByRole('button', { name: "I'd keep playing", exact: true }).click();
    await sheet.getByRole('button', { name: 'Send', exact: true }).click();
    await sheet.getByRole('status').filter({ hasText: 'receipt-1' }).waitFor();
    // The menu overlays the mounted success sheet; its next entry must start a new session.
    await openFeedback();
    assert.equal(await sheet.locator('textarea').inputValue(), '', 'second entry clears the first note');
    assert.equal(await sheet.locator('[aria-pressed="true"]').count(), 0, 'second entry clears the verdict');
    assert.equal(await sheet.getByRole('status').count(), 0, 'second entry clears the old receipt');
    await sheet.getByRole('checkbox', { name: /Link all continuing histories/ }).click();
    await page.waitForFunction(() => window.recordingChoices.length === 2);
    await sheet.locator('textarea').fill('Second note');
    const send = sheet.getByRole('button', { name: 'Send', exact: true });
    assert.equal(await send.isEnabled(), true, 'second entry can send');
    await send.click();
    await sheet.getByRole('status').filter({ hasText: 'receipt-2' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.recordingChoices), [true, true]);
    assert.deepEqual(await page.evaluate(() => window.feedbackNotes), ['Verdict: keep\n\nFirst note', 'Second note']);
    console.log(`Feedback success -> menu -> fresh submission passed at ${viewport.width}x${viewport.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
