// Serves experiments itself. No external requests reach the lab. Pointer events use the actual page listeners.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  shots = "/private/tmp/night-breath";
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
let failed = 0;
try {
  for (const [name, engine, device] of [
    ["webkit", webkit, devices["iPhone 13"]],
    ["chromium", chromium, devices["Pixel 7"]],
  ]) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage(),
      errors = [],
      records = [];
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
      await page.waitForFunction(() => window.breathState);
      await page.evaluate(() =>
        localStorage.setItem("hf-lab-send-localhost", "1"),
      );
      await page.reload();
      await page.waitForFunction(() => window.breathState);
      assert.match(
        await page.textContent("#menu"),
        /The game lab records play/,
      );
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-menu.png`) });
      await page.click("#play");
      assert.equal((await state(page)).screen, "play");
      await bounds(page);
      await page.waitForTimeout(3300);
      assert.equal(
        (await state(page)).progress,
        0,
        "waiting does not move the firefighter",
      );
      await finger(page, true);
      await page.waitForFunction(
        () => window.breathState().progress > 0.06,
        undefined,
        { timeout: 15000 },
      );
      const moved = await state(page);
      assert.ok(moved.progress > 0.06, "holding moves along route");
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
        mid = false;
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
          await page.screenshot({ path: join(shots, `${name}-mid-play.png`) });
          mid = true;
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
      await page.screenshot({ path: join(shots, `${name}-end.png`) });
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
      await page.waitForFunction(() => window.breathState);
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
      await page.screenshot({ path: join(shots, `${name}-360-menu.png`) });
      await page.click("#play");
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-360-play.png`) });
      await page.click("#pause");
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-360-pause.png`) });
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
      await page.reload();
      await page.waitForFunction(() => window.breathState);
      assert.equal((await state(page)).sound, false, "sound setting persists");
      await bounds(page);
      assert.deepEqual(
        errors,
        [],
        "zero page, console, request and HTTP errors",
      );
      console.log(
        `PASS ${name}: level1 ${done.t.toFixed(1)}s, ${done.rescued}/${done.people.length} rescued, ${done.stars} stars; ${input.presses} holds/${input.releases} releases; 0 page/console errors; save, daily, pause, keyboard,360px and desktop pass`,
      );
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}:`, e);
      console.error(errors);
      await page
        .screenshot({ path: join(shots, `${name}-failure.png`) })
        .catch(() => {});
    } finally {
      await ctx.close();
      await browser.close();
    }
  }
} finally {
  await new Promise((done) => server.close(done));
}
process.exitCode = failed ? 1 : 0;
