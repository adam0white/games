// node check.mjs — the link and the river, without a browser.
//   1. link encode and decode round trip (and through a real URL)
//   2. hostile links are refused; a signed link edited in any field is refused; an unsigned link is held to what real
//      legs make, and its chain count is clamped
//   3. a policy that steers toward embers finishes the leg in at least 80% of 200 seeds
//   4. doing nothing lasts at least 20 s (every seed, from a full flame and from a weak 25% flame)
//   5. a known bad case does worse: doing nothing finishes far fewer seeds than the seeker
// Add --mutate to prove the checks can fail: it breaks the validator and the river, and expects failures.
import assert from 'node:assert/strict';
import { encode, decode, linkFor, readLink, passOn, valid, cleanName, checksum } from './link.js';
import { leg, step, run, seeker, NO_ROCKS, SPEED } from './sim.js';

const mutate = process.argv.includes('--mutate');
let failed = 0;
const check = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message.split('\n')[0]); } };

// 1. round trip
check('round trip', () => {
  const samples = [
    { chain: 1, flame: 100, total: 1840, seed: 12345, carriers: [{ name: 'Sam', dist: 1840 }] },
    { chain: 23, flame: 64, total: 41200, seed: 2 ** 31 - 1, carriers: ['Ana', '', 'Çağla Ö.', 'li_li-2', 'Ζωή', '山田', 'J R', 'Sam'].map((name, i) => ({ name, dist: 1700 + i * 20 })) },
    { chain: 99999, flame: 1, total: 99999999, seed: 1, carriers: [{ name: '', dist: 0 }] },
  ];
  for (const f of samples) {
    assert.ok(valid(f), 'sample is valid');
    assert.deepEqual(decode(encode(f)), f);
    const url = linkFor(f, 'http://localhost:8931/lab/flame-b/?lang=tr&labRunSource=agent#x');
    assert.ok(!url.includes('lang=') && !url.includes('labRunSource') && !url.includes('#'), 'only origin and path travel');
    assert.deepEqual(readLink(url), f);
    assert.ok(encode(f).includes('~'), 'every link made here is signed');
  }
  // passOn: chain grows, eight names kept, flame and distance carried
  let f = null;
  for (let i = 0; i < 12; i++) f = passOn(f, { name: `p${i}`, dist: 1800 + i, flame: 0.5 + i / 40, seed: i * 7919 });
  assert.equal(f.chain, 12); assert.equal(f.carriers.length, 8); assert.equal(f.carriers[0].name, 'p4'); assert.equal(f.carriers[7].name, 'p11');
  assert.equal(f.flame, Math.round((0.5 + 11 / 40) * 100));
  assert.deepEqual(decode(encode(f)), f);
  assert.equal(cleanName('  <b>Sam</b>  '), 'bSamb');
});

// 2. hostile links
check('hostile links refused', () => {
  const good = encode({ chain: 3, flame: 50, total: 5400, seed: 999, carriers: [{ name: 'A', dist: 1800 }, { name: 'B', dist: 1800 }, { name: 'C', dist: 1800 }] });
  assert.ok(decode(good), 'the good one decodes');
  const bad = [
    '', 'x', null, 12, good.replace(/^1\./, '2.'), good + '*', good + '*x*5',
    '1.0.50.5400.rr.A*1800', '1.3.0.5400.rr.A*1800', '1.3.101.5400.rr.A*1800', '1.3.50.-1.rr.A*1800',
    '1.3.50.100.rr.A*1800',                                  // legs longer than the total
    '1.1.50.5400.rr.A*1800*B*1800',                           // more names than carriers
    '1.3.50.5400.RR.A*1800', '1.3.50.5400.zzzzzzzz.A*1800', '1.3.50.5400.0.A*1800', '1.3.50.5400.0rr.A*1800',
    '1.3.50.5400.rr.<img src=x onerror=alert(1)>*1800', '1.3.50.5400.rr.A"B*1800', "1.3.50.5400.rr.A'B*1800",
    '1.3.50.5400.rr.Averyveryverylongname*1800', '1.3.50.5400.rr. A*1800', '1.3.50.5400.rr.A *1800', '1.3.50.5400.rr.A\u0000*1800',
    '1.3.50.5400.rr.A‮B*1800', '1.3.50.5400.rr.A*18000', '1.3.50.5400.rr.A*01800', '1.3.50.5400.rr.A*1e3', '1.3.50.5400.rr.A*1800.5',
    '1.03.50.5400.rr.A*1800', '1.3.050.5400.rr.A*1800', '1.3.50.5400.rr.A',
    '1.12.50.99999.rr.' + Array.from({ length: 9 }, (_, i) => `n${i}*100`).join('*'),   // nine names
    '1.3.50.5400.rr.' + 'A'.repeat(400) + '*1', ' ' + good, good + '\n',
  ];
  for (const b of bad) assert.equal(decode(b), null, `refused: ${JSON.stringify(b).slice(0, 60)}`);
  assert.equal(readLink('http://x/?flame=' + encodeURIComponent('1.3.50.5400.rr.<script>*1')), null);
  assert.equal(readLink('not a url'), null);
  assert.equal(readLink('http://x/'), null);
  if (mutate) assert.equal(decode('1.3.50.5400.rr.<b>*1800'), null, 'mutation: a name with < is refused');
});

check('signed links: any edit is refused', () => {
  const f = { chain: 23, flame: 64, total: 41200, seed: 424242, carriers: ['Ana', 'Bo', 'Cem', 'Dee', 'Eli', 'Fay', 'Gus', 'Sam'].map((name, i) => ({ name, dist: 1700 + i * 20 })) };
  const text = encode(f), [body, sum] = text.split('~');
  assert.match(sum, /^[0-9a-z]{8}$/);
  assert.deepEqual(decode(text, { detail: true }), { flame: f, signed: true, clamped: false });
  const edits = [
    body.replace('1.23.', '1.99999.'), body.replace('.64.', '.100.'), body.replace('.41200.', '.99999.'), body.replace('.93ci.', '.93cj.'),
    body.replace('Sam*1840', 'Sam*9999'), body.replace('Sam', 'Max'), body.replace('Ana*1700*', ''),
  ];
  for (const e of edits) { assert.notEqual(e, body, 'the edit changed something'); assert.equal(decode(`${e}~${sum}`), null, `edited and refused: ${e.slice(0, 40)}`); }
  for (const bad of [`${body}~`, `${body}~${sum.slice(1)}`, `${body}~${sum}0`, `${body}~${sum.toUpperCase()}`, `${body}~~${sum}`, `${text}~${sum}`]) assert.equal(decode(bad), null, `bad checksum: ${bad.slice(-14)}`);
  // the playtester's forgeries, as edits of a real link
  assert.equal(decode(body.replace('.64.', '.100.') + '~' + sum), null, 'pct=100 refused');
  // a forger who also recomputes the checksum gets through: it only deters casual editing (NOTES says so)
  const forged = body.replace('.64.', '.100.'); assert.ok(decode(`${forged}~${checksum(forged)}`));
});

check('unsigned links: strict ranges, chain clamped', () => {
  const ok = '1.3.50.5400.rr.A*1800*B*1800*C*1800';
  assert.deepEqual(decode(ok, { detail: true }), { flame: { chain: 3, flame: 50, total: 5400, seed: parseInt('rr', 36), carriers: ['A', 'B', 'C'].map(name => ({ name, dist: 1800 })) }, signed: false, clamped: false });
  // chain 99999 with two names: clamped to two, the most those names can support
  const c = decode('1.99999.50.3600.rr.A*1800*B*1800', { detail: true });
  assert.equal(c.flame.chain, 2); assert.equal(c.clamped, true);
  // eight names: unlisted carriers each rowed at least 1,700 m
  const eight = Array.from({ length: 8 }, (_, i) => `n${i}*1800`).join('*');
  assert.equal(decode(`1.99999.50.${8 * 1800 + 5 * 1700}.rr.${eight}`).chain, 13);
  assert.equal(decode(`1.13.50.${8 * 1800 + 5 * 1700}.rr.${eight}`, { detail: true }).clamped, false);
  for (const b of [
    '1.2.50.3600.rr.A*0*B*3600',          // a leg no river is that short
    '1.2.50.3800.rr.A*1800*B*2000',       // or that long
    '1.2.50.9000.rr.A*1800*B*1800',       // more metres than two carriers could row
    `1.9.50.99999999.rr.${eight}`,         // the same for eight names
  ]) assert.equal(decode(b), null, `refused: ${b}`);
});

// 3. the seeker finishes
const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761 + 17) >>> 0);
let seekWins = 0, seekFlame = 0, seekTaken = 0, seekHits = 0;
check('seeker finishes at least 80% of 200 seeds', () => {
  for (const seed of SEEDS) {
    const s = run(seed, x => seeker(x));
    if (s.outcome === 'handoff') { seekWins++; seekFlame += s.flame; }
    seekTaken += s.taken; seekHits += s.hits;
  }
  console.log(`      seeker: ${seekWins}/200 handed on, mean flame at the buoy ${(seekFlame / Math.max(1, seekWins) * 100).toFixed(0)}%, embers ${(seekTaken / 200).toFixed(1)}, rock hits ${(seekHits / 200).toFixed(1)} a leg`);
  assert.ok(seekWins >= 160, `${seekWins} of 200`);
});

// for information: a slower seeker (decides every 0.3 s, aims up to 1.5 m off, looks only 45 m ahead)
{
  let wins = 0, fl = 0;
  for (const seed of SEEDS) {
    let aim = 0, next = 0, k = seed;
    const s = run(seed, x => { if (x.t >= next) { k = (k * 1103515245 + 12345) >>> 0; aim = seeker(x, { look: 45 }) + ((k / 2 ** 32) * 2 - 1) * 1.5; next = x.t + 0.3; } return aim; });
    if (s.outcome === 'handoff') { wins++; fl += s.flame; }
  }
  console.log(`info  slow seeker: ${wins}/200 handed on, mean flame at the buoy ${(fl / Math.max(1, wins) * 100).toFixed(0)}%`);
}

// 4. doing nothing lasts
let idleWins = 0;
check('doing nothing lasts at least 20 s (full flame and 25% flame)', () => {
  for (const start of [1, 0.25]) {
    let min = Infinity, sum = 0, wins = 0;
    for (const seed of SEEDS) {
      const s = run(seed, null, { flame: start });
      const lasted = s.outcome === 'drop' ? s.t : Infinity;
      min = Math.min(min, lasted); sum += Math.min(lasted, s.t); if (s.outcome === 'handoff') wins++;
    }
    if (start === 1) idleWins = wins;
    console.log(`      idle from ${start * 100}%: shortest ${min.toFixed(1)} s, mean ${(sum / 200).toFixed(1)} s, finished ${wins}/200`);
    assert.ok(min >= 20, `idle from ${start * 100}% lasted only ${min.toFixed(1)} s`);
  }
});

// 5. a bad case does worse
check('doing nothing finishes far fewer seeds than the seeker', () => {
  assert.ok(idleWins <= seekWins * 0.5, `idle ${idleWins} against seeker ${seekWins}`);
});

// the opening promises: no rocks in the first eight seconds, the first ember straight ahead
check('no rocks in the first eight seconds; first ember on the line', () => {
  for (const seed of SEEDS) {
    const s = leg(seed);
    assert.ok(s.rocks.every(q => q.d - q.r > NO_ROCKS), `seed ${seed}: rock at ${s.rocks[0]?.d}`);
    assert.ok(Math.abs(s.embers[0].o) < 1 && s.embers[0].d < 4 * SPEED, 'first ember easy');
    const idle = leg(seed); while (idle.t < 4.5) step(idle, null);
    assert.ok(idle.taken >= 1, `seed ${seed}: a boat left alone takes the first ember`);
  }
});

check('deterministic', () => {
  const a = run(SEEDS[3], x => seeker(x)), b = run(SEEDS[3], x => seeker(x));
  assert.equal(a.t, b.t); assert.equal(a.flame, b.flame); assert.equal(a.taken, b.taken);
});

if (mutate) {
  // a river with rocks everywhere must fail the seeker check; a broken validator must fail the hostile check
  const s = leg(SEEDS[0]); for (let i = 0; i < 400; i++) s.rocks.push({ d: 250 + i * 4, o: ((i * 37) % 40) - 20, r: 3, hit: 0 });
  s.rocks.sort((a, b) => a.d - b.d); while (!s.done) step(s, seeker(s));
  console.log(s.outcome === 'drop' ? 'ok   mutation: a blocked river drops the flame' : 'FAIL mutation: blocked river was finished');
  if (s.outcome !== 'drop') failed++;
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
