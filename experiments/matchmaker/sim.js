// Good Match. Pure rules: no clocks, browser APIs, random globals or hidden solver answers.
// A street has one specialist per door skill. Each helper has exactly one of those skills.
// Eyewitness clues are exact. Reputation makes heard clues exact. Honest speech is exact;
// boastful people can add positives, shy people can add negatives. The converse is reliable.
// Unstarred hearsay is evidence worth testing, never a logical constraint.
export const SKILLS = ['baby', 'garden', 'cooking', 'heavy', 'dog', 'patience'];
export const LEVELS = 20;
export const TEMPERAMENTS = ['honest', 'boastful', 'shy', 'boastful', 'shy', 'boastful'];
export function dailySeed(day) {
  let h = 2166136261;
  for (const c of String(day)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function rand(s) {
  s.r = (s.r + 0x6d2b79f5) | 0;
  let t = s.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function permutations(a) {
  if (a.length < 2) return [a.slice()];
  return a.flatMap((v, i) => permutations(a.filter((_, j) => i !== j)).map(p => [v, ...p]));
}
export function reliable(helper, clue) {
  return clue.source === 'seen' || (clue.source === 'heard' && helper.reputation) ||
    (clue.source === 'said' && (helper.temperament === 'honest' ||
      (helper.temperament === 'boastful' && !clue.value) ||
      (helper.temperament === 'shy' && clue.value)));
}
// Observe only: this function does not read truth, tryoutSkill, seed, or the generating RNG.
export function consistentAssignments(s) {
  return permutations(s.helpers.map((_, i) => i)).filter(a => a.every((h, d) =>
    s.helpers[h].clues.every(c => !reliable(s.helpers[h], c) ||
      (s.doors[d].skill === c.skill) === c.value)));
}
export function create({ level = 1, seed = 1, reputation = [] } = {}) {
  level = Math.max(1, Math.min(LEVELS, Math.floor(level)));
  seed = typeof seed === 'number' ? seed >>> 0 : dailySeed(seed);
  const s = { level, seed, r: seed, helpers: [], doors: [], budget: 0, remaining: 0,
    placements: [], revealed: [], phase: 'play', events: [], result: null };
  // The threshold rises with difficulty: later streets have more misleading hearsay.
  const gossipRoll = rand(s);
  const n = level < 8 ? 3 : level < 14 ? 4 : 5;
  const selected = shuffle(s, SKILLS.map((_, i) => i)).slice(0, n);
  s.doors = shuffle(s, selected).map(skill => ({ skill }));
  const helperSkills = shuffle(s, selected);
  const honest = helperSkills.findIndex(skill => TEMPERAMENTS[skill] === 'honest');
  const currentId = skill => `helper-${skill}-street-${level}`;
  const earnedId = skill => reputation.find(id => new RegExp(`^helper-${skill}(?:-|$)`).test(id));
  const returningIndex = helperSkills.findIndex(skill => earnedId(skill));
  const known = honest >= 0 ? honest : returningIndex >= 0 ? returningIndex : 0;
  const uncertain = helperSkills.map((_, i) => i).filter(i => i !== known);
  const badGossip = level > 1 && gossipRoll < (level - 1) / 20;
  s.helpers = helperSkills.map((skill, i) => {
    const temperament = TEMPERAMENTS[skill];
    // One familiar specialist anchors a new street. Other faces are new; a saved
    // six-skill roster cannot remove the remaining campaign's uncertainty. Replaying
    // this exact street keeps its identities and can retain their earned stars.
    const freshId = currentId(skill);
    const id = reputation.includes(freshId) ? freshId :
      i === known && level > 1 ? earnedId(skill) || freshId : freshId;
    const next = uncertain[(uncertain.indexOf(i) + 1) % uncertain.length];
    const wrong = helperSkills[i === known ? (i + 1) % n : next];
    const star = reputation.includes(id);
    const speech = temperament === 'honest' ? { skill, value: true } :
      temperament === 'shy' ? { skill, value: false } : { skill: wrong, value: true };
    const heard = star || i === known || !badGossip ? skill : wrong;
    const clues = [{ source: 'said', ...speech }, { source: 'heard', skill: heard, value: true }];
    if (level === 1 || (i === known && !star)) clues.push({ source: 'seen', skill, value: true });
    return { id, temperament, reputation: star, truth: SKILLS.map((_, k) => k === skill),
      tryoutSkill: skill, clues };
  });
  const unresolved = s.helpers.filter(h => !h.clues.some(c => reliable(h, c) && c.value)).length;
  s.budget = s.remaining = Math.max(0, unresolved - 1);
  s.placements = Array(n).fill(null);
  return s;
}
export function canTryout(s, h) {
  const helper = s.helpers[h];
  return s.phase === 'play' && s.remaining > 0 && helper &&
    !helper.clues.some(c => c.source === 'seen' && c.value);
}
export function tryout(s, h) {
  if (!canTryout(s, h)) return null;
  const helper = s.helpers[h];
  const clue = { source: 'seen', skill: helper.tryoutSkill, value: true };
  helper.clues.push(clue);
  s.remaining--;
  s.revealed.push(h);
  s.events.push({ type: 'tryout', helper: h, clue: { ...clue }, remaining: s.remaining });
  return clue;
}
// A placed helper swaps with an occupied door. An unplaced helper returns its occupant to the bench.
export function place(s, h, d) {
  if (s.phase !== 'play' || !Number.isInteger(h) || !s.helpers[h] || !Number.isInteger(d) || !s.doors[d]) return false;
  const previous = s.placements.indexOf(h), displaced = s.placements[d];
  if (previous === d) return false;
  if (previous >= 0) s.placements[previous] = displaced;
  s.placements[d] = h;
  s.events.push({ type: 'place', helper: h, door: d, displaced });
  if (s.placements.every(v => v !== null)) s.phase = 'reveal';
  return true;
}
export function finish(s) {
  if (s.result) return s.result;
  if (s.phase !== 'reveal') return null;
  const matches = s.placements.map((h, d) => Boolean(s.helpers[h].truth[s.doors[d].skill]));
  const correct = matches.filter(Boolean).length, total = s.doors.length;
  const stars = correct === total ? 3 : correct >= Math.ceil(total / 2) ? 2 : correct > 0 ? 1 : 0;
  s.result = { correct, total, stars, matches, perfect: correct === total,
    reputation: s.placements.filter((_, d) => matches[d]).map(h => s.helpers[h].id),
    tryouts: s.budget - s.remaining };
  s.phase = 'end';
  s.events.push({ type: 'end', ...s.result });
  return s.result;
}
// The policy reads visible clues only. Each observation fixes one helper; the final
// specialist follows by elimination. Thus u unknown helpers need at most u−1 tryouts.
export function inspectionPolicy(s) {
  const candidates = consistentAssignments(s);
  if (candidates.length <= 1) return { unique: candidates.length === 1,
    assignment: candidates[0] ?? null, helper: null, candidates: candidates.length };
  for (let h = 0; h < s.helpers.length; h++) {
    if (canTryout(s, h) && new Set(candidates.map(a => a.indexOf(h))).size > 1)
      return { unique: false, assignment: null, helper: h, candidates: candidates.length };
  }
  return { unique: false, assignment: null, helper: null, candidates: candidates.length };
}
// Plan by interacting with a copy through the player's tryout API. The policy never
// reads hidden fields. Returned tryouts are real observations, not oracle guesses.
export function solve(s) {
  const copy = JSON.parse(JSON.stringify(s)), tryouts = [];
  let p = inspectionPolicy(copy);
  while (!p.unique && p.helper !== null) {
    tryouts.push(p.helper);
    if (!tryout(copy, p.helper)) break;
    p = inspectionPolicy(copy);
  }
  return { assignment: p.assignment, tryouts, unique: p.unique,
    remaining: copy.remaining, candidates: p.candidates };
}
