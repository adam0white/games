import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshServiceWeek } from '../src/game/service-week';
import type { GameState } from '../src/game/types';
import { freshWorkshop } from '../src/game/workshop';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function fixture() {
  const s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.serviceWeek = {
    ...freshServiceWeek(),
    startedAt: s.now,
    route: 'private',
    personalSession: 'protected',
    personalAt: s.now,
  };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  s.objects.push({
    id: 'paper-street',
    title: 'Your model',
    owner: 'You',
    story: 'Retained',
    form: 'timer',
    fault: 'gear',
    location: 'shelf',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
  });
  return s;
}
function committed(s: GameState, id = 'player') {
  const p = s.people[id];
  if (!p) throw Error('Missing actor');
  const c = promise(p, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
    label: 'Keep the promised check-in',
  });
  const a: Affordance = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'The promised check-in',
    duration: 60,
    effort: 0,
    advertises: { belonging: 0.3 },
    fulfills: [c.id],
  };
  begin(p, a, decide(p, [a]));
}
it.each(['service-personal-session', 'service-checking-place'])(
  '%s does not change work or money when the player keeps a stronger activity',
  (id) => {
    const s = fixture();
    expect(getView(s).actions.some((a) => a.id === id)).toBe(true);
    committed(s);
    const next = act(s, id);
    expect(next.now).toBe(s.now);
    expect(next.serviceWeek).toEqual(s.serviceWeek);
    expect(next.workshop).toEqual(s.workshop);
    expect(next.people.player?.activity).toEqual(s.people.player?.activity);
  },
);
it('a personal session completes only after its full remaining interval', () => {
  const s = fixture();
  const next = act(s, 'service-personal-session');
  expect(next.now).toBe(s.now + 45);
  expect(next.serviceWeek?.personalSession).toBe('spent');
  expect(next.serviceWeek?.personalMinutes).toBe(45);
});
it('a newly due appointment interrupts the session without recording it spent', () => {
  const s = fixture();
  const p = s.people.player;
  if (!p) throw Error('Missing player');
  promise(p, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now + 8,
    until: s.now + 15,
    importance: 1,
    label: 'Received check-in',
  });
  const next = act(s, 'service-personal-session');
  expect(next.now).toBeGreaterThan(s.now);
  expect(next.now).toBeLessThan(s.now + 45);
  expect(next.serviceWeek?.personalSession).toBe('protected');
});

it('Dad can withhold the checking-place arrangement without spending cash, while the matched available path buys one tray', () => {
  const s = fixture();
  const yes = act(s, 'service-checking-place');
  expect(yes.workshop?.cash).toBe(200);
  expect(yes.checkingPlaces).toBe(2);
  committed(s, 'dad');
  const no = act(s, 'service-checking-place');
  expect(no.now).toBe(s.now);
  expect(no.workshop).toEqual(s.workshop);
  expect(no.checkingPlaces).toBe(s.checkingPlaces);
  expect(no.people.dad?.activity).toEqual(s.people.dad?.activity);
});

it('an owner can withhold acceptance without transferring the lamp or supplied cell', () => {
  let s = fixture();
  if (!s.serviceWeek) throw Error('Missing service week');
  s.serviceWeek.route = 'undecided';
  s = act(s, 'service-regular');
  for (let n = 0; n < 8 && !getView(s).actions.some((a) => a.id === 'service-hear-leila'); n++)
    s = act(s, 'rest');
  s = act(s, 'service-hear-leila');
  const yes = act(s, 'service-accept-leila');
  expect(yes.objects.some((o) => o.id === 'service-leila')).toBe(true);
  committed(s, 'leila');
  const no = act(s, 'service-accept-leila');
  expect(no.now).toBe(s.now);
  expect(no.objects).toEqual(s.objects);
  expect(no.parts).toEqual(s.parts);
  expect(no.serviceWeek).toEqual(s.serviceWeek);
  expect(no.people.leila?.activity).toEqual(s.people.leila?.activity);
});
