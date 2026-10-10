import { createPerson, tick } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  agreeCheckedCollection,
  attestCheckedCollection,
  humanProfile,
} from '../src/game/practices';
import {
  applyServiceWeekAction,
  completeServiceWeekJob,
  freshServiceWeek,
  getServiceWeekView,
  type ServiceWeekContext,
  type ServiceWeekGame,
  serviceCollectionDeadline,
} from '../src/game/service-week';
import { freshWorkshop } from '../src/game/workshop';

const ctx: ServiceWeekContext = {
  independentHandoff: true,
  graduated: true,
  samHere: true,
  dadHere: true,
  ownerHere: () => true,
};
function agreement() {
  const state: ServiceWeekGame = {
    now: 840,
    workshop: freshWorkshop(),
    serviceWeek: freshServiceWeek(),
  };
  for (const id of ['service-begin', 'service-regular', 'service-hear-leila'])
    applyServiceWeekAction(state, id, ctx);
  const result = applyServiceWeekAction(state, 'service-accept-leila', ctx);
  const job = state.serviceWeek?.jobs.find((job) => job.id === 'service-leila');
  if (!result?.promise || !job) throw new Error('Expected agreement');
  const player = createPerson({
    id: 'player',
    name: 'You',
    seed: 42,
    now: 840,
    bornAt: -18 * 365 * 1440,
    sex: 'male',
    ...humanProfile('player', 840),
  });
  agreeCheckedCollection(player, job.id, 'leila', result.promise.collectionAt);
  return { state, result, job, player };
}
describe('explicit checked handover windows', () => {
  it('agrees the same visible window, visit start and HF deadline without receiving payment', () => {
    const { state, result, job, player } = agreement();
    expect(result.lines.map((line) => line.text).join(' ')).toContain('18:00–18:15');
    expect(job.collectionAt).toBe(2520);
    expect(job.collectionUntil).toBe(2535);
    expect(result.visits?.[0]?.at).toBe(2520);
    expect(
      player.agenda.commitments.find((c) => c.label === 'Checked collection: service-leila')?.until,
    ).toBe(2535);
    expect(state.workshop?.cash).toBe(0);
  });
  it('keeps an actual four-minute handover begun at the appointment on time', () => {
    const { state, job, player } = agreement();
    tick(player, 2524);
    attestCheckedCollection(player, job.id, 'leila', 2524);
    expect(
      player.agenda.commitments.find((c) => c.label === 'Checked collection: service-leila')
        ?.status,
    ).toBe('kept');
    state.now = 2524;
    expect(getServiceWeekView(state)?.arrangements[0]).not.toContain('has passed');
    const lines = completeServiceWeekJob(state, job.id, {
      verified: true,
      independent: false,
      at: 2524,
    });
    expect(lines[0]?.text).toBe('Thank you. I can use it now, and I know what was checked.');
    expect(state.workshop?.cash).toBe(500);
  });
  it('withholding the handover really breaches the explicit window; later collection does not invent speech about a delay', () => {
    const { state, job, player } = agreement();
    // Released HF closes overdue commitments at its next hourly bookkeeping boundary.
    tick(player, 2580);
    expect(
      player.agenda.commitments.find((c) => c.label === 'Checked collection: service-leila')
        ?.status,
    ).toBe('broken');
    state.now = 2536;
    expect(getServiceWeekView(state)?.arrangements[0]).toContain('agreed time has passed');
    expect(state.workshop?.cash).toBe(0);
    const lines = completeServiceWeekJob(state, job.id, {
      verified: true,
      independent: false,
      at: 2536,
    });
    expect(lines[0]?.text).toBe(
      'I can take the checked light now. Thank you for showing me what was checked.',
    );
  });
  it('preserves old exact deadlines and already missed records without adding a window', () => {
    const { state, job } = agreement();
    delete job.collectionUntil;
    const before = JSON.stringify(job);
    state.now = 2524;
    expect(serviceCollectionDeadline(job)).toBe(2520);
    expect(getServiceWeekView(state)?.arrangements[0]).toContain('agreed time has passed');
    expect(JSON.stringify(job)).toBe(before);
    expect(getServiceWeekView(state)?.arrangements[0]).not.toContain('18:15');
  });
});
