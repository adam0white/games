import { portableWriteBlockers } from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { CAST_IDS, workshopTransfer } from '../src/game/cast';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';

const controls = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../src/lab', () => ({
  lab: {
    build: () => ({ c: 'test' }),
    setPersonaRecording: () => {},
    allowPersonaRecording: () => {},
  },
}));
vi.mock('@adam0white/lab-client', async (load) => ({
  ...(await load<typeof import('@adam0white/lab-client')>()),
  personaChannel: () => ({ ready: Promise.resolve(), enabled: true, request: controls.request }),
}));
beforeEach(() => {
  controls.request.mockReset();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
it('uses the real public closed gate for custom projection, checkpoint, automatic departure and fork with zero writes', async () => {
  const { WorkshopContinuity } = await import('../src/continuity');
  const state = dispatch(createGame(19), { type: 'pause-chapter' }).state;
  const before = saveGame(state),
    host = new WorkshopContinuity();
  host.bind(
    () => state,
    () => {},
  );
  await host.resume();
  expect(portableWriteBlockers(CAST_IDS.nora!, 'repair').length).toBeGreaterThan(0);
  const prematureClosure = JSON.parse(before);
  prematureClosure.faultVariety.recordingClosure = null;
  expect(() => loadGame(JSON.stringify(prematureClosure))).toThrow();
  await expect(workshopTransfer(state.people.nora!, state)).rejects.toThrow('read-only');
  await expect(host.checkpoint('nora')).rejects.toThrow('read-only');
  await expect(host.checkpoint('nora', true)).rejects.toThrow('read-only');
  await host.checkpointAll();
  expect(controls.request).not.toHaveBeenCalled();
  expect(host.heads).toEqual([]);
  expect(saveGame(state)).toBe(before);
  expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('rejects equal-RNG reordered generated history before native or shared publication', async () => {
  const { WorkshopContinuity } = await import('../src/continuity');
  let state = createGame(19);
  for (let i = 0; i < 3; i++) {
    const r = dispatch(state, { type: 'next-day' });
    expect(r.ok).toBe(true);
    state = r.state;
  }
  state = dispatch(state, { type: 'pause-chapter' }).state;
  const original = saveGame(state),
    changed = JSON.parse(original);
  [changed.jobs[3], changed.jobs[4]] = [changed.jobs[4], changed.jobs[3]];
  const raw = JSON.stringify(changed);
  expect(() => loadGame(raw)).toThrow('generation history');
  const host = new WorkshopContinuity();
  host.bind(
    () => changed,
    () => {},
  );
  await host.resume();
  await expect(host.checkpoint('nora')).rejects.toThrow('generation history');
  await host.checkpointAll();
  expect(controls.request).not.toHaveBeenCalled();
  expect(host.heads).toEqual([]);
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(JSON.stringify(changed)).toBe(raw);
  expect(saveGame(state)).toBe(original);
});
