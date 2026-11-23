import { describe, expect, it } from "vitest";
import {
  type CoverageCheckpoint,
  type QualificationCoverage,
  qualificationVerdicts,
} from "../scripts/child-qualification-coverage";

const DAY = 86_400_000;
const checkpoints: readonly CoverageCheckpoint[] = [
  { milestoneDay: 0, months: 0, at: 0, restoreMs: 2000 },
  { milestoneDay: 1096, months: 36, at: 1096 * DAY + 1, restoreMs: 2000 },
  { milestoneDay: 2557, months: 84, at: 2557 * DAY + 1, restoreMs: 2000 },
  { milestoneDay: 4018, months: 132, at: 4018 * DAY + 1, restoreMs: 2000 },
  { milestoneDay: 5479, months: 180, at: 5479 * DAY + 1, restoreMs: 2000 },
];
const complete: QualificationCoverage = {
  firstGap: {
    months: 36,
    reachedAt: 1096 * DAY + 1,
    nativeStepMs: 1400,
    hostGapMs: 1500,
    conditionalQueryMs: 500,
  },
  checkpoints,
  months: 180,
  finalAt: 5479 * DAY + 1,
  completedChapters: 5,
};

describe("qualification coverage verdicts", () => {
  it("accepts the complete workload at both independent budget limits", () => {
    expect(qualificationVerdicts(complete)).toEqual({
      firstGapComplete: true,
      fullRunComplete: true,
      checkpointCoverageComplete: true,
      stepWithinBudget: true,
      allRestoresWithinBudget: true,
    });
  });

  it("does not call a fast, death-shortened first month complete", () => {
    const firstGap = { ...complete.firstGap!, months: 1, reachedAt: 30 * DAY };
    expect(qualificationVerdicts({ ...complete, firstGap })).toMatchObject({
      firstGapComplete: false,
      stepWithinBudget: false,
    });
  });

  it("does not pass a missing first gap", () => {
    expect(
      qualificationVerdicts({ ...complete, firstGap: null }),
    ).toMatchObject({
      firstGapComplete: false,
      stepWithinBudget: false,
    });
  });

  it("requires 36 completed months even at the target civil day", () => {
    const firstGap = { ...complete.firstGap!, months: 1 };
    expect(qualificationVerdicts({ ...complete, firstGap })).toMatchObject({
      firstGapComplete: false,
      stepWithinBudget: false,
    });
  });

  it("requires the first gap's actual civil endpoint", () => {
    const firstGap = { ...complete.firstGap!, reachedAt: 1095 * DAY };
    expect(qualificationVerdicts({ ...complete, firstGap })).toMatchObject({
      firstGapComplete: false,
      stepWithinBudget: false,
    });
  });

  it("includes conditional query time in the first-gap budget", () => {
    const firstGap = { ...complete.firstGap!, conditionalQueryMs: 500.01 };
    expect(qualificationVerdicts({ ...complete, firstGap })).toMatchObject({
      firstGapComplete: true,
      stepWithinBudget: false,
    });
  });

  it("fails a slow whole chapter even when native stepping is fast", () => {
    const firstGap = {
      ...complete.firstGap!,
      nativeStepMs: 10,
      hostGapMs: 2000.01,
      conditionalQueryMs: 0,
    };
    expect(qualificationVerdicts({ ...complete, firstGap })).toMatchObject({
      firstGapComplete: true,
      stepWithinBudget: false,
    });
  });

  it("keeps a complete first-gap verdict when later checkpoints are missing", () => {
    expect(
      qualificationVerdicts({
        ...complete,
        checkpoints: checkpoints.slice(0, 2),
      }),
    ).toMatchObject({
      firstGapComplete: true,
      stepWithinBudget: true,
      checkpointCoverageComplete: false,
      fullRunComplete: false,
      allRestoresWithinBudget: false,
    });
  });

  it("does not pass restore coverage vacuously with no checkpoints", () => {
    expect(
      qualificationVerdicts({ ...complete, checkpoints: [] }),
    ).toMatchObject({
      checkpointCoverageComplete: false,
      fullRunComplete: false,
      allRestoresWithinBudget: false,
    });
  });

  it("rejects duplicate milestones", () => {
    expect(
      qualificationVerdicts({
        ...complete,
        checkpoints: [...checkpoints, checkpoints[1]!],
      }).checkpointCoverageComplete,
    ).toBe(false);
  });

  it("rejects a mismatched milestone-month pair", () => {
    const changed = checkpoints.map((c) =>
      c.milestoneDay === 2557 ? { ...c, months: 83 } : c,
    );
    expect(
      qualificationVerdicts({ ...complete, checkpoints: changed })
        .checkpointCoverageComplete,
    ).toBe(false);
  });

  it("checks each checkpoint's actual civil day", () => {
    const changed = checkpoints.map((c) =>
      c.milestoneDay === 4018 ? { ...c, at: 4017 * DAY } : c,
    );
    expect(
      qualificationVerdicts({ ...complete, checkpoints: changed })
        .checkpointCoverageComplete,
    ).toBe(false);
  });

  it("requires the final civil day, months, and resolved outcomes", () => {
    expect(
      qualificationVerdicts({ ...complete, finalAt: 5478 * DAY })
        .fullRunComplete,
    ).toBe(false);
    expect(
      qualificationVerdicts({ ...complete, months: 179 }).fullRunComplete,
    ).toBe(false);
    expect(
      qualificationVerdicts({ ...complete, completedChapters: 4 })
        .fullRunComplete,
    ).toBe(false);
  });

  it("rejects nonfinite or negative step components", () => {
    for (const firstGap of [
      { ...complete.firstGap!, nativeStepMs: Number.NaN },
      { ...complete.firstGap!, conditionalQueryMs: -1 },
      { ...complete.firstGap!, hostGapMs: Number.NaN },
      { ...complete.firstGap!, hostGapMs: -1 },
    ]) {
      expect(
        qualificationVerdicts({ ...complete, firstGap }).stepWithinBudget,
      ).toBe(false);
    }
  });

  it("checks each restore time independently of coverage", () => {
    for (const restoreMs of [2000.01, Number.NaN, -1]) {
      const changed = checkpoints.map((c) =>
        c.milestoneDay === 2557 ? { ...c, restoreMs } : c,
      );
      expect(
        qualificationVerdicts({ ...complete, checkpoints: changed }),
      ).toMatchObject({
        checkpointCoverageComplete: true,
        fullRunComplete: true,
        allRestoresWithinBudget: false,
      });
    }
  });
});
