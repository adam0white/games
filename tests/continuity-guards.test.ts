import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { saveGame } from '../src/game/persistence';
import nativeReceipt from './fixtures/commonstead-nora-native.json';

const controls = vi.hoisted(() => ({
  request: vi.fn(),
  ready: Promise.resolve(true),
  enabled: true,
  player: 'test-a',
  key: null as string | null,
  grants: new Map<string, string>(),
}));
vi.mock('../src/lab', () => ({
  lab: {
    build: () => ({ c: 'test' }),
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
describe('host recording and local ownership guards (synthetic controls)', () => {
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
    const real = await import('@adam0white/lab-client');
    const { admitWorkshop } = await import('../src/game/cast');
    const parent = await real.validatePersona(nativeReceipt.envelope);
    const input = real.preparePersonaLife(
      parent,
      nativeReceipt.envelope.transfer.life.clock.watermark * 3600000,
    );
    const people = createGame(42).people;
    people.nora = admitWorkshop(input, people.nora!);
    const { revision, ...body } = parent;
    // Synthetic target claim on the actual native source: a file receipt is never local ownership.
    const claim = await real.createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'repair', build: 'test', engine: '2.17.0', rules: 'canonical-workshop-2' },
      transfer: { ...parent.transfer, life: input.life },
    });
    const file = createGame(42, 'current', people, {
      version: 'workshop-cast/1',
      inputs: [input],
      claims: [claim],
    });
    const state = await host.importFile(saveGame(file));
    expect(state.castChapter?.claims[0]?.revision).toBe(claim.revision);
    expect(state.openingPeople?.nora?.rng).toEqual(nativeReceipt.raw.rng);
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
  it('keeps a denied mixed history closed when an old positive acknowledgement arrives', async () => {
    const { createPersona } = await import('@adam0white/lab-client');
    const p = await createPersona({
      format: 'hf-persona/1',
      castId: 'hf.cast.nora.smallworks',
      castRevision: '1',
      branchId: 'test',
      parentRevision: null,
      source: { game: 'repair', engine: '2.17.0', rules: 'test', build: 'test' },
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
    expect(controls.grants.get(controls.key!)).toBeUndefined();
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
      if (request.action === 'put') {
        shelf = real.acceptPersona(shelf, request.envelope, request.fork);
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
    const fresh = await host.fresh(43, true);
    await expect(pending).rejects.toThrow('Run changed');
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
  const pending = c.fresh(42, true);
  window.dispatchEvent(new Event('hf-lab-preference'));
  const storage = new Event('storage');
  Object.defineProperty(storage, 'key', { value: 'hf-lab-player' });
  window.dispatchEvent(storage);
  release(true);
  await expect(pending).resolves.toHaveProperty('seed', 42);
});
