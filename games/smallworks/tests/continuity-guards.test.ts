import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { saveGame } from '../src/game/persistence';
import legacyNora from './fixtures/commonstead-nora-hf223-native.json';

const controls = vi.hoisted(() => ({
  request: vi.fn(),
  captureSave: vi.fn(),
  ready: Promise.resolve(true),
  enabled: true,
  player: 'test-a',
  key: null as string | null,
  grants: new Map<string, string>(),
}));
vi.mock('../src/lab', () => ({
  lab: {
    build: () => ({ c: 'test' }),
    captureSave: controls.captureSave,
    get playerId() {
      return controls.player;
    },
    setPersonaRecording(key: string | null) {
      controls.key = key;
    },
    allowPersonaRecording(allow: boolean) {
      if (controls.key) {
        if (allow) controls.grants.set(controls.key, controls.player);
        else controls.grants.delete(controls.key);
      }
    },
    get personaRecordingAllowed() {
      return !controls.key || controls.grants.get(controls.key) === controls.player;
    },
  },
}));
vi.mock('@adam0white/lab-client', async (load) => {
  const real = await load<typeof import('@adam0white/lab-client')>();
  return {
    ...real,
    // Synthetic permissive-policy fixture; real published closed-gate controls live separately.
    portableWriteBlockers: () => [],
    personaChannel: () => ({
      get ready() {
        return controls.ready;
      },
      get enabled() {
        return controls.enabled;
      },
      setEnabled(on: boolean) {
        controls.enabled = on;
      },
      request: controls.request,
    }),
  };
});
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  controls.grants.clear();
  controls.key = null;
  controls.player = 'test-a';
  controls.enabled = true;
  controls.ready = Promise.resolve(true);
  controls.request.mockReset();
  controls.captureSave.mockReset();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
async function runtime() {
  return new (await import('../src/continuity')).WorkshopContinuity();
}
async function ownNoraSource() {
  const real = await import('@adam0white/lab-client');
  const { CAST_IDS } = await import('../src/game/cast');
  const oldPerson = JSON.parse(
    readFileSync(
      new URL('./fixtures/hf411-projections/repair-hf411-nora-source.fixture', import.meta.url),
      'utf8',
    ),
  );
  const projected = {
    transfer: {
      castPassport: 'workshop-hf4/1',
      sourceRole: 'nora',
      person: oldPerson,
    },
    limitations: [],
  };
  const castId = CAST_IDS.nora!;
  const branchId = 'hf4-file-source';
  const parent = await real.createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: real.canonicalCast(castId).revision,
    branchId,
    parentRevision: null,
    source: { game: 'repair', build: 'test', engine: '4.11.0', rules: 'canonical-workshop-3' },
    transfer: { ...projected.transfer, life: real.initialPersonaLife(castId, branchId, 0) },
    limitations: projected.limitations,
  });
  return { real, parent };
}

describe('host recording and local ownership guards (synthetic controls)', () => {
  it('starts and replays a fresh local cast without reading or writing shared heads', async () => {
    const host = await runtime();
    const state = await host.freshLocal(42);
    expect(host.heads).toEqual([]);
    expect(host.historyNotice).toContain('Any earlier character histories remain');
    const played = dispatch(state, { type: 'wait', minutes: 5 });
    expect(played.ok).toBe(true);
    const saved = saveGame(played.state);
    const { replayRecordedRun } = await import('../src/game/replay');
    expect(replayRecordedRun({ ...played.state, inputs: played.state.inputs }, saved).ok).toBe(
      true,
    );
    let current = played.state;
    host.bind(
      () => current,
      () => {},
      (paused) => {
        current = paused;
      },
    );
    await host.departLocal();
    expect(current.chapterPaused).toBe(true);
    expect(storage.size).toBeGreaterThan(0);
    await host.checkpointAll();
    expect(controls.request).not.toHaveBeenCalled();
    const restored = await runtime();
    expect(saveGame(restored.loadLocal(host.localSave(played.state)))).toBe(saved);
    const next = await host.freshLocal(43);
    const nextPlayed = dispatch(next, { type: 'wait', minutes: 5 });
    expect(nextPlayed.ok).toBe(true);
    const nextSaved = saveGame(nextPlayed.state);
    expect(
      replayRecordedRun({ ...nextPlayed.state, inputs: nextPlayed.state.inputs }, nextSaved).ok,
    ).toBe(true);
    expect(controls.request).not.toHaveBeenCalled();
  });
  it('refuses an unsupported Commonstead passport before writing a current workshop claim', async () => {
    const { real, parent: original } = await ownNoraSource();
    const { validatePortablePerson } = await import('@adam0white/human-framework');
    const { CAST } = await import('../src/game/cast');
    const portable = structuredClone(validatePortablePerson(original.transfer.person));
    portable.source.game = 'commonstead';
    portable.source.personId = original.castId;
    const { revision: _revision, ...body } = original;
    const parent = await real.createPersona({
      ...body,
      source: { ...body.source, game: 'commonstead', rules: 'commonstead-4' },
      transfer: {
        castPassport: 'unsupported-commonstead',
        sourceRole: original.castId,
        portable,
        life: original.transfer.life,
      },
    });
    let shelf = real.acceptPersona({ heads: {}, revisions: [] }, parent);
    controls.request.mockImplementation(async (request) => {
      if (request.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(
            CAST.map((c) => [c.castId, shelf.heads[c.castId] ?? null]),
          ),
          inputs: [real.preparePersonaLife(parent, 0)],
          blocked: [],
        };
      if (request.action === 'putBatch') {
        shelf = real.acceptPersonaBatch(shelf, request.envelopes, request.expectedHeads);
        return null;
      }
      throw new Error('Unexpected request');
    });
    const host = await runtime();
    // An unsupported source is refused before the shelf can receive a claim.
    await expect(host.fresh(42)).rejects.toThrow('unsupported chapter');
    expect(controls.request.mock.calls.map(([request]) => request.action)).toEqual([
      'prepareBatch',
    ]);
  });
  it('keeps source archives in an isolated file without recording them or changing native saves', async () => {
    const previous = globalThis.location;
    vi.stubGlobal('location', { pathname: '/smallworks/file/' });
    try {
      storage.set('small-works-cast-local-v2', 'native-kept');
      const host = await runtime();
      const text = JSON.stringify({
        ...JSON.parse(saveGame(createGame(42))),
        castSources: [{ raw: 'private-imported-source' }],
      });
      const state = await host.importFile(text);
      await host.persist(state);
      expect(host.fileSession).toBe(true);
      expect(host.heads).toEqual([]);
      expect(host.exportRun(state)).toContain('private-imported-source');
      expect(JSON.stringify(controls.captureSave.mock.calls)).not.toContain(
        'private-imported-source',
      );
      expect(controls.captureSave).toHaveBeenCalled();
      expect(storage.get('small-works-cast-local-v2')).toBe('native-kept');
      expect(controls.request).not.toHaveBeenCalled();
    } finally {
      vi.stubGlobal('location', previous);
    }
  });

  it('starts an explicit HF4 lineage without replacing pre4 shelf heads', async () => {
    const real = await import('@adam0white/lab-client');
    const { CAST } = await import('../src/game/cast');
    const parent = await real.validatePersona(legacyNora.envelope);
    const input = real.preparePersonaLife(
      parent,
      legacyNora.envelope.transfer.life.clock.watermark * 3_600_000,
    );
    let shelf = real.acceptPersona({ heads: {}, revisions: [] }, parent);
    const before = structuredClone(shelf);
    controls.request.mockImplementation(async (request) => {
      if (request.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(
            CAST.map((cast) => [cast.castId, shelf.heads[cast.castId] ?? null]),
          ),
          inputs: [input],
          blocked: [],
        };
      if (request.action === 'putBatch') {
        shelf = real.acceptPersonaBatch(shelf, request.envelopes, request.expectedHeads);
        return null;
      }
      throw new Error('Unexpected request');
    });
    const host = await runtime();
    let state = await host.fresh(42);
    expect(shelf).toEqual(before);
    expect(host.heads).toEqual([]);
    expect(host.historyNotice).toContain('start fresh here: Nora');
    const restored = await runtime();
    restored.loadLocal(host.localSave(state));
    expect(restored.historyNotice).toBe(host.historyNotice);
    state = dispatch(state, { type: 'power', jobId: state.selectedJobId, on: false }).state;
    state = dispatch(state, { type: 'pause-chapter' }).state;
    host.bind(
      () => state,
      () => {},
    );
    await expect(host.checkpoint('nora')).rejects.toThrow('starts fresh in HF4');
    expect(shelf).toEqual(before);
  });

  it('refuses an unsupported current4 head before any ownership write', async () => {
    const { real, parent } = await ownNoraSource();
    const { CAST } = await import('../src/game/cast');
    const { revision: _revision, ...body } = parent;
    const incompatible = await real.createPersona({
      ...body,
      transfer: { ...body.transfer, castPassport: 'unsupported-current4' },
    });
    controls.request.mockImplementation(async (request) => {
      if (request.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(
            CAST.map((cast) => [
              cast.castId,
              cast.castId === parent.castId ? incompatible.revision : null,
            ]),
          ),
          inputs: [real.preparePersonaLife(incompatible, 0)],
          blocked: [],
        };
      throw new Error('No write is permitted after failed admission');
    });
    const host = await runtime();
    const runId = host.runId;
    await expect(host.fresh(42)).rejects.toThrow();
    expect(host.runId).toBe(runId);
    expect(host.isStarted).toBe(false);
    expect(controls.request.mock.calls.map(([request]) => request.action)).toEqual([
      'prepareBatch',
    ]);
  });

  it('automatically pauses/checkpoints departure and legally resumes a paused local save', async () => {
    let state = createGame(42);
    const host = await runtime();
    host.bind(
      () => state,
      () => {},
      (next) => {
        state = next;
      },
    );
    await host.resume();
    state = dispatch(state, { type: 'power', jobId: state.selectedJobId, on: false }).state;
    controls.request.mockResolvedValue(null);
    await host.depart();
    expect(state.chapterPaused).toBe(true);
    expect(state.inputs?.at(-1)?.type).toBe('pause-chapter');
    expect(controls.request.mock.calls.some(([request]) => request.action === 'putBatch')).toBe(
      true,
    );
    const restored = await runtime();
    state = restored.loadLocal(storage.get('small-works-cast-local-v2')!);
    restored.bind(
      () => state,
      () => {},
      (next) => {
        state = next;
      },
    );
    state = await restored.enter(state);
    expect(state.chapterPaused).toBe(false);
    expect(state.inputs?.at(-1)?.type).toBe('resume-chapter');
    const { replayRecordedRun } = await import('../src/game/replay');
    expect(
      replayRecordedRun(
        {
          seed: state.seed,
          inputs: state.inputs!,
          provenance: state.provenance,
          openingPeople: state.openingPeople,
          castChapter: state.castChapter,
        },
        saveGame(state),
      ).ok,
    ).toBe(true);
  });

  it.each([
    'Continuity is local to this game. Use a file.',
    'Shelf unavailable. Use a local file.',
  ])('keeps local play available when the shelf transport fails: %s', async (message) => {
    const host = await runtime();
    controls.request.mockRejectedValue(new Error(message));
    const state = await host.fresh(42);
    expect(state.seed).toBe(42);
    expect(state.castChapter).toBeUndefined();
    expect(controls.enabled).toBe(true);
    expect(host.isStarted).toBe(true);
    expect(host.status).toContain('saved on this device');
  });
  it('does not start a fallback workshop after a lost ownership write reply', async () => {
    const { CAST } = await import('../src/game/cast');
    const host = await runtime();
    const oldRun = host.runId;
    controls.request.mockImplementation(async (request) => {
      if (request.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(CAST.map((c) => [c.castId, null])),
          inputs: [],
          blocked: [],
        };
      throw new Error('Shelf unavailable. Use a local file.');
    });
    await expect(host.fresh(42)).rejects.toThrow('Shelf unavailable');
    expect(host.runId).toBe(oldRun);
    expect(host.isStarted).toBe(false);
  });
  it('does not hide a shelf ownership conflict behind local fallback', async () => {
    const host = await runtime();
    controls.request.mockRejectedValue(new Error('Ownership changed.'));
    await expect(host.fresh(42)).rejects.toThrow('Ownership changed.');
    expect(host.isStarted).toBe(false);
  });

  it('automatically carries people into a fresh ordinary chapter despite the old off preference', async () => {
    controls.enabled = false;
    const { CAST } = await import('../src/game/cast');
    controls.request.mockImplementation(async (request) =>
      request.action === 'prepareBatch'
        ? {
            expectedHeads: Object.fromEntries(CAST.map((c) => [c.castId, null])),
            inputs: [],
            blocked: [],
          }
        : null,
    );
    const host = await runtime();
    await host.fresh(42);
    expect(controls.enabled).toBe(true);
    expect(controls.request.mock.calls.map((c) => c[0].action)).toEqual([
      'prepareBatch',
      'putBatch',
    ]);
  });

  it('uses an expected-absence transaction for a wholly fresh allocation', async () => {
    const { CAST } = await import('../src/game/cast');
    controls.request.mockImplementation(async (request) =>
      request.action === 'prepareBatch'
        ? {
            expectedHeads: Object.fromEntries(CAST.map((c) => [c.castId, null])),
            inputs: [],
            blocked: [],
          }
        : null,
    );
    const host = await runtime();
    await host.fresh(42);
    expect(controls.request.mock.calls.map((c) => c[0].action)).toEqual([
      'prepareBatch',
      'putBatch',
    ]);
    expect(Object.keys(controls.request.mock.calls[1]![0].expectedHeads)).toHaveLength(4);
  });
  it('keeps file-origin nonownership through reload and ignores recording-only identity changes', async () => {
    const host = await runtime();
    const file = await host.freshLocal(42);
    expect(controls.request).not.toHaveBeenCalled();
    const outcomes = dispatch(file, { type: 'power', jobId: file.selectedJobId, on: false });
    expect(outcomes.ok).toBe(true);
    const { replayRecordedRun } = await import('../src/game/replay');
    expect(
      replayRecordedRun(
        {
          seed: outcomes.state.seed,
          inputs: outcomes.state.inputs,
          provenance: outcomes.state.provenance,
          openingPeople: outcomes.state.openingPeople,
          castChapter: outcomes.state.castChapter,
        },
        saveGame(outcomes.state),
      ).ok,
    ).toBe(true);
    const state = await host.importFile(saveGame(outcomes.state));
    expect(state.inputs).toEqual(outcomes.state.inputs);
    expect(saveGame(state)).toBe(saveGame(outcomes.state));
    expect(state.castChapter).toBeUndefined();
    expect(controls.request).not.toHaveBeenCalled();
    expect(host.heads).toEqual([]);
    await host.recording(true);
    const oldKey = controls.key;
    const saved = host.localSave(state);
    const restored = await runtime();
    restored.loadLocal(saved);
    await restored.resume();
    expect(restored.fileOrigin).toBe(true);
    expect(restored.heads).toEqual([]);
    expect(controls.key).not.toBe(oldKey);
    expect(controls.grants.has(controls.key!)).toBe(true);
    await restored.recording(true);
    expect(controls.grants.get(controls.key!)).toBe('test-a');
    window.dispatchEvent(new Event('hf-lab-preference'));
    expect(controls.grants.get(controls.key!)).toBe('test-a');
  });
  it('does not turn a compatibility recording choice into gameplay invalidation', async () => {
    const { createPersona } = await import('@adam0white/lab-client');
    const p = await createPersona({
      format: 'hf-persona/1',
      castId: 'hf.cast.nora.smallworks',
      castRevision: '1',
      branchId: 'test',
      parentRevision: null,
      source: { game: 'repair', engine: '4.11.0', rules: 'test', build: 'test' },
      transfer: {},
      limitations: [],
    });
    const host = await runtime();
    host.heads = [p];
    let reply: (v: unknown) => void = () => {};
    controls.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    const pending = host.recording(false);
    host.denyRecording();
    reply({ sameEpoch: true, revisions: [p.revision], recordingEpoch: 'opaque-test' });
    await pending;
    expect(controls.grants.get(controls.key!)).toBe('test-a');
    expect(controls.request).not.toHaveBeenCalled();
  });
  it('requires an actually paused played source and preserves exact accepted local receipts on reload', async () => {
    const real =
      await vi.importActual<typeof import('@adam0white/lab-client')>('@adam0white/lab-client');
    let shelf: import('@adam0white/lab-client').PersonaShelfState = { heads: {}, revisions: [] };
    controls.request.mockImplementation(async (request) => {
      if (request.action === 'recording') return { recordingEpoch: 'opaque-test' };
      if (request.action === 'recordingBatch')
        return {
          sameEpoch: false,
          revisions: request.envelopes.map(
            (p: import('@adam0white/lab-client').PersonaEnvelope) => p.revision,
          ),
          recordingEpoch: 'opaque-test',
        };
      if (request.action === 'putBatch') {
        shelf = real.acceptPersonaBatch(shelf, request.envelopes, request.expectedHeads);
        return null;
      }
      throw new Error('Unexpected request');
    });
    const host = await runtime();
    let state = createGame(42);
    host.bind(
      () => state,
      () => {},
    );
    host.loaded = true;
    await host.resume();
    await expect(host.checkpoint('nora')).rejects.toThrow('pause');
    state = dispatch(state, { type: 'power', jobId: state.selectedJobId, on: false }).state;
    state = dispatch(state, { type: 'pause-chapter' }).state;
    await host.checkpoint('nora');
    const first = host.heads[0]!;
    expect(
      JSON.parse(host.exportRun(state)).castSources.some(
        (row: { revision: string }) => row.revision === first.revision,
      ),
    ).toBe(true);
    const restored = await runtime();
    state = restored.loadLocal(host.localSave(state));
    restored.bind(
      () => state,
      () => {},
    );
    await restored.resume();
    expect(restored.heads[0]!.revision).toBe(first.revision);
    await restored.checkpoint('nora');
    expect(restored.heads[0]!.parentRevision).toBe(first.revision);
  });
  it('keeps raw file archives out of telemetry state and excludes unrelated run journals from export', async () => {
    const host = await runtime();
    const state = await host.importFile(
      JSON.stringify({
        ...JSON.parse(saveGame(createGame(42))),
        castSources: [{ raw: 'source-only' }],
      }),
    );
    expect(saveGame(state)).not.toContain('source-only');
    storage.set(
      'small-works-source-journal-v2',
      JSON.stringify([
        { runId: 'other-run', raw: 'unrelated-history' },
        { runId: host.runId, raw: 'current-source' },
      ]),
    );
    const exported = host.exportRun(state);
    expect(exported).toContain('source-only');
    expect(exported).toContain('current-source');
    expect(exported).not.toContain('unrelated-history');
    const restored = await runtime();
    restored.loadLocal(host.localSave(state));
    expect(restored.exportRun(state)).toContain('source-only');
  });
  it('does not replace the active run or its source archives after a failed file load', async () => {
    const host = await runtime();
    const state = await host.importFile(saveGame(createGame(42)));
    const runId = host.runId;
    host.fileSources = [{ raw: 'kept-source' }];
    await expect(host.importFile('{invalid')).rejects.toThrow();
    expect(host.runId).toBe(runId);
    expect(host.exportRun(state)).toContain('kept-source');
    expect(controls.grants.has(controls.key!)).toBe(false);
  });
  it('keeps a late source capture attached to its original run when a fresh run replaces it', async () => {
    const host = await runtime();
    let state = createGame(42);
    host.bind(
      () => state,
      () => {},
    );
    await host.resume();
    state = dispatch(state, { type: 'power', jobId: state.selectedJobId, on: false }).state;
    state = dispatch(state, { type: 'pause-chapter' }).state;
    const original = host.runId;
    const pending = host.checkpoint('nora');
    await Promise.resolve();
    controls.request.mockRejectedValue(new Error('Shelf unavailable. Use a local file.'));
    const fresh = await host.fresh(43);
    await expect(pending).rejects.toThrow('The game changed');
    const journal = JSON.parse(storage.get('small-works-source-journal-v2') ?? '[]');
    expect(journal.length).toBeGreaterThan(0);
    expect(journal.every((row: { runId: string }) => row.runId === original)).toBe(true);
    expect(JSON.parse(host.exportRun(fresh)).castSources).toEqual([]);
  });
});

it('does not cancel workshop admission while a recording identity reply arrives', async () => {
  let release!: (value: boolean) => void;
  controls.ready = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const c = await runtime();
  controls.request.mockRejectedValue(new Error('Shelf unavailable. Use a local file.'));
  const pending = c.fresh(42);
  window.dispatchEvent(new Event('hf-lab-preference'));
  const storage = new Event('storage');
  Object.defineProperty(storage, 'key', { value: 'hf-lab-player' });
  window.dispatchEvent(storage);
  release(true);
  await expect(pending).resolves.toHaveProperty('seed', 42);
});
