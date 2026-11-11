import { describe, expect, test } from "vitest";
import {
  POLICIES,
  policyReport,
  runPolicy,
  shortestPath,
} from "../scripts/policies";
import { createGame, hash, isWall, replayRun } from "../src/host";

describe("three-night headless policies", () => {
  test("shortest well route uses valid cardinal moves and reaches an action tile", () => {
    const state = createGame(1);
    const path = shortestPath(state, { x: 4, y: 7 }, true);
    expect(path).toHaveLength(10);
    for (const command of path) {
      expect(command.type).toBe("move");
      if (command.type !== "move") throw new Error("Expected movement");
      state.player.x += command.dx;
      state.player.y += command.dy;
      expect(isWall(state.player.x, state.player.y)).toBe(false);
    }
    expect(Math.abs(state.player.x - 4) + Math.abs(state.player.y - 7)).toBe(1);
  });

  test("all three policies deliver aid but produce distinct lasting consequences", () => {
    const report = policyReport([1, 7, 13]);
    expect(report.map((entry) => entry.policy)).toEqual([...POLICIES]);
    const [careful, careless, cold] = report;
    expect(careful?.endings).toEqual({ sheltered: 3 });
    expect(careless?.endings).toEqual({ exposed: 3 });
    expect(cold?.endings).toEqual({ rescued: 3 });
    for (const policy of report) {
      expect(policy.totals.deliveries).toBe(9);
      for (const run of policy.runs) {
        expect(run.history).toHaveLength(3);
        expect(run.history.every((night) => night.delivered)).toBe(true);
        expect(run.replayHash).toBe(run.finalHash);
      }
    }
    expect(careful?.totals).toEqual({
      deliveries: 9,
      exposureNights: 0,
      rescues: 0,
    });
    expect(careless?.totals.exposureNights).toBe(9);
    expect(cold?.totals.rescues).toBe(9);
    for (const run of cold?.runs ?? []) {
      expect(run.nightStarts.map((night) => night.limit)).toEqual([
        600, 540, 480,
      ]);
      expect(
        run.history.every((night) => night.rescued && night.delivered),
      ).toBe(true);
    }
  }, 120000);

  test("a saved complete run replays exactly and rejects modified aid state", () => {
    const { run, replayHash } = runPolicy("cold-policy", 19);
    const saved = JSON.parse(JSON.stringify(run));
    expect(hash(replayRun(saved))).toBe(replayHash);
    expect(saved.state.delivered).toBe(3);
    expect(saved.state.rescues).toBe(3);
    saved.state.delivered = 0;
    expect(() => replayRun(saved)).toThrow("Replay hash mismatch");
  }, 30000);

  test("bounded policies fail explicitly when the step budget is exhausted", () => {
    expect(() => runPolicy("careful", 1, 1)).toThrow("exceeded 1 steps");
  });
});
