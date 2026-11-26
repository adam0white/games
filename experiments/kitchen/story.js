// The story: beats shown at the start of a day, missions they open, and one daily special.
// Rules only, no DOM, so bots.mjs can check them. Data is in story/beats.json and story/specials.json.
// Save shape (added to kitchen-save, never renamed): save.story = { seen: [beatId], open: [mission], done: [missionId], choice: {beatId: optionId}, special: {day, id, text, goal, n, pay, got, paid} }

export const DAY_INCOME = [28, 55, 100, 180, 300, 450, 620, 800, 1000, 1250, 1500];
// Goal types the game can count today. A mission of another type (the action wheel) waits until the game can count it.
export const COUNTABLE = new Set(['serve', 'clean_catch', 'perfect_cook', 'coins', 'tips', 'no_extra_day', 'dish', 'quick_serve']);

export function state(save) {
  save.story ??= { seen: [], open: [], done: [], choice: {} };
  const s = save.story; s.seen ??= []; s.open ??= []; s.done ??= []; s.choice ??= {};
  return s;
}

// The beats to show before today's first guest, in order. A beat is due on its rank's day (days counted from 1 at each
// rank), or any time later. Missed plot beats ("spine") still show after a quick rank-up; missed side beats are skipped.
export function due(save, beats) {
  const s = state(save), today = (save.dayAtTier ?? 0) + 1;
  const out = [];
  for (const b of beats) {
    if (s.seen.includes(b.id)) continue;
    const reached = save.tier > b.rank || (save.tier === b.rank && today >= b.day);
    if (!reached) continue;
    if (b.rank < save.tier && !b.spine) { s.seen.push(b.id); continue; }
    out.push(b);
  }
  // Older first; cap a day at three cards so the kitchen opens quickly. The rest wait for tomorrow.
  out.sort((a, b) => a.rank - b.rank || a.day - b.day);
  const cards = out.filter(b => b.kind !== 'toast').slice(0, 3), toasts = out.filter(b => b.kind === 'toast').slice(0, 2);
  return { cards, toasts };
}

// Mark a beat as seen and open its mission (if the game can count it and the mission is new).
export function see(save, b) {
  const s = state(save);
  if (!s.seen.includes(b.id)) s.seen.push(b.id);
  const m = b.mission;
  if (!m || s.done.includes(m.id) || s.open.some(o => o.id === m.id)) return null;
  if (!COUNTABLE.has(m.goal.type)) return null;
  const o = { id: m.id, text: m.text, goal: { ...m.goal }, reward: b.reward ?? 0, got: 0 };
  s.open.push(o);
  return o;
}

// Dishes the open missions and today's special ask for: the day plan serves each at least once if it is on the menu.
export function wantedDishes(save) {
  const s = state(save), out = [];
  for (const o of s.open) if (o.goal.type === 'dish') out.push(o.goal.dish);
  if (s.special?.day === save.day && s.special.goal.type === 'dish') for (let i = 0; i < s.special.n; i++) out.push(s.special.goal.dish);
  return out;
}
export function forceDishes(plan, dishes, menu) {
  const want = dishes.filter(d => menu.includes(d));
  const out = plan.map(p => ({ ...p }));
  // Put each wanted dish on a slot that does not already hold a wanted dish, skipping the first guest for variety.
  let slot = Math.min(1, out.length - 1);
  for (const d of want) {
    if (out.filter(p => p.recipe === d).length >= want.filter(x => x === d).length) continue;
    while (slot < out.length && want.includes(out[slot].recipe)) slot++;
    if (slot >= out.length) break;
    out[slot].recipe = d; slot += 2;
  }
  return out;
}

// Today's special: one a day, picked by the day's seed from the specials allowed at this rank.
export function pickSpecial(save, specials, menu, seed) {
  const s = state(save);
  if (s.special?.day === save.day) return s.special;
  const ok = specials.filter(x => (x.minRank ?? 0) <= save.tier && (x.maxRank ?? 99) >= save.tier && COUNTABLE.has(x.goal.type));
  if (!ok.length) return (s.special = null);
  const x = ok[seed % ok.length];
  const nArr = x.nPerRank ?? [x.goal.n];
  const n = typeof x.goal.n === 'number' ? x.goal.n : Math.round(nArr[Math.min(save.tier, nArr.length - 1)]);
  const dish = x.goal.type === 'dish' ? menu[(seed >>> 3) % menu.length] : null;
  const pay = Math.max(5, Math.round((x.pay ?? 0.5) * DAY_INCOME[Math.min(save.tier, DAY_INCOME.length - 1)]));
  s.special = { day: save.day, id: x.id, textTpl: x.text, goal: { ...x.goal, n, dish }, n, pay, got: 0, paid: false };
  return s.special;
}

// Count one game event toward the open missions and today's special. Returns the missions finished by it.
// Events: { type: 'serve', recipe, stars, tip, coins, quick } | { type: 'catch', clean } | { type: 'dayEnd', extras }
export function count(save, ev) {
  const s = state(save), done = [];
  const add = (goal, got) => {
    switch (goal.type) {
      case 'serve': return ev.type === 'serve' ? got + 1 : got;
      case 'dish': return ev.type === 'serve' && ev.recipe === goal.dish ? got + 1 : got;
      case 'perfect_cook': return ev.type === 'serve' && ev.stars >= 3 ? got + 1 : got;
      case 'quick_serve': return ev.type === 'serve' && ev.quick ? got + 1 : got;
      case 'tips': return ev.type === 'serve' ? got + (ev.tip ?? 0) : got;
      case 'coins': return ev.type === 'serve' ? got + (ev.coins ?? 0) : got;
      case 'clean_catch': return ev.type === 'catch' && ev.clean ? got + 1 : got;
      case 'no_extra_day': return ev.type === 'dayEnd' && ev.extras === 0 ? got + 1 : got;
      default: return got;
    }
  };
  for (const o of s.open) {
    o.got = add(o.goal, o.got);
    if (o.got >= (o.goal.n ?? 1)) done.push(o);
  }
  for (const o of done) { s.open = s.open.filter(x => x !== o); s.done.push(o.id); save.coins += o.reward; }
  const sp = s.special;
  if (sp && sp.day === save.day && !sp.paid) {
    sp.got = add(sp.goal, sp.got);
    if (sp.got >= sp.n) { sp.paid = true; save.coins += sp.pay; done.push({ id: 'special:' + sp.id, text: specialText(sp), reward: sp.pay, special: true }); }
  }
  return done;
}
export const specialText = (sp, dishName = d => d) => sp.textTpl.replace('{n}', sp.n).replace('{dish}', sp.goal.dish ? dishName(sp.goal.dish) : '');
export const progress = o => `${Math.min(o.got, o.goal.n ?? 1)}/${o.goal.n ?? 1}`;
