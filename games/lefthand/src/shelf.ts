import {
  anchorPersonaLife,
  type CastShelf,
  canonicalCast,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type LifeBatchPreparation,
  type PersonaEnvelope,
  type PersonaRequest,
  personaChannel,
  portableWriteBlockers,
} from "@adam0white/lab-client";
import { CAST, departure, validateArrival } from "./actors.ts";
import {
  createGame,
  exportRun,
  type Run,
  replayRun,
  type State,
} from "./host.ts";

const KEY = "lefthand-run@5";
export const SHELF_CAST = CAST;
const ids = SHELF_CAST.map(([id]) => `hf.cast.${id}.well`);
type Source = PersonaEnvelope["source"];
type Context = {
  heads: Record<string, string | null>;
  claims: Record<string, PersonaEnvelope>;
  source: Source;
};
type Save = { run: Run; context: Context | null };
export type Session = {
  state: State;
  context: Context | null;
  status: string;
  preserveSave?: boolean;
};
export const channel = () => personaChannel({ preservation: "preserve" });

/** Resume is local and never reads or claims the shared shelf. */
export function loadSession(storage: Pick<Storage, "getItem">): Session | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const save = JSON.parse(raw) as Save;
    return {
      state: replayRun(save.run),
      context: save.context,
      status: "Saved run resumed.",
    };
  } catch {
    return {
      state: createGame(1),
      context: null,
      preserveSave: true,
      status:
        "This saved run cannot be resumed. It is saved in this browser. Choose Download run to keep a copy, then New game to start fresh.",
    };
  }
}
export function saveSession(
  storage: Pick<Storage, "setItem">,
  session: Session,
) {
  if (!session.preserveSave)
    storage.setItem(
      KEY,
      JSON.stringify({
        run: exportRun(session.state),
        context: session.context,
      } satisfies Save),
    );
}
export async function freshSession(
  seed: number,
  shelf: CastShelf,
  source: Source,
): Promise<Session> {
  let batch: LifeBatchPreparation | undefined;
  const observing: CastShelf = {
    async request<T>(request: PersonaRequest) {
      const result = await shelf.request<T>(request);
      if (request.action === "prepareBatch")
        batch = result as LifeBatchPreparation;
      return result;
    },
  };
  try {
    const result = await claimCastChapterBatch(
      observing,
      ids,
      source,
      async (inputs) => createGame(seed, { inputs, blocked: [] }),
      { admitPerson: (input) => validateArrival(seed, input) },
    );
    if (!batch) throw Error("Shelf preparation did not return heads.");
    const blocked = result?.blocked ?? [];
    const state = result?.initial ?? createGame(seed);
    state.carryover.blocked = structuredClone(blocked);
    const claims = Object.fromEntries(
      (result?.claims ?? []).map((p) => [p.castId, p]),
    );
    const heads: Context["heads"] = {};
    for (const id of ids) {
      if (blocked.some((p) => p.castId === id)) continue;
      if (claims[id]) heads[id] = claims[id].revision;
      else if (batch.expectedHeads[id] === null) heads[id] = null;
    }
    return {
      state,
      context: { heads, claims, source },
      status: blocked.length
        ? `${blocked.map((p) => canonicalCast(p.castId).name).join(", ")} could not join from their other game, so they start fresh here.`
        : "Shared people are ready.",
    };
  } catch {
    return {
      state: createGame(seed),
      context: null,
      status:
        "The people shared between games could not be reached. This game is saved in this browser only; your people will not carry over this time.",
    };
  }
}
export async function checkpoint(
  session: Session,
  shelf: CastShelf,
): Promise<string> {
  const { state, context } = session;
  if (
    !context ||
    state.phase !== "ended" ||
    state.wellPendingTick !== null ||
    state.recoveryPending
  )
    return session.status;
  const envelopes: PersonaEnvelope[] = [];
  const expectedHeads: Record<string, string | null> = {};
  const skipped: string[] = [];
  for (const [id] of SHELF_CAST) {
    const castId = `hf.cast.${id}.well`;
    if (
      !Object.hasOwn(context.heads, castId) ||
      state.carryover.blocked.some((p) => p.castId === castId)
    )
      continue;
    if (portableWriteBlockers(castId, "lefthand").length) {
      skipped.push(canonicalCast(castId).name);
      continue;
    }
    const parent = context.claims[castId];
    try {
      const branchId = parent?.branchId ?? crypto.randomUUID();
      const transfer = departure(state, id, parent);
      const life = parent?.transfer.life
        ? anchorPersonaLife(parent.transfer.life as never, castId, Date.now())
        : initialPersonaLife(castId, branchId, Date.now());
      envelopes.push(
        await createPersona({
          format: "hf-persona/1",
          castId,
          castRevision: "1",
          branchId,
          parentRevision: context.heads[castId] ?? null,
          source: context.source,
          transfer: { ...transfer, life },
          limitations: [],
        }),
      );
      expectedHeads[castId] = context.heads[castId] ?? null;
    } catch {
      skipped.push(canonicalCast(castId).name);
    }
  }
  if (!envelopes.length)
    return skipped.length
      ? `${skipped.join(", ")} could not be carried to your other games. Their shared records stay unchanged.`
      : session.status;
  try {
    await shelf.request({ action: "putBatch", envelopes, expectedHeads });
    for (const p of envelopes) {
      context.heads[p.castId] = p.revision;
      context.claims[p.castId] = p;
    }
    return skipped.length
      ? `${skipped.join(", ")} could not be carried to your other games. Their shared records stay unchanged.`
      : "People saved to the shared shelf.";
  } catch {
    session.context = null;
    return "The shared shelf changed or is unavailable. This run is saved locally; shelf changes were not retried.";
  }
}
