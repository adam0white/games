import {
  begin,
  createPerson,
  decide,
  finish,
  releaseCommitment,
  tick,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import { getWorkshopView } from '../src/game/workshop';
import { choose, opening } from './support/school-route';

function planned() {
  let s = opening(42);
  s = choose(s, 'workshop-cabinet-look');
  // Matched actor profile: only bodily competition differs in the refusal control.
  s.people.dad = createPerson({
    id: 'dad',
    name: 'Dad',
    sex: 'male',
    bornAt: -55 * 365 * 1440,
    seed: 42,
    now: s.now,
    needs: { belonging: 0.05, autonomy: 0.1, competence: 0.1 },
    body: { exertion: 0, sleepPressure: 0 },
  });
  return s;
}
it('agreement consumes real shared time and creates specific promises; unrelated work cannot fulfill them', () => {
  const before = planned();
  const s = choose(before, 'workshop-cabinet-plan');
  expect(s.now - before.now).toBe(2);
  const a = s.workshop?.cabinetAppointment;
  expect(a?.status).toBe('planned');
  if (!a) throw Error('No agreed slot');
  for (const [id, commitmentId] of [
    ['dad', a.dadId],
    ['player', a.playerId],
  ]) {
    if (!id) throw Error('Missing person id');
    const person = s.people[id];
    if (!person) throw Error('Missing partner');
    const c = person.agenda.commitments.find((c) => c.id === commitmentId);
    expect(c?.actions).toEqual(['cabinet-measure']);
    expect(c?.targetId).toBe('family-cabinet');
    const offer = {
      id: 'unrelated-work',
      action: 'work',
      label: 'Other bench work',
      duration: 1,
      effort: 0,
      advertises: {},
    };
    tick(person, a.at);
    begin(person, offer, decide(person, [offer]));
    tick(person, a.at + 1);
    finish(person, {
      affordanceId: offer.id,
      action: offer.action,
      at: person.now,
      status: 'completed',
      summary: 'Other work',
    });
    expect(c?.status).toBe('pending');
  }
});
it('an unavailable Dad cannot agree a slot or advance the cabinet', () => {
  const s = planned();
  if (!s.people.dad) throw Error('Missing Dad');
  s.people.dad.body.exertion = 0.99;
  s.people.dad.body.sleepPressure = 0.99;
  s.people.dad.body.asleep = true;
  expect(getView(s).actions.some((a) => a.id === 'workshop-cabinet-plan')).toBe(false);
  expect(s.workshop?.cabinetAppointment).toBeUndefined();
  expect(s.workshop?.cabinet).toBe('looked');
});
it('a real public arrangement, explicit wait and joined step keep both promises and replay', () => {
  let s = opening(42);
  s = choose(s, 'workshop-cabinet-look');
  for (let i = 0; i < 30 && !s.workshop?.cabinetAppointment; i++) {
    if (getView(s).actions.some((a) => a.id === 'workshop-cabinet-plan'))
      s = choose(s, 'workshop-cabinet-plan');
    else s = choose(s, 'rest');
    if (!s.workshop?.cabinetAppointment) s = choose(s, 'rest');
  }
  expect(s.workshop?.cabinetAppointment?.status).toBe('planned');
  const at = s.workshop?.cabinetAppointment?.at ?? 0;
  while (s.now < at) s = choose(s, 'wait-appointment');
  s = choose(s, 'workshop-cabinet-measure');
  expect(s.workshop?.cabinet).toBe('measured');
  expect(s.workshop?.cabinetAppointment?.status).toBe('kept');
  expect(
    getView(s).dayPlan?.entries.find((entry) => entry.id === `cabinet-result-${at}`)?.status,
  ).toBe('kept');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('school cancels an agreed slot before compression and returns all actors to the actual next summer morning', () => {
  let s = opening(42);
  s = choose(s, 'workshop-cabinet-look');
  for (let i = 0; i < 30 && !s.workshop?.cabinetAppointment; i++) {
    if (getView(s).actions.some((a) => a.id === 'workshop-cabinet-plan'))
      s = choose(s, 'workshop-cabinet-plan');
    if (!s.workshop?.cabinetAppointment) s = choose(s, 'rest');
  }
  const a = s.workshop?.cabinetAppointment;
  expect(a).toBeDefined();
  const before = s.now;
  s = choose(s, 'back-to-school');
  expect(s.now - before).toBeGreaterThanOrEqual(365 * 1440);
  expect(s.now % 1440).toBe(9 * 60);
  expect(s.campaign?.holidayStartedAt).toBe(s.now);
  expect(s.workshop?.cabinetAppointment?.status).toBe('cancelled');
  expect(s.people.dad?.agenda.commitments.find((c) => c.id === a?.dadId)?.status).toBe('released');
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
  expect(getView(s).timeLabel).toContain('day 1');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('a present Dad may keep his own plans instead of accepting the same proposed time', () => {
  const s = planned();
  if (!s.people.dad) throw Error('Missing Dad');
  s.people.dad.needs.belonging = 1;
  s.people.dad.needs.competence = 0;
  s.people.dad.needs.autonomy = 0;
  const after = choose(s, 'workshop-cabinet-plan');
  expect(after.workshop?.cabinetAppointment).toBeUndefined();
  expect(after.now).toBe(s.now);
  expect(after.people.dad?.trace.at(-1)?.chosenAffordanceId).toBe('own-tools');
});

it('the same cabinet offer receives actual promise pressure only with the agreed commitment, while bodily unavailability still prevents joined work', () => {
  let s = choose(planned(), 'workshop-cabinet-plan');
  const a = s.workshop?.cabinetAppointment;
  if (!a || !s.people.dad) throw Error('Missing actual appointment');
  const dad = s.people.dad;
  tick(dad, a.at + 30);
  const withheld = structuredClone(dad);
  releaseCommitment(withheld, a.dadId);
  const offers = [
    {
      id: 'cabinet-measure',
      action: 'cabinet-measure',
      targetId: 'family-cabinet',
      label: 'Measure hinges',
      duration: 20,
      effort: 0.1,
      advertises: { competence: 0.06, belonging: 0.05 },
    },
    {
      id: 'own-tools',
      action: 'work',
      label: 'Own plans',
      duration: 8,
      effort: 0.03,
      advertises: { competence: 0.05, autonomy: 0.04 },
    },
  ];
  const withPromise = decide(dad, offers),
    withoutPromise = decide(withheld, offers);
  const terms = (d: typeof withPromise) =>
    d.considered.find((c) => c.affordanceId === 'cabinet-measure')?.terms ?? [];
  expect(terms(withPromise).some((t) => t.source === `commitment:${a.dadId}` && t.value > 0)).toBe(
    true,
  );
  expect(terms(withoutPromise).some((t) => t.source === `commitment:${a.dadId}`)).toBe(false);
  s = structuredClone(s);
  for (const p of Object.values(s.people)) p.now = a.at;
  s.now = a.at;
  if (!s.people.dad) throw Error('Missing Dad');
  s.people.dad.body.exertion = 0.98;
  s.people.dad.body.sleepPressure = 0.95;
  s.people.dad.body.asleep = true;
  expect(getView(s).actions.some((a) => a.id === 'workshop-cabinet-measure')).toBe(false);
  expect(s.workshop?.cabinet).toBe('looked');
  expect(s.workshop?.cabinetAppointment?.status).toBe('planned');
});
it('missing the agreed window preserves the actual breach and exposes honest rearrangement', () => {
  let s = opening(42);
  s = choose(s, 'workshop-cabinet-look');
  for (let i = 0; i < 30 && !s.workshop?.cabinetAppointment; i++) {
    if (getView(s).actions.some((a) => a.id === 'workshop-cabinet-plan'))
      s = choose(s, 'workshop-cabinet-plan');
    if (!s.workshop?.cabinetAppointment) s = choose(s, 'rest');
  }
  const a = s.workshop?.cabinetAppointment;
  if (!a) throw Error('Missing slot');
  while (s.now <= a.until) s = choose(s, 'rest');
  expect(s.workshop?.cabinetAppointment?.status).toBe('missed');
  expect(s.people.dad?.agenda.commitments.find((c) => c.id === a.dadId)?.status).toBe('broken');
  expect(getWorkshopView(s)?.cabinet?.description).toContain('missed');
  expect(s.workshop?.cabinet).toBe('looked');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('keeps a received cabinet window visible after other forty-minute work crosses its start, without completing the cabinet', () => {
  const s = choose(planned(), 'workshop-cabinet-plan');
  const a = s.workshop?.cabinetAppointment;
  if (!a) throw Error('Missing slot');
  expect(s.conversation.map((line) => line.text).join(' ')).toContain('until quarter to five');
  s.now = a.at - 20;
  for (const person of Object.values(s.people)) tick(person, s.now);
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  const work = {
    id: 'sorting-control',
    action: 'work',
    label: 'Sorting retained parts',
    duration: 40,
    effort: 0,
    advertises: { competence: 0.1 },
  };
  begin(player, work, decide(player, [work]));
  const activity = player.activity;
  expect(activity?.affordanceId).toBe(work.id);
  s.now += 40;
  for (const person of Object.values(s.people)) tick(person, s.now);
  const before = structuredClone(s);
  const view = getView(s);
  const plan = view.dayPlan?.entries.find((entry) => entry.id === `known-dad-${a.at}`);
  expect(plan?.detail).toContain('15:45–16:45');
  expect(plan?.detail).toContain('open now');
  expect(plan?.actionIds).toContain('workshop-cabinet-measure');
  expect(plan?.actionIds).not.toContain('wait-appointment');
  expect(s.workshop?.cabinet).toBe('looked');
  expect(player.agenda.commitments.find((c) => c.id === a.playerId)?.status).toBe('pending');
  expect(s.people.dad?.agenda.commitments.find((c) => c.id === a.dadId)?.status).toBe('pending');
  expect(s).toEqual(before);
});

it('reports an actually missed shared deadline once, leaving the unfinished work and breach intact', () => {
  let s = choose(planned(), 'workshop-cabinet-plan');
  const a = s.workshop?.cabinetAppointment;
  if (!a) throw Error('Missing slot');
  while (s.now <= a.until) s = choose(s, 'rest');
  const marker = `The agreed cabinet ${a.task} window`;
  expect((s.journal ?? []).filter((line) => line.text.startsWith(marker))).toHaveLength(1);
  expect(
    getView(s).dayPlan?.entries.find((entry) => entry.id === `cabinet-result-${a.at}`)?.status,
  ).toBe('late');
  const before = s.workshop?.cabinet;
  s = choose(s, 'rest');
  expect((s.journal ?? []).filter((line) => line.text.startsWith(marker))).toHaveLength(1);
  expect(s.workshop?.cabinet).toBe(before);
  expect(s.people.player?.agenda.commitments.find((c) => c.id === a.playerId)?.status).toBe(
    'broken',
  );
  expect(s.people.dad?.agenda.commitments.find((c) => c.id === a.dadId)?.status).toBe('broken');
});
