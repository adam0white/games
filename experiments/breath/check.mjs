// Serves experiments itself. No external requests reach the lab. Pointer events use the actual page listeners.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  shots = process.env.SHOTS || "/private/tmp/night-r3-review/breath/check";
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://local");
  if (u.pathname === "/notes/button.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end("/* notes UI belongs to the deployed host */");
  }
  if (u.pathname === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }
  let file = resolve(root, "." + decodeURIComponent(u.pathname));
  if (u.pathname.endsWith("/")) file = join(file, "index.html");
  try {
    assert.ok(file.startsWith(root + sep));
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".css": "text/css",
        }[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(
  join(
    resolve(
      process.env.PLAYWRIGHT ||
        "/Users/abdul/code/human-framework/node_modules",
    ),
    "x.js",
  ),
);
const { webkit, chromium, devices } = require("playwright");
const state = (page) => page.evaluate(() => window.breathState());
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const shot = (page, name) => page.screenshot({ path: join(shots, name + ".png"), timeout: 90000 });
async function ready(page, engine) {
  await page.waitForFunction(() => window.breathState, undefined, { polling: 50 });
  if (engine === "webkit") {
    const view = page.viewportSize();
    await page.setViewportSize({ ...view, width: view.width - 1 });
    await page.setViewportSize(view);
  }
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#c");
    return canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3] === 255;
  }, undefined, { polling: 50 });
}
function landscapeFloors(view) {
  const count = view.floors.filter(
    (y) => y - view.floorHeight + 12 >= view.top && y + 13 <= view.bottom,
  ).length;
  assert.ok(count >= 2, `${count} complete floors visible in landscape`);
  if (view.toast)
    assert.ok(view.toast.y + view.toast.height <= view.top, "toast stays above the building");
  return count;
}
async function finger(page, down) {
  await page.evaluate((down) => {
    document.querySelector("#c").dispatchEvent(
      new PointerEvent(down ? "pointerdown" : "pointerup", {
        pointerId: 17,
        pointerType: "touch",
        isPrimary: true,
        clientX: 110,
        clientY: 400,
        pressure: down ? 0.5 : 0,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, down);
}
async function bounds(page) {
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter(
        (b) =>
          b.getBoundingClientRect().width && b.getBoundingClientRect().height,
      )
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return (
          r.width < 48 ||
          r.height < 48 ||
          r.x < 0 ||
          r.y < 0 ||
          r.right > innerWidth + 0.1 ||
          r.bottom > innerHeight + 0.1
        );
      })
      .map((b) => b.id || b.textContent),
  );
  assert.deepEqual(bad, [], "visible touch targets at least48px and on screen");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "no horizontal overflow",
  );
}
async function landscapeCard(page, screen) {
  await bounds(page);
  const card = await page.locator(screen).evaluate((el) => ({
    visible: el.clientHeight,
    content: el.scrollHeight,
  }));
  assert.ok(card.content <= card.visible, `${screen} fits without scrolling: ${card.content}px / ${card.visible}px`);
}
let failed = 0;
try {
  for (const [name, engine, phone] of [
    ["webkit", webkit, "iPhone 13"],
    ["chromium", chromium, "Pixel 7"],
  ]) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...devices[phone] });
    const page = await ctx.newPage(),
      errors = [],
      records = [];
    await page.addInitScript(() => {
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      window.breathText = { timers: new Set() };
      CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
        if (this.canvas.id === "c") {
          if (/^(?:HOLD|RELEASE) TO /.test(value)) breathText.control = value;
          if (/^[↑↓] /.test(value)) breathText.rescue = value;
          if (/^\d+:\d\d$/.test(value)) {
            breathText.timer = value;
            breathText.timers.add(value);
          }
        }
        return fillText.call(this, value, ...args);
      };
    });
    page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    page.on("requestfailed", (r) => errors.push(`request: ${r.url()}`));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await ctx.route("https://human.adamwhite.work/**", async (route) => {
      const req = route.request(),
        headers = {
          "access-control-allow-origin": base,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      records.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
      await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "application/json" },
        body: '{"ok":true}',
      });
    });
    try {
      await page.goto(`${base}/breath/?seed=1801&labRunSource=agent`);
      await ready(page, name);
      await page.evaluate(() =>
        localStorage.setItem("hf-lab-send-localhost", "1"),
      );
      await page.reload();
      await ready(page, name);
      assert.match(
        await page.textContent("#menu"),
        /The game lab records play/,
      );
      await bounds(page);
      await shot(page, `${name}-menu`);
      await page.setViewportSize(devices[`${phone} landscape`].viewport);
      await landscapeCard(page, "#menu");
      await shot(page, `${name}-landscape-fresh`);
      await page.setViewportSize(devices[phone].viewport);
      await page.click("#play");
      assert.equal((await state(page)).screen, "play");
      await bounds(page);
      await page.waitForFunction(() => breathText.timers.has("4:00"));
      await page.waitForTimeout(3300);
      await page.waitForFunction(() => window.breathState().hint === "hold-release");
      assert.notEqual(await page.evaluate(() => breathText.timer), "4:00", "campaign countdown ticks in play");
      await shot(page, `${name}-hold-release`);
      const gesture = await page.locator(".kit-hint.on .hand").evaluate((hand) => {
        const animation = hand.getAnimations().find((a) => a.animationName === "breath-hint-hand");
        animation.pause();
        const positions = [500, 1500, 2100].map((ms) => {
          animation.currentTime = ms;
          const m = new DOMMatrix(getComputedStyle(hand).transform);
          return [m.m41, m.m42];
        });
        animation.play();
        return positions;
      });
      assert.deepEqual(gesture, [[0, 0], [0, 0], [0, -19]], "the first hint holds in place for at least 1s before lifting");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => document.querySelector(".kit-hint.still"));
      assert.equal(await page.locator(".kit-hint .label").isVisible(), true);
      await shot(page, `${name}-still-hint`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      assert.equal(
        (await state(page)).progress,
        0,
        "waiting does not move the firefighter",
      );
      await finger(page, true);
      assert.equal((await state(page)).hint, null, "play input dismisses the idle hint");
      assert.equal(await page.locator(".kit-hint").count(), 0);
      await page.waitForFunction(
        () => window.breathState().progress > 0.06,
        undefined,
        { timeout: 15000 },
      );
      const moved = await state(page);
      assert.ok(moved.progress > 0.06, "holding moves along route");
      assert.equal(await page.evaluate(() => breathText.control), "RELEASE TO BREATHE");
      await page.waitForFunction(
        () => window.breathState().progress > 0.44 && breathText.control === "RELEASE TO CROUCH",
      );
      await finger(page, false);
      const stopped = await state(page);
      await sleep(300);
      assert.equal(
        (await state(page)).progress,
        stopped.progress,
        "release stops movement",
      );
      await page.click("#pause");
      const paused = await state(page);
      await sleep(250);
      assert.equal((await state(page)).t, paused.t, "pause freezes simulation");
      await page.click("#resume");
      await page.keyboard.down("p");
      assert.equal((await state(page)).screen, "paused");
      await page.keyboard.down("p");
      assert.equal((await state(page)).screen, "paused", "repeating a pause key never resumes");
      await page.keyboard.up("p");
      await page.click("#resume");
      await page.mouse.move(110, 400);
      await page.mouse.down();
      await sleep(180);
      await page.mouse.move(340, 610);
      await page.mouse.up();
      assert.equal(
        (await state(page)).held,
        false,
        "release away from press ends captured hold",
      );
      await page.keyboard.down("Space");
      await sleep(200);
      await page.keyboard.up("Space");
      assert.ok(
        (await state(page)).progress > moved.progress,
        "keyboard holds move",
      );
      await page.evaluate(() => dispatchEvent(new Event("blur")));
      assert.equal((await state(page)).screen, "paused");
      await page.keyboard.press("P");
      assert.equal((await state(page)).screen, "play");
      await page.evaluate(() => dispatchEvent(new Event("pagehide")));
      assert.equal((await state(page)).screen, "paused");
      await page.click("#resume");
      // The policy chooses only press/release. Playwright sends actual browser mouse pointer input,
      // including hit testing and pointer capture, on each phone profile. No state edits or time skipping.
      await page.mouse.move(110, 400);
      let down = false,
        mid = false,
        releaseCue = false,
        rooftopFloors = 0;
      const input = { presses: 0, releases: 0, maxFX: 0 },
        deadline = Date.now() + 200000;
      while ((await state(page)).screen === "play") {
        assert.ok(
          Date.now() < deadline,
          "level completed within200s wall time",
        );
        const frame = await page.evaluate(() => ({
          state: window.breathState(),
          want: window.breathAdvice(),
        }));
        input.maxFX = Math.max(input.maxFX, frame.state.fx);
        if (!releaseCue && frame.state.hint === "release") {
          await shot(page, `${name}-release-cue`);
          releaseCue = true;
        }
        if (frame.want !== down) {
          if (frame.want) {
            await page.mouse.down();
            input.presses++;
          } else {
            await page.mouse.up();
            input.releases++;
          }
          down = frame.want;
        }
        if (!mid && frame.state.progress > 3) {
          await shot(page, `${name}-mid-play`);
          mid = true;
        }
        if (!rooftopFloors && frame.state.progress > 3.9) {
          await page.setViewportSize(devices[`${phone} landscape`].viewport);
          await page.waitForFunction(() => {
            const { top, floorHeight, floors } = window.breathState().view;
            const roof = floors.at(-1) - floorHeight + 12;
            return innerWidth > innerHeight && roof >= top && roof < top + 18;
          });
          rooftopFloors = landscapeFloors((await state(page)).view);
          assert.equal(
            await page.evaluate(() => breathText.rescue),
            "↓ Out · 0/1",
            "a joined follower has not been rescued until reaching the street",
          );
          await shot(page, `${name}-landscape-roof`);
          await page.setViewportSize(devices[phone].viewport);
        }
        await sleep(45);
      }
      if (down) await page.mouse.up();
      const done = await state(page);
      assert.equal(
        done.over,
        "win",
        "level1 completed by real browser pointer timing",
      );
      assert.equal(done.rescued, done.people.length);
      assert.ok(done.stars >= 1);
      assert.equal(await page.locator("#again").isVisible(), true, "a win keeps the replay action");
      assert.ok(releaseCue, "the first wave showed a release cue while holding");
      assert.ok(
        input.presses >= 3 && input.releases >= 2,
        "crossing includes several holds and releases",
      );
      assert.ok(
        input.maxFX > 0 && done.confetti > 0,
        "actions and win emit particles",
      );
      await bounds(page);
      await sleep(150);
      await shot(page, `${name}-end`);
      await page.setViewportSize({ width: 568, height: 320 });
      await bounds(page);
      await shot(page, `${name}-landscape-end`);
      await page.setViewportSize(devices[phone].viewport);
      const blob = await page.evaluate(() =>
        localStorage.getItem("breath-save"),
      );
      const saved = JSON.parse(blob);
      assert.ok(
        saved.stars["1"] > 0 && saved.opened >= 2,
        "stars unlock next level",
      );
      await sleep(400);
      const runs = records.filter(
        (r) =>
          r.game === "breath" && r.kind === "run" && r.data.outcome === "win",
      );
      assert.equal(runs.length, 1, "one recording of completed level");
      assert.equal(runs[0].runSource, "agent");
      assert.ok(
        runs[0].data.events.some((e) => e.type === "join"),
        "pickup recorded",
      );
      await page.reload();
      await ready(page, name);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("breath-save")),
        blob,
        "save survives reload",
      );
      await page.click("#daily");
      const d = await state(page);
      assert.equal(d.daily, true);
      assert.ok(Number.isInteger(d.seed));
      const seed = d.seed;
      await page.mouse.move(110, 400);
      await page.mouse.down();
      await page.waitForFunction(
        () => window.breathState().progress > 0.06,
        undefined,
        { timeout: 15000 },
      );
      await page.mouse.up();
      await page.click("#pause");
      await page.click("#restart");
      assert.ok(
        JSON.parse(
          await page.evaluate(() => localStorage.getItem("breath-save")),
        ).daily[d.date] > 0,
        "daily score saved on restart",
      );
      assert.equal(
        (await state(page)).seed,
        seed,
        "daily restart keeps shared UTC date seed",
      );
      await page.click("#pause");
      await page.click("#sound");
      assert.equal((await state(page)).sound, false);
      await page.click('[data-look="ember"]');
      await page.click("#toMenu");
      await sleep(400);
      await page.setViewportSize({ width: 360, height: 640 });
      await bounds(page);
      await shot(page, `${name}-360-menu`);
      await page.click("#play");
      await page.waitForFunction(() => window.breathState().t > 0);
      await bounds(page);
      await shot(page, `${name}-360-play`);
      await page.click("#pause");
      await bounds(page);
      await shot(page, `${name}-360-pause`);
      await page.click("#toMenu");
      await sleep(400);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.click("#play");
      await page.keyboard.down("Space");
      await sleep(250);
      await page.keyboard.up("Space");
      assert.ok((await state(page)).progress > 0, "desktop keyboard input");
      await page.click("#pause");
      await page.click("#toMenu");
      await sleep(400);
      await page.setViewportSize(devices[`${phone} landscape`].viewport);
      await page.click("#play");
      await page.waitForFunction(() => window.breathState().t > 0);
      await bounds(page);
      const landscape = (await state(page)).view;
      assert.ok(landscape.toast, "opening level toast visible in landscape");
      const visibleFloors = landscapeFloors(landscape);
      await shot(page, `${name}-landscape`);
      await page.setViewportSize({ width: 568, height: 320 });
      const compactFloors = landscapeFloors((await state(page)).view);
      await bounds(page);
      await shot(page, `${name}-landscape-compact`);
      await page.click("#pause");
      await landscapeCard(page, "#paused");
      await shot(page, `${name}-landscape-pause`);
      await page.click("#toMenu");
      await sleep(400);
      await landscapeCard(page, "#menu");
      await page.click("#choose");
      await landscapeCard(page, "#select");
      await shot(page, `${name}-landscape-levels`);
      await page.locator("#levels button").nth(1).tap();
      assert.equal((await state(page)).level, 2, "the unlocked level opens in landscape");
      await page.mouse.move(210, 200);
      await page.mouse.down();
      await page.waitForFunction(() => window.breathState().progress > 0.06);
      await page.mouse.up();
      await page.reload();
      await ready(page, name);
      assert.equal((await state(page)).screen, "menu", "mid-level reload returns to menu");
      assert.equal((await state(page)).opened, 2, "mid-level reload preserves the unlocked level");
      assert.equal((await state(page)).sound, false, "sound setting persists");
      await bounds(page);
      await page.click("#choose");
      await page.locator("#levels button").first().tap();
      await page.mouse.move(210, 200);
      await page.mouse.down();
      await page.waitForFunction(() => window.breathState().screen === "end");
      await page.mouse.up();
      const lost = await state(page);
      assert.equal(lost.over, "lost");
      assert.equal(await page.locator("#endTitle").textContent(), "Take a breather");
      assert.equal(await page.locator("#again").isVisible(), false, "loss has one retry action");
      assert.equal(await page.locator("#next").textContent(), "Try again");
      await shot(page, `${name}-landscape-loss`);
      await page.locator("#next").tap();
      assert.equal((await state(page)).screen, "play");
      assert.equal((await state(page)).progress, 0, "loss retry starts at the street");
      await page.clock.install();
      await page.evaluate(() => {
        // The idle deadline only needs the game's normal 120ms maximum frame interval.
        window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 120);
      });
      await page.click("#pause");
      await page.click("#restart");
      await page.clock.runFor(241_000);
      assert.equal((await state(page)).over, "lost");
      assert.equal(await page.locator("#endTitle").textContent(), "Time ran out");
      assert.equal(await page.evaluate(() => breathText.timer), "0:00", "the clock reaches zero on timeout");
      assert.deepEqual(
        errors,
        [],
        "zero page, console, request and HTTP errors",
      );
      console.log(
        `PASS ${name}: level1 ${done.t.toFixed(1)}s, ${done.rescued}/${done.people.length} rescued, ${done.stars} stars; ${input.presses} holds/${input.releases} releases; continuous hold lost at ${lost.t.toFixed(2)}s; landscape floors ${visibleFloors} entry/${rooftopFloors} roof/${compactFloors} compact; 0 page/console errors; hints, save, daily, pause, keyboard, 360px and desktop pass`,
      );
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}:`, e);
      console.error(errors);
      await shot(page, `${name}-failure`).catch(() => {});
    } finally {
      await ctx.close();
      await browser.close();
    }
  }
} finally {
  await new Promise((done) => server.close(done));
}
process.exitCode = failed ? 1 : 0;
