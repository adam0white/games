import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  type Command,
  createGame,
  exportRun,
  hash,
  isWall,
  projection,
  replayRun,
  type State,
  step,
} from "../src/host.ts";

export const POLICIES = ["careful", "careless", "cold-policy"] as const;
export type Policy = (typeof POLICIES)[number];
type Point = { x: number; y: number };
const HOME = { x: 7, y: 15 };
const WELL = { x: 4, y: 7 };
const DOOR = { x: 11, y: 3 };
const DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;
const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const keyOf = (p: Point) => `${p.x},${p.y}`;

/** BFS finds a shortest route to an adjacent action tile. Among equally short
 * routes, prefer fewer tiles within patrol sight range. Replan as patrols move.
 * This heuristic uses visible positions, never the host's hidden RNG. */
export function shortestPath(
  state: State,
  target: Point,
  avoidWitnesses = false,
): Command[] {
  const start = keyOf(state.player);
  const queue: Point[] = [state.player];
  const depth = new Map([[start, 0]]);
  const risk = new Map([[start, 0]]);
  const from = new Map<string, { previous: string; command: Command }>();
  let goal: string | undefined;
  let goalDepth = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    if (!point) throw new Error("Missing BFS position");
    const key = keyOf(point);
    const currentDepth = depth.get(key) ?? Infinity;
    if (currentDepth > goalDepth) break;
    if (distance(point, target) <= 1) {
      if (goal === undefined || (risk.get(key) ?? 0) < (risk.get(goal) ?? 0))
        goal = key;
      goalDepth = currentDepth;
      continue;
    }
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: point.x + dx, y: point.y + dy };
      if (isWall(next.x, next.y)) continue;
      const nextKey = keyOf(next);
      const nextDepth = currentDepth + 1;
      const nextRisk =
        (risk.get(key) ?? 0) +
        (avoidWitnesses
          ? state.actors.filter(
              (actor) =>
                (actor.id === "danyal" || actor.id === "tariq") &&
                distance(actor, next) <= 4,
            ).length
          : 0);
      if (
        !depth.has(nextKey) ||
        (depth.get(nextKey) === nextDepth &&
          nextRisk < (risk.get(nextKey) ?? Infinity))
      ) {
        if (!depth.has(nextKey)) queue.push(next);
        depth.set(nextKey, nextDepth);
        risk.set(nextKey, nextRisk);
        from.set(nextKey, {
          previous: key,
          command: { type: "move", dx, dy },
        });
      }
    }
  }
  if (goal === undefined) throw new Error("No reachable action tile");
  const path: Command[] = [];
  while (goal !== start) {
    const edge = from.get(goal);
    if (!edge) throw new Error("Broken BFS path");
    path.unshift(edge.command);
    goal = edge.previous;
  }
  return path;
}

export function policyCommand(state: State, policy: Policy): Command {
  if (state.phase === "evening")
    return { type: "plan", route: policy === "careless" ? "door" : "well" };
  if (state.phase === "morning") return { type: "next" };
  if (state.recoveryPending)
    return {
      type: "recover",
      choice: policy === "careless" ? "explain" : "keepquiet",
    };
  if (state.conversationTicksRemaining > 0) return { type: "wait" };
  if (policy !== "careless" && state.player.lantern) return { type: "lantern" };
  if (!state.envelopePlaced) {
    const path = shortestPath(
      state,
      policy === "careless" ? DOOR : WELL,
      policy === "careful",
    );
    return path[0] ?? { type: "act" };
  }
  if (policy === "cold-policy" || !state.deliveredTonight)
    return { type: "wait" };
  return shortestPath(state, HOME, policy === "careful")[0] ?? { type: "act" };
}

export function runPolicy(policy: Policy, seed: number, maxSteps = 5000) {
  const state = createGame(seed);
  const nightStarts: { night: number; rescues: number; limit: number }[] = [];
  for (let i = 0; i < maxSteps && state.phase !== "ended"; i++) {
    const command = policyCommand(state, policy);
    step(state, command);
    if (command.type === "plan")
      nightStarts.push({
        night: state.night,
        rescues: state.rescues,
        limit: projection(state).nightLimit,
      });
  }
  if (state.phase !== "ended")
    throw new Error(`${policy} seed ${seed} exceeded ${maxSteps} steps`);
  const run = exportRun(state);
  const replayHash = hash(replayRun(run));
  if (replayHash !== run.finalHash || hash(run.state) !== run.finalHash)
    throw new Error(`${policy} seed ${seed}: replay diverged`);
  return { state, run, replayHash, nightStarts };
}

export function policyReport(
  seeds = Array.from({ length: 20 }, (_, i) => i + 1),
) {
  return POLICIES.map((policy) => {
    const runs = seeds.map((seed) => {
      const result = runPolicy(policy, seed);
      return {
        seed,
        ending: result.state.ending,
        deliveries: result.state.delivered,
        exposureNights: result.state.exposureNights,
        rescues: result.state.rescues,
        ticks: result.state.tick,
        finalHash: result.run.finalHash,
        replayHash: result.replayHash,
        nightStarts: result.nightStarts,
        history: result.state.history.map((night) => ({
          night: night.night,
          delivered: night.delivered,
          exposed: night.exposed,
          rescued: night.rescued,
          reason: night.reason,
        })),
      };
    });
    const endings: Record<string, number> = {};
    for (const run of runs)
      endings[run.ending] = (endings[run.ending] ?? 0) + 1;
    return {
      policy,
      seeds: seeds.length,
      endings,
      totals: {
        deliveries: runs.reduce((sum, run) => sum + run.deliveries, 0),
        exposureNights: runs.reduce((sum, run) => sum + run.exposureNights, 0),
        rescues: runs.reduce((sum, run) => sum + run.rescues, 0),
      },
      runs,
    };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = policyReport();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[2]) writeFileSync(process.argv[2], json);
  else process.stdout.write(json);
  if (process.argv[2])
    process.stdout.write(
      `${JSON.stringify(
        report.map(({ runs: _runs, ...summary }) => summary),
        null,
        2,
      )}\n`,
    );
}
