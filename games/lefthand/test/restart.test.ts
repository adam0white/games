import { expect, test } from "vitest";
import {
  createGame,
  exportRun,
  hash,
  openingRoutine,
  replayRun,
  step,
} from "../src/host";
import { restartGame } from "../src/restart";

test("Play again changes the lane and first witness even when entropy repeats", () => {
  const previous = createGame(17);
  const next = restartGame(previous.seed, previous.seed);
  expect(next.seed).not.toBe(previous.seed);
  expect(openingRoutine(next.seed).lane).not.toBe(
    openingRoutine(previous.seed).lane,
  );
  expect(openingRoutine(next.seed).firstWitness).not.toBe(
    openingRoutine(previous.seed).firstWitness,
  );
  expect(next.status).toContain("Tariq walks");
  expect(next.status).toContain("first neighbour");
  expect(hash(replayRun(exportRun(next)))).toBe(hash(next));
  step(next, { type: "plan", route: "well" });
  expect(hash(replayRun(exportRun(next)))).toBe(hash(next));
  expect(previous.phase).toBe("evening");
});
