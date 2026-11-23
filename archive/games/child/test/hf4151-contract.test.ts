import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as NativeHF from "@adam0white/human-framework";
import { readRunHistory } from "@adam0white/human-framework";
import { describe, expect, it, vi } from "vitest";
import * as HF from "../src/hf";
import {
  chapterMonthAt,
  createGame,
  exportRun,
  hostState,
  type Input,
  recordLosses,
  replay,
  restore,
  step,
} from "../src/model";

// Preserve every real public export; spies below return actual native results.
vi.mock(import("@adam0white/human-framework"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

it("compares persisted host fields across JSON key orders without hiding changed values", () => {
  const original = {
    seed: 21,
    losses: [{ person: "Maryam", evidence: [{ id: "death", at: 1 }] }],
  };
  const reordered = {
    losses: [{ evidence: [{ at: 1, id: "death" }], person: "Maryam" }],
    seed: 21,
  };
  expect(HF.sameJson(original, reordered)).toBe(true);
  expect(HF.sameJson(original, { ...reordered, seed: 22 })).toBe(false);
  expect(HF.sameJson(original, { seed: 21, losses: [] })).toBe(false);
  expect(HF.sameJson({ inputs: [1, 2] }, { inputs: [2, 1] })).toBe(false);
});

const actions: Input[] = [
  { type: "teach", practice: "look" },
  { type: "teach", practice: "look" },
  { type: "teach", practice: "look" },
  { type: "crisis" },
  { type: "reveal" },
  { type: "arrange", practice: "look" },
];

describe("current Child composition", () => {
  it("authors the six original ages on one clock and keeps the native opening exact", () => {
    const g = createGame(21);
    const state = HF.current(g.run);
    expect(Object.keys(state.people).sort()).toEqual([...HF.cast].sort());
    for (const [id, age] of [
      ["elif", 3],
      ["Zehra", 31],
      ["Yusuf", 34],
      ["Maryam", 68],
      ["Danyal", 52],
      ["Tariq", 16],
    ] as const) {
      expect(state.people[id]?.now).toBe(0);
      expect(state.people[id]?.life.bornAt).toBe(-age * HF.YEAR);
    }
    const exported = exportRun(g);
    expect(exported.engine).toBe(HF.ENGINE);
    expect(exportRun(restore(exported))).toEqual(exported);
    expect(exportRun(replay(exported))).toEqual(exported);
  });

  it("refuses the old game world with a start-fresh instruction", () => {
    const exported = exportRun(createGame(21));
    expect(() =>
      replay({ ...exported, edition: 4 } as unknown as typeof exported),
    ).toThrow("Start a fresh upbringing");
    expect(() =>
      replay({ ...exported, engine: "4.15.1" } as unknown as typeof exported),
    ).toThrow("Start a fresh upbringing");
  });

  it.each([0, 1, 2, 3, 4, 5])(
    "continues cold exactly after public action prefix %i",
    (index) => {
      const g = createGame(21, true);
      for (const action of actions.slice(0, index)) step(g, action);
      const action = actions[index];
      if (action === undefined) throw Error("Missing action.");
      const before = JSON.parse(JSON.stringify(exportRun(g)));
      const cold = restore(before);
      const replayed = replay(before);
      const at = HF.current(g.run).at;
      step(g, action);
      step(cold, action);
      step(replayed, action);
      expect(exportRun(cold)).toEqual(exportRun(g));
      expect(exportRun(replayed)).toEqual(exportRun(g));
      expect(HF.current(g.run).at).toBeGreaterThan(at);
      expect(Math.floor(HF.current(g.run).at / HF.DAY)).toBe(0);
      expect(g.child.now).toBe(HF.current(g.run).at);
      expect(g.child.life.bornAt).toBe(-6 * HF.YEAR);
    },
  );

  it("preserves the full public action sequence in native and host history", () => {
    const g = createGame(21, true);
    for (const action of actions) step(g, action);
    expect(g.outcome?.action).toBe("look");
    expect(g.outcome?.success).toBe(true);
    expect(g.phase).toBe("ending");
    const saved = JSON.parse(JSON.stringify(exportRun(g)));
    const native = HF.need(HF.nativeRestore(saved.native));
    const nativeReplay = HF.need(HF.nativeReplay(saved.native));
    expect(nativeReplay.verified).toBe(true);
    expect(HF.nativeExport(native)).toEqual(saved.native);
    expect(HF.nativeExport(nativeReplay.run)).toEqual(saved.native);
    expect(exportRun(restore(saved))).toEqual(saved);
    expect(exportRun(replay(saved))).toEqual(saved);

    const requests = new Map<
      string,
      { boundaryAt: number; requestHash: string }
    >();
    let reached = 0;
    let receipts = 0;
    const transactions = readRunHistory(saved.native);
    const accepted = transactions.flatMap((tx) => tx.inputs);
    expect(
      accepted.filter((entry) => entry.kind === "method.demonstrated"),
    ).toHaveLength(3);
    expect(
      accepted.filter((entry) => entry.kind === "world.changed"),
    ).toHaveLength(6);
    for (const tx of transactions) {
      expect(tx.reachedAt).toBeGreaterThanOrEqual(reached);
      for (const entry of tx.inputs) {
        if (
          entry.kind === "action.resolved" ||
          entry.kind === "communication.resolved"
        ) {
          receipts++;
          const request = requests.get(entry.payload.requestId);
          expect(request).toBeDefined();
          expect(entry.at).toBe(request?.boundaryAt);
          expect(entry.payload.requestHash).toBe(request?.requestHash);
        } else {
          expect(entry.at).toBeGreaterThan(reached);
        }
      }
      if (tx.boundary.type !== "until")
        for (const request of tx.boundary.requests)
          requests.set(request.id, request);
      reached = tx.reachedAt;
    }
    expect(receipts).toBeGreaterThan(0);
  });

  it("keeps all 180 authored month targets independent of ingress milliseconds", () => {
    const ages = [3, 6, 10, 14, 18];
    let boundary = 0;
    let months = 0;
    for (let chapter = 0; chapter < ages.length - 1; chapter++) {
      const age = ages[chapter];
      const next = ages[chapter + 1];
      if (age === undefined || next === undefined)
        throw Error("Missing chapter.");
      const count = (next - age) * 12;
      for (let month = 1; month <= count; month++) {
        const expected =
          Math.ceil((boundary + (HF.YEAR * month) / 12) / HF.DAY) * HF.DAY;
        expect(chapterMonthAt(age, next, month)).toBe(expected);
        months++;
      }
      boundary = chapterMonthAt(age, next, count);
    }
    expect(months).toBe(180);
    expect(boundary / HF.DAY).toBe(5479);
    expect(chapterMonthAt(3, 6, 36) / HF.DAY).toBe(1096);
  });

  it("inspect and conditional preview leave a closed current archive unchanged", () => {
    const g = createGame(21, true);
    step(g, { type: "teach", practice: "count" });
    step(g, { type: "teach", practice: "look" });
    step(g, { type: "teach", practice: "refuse" });
    // Query at the live post-cue boundary, before any live crisis decision.
    HF.serve(
      g.run,
      HF.nextIngressAt(g.run),
      [
        HF.input(g.run, "closed-query:cues", "method.cues", {
          person: "elif",
          evidenceId: "closed-query:cues",
          contextId: "crisis",
          cues: [
            { cue: "supply", value: "scarce" },
            { cue: "route", value: "uncertain" },
            {
              cue: "keeper",
              value: g.conditions.available ? "needed" : "away",
            },
            { cue: "pressure", value: "repeated" },
            {
              cue: "availability",
              value: g.conditions.available ? "present" : "absent",
            },
          ],
        }),
      ],
      (events) => recordLosses(g, events),
    );
    const before = JSON.stringify(HF.nativeExport(g.run));
    const state = HF.current(g.run);
    expect(Object.keys(state.people).sort()).toEqual([...HF.cast].sort());
    for (const action of ["count", "look", "refuse"])
      HF.evidence(g.run, action, "crisis");
    expect(JSON.stringify(HF.nativeExport(g.run))).toBe(before);
    const nativeStep = NativeHF.step;
    let branches = 0;
    const branchSpy = vi
      .spyOn(NativeHF, "step")
      .mockImplementation((run, batch) => {
        expect(run).not.toBe(g.run);
        // forkRun retains the complete current archive, not merely six names.
        expect(JSON.stringify(HF.nativeExport(run)) === before).toBe(true);
        branches++;
        const result = nativeStep(run, batch);
        if (!result.ok) throw Error(`Fixture blocker: ${result.error.message}`);
        const endpoint = HF.current(run);
        expect(Object.keys(endpoint.people).sort()).toEqual(
          [...HF.cast].sort(),
        );
        for (const person of HF.cast) {
          expect(endpoint.people[person]?.memory.sourceTrust).toEqual(
            state.people[person]?.memory.sourceTrust,
          );
          expect(endpoint.people[person]?.will.voices).toEqual(
            state.people[person]?.will.voices,
          );
        }
        expect(result.value.at).toBe(batch.until);
        return result;
      });
    try {
      const conditionalMethods = HF.conditionalMethodEvidence(
        g.run,
        ["count", "look", "refuse"],
        "conditional:direct",
      );
      expect(conditionalMethods.hypothetical).toBe(true);
      expect(conditionalMethods.label).toContain(
        "HYPOTHETICAL, NOT LIVE HISTORY",
      );
      expect(conditionalMethods.at).toBe(HF.nextIngressAt(g.run));
      const supports = conditionalMethods.evidence.map(
        (entry) => entry.evidence.support,
      );
      expect(supports).toHaveLength(3);
      expect(supports.every((support) => support > 0)).toBe(true);
      expect(Math.max(...supports) - Math.min(...supports)).toBeLessThan(0.01);
      expect(branches).toBe(1);
      expect(JSON.stringify(HF.nativeExport(g.run)) === before).toBe(true);
      const elapsed = HF.takeConditionalMilliseconds(g.run);
      expect(Number.isFinite(elapsed) && elapsed > 0).toBe(true);
      expect(HF.takeConditionalMilliseconds(g.run)).toBe(0);
    } finally {
      branchSpy.mockRestore();
    }
    // Real successful native endpoints with absent and mismatched candidates
    // must be refused. No synthetic StepResult or invented admission receipt.
    for (const mismatch of [false, true]) {
      const endpointSpy = vi
        .spyOn(NativeHF, "step")
        .mockImplementation((run, batch) =>
          nativeStep(run, {
            ...batch,
            inputs: mismatch
              ? batch.inputs.map((entry) =>
                  entry.kind === "offers.received"
                    ? {
                        ...entry,
                        payload: {
                          ...entry.payload,
                          offers: entry.payload.offers.slice(0, 1),
                        },
                      }
                    : entry,
                )
              : [],
          }),
        );
      try {
        expect(() =>
          HF.conditionalMethodEvidence(
            g.run,
            ["count", "look", "refuse"],
            `conditional:refuse:${mismatch}`,
          ),
        ).toThrow("Conditional method endpoint refused");
        expect(JSON.stringify(HF.nativeExport(g.run)) === before).toBe(true);
      } finally {
        endpointSpy.mockRestore();
      }
    }
    const at = HF.nextIngressAt(g.run);
    const revision = (state.offers.elif?.revision ?? 0) + 1;
    const conditional = HF.previewCrisis(g.run, [
      HF.input(
        g.run,
        "preview:0-offers",
        "offers.received",
        {
          person: "elif",
          revision,
          offers: ["count", "look", "refuse"].map((action) =>
            HF.offer("elif", action, HF.MINUTE, "crisis"),
          ),
        },
        at,
      ),
      HF.input(
        g.run,
        "preview:1-decide",
        "decision.requested",
        {
          person: "elif",
          reason: "crisis",
          treatment: "ordinary",
          offerRevision: revision,
        },
        at,
      ),
    ]);
    expect(conditional.hypothetical).toBe(true);
    expect(conditional.at).toBe(at);
    // Byte equality covers full native history and all RNG, not only a view.
    expect(JSON.stringify(HF.nativeExport(g.run))).toBe(before);
    const accepted = readRunHistory(HF.nativeExport(g.run)).flatMap(
      (tx) => tx.inputs,
    );
    expect(accepted.some((entry) => entry.id.startsWith("preview:"))).toBe(
      false,
    );
    expect(
      accepted.filter(
        (entry) =>
          entry.kind === "decision.requested" &&
          entry.payload.person === "elif" &&
          entry.payload.reason === "crisis",
      ),
    ).toHaveLength(0);
    expect(Object.keys(HF.current(g.run).people).sort()).toEqual(
      [...HF.cast].sort(),
    );
  });
});

it("AUTHORED LIFECYCLE RETENTION CONTROL — NOT NATURAL MORTALITY", () => {
  // External lifecycle input is outside Game.inputs. Only native replay is
  // claimed here; this is neither normal model.replay nor natural mortality.
  const g = createGame(21, true);
  const id = "authored-retention:Maryam:death";
  const deathEvents: HF.NativeEvents[number][] = [];
  const sink: HF.EventSink = (events) => {
    deathEvents.push(
      ...events.filter(
        (event) =>
          (event.person === "Maryam" &&
            event.data.kind === "body-change" &&
            event.data.change.kind === "died") ||
          (event.data.kind === "lifecycle" &&
            event.data.receipt.type === "death" &&
            event.data.receipt.person.kind === "actor" &&
            event.data.receipt.person.id === "Maryam"),
      ),
    );
    recordLosses(g, events);
  };
  const at = HF.nextIngressAt(g.run);
  HF.serve(
    g.run,
    at,
    [
      HF.input(
        g.run,
        id,
        "lifecycle.received",
        {
          type: "death",
          person: { kind: "actor", id: "Maryam" },
          basis: {
            evidence: { kind: "evidence", id },
            worldRevision: HF.current(g.run).world.revision,
          },
        },
        at,
      ),
    ],
    sink,
  );
  // Actual emission/admission and body change precede any loss assertion.
  expect(
    deathEvents.length,
    "Fixture blocker: actual death events",
  ).toBeGreaterThan(0);
  expect(
    readRunHistory(HF.nativeExport(g.run))
      .flatMap((tx) => tx.inputs)
      .filter(
        (entry) => entry.id === id && entry.kind === "lifecycle.received",
      ),
    "Fixture blocker: lifecycle admission",
  ).toHaveLength(1);
  expect(HF.isAlive(g.run, "Maryam")).toBe(false);
  const deathIds = new Set(deathEvents.map((event) => event.id));
  let laterEvents = 0;
  for (
    let i = 0;
    i < 128 &&
    (laterEvents <= 64 ||
      HF.current(g.run).events.some((event) => deathIds.has(event.id)));
    i++
  ) {
    HF.publish(
      g.run,
      () => JSON.parse(JSON.stringify(hostState(g))),
      `authored-retention:evict:${i}`,
      (events) => {
        laterEvents += events.length;
        recordLosses(g, events);
      },
    );
  }
  expect(
    laterEvents,
    "Fixture blocker: >64 actual later events",
  ).toBeGreaterThan(64);
  expect(
    HF.current(g.run).events.some((event) => deathIds.has(event.id)),
    "Fixture blocker: death evicted from current window",
  ).toBe(false);
  const losses = structuredClone(g.losses);
  recordLosses(g, deathEvents);
  recordLosses(g, deathEvents);
  expect(g.losses).toEqual(losses);
  expect(g.losses.filter((loss) => loss.person === "Maryam")).toHaveLength(1);
  const loss = g.losses.find((entry) => entry.person === "Maryam");
  expect(loss?.evidence).toEqual(expect.arrayContaining(deathEvents));
  expect(loss?.evidence.every((event) => !deathEvents.includes(event))).toBe(
    true,
  );
  expect(loss?.at).toBe(Math.min(...deathEvents.map((event) => event.at)));
  expect(loss?.firstChapter).toBe(1);
  expect(new Set(loss?.evidence.map((event) => event.id)).size).toBe(
    loss?.evidence.length,
  );
  const saved = JSON.parse(JSON.stringify(exportRun(g)));
  expect(saved.state.losses).toEqual(losses);
  expect(saved.native.current.world.hostState).toEqual(saved.state);
  const native = HF.need(HF.nativeRestore(saved.native));
  const replayed = HF.need(HF.nativeReplay(saved.native));
  expect(replayed.verified).toBe(true);
  expect(
    JSON.stringify(HF.nativeExport(native)) === JSON.stringify(saved.native),
  ).toBe(true);
  expect(
    JSON.stringify(HF.nativeExport(replayed.run)) ===
      JSON.stringify(saved.native),
  ).toBe(true);
});

it("observes each successful live result before inspection and propagates sink failures", () => {
  const g = createGame(21, true);
  const nativeStep = NativeHF.step;
  const nativeInspect = NativeHF.inspect;
  let pendingObservation = false;
  let observed = 0;
  const emitted: HF.NativeEvents[number][] = [];
  const stepSpy = vi.spyOn(NativeHF, "step").mockImplementation((...args) => {
    const result = nativeStep(...args);
    if (result.ok) pendingObservation = true;
    return result;
  });
  const inspectSpy = vi
    .spyOn(NativeHF, "inspect")
    .mockImplementation((...args) => {
      expect(
        pendingObservation,
        "successful result must be observed before inspection",
      ).toBe(false);
      return nativeInspect(...args);
    });
  try {
    HF.decide(g.run, ["try"], "ordering:choice", (events) => {
      expect(pendingObservation).toBe(true);
      pendingObservation = false;
      observed++;
      emitted.push(...events);
      recordLosses(g, events);
    });
    expect(
      emitted.some((event) => event.data.kind === "action-requested"),
      "Fixture blocker: actual settlement request",
    ).toBe(true);
    expect(
      observed,
      "Fixture blocker: actual settlement continuation",
    ).toBeGreaterThan(1);
    expect(() =>
      HF.serve(g.run, HF.nextIngressAt(g.run), [], () => {
        pendingObservation = false;
        throw Error("observer failure");
      }),
    ).toThrow("observer failure");
    expect(() =>
      HF.publish(
        g.run,
        () => ({}),
        "observer:publication",
        () => {
          pendingObservation = false;
          throw Error("publication observer failure");
        },
      ),
    ).toThrow("publication observer failure");
    let snapshot = 0;
    expect(() =>
      HF.publish(
        g.run,
        () => ({ snapshot: snapshot++ }),
        "ordering:never-stable",
        (events) => {
          pendingObservation = false;
          recordLosses(g, events);
        },
      ),
    ).toThrow("did not reconcile");
    const publications = readRunHistory(HF.nativeExport(g.run))
      .flatMap((tx) => tx.inputs)
      .filter(
        (entry) =>
          entry.id.startsWith("ordering:never-stable") &&
          entry.kind === "world.changed",
      );
    expect(publications).toHaveLength(HF.cast.length + 1);
    expect(new Set(publications.map((entry) => entry.id)).size).toBe(
      publications.length,
    );
  } finally {
    stepSpy.mockRestore();
    inspectSpy.mockRestore();
  }
});

// SCOPE: authentic 4.16.1 opening bytes, compressed without changing metadata.
// This is refusal coverage, not older-save compatibility or a replay claim.
it("refuses an authentic older native save with a start-fresh instruction", () => {
  const raw = gunzipSync(
    readFileSync(new URL("./fixtures/hf4161-opening.json.gz", import.meta.url)),
  ).toString("utf8");
  const old = JSON.parse(raw) as ReturnType<typeof exportRun>;
  expect(old.native.engine.package).toBe("@adam0white/human-framework@4.16.1");
  const before = JSON.stringify(old);
  expect(() => restore(old)).toThrow("Start a fresh upbringing");
  expect(() => replay(old)).toThrow("Start a fresh upbringing");
  expect(JSON.stringify(old)).toBe(before);
});

// SCOPE: one seed-21 authored crisis, real native receipts and minute-scale
// stale-book control using the public age-six slice, not original nonslice
// qualification. No month/day qualification, mortality claim or new API.
it("closes one accepted crisis opportunity before finish and publishes completion only after settlement", () => {
  const g = createGame(21, true);
  for (let lesson = 0; lesson < 3; lesson++)
    step(g, { type: "teach", practice: "count" });
  const beforeHost = hostState(g);
  const nativeStep = NativeHF.step;
  type State = ReturnType<typeof HF.current>;
  const frames: {
    before: State;
    after: State;
    inputs: NativeHF.DeepReadonly<readonly NativeHF.Input[]>;
    events: HF.NativeEvents;
  }[] = [];
  const acceptedSnapshots: HF.NativeArchive[] = [];
  let completed = false;
  const spy = vi.spyOn(NativeHF, "step").mockImplementation((run, batch) => {
    if (run !== g.run) return nativeStep(run, batch); // conditional fork stays real
    const before = HF.current(run);
    if (!completed) {
      // Check in-memory effects too, before the host can hide them in a later
      // publication. These are the resources resolve currently mutates early.
      expect
        .soft(g.outcome, "no completed account before terminal settlement")
        .toBeNull();
      expect
        .soft(g.phase, "no movement before terminal settlement")
        .toBe("prepare");
      expect
        .soft([g.food, g.repairs, g.waterReserve])
        .toEqual([
          beforeHost.food,
          beforeHost.repairs,
          beforeHost.waterReserve,
        ]);
    }
    for (const entry of batch.inputs) {
      if (entry.kind !== "action.resolved") continue;
      const receipt = entry.payload;
      const request = before.pending.find((r) => r.id === receipt.requestId);
      expect(
        request,
        "receipt must resolve an actual pending request",
      ).toBeDefined();
      if (!request || request.kind !== "action")
        throw Error("Missing real action request");
      expect(receipt.requestHash).toBe(request.requestHash);
      expect(receipt.worldRevision).toBe(before.world.revision);
      expect(entry.at).toBe(request.boundaryAt);
      expect(receipt.person).toBe(request.person);
      expect(receipt.activityId).toBe(request.activityId);
      expect(receipt.stage).toBe(request.stage);
    }
    const result = nativeStep(run, batch);
    if (!result.ok) return result;
    const after = HF.current(run);
    frames.push({
      before,
      after,
      inputs: batch.inputs,
      events: result.value.events,
    });
    for (const event of result.value.events) {
      if (event.person !== "elif" || event.data.kind !== "action-settled")
        continue;
      if (
        event.data.disposition === "accepted" &&
        after.people.elif?.activity?.offer.methodContext === "crisis"
      )
        acceptedSnapshots.push(HF.nativeExport(run));
      if (event.data.disposition === "completed") completed = true;
    }
    return result;
  });
  try {
    step(g, { type: "crisis" });
  } finally {
    spy.mockRestore();
  }
  expect(
    acceptedSnapshots,
    "fixture requires a genuine accepted crisis start",
  ).toHaveLength(1);
  const accepted = acceptedSnapshots[0];
  if (!accepted) throw Error("Missing accepted native archive");
  const activity = accepted.current.people.elif?.activity;
  if (!activity) throw Error("Accepted crisis has no active frozen offer");
  expect(activity.offer.actionId).toBe("count");
  expect(activity.offer.durationMs).toBe(HF.MINUTE);
  const start = readRunHistory(accepted)
    .flatMap((tx) =>
      tx.boundary.type === "world-required" ? tx.boundary.requests : [],
    )
    .find(
      (r) =>
        r.kind === "action" &&
        r.stage === "start" &&
        r.activityId === activity.id,
    );
  if (!start || start.kind !== "action")
    throw Error("Missing actual start request");
  const acceptedReceipt = readRunHistory(accepted)
    .flatMap((tx) => tx.inputs)
    .find(
      (entry) =>
        entry.kind === "action.resolved" &&
        entry.payload.requestId === start.id,
    );
  expect(
    acceptedReceipt?.kind === "action.resolved" &&
      acceptedReceipt.payload.disposition,
  ).toBe("accepted");
  expect(accepted.current.offers.elif?.revision).toBe(start.offerRevision);
  const finishSchedule = accepted.current.queue.filter(
    (event) =>
      event.data.kind === "activity-finish" &&
      event.data.activityId === activity.id,
  );
  expect(finishSchedule).toHaveLength(1);
  expect(finishSchedule[0]?.at).toBe(activity.endsAt);

  // Causal control: exact accepted archive, same native autonomy and clock,
  // with no book withdrawal. No fake pending request or synthetic receipt.
  const stale = HF.need(HF.nativeRestore(accepted));
  HF.serve(stale, activity.endsAt + 2 * HF.MINUTE, [], () => {});
  const staleRequests = readRunHistory(HF.nativeExport(stale))
    .flatMap((tx) =>
      tx.boundary.type === "world-required" ? tx.boundary.requests : [],
    )
    .filter(
      (r) =>
        r.kind === "action" &&
        r.person === "elif" &&
        r.stage === "start" &&
        r.offerRevision === start.offerRevision,
    );
  const staleAccepted = readRunHistory(HF.nativeExport(stale))
    .flatMap((tx) => tx.inputs)
    .filter(
      (entry) =>
        entry.kind === "action.resolved" &&
        entry.payload.disposition === "accepted" &&
        staleRequests.some((request) => request.id === entry.payload.requestId),
    );
  expect(
    staleAccepted.length,
    "retained crisis book permits another accepted start",
  ).toBeGreaterThan(1);

  const withdrawal = frames.find((frame) =>
    frame.inputs.some(
      (entry) =>
        entry.kind === "offers.received" &&
        entry.payload.person === "elif" &&
        entry.payload.revision > start.offerRevision &&
        entry.payload.offers.length === 0,
    ),
  );
  expect
    .soft(
      withdrawal,
      "accepted crisis must withdraw NEW opportunities before finish",
    )
    .toBeDefined();
  if (withdrawal) {
    const book = withdrawal.after.offers.elif;
    expect(book?.revision).toBeGreaterThan(start.offerRevision);
    expect(book?.offers).toEqual([]);
    const ingress = withdrawal.inputs.find(
      (entry) =>
        entry.kind === "offers.received" &&
        entry.payload.person === "elif" &&
        entry.payload.offers.length === 0,
    );
    expect(book?.cause).toBe(ingress?.id);
    expect(book?.receivedAt).toBe(ingress?.at);
    expect(ingress?.at).toBeGreaterThan(withdrawal.before.at);
    expect(book?.receivedAt).toBeGreaterThan(accepted.current.at);
    expect(book?.receivedAt).toBeLessThan(activity.endsAt);
    expect(withdrawal.before.people.elif?.activity).toEqual(activity);
    expect(withdrawal.after.people.elif?.activity).toEqual(activity);
    expect(
      withdrawal.after.queue.filter(
        (event) =>
          event.data.kind === "activity-finish" &&
          event.data.activityId === activity.id,
      ),
    ).toEqual(finishSchedule);
    expect(
      withdrawal.inputs.some((entry) => entry.kind === "activity.interrupted"),
    ).toBe(false);
  }
  const terminal = frames.find((frame) =>
    frame.events.some(
      (event) =>
        event.person === "elif" &&
        event.data.kind === "action-settled" &&
        event.data.activityId === activity.id &&
        event.data.disposition === "completed",
    ),
  );
  expect
    .soft(terminal, "genuine completed settlement must precede host movement")
    .toBeDefined();
  if (terminal) {
    const request = terminal.before.pending.find(
      (r) =>
        r.kind === "action" &&
        r.activityId === activity.id &&
        r.stage === "finish",
    );
    if (!request || request.kind !== "action")
      throw Error("Missing genuine finish request");
    expect(request.offerRevision).toBe(start.offerRevision);
    expect(request.boundaryAt).toBe(activity.endsAt);
    const receipt = terminal.inputs.find(
      (entry) =>
        entry.kind === "action.resolved" &&
        entry.payload.requestId === request.id,
    );
    if (!receipt || receipt.kind !== "action.resolved")
      throw Error("Missing real finish receipt");
    expect(receipt.payload.disposition).toBe("completed");
    expect(receipt.payload.outcome).toMatchObject({
      activityId: activity.id,
      offerId: activity.offer.id,
      actionId: activity.offer.actionId,
      start: activity.startedAt,
      end: activity.endsAt,
      status: "completed",
    });
    const movement = frames.findIndex((frame) =>
      frame.inputs.some(
        (entry) =>
          entry.kind === "world.changed" &&
          (entry.payload.hostState as { phase?: string } | null)?.phase ===
            "movement",
      ),
    );
    expect(movement).toBeGreaterThan(frames.indexOf(terminal));
    const exit = frames.findIndex((frame) =>
      frame.inputs.some(
        (entry) =>
          entry.kind === "method.context-left" &&
          entry.payload.person === "elif" &&
          entry.payload.contextId === "crisis",
      ),
    );
    expect(
      exit,
      "leave method context only after terminal scene exit",
    ).toBeGreaterThan(frames.indexOf(terminal));
    expect(g.outcome?.action).toBe(activity.offer.actionId);
    expect(g.repairs).toBe(beforeHost.repairs - 1);
  }
  expect(g.phase).toBe("movement");
  const saved = exportRun(g);
  expect(saved.native.current.world.hostState).toEqual(saved.state);
  const nativeCold = HF.need(HF.nativeRestore(saved.native));
  const nativeReplay = HF.need(HF.nativeReplay(saved.native));
  expect(nativeReplay.verified).toBe(true);
  expect(HF.nativeExport(nativeCold)).toEqual(saved.native);
  expect(HF.nativeExport(nativeReplay.run)).toEqual(saved.native);
  HF.serve(nativeCold, activity.endsAt + 2 * HF.MINUTE, [], () => {});
  const later = HF.nativeExport(nativeCold);
  const crisisStarts = readRunHistory(later)
    .flatMap((tx) =>
      tx.boundary.type === "world-required" ? tx.boundary.requests : [],
    )
    .filter(
      (r) =>
        r.kind === "action" &&
        r.person === "elif" &&
        r.stage === "start" &&
        r.offerRevision === start.offerRevision,
    );
  expect
    .soft(crisisStarts, "one authored attempt must not restart after finish")
    .toHaveLength(1);
  const cold = restore(saved);
  const replayed = replay(saved);
  expect(exportRun(cold)).toEqual(saved);
  expect(exportRun(replayed)).toEqual(saved);
  step(g, { type: "reveal" });
  step(cold, { type: "reveal" });
  step(replayed, { type: "reveal" });
  expect(exportRun(cold)).toEqual(exportRun(g));
  expect(exportRun(replayed)).toEqual(exportRun(g));
  expect(g.history).toHaveLength(1);
});
