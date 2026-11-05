import { readFileSync } from "node:fs";
import {
  acceptPersonaBatch,
  createPersona,
  preparePersonaLife,
  portableWriteBlockers,
  validatePersona,
  type CastShelf,
  type PersonaEnvelope,
  type PersonaRequest,
  type PersonaShelfState,
} from "@adam0white/lab-client";
import { departure } from "../src/actors.ts";
import { exportRun, hash, replayRun, type Run } from "../src/host.ts";
import { freshSession, loadSession, saveSession, SHELF_CAST } from "../src/shelf.ts";

const file = process.argv[2];
if (!file)
  throw Error(
    "Pass the completed three-night run export as the first argument.",
  );
const source = replayRun(JSON.parse(readFileSync(file, "utf8")) as Run);
if (source.phase !== "ended" || source.night !== 3)
  throw Error("Source chapter is not complete.");
const active = (
  source.actorsRun.current.world.hostState as { active: unknown[] }
).active;
if (active.length) throw Error("Completed chapter still has active routines");
const sourceInfo = {
  game: "lefthand",
  engine: "4.17.0",
  build: "control",
  rules: "left-hand-5",
};
const eligible = SHELF_CAST.filter(([id]) => !portableWriteBlockers(`hf.cast.${id}.well`, "lefthand").length);
const parents = await Promise.all(
  eligible.map(async ([id]) =>
    createPersona({
      format: "hf-persona/1",
      castId: `hf.cast.${id}.well`,
      castRevision: "1",
      branchId: `shelf-control-${id}`,
      parentRevision: null,
      source: sourceInfo,
      transfer: departure(source, id),
      limitations: [],
    }),
  ),
);
function memoryShelf(initial: PersonaEnvelope[]) {
  let store: PersonaShelfState = acceptPersonaBatch(
    { revisions: [], heads: {} },
    initial,
  );
  let reads = 0;
  const shelf: CastShelf = {
    async request<T>(request: PersonaRequest): Promise<T> {
      if (request.action === "prepareBatch") {
        reads++;
        const castIds = request.castIds ?? [];
        return {
          expectedHeads: Object.fromEntries(
            castIds.map((id) => [id, store.heads[id] ?? null]),
          ),
          inputs: castIds.flatMap((id) => {
            const p = store.revisions.find(
              (x) => x.revision === store.heads[id],
            );
            return p ? [preparePersonaLife(p, 0)] : [];
          }),
          blocked: [],
        } as T;
      }
      if (request.action === "putBatch") {
        const people = await Promise.all(
          (request.envelopes ?? []).map(validatePersona),
        );
        store = acceptPersonaBatch(store, people, request.expectedHeads);
        return people as T;
      }
      throw Error("Unexpected request");
    },
  };
  return {
    shelf,
    get store() {
      return store;
    },
    get reads() {
      return reads;
    },
  };
}
const shared = memoryShelf(await Promise.all(parents.map(validatePersona)));
const session = await freshSession(7, shared.shelf, sourceInfo);
if (
  session.state.carryover.inputs.length !== eligible.length ||
  session.state.carryover.blocked.length
)
  throw Error(
    `Admission failed: ${JSON.stringify(session.state.carryover.blocked)}`,
  );
for (const [id] of eligible) {
  const parent = parents.find((p) => p.castId === `hf.cast.${id}.well`);
  if (!parent || shared.store.heads[parent.castId] === parent.revision)
    throw Error(`${id} was not claimed`);
  const traits = (
    parent.transfer.portable as { state: { traits: { honesty: number } } }
  ).state.traits;
  if (
    session.state.actorsRun.current.people[id]?.traits.honesty !==
    traits.honesty
  )
    throw Error(`${id} traits differ`);
}
const run = exportRun(session.state);
if (hash(replayRun(run)) !== run.finalHash) throw Error("Replay mismatch");
const data = new Map<string, string>();
const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => {
    data.set(key, value);
  },
};
saveSession(storage, session);
const before = shared.reads;
const resumed = loadSession(storage);
if (
  !resumed ||
  hash(resumed.state) !== run.finalHash ||
  shared.reads !== before
)
  throw Error("Local resume failed");

// A checksummed envelope cannot claim Tariq using another source actor.
const tariq = parents.find((p) => p.castId === "hf.cast.tariq.well");
if (!tariq) throw Error("Missing Tariq source");
const wrongId = "hf.cast.tariq.well";
const portable = structuredClone(tariq.transfer.portable) as { source: { personId: string } };
portable.source.personId = "yusuf";
const wrong = await createPersona({
  format: "hf-persona/1",
  castId: wrongId,
  castRevision: "1",
  branchId: "wrong-role",
  parentRevision: null,
  source: sourceInfo,
  transfer: { ...tariq.transfer, portable },
  limitations: [],
});
const negative = memoryShelf([wrong]);
const refused = await freshSession(7, negative.shelf, sourceInfo);
if (
  !refused.state.carryover.blocked.some((p) => p.castId === wrongId) ||
  negative.store.heads[wrongId] !== wrong.revision
)
  throw Error("Wrong role was not safely blocked");
console.log(
  JSON.stringify({
    source: "completed three-night run",
    admitted: eligible.map(([id]) => id),
    blocked: wrongId,
    replay: run.finalHash,
    tariq: "shared, peers verified",
    shelfReadsOnResume: shared.reads - before,
  }),
);
