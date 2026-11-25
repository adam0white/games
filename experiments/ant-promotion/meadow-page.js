// The evolving meadow on the page (meadow.js has the rules): it watches each run, closes it, keeps the meadow on this device, says what
// the meadow learned, draws the field guide and the marks over evolved animals, and starts the meadow over when asked.
// index.html calls it at a few points only, so the game's own code changes little:
//   const mp = meadowPage({ show, say, portrait, rec, mode })
//   mp.world()          the meadow for a new world (create(..., { meadow: mp.world() })); it also starts a run
//   mp.tick(s)          after every sim step: watches the run, closes it on a death, the win or a long life, and puts the
//                       new meadow on the world when the next life starts
//   mp.end(why)         closes the run now ('menu', 'leave'); index.html does not call it, the listeners below do
//   mp.pips(g, M, x, y, size)   the marks beside an evolved animal's number
//   mp.translate()      after a language switch
// Before GRACE runs have counted, world() returns null and nothing on the world changes (the bots prove it tick for tick).
import { FORMS, formOf } from './sim.js';
import * as MW from './meadow.js';
import { traitKey } from './meadow-words.js';
import { t, animal } from './words.js';
import { readJson, writeJson } from '../kit/save.js';
export { formOf };

const $ = id => document.getElementById(id);
const HUNT = [0, 1, 2], PREY = [4, 5, 3]; // the field guide's two groups; shake (3) is under prey, where skills mostly land
const roleOf = v => (HUNT.some(i => Math.abs(v[i]) >= 0.05) ? 'hunt' : 'prey'); // the role a species has changed most in, for its picture
const lineOf = c => t(`meadow.${c.up ? 'up' : 'down'}.${traitKey(c.trait, c.sign)}`, { name: animal(c.name) });

export function meadowPage({ show, say, portrait, rec, mode }) {
  let M = MW.cleanMeadow(readJson(MW.MEADOW_KEY, null)), T = MW.newTally(), live = null, fresh = [], hidden = 0, startsNow = false, revive = false, sure = 0;
  const store = () => writeJson(MW.MEADOW_KEY, M);
  // a run ends: count it, keep the meadow, record the numbers, and keep what changed for the card
  function end(why) {
    const r = MW.advance(M, T); T = MW.newTally(); if (!r.counted) return false;
    const was = M.runs; M = r.meadow; store();
    rec.event('meadow', { why, ...MW.summary(M) }); // numbers only: generation, species changed, mean and largest of each trait
    if (was < MW.GRACE && M.runs >= MW.GRACE && MW.changed(M).length) startsNow = true;
    if (r.changes.length) { fresh = r.changes; hidden = r.more; } // at most MW.SHOW, strongest first; hidden: how many more changed
    return true;
  }
  function card(box) { // "What the meadow learned": at most two lines, each with the animal as it is now and its trait's colour
    if (!box) return; box.textContent = '';
    if (!fresh.length && !startsNow) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.append(Object.assign(document.createElement('b'), { textContent: t('meadow.learned') }));
    if (startsNow) box.append(Object.assign(document.createElement('div'), { className: 'small', textContent: t('meadow.starts') }));
    for (const c of fresh.slice(0, 2)) {
      const row = document.createElement('div'); row.className = 'mrow';
      const F = FORMS.find(f => f.name === c.name), pic = document.createElement('canvas'); pic.width = pic.height = 96;
      portrait(pic, MW.shape(F, MW.traitsOf(M, c.name), MW.TRAITS[c.i].role === 'hunt' ? 'hunt' : MW.TRAITS[c.i].role === 'prey' ? 'prey' : roleOf(MW.traitsOf(M, c.name))), 22, 0, null);
      const dot = Object.assign(document.createElement('i'), { className: 'mdot' }); dot.style.background = MW.TRAITS[c.i].colour; if (!c.up) dot.style.opacity = 0.4;
      row.append(pic, dot, Object.assign(document.createElement('span'), { textContent: lineOf(c) }));
      box.append(row);
    }
    if (fresh.length > 2 || hidden) box.append(Object.assign(document.createElement('div'), { className: 'small', textContent: hidden ? t('meadow.moreAll') : t('meadow.more', { n: fresh.length - 2 }) }));
  }
  function seen() { fresh = []; hidden = 0; startsNow = false; } // the player has read it: a new life or the field guide
  // ---- the field guide: each changed species, then and now, and a bar for each trait from the line where it began
  function guide() {
    $('meadowSay').textContent = M.runs < MW.GRACE ? t('meadow.wait', { g: MW.GRACE, n: MW.GRACE - M.runs }) : t('meadow.say', { n: M.runs });
    const box = $('meadowList'); box.textContent = '';
    const list = MW.changed(M).sort((a, b) => Math.max(...MW.traitsOf(M, b).map(Math.abs)) - Math.max(...MW.traitsOf(M, a).map(Math.abs)));
    if (!list.length && M.runs >= MW.GRACE) box.append(Object.assign(document.createElement('p'), { textContent: t('meadow.none') }));
    for (const name of list) {
      const F = FORMS.find(f => f.name === name), v = MW.traitsOf(M, name), d = document.createElement('div'); d.className = 'mspecies';
      const pics = document.createElement('div'); pics.className = 'mpics';
      for (const [form, word] of [[F, 'meadow.began'], [MW.shape(F, v, roleOf(v)), 'meadow.now']]) {
        const c = document.createElement('canvas'); c.width = c.height = 96; portrait(c, form, 22, 0, null);
        const w = document.createElement('div'); w.append(c, Object.assign(document.createElement('small'), { textContent: t(word) })); pics.append(w);
      }
      const bars = document.createElement('div'); bars.className = 'mbars';
      bars.append(Object.assign(document.createElement('b'), { textContent: animal(name) }));
      for (const [group, idx] of [['meadow.hunt', HUNT], ['meadow.prey', PREY]]) {
        const on = idx.filter(i => Math.abs(v[i]) >= 0.05); if (!on.length) continue;
        bars.append(Object.assign(document.createElement('div'), { className: 'small', textContent: t(group) }));
        for (const i of on) {
          const T = MW.TRAITS[i], row = document.createElement('div'); row.className = 'mbar';
          const track = document.createElement('span'), fill = document.createElement('span'), lo = T.lo < 0 ? 0.5 : 0, k = Math.abs(v[i]) * (T.lo < 0 ? 0.5 : 1);
          fill.style.background = T.colour; fill.style.left = `${(v[i] < 0 ? lo - k : lo) * 100}%`; fill.style.width = `${k * 100}%`;
          track.className = 'mtrack'; track.style.setProperty('--zero', `${lo * 100}%`); track.append(fill);
          row.append(Object.assign(document.createElement('small'), { textContent: t('meadow.trait.' + traitKey(T.k, Math.sign(v[i]))) }), track); bars.append(row);
        }
      }
      d.append(pics, bars); box.append(d);
    }
    const reset = $('meadowReset'); reset.style.display = M.runs ? '' : 'none'; reset.textContent = t(sure ? 'meadow.resetSure' : 'meadow.reset');
  }
  function button() { const b = $('toMeadow'); if (b) b.textContent = M.runs >= MW.GRACE ? t('meadow.buttonGen', { n: M.runs }) : t('meadow.button'); }
  $('toMeadow').onclick = () => { sure = 0; seen(); card($('menuLearned')); guide(); show('meadow'); };
  $('meadowReset').onclick = () => {
    if (!sure) { sure = 1; guide(); setTimeout(() => { if (sure) { sure = 0; if (mode() === 'meadow') guide(); } }, 5000); return; } // the second tap within 5 s confirms
    sure = 0; M = MW.newMeadow(); T = MW.newTally(); live = null; seen(); store(); rec.event('meadow reset', { gen: 0 }); guide(); button(); card($('menuLearned'));
    $('meadowSay').textContent = t('meadow.resetDone');
  };
  // a run also ends at the menu and when the page goes away
  // (on window, so it runs before the lab recording ends the life on document: the meadow's numbers go into that life's record)
  addEventListener('click', e => { if (e.target.closest?.('.toMenu')) { end('menu'); card($('menuLearned')); button(); } }, true);
  addEventListener('pagehide', () => end('leave'));
  button();
  return {
    get meadow() { return M; }, get tally() { return T; }, get live() { return live; },
    world() { T = MW.newTally(); seen(); card($('menuLearned')); revive = false; return (live = MW.makeMeadow(M)); },
    tick(s) {
      if (revive && !s.dead) { revive = false; seen(); MW.useMeadow(s, live = MW.makeMeadow(M)); T = MW.newTally(); } // the next life meets the new meadow
      MW.observe(s, T);
      for (const e of s.events) {
        if (e.t === 'die') { end('died'); revive = true; card($('learned')); }
        if (e.t === 'win') { if (end('win') && fresh.length) say(t('meadow.toast')); }
      }
      if (T.time >= MW.RUN_CUT && !s.dead) { if (end('cut') && fresh.length) say(t('meadow.toast')); } // a long life: counted now, changes the meadow after it
    },
    end,
    // the marks beside an evolved animal's number: a dot in each strong trait's colour (a quarter of its range or more), to the left of
    // the number, which label() has just drawn centred on x with its baseline on y (g.font is still its font)
    pips(g, F, x, y, size, text) {
      const on = MW.marked(F); if (!on.length) return;
      const r = Math.max(3, size * 0.24), w = r * 2.3, right = x - g.measureText(text).width / 2 - r - 3, cy = y - size * 0.36;
      g.save(); g.lineWidth = Math.max(1.2, r * 0.5); g.strokeStyle = '#0b1408';
      on.forEach((i, k) => { g.fillStyle = MW.TRAITS[i].colour; g.beginPath(); g.arc(right - k * w, cy, r, 0, 7); g.fill(); g.stroke(); });
      g.restore();
    },
    // the marks on an evolved animal's body: a row of spots down its back, one in each strong trait's colour, with a dark rim, so the
    // species keeps its own colours and the spots read as marks. 2D: g is in the body's frame (+x forward), r its radius.
    marks(g, F, r) {
      const on = MW.marked(F); if (!on.length) return; const d = Math.max(1.5, r * 0.19);
      g.save(); g.lineWidth = Math.max(0.8, d * 0.4); g.strokeStyle = '#0b1408';
      on.forEach((i, k) => { g.fillStyle = MW.TRAITS[i].colour; g.beginPath(); g.arc(-r * 0.12 - k * d * 2.4, 0, d, 0, 7); g.fill(); g.stroke(); });
      g.restore();
    },
    marks3d(R, m, F) { // the same spots in the 3D look, as small balls on its back
      const on = MW.marked(F); if (!on.length) return; const d = Math.max(1.5, F.r * 0.2), c = Math.cos(m.a), s = Math.sin(m.a);
      on.forEach((i, k) => { const off = -F.r * 0.12 - k * d * 2.4; R.ball(m.x + c * off, F.r * 1.05, m.y + s * off, d, 0, 0, d, d, R.rgb(MW.TRAITS[i].colour)); });
    },
    translate() { button(); if (mode() === 'meadow') guide(); card($('menuLearned')); card($('learned')); },
  };
}
