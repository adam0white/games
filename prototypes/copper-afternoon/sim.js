// Copper Afternoon: deterministic host geometry. No DOM, audio, or wall clock.
import { createPeople, decideRafi, observe, decideAylin } from './people.js';
export const DT = 1 / 30;
export const CLOSE = 360;
export const OBJECTS = ['cart', 'bell', 'lamp'];
export function create(seed = 1) {
  return { seed, tick: 0, t: 0, started: false, over: null, active: 'cart', tool: null, selected: null,
    people: createPeople(seed), events: [], log: [], bubble: null, operation: null,
    cart: { open: false, angle: 0, pin: 'bent', fixed: false, tested: false },
    bell: { open: false, angle: 0, spacer: 'base', fixed: false, tested: false, gone: false },
    lamp: { open: false, angle: 0, facing: 0, fixed: false, tested: false, gone: false },
    pin: 'tray', spacer: 'base', coupling: 'tray', fastened: false, broken: false,
    rafi: { holding: false, until: 0, warned: false }, visitor: false, departed: false, delivered: null,
    tests: { cart: 0, bell: 0, lamp: 0 }, testAt: -99, testObject: null, testGood: false,
    admitted: false, promised: false, promiseKept: false, arrival: false };
}
function event(s, kind, data = {}) { s.events.push({ kind, ...data }); }
function say(s, who, text) { s.bubble = { who, text, until: s.t + 7 }; event(s, 'voice'); }
function witness(s, kind, summary, valence = 0) {
  observe(s.people, s.t, kind, summary, valence); s.log.push({ t: s.t, kind, summary });
}
function start(s, kind, seconds, data = {}) {
  if (s.operation) return false;
  s.operation = { kind, start: s.t, end: s.t + seconds, object: s.active, ...data }; event(s, 'work'); return true;
}
export function good(s, object) {
  if (object === 'cart') return s.cart.pin === 'straight';
  if (object === 'bell') return s.coupling === 'bell' && s.fastened && s.spacer === 'striker' && !s.broken;
  return s.coupling === 'lamp' && s.fastened && s.lamp.facing === 1 && !s.broken;
}
function deliver(s) {
  const ready = ['bell', 'lamp'].filter(k => s[k].fixed && s[k].tested && good(s, k) && !s[k].gone);
  const choice = decideAylin(s.people, s.t, { bellFixed: ready.includes('bell'), lampFixed: ready.includes('lamp'), damaged: s.broken });
  s.log.push({ t: s.t, kind: 'aylin-choice', ...choice });
  say(s, 'aylin', choice.reason);
  s.nextVisitorDecision = choice.wait ? s.t + 30 : Infinity;
  if (!choice.wait) {
    s.departed = true; s.departureAt = s.t; s.visitor = false;
    const k = ready[0] || 'bell';
    s[k].gone = true; if (ready.length) s.delivered = k;
    if (s.operation?.object === k) s.operation = null;
    if (s.active === k) { s.active = OBJECTS.find(id => !s[id].gone); s.selected = null; s.tool = null; }
    witness(s, ready.length ? 'returned' : 'returned-unrepaired', `Aylin took the ${ready.length ? 'tested' : 'unrepaired'} ${k}.`, ready.length ? .6 : -.3);
    event(s, 'leave');
  }
}
function complete(s, op) {
  const k = op.object, o = s[k];
  if (o.gone) return;
  if (op.kind !== 'test' && op.kind !== 'open') { o.fixed = false; o.tested = false; }
  switch (op.kind) {
    case 'open': o.open = true; break;
    case 'pull-pin': s.cart.pin = null; break;
    case 'fit-pin': s.cart.pin = 'straight'; s.pin = 'cart'; break;
    case 'pull-spacer': s.spacer = 'tray'; break;
    case 'fit-spacer': s.spacer = op.target; break;
    case 'fit-coupling': s.coupling = k; s.fastened = false; break;
    case 'unfasten': s.fastened = false; break;
    case 'pull-coupling': s.coupling = 'tray'; s[k].fixed = false; s[k].tested = false; break;
    case 'fasten': s.fastened = true; break;
    case 'test': {
      if (k === 'lamp' && s.coupling === 'lamp' && !s.fastened && !s.broken) {
        s.broken = true; event(s, 'break'); witness(s, 'damage', 'The loose coupling broke during the lamp test.', -.6);
      }
      const works = good(s, k); o.fixed = works; o.tested = true;
      s.tests[k]++; s.testAt = s.t; s.testObject = k; s.testGood = works;
      witness(s, works ? 'test-passed' : 'test-failed', `The ${k} test ${works ? 'passed' : 'failed'}.`, works ? .6 : -.2);
      event(s, works ? (k === 'bell' ? 'ring' : 'success') : 'thud');
      if (k === 'cart' && works) { s.rafi.holding = false; say(s, 'sam', 'That rolls straight.'); }
      if (s.promised && works && k === 'bell' && s.t <= 240) s.promiseKept = true;
      break;
    }
  }
  event(s, 'snap'); s.selected = null;
}
export function act(s, a) {
  if (s.over) return;
  if (!s.started) { s.started = true; }
  if (a.type === 'switch') { if (OBJECTS.includes(a.object) && !s[a.object].gone) { s.active = a.object; s.selected = null; s.tool = null; } return; }
  if (a.type === 'tool') { s.tool = s.tool === a.tool ? null : a.tool; s.selected = null; return; }
  if (a.type === 'cancel') { s.selected = null; s.tool = null; return; }
  if (a.type === 'rafi') {
    if (s.rafi.holding) { say(s, 'rafi', 'I have the axle.'); return; }
    const result = decideRafi(s.people, s.t);
    s.log.push({ t: s.t, kind: 'rafi-choice', ...result });
    if (result.agreed && !s.cart.fixed) s.rafi = { holding: true, until: result.until, warned: false };
    say(s, 'rafi', result.reason); return;
  }
  if (a.type === 'aylin') {
    if (s.visitor) deliver(s);
    else if (!s.arrival && !s.promised) { s.promised = true; s.promiseKept = s.bell.fixed && s.bell.tested && good(s, 'bell'); witness(s, 'promise', 'The repairer promised a working bell before Aylin returns.', .2); say(s, 'aylin', 'Bell before I return?'); }
    return;
  }
  if (a.type === 'admit') {
    if (s.broken && !s.admitted && s.visitor) { s.admitted = true; witness(s, 'admission', 'The repairer admitted breaking the coupling.', -.1); say(s, 'aylin', 'Thank you for telling me.'); } return;
  }
  if (s.operation) { event(s, 'busy'); return; }
  const k = s.active, o = s[k];
  if (o.gone) return;
  // A clamped unfinished cart occupies the only mounting socket. Rafi releases it.
  if (k !== 'cart' && !s.cart.fixed && !s.rafi.holding) { say(s, 'sam', 'Free the cart clamp first.'); return; }
  if (a.type === 'rotate') { o.angle = (o.angle + 1) % 4; if (k === 'lamp' && s.coupling === 'lamp' && !s.fastened) { s.lamp.facing = 1 - s.lamp.facing; event(s, 'turn'); } return; }
  if (a.type === 'open' && !o.open) { start(s, 'open', k === 'cart' ? 1.2 : 5); return; }
  if (a.type === 'test') { start(s, 'test', 4); return; }
  if (!o.open) return;
  if (a.type === 'pull') {
    if (s.tool !== 'pliers') { event(s, 'need-pliers'); return; }
    if (k === 'cart' && s.cart.pin === 'bent') start(s, 'pull-pin', 5);
    if (k === 'bell' && a.part === 'spacer' && ['base', 'striker'].includes(s.spacer)) start(s, 'pull-spacer', 5);
    if (k !== 'cart' && s.coupling === k && !s.broken) {
      if (s.fastened) { say(s, 'sam', 'Loosen it first.'); return; }
      start(s, 'pull-coupling', 9);
    }
    return;
  }
  if (a.type === 'spacer-pull' && s.tool === 'pliers' && k === 'bell' && s.spacer !== 'tray') { start(s, 'pull-spacer', 5); return; }
  if (a.type === 'fasten' && s.tool === 'wrench' && s.coupling === k && !s.broken) {
    start(s, s.fastened ? 'unfasten' : 'fasten', 8); return;
  }
  if (a.type === 'fit') {
    if (a.part === 'pin' && k === 'cart' && !s.cart.pin && s.pin === 'tray') start(s, 'fit-pin', 6);
    if (a.part === 'spacer' && k === 'bell' && s.spacer === 'tray' && ['base', 'striker'].includes(a.target)) start(s, 'fit-spacer', 4, { target: a.target });
    if (a.part === 'coupling' && k !== 'cart' && s.coupling === 'tray' && !s.broken) start(s, 'fit-coupling', 7);
    return;
  }
}
export function step(s, inputs = []) {
  s.events.length = 0;
  if (s.over) return s;
  for (const a of inputs) act(s, a);
  if (!s.started) return s;
  s.tick++; s.t = s.tick * DT;
  if (s.operation && s.t >= s.operation.end) { const op = s.operation; s.operation = null; complete(s, op); }
  if (s.rafi.holding) {
    if (!s.rafi.warned && s.t >= s.rafi.until - 5) { s.rafi.warned = true; say(s, 'rafi', 'Five seconds. Then I go.'); }
    if (s.t >= s.rafi.until) {
      s.rafi.holding = false;
      // Revalidate unfinished second-object work. No hidden damage on release.
      if (s.operation?.object !== 'cart' && !s.cart.fixed) { s.operation = null; event(s, 'cancelled'); }
      say(s, 'rafi', 'Safe in the clamp now.');
    }
  }
  if (!s.arrival && s.t >= 240) {
    s.arrival = true; s.visitor = true; s.promiseKept = s.bell.fixed && s.bell.tested && good(s, 'bell');
    if (s.promised) witness(s, s.promiseKept ? 'promise-kept' : 'promise-broken', s.promiseKept ? 'The promised bell passed before Aylin returned.' : 'The promised bell was not ready on return.', s.promiseKept ? .6 : -.7);
    witness(s, 'arrival', 'Aylin returned and saw the actual bench and tests.', 0);
    if (s.broken) witness(s, 'damage-seen', 'Aylin saw the broken coupling on return.', -.5);
    for (const k of ['bell', 'lamp']) if (s[k].tested) witness(s, s[k].fixed ? 'test-passed' : 'test-failed', `Aylin was told the actual ${k} test ${s[k].fixed ? 'passed' : 'failed'}.`, s[k].fixed ? .5 : -.2);
    say(s, 'aylin', 'How did the repairs go?');
    s.nextVisitorDecision = s.t + 8;
  }
  if (s.visitor && s.t >= s.nextVisitorDecision && !s.departed) deliver(s);
  if (s.bubble && s.t >= s.bubble.until) s.bubble = null;
  if (s.t >= CLOSE) {
    s.over = s.delivered ? (s.cart.fixed ? (s.promiseKept || !s.promised ? 'repaired' : 'late') : 'unfinished') : s.broken ? 'broken' : 'unrepaired';
    event(s, 'closing');
  }
  return s;
}
export function prompt(s) {
  if (!s.started || s.bubble) return '';
  if (s.over) return '';
  if (s.operation) return '';
  const k = s.active, o = s[k];
  if (o.gone) return;
  if (s.selected) return s.selected === 'spacer' ? 'Under bell, or under striker?' : 'Fit the matching socket';
  if (k === 'cart') {
    if (!o.open) return 'Open the axle cap';
    if (o.pin === 'bent') return s.tool === 'pliers' ? 'Pull the bent pin' : 'Take the pliers';
    if (!o.pin) return 'Fit the straight pin';
    if (!o.fixed) return 'Roll it';
    return 'Two objects. One coupling.';
  }
  if (!o.open) return 'Lift the cover';
  if (s.broken) return s.visitor ? 'The coupling broke. Tell Aylin.' : 'Tell Aylin when she returns';
  if (s.coupling === 'tray') return 'One coupling. Choose its home.';
  if (s.coupling !== k) return 'The coupling is in ' + (k === 'bell' ? 'lamp' : 'bell');
  if (!s.fastened) return k === 'lamp' ? 'Turn coupling. Then tighten.' : 'Tighten the coupling';
  if (!o.tested) return k === 'bell' ? 'Strike the bell' : 'Turn the crank';
  if (!o.fixed) return k === 'bell' ? 'Watch where the striker stops' : 'The coupling blocks the gear';
  return s.arrival ? 'Aylin can take this home' : k === 'bell' ? 'Try the lamp. Or keep this.' : 'Try the bell. Or keep this.';
}
