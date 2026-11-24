import assert from "node:assert/strict";
import {
  create,
  step,
  careful,
  safe,
  wave,
  position,
  rng,
  LEVELS,
  DT,
} from "./sim.js";
const mutate = process.argv.includes("--mutate");
let failures = 0;
function check(ok, text) {
  console.log(`${ok ? "ok" : "FAIL"} ${text}`);
  if (!ok) failures++;
}
// Mutation removes the actual doorway protection in safe(). No policy is changed.
// A full smoke wave in a doorway must then consume breath and fail this invariant.
{
  const s = create({ level: 12, seed: 17 });
  s.mutateAlcoves = mutate;
  s.progress = 0.8;
  s.phases[1] = 0;
  s.tick = Math.round(((0.18 - 0.19 + 1) * s.config.period) / DT);
  const before = s.breath;
  for (let i = 0; i < 30; i++) step(s, false);
  check(
    s.breath === before,
    "a stationary doorway protects breath through thick smoke",
  );
  if (mutate) {
    console.log("Mutation: safe() no longer protects doorways or stairs.");
    process.exit(failures ? 1 : 0);
  }
}
{
  const s = create({ level: 12, seed: 7 });
  s.config.drain = 0;
  s.config.limit = Infinity;
  s.progress = 4.7;
  s.people.forEach((p, i) =>
    Object.assign(p, { at: 0, joined: true, progress: s.progress - i * 0.012 }),
  );
  const random = rng(811);
  for (let i = 0; i < 2400; i++) {
    const before = s.people.map((p) => p.progress);
    step(s, random() > 0.5);
    assert(
      s.people.every((p, j) => p.progress >= before[j]),
      "followers never move backwards when the line spreads",
    );
  }
  check(
    true,
    "2400 mixed hold/release steps preserve every follower’s forward progress",
  );
  function tail(normal) {
    const q = create({ level: 12, seed: 7 });
    q.progress = 4.7;
    q.config.permanentFloor = 4;
    q.people.forEach((p, i) =>
      Object.assign(p, {
        kind: normal ? "neighbour" : p.kind,
        at: 0,
        joined: true,
        progress: q.progress - i * 0.012,
      }),
    );
    for (let i = 0; i < 105; i++) step(q, true);
    return q;
  }
  const ordinary = tail(true),
    slow = tail(false);
  const extra = ordinary.people.at(-1).progress - slow.people.at(-1).progress;
  const exposure = Math.abs(
    ordinary.people.at(-1).breath - slow.people.at(-1).breath,
  );
  check(
    extra >= 0.06 && exposure > 1,
    `elder and child lengthen the tail by ${extra.toFixed(3)} route units and alter tail breath by ${exposure.toFixed(1)}`,
  );
}
function run(level, seed, policy, seconds = 240, daily = false) {
  const s = create({ level, seed, daily }),
    random = rng(seed * 927 + 31);
  let next = 0,
    held = false;
  while (!s.over && s.t < seconds) {
    if (policy === "careful") held = careful(s);
    else if (s.t >= next) {
      // Slow, imprecise reactions. Reads present smoke only, never forecasts it.
      next = s.t + 1.8 + random() * 2.2;
      const w = wave(s, position(s).floor);
      held = w.smoke < 0.55 ? random() > 0.08 : random() > 0.55;
    }
    step(s, held);
  }
  return s;
}
const N = 32,
  rows = [];
for (const level of [1, 2]) {
  const seeds = [
    ...Array.from({ length: N }, (_, i) => i + 1),
    1700 + level * 97,
    1801,
  ];
  const holdLosses = [];
  const releaseWins = { warning: [], smoke: [] };
  for (const seed of seeds) {
    for (const delay of [0, 3.4, 12]) {
      for (const releaseAt of [null, "warning", "smoke"]) {
        const s = create({ seed, level });
        while (s.t < delay) step(s, false);
        const start = s.t;
        let releases = 0;
        while (!s.over) {
          const w = wave(s, position(s).floor);
          const hold = !releaseAt || !w.gust || (releaseAt === "smoke" && w.warning);
          if (s.held && !hold) releases++;
          step(s, hold);
        }
        if (releaseAt && s.over === "win" && s.stars === 3 && releases === level)
          releaseWins[releaseAt].push(s.t - start);
        if (!releaseAt && s.over === "lost" && s.floorReached === 1 && s.t - start < 20)
          holdLosses.push(s.t - start);
      }
    }
  }
  const total = seeds.length * 3;
  check(
    holdLosses.length === total,
    `level ${level}: continuous hold loses on the first floor in ${holdLosses.length}/${total} runs (last at ${Math.max(...holdLosses).toFixed(2)}s)`,
  );
  for (const [cue, wins] of Object.entries(releaseWins)) {
    check(
      wins.length === total,
      `level ${level}: ${level} release(s) at ${cue} earn three stars in ${wins.length}/${total} runs (last at ${Math.max(...wins).toFixed(2)}s)`,
    );
  }
}
for (let level = 1; level <= LEVELS.length; level++) {
  const carefulRuns = [],
    clumsyRuns = [];
  for (let seed = 1; seed <= N; seed++) {
    carefulRuns.push(run(level, seed, "careful"));
    clumsyRuns.push(run(level, seed, "clumsy"));
  }
  const won = carefulRuns.filter((s) => s.over === "win"),
    clumsyWon = clumsyRuns.filter((s) => s.over === "win");
  check(won.length === N, `careful level ${level}: ${won.length}/${N} wins`);
  rows.push({
    level,
    careful: won.length,
    clumsy: clumsyWon.length,
    seconds: +(carefulRuns.reduce((n, s) => n + s.t, 0) / N).toFixed(1),
    minimumBreath: +Math.min(
      ...carefulRuns.map((s) => s.minimumBreath),
    ).toFixed(1),
  });
}
console.table(rows);
check(
  rows[0].clumsy >= N * 0.75,
  "clumsy bot finishes level 1 on at least 75% of seeds",
);
check(
  rows.every((row, i) => !i || row.clumsy <= rows[i - 1].clumsy),
  "clumsy win count never rises from one level to the next",
);
check(
  rows.every((row, i) => !i || row.clumsy < rows[i - 1].clumsy),
  "clumsy win count falls at every level",
);
const blocks = [0, 3, 6, 9].map((i) =>
  rows.slice(i, i + 3).reduce((n, r) => n + r.clumsy, 0),
);
check(
  blocks.every((n, i) => !i || n < blocks[i - 1]),
  `clumsy wins fall across three-level blocks: ${blocks.join(", ")} / ${N * 3}`,
);
check(
  rows[0].seconds >= 60 && rows.at(-1).seconds <= 240,
  "careful runs stay within 1–4 minutes",
);
{
  const a = run(9, 413, "clumsy"),
    b = run(9, 413, "clumsy");
  assert.deepEqual(a, b);
  check(
    true,
    "same seed and hold/release inputs give identical complete state",
  );
  const a2 = create({ seed: 1 }),
    b2 = create({ seed: 2 });
  check(
    JSON.stringify(a2.phases) !== JSON.stringify(b2.phases),
    "different seeds change the wave clocks",
  );
}
{
  const s = run(12, 20261123, "careful", 420, true);
  check(
    s.dailyFloors >= 10 && !s.over,
    `daily careful bot rescues ${s.dailyFloors} floors over ${s.t.toFixed(1)}s without failure`,
  );
}
// The tail is independently exposed: same floor, different doorway positions.
{
  const s = create({ level: 12, seed: 2 });
  s.progress = 1.3 + 0.8;
  s.people[0].joined = true;
  s.people[0].at = 0;
  s.people[0].progress = s.progress - 0.24;
  const b = s.people[0].breath;
  step(s, false);
  check(
    s.breath === 100 && s.people[0].breath < b,
    "a safe leader does not make an exposed follower safe",
  );
}
console.log(
  `${failures ? "FAILED" : "PASS"}: ${failures} failures; ${N} seeds per level; ${N * 12} careful and ${N * 12} clumsy runs.`,
);
process.exit(failures ? 1 : 0);
