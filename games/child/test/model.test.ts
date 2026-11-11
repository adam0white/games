import * as NativeHF from "@adam0white/human-framework";
import { readRunHistory } from "@adam0white/human-framework";
import { describe, expect, it, vi } from "vitest";
import * as HF from "../src/hf";
import {
  createGame,
  exportRun,
  hash,
  type Practice,
  replay,
  step,
} from "../src/model";

// Keep the real published exports while giving Vitest a configurable namespace.
// Native step spies below still call the captured original implementation.
vi.mock(import("@adam0white/human-framework"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

function act(practice: Practice, seed = 21) {
  const g = createGame(seed, true);
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice });
  step(g, { type: "crisis" });
  return g;
}
describe("age six learned actions", () => {
  it("learned inspection succeeds while waiting without the keeper comes home short", () => {
    const look = act("look");
    const wait = act("wait");
    expect(look.outcome?.action).toBe("look");
    expect(look.outcome?.success).toBe(true);
    expect(wait.outcome?.action).toBe("wait");
    expect(wait.outcome?.success).toBe(false);
    expect(wait.food).toBe(6);
    expect(wait.outcome?.cost).toContain("stored water");
  });
  it("counting and inspection both work with different consequences", () => {
    const count = act("count");
    const look = act("look");
    expect(count.outcome?.success).toBe(true);
    expect(look.outcome?.success).toBe(true);
    expect(count.outcome?.cost).not.toBe(look.outcome?.cost);
  });
  it("ways watched equally often leave her torn; the most watched way wins", () => {
    function crisis(g: ReturnType<typeof createGame>, decisions: number) {
      const serve = HF.serve;
      const publish = HF.publish;
      const nativeStep = NativeHF.step;
      let postCue: string | undefined;
      let beforePublication: string | undefined;
      const choiceEvents: ReturnType<typeof HF.serve>[number][] = [];
      const nativeStepSpy = vi
        .spyOn(NativeHF, "step")
        .mockImplementation((...args) => {
          const result = nativeStep(...args);
          if (
            args[0] === g.run &&
            result.ok &&
            postCue !== undefined &&
            beforePublication === undefined
          )
            choiceEvents.push(
              ...result.value.events.filter(
                (event) =>
                  event.person === "elif" && event.data.kind === "decision",
              ),
            );
          return result;
        });
      const serveSpy = vi.spyOn(HF, "serve").mockImplementation((...args) => {
        const events = serve(...args);
        if (args[0] === g.run) {
          if (args[2]?.some((entry) => entry.kind === "method.cues"))
            postCue = JSON.stringify(HF.nativeExport(g.run));
        }
        return events;
      });
      const publishSpy = vi
        .spyOn(HF, "publish")
        .mockImplementation((...args) => {
          if (args[0] === g.run)
            beforePublication = JSON.stringify(HF.nativeExport(g.run));
          return publish(...args);
        });
      const decideSpy = vi.spyOn(HF, "decide");
      const query = HF.conditionalMethodEvidence;
      let queryBefore: string | undefined;
      let queryAfter: string | undefined;
      const querySpy = vi
        .spyOn(HF, "conditionalMethodEvidence")
        .mockImplementation((...args) => {
          queryBefore = JSON.stringify(HF.nativeExport(args[0]));
          const result = query(...args);
          queryAfter = JSON.stringify(HF.nativeExport(args[0]));
          return result;
        });
      try {
        step(g, { type: "crisis" });
        // These assertions run even when the original candidate chooses instead
        // of freezing. Other people's native activity is not Elif's choice.
        expect(
          querySpy.mock.calls.filter(([run]) => run === g.run),
        ).toHaveLength(1);
        const conditional = querySpy.mock.results[0];
        if (conditional?.type !== "return")
          throw Error("Conditional query did not return evidence.");
        expect(conditional.value.hypothetical).toBe(true);
        const evidence = conditional.value.evidence;
        const support = (action: string) =>
          evidence.find((entry) => entry.action === action)?.evidence.support;
        if (evidence.some((entry) => entry.action === "count")) {
          expect(evidence.every((entry) => entry.evidence.support > 0)).toBe(
            true,
          );
          const supports = evidence.map((entry) => entry.evidence.support);
          expect(Math.max(...supports) - Math.min(...supports)).toBeLessThan(
            0.01,
          );
        } else if (evidence.some((entry) => entry.action === "refuse")) {
          expect(support("look")).toBeGreaterThan(0);
          expect(
            (support("refuse") ?? 0) - (support("look") ?? 0),
          ).toBeGreaterThanOrEqual(0.01);
        } else {
          expect(evidence.map((entry) => entry.action)).toEqual(["try"]);
        }
        expect
          .soft(decideSpy.mock.calls.filter(([run]) => run === g.run))
          .toHaveLength(decisions);
        const requests = readRunHistory(HF.nativeExport(g.run))
          .flatMap((tx) => tx.inputs)
          .filter(
            (entry) =>
              entry.kind === "decision.requested" &&
              entry.payload.person === "elif" &&
              entry.payload.reason === "crisis",
          );
        expect.soft(requests).toHaveLength(decisions);
        expect.soft(choiceEvents).toHaveLength(decisions);
        expect.soft(postCue).toBeDefined();
        expect.soft(beforePublication).toBeDefined();
        if (decisions === 0) {
          // Exact full archive equality includes every RNG stream, offers,
          // queue, clock, trace and decision counter, before host publication.
          expect
            .soft(
              queryBefore === queryAfter,
              "the hypothetical query must preserve the complete live native archive",
            )
            .toBe(true);
        }
        expect
          .soft(Object.keys(HF.current(g.run).people).sort())
          .toEqual([...HF.cast].sort());
      } finally {
        querySpy.mockRestore();
        decideSpy.mockRestore();
        publishSpy.mockRestore();
        serveSpy.mockRestore();
        nativeStepSpy.mockRestore();
      }
    }
    const g = createGame(21, true);
    step(g, { type: "teach", practice: "count" });
    step(g, { type: "teach", practice: "look" });
    step(g, { type: "teach", practice: "refuse" });
    crisis(g, 0);
    expect.soft(g.outcome?.action).toBe("freeze");
    expect.soft(g.outcome?.success).toBe(false);
    expect.soft(g.outcome?.line).toContain("Maryam’s way and Yusuf’s way");
    expect.soft(hash(replay(exportRun(g)))).toBe(hash(g));
    const leaning = createGame(21, true);
    step(leaning, { type: "teach", practice: "look" });
    step(leaning, { type: "teach", practice: "refuse" });
    step(leaning, { type: "teach", practice: "refuse" });
    crisis(leaning, 1);
    expect.soft(leaning.outcome?.action).toBe("refuse");
    const unprepared = createGame(21, true);
    for (let i = 0; i < 3; i++) step(unprepared, { type: "work" });
    crisis(unprepared, 1);
    expect.soft(unprepared.outcome?.action).toBe("try");
  });
  it("keeps the outcome hidden until movement finishes, then exports an exact replay", () => {
    const g = act("look");
    expect(g.phase).toBe("movement");
    step(g, { type: "reveal" });
    expect(g.phase).toBe("aftermath");
    const run = exportRun(g);
    expect(hash(replay(run))).toBe(hash(g));
  });
});
describe("complete upbringing", () => {
  it("finishes five episodes and records the intervening fictional months", () => {
    const g = createGame(21, false);
    expect(g.age).toBe(3);
    for (let c = 0; c < 5; c++) {
      const practice: Practice =
        c === 1 || c >= 3 ? "look" : c === 2 ? "refuse" : "count";
      for (let i = 0; i < 3; i++) step(g, { type: "teach", practice });
      step(g, { type: "crisis" });
      step(g, { type: "reveal" });
      step(g, { type: "arrange", practice });
    }
    expect(g.phase).toBe("ending");
    expect(g.history).toHaveLength(5);
    expect(g.outcome?.success).toBe(true);
    expect(g.months).toBe(180);
    expect(g.child.now).toBeLessThan(HF.DAY);
    expect(g.completedEpisodes).toHaveLength(4);
    expect(g.child.life.bornAt).toBe(-18 * HF.YEAR);
    expect(hash(replay(exportRun(g)))).toBe(hash(g));
  });
  it("can lose the final day after relying on an absent keeper", () => {
    const g = createGame(23, false);
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 3; i++) step(g, { type: "work" });
      step(g, { type: "crisis" });
      step(g, { type: "reveal" });
      step(g, { type: "arrange", practice: "wait" });
    }
    expect(g.phase).toBe("ending");
    expect(g.outcome?.success).toBe(false);
  });
  it("rejects changed export inputs and unavailable choices", () => {
    const g = createGame(1, true);
    expect(() => step(g, { type: "reveal" })).toThrow();
    const run = exportRun(g);
    run.seed = 2;
    expect(() => replay(run)).toThrow();
  });
});
it("holds disclosed crisis conditions through the last preparation", () => {
  const g = createGame(21, true);
  step(g, { type: "teach", practice: "wait" });
  step(g, { type: "teach", practice: "wait" });
  const shown = structuredClone(g.conditions);
  step(g, { type: "teach", practice: "wait" });
  expect(g.conditions).toEqual(shown);
});

it("current lessons can change the final action after a different gap companion", () => {
  function final(prep: Practice) {
    const g = createGame(22);
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 3; i++)
        step(g, c < 4 ? { type: "work" } : { type: "teach", practice: prep });
      step(g, { type: "crisis" });
      step(g, { type: "reveal" });
      if (c < 4) step(g, { type: "arrange", practice: "look" });
    }
    return g.outcome?.action;
  }
  expect(final("count")).not.toBe(final("look"));
});
it("floors household stores and never freezes with only one practice", () => {
  const g = createGame(21, true);
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "wait" });
  step(g, { type: "crisis" });
  expect(g.outcome?.action).toBe("wait");
  expect(g.outcome?.line).toContain("did not fit");
  const hungry = createGame(24);
  for (let c = 0; c < 5; c++) {
    for (let i = 0; i < 3; i++)
      step(hungry, { type: "teach", practice: "count" });
    step(hungry, { type: "crisis" });
    step(hungry, { type: "reveal" });
    expect(hungry.food).toBeGreaterThanOrEqual(0);
    expect(hungry.repairs).toBeGreaterThanOrEqual(0);
    step(hungry, { type: "arrange", practice: "count" });
  }
});

it("no companion wins the final day on all four review seeds", () => {
  for (const practice of ["count", "look", "wait", "refuse"] as const) {
    const results = [21, 22, 23, 24].map((seed) => {
      const g = createGame(seed);
      for (let c = 0; c < 5; c++) {
        for (let i = 0; i < 3; i++) step(g, { type: "teach", practice });
        step(g, { type: "crisis" });
        step(g, { type: "reveal" });
        step(g, { type: "arrange", practice });
      }
      return g.outcome?.success;
    });
    expect(results).toContain(false);
  }
});
it("Yusuf cannot make water exist, and depleted well rope closes the upper path", () => {
  const g = createGame(23);
  g.chapter = 3;
  g.age = 14;
  g.repairs = 0;
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "look" });
  step(g, { type: "crisis" });
  step(g, { type: "reveal" });
  step(g, { type: "arrange", practice: "look" });
  expect(g.routeKnown).toBe(true);
  expect(g.conditions.seep).toBe(false);
});
it("yearbook recalls the lesson actually watched and records the result", () => {
  const g = createGame(21, true);
  step(g, { type: "teach", practice: "look" });
  step(g, { type: "work" });
  step(g, { type: "work" });
  step(g, { type: "crisis" });
  expect(g.outcome?.memory).toContain("checked the upper path");
  expect(g.outcome?.memory).not.toContain("lifted a cover");
  expect(g.outcome?.memory).toContain("enough today");
});
it("field work plus a single gap companion is not a universal final win", () => {
  for (const practice of ["count", "look", "wait", "refuse"] as const) {
    const wins = [21, 22, 23, 24].map((seed) => {
      const g = createGame(seed);
      for (let c = 0; c < 5; c++) {
        for (let i = 0; i < 3; i++) step(g, { type: "work" });
        step(g, { type: "crisis" });
        step(g, { type: "reveal" });
        step(g, { type: "arrange", practice });
      }
      return g.outcome?.success;
    });
    expect(wins).toContain(false);
  }
});

function upbringing(careful: boolean) {
  const g = createGame(21);
  const lessons: Practice[] = ["count", "look", "refuse", "refuse", "look"];
  for (let chapter = 0; chapter < 5; chapter++) {
    for (let i = 0; i < 3; i++)
      step(
        g,
        careful || chapter === 4
          ? { type: "teach", practice: lessons[chapter] ?? "look" }
          : { type: "work" },
      );
    step(g, { type: "crisis" });
    step(g, { type: "reveal" });
    step(g, { type: "arrange", practice: "look" });
  }
  return g;
}

it("earlier shortfalls can lose despite the same final learned inspection", () => {
  const careful = upbringing(true);
  const careless = upbringing(false);
  expect(careful.outcome?.action).toBe("look");
  expect(careless.outcome?.action).toBe("look");
  expect(careful.outcome?.success).toBe(true);
  expect(careless.outcome?.success).toBe(false);
  expect(careful.waterReserve).toBe(1);
  expect(careless.waterReserve).toBe(0);
  expect(careless.outcome?.cost).toContain("emergency store");
  expect(careless.outcome?.cost).toContain("At 10");
  expect(careless.outcome?.cost).toContain("Yusuf");
  expect(hash(replay(exportRun(careless)))).toBe(hash(careless));
});

it("yearbook repeats an unfit method's actual explanation rather than inventing an act", () => {
  const g = createGame(21, true);
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "wait" });
  step(g, { type: "crisis" });
  expect(g.outcome?.memory).toContain(g.outcome?.line);
});

it("replay rejects an older rule edition even when its hash is otherwise valid", () => {
  const run = exportRun(createGame(21));
  const older = { ...run, edition: 2 };
  expect(() => replay(older as typeof run)).toThrow("original game version");
});

it("preserved emergency water allows both counting and inspection to complete delivery", () => {
  for (const finalPractice of ["count", "look"] as const) {
    const g = createGame(22);
    const earlier: Practice[] = ["count", "look", "refuse", "look"];
    for (let chapter = 0; chapter < 5; chapter++) {
      const practice = earlier[chapter] ?? finalPractice;
      for (let i = 0; i < 3; i++) step(g, { type: "teach", practice });
      step(g, { type: "crisis" });
      step(g, { type: "reveal" });
      step(g, { type: "arrange", practice });
    }
    expect(g.outcome?.action).toBe(finalPractice);
    expect(g.outcome?.success).toBe(true);
    expect(g.waterReserve).toBe(1);
    expect(g.outcome?.cost).toContain("while the carriers return");
  }
});

it("failed final routes show undelivered households rather than completed deliveries", () => {
  for (const practice of ["count", "look"] as const) {
    const g = createGame(22);
    g.age = 18;
    g.conditions.seep = practice === "count";
    for (let i = 0; i < 3; i++) step(g, { type: "teach", practice });
    step(g, { type: "crisis" });
    expect(g.outcome?.success).toBe(false);
    expect(g.outcome?.movement).toContain("last households still wait");
  }
});

it("an exhausted emergency store does not claim Elif divided stored water", () => {
  const g = createGame(22);
  g.age = 18;
  g.waterReserve = 0;
  g.conditions.variant = 2;
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "count" });
  step(g, { type: "crisis" });
  expect(g.outcome?.action).toBe("count");
  expect(g.outcome?.line).not.toContain("divided our stored water");
  expect(g.outcome?.memory).toContain(g.outcome?.line);
});

it("a failed early errand cannot spend emergency water after the store is empty", () => {
  const g = createGame(21, true);
  g.waterReserve = 0;
  for (let i = 0; i < 3; i++) step(g, { type: "teach", practice: "wait" });
  step(g, { type: "crisis" });
  expect(g.outcome?.success).toBe(false);
  expect(g.outcome?.cost).toContain("no stored water left");
  expect(g.outcome?.cost).not.toContain("uses its stored water");
});

it("AUTHORED LIFECYCLE PUBLICATION CONTROL — NOT NATURAL MORTALITY", () => {
  // Externally authored native input during one ordinary model action. This
  // proves neither natural mortality nor ordinary model.replay acceptance.
  const g = createGame(21, true);
  const liveRun = g.run;
  const nativeStep = NativeHF.step;
  type NativeEvent = ReturnType<typeof HF.serve>[number];
  type RetainedLoss = (typeof g.losses)[number] & {
    evidence?: readonly NativeEvent[];
  };
  const deathInputId = "authored-publication:Maryam:death";
  let injected = false;
  let ingressAt: number | undefined;
  let deathEvents: NativeEvent[] = [];
  let beforeNextSuccessfulStep: readonly RetainedLoss[] | undefined;
  const isMaryamDeath = (event: NativeEvent) =>
    (event.person === "Maryam" &&
      event.data.kind === "body-change" &&
      event.data.change.kind === "died") ||
    (event.data.kind === "lifecycle" &&
      event.data.receipt.type === "death" &&
      event.data.receipt.person.kind === "actor" &&
      event.data.receipt.person.id === "Maryam");
  const nativeStepSpy = vi
    .spyOn(NativeHF, "step")
    .mockImplementation((run, batch) => {
      let submitted = batch;
      const publication = batch.inputs.find(
        (entry) => entry.kind === "world.changed" && entry.id === "host:1",
      );
      const injecting =
        run === liveRun && !injected && publication?.kind === "world.changed";
      if (injecting) {
        const current = HF.current(liveRun);
        const at = HF.nextIngressAt(liveRun);
        if (
          publication.at !== at ||
          batch.until !== at ||
          publication.payload.expectedRevision !== current.world.revision ||
          publication.payload.revision !== current.world.revision + 1
        )
          throw Error(
            "Fixture blocker: publication is not at fresh ingress/current revision.",
          );
        if (!HF.isAlive(liveRun, "Maryam"))
          throw Error(
            "Fixture blocker: Maryam is already dead before publication.",
          );
        // World input applies in phase 0; lifecycle applies in phase 1. Its
        // factual basis therefore uses the revision that THIS publication installs.
        submitted = {
          ...batch,
          inputs: [
            ...batch.inputs,
            HF.input(
              liveRun,
              deathInputId,
              "lifecycle.received",
              {
                type: "death",
                person: { kind: "actor", id: "Maryam" },
                basis: {
                  evidence: { kind: "evidence", id: deathInputId },
                  worldRevision: publication.payload.revision,
                },
              },
              at,
            ),
          ],
        };
        injected = true;
        ingressAt = at;
      }
      // Capture host state before a possible continuation, but judge retention
      // only after real emission/admission have been established below.
      const priorLosses =
        run === liveRun && deathEvents.length > 0
          ? structuredClone(g.losses)
          : undefined;
      const result = nativeStep(run, submitted);
      if (injecting) {
        if (!result.ok)
          throw Error(
            `Fixture blocker: native publication refused: ${result.error.code} ${result.error.message}`,
          );
        deathEvents = structuredClone(
          result.value.events.filter(isMaryamDeath),
        );
        if (deathEvents.length === 0)
          throw Error(
            "Fixture blocker: native publication emitted no actual Maryam death event.",
          );
      }
      if (
        result.ok &&
        priorLosses !== undefined &&
        beforeNextSuccessfulStep === undefined
      )
        beforeNextSuccessfulStep = priorLosses;
      return result;
    });
  try {
    step(g, { type: "teach", practice: "look" });
    // Fixture prerequisites precede every missing-loss assertion. Admission,
    // errors or absent emission are blockers, never the intended retention RED.
    expect(
      injected,
      "Fixture blocker: no real publication step intercepted",
    ).toBe(true);
    expect(
      deathEvents.length,
      "Fixture blocker: actual Maryam death emission",
    ).toBeGreaterThan(0);
    expect(
      deathEvents.every(
        (event) => isMaryamDeath(event) && event.at === ingressAt,
      ),
    ).toBe(true);
    const accepted = readRunHistory(HF.nativeExport(liveRun)).flatMap(
      (tx) => tx.inputs,
    );
    expect(
      accepted.filter(
        (entry) =>
          entry.id === deathInputId && entry.kind === "lifecycle.received",
      ),
      "Fixture blocker: native lifecycle admission",
    ).toHaveLength(1);
    expect(HF.isAlive(liveRun, "Maryam")).toBe(false);
    expect(g.run).toBe(liveRun);
    expect(g.inputs).toEqual([{ type: "teach", practice: "look" }]);

    function retained(losses: readonly RetainedLoss[]) {
      const maryam = losses.filter((loss) => loss.person === "Maryam");
      expect(maryam).toHaveLength(1);
      expect(maryam[0]?.at).toBe(ingressAt);
      expect(maryam[0]?.firstChapter).toBe(g.chapter + 1);
      expect(maryam[0]?.evidence).toEqual(expect.arrayContaining(deathEvents));
    }
    retained(g.losses); // Must hold by the public model action's return.
    const saved = exportRun(g);
    expect(saved.native.current.world.hostState).toEqual(saved.state);
    const publications = accepted.filter(
      (entry) => entry.kind === "world.changed",
    );
    expect(
      publications.some((entry) => entry.id === "host:1:reconcile:1"),
    ).toBe(true);
    expect(new Set(publications.map((entry) => entry.id)).size).toBe(
      publications.length,
    );
    expect(publications[1]?.at).toBeGreaterThan(publications[0]?.at ?? -1);
    if (beforeNextSuccessfulStep !== undefined)
      retained(beforeNextSuccessfulStep);
    // This externally authored archive is not ordinary model.replay proof.
    // Eviction/idempotence/native JSON controls live in the contract test.
  } finally {
    nativeStepSpy.mockRestore();
  }
});
