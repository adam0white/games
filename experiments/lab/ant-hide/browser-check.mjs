import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { webkit, chromium, devices } = createRequire('/Users/abdul/code/human-framework/')('playwright');

for (const [engine, name] of [[webkit, 'iPhone 13'], [chromium, 'Pixel 7']]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ ...devices[name] });
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        const tick = now => window.freezeGameFrame ? raf(tick) : callback(now);
        return raf(tick);
      };
    });
    await page.goto('http://127.0.0.1:8802/lab/ant-hide/?seed=7');
    const prefix = name.replaceAll(' ', '-');
    await page.waitForFunction(() => window.__ant?.mode === 'menu');
    await page.waitForTimeout(250);
    const screenshot = suffix => page.screenshot({ path: prefix + '-' + suffix + '.png', animations: 'disabled', scale: 'css' });
    await page.locator('#menu').screenshot({ path: prefix + '-menu.png', animations: 'disabled', scale: 'css' });
    async function tap(selector) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box, selector);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    await tap('#continue');
    await page.waitForFunction(() => {
      const a = window.__ant;
      if (!a.s?.mobs.find(mob => mob.teaching)?.seesPlayer) return false;
      window.freezeGameFrame = true;
      return true;
    });
    const openingDetection = await page.evaluate(() => window.__ant.s.t);
    assert.ok(openingDetection >= 3 && openingDetection < 20, 'tutorial detection within 3–20 seconds');
    await screenshot('play');
    await page.evaluate(() => {
      const { s } = window.__ant;
      s.rocks = [];
      s.grass = [{ x: 1050, y: 1000, r: 30 }];
      Object.assign(s.player, { x: 1000, y: 1000, safe: 0 });
      s.mobs = [{ id: 1, f: 4, x: 920, y: 1000, a: 0, want: 0, timer: 99, alert: false, walk: false, ph: 0 }];
      window.freezeGameFrame = false;
    });
    await page.waitForFunction(() => {
      if (!window.__ant.s.mobs[0].seesPlayer) return false;
      window.freezeGameFrame = true;
      return true;
    });
    await page.waitForTimeout(100);
    await screenshot('eye');
    await page.evaluate(() => {
      window.freezeGameFrame = false;
      const cv = document.querySelector('#c');
      cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, pointerType: 'touch', clientX: 100, clientY: 600 }));
      cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, pointerType: 'touch', clientX: 155, clientY: 600 }));
    });
    await page.waitForFunction(() => {
      if (window.__ant.s.player.x < 1050) return false;
      document.querySelector('#c').dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, pointerType: 'touch' }));
      return true;
    });
    await page.waitForFunction(() => {
      if (!window.__ant.s.hidden || !(window.__ant.s.mobs[0].search > 0)) return false;
      window.freezeGameFrame = true;
      return true;
    });
    await screenshot('search');
    await page.evaluate(() => { window.freezeGameFrame = false; });
    await page.waitForFunction(() => {
      if (!(window.__ant.s.escapes > 0)) return false;
      window.freezeGameFrame = true;
      return true;
    });
    assert.equal(await page.locator('#say').textContent(), 'It lost you.');
    await screenshot('escape');
    const startingTicks = await page.evaluate(() => {
      window.__ant.s.player.safe = 100;
      window.freezeGameFrame = false;
      return window.__ant.ticks;
    });
    await page.waitForFunction(before => window.__ant.ticks - before >= 600, startingTicks);
    const elapsedTicks = await page.evaluate(before => window.__ant.ticks - before, startingTicks);
    await tap('#pause');
    const paused = await page.evaluate(() => window.__ant.ticks);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__ant.ticks), paused);
    await tap('#resume');
    await page.waitForFunction(before => window.__ant.ticks > before + 5, paused);
    await page.evaluate(() => {
      const a = window.__ant;
      const p = a.s.player;
      const mob = a.s.mobs.find(m => a.powerOf(m) > a.me(a.s).power);
      a.s.mobs = [mob];
      Object.assign(mob, { x: p.x + 2, y: p.y, a: Math.PI, stun: 0 });
      p.safe = 0;
    });
    await page.waitForFunction(() => window.__ant.mode === 'dead');
    await screenshot('end');
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    console.log(name, JSON.stringify({ openingDetection, elapsedTicks, pausedTicks: paused, deathHeading: await page.locator('#deadSay').textContent(), errors, failures }));
  } finally {
    await browser.close();
  }
}
