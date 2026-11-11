import { expect, type Page, test } from "@playwright/test";
import type { Command, Run, State } from "../src/host";

type Lab = {
  snapshot(): State;
  command(command: Command): void;
  export(): Run;
  replay(run: Run): State;
  hash(): string;
  metrics(): {
    rendererReady: boolean;
    comparisons: number;
    mismatches: number;
    malformedReceipts: number;
    queued: number;
  };
};
declare global {
  interface Window {
    Lefthand: Lab;
    HFBridge: { get_frame(): string };
  }
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.Lefthand.snapshot());
const advance = (page: Page, milliseconds = 120) =>
  page.clock.runFor(milliseconds);

// Skip intermediate rendered frames while retaining one normal 10 Hz host tick
// per 100ms clock step. This keeps a three-night wait bounded on software GPUs.
async function waitTicks(page: Page, ticks: number) {
  for (let tick = 0; tick < ticks; tick++) await page.clock.fastForward(100);
}

async function recover(page: Page) {
  if (!(await snapshot(page)).recoveryPending) return;
  await expect(page.locator("#recovery")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Explain");
  await page
    .getByRole("button", { name: "Explain", exact: true })
    .click({ force: true });
  await advance(page, 4_000);
  expect((await snapshot(page)).witness?.recovered).toBe("explain");
  await expect(page.locator("#recovery")).toBeHidden();
}

async function command(page: Page, value: Command) {
  await recover(page);
  if (value.type === "move")
    await page
      .locator(`[data-move="${value.dx},${value.dy}"]`)
      .click({ force: true });
  else if (value.type === "lantern")
    await page.locator("#lantern").click({ force: true });
  else if (value.type === "act")
    await page.locator("#act").click({ force: true });
  else await page.evaluate((input) => window.Lefthand.command(input), value);
  await advance(page);
  await recover(page);
}

// Derive paths from the same submitted village tiles that Godot draws.
async function walkTo(page: Page, target: "door" | "home") {
  const moves = await page.evaluate((destination) => {
    const frame = JSON.parse(window.HFBridge.get_frame()) as {
      player: { x: number; y: number };
      door: { x: number; y: number };
      home: { x: number; y: number };
      tiles: { x: number; y: number; wall: boolean }[];
    };
    const goal = frame[destination];
    const open = new Set(
      frame.tiles
        .filter((tile) => !tile.wall)
        .map((tile) => `${tile.x},${tile.y}`),
    );
    const queue = [{ ...frame.player, path: [] as Command[] }];
    const visited = new Set<string>();
    for (const point of queue) {
      if (Math.abs(point.x - goal.x) + Math.abs(point.y - goal.y) <= 1)
        return point.path;
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [0, 1],
        [1, 0],
      ] as const) {
        const x = point.x + dx;
        const y = point.y + dy;
        const key = `${x},${y}`;
        if (!open.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push({ x, y, path: [...point.path, { type: "move", dx, dy }] });
      }
    }
    throw new Error("No route to delivery landmark");
  }, target);
  for (const move of moves) await command(page, move);
}

async function verifyReplay(page: Page) {
  const result = await page.evaluate(() => {
    const run = window.Lefthand.export();
    const replay = window.Lefthand.replay(run);
    return {
      hash: window.Lefthand.hash(),
      exportedHash: run.finalHash,
      original: run.state,
      replay,
    };
  });
  expect(result.exportedHash).toBe(result.hash);
  expect(result.replay).toEqual(result.original);
}

for (const outcome of ["win", "loss"] as const) {
  test(`Godot renders a complete ${outcome} and exact replay`, async ({
    page,
  }) => {
    test.skip(
      outcome === "loss" && test.info().project.name !== "chromium-phone",
    );
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        value: "1",
        configurable: true,
      });
    });
    await page.clock.install();
    await page.goto("/");
    await expect
      .poll(
        () => page.evaluate(() => window.Lefthand?.metrics().rendererReady),
        {
          timeout: 110_000,
        },
      )
      .toBe(true);
    await expect(page.locator("#loading")).toBeHidden();
    await expect(page.locator("#canvas")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.Lefthand.metrics().comparisons))
      .toBeGreaterThan(0);
    const overflow = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter((node) => node.getBoundingClientRect().right > innerWidth)
        .map((node) => ({
          tag: node.tagName,
          id: node.id,
          width: node.getBoundingClientRect().width,
          style: node.getAttribute("style"),
        }))
        .slice(0, 8),
    }));
    if (overflow.width > overflow.viewport) {
      console.log("Overflow", JSON.stringify(overflow));
    }
    expect(overflow, "Village must fit the viewport").toMatchObject({
      width: overflow.viewport,
    });
    console.log("Godot renderer ready", outcome);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    for (let night = 1; night <= 3; night++) {
      await expect(page.locator("#evening")).toBeVisible();
      await page.locator("#route-door").click({ force: true });
      await advance(page);
      console.log("Night started", night, outcome);
      if (outcome === "win") {
        await walkTo(page, "door");
        await page.locator("#act").click({ force: true });
        await advance(page);
        await recover(page);
        expect((await snapshot(page)).deliveredTonight).toBe(true);
        await walkTo(page, "home");
        await page.locator("#act").click({ force: true });
        await advance(page);
      } else {
        // The forced encounter stops the clock. Resolve it before waiting for dawn.
        await waitTicks(page, 120);
        await recover(page);
        await waitTicks(page, 650);
      }
      await expect(page.locator("#morning")).toBeVisible();
      console.log("Morning", night, outcome);
      await expect(page.locator("#morning-lines p")).toHaveCount(5);
      await expect(page.locator("#morning-lines")).not.toContainText("Yusuf:");
      await expect(page.locator("#status")).toBeHidden();
      await expect(page.locator("#cold-warning")).toBeHidden();
      const state = await snapshot(page);
      expect(state.night).toBe(night);
      expect(state.history).toHaveLength(night);
      if (outcome === "win")
        expect(state.history[night - 1]?.witness?.recovered).toBe("explain");
      else expect(state.history[night - 1]?.witness).toBeNull();
      expect(state.deliveredTonight).toBe(outcome === "win");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator("#next").click({ force: true });
      await advance(page);
    }
    await expect(page.locator("#ending")).toBeVisible();
    await expect(page.locator("#ending-title")).toHaveText(
      outcome === "win"
        ? "Help reached them; trust was lost"
        : "The household needs more help",
    );
    await verifyReplay(page);
    const metrics = await page.evaluate(() => window.Lefthand.metrics());
    expect(metrics.comparisons).toBeGreaterThan(0);
    expect(metrics.mismatches).toBe(0);
    expect(metrics.malformedReceipts).toBe(0);
    expect(errors).toEqual([]);
  });
}

// Public export is gameplay support; replay verification remains a diagnostic.
test("ordinary menu exposes export beside collapsed diagnostics", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#menu-open").click();
  await expect(page.locator("#download")).toBeVisible();
  await expect(page.locator("#new")).toBeVisible();
  await expect(page.locator("#debug")).not.toHaveAttribute("open", "");
  await expect(page.locator("#verify")).toBeHidden();
  const privacy = await page
    .getByRole("link", { name: "Lab privacy", exact: true })
    .boundingBox();
  const debug = await page.locator("#debug summary").boundingBox();
  expect(privacy).not.toBeNull();
  expect(debug).not.toBeNull();
  expect(Math.abs((privacy?.y ?? 0) - (debug?.y ?? 0))).toBeLessThan(5);
  const download = page.waitForEvent("download");
  await page.locator("#download").click();
  expect((await download).suggestedFilename()).toMatch(/^lefthand-.*\.json$/);
  await page.locator("#debug summary").click();
  await page.locator("#verify").click();
  await expect(page.locator("#menu-status")).toContainText("Replay verified");
});
