/** Pure workload verdicts. No CLI, host, or native runtime imports. */
export type CoverageCheckpoint = {
  milestoneDay: number;
  months: number;
  at: number;
  restoreMs: number;
};

export type QualificationCoverage = {
  firstGap: {
    months: number;
    reachedAt: number;
    nativeStepMs: number;
    hostGapMs: number;
    conditionalQueryMs: number;
  } | null;
  checkpoints: readonly CoverageCheckpoint[];
  months: number;
  finalAt: number;
  completedChapters: number;
};

const DAY = 86_400_000;
const BUDGET_MS = 2000;
const milestones = [
  [0, 0],
  [1096, 36],
  [2557, 84],
  [4018, 132],
  [5479, 180],
] as const;
const duration = (ms: number) => Number.isFinite(ms) && ms >= 0;
const civilDay = (at: number) => Math.floor(at / DAY);

export function qualificationVerdicts(c: QualificationCoverage): {
  firstGapComplete: boolean;
  fullRunComplete: boolean;
  checkpointCoverageComplete: boolean;
  stepWithinBudget: boolean;
  allRestoresWithinBudget: boolean;
} {
  const gap = c.firstGap;
  const firstGapComplete =
    gap !== null && gap.months === 36 && civilDay(gap.reachedAt) === 1096;
  const checkpointCoverageComplete =
    c.checkpoints.length === milestones.length &&
    milestones.every(
      ([day, months]) =>
        c.checkpoints.filter(
          (checkpoint) =>
            checkpoint.milestoneDay === day &&
            checkpoint.months === months &&
            civilDay(checkpoint.at) === day,
        ).length === 1,
    );
  return {
    firstGapComplete,
    fullRunComplete:
      checkpointCoverageComplete &&
      c.months === 180 &&
      c.completedChapters === 5 &&
      civilDay(c.finalAt) === 5479,
    checkpointCoverageComplete,
    stepWithinBudget:
      firstGapComplete &&
      gap !== null &&
      [gap.nativeStepMs, gap.hostGapMs, gap.conditionalQueryMs].every(
        duration,
      ) &&
      gap.hostGapMs + gap.conditionalQueryMs <= BUDGET_MS &&
      gap.nativeStepMs + gap.conditionalQueryMs <= BUDGET_MS,
    allRestoresWithinBudget:
      checkpointCoverageComplete &&
      c.checkpoints.every(
        (checkpoint) =>
          duration(checkpoint.restoreMs) && checkpoint.restoreMs <= BUDGET_MS,
      ),
  };
}
