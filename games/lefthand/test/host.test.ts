import { beforeEach, describe, expect, test } from "vitest";
import {
  type Command,
  canAsk,
  createGame,
  exportRun,
  hash,
  step as hostStep,
  isWall,
  projection,
  replayRun,
  type State,
} from "../src/host";

let ticks = 0;
beforeEach(() => {
  ticks = 0;
});
function step(s: State, c?: Command) {
  if (++ticks > 15000)
    throw new Error("Headless scenario exceeded its tick budget");
  return hostStep(s, c);
}

function command(s: State, c: Command) {
  step(s, c);
  if (s.recoveryPending) step(s, { type: "recover", choice: "explain" });
  while (s.conversationTicksRemaining > 0) step(s);
  if (c.type === "act")
    while (s.wellPendingTick !== null) {
      step(s);
      if (s.recoveryPending) step(s, { type: "recover", choice: "explain" });
    }
}
function walk(s: State, x: number, y: number) {
  // BFS uses the same public tile geometry the renderer draws.
  const start = `${s.player.x},${s.player.y}`,
    goal = `${x},${y}`;
  const queue = [start],
    from = new Map<string, { key: string; dx: number; dy: number }>();
  for (let i = 0; i < queue.length && !from.has(goal); i++) {
    const key = queue[i] ?? "",
      [px, py] = key.split(",").map(Number) as [number, number];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = `${px + dx},${py + dy}`;
      if (next !== start && !from.has(next) && !isWall(px + dx, py + dy)) {
        from.set(next, { key, dx, dy });
        queue.push(next);
      }
    }
  }
  const path: Command[] = [];
  let key = goal;
  while (key !== start) {
    const p = from.get(key);
    if (!p) throw Error("Unreachable tile");
    path.unshift({ type: "move", dx: p.dx, dy: p.dy });
    key = p.key;
  }
  for (const c of path) command(s, c);
}

describe("authoritative host", () => {
  test("explaining spends thirty fixed game ticks while quiet resumes immediately", () => {
    const explained = createGame(13);
    step(explained, { type: "plan", route: "door" });
    walk(explained, 11, 3);
    step(explained, { type: "act" });
    const quiet: State = JSON.parse(JSON.stringify(explained));
    step(explained, { type: "recover", choice: "explain" });
    step(quiet, { type: "recover", choice: "keepquiet" });
    expect(explained.nightTick).toBe(quiet.nightTick);
    expect(explained.conversationTicksRemaining).toBe(30);
    expect(quiet.conversationTicksRemaining).toBe(0);
    const before = { ...explained.player },
      started = explained.nightTick;
    step(explained, { type: "move", dx: 0, dy: -1 });
    expect(explained.player).toEqual(before);
    const restored: State = JSON.parse(JSON.stringify(explained));
    for (let i = 0; i < 29; i++) {
      step(explained);
      step(restored);
    }
    expect(explained.conversationTicksRemaining).toBe(0);
    expect(explained.nightTick - started).toBe(30);
    expect(hash(restored)).toBe(hash(explained));
    expect(hash(replayRun(exportRun(explained)))).toBe(hash(explained));
  });

  test("near dawn quiet can deliver while explaining reaches dawn before the action", () => {
    const base = createGame(13);
    command(base, { type: "plan", route: "door" });
    walk(base, 11, 3);
    step(base, { type: "act" });
    base.delivered = 0;
    base.deliveredTonight = false;
    base.envelopePlaced = false;
    // Isolate the boundary at an unresolved encounter beside the door.
    base.nightTick = 580;
    const explained: State = JSON.parse(JSON.stringify(base));
    const quiet: State = JSON.parse(JSON.stringify(base));
    step(explained, { type: "recover", choice: "explain" });
    step(quiet, { type: "recover", choice: "keepquiet" });
    step(quiet, { type: "act" });
    while (explained.phase === "night") step(explained, { type: "act" });
    expect(explained.nightTick).toBe(600);
    expect(explained.delivered).toBe(0);
    expect(explained.conversationTicksRemaining).toBe(0);
    expect(quiet.delivered).toBe(1);
  });

  test("aid received before either recovery remains delivered through its time cost", () => {
    for (const choice of ["explain", "keepquiet"] as const) {
      const s = createGame(13);
      command(s, { type: "plan", route: "door" });
      walk(s, 11, 3);
      step(s, { type: "act" });
      expect(s.deliveredTonight).toBe(true);
      step(s, { type: "recover", choice });
      for (let i = 0; i < 30; i++) step(s);
      expect(s.deliveredTonight).toBe(true);
      expect(s.delivered).toBe(1);
      expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
    }
  });

  test("cold rescue cancels a pending well handoff without awarding aid", () => {
    const s = createGame(13);
    command(s, { type: "plan", route: "well" });
    walk(s, 4, 7);
    step(s, { type: "lantern" });
    while (s.cold < 399) {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    step(s, { type: "act" });
    expect(s.wellPendingTick).not.toBeNull();
    while (s.phase === "night") {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    expect(s.status).toContain("cold");
    expect(s.delivered).toBe(0);
    expect(s.wellPendingTick).toBeNull();
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("three missed nights produce the loss ending and deterministic replay", () => {
    const s = createGame(7);
    for (let night = 1; night <= 3; night++) {
      step(s, { type: "plan", route: "door" });
      while (s.phase === "night") {
        if (s.recoveryPending)
          step(s, { type: "recover", choice: "keepquiet" });
        else step(s);
      }
      step(s, { type: "next" });
    }
    expect(s.phase).toBe("ended");
    expect(s.history).toHaveLength(3);
    expect(s.outcome).toContain("too little help");
    expect(s.people.every((p) => p.body.alive)).toBe(true);
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("a well envelope awaiting collection at dawn does not count as aid received", () => {
    const s = createGame(13);
    command(s, { type: "plan", route: "well" });
    walk(s, 4, 7);
    while (s.nightTick < 599) {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    step(s, { type: "act" });
    if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
    expect(s.phase).toBe("morning");
    expect(s.deliveredTonight).toBe(false);
    expect(s.delivered).toBe(0);
    expect(s.wellPendingTick).toBeNull();
    expect(s.morningLines.find((p) => p.id === "samira")?.line).toContain(
      "need help",
    );
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("a lit unavoidable encounter waits for recovery before cold or dawn can end the night", () => {
    const s = createGame(13);
    step(s, { type: "plan", route: "door" });
    step(s, { type: "lantern" });
    walk(s, 11, 3);
    step(s, { type: "act" });
    const nightTick = s.nightTick,
      cold = s.cold,
      fact = s.witness?.fact;
    const view = projection(s);
    expect(view.people.find((a) => a.id === s.witness?.id)?.lantern).toBe(true);
    expect(
      view.tiles.find((t) => t.x === s.player.x && t.y === s.player.y)?.lit,
    ).toBe(true);
    for (let i = 0; i < 650; i++) step(s);
    expect(s.phase).toBe("night");
    expect(s.nightTick).toBe(nightTick);
    expect(s.cold).toBe(cold);
    step(s, { type: "recover", choice: "keepquiet" });
    while (s.cold < 240) step(s);
    expect(projection(s).coldWarning).toContain("numb");
    while (s.phase === "night") {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    expect(s.status).toContain("cold");
    expect(s.witness?.fact).toBe(fact);
    expect(s.witness?.recovered).toBe("keepquiet");
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("public delivery changes HF relationships and delays the next well handoff", () => {
    const explained = createGame(13);
    command(explained, { type: "plan", route: "door" });
    walk(explained, 11, 3);
    expect(explained.witness).toBeNull();
    const quiet: State = JSON.parse(JSON.stringify(explained));
    for (const [s, choice] of [
      [explained, "explain"],
      [quiet, "keepquiet"],
    ] as const) {
      step(s, { type: "act" });
      expect(s.witness?.sight).toBe("leaving");
      expect(s.witness?.fact).toBe(
        "I saw Yusuf leave an envelope at the family door.",
      );
      command(s, { type: "recover", choice });
      walk(s, 7, 15);
      expect(s.witness?.place).toBe("family door");
      command(s, { type: "act" });
      command(s, { type: "next" });
      command(s, { type: "plan", route: "well" });
      walk(s, 4, 7);
      step(s, { type: "act" });
    }
    const trust = (s: State, id: string) =>
      s.people
        .find((p) => p.id === id)
        ?.social.relationships.find((r) => r.otherId === "yusuf")?.trust ?? 0.5;
    const witnessId = explained.history[0]?.witness?.id ?? "";
    expect(trust(explained, witnessId)).toBeGreaterThan(
      trust(quiet, witnessId),
    );
    expect(trust(explained, "samira")).toBeLessThan(0.5);
    expect(explained.exposureNights).toBe(1);
    expect(explained.assistedWell).toBe(true);
    expect(explained.deliveredTonight).toBe(false);
    expect(quiet.assistedWell).toBe(false);
    expect(quiet.deliveredTonight).toBe(false);
    expect(projection(quiet).handoffRemaining).toBeGreaterThan(0);
    if (quiet.recoveryPending)
      step(quiet, { type: "recover", choice: "keepquiet" });
    while (!quiet.deliveredTonight) step(quiet);
    expect(quiet.delivered).toBe(explained.delivered + 1);
    expect(hash(replayRun(exportRun(explained)))).toBe(hash(explained));
  });
  test("two deliveries meet the primary goal even when the third night misses dawn", () => {
    const s = createGame(4);
    for (let night = 1; night <= 3; night++) {
      command(s, { type: "plan", route: "well" });
      if (night < 3) {
        walk(s, 4, 7);
        command(s, { type: "act" });
        walk(s, 7, 15);
        command(s, { type: "act" });
      } else {
        while (s.phase === "night") {
          if (s.recoveryPending)
            command(s, { type: "recover", choice: "keepquiet" });
          else step(s);
        }
      }
      command(s, { type: "next" });
    }
    expect(s.delivered).toBe(2);
    expect(s.phase).toBe("ended");
    expect(s.outcome).toContain("at least two");
  });
  test("three nights deliver once per night; exposure preserves aid; both destinations reach family", () => {
    const s = createGame(13);
    for (let n = 1; n <= 3; n++) {
      const route = n === 2 ? "well" : "door";
      command(s, { type: "plan", route });
      walk(s, route === "door" ? 11 : 4, route === "door" ? 3 : 7);
      command(s, { type: "act" });
      expect(s.delivered).toBe(n);
      expect(s.people.find((p) => p.id === "samira")?.body.asleep).toBe(false);
      command(s, { type: "act" });
      expect(s.delivered).toBe(n);
      expect(s.witness).not.toBeNull();
      walk(s, 7, 15);
      command(s, { type: "act" });
      expect(s.phase).toBe("morning");
      expect(s.morningLines).toHaveLength(5);
      command(s, { type: "next" });
    }
    expect(s.phase).toBe("ended");
    expect(s.outcome).toContain("on all three nights");
    expect(s.history).toHaveLength(3);
    expect(s.people.every((p) => p.body.alive)).toBe(true);
    const log = exportRun(s),
      replay = replayRun(log);
    expect(hash(log.state)).toBe(hash(s));
    expect(hash(replay)).toBe(hash(s));
    // A restored whole state includes HF Persons and RNG, and can continue identically.
    const restored: State = JSON.parse(JSON.stringify(s));
    step(s, { type: "wait" });
    step(restored, { type: "wait" });
    expect(hash(restored)).toBe(hash(s));
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("active-night replay and JSON continuation retain people, RNG and authored witness facts", () => {
    const s = createGame(13);
    command(s, { type: "plan", route: "door" });
    walk(s, 11, 3);
    step(s, { type: "act" });
    for (let i = 0; i < 130; i++) step(s, { type: "wait" });
    expect(s.recoveryPending).toBe(true);
    expect(projection(s).people.some((p) => p.reaction.length > 0)).toBe(true);
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
    const restored: State = JSON.parse(JSON.stringify(s));
    for (const c of [
      { type: "recover", choice: "keepquiet" },
      { type: "lantern" },
      { type: "move", dx: 0, dy: -1 },
      { type: "wait" },
    ] as Command[]) {
      step(s, c);
      step(restored, c);
    }
    expect(hash(restored)).toBe(hash(s));
    const before = hash(s);
    const tampered: State = JSON.parse(JSON.stringify(restored));
    const rng = tampered.actorsRun.current.people.yusuf?.rng;
    if (!rng) throw Error("Missing player RNG");
    Object.assign(rng, { a: rng.a + 1 });
    expect(hash(tampered)).not.toBe(before);
    expect(() => replayRun(exportRun(tampered))).toThrow();
    restored.rng++;
    expect(hash(restored)).not.toBe(before);
    const fact = s.witness?.fact;
    for (let i = 0; i < 20; i++) step(s);
    expect(s.witness?.fact).toBe(fact);
  });

  test("dawn and cold end the night safely, and a missed night does not end the three-night game", () => {
    const s = createGame(7);
    command(s, { type: "plan", route: "door" });
    for (let i = 0; i < 600 && s.phase === "night"; i++) {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    expect(s.phase).toBe("morning");
    expect(s.status).toContain("Dawn");
    expect(s.delivered).toBe(0);
    command(s, { type: "next" });
    command(s, { type: "plan", route: "well" });
    command(s, { type: "lantern" });
    for (let i = 0; i < 500 && s.phase === "night"; i++) {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    expect(s.phase).toBe("morning");
    expect(s.status).toContain("cold");
    expect(s.people.every((p) => p.body.alive)).toBe(true);
  });

  test("seed varies routines and projection geometry agrees with movement", () => {
    const a = createGame(1),
      b = createGame(2);
    step(a, { type: "plan", route: "door" });
    step(b, { type: "plan", route: "door" });
    expect(a.routineOffset).not.toBe(b.routineOffset);
    const view = projection(a);
    expect(view.tiles).toHaveLength(270);
    expect(
      view.tiles
        .filter((t) => t.label)
        .map((t) => t.label)
        .sort(),
    ).toEqual(["door", "home", "well"]);
    expect(() => step(a, { type: "move", dx: 1, dy: 1 })).toThrow();
    a.player = { x: 1, y: 3, lantern: true };
    step(a, { type: "move", dx: 0, dy: -1 });
    expect(a.player.y).toBe(3);
  });
});

describe("iteration two consequences", () => {
  test("waiting at home never invents a sighting before the first move", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame(seed);
      step(s, { type: "plan", route: "well" });
      for (let i = 0; i < 150; i++) step(s);
      expect(s.witness).toBeNull();
      expect(s.recoveryPending).toBe(false);
      step(s, { type: "move", dx: 0, dy: -1 });
      expect(s.witness).toBeNull();
      expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
    }
  });
  test("a rescue leaves a shorter next night and no stale cold warning", () => {
    const s = createGame(13);
    command(s, { type: "plan", route: "well" });
    command(s, { type: "lantern" });
    for (let i = 0; i < 1000 && s.phase === "night"; i++) {
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
      else step(s);
    }
    expect(projection(s).coldWarning).toBe("");
    command(s, { type: "next" });
    command(s, { type: "plan", route: "well" });
    expect(projection(s).nightLimit).toBe(540);
    expect(s.status).toContain("rescue");
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });
});

test("an unseen door handoff is thanked, not exposed, even after a quiet sighting", async () => {
  const { shortestPath } = await import("../scripts/policies");
  const s = createGame(2);
  const quiet = () => {
    if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
  };
  const travel = (target: { x: number; y: number }) => {
    for (const c of shortestPath(s, target)) {
      quiet();
      step(s, c);
    }
  };
  step(s, { type: "plan", route: "door" });
  step(s, { type: "lantern" });
  travel({ x: 4, y: 7 });
  for (let i = 0; i < 30 && !s.witness; i++) step(s);
  quiet();
  expect(s.witness).toBeNull();
  travel({ x: 11, y: 3 });
  step(s, { type: "act" });
  quiet();
  travel({ x: 7, y: 15 });
  step(s, { type: "act" });
  expect(s.delivered).toBe(1);
  expect(s.exposureNights).toBe(0);
  expect(s.thankedNights).toBe(1);
  expect(s.morningLines.find((p) => p.id === "idris")?.line).toContain(
    "thank him quietly",
  );
  // Leaving the envelope at the door with the lantern lit is still public.
  const lit = createGame(1);
  step(lit, { type: "plan", route: "door" });
  walk(lit, 11, 3);
  command(lit, { type: "act" });
  expect(lit.witness?.sight).toBe("leaving");
  walk(lit, 7, 15);
  command(lit, { type: "act" });
  expect(lit.exposureNights).toBe(1);
  expect(lit.thankedNights).toBe(0);
  expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
});

test("Tariq's guess alone is village talk, not lost trust", () => {
  const s = createGame(1);
  step(s, { type: "plan", route: "well" });
  for (let i = 0; i < 10; i++) step(s);
  walk(s, 7, 9);
  for (let i = 0; i < 250 && !s.witness; i++) step(s);
  expect(s.witness?.id).toBe("tariq");
  expect(s.witness?.explanation).toContain("helping Idris and Samira");
  step(s, { type: "recover", choice: "keepquiet" });
  step(s, { type: "lantern" });
  walk(s, 4, 7);
  step(s, { type: "act" });
  while (!s.deliveredTonight) step(s);
  walk(s, 7, 15);
  step(s, { type: "act" });
  expect(s.phase).toBe("morning");
  expect(s.exposureNights).toBe(0);
  expect(s.talkNights).toBe(1);
  expect(s.history[0]?.talk).toBe(true);
  expect(s.morningLines.find((p) => p.id === "danyal")?.line).toContain(
    "Nobody can say for sure",
  );
  expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
});

test("quiet door nights end with the household thanking Yusuf", async () => {
  const { shortestPath } = await import("../scripts/policies");
  const s = createGame(2);
  for (let night = 1; night <= 3; night++) {
    step(s, { type: "plan", route: "door" });
    step(s, { type: "lantern" });
    for (const target of [
      { x: 11, y: 3 },
      { x: 7, y: 15 },
    ]) {
      while (
        Math.abs(s.player.x - target.x) + Math.abs(s.player.y - target.y) >
        1
      ) {
        if (s.recoveryPending)
          step(s, { type: "recover", choice: "keepquiet" });
        else step(s, shortestPath(s, target, true)[0]);
      }
      step(s, { type: "act" });
      if (s.recoveryPending) step(s, { type: "recover", choice: "keepquiet" });
    }
    if (s.phase === "night") step(s, { type: "act" });
    step(s, { type: "next" });
  }
  expect(s.phase).toBe("ended");
  expect(s.exposureNights).toBe(0);
  expect(s.ending).toBe("thanked");
  expect(s.outcome).toContain("Idris thanked him quietly");
});

describe("panel fix cycle (F-1626 to F-1631)", () => {
  const quietly = (s: State, choice: "keepquiet" | "ask" = "keepquiet") => {
    if (s.recoveryPending) step(s, { type: "recover", choice });
    while (s.conversationTicksRemaining > 0) step(s);
  };
  test("only the marker and the tiles directly beside it count; corner to corner is refused", () => {
    const s = createGame(1);
    step(s, { type: "plan", route: "well" });
    const targets = projection(s)
      .tiles.filter((t) => t.target)
      .map((t) => `${t.x},${t.y}`)
      .sort();
    expect(targets).toEqual(["3,7", "4,6", "4,7", "4,8", "5,7"]);
    s.player = { x: 5, y: 6, lantern: false };
    step(s, { type: "act" });
    expect(s.envelopePlaced).toBe(false);
    expect(s.status).toContain("corner to corner");
  });

  test("a failed delivery names its cause, and the ending names the nights", () => {
    const missed = createGame(13);
    command(missed, { type: "plan", route: "well" });
    walk(missed, 4, 7);
    while (missed.nightTick < 595) {
      quietly(missed);
      step(missed);
    }
    quietly(missed);
    step(missed, { type: "act" });
    while (missed.phase === "night") {
      quietly(missed);
      step(missed);
    }
    expect(missed.history[0]?.reason).toMatch(/Danyal needed \d+ more seconds/);
    const far = createGame(7);
    command(far, { type: "plan", route: "door" });
    while (far.phase === "night") {
      quietly(far);
      step(far);
    }
    expect(far.history[0]?.reason).toMatch(
      /before you left the envelope.*You were \d+ steps from the door/,
    );
    const s = createGame(4);
    for (let night = 1; night <= 3; night++) {
      command(s, { type: "plan", route: "well" });
      if (night !== 2) {
        walk(s, 4, 7);
        command(s, { type: "act" });
        walk(s, 7, 15);
        command(s, { type: "act" });
      } else
        while (s.phase === "night") {
          quietly(s);
          step(s);
        }
      command(s, { type: "next" });
    }
    expect(s.outcome).toContain("on nights 1 and 3");
  });

  test("mornings name the route, the lantern and who saw Yusuf; Samira always knows a door giver", () => {
    const s = createGame(1);
    step(s, { type: "plan", route: "well" });
    for (let i = 0; i < 10; i++) step(s);
    walk(s, 7, 9);
    for (let i = 0; i < 250 && !s.witness; i++) step(s);
    quietly(s);
    step(s, { type: "lantern" });
    walk(s, 4, 7);
    step(s, { type: "act" });
    while (!s.deliveredTonight) step(s);
    walk(s, 7, 15);
    step(s, { type: "act" });
    const line = (id: string) =>
      s.morningLines.find((p) => p.id === id)?.line ?? "";
    expect(line("yusuf")).toContain(
      "You left the envelope at the well box with your lantern hidden. Tariq saw you",
    );
    expect(line("samira")).toContain("Danyal knocked");
    expect(line("danyal")).toContain("Nobody can say for sure");
    command(s, { type: "next" });
    command(s, { type: "plan", route: "door" });
    walk(s, 11, 3);
    command(s, { type: "act" });
    walk(s, 7, 15);
    command(s, { type: "act" });
    expect(line("yusuf")).toContain("at their door with your lantern lit");
    expect(line("samira")).toContain("so I know it was him");
    expect(line("idris")).toMatch(/saw Yusuf leave the envelope|named us/);
  });

  test("asking a neighbour not to tell works once; his next sighting is exposure", async () => {
    const { policyCommand } = await import("../scripts/policies");
    const s = createGame(10);
    let refusal = "";
    while (s.phase !== "ended") {
      const w = s.witness;
      if (s.recoveryPending && w && canAsk(w))
        step(s, { type: "recover", choice: "ask" });
      else if (s.recoveryPending && w?.repeat && !refusal) {
        step(s, { type: "recover", choice: "ask" });
        expect(s.recoveryPending).toBe(true);
        refusal = s.status;
      } else if (s.recoveryPending)
        step(s, { type: "recover", choice: "keepquiet" });
      else step(s, policyCommand(s, "careless"));
    }
    expect(refusal).toContain("will not promise twice");
    const [first, , second] = s.history;
    expect(first?.witness?.recovered).toBe("ask");
    expect(first).toMatchObject({ talk: false, exposed: false });
    expect(
      first?.lines.find((p) => p.id === first.witness?.id)?.line,
    ).toContain("this once");
    expect(second?.witness).toMatchObject({
      id: first?.witness?.id,
      repeat: true,
      recovered: "keepquiet",
    });
    expect(second?.exposed).toBe(true);
    expect(second?.lines.find((p) => p.id === "idris")?.line).toContain(
      "after promising once to keep quiet",
    );
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("asking is offered only when the sighting would cost privacy", async () => {
    const { policyCommand } = await import("../scripts/policies");
    const s = createGame(13);
    for (let i = 0; i < 2000 && !s.recoveryPending; i++)
      step(s, policyCommand(s, "careful"));
    const w = s.witness;
    expect(w && !w.repeat && w.sight !== "leaving" && !w.explanation).toBe(
      true,
    );
    step(s, { type: "recover", choice: "ask" });
    expect(s.recoveryPending).toBe(true);
    expect(s.status).toContain("nothing to ask him to hide");
  });

  test("runs from the previous schema are refused, not misreplayed", () => {
    const run = exportRun(createGame(1));
    expect(() =>
      replayRun({ ...run, schema: "left-hand-run@3" } as never),
    ).toThrow("Keep the file and start fresh");
  });
});

describe("retests-1027c engine fixes", () => {
  test("route and lantern move sightings away from Home, and Danyal names carrying", () => {
    const well = createGame(2);
    step(well, { type: "plan", route: "well" });
    well.nightTick = 10;
    const wellKeeper = well.actors.find((a) => a.id === "danyal");
    if (!wellKeeper) throw Error("Missing well keeper");
    Object.assign(wellKeeper, { x: 7, y: 10 });
    well.player.y = 13;
    step(well, { type: "move", dx: 0, dy: -1 });
    expect(well.witness).toBeNull();
    well.player.y = 10;
    const door: State = JSON.parse(JSON.stringify(well));
    door.route = "door";
    const hidden: State = JSON.parse(JSON.stringify(well));
    hidden.player.lantern = false;
    step(well, { type: "move", dx: 0, dy: -1 });
    step(door, { type: "move", dx: 0, dy: -1 });
    step(hidden, { type: "move", dx: 0, dy: -1 });
    expect(well.witness).toMatchObject({ id: "danyal", sight: "carrying" });
    expect(well.status).toContain("carrying an envelope");
    expect(well.envelopePlaced).toBe(false);
    expect(door.witness).toBeNull();
    expect(hidden.witness).toBeNull();
    door.player.y = 7;
    const doorKeeper = door.actors.find((a) => a.id === "danyal");
    if (!doorKeeper) throw Error("Missing door keeper");
    doorKeeper.y = 6;
    step(door, { type: "move", dx: 0, dy: -1 });
    expect(door.witness?.id).toBe("danyal");
  });

  test("Return home walks from the door while time passes, and replays exactly", () => {
    const s = createGame(13);
    command(s, { type: "plan", route: "door" });
    walk(s, 11, 3);
    command(s, { type: "act" });
    const tick = s.nightTick;
    step(s, { type: "act" });
    expect(s.returningHome).toBe(true);
    expect(s.status).toContain("walking home");
    while (s.phase === "night") step(s);
    expect(s.nightTick - tick).toBeGreaterThan(30);
    expect(s.status).toContain("returned home");
    expect(s.player.y).toBeGreaterThanOrEqual(14);
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });

  test("a joke names nobody, costs a second, and preserves the witness's facts", async () => {
    const { policyCommand } = await import("../scripts/policies");
    const s = createGame(1);
    while (!s.recoveryPending) step(s, policyCommand(s, "careless"));
    const fact = s.witness?.fact;
    const guess = s.witness?.explanation;
    step(s, { type: "recover", choice: "joke" });
    expect(s.conversationTicksRemaining).toBe(10);
    expect(s.witness).toMatchObject({
      fact,
      explanation: guess,
      recovered: "joke",
    });
    expect(s.status).toContain("name nobody and deny nothing");
    expect(s.promised).toEqual([]);
    while (s.phase === "night") step(s, policyCommand(s, "careless"));
    expect(s.history[0]?.talk || s.history[0]?.exposed).toBe(true);
    expect(s.morningLines.find((p) => p.id === "yusuf")?.line).toContain(
      "You joked",
    );
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
    expect(() => step(s, { type: "recover", choice: "lie" } as never)).toThrow(
      "Unknown recovery",
    );
  });

  test("headless careless control still loses privacy and replays exactly", async () => {
    const { policyCommand } = await import("../scripts/policies");
    const s = createGame(7);
    while (s.phase !== "ended") step(s, policyCommand(s, "careless"));
    expect(s.ending).toBe("exposed");
    expect(hash(replayRun(exportRun(s)))).toBe(hash(s));
  });
});
