// The trail painter's touch rules (gestures.js): no order the player did not mean, whatever the fingers do.
// Random interleavings of three pointers (down, move, up, cancel, resets for focus loss or a layer switch, frame
// ticks) are checked against an oracle that tracks the fingers physically down. Two planted faults must fail.
import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLD_MS, makeGestures } from '../gestures.js';

const TOOLS = ['trail', 'dig', 'alarm', 'camera'];

function lcg(seed) { let r = seed >>> 0 || 1; return n => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r % n; }; }

/** Runs one random session; returns the violations found. */
function session(make, seed, steps = 120) {
  const rand = lcg(seed), g = make(), bad = [];
  const down = new Map(); // physically down: id -> { clean, x, y }
  let t = 0, tool = TOOLS[rand(4)], alarmLive = false;
  const check = (acts, id) => {
    for (const a of acts) {
      if (a.type === 'order') {
        const f = down.get(id);
        if (!f || !f.clean) bad.push({ seed, t, a: 'order from a finger that was not alone and clean', id });
      }
      if (a.type === 'alarm' && a.phase === 'start') {
        const clean = [...down.values()].filter(f => f.clean);
        if (down.size !== 1 || clean.length !== 1) bad.push({ seed, t, a: 'alarm started with other fingers or after a cancel' });
        alarmLive = true;
      }
      if (a.type === 'alarm' && a.phase === 'end') { if (!alarmLive) bad.push({ seed, t, a: 'alarm ended twice' }); alarmLive = false; }
    }
  };
  for (let k = 0; k < steps; k++) {
    t += 16 + rand(200);
    check(g.tick(t), null);
    const r = rand(100), ids = [...down.keys()];
    if (r < 25 && down.size < 3) {
      let id = 1 + rand(3); while (down.has(id)) id = 1 + rand(3);
      for (const f of down.values()) f.clean = false; // another finger came down
      down.set(id, { clean: down.size === 0, x: rand(400), y: rand(800) });
      const f = down.get(id);
      check(g.down({ id, x: f.x, y: f.y, t, kind: 'touch', button: 0, primary: down.size === 1 }, tool), id);
    } else if (r < 70 && ids.length) {
      const id = ids[rand(ids.length)], f = down.get(id);
      f.x += rand(61) - 30; f.y += rand(61) - 30;
      check(g.move({ id, x: f.x, y: f.y, t }), id);
    } else if (r < 88 && ids.length) {
      const id = ids[rand(ids.length)], f = down.get(id);
      check(g.up({ id, x: f.x, y: f.y, t }), id);
      down.delete(id);
    } else if (r < 93 && ids.length) {
      const id = ids[rand(ids.length)];
      down.get(id).clean = false;
      check(g.cancel(id), id);
      down.delete(id);
    } else if (r < 97) {
      for (const f of down.values()) f.clean = false; // focus lost, or a layer or tool switch
      check(g.reset('reset'), null);
      if (rand(2)) tool = TOOLS[rand(4)];
    } else if (ids.length && rand(2)) {
      // A phone call: the browser may never send the lifts, but the page loses focus (a reset). The next first finger
      // down is primary again.
      down.clear(); check(g.reset('blur'), null);
    }
  }
  return bad;
}

function run(make, sessions = 3000) {
  const bad = [];
  for (let seed = 1; seed <= sessions; seed++) bad.push(...session(make, seed));
  return bad;
}

test('random fingers: no order unless one finger was alone from its down to its lift', () => {
  const bad = run(makeGestures);
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} violations`);
});

test('planted fault: a second touch that never reaches the rules is caught', () => {
  const deaf = () => { const g = makeGestures(), down = g.down.bind(g); g.down = (p, tool) => (g.state.pointers.size && !p.primary ? [] : down(p, tool)); return g; };
  assert.ok(run(deaf).length > 0);
});

test('planted fault: an ignored pointercancel is caught', () => {
  const deaf = () => { const g = makeGestures(); g.cancel = () => []; return g; };
  assert.ok(run(deaf).length > 0);
});

// The sequences the phone check also plays in real browsers.
const P = (id, x, y, t, primary = false) => ({ id, x, y, t, kind: 'touch', button: 0, primary });
const orders = acts => acts.filter(a => a.type === 'order' || (a.type === 'alarm' && a.phase === 'start'));

test('a clean stroke is one order, on lift only', () => {
  const g = makeGestures(), seen = [];
  seen.push(...g.down(P(1, 100, 100, 0, true), 'trail'));
  for (let i = 1; i <= 10; i++) seen.push(...g.move(P(1, 100 + 10 * i, 100, i * 16)));
  assert.equal(orders(seen).length, 0, 'nothing before the lift');
  seen.push(...g.up(P(1, 200, 100, 200)));
  assert.equal(orders(seen).length, 1);
});

for (const [name, firstUp] of [['the drawing finger lifts last', 2], ['the drawing finger lifts first', 1]]) {
  test(`pinch mid-stroke, ${name}: no order`, () => {
    const g = makeGestures(), seen = [];
    seen.push(...g.down(P(1, 100, 100, 0, true), 'trail'));
    seen.push(...g.move(P(1, 140, 100, 16)));
    seen.push(...g.down(P(2, 300, 300, 32), 'trail'));
    seen.push(...g.move(P(1, 120, 90, 48)), ...g.move(P(2, 320, 330, 48)));
    assert.ok(seen.some(a => a.type === 'zoom'), 'two fingers zoom');
    const other = firstUp === 1 ? 2 : 1;
    seen.push(...g.up(P(firstUp, 0, 0, 64)));
    seen.push(...g.move(P(other, 200, 200, 80)), ...g.move(P(other, 260, 260, 96)));
    seen.push(...g.up(P(other, 260, 260, 112)));
    assert.deepEqual(orders(seen), []);
    // And the next stroke works again.
    seen.push(...g.down(P(3, 10, 10, 200, true), 'trail'), ...g.move(P(3, 80, 10, 216)), ...g.up(P(3, 80, 10, 232)));
    assert.equal(orders(seen).length, 1);
  });
}

test('alarm: a quick pinch calls nothing; a still hold calls it and the lift ends it', () => {
  const g = makeGestures(), seen = [];
  seen.push(...g.down(P(1, 100, 100, 0, true), 'alarm'), ...g.tick(100));
  seen.push(...g.down(P(2, 200, 200, 150), 'alarm'), ...g.tick(HOLD_MS + 200));
  seen.push(...g.up(P(1, 100, 100, 600)), ...g.tick(900), ...g.up(P(2, 200, 200, 1000)));
  assert.deepEqual(orders(seen), []);
  seen.push(...g.down(P(3, 50, 50, 2000, true), 'alarm'), ...g.tick(2000 + HOLD_MS));
  assert.equal(seen.filter(a => a.type === 'alarm' && a.phase === 'start').length, 1);
  seen.push(...g.up(P(3, 50, 50, 3000)));
  assert.equal(seen.filter(a => a.type === 'alarm' && a.phase === 'end').length, 1);
});

test('pointercancel and a reset mid-stroke: no order, and the finger left down stays dead', () => {
  const g = makeGestures(), seen = [];
  seen.push(...g.down(P(1, 100, 100, 0, true), 'dig'), ...g.move(P(1, 150, 100, 16)), ...g.cancel(1));
  seen.push(...g.down(P(2, 100, 100, 100, true), 'trail'), ...g.move(P(2, 150, 100, 116)), ...g.reset('layer'));
  seen.push(...g.move(P(2, 200, 100, 132)), ...g.up(P(2, 200, 100, 148)));
  assert.deepEqual(orders(seen), []);
});
