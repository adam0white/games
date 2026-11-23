import { expect, it } from "vitest";
import * as HF from "../src/hf";
import {
  conditionsText,
  createGame,
  exportRun,
  hash,
  recordLosses,
  replay,
  step,
  teacherAvailable,
} from "../src/model";

it("keeps all five chapters and all native episode archives across explicit year skips", () => {
  const g = createGame(21);
  expect(g.completedEpisodes).toEqual([]);
  for (let chapter = 0; chapter < 5; chapter++) {
    expect(g.age).toBe([3, 6, 10, 14, 18][chapter]);
    for (let lesson = 0; lesson < 3; lesson++)
      step(g, { type: "teach", practice: "look" });
    step(g, { type: "crisis" });
    step(g, { type: "reveal" });
    if (chapter < 4) step(g, { type: "arrange", practice: "look" });
  }
  expect(g.history).toHaveLength(5);
  expect(g.months).toBe(180);
  const saved = exportRun(g);
  expect(saved.episodes).toHaveLength(4);
  expect(new TextEncoder().encode(JSON.stringify(saved)).length).toBeLessThan(
    2_097_152,
  );
  for (const archive of [...saved.episodes, saved.native]) {
    expect(HF.need(HF.nativeReplay(archive)).verified).toBe(true);
    expect(archive.current.at).toBeLessThan(HF.DAY);
  }
  expect(exportRun(replay(JSON.parse(JSON.stringify(saved))))).toEqual(saved);
}, 30_000);

it("restores an episode boundary, continues identically and refuses altered earlier native data", () => {
  const g = createGame(22);
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "count" });
  step(g, { type: "crisis" });
  step(g, { type: "reveal" });
  step(g, { type: "arrange", practice: "wait" });
  const saved = exportRun(g);
  const cold = replay(JSON.parse(JSON.stringify(saved)));
  step(g, { type: "teach", practice: "refuse" });
  step(cold, { type: "teach", practice: "refuse" });
  expect(exportRun(cold)).toEqual(exportRun(g));
  const bad = JSON.parse(JSON.stringify(saved));
  bad.episodes[0].hashes.full = "0".repeat(64);
  bad.finalHash = hash({
    host: bad.state,
    native: bad.native,
    episodes: bad.episodes,
  });
  expect(() => replay(bad)).toThrow();
}, 30_000);

it("carries an actual prior-episode death into the new native cast without a new lesson", () => {
  const g = createGame(21);
  const at = HF.nextIngressAt(g.run);
  HF.serve(
    g.run,
    at,
    [
      HF.input(
        g.run,
        "episode-death-control",
        "lifecycle.received",
        {
          type: "death",
          person: { kind: "actor", id: "Maryam" },
          basis: {
            evidence: { kind: "evidence", id: "episode-death-control" },
            worldRevision: HF.current(g.run).world.revision,
          },
        },
        at,
      ),
    ],
    (events) => recordLosses(g, events),
  );
  expect(teacherAvailable(g, "count")).toBe(false);
  const originalLoss = structuredClone(g.losses);
  for (let i = 0; i < 3; i++) step(g, { type: "work" });
  step(g, { type: "crisis" });
  step(g, { type: "reveal" });
  step(g, { type: "arrange", practice: "count" });
  expect(teacherAvailable(g, "count")).toBe(false);
  expect(g.losses).toEqual(originalLoss);
  expect(g.lastLesson).not.toContain("remembers the earlier tasks");
  expect(() => step(g, { type: "teach", practice: "count" })).toThrow(
    /has died/,
  );
  const saved = exportRun(g);
  for (const archive of [...saved.episodes, saved.native])
    expect(HF.need(HF.nativeReplay(archive)).verified).toBe(true);
  // This independently injected lifecycle control is not an ordinary player-input export.
  expect(() => replay(saved)).toThrow(/saved result/);
}, 30_000);

it("does not describe a dead teacher teaching or taking new work", () => {
  const g = createGame(21);
  const at = HF.nextIngressAt(g.run);
  HF.serve(
    g.run,
    at,
    ["Danyal", "Maryam"].map((person) =>
      HF.input(
        g.run,
        `copy-death-${person}`,
        "lifecycle.received",
        {
          type: "death",
          person: { kind: "actor", id: person },
          basis: {
            evidence: { kind: "evidence", id: `copy-death-${person}` },
            worldRevision: HF.current(g.run).world.revision,
          },
        },
        at,
      ),
    ),
    (events) => recordLosses(g, events),
  );
  expect(conditionsText(g)).toContain(
    "He cannot be on duty or teach her a new task.",
  );
  expect(conditionsText(g)).not.toContain("watched him do");
  for (let chapter = 0; chapter < 5; chapter++) {
    for (let i = 0; i < 3; i++) step(g, { type: "work" });
    if (g.age === 18)
      expect(conditionsText(g)).not.toContain("or work with Danyal");
    step(g, { type: "crisis" });
    expect(JSON.stringify(g.history)).not.toContain(
      "Maryam misses the meal work",
    );
    step(g, { type: "reveal" });
    if (chapter < 4) step(g, { type: "arrange", practice: "look" });
  }
}, 30_000);
