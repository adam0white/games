import {
  acceptPersonaBatch,
  type CastShelf,
  createPersona,
  type PersonaRequest,
  type PersonaShelfState,
  preparePersonaLife,
} from "@adam0white/lab-client";
import { describe, expect, it } from "vitest";
import { departure } from "../src/actors";
import { createGame } from "../src/host";
import {
  checkpoint,
  freshSession,
  loadSession,
  saveSession,
} from "../src/shelf";

describe("shared shelf", () => {
  it("pins blocked people, preserves foreign heads and resumes without reading the shelf", async () => {
    const blocked = "hf.cast.idris.well";
    const foreign = "hf.cast.samira.well";
    const calls: PersonaRequest[] = [];
    const shelf: CastShelf = {
      async request<T>(request: PersonaRequest): Promise<T> {
        calls.push(structuredClone(request));
        if (request.action === "prepareBatch")
          return {
            expectedHeads: Object.fromEntries(
              (request.castIds ?? []).map((id) => [
                id,
                id === foreign ? "foreign-revision" : null,
              ]),
            ),
            inputs: [],
            blocked: [
              { castId: blocked, reason: "Clinical conflict" },
              { castId: foreign, reason: "Another chapter owns this person" },
            ],
          } as T;
        return undefined as T;
      },
    };
    const session = await freshSession(7, shelf, {
      game: "lefthand",
      engine: "4.17.0",
      build: "local",
      rules: "left-hand-5",
    });
    expect(calls[0]?.castIds).toContain("hf.cast.tariq.well");
    expect(session.state.carryover.blocked.map((p) => p.castId)).toEqual([
      blocked,
      foreign,
    ]);
    session.state.phase = "ended";
    await checkpoint(session, shelf);
    const writes = calls
      .filter((c) => c.action === "putBatch")
      .flatMap((c) => c.envelopes ?? []);
    expect(
      writes.some((p) => p.castId === blocked || p.castId === foreign),
    ).toBe(false);
    expect(writes.map((p) => p.castId)).toEqual(["hf.cast.tariq.well"]);
    session.state.phase = "evening";
    const data = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      getItem: (k: string) => data.get(k) ?? null,
    };
    saveSession(storage, session);
    const count = calls.length;
    const loaded = loadSession(storage);
    expect(loaded?.state.carryover.blocked).toEqual(
      session.state.carryover.blocked,
    );
    expect(calls).toHaveLength(count);
  });
  it("carries changed incoming traits into the authored opening", async () => {
    const id = "hf.cast.tariq.well";
    const source = {
      game: "lefthand",
      engine: "4.17.0",
      build: "local",
      rules: "left-hand-5",
    };
    const transfer = departure(createGame(9), "tariq");
    const portable = transfer.portable as {
      state: { traits: { honesty: number } };
    };
    portable.state.traits.honesty = 0.23;
    const parent = await createPersona({
      format: "hf-persona/1",
      castId: id,
      castRevision: "1",
      branchId: "traits-control",
      parentRevision: null,
      source,
      transfer,
      limitations: [],
    });
    let store: PersonaShelfState = acceptPersonaBatch(
      { revisions: [], heads: {} },
      [parent],
    );
    const shelf: CastShelf = {
      async request<T>(request: PersonaRequest): Promise<T> {
        if (request.action === "prepareBatch")
          return {
            expectedHeads: Object.fromEntries(
              (request.castIds ?? []).map((castId) => [
                castId,
                store.heads[castId] ?? null,
              ]),
            ),
            inputs: [preparePersonaLife(parent, 0)],
            blocked: [],
          } as T;
        if (request.action === "putBatch") {
          store = acceptPersonaBatch(
            store,
            request.envelopes ?? [],
            request.expectedHeads,
          );
          return undefined as T;
        }
        throw Error("Unexpected request");
      },
    };
    const session = await freshSession(7, shelf, source);
    expect(session.state.actorsRun.current.people.tariq?.traits.honesty).toBe(
      0.23,
    );
    expect(session.state.carryover.inputs[0]?.parent.revision).toBe(
      parent.revision,
    );
  });
});
