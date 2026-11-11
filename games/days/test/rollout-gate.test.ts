import { portableWriteBlockers } from "@adam0white/lab-client";
import { expect, it } from "vitest";
import { checkpointContinuity } from "../src/continuity.ts";
import { createGame, sharedCast } from "../src/engine.ts";

it("keeps a claimed blocked person unchanged with the published reader table", async () => {
  const blocked = sharedCast[1]!;
  expect(portableWriteBlockers(blocked, "days")).toContain("commonstead");
  const game = createGame(42);
  game.chapter = { claims: [{ castId: blocked } as never], startedAt: 1, completed: false };
  game.outcome = "won";
  const before = JSON.stringify(game.chapter);
  let writes = 0;
  await expect(
    checkpointContinuity(
      {
        request: async () => {
          writes++;
        },
      } as never,
      game,
      () => true,
    ),
  ).rejects.toThrow("saved history is still held");
  expect(writes).toBe(0);
  expect(JSON.stringify(game.chapter)).toBe(before);
});

it("publishes an eligible person while leaving blocked and skipped people untouched", async () => {
  const eligible = sharedCast[0]!;
  const blocked = sharedCast[1]!;
  expect(portableWriteBlockers(eligible, "days")).toEqual([]);
  expect(portableWriteBlockers(blocked, "days")).toContain("commonstead");
  const game = createGame(42);
  game.chapter = { claims: [], skipped: [sharedCast[2]!], startedAt: 1, completed: false };
  game.outcome = "won";
  let request: import("@adam0white/lab-client").PersonaRequest | undefined;
  let reported: string[] | undefined;
  await checkpointContinuity(
    {
      request: async (value: import("@adam0white/lab-client").PersonaRequest) => {
        request = value;
      },
    } as never,
    game,
    () => true,
    (ids) => {
      reported = ids;
    },
  );
  expect(reported).toEqual([blocked]);
  expect(request?.action).toBe("putBatch");
  expect(request?.envelopes?.map((envelope) => envelope.castId)).toEqual([eligible]);
  expect(Object.keys(request?.expectedHeads ?? {})).toEqual([eligible]);
});

it("skips a Voice source without replacing its saved head", async () => {
  const { inspect, restoreRun } = await import("@adam0white/human-framework");
  const { canonicalCast, createPersona, initialPersonaLife, preparePersonaLife } = await import(
    "@adam0white/lab-client"
  );
  const { startContinuity } = await import("../src/continuity.ts");
  const id = sharedCast[0]!;
  const restored = restoreRun(createGame(42).actors);
  if (!restored.ok) throw new Error(restored.error.message);
  const result = inspect(restored.value, {
    perspective: { kind: "host" },
    people: [id],
    select: ["persona"],
    portable: { person: id, castId: id, castRevision: canonicalCast(id).revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const entry = result.value.people[0];
  if (entry?.kind !== "host") throw new Error("Missing projection");
  const part = entry.parts.find((item) => item.select === "persona");
  if (part?.select !== "persona") throw new Error("Missing person");
  const portable = {
    ...structuredClone(part.value),
    source: { ...part.value.source, game: "voice", personId: "hacer" },
  };
  const parent = await createPersona({
    format: "hf-persona/1",
    castId: id,
    castRevision: canonicalCast(id).revision,
    branchId: "voice-control",
    parentRevision: null,
    source: { game: "voice", engine: "4.8.1", build: "synthetic", rules: "control" },
    transfer: {
      castPassport: "hf-portable-person/2",
      portable,
      life: initialPersonaLife(id, "voice-control", Date.now()),
    },
    limitations: [],
  });
  const before = JSON.stringify(parent);
  let claimed = false;
  const shelf = {
    async request<T>(request: import("@adam0white/lab-client").PersonaRequest): Promise<T> {
      if (request.action === "prepareBatch")
        return {
          inputs: [preparePersonaLife(parent, Date.now())],
          blocked: [],
          expectedHeads: Object.fromEntries(
            sharedCast.map((person) => [person, person === id ? parent.revision : null]),
          ),
        } as T;
      if (request.action === "putBatch") {
        claimed = (request.envelopes ?? []).some((p) => p.castId === id);
        return undefined as T;
      }
      throw new Error("Unexpected request");
    },
  };
  const game = await startContinuity(shelf, 43, () => true);
  expect(game.chapter?.skipped).toContain(id);
  expect(claimed).toBe(false);
  expect(JSON.stringify(parent)).toBe(before);
});
