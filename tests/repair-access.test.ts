import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as seventeen from '../src/game/engine17';
import { reassemble } from '../src/game/repair-access';
import { applyRepair, performActiveBellCheck } from '../src/game/repairs';

function act(s: ReturnType<typeof createGame>, id: string) {
  return transition(s, { type: 'action', id });
}
function inspected() {
  const s = act(createGame(1701), 'talk-family');
  return act(s, 'inspect');
}
function lamp(s: ReturnType<typeof createGame>) {
  const o = s.objects.find((item) => item.id === 'family');
  if (!o) throw Error('Missing lamp');
  return o;
}
it('an unopened public assembly projection is safe and never mutates the save', () => {
  const s = act(createGame(1701), 'talk-family');
  const before = serializeGame(s);
  expect(lamp(s).access).toBeUndefined();
  expect(getView(s).focus?.assembly).toEqual({
    kind: 'lamp',
    state: 'assembled',
    revision: 0,
    retainedPieceIds: [],
    workMarkers: [],
  });
  expect(serializeGame(s)).toBe(before);
});
it('the existing inspection opens named access and retains a real piece without repair or verification credit', () => {
  const s = inspected(),
    o = lamp(s);
  expect(o.access?.state).toBe('open');
  expect(o.access?.retainedPieceIds).toEqual(['lamp-base-cover']);
  expect(o.access?.events[0]).toMatchObject({
    action: 'open-access',
    triggeredBy: 'inspect',
    minutes: 4,
  });
  expect(o.observations.join(' ')).toContain('base cover is open');
  expect(o.repaired).toBe(false);
  expect(o.verified).toBe(false);
});
it('closed access blocks internal work without spending a spare or performing a repair', () => {
  let s = act(inspected(), 'reassemble');
  const before = serializeGame(s);
  expect(() => act(s, 'replace-battery')).toThrow('not available');
  expect(serializeGame(s)).toBe(before);
  expect(getView(s).actions.some((a) => a.id === 'open-access')).toBe(true);
  s = act(s, 'open-access');
  expect(getView(s).actions.some((a) => a.id === 'replace-battery')).toBe(true);
});
it('repaired open objects require a refit before a real check or an honest return', () => {
  let s = act(inspected(), 'clean-contact');
  expect(lamp(s).repaired).toBe(true);
  for (const id of ['verify', 'check-result', 'return', 'early-return'])
    expect(() => act(s, id)).toThrow('not available');
  const parts = structuredClone(s.parts),
    attempts = lamp(s).attempted;
  const practice = s.people.player?.skills.repair?.practice;
  const before = s.now;
  s = act(s, 'reassemble');
  expect(s.now - before).toBe(3);
  expect(s.parts).toEqual(parts);
  expect(lamp(s).attempted).toBe(attempts);
  expect(s.people.player?.skills.repair?.practice).toBe(practice);
  expect(lamp(s).verified).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'verify')).toBe(true);
});
it('reopening cancels a running or completed check while preserving repaired work', () => {
  for (const complete of [false, true]) {
    let s = act(act(act(inspected(), 'clean-contact'), 'reassemble'), 'verify');
    if (complete) {
      while (getView(s).actions.some((a) => a.id === 'wait-check')) s = act(s, 'wait-check');
      s = act(s, 'check-result');
      expect(lamp(s).verified).toBe(true);
    }
    const parts = structuredClone(s.parts),
      attempts = lamp(s).attempted;
    s = act(s, 'open-access');
    expect(lamp(s).repaired).toBe(true);
    expect(lamp(s).verified).toBe(false);
    expect(lamp(s).checkStarted).toBeUndefined();
    expect(lamp(s).evidence).not.toContain('checked');
    expect(s.parts).toEqual(parts);
    expect(lamp(s).attempted).toBe(attempts);
    s = act(s, 'reassemble');
    expect(() => act(s, 'check-result')).toThrow('not available');
  }
});
it('open work and retained pieces survive shelving, save and resumption with the same safe object projection', () => {
  let s = act(inspected(), 'shelve');
  const shelf = getView(s).shelf.find((item) => item.id === 'family');
  expect(shelf?.object?.assembly?.retainedPieceIds).toEqual(['lamp-base-cover']);
  expect(JSON.stringify(shelf?.object)).not.toContain('"fault"');
  const raw = serializeGame(s);
  s = restoreGame(raw);
  expect(serializeGame(s)).toBe(raw);
  s = transition(s, { type: 'select', id: 'family' });
  expect(getView(s).focus?.assembly?.state).toBe('open');
  expect(lamp(s).access?.retainedPieceIds).toEqual(['lamp-base-cover']);
});
it('closing a cap does not repair its fault and a bell without its dome cannot pass a functional test', () => {
  const s = inspected(),
    o = lamp(s);
  o.form = 'torch';
  o.fault = 'cap';
  o.access = undefined;
  const torch = act(s, 'inspect');
  const closed = act(torch, 'reassemble');
  expect(lamp(closed).repaired).toBe(false);
  expect(lamp(closed).verified).toBe(false);
  const bell = lamp(inspected());
  bell.form = 'bell';
  bell.fault = 'striker';
  bell.access = undefined;
  // Enter the new physical inspection through the shared host rule.
  const base = inspected();
  base.objects[0] = bell;
  base.focusId = bell.id;
  const opened = act(base, 'inspect');
  const item = lamp(opened);
  applyRepair(item, 'align-striker', opened.parts);
  expect(() => performActiveBellCheck(item, 900, 905)).toThrow('Reassemble');
  reassemble(item, 'player', 900);
  expect(item.verified).toBe(false);
  expect(() => performActiveBellCheck(item, 900, 904)).toThrow('incomplete');
  performActiveBellCheck(item, 900, 905);
  expect(item.verified).toBe(true);
});
it('a native17 inspected prefix remains abstract until a new inspection, preserving its exact history', () => {
  let old = seventeen.createGame(1701);
  for (const id of ['talk-family', 'inspect', 'clean-contact'])
    old = seventeen.transition(old, { type: 'action', id });
  const raw = seventeen.serializeGame(old);
  let current = restoreGame(raw);
  expect(current.engine3Save).toBe(raw);
  expect(lamp(current).access).toBeUndefined();
  expect(getView(current).focus?.assembly).toBeUndefined();
  expect(getView(current).actions.some((a) => a.id === 'verify')).toBe(true);
  current = act(current, 'inspect');
  expect(lamp(current).access?.state).toBe('open');
  expect(current.engine3Save).toBe(raw);
  expect(restoreGame(serializeGame(current))).toEqual(current);
});

it('a disconnected torch is temporarily refitted for diagnosis and removed again, taking the compound ten minutes', () => {
  let s = act(createGame(1701), 'talk-family');
  const item = lamp(s);
  item.form = 'torch';
  item.fault = 'cap';
  s = act(s, 'inspect');
  const before = s.now;
  s = act(s, 'test-battery');
  expect(s.now - before).toBe(10);
  expect(lamp(s).access?.state).toBe('open');
  expect(lamp(s).access?.retainedPieceIds).toEqual(['torch-cap']);
  expect(
    lamp(s)
      .access?.events.slice(-2)
      .map((event) => event.action),
  ).toEqual(['temporary-refit', 'temporary-remove']);
  expect(lamp(s).observations.at(-1)).toContain('temporarily refit');
  expect(lamp(s).observations.at(-1)).toContain('remove the cap again');
  expect(lamp(s).repaired).toBe(false);
  expect(lamp(s).verified).toBe(false);
});
