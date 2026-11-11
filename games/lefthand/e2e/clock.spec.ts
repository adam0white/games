import { expect, test } from "@playwright/test";
import { pauseClock } from "./clock";

test("pauses despite delayed clock commands and advances timers normally", async ({
  page,
}) => {
  await page.clock.install();
  await page.setContent("<p>Clock control</p>");
  const pauseAt = page.clock.pauseAt.bind(page.clock);
  page.clock.pauseAt = async (time) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await pauseAt(time);
  };
  await pauseClock(page);
  const before = await page.evaluate(() => {
    (window as unknown as { fired: number }).fired = 0;
    setTimeout(
      () => ((window as unknown as { fired: number }).fired += 1),
      100,
    );
    return { date: Date.now(), performance: performance.now() };
  });
  await page.clock.runFor(100);
  const after = await page.evaluate(() => ({
    date: Date.now(),
    performance: performance.now(),
    fired: (window as unknown as { fired: number }).fired,
  }));
  expect(after.date).toBe(before.date + 100);
  expect(after.performance).toBe(before.performance + 100);
  expect(after.fired).toBe(1);
});
