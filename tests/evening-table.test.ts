import { createHash } from 'node:crypto';
import { begin, createPerson, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import { freshOperations } from '../src/game/operations';
import { freshPersonalProject } from '../src/game/personal-project';
import { leaveReady } from '../src/game/ready-collection';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';
import { completePublicAction } from './support/public-attendance';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function fixture(checked = false) {
  const s = createGame(77);
  s.chapter = 'garage';
  s.objects.push({
    id: 'paper-street',
    title: 'Your paper street',
    owner: 'You',
    story: 'Retained childhood work',
    form: 'box',
    appearance: 'model',
    fault: 'gear',
    location: 'shelf',
    observations: [],
    inspected: true,
    tested: true,
    attempted: 0,
    repaired: checked,
    verified: checked,
    discovered: true,
  });
  return s;
}
const complete = (s: GameState, id: string) =>
  completePublicAction(
    s,
    id,
    (next) => next.eveningTable?.lastAction === id && next.eveningTable.lastAt > s.now,
  );
it('the still scene uses fixed room light without granting a lamp, repair or absent company; safe exit restores exact origin', () => {
  let s = complete(fixture(), 'evening-bring-model');
  expect(s.objects.find((o) => o.id === 'paper-street')?.location).toBe('home-table');
  expect(getView(s).eveningTable?.light).toBe('room');
  expect(getView(s).eveningTable?.mumPresent).toBe(false);
  expect(has(s, 'evening-run-circuit')).toBe(false);
  expect(() => transition(s, { type: 'select', id: 'paper-street' })).toThrow('Unknown object');
  s = complete(s, 'evening-model-front');
  s = complete(s, 'evening-turn-angled');
  expect(getView(s).eveningTable?.modelPosition).toBe('front');
  expect(getView(s).eveningTable?.modelAngle).toBe('angled');
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  const meal = {
    id: 'meal-control',
    action: 'eat',
    label: 'Finish eating',
    duration: 30,
    effort: 0,
    advertises: { food: 1 },
  };
  begin(player, meal, decide(player, [meal]));
  s = act(s, 'evening-put-away');
  expect(s.eveningTable?.stage).toBe('finished');
  expect(s.objects.find((o) => o.id === 'paper-street')?.location).toBe('shelf');
  expect(s.objects.find((o) => o.id === 'paper-street')?.repaired).toBe(false);
  expect(s.people.player?.activity?.affordanceId).toBe('meal-control');
});
it('loaned and window-held property cannot be retrieved, and an unchecked own lamp is never a light source', () => {
  const s = fixture();
  const first = s.objects[0];
  if (!first) throw Error('Missing household object');
  s.objects.push({
    ...first,
    id: 'personal',
    owner: 'You',
    form: 'lamp',
    location: 'returned',
    verified: false,
    repaired: false,
  });
  const model = s.objects.find((o) => o.id === 'paper-street');
  if (!model) throw Error('Missing model');
  model.location = 'saturday-window';
  expect(has(s, 'evening-bring-model')).toBe(false);
  model.location = 'shelf';
  s.operations = freshOperations(s.now);
  s.operations.personalProject = freshPersonalProject(false);
  s.operations.personalProject.custody = 'nora';
  expect(has(s, 'evening-bring-model')).toBe(false);
  s.operations.personalProject.custody = 'player';
  const table = complete(s, 'evening-bring-model');
  expect(has(table, 'evening-bring-lamp')).toBe(false);
  expect(getView(table).eveningTable?.light).toBe('room');
});
it('a newly due player duty prevents retrieval and preserves actual object custody', () => {
  const s = fixture();
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  promise(player, {
    kind: 'appointment',
    toId: 'dad',
    actions: ['own-duty'],
    from: s.now + 1,
    until: s.now + 3,
    importance: 1,
    label: 'Keep the promised check-in',
  });
  const next = act(s, 'evening-bring-model');
  expect(next.objects.find((o) => o.id === 'paper-street')?.location).toBe('shelf');
  expect(next.eveningTable).toBeUndefined();
});
it('packaging discovery records evidence without inventing Mum’s audience or explanation', () => {
  let s = complete(fixture(), 'evening-bring-model');
  if (!s.world) throw Error('Missing world');
  s.world.presence.mum = { awayUntil: s.now + 60, activity: 'Own plans' };
  const before = s.conversation.length;
  s = complete(s, 'evening-look-under');
  expect(
    s.objects
      .find((o) => o.id === 'paper-street')
      ?.observations.some((x) => x.includes('TUESDAY / THURSDAY')),
  ).toBe(true);
  expect(s.conversation.slice(before).some((l) => l.speaker === 'Mum')).toBe(false);
  expect(has(s, 'evening-ask-print')).toBe(false);
});
it('only actual retained inserts can be swapped; an unchecked arrangement cannot produce a circuit receipt', () => {
  let s = fixture(true);
  s.operations = freshOperations(s.now);
  s.operations.personalProject = freshPersonalProject(true);
  s.operations.personalProject.insert = 'retained';
  s = complete(s, 'evening-bring-model');
  s = complete(s, 'evening-current');
  expect(s.operations?.personalProject?.fitted).toBe('updated');
  expect(has(s, 'evening-run-circuit')).toBe(false);
  expect(getView(s).eveningTable?.circuitReceiptId).toBeUndefined();
  s = complete(s, 'evening-check-circuit');
  expect(s.operations?.personalProject?.checkedEdition).toBe('updated');
  expect(getView(s).eveningTable?.circuitReceiptId).toBeUndefined();
  s = complete(s, 'evening-run-circuit');
  expect(getView(s).eveningTable?.circuitReceiptId).toBe(`evening-circuit:${s.now}`);
  expect(s.objects.find((o) => o.id === 'paper-street')?.location).toBe('home-table');
});
it('actual exhausted owner can use the personal scene and restore the same objects without business progression', {
  timeout: 30000,
}, () => {
  let old = eighteen.createGame(owner.seed);
  for (const entry of owner.inputs) old = eighteen.transition(old, entry.input as GameInput);
  const raw = eighteen.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(owner.sha256);
  let s = restoreGame(raw);
  if (!s.objects.some((o) => o.id === 'paper-street'))
    s = completePublicAction(s, 'find-paper-street', (next) =>
      next.objects.some((o) => o.id === 'paper-street'),
    );
  const origins = s.objects.map((o) => [o.id, o.location]);
  s = complete(s, 'evening-bring-model');
  if (has(s, 'evening-bring-lamp')) s = complete(s, 'evening-bring-lamp');
  s = complete(s, 'evening-model-front');
  s = complete(s, 'evening-keep-wall');
  s = act(s, 'evening-put-away');
  expect(s.objects.map((o) => [o.id, o.location])).toEqual(origins);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('Mum’s stronger actual obligation withholds her scene words, while solo positioning remains available', () => {
  let s = complete(fixture(), 'evening-bring-model');
  for (let n = 0; n < 20 && !has(s, 'evening-show-mum'); n++) s = act(s, 'rest');
  expect(has(s, 'evening-show-mum')).toBe(true);
  const mum = s.people.mum;
  if (!mum) throw Error('Missing Mum');
  promise(mum, {
    kind: 'appointment',
    toId: 'nora',
    actions: ['visit-nora'],
    from: s.now,
    until: s.now + 10,
    importance: 1,
    label: 'Keep the promised call with Nora',
  });
  const before = s.conversation.length;
  s = act(s, 'evening-show-mum');
  expect(s.eveningTable?.mumJoinedAt).toBeUndefined();
  expect(
    s.conversation
      .slice(before)
      .some((l) => l.speaker === 'Mum' && l.text.includes('little houses')),
  ).toBe(false);
  expect(has(s, 'evening-model-front')).toBe(true);
  expect(has(s, 'evening-put-away')).toBe(true);
});
it('completed arranging advances ordinary actor time and an actual shared scene is not a permanent audience', () => {
  let s = complete(fixture(), 'evening-bring-model');
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
  s = complete(s, 'evening-show-mum');
  expect(s.eveningTable?.mumJoinedAt).toBeDefined();
  s = complete(s, 'evening-model-front');
  expect(getView(s).eveningTable?.mumPresent).toBe(false);
});

it('a labelled Mum object cannot take the clock from her actual table conversation; pickup stays possible afterward', () => {
  let s = complete(fixture(), 'evening-bring-model');
  s.people.mum = createPerson({
    id: 'mum',
    name: 'Mum',
    sex: 'female',
    seed: 77,
    now: s.now,
    bornAt: -40 * 365 * 1440,
    needs: { belonging: 0.1, autonomy: 0.1 },
  });
  const model = s.objects.find((o) => o.id === 'paper-street');
  if (!model) throw Error('Missing model');
  const item = {
    ...model,
    id: 'mum-ready',
    title: 'Mum’s checked lamp',
    owner: 'Mum',
    form: 'lamp' as const,
    appearance: 'reading' as const,
    repaired: true,
    verified: true,
  };
  s.objects.push(item);
  leaveReady(s, item);
  s = act(s, 'evening-show-mum');
  expect(s.eveningTable?.mumJoinedAt).toBe(s.now);
  expect(s.objects.find((o) => o.id === 'mum-ready')?.awaitingCollection).toBe(true);
  expect(s.people.mum?.chronicleDay?.actions.some((a) => a.action === 'talk')).toBe(true);
  for (let n = 0; n < 20 && s.objects.find((o) => o.id === 'mum-ready')?.awaitingCollection; n++)
    s = act(s, 'rest');
  expect(s.objects.find((o) => o.id === 'mum-ready')?.location).toBe('returned');
});
it('reopening resets current company and preference; moving made current fronts offers a new choice without old-roof claims', () => {
  let s = fixture(true);
  s.operations = freshOperations(s.now);
  s.operations.personalProject = freshPersonalProject(true);
  s.operations.personalProject.insert = 'retained';
  s = complete(s, 'evening-bring-model');
  s = complete(s, 'evening-current');
  s = complete(s, 'evening-look-under');
  s = complete(s, 'evening-show-mum');
  s = complete(s, 'evening-keep-wall');
  s = complete(s, 'evening-model-back');
  expect(s.eveningTable?.chosenArrangement).toBeUndefined();
  expect(has(s, 'evening-keep-wall')).toBe(true);
  const before = s.conversation.length;
  s = complete(s, 'evening-model-front');
  s = complete(s, 'evening-keep-wall');
  expect(s.conversation.slice(before).some((l) => /crooked|old uneven/.test(l.text))).toBe(false);
  s = act(s, 'evening-put-away');
  s = complete(s, 'evening-bring-model');
  expect(s.eveningTable?.mumJoinedAt).toBeUndefined();
  expect(s.eveningTable?.chosenArrangement).toBeUndefined();
  expect(s.eveningTable?.packagingRevealed).toBe(true);
  expect(has(s, 'evening-look-under')).toBe(false);
  expect(getView(s).eveningTable?.model?.frontage).toBe('current');
});
