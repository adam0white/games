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
  const fastForward = page.clock.fastForward.bind(page.clock);
  let beforeAdvance: { date: number; performance: number } | undefined;
  page.clock.fastForward = async (time) => {
    beforeAdvance = await page.evaluate(() => {
      (window as unknown as { firstTick: number }).firstTick = 0;
      setTimeout(
        () => ((window as unknown as { firstTick: number }).firstTick += 1),
        100,
      );
      return { date: Date.now(), performance: performance.now() };
    });
    await fastForward(time);
  };
  await pauseClock(page);
  if (!beforeAdvance) throw new Error("Clock was not advanced");
  const afterAdvance = await page.evaluate(() => ({
    date: Date.now(),
    performance: performance.now(),
    firstTick: (window as unknown as { firstTick: number }).firstTick,
  }));
  expect(afterAdvance.date).toBe(beforeAdvance.date + 100);
  expect(afterAdvance.performance).toBe(beforeAdvance.performance + 100);
  expect(afterAdvance.firstTick).toBe(1);
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
