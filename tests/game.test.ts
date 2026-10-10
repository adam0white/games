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

const act = (s: ReturnType<typeof createGame>, id: string) => {
  let next = transition(s, { type: 'action', id });
  if (id === 'verify') {
    next = transition(next, { type: 'action', id: 'rest' });
    next = transition(next, { type: 'action', id: 'check-result' });
  }
  return next;
};

const finishFocused = (original: ReturnType<typeof createGame>) => {
  let s = act(original, 'inspect');
  if (getView(s).actions.some((a) => a.id === 'test-battery')) s = act(s, 'test-battery');
  const item = s.objects.find((x) => x.id === s.focusId);
  if (!item) throw Error('Missing item');
  const methods: Record<string, string> = {
    battery: 'replace-battery',
    contact: 'clean-contact',
    cap: 'twist-cap',
    holder: 'fit-holder',
    jam: 'clear-obstruction',
    striker: 'align-striker',
    hinge: 'lubricate-hinge',
    spring: 'replace-spring',
  };
  if (item.fault === 'spring') s = act(s, 'search-spring');
  s = act(s, methods[item.fault] ?? 'clean-contact');
  s = act(s, 'verify');
  return act(s, 'return');
};

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
  it('offers repairs from discovered contacts and preserves original object histories', () => {
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
    for (let n = 0; n < 8; n++) {
      while (!getView(s).actions.some((a) => a.id === 'accept-request'))
        s = act(
          s,
          getView(s).actions.some((a) => a.id === 'back-to-school')
            ? 'back-to-school'
            : 'wait-person',
        );
      s = act(s, 'accept-request');
      const item = s.objects.find((x) => x.id === s.focusId);
      if (item) faults.add(item.fault);
      s = finishFocused(s);
    }
    expect(faults.size).toBe(7);
    expect(s.objects.length).toBe(10);
    expect(getView(s).actions.some((a) => a.id === 'accept-request')).toBe(false);
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
    while (!getView(s).actions.some((a) => a.id === 'accept-request'))
      s = act(
        s,
        getView(s).actions.some((a) => a.id === 'back-to-school')
          ? 'back-to-school'
          : 'wait-person',
      );
    s = act(s, 'accept-request');
    const firstId = s.focusId;
    s = act(s, 'inspect');
    s = act(s, 'shelve');
    while (!getView(s).actions.some((a) => a.id === 'accept-request'))
      s = act(
        s,
        getView(s).actions.some((a) => a.id === 'back-to-school')
          ? 'back-to-school'
          : 'wait-person',
      );
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
    s = act(
      s,
      fault === 'battery' ? 'replace-battery' : fault === 'cap' ? 'twist-cap' : 'clean-contact',
    );
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
  it('preserves finite observed faults without equating an owner with one type of fault', () => {
    let s = ['inspect', 'shelve', 'talk-garage', 'talk-friends'].reduce(act, first());
    const owners = new Map<string, Set<string>>();
    for (let n = 0; n < 8; n++) {
      while (!getView(s).actions.some((a) => a.id === 'accept-request'))
        s = act(
          s,
          getView(s).actions.some((a) => a.id === 'back-to-school')
            ? 'back-to-school'
            : 'wait-person',
        );
      s = act(s, 'accept-request');
      const item = s.objects.find((x) => x.id === s.focusId);
      if (!item) throw Error('Missing request');
      const faults = owners.get(item.owner) ?? new Set<string>();
      faults.add(item.fault);
      owners.set(item.owner, faults);
      s = finishFocused(s);
    }
    expect(owners.get('Nora')?.size).toBe(3);
    expect(owners.get('Sam')?.size).toBe(2);
  });
});

describe('living garage checks', () => {
  it('a check takes real elapsed time while tea and shelf work remain possible', () => {
    let s = ['talk-family', 'inspect', 'clean-contact'].reduce(act, createGame(42));
    s = transition(s, { type: 'action', id: 'verify' });
    expect(s.objects[0]?.verified).toBe(false);
    expect(() => transition(s, { type: 'action', id: 'check-result' })).toThrow();
    const start = s.now;
    s = transition(s, { type: 'action', id: 'rest' });
    expect(s.now - start).toBe(30);
    expect(s.objects[0]?.verified).toBe(false);
    expect(getView(s).actions.some((x) => x.id === 'check-result')).toBe(true);
    s = transition(s, { type: 'action', id: 'check-result' });
    expect(s.objects[0]?.verified).toBe(true);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  });
  it('honest premature handover returns for a check, without inventing a new physical fault', () => {
    let s = ['talk-family', 'inspect', 'clean-contact', 'early-return'].reduce(act, createGame(42));
    expect(s.repairs).toBe(0);
    expect(s.objects.find((x) => x.id === 'family')?.location).toBe('returned');
    s = act(s, 'rest');
    const lamp = s.objects.find((x) => x.id === 'family');
    expect(lamp?.location).toBe('shelf');
    expect(lamp?.repaired).toBe(true);
    expect(lamp?.fault).toBe('contact');
    expect(s.conversation.at(-1)?.text).toContain('longer check');
    s = transition(s, { type: 'select', id: 'family' });
    s = act(s, 'verify');
    s = act(s, 'return');
    expect(s.repairs).toBe(1);
    expect(s.objects.filter((x) => x.id === 'personal')).toHaveLength(1);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  });
  it('frozen legacy replay migrates exact existing progress then preserves new inputs', async () => {
    const old = await import('../src/game/legacy-engine');
    let previous = old.createGame(42);
    for (const id of ['talk-family', 'inspect', 'clean-contact', 'verify', 'return', 'inspect'])
      previous = old.transition(previous, { type: 'action', id });
    const text = old.serializeGame(previous);
    let migrated = restoreGame(text);
    expect(migrated.objects).toEqual(previous.objects);
    for (const [id, person] of Object.entries(previous.people)) {
      const after = migrated.people[id];
      if (!after) throw Error('Missing migrated person');
      expect(after.agenda.commitments.slice(0, person.agenda.commitments.length)).toEqual(
        person.agenda.commitments,
      );
      expect({ ...after, engine: person.engine, agenda: person.agenda }).toEqual(person);
    }
    expect(migrated.inputs).toEqual(previous.inputs);
    expect(migrated.journal?.map((x) => x.text)).toEqual(previous.conversation.map((x) => x.text));
    migrated = act(migrated, 'rest');
    expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
  });
});

it('a second honest premature return retains the real callback and permits the owner’s changed choice', () => {
  let s = ['talk-family', 'inspect', 'clean-contact', 'early-return', 'rest'].reduce(
    act,
    createGame(42),
  );
  s = transition(s, { type: 'select', id: 'family' });
  s = act(s, 'early-return');
  expect(s.objects.find((x) => x.id === 'family')?.callbackSeen).toBe(false);
  s = act(s, 'rest');
  expect(s.objects.find((x) => x.id === 'family')?.location).toBe('returned');
  expect(
    s.people.mum?.trace.some((decision) => decision.chosenAffordanceId === 'take-unchecked'),
  ).toBe(true);
  for (let n = 0; n < 10; n++) s = act(s, 'rest');
  expect(s.conversation.some((x) => x.text.includes('Could we do that longer check'))).toBe(false);
  expect(getView(s).journal?.[0]?.text).toContain('little lamp beside my chair');
  expect(
    getView(s).journal?.filter((x) => x.text.includes('Could we do that longer check')),
  ).toHaveLength(1);
  expect(getView(s).journal?.some((x) => x.text.includes('grime on the contact'))).toBe(true);
  const journal = getView(s).journal ?? [];
  expect(new Set(journal.map((x) => x.id)).size).toBe(journal.length);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('the current garage event keeps Dad and You as separate speakers and clears on selection', () => {
  let s = ['inspect', 'shelve'].reduce(act, first());
  expect(getView(s).actions.find((x) => x.id === 'talk-garage')?.label).toBe(
    'Go and look at the garage bench',
  );
  s = act(s, 'talk-garage');
  expect(getView(s).scene).toBe('garage');
  expect(getView(s).currentDialogue?.map((x) => x.speaker)).toEqual(['Dad', 'You']);
  expect(getView(s).currentDialogue?.some((x) => x.text.includes('You:'))).toBe(false);
  s = act(s, 'search-donor');
  expect(getView(s).currentDialogue?.map((x) => x.speaker)).toEqual(['You', 'Dad']);
  expect(getView(s).actions.find((x) => x.id === 'rest')?.label).toContain('garage step');
  s = act(s, 'rest');
  expect(getView(s).scene).toBe('garage');
  expect(getView(s).currentDialogue?.[0]?.text).toContain('garage step');
  s = transition(s, { type: 'select', id: 'personal' });
  expect(getView(s).currentDialogue).toEqual([]);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('a torch’s wrong flat-contact repair responds to the completed battery test with an available next step', () => {
  let s = ['inspect', 'shelve', 'talk-garage', 'talk-friends'].reduce(act, first());
  for (let n = 0; n < 12; n++) {
    while (!getView(s).actions.some((a) => a.id === 'accept-request'))
      s = act(
        s,
        getView(s).actions.some((a) => a.id === 'back-to-school')
          ? 'back-to-school'
          : 'wait-person',
      );
    s = act(s, 'accept-request');
    s = act(s, 'inspect');
    s = act(s, 'test-battery');
    const item = s.objects.find((x) => x.id === s.focusId);
    if (item?.fault === 'cap') {
      s = act(s, 'clean-contact');
      expect(getView(s).currentDialogue?.at(-1)?.text).toContain('threaded cap');
      expect(getView(s).currentDialogue?.at(-1)?.text).not.toContain('Testing the battery');
      expect(getView(s).actions.some((x) => x.id === 'twist-cap')).toBe(true);
      expect(getView(s).actions.some((x) => x.id === 'test-battery')).toBe(false);
      expect(restoreGame(serializeGame(s))).toEqual(s);
      return;
    }
    s = act(s, item?.fault === 'battery' ? 'replace-battery' : 'clean-contact');
    s = act(s, 'verify');
    s = act(s, 'return');
  }
  throw Error('Expected seeded torch cap case');
});

it('an empty bench drops task-specific human wording without changing saved state', () => {
  const s = createGame(42);
  s.humanNote =
    'Mum has had some company and chooses her own chapter. The check can continue without her.';
  const saved = serializeGame(s);
  expect(getView(s).humanNote).toBe('Mum has had some company and chooses her own chapter.');
  expect(serializeGame(s)).toBe(saved);
});

it('validates an interim engine3 save using its original failure prose and corrects only future inputs', () => {
  let previous = createGame(42);
  previous.feedbackRevisionFrom = 20000;
  previous = [
    'talk-family',
    'inspect',
    'clean-contact',
    'verify',
    'rest',
    'check-result',
    'return',
    'inspect',
    'shelve',
    'talk-garage',
    'talk-friends',
  ].reduce((s, id) => transition(s, { type: 'action', id }), previous);
  for (let n = 0; n < 12; n++) {
    while (!getView(previous).actions.some((a) => a.id === 'accept-request'))
      previous = act(previous, 'wait-person');
    previous = act(previous, 'accept-request');
    previous = act(previous, 'inspect');
    previous = act(previous, 'test-battery');
    const item = previous.objects.find((x) => x.id === previous.focusId);
    if (item?.fault === 'cap') {
      previous = act(previous, 'clean-contact');
      expect(
        previous.objects.find((x) => x.id === previous.focusId)?.observations.at(-1),
      ).toContain('Testing the battery');
      const packet = JSON.parse(serializeGame(previous));
      delete packet.state.feedbackRevisionFrom;
      const oldSave = JSON.stringify(packet);
      let migrated = restoreGame(oldSave);
      for (const [id, person] of Object.entries(previous.people))
        expect({ ...migrated.people[id], engine: person.engine }).toEqual(person);
      expect(migrated.objects).toEqual(previous.objects);
      expect(migrated.inputs).toEqual(previous.inputs);
      expect(migrated.feedbackRevisionFrom).toBe(previous.inputs.length);
      migrated = act(migrated, 'clean-contact');
      expect(getView(migrated).currentDialogue?.at(-1)?.text).toContain('threaded cap');
      expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
      const invalid = JSON.parse(serializeGame(migrated));
      invalid.state.feedbackRevisionFrom = migrated.inputs.length + 1;
      expect(() => restoreGame(JSON.stringify(invalid))).toThrow('Invalid feedback revision');
      return;
    }
    previous = act(previous, item?.fault === 'battery' ? 'replace-battery' : 'clean-contact');
    previous = act(previous, 'verify');
    previous = act(previous, 'return');
  }
  throw Error('Expected seeded cap case');
});
