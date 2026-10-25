import { restore, snapshot } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import type { CommunityFormat, CommunityState } from '../src/game/community';
import {
  beginPreparation,
  completePreparation,
  createCommunityEvent,
  eventOptions,
  finalizeCommunityEvent,
  resolveCommunityEvent,
} from '../src/game/community';
import { createGame } from '../src/game/engine';
import { createModel } from '../src/game/model';
import { createPeople, finishActivity, prepareMorning, tickPeople } from '../src/game/people';
import type { GameState } from '../src/game/types';

function fixture(): GameState {
  const state = createGame(416);
  state.now = 5040;
  state.people = createPeople(416, state.now);
  const lantern = state.jobs.find((j) => j.ownerId === 'mum');
  const theatre = state.jobs.find((j) => j.isPersonal);
  if (!lantern || !theatre) throw new Error('Missing equipment');
  lantern.model = createModel('lantern', 1, []);
  lantern.status = 'delivered';
  lantern.verified = ['movement'];
  theatre.model = createModel('music-box', 1, []);
  theatre.verified = ['load'];
  return state;
}
function prepare(state: GameState, event: CommunityState, format: CommunityFormat, now = 5040) {
  const result = beginPreparation(state, event, format, now);
  if (!result.ok || !result.jobId) throw new Error(result.message);
  completePreparation(event, format, result.jobId, now + result.cost);
}
function resolve(state: GameState, event: CommunityState) {
  tickPeople(state.people, 5220);
  resolveCommunityEvent(state, event, 5220);
}
describe('bounded community gathering', () => {
  it('requires retained observations and current physical success without exposing faults', () => {
    const state = fixture();
    const event = createCommunityEvent();
    expect(eventOptions(state, event).find((v) => v.format === 'garden')?.ready).toBe(true);
    const lantern = state.jobs.find((j) => j.ownerId === 'mum');
    if (!lantern) throw new Error('Missing lantern');
    lantern.model = createModel('lantern', 1, [{ componentId: 'switch', condition: 'worn' }]);
    const view = eventOptions(state, event).find((v) => v.format === 'garden');
    expect(view?.ready).toBe(false);
    expect(view?.reason).not.toContain('switch');
    lantern.model = createModel('lantern', 1, []);
    lantern.verified = [];
    expect(eventOptions(state, event).find((v) => v.format === 'garden')?.ready).toBe(false);
  });
  it('permits two preparations but prevents overlapping use and late third preparations', () => {
    const state = fixture();
    const event = createCommunityEvent();
    expect(beginPreparation(state, event, 'theatre', 5030).ok).toBe(false);
    const first = beginPreparation(state, event, 'theatre', 5040);
    expect(first.ok).toBe(true);
    expect(beginPreparation(state, event, 'garden', 5040).ok).toBe(false);
    completePreparation(event, 'theatre', first.jobId ?? '', 5129);
    expect(event.preparedFormats).toEqual([]);
    completePreparation(event, 'theatre', first.jobId ?? '', 5130);
    prepare(state, event, 'garden', 5130);
    expect(event.preparedFormats).toEqual(['theatre', 'garden']);
    expect(beginPreparation(state, event, 'reading', 5220).ok).toBe(false);
  });
  it('changes actual offered and chosen activities when equipment changes', () => {
    const gardenState = fixture();
    const garden = createCommunityEvent();
    prepare(gardenState, garden, 'garden');
    resolve(gardenState, garden);
    const theatreState = fixture();
    const theatre = createCommunityEvent();
    prepare(theatreState, theatre, 'theatre');
    resolve(theatreState, theatre);
    expect(garden.decisions.some((d) => d.format === 'garden')).toBe(true);
    expect(theatre.decisions.some((d) => d.format === 'theatre')).toBe(true);
    expect(garden.decisions.map((d) => d.activityId)).not.toEqual(
      theatre.decisions.map((d) => d.activityId),
    );
  });
  it('lets actual afternoon promises compete instead of overriding them', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    for (const person of Object.values(state.people)) prepareMorning(person, 4320);
    resolve(state, event);
    const sam = event.decisions.find((d) => d.personId === 'sam');
    expect(sam?.activityId).toBe('personal');
    expect(sam?.activityLabel).toBe('Spend 30 minutes on: Play football');
    expect(sam?.speech).toContain('promised');
    expect(event.decisions.find((d) => d.personId === 'mum')?.format).toBe('garden');
  });
  it('uses real activity ticks and returns the theatre with the identical physical model', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'theatre');
    const theatre = state.jobs.find((j) => j.isPersonal);
    const before = JSON.stringify(theatre?.model);
    resolve(state, event);
    tickPeople(state.people, 5250);
    finalizeCommunityEvent(state, event, 5250);
    expect(event.phase).toBe('completed');
    expect(event.reservedJobIds).toEqual([]);
    expect(event.decisions.filter((d) => d.format).every((d) => d.completed)).toBe(true);
    expect(JSON.stringify(theatre?.model)).toBe(before);
  });
  it('does not take a person or equipment away from existing work', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    state.npcWork.push({
      personId: 'sam',
      jobId: 'other',
      startedAt: 5200,
      endsAt: 5290,
      option: { id: 'work', action: 'work', label: 'Repair a fan', duration: 90, effort: 0.1 },
    });
    resolve(state, event);
    expect(event.decisions.find((d) => d.personId === 'sam')?.activityId).toBeUndefined();
    const other = fixture();
    const otherEvent = createCommunityEvent();
    const theatre = other.jobs.find((j) => j.isPersonal);
    if (!theatre) throw new Error('Missing theatre');
    theatre.assignedTo = 'sam';
    expect(beginPreparation(other, otherEvent, 'theatre', 5040).ok).toBe(false);
  });
  it('preserves chosen activities and results across plain event state plus HF snapshots', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    const resumed = {
      ...state,
      people: Object.fromEntries(
        Object.entries(state.people).map(([id, p]) => [id, restore(snapshot(p))]),
      ),
    };
    const resumedEvent = JSON.parse(JSON.stringify(event)) as CommunityState;
    resolve(state, event);
    resolve(resumed, resumedEvent);
    expect(resumedEvent).toEqual(event);
    tickPeople(state.people, 5250);
    tickPeople(resumed.people, 5250);
    finalizeCommunityEvent(state, event, 5250);
    finalizeCommunityEvent(resumed, resumedEvent, 5250);
    expect(resumedEvent).toEqual(event);
    const sam = state.people.sam;
    const resumedSam = resumed.people.sam;
    if (!sam || !resumedSam) throw new Error('Missing Sam');
    expect(snapshot(resumedSam)).toEqual(snapshot(sam));
  });
  it('requires owner consent for a borrowed fan and keeps the other owner’s object unavailable', () => {
    const state = fixture();
    const event = createCommunityEvent();
    const template = state.jobs.find((j) => j.isPersonal);
    if (!template) throw new Error('Missing template');
    state.jobs.push({
      ...structuredClone(template),
      id: 'noras-fan',
      kind: 'fan',
      ownerId: 'nora',
      isPersonal: false,
      status: 'delivered',
      verified: ['load'],
      model: createModel('fan', 4, []),
    });
    expect(eventOptions(state, event).find((v) => v.format === 'reading')?.ready).toBe(false);
    event.ownerConsentJobIds.push('noras-fan');
    expect(eventOptions(state, event).find((v) => v.format === 'reading')?.ready).toBe(true);
    prepare(state, event, 'reading');
    resolve(state, event);
    expect(event.decisions.some((d) => d.format === 'reading')).toBe(true);
  });
  it('keeps actual begun choices across a mid-gathering save rather than deciding again', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    resolve(state, event);
    tickPeople(state.people, 5230);
    const resumed = {
      ...state,
      people: Object.fromEntries(
        Object.entries(state.people).map(([id, person]) => [id, restore(snapshot(person))]),
      ),
    };
    const resumedEvent = structuredClone(event);
    const decisions = structuredClone(event.decisions);
    resolveCommunityEvent(resumed, resumedEvent, 5230);
    expect(resumedEvent.decisions).toEqual(decisions);
    tickPeople(state.people, 5250);
    tickPeople(resumed.people, 5250);
    finalizeCommunityEvent(state, event, 5250);
    finalizeCommunityEvent(resumed, resumedEvent, 5250);
    expect(resumedEvent).toEqual(event);
  });
  it('does not record interrupted attendance as a completed gathering', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    resolve(state, event);
    const attendee = event.decisions.find((d) => d.format === 'garden');
    if (!attendee) throw new Error('No attendee');
    const person = state.people[attendee.personId];
    if (!person) throw new Error('Missing person');
    tickPeople(state.people, 5230);
    const activity = person.activity;
    if (!activity) throw new Error('Missing activity');
    finishActivity(
      person,
      {
        id: activity.affordanceId,
        action: activity.action,
        label: activity.affordance.label,
        duration: activity.affordance.duration,
        effort: activity.effort,
      },
      false,
      5230,
    );
    tickPeople(state.people, 5250);
    finalizeCommunityEvent(state, event, 5250);
    expect(attendee.completed).toBe(false);
    expect(event.outcome).toContain(`${person.name} did not finish the garden gathering.`);
    expect(event.outcome).not.toContain(`${person.name} joined the garden gathering.`);
  });
  it('gives a lone attendee no realized belonging and records equipment rather than player attendance', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    for (const id of ['nora', 'sam', 'rafi', 'halil'])
      state.npcWork.push({
        personId: id,
        startedAt: 5200,
        endsAt: 5280,
        option: { id: 'busy', action: 'work', label: 'Already working', duration: 80, effort: 0 },
      });
    resolve(state, event);
    const mum = state.people.mum;
    if (!mum) throw new Error('Missing Mum');
    expect(event.decisions.find((d) => d.personId === 'mum')?.format).toBe('garden');
    tickPeople(state.people, 5250);
    const before = mum.needs.belonging;
    finalizeCommunityEvent(state, event, 5250);
    expect(mum.needs.belonging).toBe(before);
    expect(mum.activity).toBeNull();
    expect(event.outcome).toBe('Sam’s mother joined the garden gathering.');
    const equipmentMemory = mum.memory.episodes.find((episode) =>
      episode.summary.startsWith('The prepared equipment enabled'),
    );
    expect(equipmentMemory?.summary).toContain('no other neighbour joined');
    expect(equipmentMemory?.actorId).toBeUndefined();
  });
  it('closes stale-clock activities without success credit or retained equipment reservations', () => {
    const state = fixture();
    const event = createCommunityEvent();
    prepare(state, event, 'garden');
    resolve(state, event);
    finalizeCommunityEvent(state, event, 5250);
    expect(event.phase).toBe('completed');
    expect(event.reservedJobIds).toEqual([]);
    expect(event.decisions.every((d) => !d.completed)).toBe(true);
    expect(Object.values(state.people).every((p) => p.activity === null)).toBe(true);
    expect(Object.values(state.people).every((p) => p.now === 5220)).toBe(true);
  });
  it('keeps Mum’s named-neighbour promise only with that actual neighbour present for the completed activity', () => {
    const absent = fixture();
    const absentEvent = createCommunityEvent();
    prepare(absent, absentEvent, 'garden');
    const absentMum = absent.people.mum;
    if (!absentMum) throw new Error('Missing Mum');
    prepareMorning(absentMum, 4320);
    absent.npcWork.push({
      personId: 'nora',
      startedAt: 5200,
      endsAt: 5280,
      option: { id: 'busy', action: 'work', label: 'Own design work', duration: 80, effort: 0 },
    });
    resolve(absent, absentEvent);
    tickPeople(absent.people, 5250);
    finalizeCommunityEvent(absent, absentEvent, 5250);
    expect(absentEvent.decisions.find((d) => d.personId === 'mum')?.format).toBe('garden');
    expect(absentMum.agenda.commitments.find((c) => c.targetId === 'nora')?.status).toBe('pending');
    const present = fixture();
    const presentEvent = createCommunityEvent();
    prepare(present, presentEvent, 'garden');
    const presentMum = present.people.mum;
    if (!presentMum) throw new Error('Missing Mum');
    prepareMorning(presentMum, 4320);
    const nora = present.people.nora;
    if (!nora) throw new Error('Missing Nora');
    nora.needs.belonging = 0.1; // Controlled unmet social need makes joining compete strongly.
    resolve(present, presentEvent);
    expect(presentEvent.decisions.find((d) => d.personId === 'nora')?.format).toBe('garden');
    tickPeople(present.people, 5250);
    finalizeCommunityEvent(present, presentEvent, 5250);
    expect(presentMum.agenda.commitments.find((c) => c.targetId === 'nora')?.status).toBe('kept');
  });
});
