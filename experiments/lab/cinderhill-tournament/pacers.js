// Pacers: rule-based minds that decide when a side sends, holds or rotates. Each is a factory that returns a
// function of seen(game, side) (sim.js) giving a verb or null. They read only what a player could see: their own
// ants, and how both rings look. The neighbours in the page use them; bots.mjs pits them against each other.
import { CAP, WAVE } from './sim.js';

const count = (list, test) => { let n = 0; for (const x of list) if (test(x)) n++; return n; };

// All in: send every ant that is home as soon as it has a little strength (floor), to keep the ring stuffed.
// Never rotates, never holds back. The plain "bigger swarm" plan.
export const allIn = ({ floor = 200 } = {}) => v => (v.nest.some(x => x >= floor) ? 'send' : null);

// Careful: keep the ring full of fresh ants. Swap out a wave once enough are tired and enough rested ants wait;
// never send an ant that has not rested, except in the last 15 seconds, when rest no longer pays.
export const careful = ({ tired = 450, ready = 650 } = {}) => v => {
  const coming = v.out + v.edge, late = v.left < 150;
  const fresh = count(v.nest, x => x >= (late ? 200 : ready));
  const worn = count(v.ring, x => x < tired);
  if (worn >= 5 && fresh >= 5 && coming === 0) return 'rotate';
  if (v.ring.length + coming < CAP && fresh > 0 && coming < WAVE) return 'send';
  return null;
};

// Patient (the Jar-keepers): show a small front, rest the rest, then surge with everything fresh once the other
// side's show starts to fade below its numbers, or when time runs short.
export const patient = () => {
  let surged = false;
  return v => {
    const coming = v.out + v.edge;
    if (!surged && (v.theirs.fresh < 0 && v.t > 150 || v.left < 450)) surged = true;
    const front = surged ? CAP : 12;
    const fresh = count(v.nest, x => x >= 700);
    const worn = count(v.ring, x => x < 400);
    if (surged && worn >= 5 && fresh >= 5 && coming === 0) return 'rotate';
    if (v.ring.length + coming < front && fresh > 0 && coming < WAVE) return 'send';
    return null;
  };
};

// Mirror: match the other ring's numbers, a wave at a time, and rotate like the careful pacer.
export const mirror = () => v => {
  const coming = v.out + v.edge;
  const fresh = count(v.nest, x => x >= 600);
  const worn = count(v.ring, x => x < 450);
  if (worn >= 5 && fresh >= 5 && coming === 0) return 'rotate';
  if (v.ring.length + coming < Math.min(CAP, v.theirs.n + 2) && fresh > 0 && coming < WAVE) return 'send';
  return null;
};

// Idle: sends one wave and never acts again. A floor for the checks.
export const idle = () => { let done = false; return () => (done ? null : (done = true, 'send')); };

// The neighbours a player can face in the page. Names are Cinderhill's own (02-spec, section 5).
export const NEIGHBOURS = {
  thornbacks: { pacer: allIn, ants: 120 },
  jarkeepers: { pacer: patient, ants: 90 },
  leafstitchers: { pacer: careful, ants: 80 },
};
export const PLAYER_ANTS = 60;
