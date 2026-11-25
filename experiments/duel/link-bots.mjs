// Claims for playing a friend by link, run by bots.mjs (section 8, or alone with `node bots.mjs --friend`).
// Two phones are two sims fed each other's inputs through channel.mjs: a pretend network with delay, jitter, frames
// that overtake each other, dropped frames that are sent again, and cuts with a reconnect. They must stay identical
// tick for tick. --mutate=late files the friend's inputs one tick early on one phone (the wrong tick): the identity
// claims must then fail.
import { createMatch, step, KINDS } from './sim.js';
import { makeBot, STRENGTHS } from './brain.js';
import { encode, decode, delayFor, FRIEND_KINDS, DELAY } from './net.js';
import { linkMatch, replay, mulberry } from './channel.mjs';

const fnv = (h, str) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pct = (a, n) => `${Math.round(100 * a / n)}%`;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };

export function linkClaims({ claim, quick = false, late = false }) {
  const skew = late ? -1 : 0;
  if (late) console.log('MUTATION (late): one phone files the friend\'s inputs at the wrong tick\n');

  // 8a. With the friend mode not chosen, the rules are exactly main's. The hash is of every tick of 400 bot matches
  // (seeds 1-40, the full deck and each duel alone, medium v hard), taken on main (295d12a3) before this change.
  {
    let h = 0x811c9dc5, ticks = 0;
    for (let seed = 1; seed <= 40; seed++) for (const only of [null, ...KINDS]) {
      const s = createMatch({ seed, only }), a = makeBot('medium', seed), b = makeBot('hard', seed + 7);
      while (!s.over && s.t < 400) { step(s, [a.act(s, 0), b.act(s, 1)]); s.events.length = 0; ticks++; if (s.d) h = fnv(h, JSON.stringify([s.d, s.score])); }
      h = fnv(h, JSON.stringify(s.duels));
    }
    claim(h === 3675900658 && ticks === 1364242, `parity: one-phone and bot play step exactly as on main (hash ${h} over ${ticks} ticks; main 3675900658 over 1364242)`);
  }

  // 8b. The wire: a tick's input survives the codec, and decoding is a fixed point (what both phones apply is the same).
  {
    let n = 0, bad = 0, longest = 0, outOfRange = 0;
    for (let seed = 1; seed <= (quick ? 6 : 20); seed++) for (const only of KINDS) {
      const s = createMatch({ seed, only, intro: 0.2 }), bots = [makeBot('careful', seed), makeBot('clumsy', seed + 1)];
      while (!s.over && s.t < 60) {
        const inp = [bots[0].act(s, 0), bots[1].act(s, 1)];
        for (const x of inp) {
          const e = encode(x), d = decode(e); n++; longest = Math.max(longest, e.length);
          if (e.some(v => !Number.isInteger(v) || v < -2147483648 || v > 4294967295)) outOfRange++;
          const close = d.held === !!x.held && d.taps.length === Math.min(7, x.taps.length) && d.releases.length === Math.min(7, x.releases.length)
            && (x.px === null ? d.px === null : Math.abs(d.px - x.px) <= 0.0005 + 1e-12 && Math.abs(d.py - x.py) <= 0.0005 + 1e-12);
          if (!close || JSON.stringify(encode(d)) !== JSON.stringify(e)) bad++;
        }
        step(s, inp); s.events.length = 0;
      }
    }
    claim(bad === 0 && outOfRange === 0, `codec: ${n} bot inputs survive encode/decode within half a thousandth, and decode is a fixed point (${bad} bad); longest ${longest} integers`);
  }

  // 8c. Two phones over a bad network finish every match identically, tick for tick, and a replay of the inputs one
  // phone applied gives the same match. Each match draws its network at random.
  {
    const N = quick ? 40 : 160, rnd = mulberry(2026);
    let same = 0, over = 0, replayed = 0, quiet = 0, maxChars = 0, maxInts = 0, perSecond = 0, ticks = 0, cuts = 0, lost = 0, sent = 0;
    for (let i = 0; i < N; i++) {
      const latency = Math.round(10 + rnd() * 390), jitter = Math.round(rnd() * Math.min(150, latency)), drop = rnd() < 0.5 ? 0 : rnd() * 0.15;
      const cut = rnd() < 0.35 ? (() => { const a = 3000 + Math.round(rnd() * 20000); return [a, a + 500 + Math.round(rnd() * 3000)]; })() : null;
      const bots = [STRENGTHS[Math.floor(rnd() * 3)], ['clumsy', 'careful', 'medium'][Math.floor(rnd() * 3)]];
      const hz = rnd() < 0.3 ? [60, 30 + Math.round(rnd() * 90)] : [60, 60];
      const opts = { seed: 1000 + i, kinds: FRIEND_KINDS, delay: delayFor(2 * latency), latency, jitter, drop, cut, bots, hz, skew, net: i };
      const r = linkMatch(opts);
      if (r.same) same++; if (r.over) over++; if (r.mismatch.every(m => m === null)) quiet++;
      const rp = replay(opts, r.phones[0].pairs);
      if (rp.hashes.length === r.phones[0].hashes.length && rp.hashes.every((h, j) => h === r.phones[0].hashes[j]) && JSON.stringify(rp.s.duels) === JSON.stringify(r.phones[1].s.duels)) replayed++;
      maxChars = Math.max(maxChars, r.maxChars); maxInts = Math.max(maxInts, r.maxInts); perSecond = Math.max(perSecond, r.perSecond); ticks += r.ticks[0]; if (cut) cuts++; lost += r.lost; sent += r.sent;
    }
    claim(same === N && over === N, `lockstep: ${same}/${N} matches identical on both phones to the last tick (${over} finished; ${ticks} ticks; one-way 10-400 ms, jitter to 150 ms, up to 15% of frames lost (${lost}/${sent}), ${cuts} cuts with a reconnect, one phone at 30-120 fps in some)`);
    claim(replayed === N, `replay: in ${replayed}/${N} matches the inputs one phone applied, replayed with no network, give the same match`);
    claim(quiet === N, `checks: the phones' state checks every 30 ticks and at the end agree in ${quiet}/${N} matches`);
    claim(maxChars <= 200 && maxInts <= 64 && perSecond <= 30, `frames: the longest is ${maxChars} bytes and ${maxInts} integers (the relay takes 200 and 64) and a phone sends at most ${perSecond} a second (the relay takes 30)`);
  }

  // 8d. The detector: a phone that files the friend's inputs one tick early comes apart, and both phones notice.
  {
    const r = linkMatch({ seed: 7, kinds: FRIEND_KINDS, delay: 6, latency: 40, skew: -1 });
    claim(!r.same && r.mismatch.every(m => m !== null), `a wrong-tick input is caught: the phones differ from tick ${r.firstDiff} and both checks flag it (ticks ${r.mismatch.join(', ')})`);
  }

  // 8e. How it feels. Felt delay: from a thumb's input to the tick that applies it. Speed: ticks stepped per second of
  // play over 60 (1 = full speed; less means the duel stalls waiting for the friend). One-way phone-to-phone time L,
  // the host's delay from its measured round trip (2L).
  {
    console.log('\nBy link: felt input delay and game speed (medium v medium, 20 matches per row, one duel kind)');
    console.log('kind    one-way  jitter  delay        felt median / p90   speed');
    const rows = {};
    for (const only of ['tug', 'hockey']) for (const L of [20, 75, 150, 400]) {
      const D = delayFor(2 * L), felt = [], p90 = [], speed = [];
      for (let seed = 1; seed <= (quick ? 6 : 20); seed++) {
        const r = linkMatch({ seed, only, intro: 0.5, delay: D, latency: L, jitter: L * 0.2 });
        for (const p of r.phones) { if (p.playMs) speed.push(p.playTicks / (p.playMs / 1000) / 60); }
        if (r.felt[0]) { felt.push(r.felt[0].med); p90.push(r.felt[0].p90); }
      }
      rows[`${only}${L}`] = { felt: median(felt), speed: median(speed) };
      console.log(`${only.padEnd(7)} ${String(L).padStart(4)} ms  ${String(L * 0.2).padStart(4)} ms  ${String(D).padStart(2)} ticks (${Math.round(D * 1000 / 60)} ms)  ${String(median(felt)).padStart(4)} / ${String(median(p90)).padStart(4)} ms   ${median(speed).toFixed(2)}`);
    }
    claim(rows.tug20.felt <= 130 && rows.tug75.felt <= 180, `felt delay on a good line: ${rows.tug20.felt} ms at 20 ms one-way, ${rows.tug75.felt} ms at 75 ms (6-tick floor, 100 ms)`);
    claim(rows.tug150.speed >= 0.95 && rows.hockey150.speed >= 0.95, `at 150 ms one-way the duel runs at full speed (tug ${rows.tug150.speed.toFixed(2)}, hockey ${rows.hockey150.speed.toFixed(2)}); the thumb feels ${rows.tug150.felt} ms`);
    console.log(`     at 400 ms one-way the delay is capped at ${DELAY.max} ticks, so the duel runs at about ${rows.tug400.speed.toFixed(2)} speed (stalls while it waits) and the thumb feels ${rows.tug400.felt} ms`);
  }

  // 8f. Hockey is left out of the friend deck: a delay takes the skill out of it. A careful player's share of duels
  // against a clumsy one, from either seat, with no network and a delay of 1 tick vs 6 (the smallest a link uses);
  // hockey also at 14 (the delay for 150 ms one way).
  {
    const N = quick ? 6 : 15, share = {};
    for (const only of KINDS) for (const D of only === 'hockey' ? [1, 6, 14] : [1, 6]) {
      let cw = 0, n = 0;
      for (let seed = 1; seed <= N; seed++) for (const flip of [0, 1]) {
        const r = linkMatch({ seed, only, intro: 0.5, delay: D, latency: 0, sendMs: 1, bots: flip ? ['clumsy', 'careful'] : ['careful', 'clumsy'] });
        for (const d of r.phones[0].s.duels) { n++; if (d.winner === (flip ? 1 : 0)) cw++; }
      }
      share[`${only}${D}`] = cw / n;
    }
    console.log(`     careful's share of duels v clumsy, 1 tick → 6 ticks of delay: ${KINDS.map(k => `${k} ${pct(share[k + 1], 1)}→${pct(share[k + 6], 1)}`).join(', ')}`);
    claim(share.hockey1 >= 0.85 && share.hockey6 <= 0.65 && share.hockey14 <= 0.65 && !FRIEND_KINDS.includes('hockey'), `hockey loses its skill to a delay (careful wins ${pct(share.hockey1, 1)} at 1 tick, ${pct(share.hockey6, 1)} at 6, ${pct(share.hockey14, 1)} at 14), so the friend deck leaves it out`);
    const kept = FRIEND_KINDS.filter(k => share[k + 6] >= share[k + 1] - 0.15);
    claim(kept.length === FRIEND_KINDS.length, `every duel in the friend deck keeps its skill at 6 ticks of delay (within 15 points): ${kept.length}/${FRIEND_KINDS.length}`);
  }
}
