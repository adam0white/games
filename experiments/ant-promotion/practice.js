// The practice meadow (tester t1, note #261, 2026-11-25): be any of the 51 animals and try its skill. Page only; the rules are sim.js's own.
// Nothing here saves: index.html keeps a copy of the save while practice runs, writes nothing, and puts the copy back at the menu.
import { FORMS, ANT, WORLD, skillFor } from './sim.js';
import { t, animal, skill } from './words.js';
import './practice-words.js';

export const PRACTICE_CD = 3; // the longest wait for a skill in practice, in seconds
export const practiceAnimals = () => FORMS.filter(f => f.level >= 2 && skillFor(f));

// A full climb that ends in F, so the level, the view and the meadow are F's own. The levels between are of another kind than F,
// so F is plain: no "fast again" or "sneaky again" boost from earlier picks.
export function practiceStack(F) {
  const stack = [ANT];
  for (let L = 2; L < F.level; L++) { const row = FORMS.filter(f => f.level === L); stack.push((row.find(f => f.role !== F.role) || row[0]).id); }
  stack.push(F.id); return stack;
}

// One weaker animal just ahead and one stronger animal off to the side, both looking away, so a skill that needs a target has one at once.
export function practiceStage(s, F) {
  const p = s.player; p.a = 0;
  const weak = FORMS.find(f => f.level === F.level - 1 && f.power < F.power);
  const strong = FORMS.find(f => f.level > F.level && f.level <= F.level + 2 && f.power > F.power) || FORMS.find(f => f.level === F.level && f.power > F.power);
  const put = (M, dx, dy, a) => { if (!M) return; const x = Math.max(40, Math.min(WORLD - 40, p.x + dx)), y = Math.max(40, Math.min(WORLD - 40, p.y + dy));
    s.mobs = s.mobs.filter(m => Math.hypot(m.x - x, m.y - y) > 120); s.mobs.push({ id: s.nextId++, f: M.id, x, y, a, alert: false, lost: 0, timer: 0, want: a, walk: false, ph: 0 }); };
  put(weak, 140 + F.r, 0, 0);
  put(strong, 0, 300 + F.r, Math.PI / 2);
}

// The picker: every animal with its skill, a row per level.
export function practicePicker(box, portrait, pick) {
  box.textContent = '';
  for (const F of practiceAnimals()) {
    if (!box.querySelector(`[data-level="${F.level}"]`)) { const h = Object.assign(document.createElement('h3'), { textContent: t('practice.level', { n: F.level }) }); h.dataset.level = F.level; box.append(h); }
    const b = document.createElement('button'), pic = document.createElement('canvas'); pic.width = pic.height = 144;
    portrait(pic, F, 28); b.className = 'practiceOpt'; b.dataset.name = F.name;
    b.append(pic, Object.assign(document.createElement('b'), { textContent: animal(F.name) }), Object.assign(document.createElement('small'), { textContent: skill(skillFor(F).label) }));
    b.onclick = () => pick(F); box.append(b);
  }
}
