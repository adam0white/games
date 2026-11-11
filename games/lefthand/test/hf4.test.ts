import {
  step as advance,
  exportRun as archive,
  inspect,
  preview,
  replay,
  restoreRun,
} from "@adam0white/human-framework";
import { describe, expect, test } from "vitest";
import { shortestPath } from "../scripts/policies";
import { eveningAccounts, need, verifyArchive } from "../src/actors";
import { createGame, exportRun, hash, replayRun, step } from "../src/host";

describe("HF 4 host boundary", () => {
  test("the evening phrasebook renders through HF without changing replay", () => {
    const state = createGame(13);
    step(state, { type: "plan", route: "well" });
    const before = exportRun(state);
    const accounts = eveningAccounts(state);
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.some(({ line }) => /Tonight|evening/.test(line))).toBe(
      true,
    );
    expect(eveningAccounts(state)).toEqual(accounts);
    expect(exportRun(state)).toEqual(before);
    expect(eveningAccounts(replayRun(before))).toEqual(accounts);
  });
  test("HF owns natural doze and a real handoff wakes Samira; JSON continuation and preview stay exact", () => {
    const state = createGame(7);
    step(state, { type: "plan", route: "door" });
    for (
      let budget = 0;
      budget < 550 && !state.people.find((p) => p.id === "samira")?.body.asleep;
      budget++
    )
      step(state);
    expect(state.people.find((p) => p.id === "samira")?.body.asleep).toBe(true);
    const saved = JSON.parse(JSON.stringify(state));
    const run = need(restoreRun(saved.actorsRun));
    const before = archive(run);
    need(
      inspect(run, {
        perspective: { kind: "host" },
        people: ["samira"],
        select: ["body", "summary"],
      }),
    );
    need(
      preview(run, {
        perspective: { kind: "person", observer: "samira" },
        person: "samira",
        until: before.current.at + 1000,
        inputs: [],
      }),
    );
    expect(archive(run)).toEqual(before);
    verifyArchive(before);
    step(state, { type: "wait" });
    step(saved, { type: "wait" });
    expect(hash(saved)).toBe(hash(state));
    for (const command of shortestPath(state, { x: 11, y: 3 })) {
      step(state, command);
      step(saved, command);
      if (state.recoveryPending) {
        const reply = {
          type: "recover" as const,
          choice: "keepquiet" as const,
        };
        step(state, reply);
        step(saved, reply);
      }
    }
    step(state, { type: "act" });
    step(saved, { type: "act" });
    expect(state.deliveredTonight).toBe(true);
    expect(state.people.find((p) => p.id === "samira")?.body.asleep).toBe(
      false,
    );
    expect(hash(saved)).toBe(hash(state));
    expect(hash(replayRun(exportRun(state)))).toBe(hash(state));
  });
  test("pending interruption identity and replay survive a full archive round-trip", () => {
    const state = createGame(13);
    step(state, { type: "plan", route: "door" });
    const run = need(restoreRun(state.actorsRun));
    const view = need(
      inspect(run, {
        perspective: { kind: "host" },
        people: ["danyal"],
        select: ["summary"],
      }),
    );
    const person = view.people[0];
    if (person?.kind !== "host") throw Error("Missing host reading");
    const summary = person.parts[0];
    if (summary?.select !== "summary" || !summary.value.activity)
      throw Error("Missing routine activity");
    const at = view.at + 1;
    const result = need(
      advance(run, {
        until: at,
        inputs: [
          {
            id: "control:interrupt",
            at,
            source: { type: "host", id: "lefthand" },
            kind: "activity.interrupted",
            payload: {
              person: "danyal",
              activityId: summary.value.activity.id,
              reason: "control knock",
            },
          },
        ],
      }),
    );
    expect(result.boundary.type).toBe("world-required");
    const saved = archive(run);
    const restored = need(restoreRun(JSON.parse(JSON.stringify(saved))));
    expect(archive(restored)).toEqual(saved);
    const check = need(replay(saved));
    expect(check.verified).toBe(true);
    expect(check.fullHash).toBe(saved.hashes.full);
  });
  test("older engines refuse explicitly without changing the input file", () => {
    const saved = exportRun(createGame(3));
    const old = { ...saved, engine: "3.2.0" };
    expect(() => replayRun(old)).toThrow("Keep the file and start fresh");
    expect(old.engine).toBe("3.2.0");
  });
});
