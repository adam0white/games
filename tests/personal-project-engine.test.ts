import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshServiceWeek } from '../src/game/service-week';
import type { GameState } from '../src/game/types';
import { freshWorkshop } from '../src/game/workshop';

/** A headless restored-model fixture isolates the new social/physical controls.
 * It does not stand in for repairing this drive or an owner playthrough. */
function fixture() {
  const s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.serviceWeek = { ...freshServiceWeek(), conclusion: 'small' };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  s.objects.push({
    id: 'paper-street',
    title: 'Your retained paper street',
    owner: 'You',
    story: 'Previously restored model',
    form: 'box',
    appearance: 'model',
    fault: 'gear',
    location: 'shelf',
    observations: ['An earlier full drive circuit was completed.'],
    inspected: true,
    tested: true,
    attempted: 1,
    repaired: true,
    verified: true,
    discovered: true,
    completedBy: 'player',
  });
  return s;
}
const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function attend(s: GameState, id: string, finished: (s: GameState) => boolean) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (getView(s).actions.some((a) => a.id === id)) s = act(s, id);
    if (finished(s)) return s;
    s = act(s, 'rest');
  }
  throw Error(`Could not complete ${id} through actual offered actions`);
}
function offeredOccasion() {
  let s = fixture();
  s = attend(s, 'operations-begin', (s) => !!s.operations);
  s = attend(s, 'operations-route-private', (s) => s.operations?.route === 'private');
  s = attend(s, 'operations-personal-open', (s) => !!s.operations?.personalProject);
  s = attend(s, 'operations-personal-measure', (s) => !!s.operations?.personalProject?.measured);
  s = attend(
    s,
    'operations-personal-make-insert',
    (s) => s.operations?.personalProject?.insert === 'retained',
  );
  s = attend(
    s,
    'operations-personal-fit-updated',
    (s) => s.operations?.personalProject?.fitted === 'updated',
  );
  s = attend(
    s,
    'operations-personal-check-circuit',
    (s) => !!s.operations?.personalProject?.circuitChecked,
  );
  s = attend(
    s,
    'operations-personal-keep-edition',
    (s) => !!s.operations?.personalProject?.editionKept,
  );
  s = attend(
    s,
    'operations-close-private-period',
    (s) => !!s.operations?.completedRounds.includes(1),
  );
  s = attend(s, 'operations-next-period', (s) => s.operations?.episode === 2);
  s = attend(s, 'operations-route-private', (s) => s.operations?.route === 'private');
  s = attend(
    s,
    'operations-personal-invite-nora',
    (s) => s.operations?.personalProject?.occasion === 'invited',
  );
  s = attend(
    s,
    'operations-personal-hear-occasion',
    (s) => s.operations?.personalProject?.occasion === 'offered',
  );
  return s;
}
function promisedNoraVisit(s: GameState) {
  const nora = s.people.nora;
  if (!nora) throw Error('Nora was not actually introduced');
  const commitment = promise(nora, {
    kind: 'promise',
    toId: 'player',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
    label: 'Keep an earlier promised check-in',
  });
  const offer: Affordance = {
    id: 'nora-promised-check-in',
    action: 'check-in',
    label: 'Keeping the earlier promised check-in',
    duration: 60,
    effort: 0,
    advertises: { belonging: 0.3 },
    fulfills: [commitment.id],
  };
  expect(begin(nora, offer, decide(nora, [offer]))).toBeTruthy();
}
describe('published HF decides the model occasion', () => {
  it('a stronger actual commitment withholds agreement without altering model custody or edition', () => {
    let s = offeredOccasion();
    promisedNoraVisit(s);
    const before = structuredClone(s);
    s = act(s, 'operations-personal-agree-bench');
    expect(s.operations?.personalProject).toEqual(before.operations?.personalProject);
    expect(s.objects.find((o) => o.id === 'paper-street')).toEqual(
      before.objects.find((o) => o.id === 'paper-street'),
    );
    expect(s.people.nora?.activity).toEqual(before.people.nora?.activity);
    expect(s.operations?.personalProject?.custody).toBe('player');
    expect(s.operations?.personalProject?.occasion).toBe('offered');
  });
  it('the matched available Nora can actually agree and attend the complete circuit', () => {
    let s = offeredOccasion();
    s = attend(
      s,
      'operations-personal-agree-bench',
      (s) => s.operations?.personalProject?.occasion === 'bench-agreed',
    );
    const before = s.now;
    const noraBefore = s.people.nora?.now;
    s = attend(
      s,
      'operations-personal-show-bench',
      (s) => s.operations?.personalProject?.occasion === 'shown',
    );
    expect(s.now).toBeGreaterThanOrEqual(before + 20);
    expect(s.people.nora?.now).toBeGreaterThanOrEqual((noraBefore ?? 0) + 20);
    expect(s.operations?.personalProject).toMatchObject({
      custody: 'player',
      fitted: 'updated',
      originalFronts: 'retained-envelope',
      occasion: 'shown',
      circuitChecked: true,
    });
    expect(
      s.conversation.some((line) => line.speaker === 'Nora' && line.text.includes('smaller gate')),
    ).toBe(true);
  });
});
