import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { createModel } from '../src/game/model';
import { teachObserved } from '../src/game/people';
import type { GameState } from '../src/game/types';
import { acceptRepairOffer } from './repair-offer';

function trainReplacement(state: GameState): void {
  const sam = state.people.sam;
  if (!sam) throw new Error('Missing Sam');
  teachObserved(
    sam,
    'prior-lesson',
    { family: 'electrical', stage: 'intake' },
    'replace:switch',
    'prior-replacement',
    'success',
    state.now,
  );
}
function nextSamFinish(state: GameState): GameState {
  const work = state.npcWork.find((w) => w.personId === 'sam');
  if (!work) throw new Error('Sam is not doing an activity');
  return dispatch(state, { type: 'wait', minutes: work.endsAt - state.now }).state;
}

describe('Sam responsibility and requests', () => {
  it('lives an ordinary day rather than starving while idle', () => {
    const state = dispatch(createGame(42), { type: 'wait', minutes: 60 }).state;
    expect(
      state.people.sam?.trace.some((t) =>
        ['eat', 'drink', 'rest', 'personal', 'leisure'].includes(t.chosenAction ?? ''),
      ),
    ).toBe(true);
    expect(state.npcWork.some((w) => w.personId === 'sam' && !w.jobId)).toBe(true);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('holds a busy lesson request and separates readiness from attended learning', () => {
    let state = dispatch(createGame(42), { type: 'wait', minutes: 1 }).state;
    const busyUntil = state.npcWork.find((w) => w.personId === 'sam')?.endsAt;
    expect(busyUntil).toBeDefined();
    state = dispatch(state, { type: 'request-lesson' }).state;
    expect(state.pendingRequest?.status).toBe('requested');
    expect(state.watching).toBe(false);
    const before = saveGame(state);
    expect(saveGame(loadGame(before))).toBe(before);
    state = dispatch(state, { type: 'wait', minutes: (busyUntil ?? state.now) - state.now }).state;
    expect(state.pendingRequest?.status).toBe('ready');
    expect(state.watching).toBe(false);
    expect(state.people.sam?.methods?.rules ?? []).toHaveLength(0);
    state = dispatch(state, { type: 'start-lesson' }).state;
    expect(state.watching).toBe(true);
    expect(state.watchUntil).toBe(state.now + 90);
    expect(state.pendingRequest).toBeUndefined();
  });
  it('blocks unknown work without discarding responsibility or repeatedly asking', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    state = dispatch(state, { type: 'wait', minutes: 11 }).state;
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(state.jobs[0]?.blocked).toBeDefined();
    const asks = state.log.filter((e) => e.text.includes('demonstration')).length;
    const contributions = structuredClone(state.jobs[0]?.contributions);
    state = dispatch(loadGame(saveGame(state)), { type: 'wait', minutes: 60 }).state;
    expect(state.log.filter((e) => e.text.includes('demonstration')).length).toBe(asks);
    expect(state.jobs[0]?.contributions).toEqual(contributions);
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(state.npcWork.some((w) => w.jobId === jobId)).toBe(false);
    expect(dispatch(state, { type: 'retry-sam', jobId }).ok).toBe(true);
    expect(dispatch(state, { type: 'recall', jobId }).state.jobs[0]?.assignedTo).toBeUndefined();
  });
  it('keeps accepted work through food and resumes without another assignment', () => {
    let state = createGame(42);
    trainReplacement(state);
    const sam = state.people.sam;
    if (!sam) throw new Error('Missing Sam');
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    const acceptedSam = state.people.sam;
    if (!acceptedSam) throw new Error('Missing accepted Sam');
    acceptedSam.body.satiety = 0.1;
    state = nextSamFinish(state);
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('eat');
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    const resumed = loadGame(saveGame(state));
    state = nextSamFinish(state);
    expect(saveGame(nextSamFinish(resumed))).toBe(saveGame(state));
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('replace:switch');
    expect(state.stock.switch).toBe(0);
    expect(state.jobs[0]?.assignedTo).toBe('sam');
  });
  it('holds only one repair offer, then accepts it after an ordinary activity', () => {
    let state = dispatch(createGame(42), { type: 'wait', minutes: 1 }).state;
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    expect(state.pendingRequest).toMatchObject({ kind: 'repair', status: 'requested', jobId });
    expect(state.jobs[0]?.assignedTo).toBeUndefined();
    const unchanged = saveGame(state);
    expect(dispatch(state, { type: 'request-lesson' }).ok).toBe(false);
    expect(saveGame(dispatch(state, { type: 'request-lesson' }).state)).toBe(unchanged);
    expect(
      dispatch(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' }).ok,
    ).toBe(false);
    expect(saveGame(loadGame(unchanged))).toBe(unchanged);
    state = nextSamFinish(state);
    expect(state.pendingRequest).toBeUndefined();
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('accept-repair');
    state = nextSamFinish(state);
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('ask-help');
  });
  it('expires readiness while the body keeps changing and records no missed work', () => {
    let state = dispatch(createGame(42), { type: 'request-lesson' }).state;
    expect(state.pendingRequest?.status).toBe('ready');
    const body = state.people.sam?.body.hydration ?? 0;
    const ready = loadGame(saveGame(state));
    state = dispatch(state, { type: 'wait', minutes: 20 }).state;
    expect(saveGame(dispatch(ready, { type: 'wait', minutes: 20 }).state)).toBe(saveGame(state));
    expect(state.pendingRequest).toBeUndefined();
    expect(state.watching).toBe(false);
    expect(state.people.sam?.body.hydration).toBeLessThan(body);
    expect(state.people.sam?.methods?.rules ?? []).toHaveLength(0);
    expect(dispatch(state, { type: 'start-lesson' }).ok).toBe(false);
  });
  it('cancels readiness and releases the HF agreement exactly once', () => {
    let state = dispatch(createGame(42), { type: 'request-lesson' }).state;
    state = dispatch(state, { type: 'cancel-request' }).state;
    expect(state.pendingRequest).toBeUndefined();
    expect(
      state.people.sam?.agenda.commitments.find((c) => c.actions.includes('complete-lesson'))
        ?.status,
    ).toBe('released');
    expect(dispatch(state, { type: 'cancel-request' }).ok).toBe(false);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('retains blocked responsibility across sleep without renewing an expired promise', () => {
    let state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing job');
    job.due = state.now + 15;
    state = dispatch(state, { type: 'assign', jobId: job.id, personId: 'sam' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(state.jobs[0]?.blocked?.kind).toBe('help');
    const promises =
      state.people.sam?.agenda.commitments.filter(
        (c) => c.targetId === job.id && c.actions.includes('deliver'),
      ) ?? [];
    expect(promises).toHaveLength(1);
    expect(promises[0]?.status).toBe('broken');
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    state = dispatch(state, { type: 'retry-sam', jobId: job.id }).state;
    expect(
      state.people.sam?.agenda.commitments.filter(
        (c) => c.targetId === job.id && c.actions.includes('deliver'),
      ),
    ).toHaveLength(1);
  });
  it('takes back a queued retry without interrupting unrelated self-care', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    state = nextSamFinish(state);
    state = nextSamFinish(state);
    state = dispatch(state, { type: 'retry-sam', jobId }).state;
    expect(state.pendingRequest?.kind).toBe('repair');
    const activity = structuredClone(state.npcWork.find((w) => w.personId === 'sam'));
    state = dispatch(state, { type: 'recall', jobId }).state;
    expect(state.jobs[0]?.assignedTo).toBeUndefined();
    expect(state.pendingRequest).toBeUndefined();
    expect(state.npcWork.find((w) => w.personId === 'sam')).toEqual(activity);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('records actually attended observations in HF memory and withholds unseen work', () => {
    let attended = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    let unseen = createGame(42);
    const command = {
      type: 'measure' as const,
      jobId: attended.selectedJobId,
      request: { mode: 'voltage' as const, a: 'A', b: 'B', condition: 'movement' as const },
    };
    attended = dispatch(attended, command).state;
    unseen = dispatch(unseen, command).state;
    const observation = attended.jobs[0]?.evidence.at(-1);
    expect(observation?.witnessedBy).toContain('sam');
    expect(
      attended.people.sam?.memory.episodes.some(
        (e) => e.action === 'repair-observation:measurement' && e.summary === observation?.summary,
      ),
    ).toBe(true);
    expect(
      unseen.people.sam?.memory.episodes.some((e) => e.action === 'repair-observation:measurement'),
    ).toBe(false);
  });
  it('remeasures the same legal probe after an intervention and remembers its own reading', () => {
    let state = createGame(42);
    const sam = state.people.sam;
    const job = state.jobs[0];
    if (!sam || !job) throw new Error('Missing workshop');
    for (const component of job.model.components)
      component.condition = component.id === 'contact' ? 'dirty' : 'good';
    const probe = 'probe:continuity:C:D:bench';
    const lessons = [
      [{ family: 'electrical', stage: 'intake' }, probe],
      [
        { family: 'electrical', stage: 'measured', part: 'contact', signal: 'resistance' },
        'clean:contact',
      ],
      [{ family: 'electrical', stage: 'repaired', part: 'contact', signal: 'worked' }, probe],
    ] as const;
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(sam, 'prior', cues, action, `probe-${index}`, 'success', state.now);
    state = dispatch(state, { type: 'assign', jobId: job.id, personId: 'sam' }).state;
    state = dispatch(state, { type: 'wait', minutes: 41 }).state;
    expect(state.jobs[0]?.contributions.map((c) => c.action)).toEqual([
      'intake',
      probe,
      'clean:contact',
      probe,
    ]);
    const readings =
      state.jobs[0]?.evidence.filter((e) => e.actorId === 'sam' && e.kind === 'measurement') ?? [];
    expect(readings).toHaveLength(2);
    expect(readings[0]?.request).toEqual(readings[1]?.request);
    expect(readings[0]?.cues.signal).toBe('resistance');
    expect(readings[1]?.cues.signal).toBe('connected');
    expect(
      state.people.sam?.memory.episodes.some(
        (e) => e.action === 'repair-observation:measurement' && e.summary === readings[1]?.summary,
      ),
    ).toBe(true);
  });
  it('does not repeat an unchanged measurement indefinitely', () => {
    let state = createGame(42);
    const sam = state.people.sam;
    const job = state.jobs[0];
    if (!sam || !job) throw new Error('Missing workshop');
    const probe = 'probe:voltage:A:B:movement';
    teachObserved(
      sam,
      'prior',
      { family: 'electrical' },
      probe,
      'repeated-probe',
      'success',
      state.now,
    );
    state = dispatch(state, { type: 'assign', jobId: job.id, personId: 'sam' }).state;
    state = dispatch(state, { type: 'wait', minutes: 60 }).state;
    expect(state.jobs[0]?.contributions.filter((c) => c.action === probe)).toHaveLength(1);
    expect(state.jobs[0]?.blocked?.kind).toBe('help');
  });
  it('reexamines a component after a physical change', () => {
    let state = createGame(42);
    const sam = state.people.sam;
    const job = state.jobs[0];
    if (!sam || !job) throw new Error('Missing workshop');
    const lessons = [
      [{ family: 'electrical', stage: 'intake' }, 'inspect:switch'],
      [
        { family: 'electrical', stage: 'examined', part: 'switch', signal: 'intact' },
        'replace:switch',
      ],
      [
        { family: 'electrical', stage: 'repaired', part: 'switch', signal: 'worked' },
        'inspect:switch',
      ],
    ] as const;
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(sam, 'prior', cues, action, `inspection-${index}`, 'success', state.now);
    state = dispatch(state, { type: 'assign', jobId: job.id, personId: 'sam' }).state;
    state = dispatch(state, { type: 'wait', minutes: 51 }).state;
    expect(state.jobs[0]?.contributions.map((c) => c.action)).toEqual([
      'intake',
      'inspect:switch',
      'replace:switch',
      'inspect:switch',
    ]);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('transfers an observed probe across requested paces but still asks for unknown next steps', () => {
    let state = createGame(416);
    const theatre = state.jobs.find((j) => j.isPersonal);
    if (!theatre) throw new Error('Missing theatre');
    state = dispatch(state, { type: 'watch', enabled: true }).state;
    state = dispatch(state, {
      type: 'measure',
      jobId: theatre.id,
      request: { mode: 'motion', a: '0', b: 'C', condition: 'load' },
    }).state;
    const rule = state.people.sam?.methods?.rules.find((r) => r.action === 'probe:motion:0:C:load');
    expect(rule?.conditions).not.toContainEqual({ cue: 'requested-pace', value: '12' });
    state = dispatch(state, { type: 'next-day' }).state;
    const other = state.jobs.find((j) => j.status === 'offer' && j.kind === 'music-box');
    if (!other) throw new Error('Missing unfamiliar mechanical object');
    expect(other.model.desiredRPM ?? 15).not.toBe(12);
    state = dispatch(state, { type: 'accept', jobId: other.id }).state;
    state = acceptRepairOffer(state, other.id);
    state = dispatch(state, { type: 'wait', minutes: 75 }).state;
    expect(
      state.jobs
        .find((j) => j.id === other.id)
        ?.contributions.some((c) => c.actorId === 'sam' && c.action === 'probe:motion:0:C:load'),
    ).toBe(true);
    expect(state.jobs.find((j) => j.id === other.id)?.blocked?.kind).toBe('help');
  });
  it('learns an attended diagnostic use check even when it reveals failed function', () => {
    let state = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    state = dispatch(state, {
      type: 'verify',
      jobId: state.selectedJobId,
      condition: 'movement',
    }).state;
    expect(state.jobs[0]?.status).toBe('active');
    expect(state.jobs[0]?.verified).toEqual([]);
    expect(
      state.people.sam?.methods?.rules.find((r) => r.action === 'verify:movement')?.evidence.at(-1)
        ?.outcome,
    ).toBe('success');
    state = dispatch(state, { type: 'watch', enabled: false }).state;
    while (state.day < 4) state = dispatch(state, { type: 'next-day' }).state;
    const other = state.jobs.find((j) => j.status === 'offer' && j.title === 'Evan’s path lantern');
    if (!other) throw new Error('Missing unfamiliar carried-light request');
    state = dispatch(state, { type: 'accept', jobId: other.id }).state;
    state = acceptRepairOffer(state, other.id);
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('verify:movement');
    state = dispatch(state, { type: 'wait', minutes: 120 }).state;
    expect(
      state.jobs
        .find((j) => j.id === other.id)
        ?.contributions.filter((c) => c.action === 'verify:movement'),
    ).toHaveLength(1);
    expect(state.jobs.find((j) => j.id === other.id)?.blocked).toBeDefined();
    state = dispatch(state, { type: 'retry-sam', jobId: other.id }).state;
    state = dispatch(state, { type: 'wait', minutes: 60 }).state;
    expect(
      state.jobs
        .find((j) => j.id === other.id)
        ?.contributions.filter((c) => c.action === 'verify:movement'),
    ).toHaveLength(1);
  });
  it('credits a fully independent measured calibration without mandatory inspection', () => {
    let state = dispatch(createGame(416), { type: 'next-day' }).state;
    const sam = state.people.sam;
    const theatre = state.jobs.find((j) => j.status === 'offer' && j.kind === 'music-box');
    if (!sam || !theatre) throw new Error('Missing workshop');
    theatre.model = createModel('music-box', 416, [
      { componentId: 'governor', condition: 'misaligned' },
    ]);
    const lessons = [
      [{ family: 'mechanical', stage: 'intake', 'requested-pace': '15' }, 'probe:motion:0:C:load'],
      [
        {
          family: 'mechanical',
          stage: 'measured',
          'requested-pace': '15',
          part: 'drive',
          signal: 'rotation',
        },
        'calibrate:governor:2',
      ],
      [
        {
          family: 'mechanical',
          stage: 'repaired',
          'requested-pace': '15',
          part: 'governor',
          signal: 'worked',
        },
        'verify:load',
      ],
    ] as const;
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(
        sam,
        'prior',
        cues,
        action,
        `independent-calibration-${index}`,
        'success',
        state.now,
      );
    state = dispatch(state, { type: 'accept', jobId: theatre.id }).state;
    state = acceptRepairOffer(state, theatre.id);
    state = dispatch(state, { type: 'wait', minutes: 90 }).state;
    expect(state.jobs.find((j) => j.id === theatre.id)?.status).toBe('delivered');
    expect(state.independentRepairs).toBe(1);
    expect(state.jobs.find((j) => j.id === theatre.id)?.contributions.map((c) => c.action)).toEqual(
      ['intake', 'probe:motion:0:C:load', 'calibrate:governor:2', 'verify:load'],
    );
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('keeps a continuing accepted repair through the night and resumes next morning', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = acceptRepairOffer(state, jobId);
    state = dispatch(state, { type: 'wait', minutes: 479 }).state;
    trainReplacement(state);
    state = dispatch(state, { type: 'retry-sam', jobId }).state;
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(state.jobs[0]?.blocked).toBeUndefined();
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    const morning = loadGame(saveGame(state));
    state = dispatch(state, { type: 'wait', minutes: 90 }).state;
    expect(saveGame(dispatch(morning, { type: 'wait', minutes: 90 }).state)).toBe(saveGame(state));
    expect(
      state.jobs[0]?.contributions.some(
        (c) => c.actorId === 'sam' && c.action === 'replace:switch',
      ),
    ).toBe(true);
    expect(
      state.people.sam?.agenda.commitments.filter(
        (c) => c.targetId === jobId && c.actions.includes('deliver'),
      ),
    ).toHaveLength(1);
  });
  it.each([
    { kind: 'lesson', status: 'ready', requestedAt: 540, readyUntil: 540 },
    { kind: 'repair', status: 'ready', requestedAt: 540, readyUntil: 560, jobId: 'object-1' },
    { kind: 'repair', status: 'requested', requestedAt: 540, jobId: 'missing' },
    { kind: 'lesson', status: 'requested', requestedAt: 9999 },
    { kind: 'lesson', status: 'requested', requestedAt: 540, silentQueue: [] },
  ])('rejects malformed pending requests %j', (request) => {
    const saved = JSON.parse(saveGame(createGame(42)));
    saved.pendingRequest = request;
    expect(() => loadGame(JSON.stringify(saved))).toThrow();
  });
});
