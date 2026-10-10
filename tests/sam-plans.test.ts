import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as nine from '../src/game/engine9';
import * as eleven from '../src/game/engine11';
import type { GameInput, GameState } from '../src/game/types';
import golden from './fixtures/published-eleven-route.json';
import unmet from './fixtures/published-eleven-unmet-sam-route.json';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function oldPublic() {
  let s = nine.createGame(golden.seed);
  for (const input of golden.inputs.slice(0, golden.baseCount))
    s = nine.transition(s, input as GameInput);
  s = eleven.restoreGame(nine.serializeGame(s));
  for (const input of golden.inputs.slice(golden.baseCount))
    s = eleven.transition(s, input as GameInput);
  return s;
}
it('pins the real public eleven export and leaves its stalled nine history and actors intact', () => {
  const old = oldPublic();
  const raw = eleven.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(golden.sha256);
  let s = restoreGame(raw);
  expect(s.people).toEqual(old.people);
  expect(s.journal).toEqual(old.journal);
  expect(s.objects).toEqual(old.objects);
  expect(s.engine3Save).toBe(raw);
  expect(s.samPlans).toBeUndefined();
  s = choose(s, 'rest');
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('keeps a genuinely postponed invitation open and advances everyone to the received return cue', () => {
  // Use the actual published pre-invitation clock and actor history for this first-attempt refusal control.
  let prior = nine.createGame(golden.seed);
  for (const input of golden.inputs.slice(0, golden.baseCount)) {
    if (input.id === 'observer-invite') break;
    prior = nine.transition(prior, input as GameInput);
  }
  let s = restoreGame(nine.serializeGame(prior));
  s = choose(s, 'observer-invite');
  expect(s.samPlans?.invitation).toBe('pending');
  const until = s.samPlans?.availableAfter;
  expect(until).toBeGreaterThan(s.now);
  expect(has(s, 'resume-observer-invite')).toBe(false);
  const before = JSON.stringify(s.people);
  getView(s);
  getView(s);
  expect(JSON.stringify(s.people)).toBe(before);
  s = choose(s, 'wait-appointment');
  expect(s.now).toBe(until);
  expect(Object.values(s.people).every((p) => p.now === s.now)).toBe(true);
  expect(s.samPlans?.invitation).toBe('pending');
  expect(has(s, 'resume-observer-invite')).toBe(true);
  s = choose(s, 'resume-observer-invite');
  expect(
    s.people.sam?.trace.at(-1)?.considered.some((c) => c.affordanceId === 'watch-repair'),
  ).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('does not disclose an unspoken internal shift agenda as a received plan', () => {
  let s = earnedHandoff();
  s = choose(s, 'service-begin');
  const sam = s.people.sam;
  expect(sam).toBeTruthy();
  const shift = sam?.agenda.commitments.find((c) => c.actions.includes('parts-counter'));
  expect(shift).toBeTruthy();
  if (!shift) throw Error('Missing actual shift');
  // Matched snapshots: the actual agreement is unchanged; only its receipt is withheld.
  const known = structuredClone(s);
  known.now = shift.from;
  const withheld = structuredClone(known);
  withheld.unlocked = withheld.unlocked.filter((f) => !f.startsWith('heard-counter:'));
  expect(getView(known).knownAppointments?.some((a) => a.detail.includes('shift ends'))).toBe(true);
  expect(getView(withheld).knownAppointments?.some((a) => a.detail.includes('shift ends'))).toBe(
    false,
  );
});
it('a supported whole service repair completes while the player uses the personal bench, without watching', () => {
  let s = earnedHandoff();
  const reach = (id: string) => {
    for (let n = 0; n < 120 && !has(s, id); n++)
      s = choose(
        s,
        has(s, 'wait-appointment')
          ? 'wait-appointment'
          : has(s, 'wait-person')
            ? 'wait-person'
            : 'rest',
      );
    expect(has(s, id), `Actual opportunity ${id}`).toBe(true);
  };
  s = choose(s, 'service-begin');
  s = choose(s, 'service-favours');
  s = choose(s, 'service-find-model');
  reach('service-hear-leila');
  s = choose(s, 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  for (let n = 0; n < 100 && !has(s, 'delegate-repair'); n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : 'rest',
    );
  s = choose(s, 'delegate-repair');
  const marker = s.inputs.length;
  s = transition(s, { type: 'select', id: 'paper-street' });
  s = choose(s, 'inspect');
  expect(s.objects.find((o) => o.id === 'paper-street')?.inspected).toBe(true);
  for (let n = 0; n < 100 && s.apprentice?.jobId; n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : 'rest',
    );
  const repaired = s.objects.find((o) => o.id === 'service-leila');
  expect(repaired?.location).toBe('returned');
  expect(repaired?.verified).toBe(true);
  expect(repaired?.independent).toBe(true);
  expect(s.inputs.slice(marker).some((i) => i.input.id === 'watch-sam')).toBe(false);
  expect(s.objects.find((o) => o.id === 'paper-street')?.verified).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('unmet Sam’s routine remains real but is not announced to the player; acquaintance changes only received narration', () => {
  let old = eleven.createGame(unmet.seed);
  for (const input of unmet.inputs) old = eleven.transition(old, input as GameInput);
  const raw = eleven.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(unmet.sha256);
  expect(old.unlocked).not.toContain('met:sam');
  let unaware = restoreGame(raw),
    known = structuredClone(unaware);
  known.unlocked.push('met:sam');
  let heard = false;
  for (let n = 0; n < 70 && !heard; n++) {
    const mark = known.nextLineId ?? 0;
    unaware = choose(unaware, 'rest');
    known = choose(known, 'rest');
    for (const [id, person] of Object.entries(unaware.people)) {
      expect(person.now).toBe(known.people[id]?.now);
      if (id !== 'player') expect(person).toEqual(known.people[id]);
    }
    expect(unaware.people.player?.body).toEqual(known.people.player?.body);
    expect(unaware.now).toBe(known.now);
    expect(
      unaware.journal
        ?.filter((l) => l.id >= mark)
        .some((l) => l.text.includes('Sam') && l.text.includes('dog')),
    ).toBe(false);
    heard = !!known.journal
      ?.filter((l) => l.id >= mark)
      .some((l) => l.text.includes('Sam') && l.text.includes('dog'));
  }
  expect(heard).toBe(true);
  expect(restoreGame(serializeGame(unaware))).toEqual(unaware);
}, 20_000);
