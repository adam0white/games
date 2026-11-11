/** Reduced HF4 chapter-cost probe; separate from the released HF3 game. */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, loadavg } from "node:os";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { authoredPerson, DAY, exampleSpec, START } from "./hf4-budget-host.mjs";

const require = createRequire(new URL("../package.json", import.meta.url));
const resolved = require.resolve("hf4");
const hf = await import(pathToFileURL(resolved).href);
const { createRun, createPerson, step, exportRun, replay, restoreRun } = hf;
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const mode = option("--mode") ?? "quick";
const archivePath = option("--archive");
if (
  !["quick", "full"].includes(mode) ||
  (args.includes("--archive") && (!archivePath || !isAbsolute(archivePath)))
)
  throw new Error("Use --mode quick|full [--archive /absolute/path]");
const need = (result) => {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};
const YEAR = 365.25 * DAY;
const spec = exampleSpec(21);
spec.host = {
  id: "world",
  edition: "child-g7-budget-1",
  schema: "child-g7-budget-1",
};
const run = need(createRun(spec));
const cast = [
  ["elif", "Elif", 3, "female"],
  ["Zehra", "Zehra", 31, "female"],
  ["Yusuf", "Yusuf", 34, "male"],
  ["Maryam", "Maryam", 68, "female"],
  ["Danyal", "Danyal", 52, "male"],
  ["Tariq", "Tariq", 16, "male"],
];
const traits = {
  Yusuf: [0.75, 0.4, 0.5, 0.6, 0.85, 0.5],
  Maryam: [0.8, 0.6, 0.6, 0.8, 0.8, 0.4],
  Danyal: [0.9, 0.4, 0.4, 0.7, 0.8, 0.5],
  Tariq: [0.6, 0.3, 0.7, 0.6, 0.5, 0.7],
};
for (const [id, name, age, sex] of cast) {
  const p = authoredPerson(id, name, sex);
  p.identity.birthAt = START - age * YEAR;
  if (traits[id])
    p.state.traits = Object.fromEntries(
      Object.keys(p.state.traits).map((k, i) => [k, traits[id][i]]),
    );
  need(createPerson(run, p));
}
const fidelity = { mode: "daily", dayMs: DAY, anchor: START };
const engine = exportRun(run).engine;
console.log(
  JSON.stringify({
    stage: "start",
    mode,
    acceptance: mode === "full",
    resolvedPackage: resolved,
    version: engine.package,
    runEngine: engine,
    runEngineExport: hf.RUN_ENGINE ?? null,
    date: new Date().toISOString(),
    node: process.version,
    cpu: cpus()[0].model,
    load: loadavg(),
    cast,
    scope:
      "Reduced three-year six-person daily gate. Meals are receipts; no lessons, relationships or explicit sleep activities. Not a full port, full upbringing, phone or mortality acceptance.",
  }),
);
let elapsed = 0,
  totalInputs = 0,
  days = 0;
const ends =
  mode === "full"
    ? Array.from({ length: 36 }, (_, i) =>
        Math.ceil((3 * 365.25 * (i + 1)) / 36),
      )
    : [1];
for (const [index, end] of ends.entries()) {
  const inputs = [];
  for (let day = days; day < end; day++)
    for (const hour of [1, 7, 13, 19])
      for (const [id] of cast)
        inputs.push({
          id: `meal-${day}-${hour}-${id}`,
          at: START + day * DAY + hour * 3600000,
          source: { type: "host", id: "world" },
          kind: "body.received",
          payload: {
            person: id,
            evidenceId: `food-${day}-${hour}-${id}`,
            receipt: {
              type: "consumed",
              actionReceipt: `meal-${day}-${hour}-${id}`,
              received: { food: 0.5, water: 0.5 },
            },
          },
        });
  const t = performance.now();
  const result = need(
    step(run, { until: START + end * DAY, fidelity, inputs }),
  );
  const ms = performance.now() - t;
  elapsed += ms;
  totalInputs += inputs.length;
  days = end;
  if (!result.reachedUntil || result.boundary.type !== "until")
    throw new Error(JSON.stringify(result.boundary));
  console.log(
    JSON.stringify({
      stage: "checkpoint",
      month: index + 1,
      days,
      ms,
      elapsedMs: elapsed,
      load: loadavg(),
    }),
  );
}
const e = performance.now();
const archive = exportRun(run);
const raw = JSON.stringify(archive);
const exportMs = performance.now() - e;
if (archivePath) writeFileSync(archivePath, raw);
const parsed = JSON.parse(raw);
const r = performance.now();
const restored = need(restoreRun(parsed));
const restoreMs = performance.now() - r;
const restoreExact = JSON.stringify(exportRun(restored)) === raw;
const rp = performance.now();
const verified = need(replay(parsed));
const replayMs = performance.now() - rp;
const replayExact =
  verified.verified && verified.fullHash === archive.hashes.full;
console.log(
  JSON.stringify({
    stage: "result",
    mode,
    days,
    people: 6,
    inputs: totalInputs,
    stepMs: elapsed,
    msPerYearPerson: elapsed / ((days / 365.25) * 6),
    nominalMsPerYearPerson: mode === "full" ? elapsed / 18 : null,
    exportMs,
    archiveBytes: Buffer.byteLength(raw),
    archivePath: archivePath ?? null,
    restoreMs,
    restoreExact,
    replayMs,
    replayExact,
    hash: archive.hashes.full,
    stepBudgetMs: 2000,
    stepWithinBudget: mode === "full" ? elapsed <= 2000 : null,
    restoreBudgetMs: 2000,
    restoreWithinBudget: mode === "full" ? restoreMs <= 2000 : null,
    load: loadavg(),
  }),
);
if (!restoreExact || !replayExact)
  throw new Error("Exact restore or replay failed");
