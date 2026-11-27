// Settings a player can change, each with a default, and a record of who changed what (owner, 2026-11-27: "Almost
// always, give the players more options ... Give this as a setting, set a default, then check how many players changed
// it and to what."). A game lists its options once; this keeps them, draws the buttons and tells the lab.
//
//   import { settings } from '../kit/settings.js';
//   const set = settings('lantern', {
//     river: { values: ['gentle', 'classic'], def: 'gentle' },
//     view:  { values: ['2d', '3d', 'first'], def: '2d', key: 'lantern-view' },   // a key the game already has
//     gain:  { values: ['1', '1.3', '1.7'], def: '1.3' },
//   }, { rec });                                  rec: the game's lab(slug) recorder, or nothing
//   set.get('river')                               the value in use: the saved one if it is still offered, else the default
//   set.set('river', 'classic')                    saves it; a real change is recorded (below) and passed to onChange
//   set.track('view', '3d')                        for an option the game saves itself: only the record
//   set.snapshot()                                 { river: 'gentle', view: '2d', gain: '1.3' } — put it in rec.start
//   set.changed()                                  ['view'] — the options that differ from their default
//   set.panel(el, { label, name, onChange })       a row of buttons per option inside el; returns a redraw function
//
// What is saved: values are strings. An option without `key` is kept under '<slug>:set:<id>'. `def` may be a function;
// it is asked once, on the first visit that meets the option, and its answer is kept under '<key>~def', so a default
// that depends on who the player is (new or returning) stays the same on later visits.
// What is recorded: on a change, rec.event('setting', { id, value, from, def }) — outside a run the lab gets it at once.
// Put snapshot() in rec.start to see the share of runs played on each value, including by players who never opened
// the settings. Nothing here reads or writes anything but the options named.
import { read, write } from './save.js';

export function settings(slug, defs, { rec = null } = {}) {
  const ids = Object.keys(defs), listeners = [];
  const keyOf = id => defs[id].key ?? `${slug}:set:${id}`;
  const defaults = {};
  for (const id of ids) {
    const d = defs[id], vals = d.values.map(String);
    if (typeof d.def === 'function') {
      const kept = read(`${keyOf(id)}~def`);
      if (kept !== null && vals.includes(kept)) defaults[id] = kept;
      else { const v = String(d.def()); defaults[id] = vals.includes(v) ? v : vals[0]; write(`${keyOf(id)}~def`, defaults[id]); }
    } else defaults[id] = vals.includes(String(d.def)) ? String(d.def) : vals[0];
  }
  const get = id => { const v = read(keyOf(id)); return v !== null && defs[id].values.map(String).includes(v) ? v : defaults[id]; };
  const track = (id, value, from = null) => { try { rec?.event('setting', { id, value: String(value), from: from === null ? null : String(from), def: defaults[id] ?? null }); } catch { /* recording never breaks a game */ } };
  function set(id, value) {
    value = String(value);
    if (!defs[id] || !defs[id].values.map(String).includes(value)) return get(id);
    const from = get(id); write(keyOf(id), value);
    if (from !== value) { track(id, value, from); for (const f of listeners) f(id, value, from); }
    return value;
  }
  const snapshot = () => Object.fromEntries(ids.map(id => [id, get(id)]));
  const changed = () => ids.filter(id => get(id) !== defaults[id]);
  // The buttons. label(id) names an option, name(id, value) names a choice, what(id, value) is an optional line under
  // the row for the choice in use. Text is the game's own, so it follows the game's language: call the returned
  // function after a language change, or after set() from elsewhere.
  function panel(host, { label = id => id, name = (id, v) => v, what = null, onChange = null, only = ids } = {}) {
    if (onChange) listeners.push(onChange);
    const draw = () => {
      host.textContent = '';
      for (const id of only) {
        const row = document.createElement('p'); row.className = 'setting'; row.dataset.setting = id;
        const head = document.createElement('b'); head.textContent = label(id); row.append(head, document.createElement('br'));
        for (const v of defs[id].values.map(String)) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.value = v; b.textContent = name(id, v);
          b.className = v === get(id) ? 'on' : ''; b.setAttribute('aria-pressed', v === get(id));
          b.addEventListener('click', () => { set(id, v); draw(); });
          row.append(b);
        }
        const line = what?.(id, get(id));
        if (line) { const small = document.createElement('small'); small.textContent = line; row.append(document.createElement('br'), small); }
        host.append(row);
      }
    };
    draw(); return draw;
  }
  return { get, set, track, snapshot, changed, panel, defaults: () => ({ ...defaults }), ids };
}
