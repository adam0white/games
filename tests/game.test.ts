import { skillLevel } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  createGame,
  exportPlaytest,
  getView,
  replayPlaytest,
  restoreGame,
  serializeGame,
  transition,
} from '../src/game/engine';

const act = (s: ReturnType<typeof createGame>, id: string) => transition(s, { type: 'action', id });
const first = () =>
  ['talk-family', 'inspect', 'test-battery', 'clean-contact', 'verify', 'return'].reduce(
    act,
    createGame(42),
  );
describe('home and garage', () => {
  it('discloses only known objects and rejects invisible controls', () => {
    const s = createGame(42);
    expect(getView(s).focus).toBeNull();
    expect(() => act(s, 'search-donor')).toThrow();
    expect(() => transition(s, { type: 'select', id: 'personal' })).toThrow();
    expect(getView(s).actions.map((x) => x.id)).toEqual(['talk-family']);
  });
  it('wrong repair teaches a reason without rerolling the held fault', () => {
    let s = act(createGame(42), 'talk-family');
    s = act(s, 'inspect');
    const fault = s.objects[0]?.fault;
    s = act(s, 'replace-battery');
    expect(s.objects[0]?.repaired).toBe(false);
    expect(s.objects[0]?.observations.join(' ')).toContain('still flickers');
    expect(s.objects[0]?.fault).toBe(fault);
    expect(() => act(s, 'return')).toThrow();
    s = act(s, 'clean-contact');
    s = act(s, 'verify');
    expect(getView(s).focus?.visual).toBe('steady');
  });
  it('preserves shelf work, recovers only one holder, resumes and consumes it once', () => {
    let s = first();
    s = act(s, 'inspect');
    s = act(s, 'shelve');
    const saved = restoreGame(serializeGame(s));
    expect(saved).toEqual(s);
    s = act(s, 'talk-garage');
    s = act(s, 'search-donor');
    expect(s.parts.holders).toBe(1);
    expect(() => act(s, 'search-donor')).toThrow();
    s = transition(s, { type: 'select', id: 'personal' });
    s = act(s, 'fit-holder');
    expect(s.parts.holders).toBe(0);
    expect(() => act(s, 'fit-holder')).toThrow();
    s = act(s, 'verify');
    s = act(s, 'return');
    expect(s.repairs).toBe(2);
  });
  it('HF changes real skill, body, perceptions and snapshots, replay is exact', () => {
    const start = createGame(42);
    const s = first();
    const player = s.people.player;
    const before = start.people.player;
    if (!player || !before) throw Error('Missing player');
    expect(skillLevel(player, 'repair')).toBeGreaterThan(skillLevel(before, 'repair'));
    expect(s.people.player?.now).toBe(s.now);
    expect(s.people.player?.memory).not.toEqual(start.people.player?.memory);
    expect(replayPlaytest(exportPlaytest(s))).toEqual(s);
  });
  it('offers repeatable repairs only from discovered contacts and bounds retained work', () => {
    let s = first();
    s = act(s, 'inspect');
    s = act(s, 'talk-garage');
    s = act(s, 'search-donor');
    s = act(s, 'fit-holder');
    s = act(s, 'verify');
    s = act(s, 'return');
    expect(() => act(s, 'accept-request')).toThrow();
    s = act(s, 'talk-friends');
    const faults = new Set<string>();
    for (let n = 0; n < 12; n++) {
      s = act(s, 'accept-request');
      s = act(s, 'inspect');
      s = act(s, 'test-battery');
      const fault = s.objects.find((x) => x.id === s.focusId)?.fault;
      if (!fault) throw Error('Missing request');
      faults.add(fault);
      s = act(s, fault === 'battery' ? 'replace-battery' : 'clean-contact');
      s = act(s, 'verify');
      s = act(s, 'return');
    }
    expect(faults.size).toBe(2);
    expect(s.objects.length).toBe(3);
    expect(s.conversation.length).toBeLessThanOrEqual(8);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  });
  it('rejects malformed saves and crafted state, and retains the original on invalid inputs', () => {
    const s = first();
    const copy = JSON.stringify(s);
    expect(() => act(s, 'enterprise')).toThrow();
    expect(JSON.stringify(s)).toBe(copy);
    for (const text of [
      'null',
      '{}',
      '[]',
      '{"schema":1}',
      serializeGame(s).replace('"holders":0', '"holders":99'),
    ])
      expect(() => restoreGame(text)).toThrow();
  });
  it('allows friend work while the personal lamp waits, and a second shelved request', () => {
    let s = ['inspect', 'shelve', 'talk-garage', 'talk-friends'].reduce(act, first());
    s = act(s, 'accept-request');
    const firstId = s.focusId;
    s = act(s, 'inspect');
    s = act(s, 'shelve');
    s = act(s, 'accept-request');
    expect(s.focusId).not.toBe(firstId);
    const secondId = s.focusId;
    if (!firstId || !secondId) throw Error('Missing requests');
    s = transition(s, { type: 'select', id: firstId });
    expect(s.objects.find((x) => x.id === secondId)?.location).toBe('shelf');
    s = transition(s, { type: 'select', id: secondId });
    expect(getView(s).shelf.map((x) => x.id)).toEqual(['personal', firstId]);
    expect(() => act(s, 'accept-request')).toThrow();
    s = act(s, 'inspect');
    s = act(s, 'test-battery');
    const fault = s.objects.find((x) => x.id === s.focusId)?.fault;
    s = act(s, fault === 'battery' ? 'replace-battery' : 'clean-contact');
    s = act(s, 'verify');
    s = act(s, 'return');
    expect(s.objects.find((x) => x.id === 'personal')?.location).toBe('shelf');
    expect(s.objects.find((x) => x.id === firstId)?.location).toBe('shelf');
    expect(restoreGame(serializeGame(s))).toEqual(s);
  });
  it('removes a consumed recovered part from the visible tray', () => {
    const s = ['inspect', 'talk-garage', 'search-donor', 'fit-holder'].reduce(act, first());
    expect(getView(s).parts).toEqual([]);
  });
  it('holds seeded request faults but does not equate an owner with a fault', () => {
    let s = ['inspect', 'shelve', 'talk-garage', 'talk-friends'].reduce(act, first());
    const owners = new Map<string, Set<string>>();
    for (let n = 0; n < 24; n++) {
      s = act(s, 'accept-request');
      const item = s.objects.find((x) => x.id === s.focusId);
      if (!item) throw Error('Missing request');
      const faults = owners.get(item.owner) ?? new Set<string>();
      faults.add(item.fault);
      owners.set(item.owner, faults);
      s = act(s, 'inspect');
      s = act(s, 'test-battery');
      s = act(s, item.fault === 'battery' ? 'replace-battery' : 'clean-contact');
      s = act(s, 'verify');
      s = act(s, 'return');
    }
    expect([...owners.values()].map((x) => x.size)).toEqual([2, 2]);
  });
});
