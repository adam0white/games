import { begin, createPerson, decide } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  createGame,
  exportPlaytest,
  replayPlaytest,
  restoreGame,
  serializeGame,
  transition,
} from '../src/game/engine';
import type { GameState } from '../src/game/types';

// Matched actor snapshots isolate host reporting; decisions themselves use released HF.
function ready() {
  const s = transition(createGame(42), { type: 'action', id: 'talk-family' });
  for (const id of ['player', 'mum'])
    s.people[id] = createPerson({
      id,
      name: id,
      seed: 42,
      now: s.now,
      bornAt: -30 * 365 * 1440,
      sex: 'female',
      relationships: [{ otherId: id === 'mum' ? 'player' : 'mum', roles: ['family'] }],
    });
  return s;
}
function response(s: GameState) {
  const count = s.journal?.length ?? 0;
  const next = transition(s, { type: 'action', id: 'rest' });
  const lines = next.journal?.slice(count) ?? [];
  expect(lines).toHaveLength(1);
  expect(next.now - s.now).toBe(30);
  for (const person of Object.values(next.people)) expect(person.now).toBe(next.now);
  return { next, line: lines[0] };
}
for (const participant of ['player', 'mum'] as const)
  it(`host reports ${participant} refusal without Mum speech or whole shared time`, () => {
    const s = ready();
    const person = s.people[participant];
    if (!person) throw Error('Missing participant');
    const offer = {
      id: 'own-plan',
      action: 'rest',
      label: 'Keep resting',
      duration: 120,
      effort: 0,
      advertises: { leisure: 0.9, autonomy: 0.9 },
    };
    begin(person, offer, decide(person, [offer]));
    const { line, next } = response(s);
    expect(line?.speaker).toBe('You');
    expect(line?.text).toContain(
      participant === 'player' ? 'You leave the invitation' : 'Mum keeps her own plans',
    );
    expect(line?.text).toContain('“Keep resting” underway when you asked.');
    expect(line?.text).not.toContain('It’s nice');
    expect(next.humanNote).toBe('You took a quiet break.');
  });
it('shortened actual HF company reports elapsed time once and keeps all clocks', () => {
  const s = ready();
  const mum = s.people.mum;
  if (!mum) throw Error('Missing Mum');
  mum.body.health = 0.002;
  mum.body.hydration = 0;
  mum.body.satiety = 0;
  const { next, line } = response(s);
  expect(line?.speaker).toBe('You');
  const elapsed = Number(line?.text.match(/together for (\d+) minutes/)?.[1]);
  expect(elapsed).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(30);
  expect(line?.text).not.toContain('It’s nice');
  expect(next.humanNote).toContain(`for ${elapsed} minutes`);
});
it('joined company remembers a genuinely collected verified lamp but no mechanical timer', () => {
  for (const form of ['lamp', 'timer'] as const) {
    const s = ready();
    const item = s.objects[0];
    if (!item) throw Error('Missing object');
    Object.assign(item, { form, verified: true, location: 'returned', awaitingCollection: false });
    const { next, line } = response(s);
    expect(line?.speaker).toBe('Mum');
    expect(line?.text).toContain('It’s nice having you here.');
    expect(line?.text.includes('I used the lamp you brought back.')).toBe(form === 'lamp');
    expect(next.humanNote).toBe('You spent some time together over tea.');
  }
});
it('native host tea continuation replays and restores its actual input history', () => {
  let s = createGame(42);
  for (const id of ['talk-family', 'rest', 'rest', 'rest'])
    s = transition(s, { type: 'action', id });
  expect(restoreGame(serializeGame(s))).toEqual(s);
  expect(replayPlaytest(exportPlaytest(s))).toEqual(s);
});
