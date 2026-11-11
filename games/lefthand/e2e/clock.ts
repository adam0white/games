import type { Page } from "@playwright/test";

// Freeze the wall time before pausing so command latency cannot move the target
// into the past. Restore advancing wall time after the clock is paused.
export async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(now);
  await page.clock.pauseAt(now);
  await page.clock.setSystemTime(now);
}
