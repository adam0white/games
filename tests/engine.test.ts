import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { teachObserved } from '../src/game/people';
import type { GameState } from '../src/game/types';
import { readyToLearn } from './hf-fixture';
import { acceptRepairOffer } from './repair-offer';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
}

// Requests wait for actual HF activity completion; they never clear a person to make a fixture idle.
function startLesson(state: GameState, authoredReadiness = true): GameState {
  if (
    authoredReadiness &&
    !state.hf.archive.history.some((tx) =>
      tx.inputs.some((input) => input.kind === 'action.resolved'),
    )
  )
    readyToLearn(required(state.people.sam));
  state = dispatch(state, { type: 'watch', enabled: true }).state;
  if (state.pendingRequest?.status === 'requested') {
    const endsAt = required(state.npcWork.find((w) => w.personId === 'sam')).endsAt;
    state = dispatch(state, { type: 'wait', minutes: endsAt - state.now }).state;
  }
  if (state.pendingRequest?.status === 'ready')
    state = dispatch(state, { type: 'start-lesson' }).state;
  expect(state.watching).toBe(true);
  return state;
}

describe('the deliberate workshop', () => {
  it('starts with a real object and no advances from selection', () => {
    const state = createGame(42);
    const original = saveGame(state);
    const result = dispatch(state, { type: 'select', jobId: state.selectedJobId });
    expect(result.state.now).toBe(540);
    expect(saveGame(state)).toBe(original);
    expect(
      state.jobs.find((job) => job.id === state.selectedJobId)?.model.components.length,
    ).toBeGreaterThan(2);
  });
  it('charges an actual spare once and keeps a wrong replacement consequential', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    const initialCell = state.stock.cell ?? 0;
    const initialNow = state.now;
    const result = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'cell',
      intervention: 'replace',
    });
    state = result.state;
    expect(result.ok).toBe(true);
    expect(state.stock.cell).toBe(initialCell - 1);
    expect(state.now).toBe(initialNow + 30);
    expect(state.jobs[0]?.verified).toEqual([]);
    const denied = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'cell',
      intervention: 'replace',
    });
    expect(denied.ok).toBe(false);
    expect(denied.state.now).toBe(state.now);
    expect(denied.state.stock.cell).toBe(0);
  });
  it('never pays twice for a delivered object', () => {
    let state = createGame(42);
    state = dispatch(state, {
      type: 'deliver',
      jobId: state.selectedJobId,
      unfinished: true,
    }).state;
    const cash = state.cash;
    const now = state.now;
    const again = dispatch(state, {
      type: 'deliver',
      jobId: state.selectedJobId,
      unfinished: true,
    });
    expect(again.ok).toBe(false);
    expect(again.state.cash).toBe(cash);
    expect(again.state.now).toBe(now);
  });
  it('preserves physical and acquired person state across a save', () => {
    let state = createGame(56);
    state = startLesson(state);
    state = dispatch(state, {
      type: 'inspect',
      jobId: state.selectedJobId,
      componentId: 'contact',
    }).state;
    const resumed = loadGame(saveGame(state));
    const action = { type: 'wait' as const, minutes: 30 };
    expect(saveGame(dispatch(resumed, action).state)).toBe(saveGame(dispatch(state, action).state));
  });
  it('an absent watcher does not learn from player work', () => {
    let state = createGame(56);
    const before = state.people.sam?.methods?.rules.length ?? 0;
    state = dispatch(state, {
      type: 'inspect',
      jobId: state.selectedJobId,
      componentId: 'contact',
    }).state;
    expect(state.people.sam?.methods?.rules.length ?? 0).toBe(before);
  });
  it('refuses impossible time costs without losing materials', () => {
    let state = createGame(42);
    state = dispatch(state, { type: 'wait', minutes: 470 }).state;
    const before = saveGame(state);
    const result = dispatch(state, {
      type: 'work',
      jobId: state.selectedJobId,
      componentId: 'switch',
      intervention: 'replace',
    });
    expect(result.ok).toBe(false);
    expect(saveGame(result.state)).toBe(before);
  });
  it('advancing a day preserves put-aside repair state and changes offers', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'inspect', jobId, componentId: 'switch' }).state;
    const evidence = structuredClone(state.jobs[0]?.evidence);
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.day).toBe(2);
    expect(state.jobs[0]?.evidence).toEqual(evidence);
    expect(state.jobs.some((job) => job.status === 'offer')).toBe(true);
  });
  it('rejects old or malformed saves without pretending to migrate', () => {
    expect(() => loadGame('{"schema":"home-garage-20"}')).toThrow();
    expect(() => loadGame('{"schema":"small-works@2"}')).toThrow();
  });
});

describe('reviewed ownership and observation regressions', () => {
  it('does not count a witnessed checked courier return as an independent repair', () => {
    let state = startLesson(createGame(42));
    const jobId = state.selectedJobId;
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    const checked = dispatch(state, { type: 'verify', jobId, condition: 'movement' });
    expect(checked.ok, checked.message).toBe(true);
    state = checked.state;
    expect(state.jobs[0]?.evidence.at(-1)?.witnessedBy).toContain('sam');
    state = dispatch(state, { type: 'watch', enabled: false }).state;
    state = acceptRepairOffer(state, jobId);
    state = dispatch(state, { type: 'wait', minutes: 11 }).state;
    expect(state.jobs[0]?.status).toBe('delivered');
    expect(state.independentRepairs).toBe(0);
    expect(state.log.some((entry) => entry.text.includes('handled the whole repair'))).toBe(false);
  });
  it('does not teach an intervention outcome before a witnessed check', () => {
    let state = createGame(42);
    required(required(state.jobs[0]).model.components.find((c) => c.id === 'contact')).condition =
      'dirty';
    required(required(state.jobs[0]).model.components.find((c) => c.id === 'bulb')).condition =
      'open';
    const jobId = state.selectedJobId;
    state = startLesson(state);
    state = dispatch(state, { type: 'inspect', jobId, componentId: 'contact' }).state;
    state = dispatch(state, { type: 'power', jobId, on: false }).state;
    const request = { mode: 'continuity' as const, a: 'C', b: 'D', condition: 'bench' as const };

    state = dispatch(state, { type: 'measure', jobId, request }).state;

    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    expect(
      required(required(state.people.sam).methods).rules.some(
        (rule) => rule.action === 'clean:contact',
      ),
    ).toBe(false);

    state = dispatch(state, { type: 'measure', jobId, request }).state;
    expect(
      required(required(state.people.sam).methods).rules.some(
        (rule) => rule.action === 'clean:contact',
      ),
    ).toBe(true);
    const cleanRule = required(required(state.people.sam).methods).rules.find(
      (rule) => rule.action === 'clean:contact',
    );
    expect(required(cleanRule).evidence.at(-1)?.outcome).toBe('success');
    expect(required(state.jobs[0]).model.components.find((c) => c.id === 'bulb')?.condition).toBe(
      'open',
    );
  });
  it('blocks assigned donor salvage and duplicate removal without spending time', () => {
    let state = createGame(42);
    const donor = required(state.jobs.find((job) => job.isDonor));
    // Even an imported or artificially assigned donor must retain exclusive physical ownership.
    donor.assignedTo = 'sam';
    const before = saveGame(state);
    expect(dispatch(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' }).ok).toBe(
      false,
    );
    expect(
      saveGame(dispatch(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' }).state),
    ).toBe(before);
    state = dispatch(state, { type: 'recall', jobId: donor.id }).state;
    state = dispatch(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' }).state;
    const removed = saveGame(state);
    const again = dispatch(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' });
    expect(again.ok).toBe(false);
    expect(saveGame(again.state)).toBe(removed);
  });
  it.each(['inspected', 'evidence', 'verified', 'contributions'])(
    'rejects missing required job %s',
    (field) => {
      const saved = JSON.parse(saveGame(createGame(42)));
      delete saved.jobs[0][field];
      expect(() => loadGame(JSON.stringify(saved))).toThrow();
    },
  );
  it('rejects invalid component conditions and clocks', () => {
    const saved = JSON.parse(saveGame(createGame(42)));
    saved.jobs[0].model.components[0].condition = 'magic';
    expect(() => loadGame(JSON.stringify(saved))).toThrow();
    const clock = JSON.parse(saveGame(createGame(42)));
    clock.day = 99;
    expect(() => loadGame(JSON.stringify(clock))).toThrow();
  });
});

describe('observed use and delegated continuity', () => {
  it('accepts the owner-use check and refuses an unchecked return before time passes', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    const before = saveGame(state);
    const refused = dispatch(state, { type: 'deliver', jobId });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain('while carried');
    expect(saveGame(refused.state)).toBe(before);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    state = dispatch(state, { type: 'verify', jobId, condition: 'movement' }).state;
    expect(required(state.jobs[0]).status).toBe('ready');
    expect(dispatch(state, { type: 'deliver', jobId }).ok).toBe(true);
  });
  it('resumes a reserved NPC part exactly and refunds it on recall with a released promise', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    teachObserved(
      required(state.people.sam),
      'lesson',
      { family: 'electrical', stage: 'intake' },
      'replace:switch',
      'replacement-lesson',
      'success',
      state.now,
    );
    state = acceptRepairOffer(state, jobId);
    expect(state.npcWork.find((work) => work.personId === 'sam')?.reservedPart).toBe('switch');
    expect(state.stock.switch).toBe(0);
    const resumed = loadGame(saveGame(state));
    const action = { type: 'wait' as const, minutes: 30 };
    expect(saveGame(dispatch(resumed, action).state)).toBe(saveGame(dispatch(state, action).state));
    const recalled = dispatch(state, { type: 'recall', jobId }).state;
    expect(recalled.stock.switch).toBe(1);
    expect(
      required(recalled.people.sam).agenda.commitments.find((c) => c.targetId === jobId)?.status,
    ).toBe('released');
    const twice = dispatch(recalled, { type: 'recall', jobId });
    expect(twice.ok).toBe(false);
    expect(twice.state.stock.switch).toBe(1);
  });
  it('retains responsibility and the delivery promise when Sam asks for a demonstration', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = acceptRepairOffer(state, jobId);
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('ask-help');
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(required(state.jobs[0]).assignedTo).toBe('sam');
    expect(required(state.jobs[0]).blocked?.kind).toBe('help');
    expect(
      required(state.people.sam).agenda.commitments.find((c) => c.targetId === jobId)?.status,
    ).toBe('pending');
  });
  it('does not transfer old player notes into Sam’s received evidence', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'inspect', jobId, componentId: 'switch' }).state;
    teachObserved(
      required(state.people.sam),
      'lesson',
      { family: 'electrical', stage: 'examined', part: 'switch', signal: 'intact' },
      'replace:switch',
      'replacement-lesson',
      'success',
      state.now,
    );
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    if (state.pendingRequest) {
      const endsAt = required(state.npcWork.find((w) => w.personId === 'sam')).endsAt;
      state = dispatch(state, { type: 'wait', minutes: endsAt - state.now }).state;
    }
    state = acceptRepairOffer(state, jobId);
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('ask-help');
  });
  it('rejects malformed NPC work and nested HF state instead of sanitizing it', () => {
    const saved = JSON.parse(saveGame(createGame(42)));
    delete saved.people.sam.body.satiety;
    expect(() => loadGame(JSON.stringify(saved))).toThrow();
    const malformed = JSON.parse(saveGame(createGame(42)));
    malformed.npcWork.push({ personId: 'sam', jobId: malformed.jobs[0].id, endsAt: 550 });
    expect(() => loadGame(JSON.stringify(malformed))).toThrow();
    expect(() => loadGame(' '.repeat(2_000_001))).toThrow();
  });
});

describe('pending teaching and whole-job provenance', () => {
  const attend = (state: GameState) => {
    expect(state.watching).toBe(true);
  };
  it('preserves a pending lesson across save and requires the watcher to attend its check', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    const contact = required(
      required(state.jobs[0]).model.components.find((c) => c.id === 'contact'),
    );
    contact.condition = 'dirty';
    state = startLesson(state);
    state = dispatch(state, { type: 'power', jobId, on: false }).state;
    const request = { mode: 'continuity' as const, a: 'C', b: 'D', condition: 'bench' as const };
    attend(state);
    state = dispatch(state, { type: 'measure', jobId, request }).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    expect(required(state.jobs[0]).pendingLessons).toHaveLength(1);
    const resumed = loadGame(saveGame(state));
    expect(saveGame(resumed)).toBe(saveGame(state));
    state = dispatch(resumed, { type: 'watch', enabled: false }).state;
    state = dispatch(state, { type: 'measure', jobId, request }).state;
    expect(required(state.jobs[0]).pendingLessons).toHaveLength(1);
    expect(
      required(required(state.people.sam).methods).rules.some((r) => r.action === 'clean:contact'),
    ).toBe(false);
    state = startLesson(state);
    attend(state);
    state = dispatch(state, { type: 'measure', jobId, request }).state;
    const rule = required(required(state.people.sam).methods).rules.find(
      (r) => r.action === 'clean:contact',
    );
    expect(required(rule).evidence.at(-1)?.outcome).toBe('success');
    expect(required(state.jobs[0]).pendingLessons).toHaveLength(0);
  });
  it('credits a genuine autonomous intake, diagnosis, intervention, use check and delivery', () => {
    let state = createGame(42);
    const sam = required(state.people.sam);
    const lessons = [
      [{ family: 'electrical', stage: 'intake' }, 'inspect:switch'],
      [
        { family: 'electrical', stage: 'examined', part: 'switch', signal: 'intact' },
        'measure:switch:movement',
      ],
      [
        { family: 'electrical', stage: 'measured', part: 'switch', signal: 'high-drop' },
        'replace:switch',
      ],
      [
        { family: 'electrical', stage: 'repaired', part: 'switch', signal: 'worked' },
        'verify:movement',
      ],
    ] as const;
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(sam, 'prior-training', cues, action, `prior-${index}`, 'success', state.now);
    const jobId = state.selectedJobId;
    state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    state = dispatch(state, { type: 'wait', minutes: 76 }).state;
    expect(required(state.jobs[0]).contributions.map((c) => c.action)).toEqual([
      'intake',
      'inspect:switch',
      'measure:switch:movement',
      'replace:switch',
      'verify:movement',
    ]);
    expect(required(state.jobs[0]).status).toBe('delivered');
    expect(state.independentRepairs).toBe(1);
    expect(state.log.some((e) => e.text.includes('handled the whole repair'))).toBe(true);
  });
});

describe('measured calibration and agreed learning', () => {
  it('requires a chosen collar setting and preserves it through save', () => {
    let state = createGame(42);
    const theatre = state.jobs.find((j) => j.isPersonal);
    if (!theatre) throw new Error('Missing personal object');
    const before = state.now;
    const result = dispatch(state, {
      type: 'calibrate',
      jobId: theatre.id,
      componentId: 'governor',
      setting: 1,
    });
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.now).toBe(before + 20);
    expect(
      state.jobs.find((j) => j.id === theatre.id)?.model.components.find((c) => c.id === 'governor')
        ?.setting,
    ).toBe(1);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    const checked = dispatch(state, { type: 'verify', jobId: theatre.id, condition: 'load' });
    expect(checked.state.jobs.find((j) => j.id === theatre.id)?.status).toBe('ready');
  });
  it('makes a lesson a finite HF agreement rather than indefinite toggling', () => {
    let state = createGame(56);
    state = startLesson(state);
    expect(state.watching).toBe(true);
    expect(state.watchUntil).toBe(state.now + 90);
    state = dispatch(state, {
      type: 'inspect',
      jobId: state.selectedJobId,
      componentId: 'switch',
    }).state;
    expect(
      state.people.sam?.agenda.commitments.some(
        (c) => c.status === 'pending' && c.actions.includes('complete-lesson'),
      ),
    ).toBe(true);
    state = dispatch(state, { type: 'wait', minutes: 100 }).state;
    expect(state.watching).toBe(false);
  });
});

it('does not teach changed motion as a successful calibration', () => {
  let state = createGame(416);
  const theatre = state.jobs.find((j) => j.isPersonal);
  if (!theatre) throw new Error('Missing theatre');
  const jobId = theatre.id;
  state = dispatch(state, { type: 'calibrate', jobId, componentId: 'governor', setting: 2 }).state;
  state = startLesson(state);
  const reading = {
    type: 'measure' as const,
    jobId,
    request: { mode: 'motion' as const, a: 'B', b: 'C', condition: 'load' as const },
  };
  state = dispatch(state, reading).state;
  state = dispatch(state, { type: 'calibrate', jobId, componentId: 'governor', setting: 0 }).state;
  state = dispatch(state, reading).state;
  expect(
    state.people.sam?.methods?.rules
      .find((r) => r.action === 'calibrate:governor:0')
      ?.evidence.some((e) => e.outcome === 'success') ?? false,
  ).toBe(false);
  state = dispatch(state, { type: 'verify', jobId, condition: 'load' }).state;
  expect(
    state.people.sam?.methods?.rules
      .find((r) => r.action === 'calibrate:governor:0')
      ?.evidence.some((e) => e.outcome === 'failure'),
  ).toBe(true);
});

it('lets an attended cross-component probe procedure transfer with its actual mode and terminals', () => {
  let state = createGame(416);
  const theatre = state.jobs.find((j) => j.isPersonal);
  if (!theatre) throw new Error('Missing theatre');
  state = startLesson(state, false);
  state = dispatch(state, {
    type: 'measure',
    jobId: theatre.id,
    request: { mode: 'motion', a: '0', b: 'C', condition: 'load' },
  }).state;
  state = dispatch(state, { type: 'next-day' }).state;
  const other = state.jobs.find((j) => j.status === 'offer' && j.kind === 'music-box');
  if (!other) throw new Error('Missing unfamiliar mechanical object');
  // Transfer holds the owner's requested pace fixed; a different target is a new teaching context.
  other.model.desiredRPM = theatre.model.desiredRPM;
  other.model.tolerance = theatre.model.tolerance;
  state = dispatch(state, { type: 'accept', jobId: other.id }).state;
  state = acceptRepairOffer(state, other.id);
  state = dispatch(state, { type: 'wait', minutes: 76 }).state;
  expect(
    state.jobs
      .find((j) => j.id === other.id)
      ?.evidence.some(
        (e) =>
          e.actorId === 'sam' &&
          e.request?.mode === 'motion' &&
          e.request.a === '0' &&
          e.request.b === 'C' &&
          e.request.condition === 'load',
      ),
  ).toBe(true);
});

it('lets the organisers live through daytime needs before the gathering', () => {
  let state = createGame(42);
  state = dispatch(state, { type: 'next-day' }).state;
  const before = state.people.nora?.body.hydration ?? 1;
  state = dispatch(state, { type: 'wait', minutes: 120 }).state;
  expect(
    state.people.nora?.trace.some((record) =>
      ['eat', 'drink', 'rest', 'personal', 'leisure'].includes(record.chosenAction ?? ''),
    ),
  ).toBe(true);
  expect(state.people.nora?.body.hydration ?? 0).toBeGreaterThan(before);
});

it('completes the second preparation before the exact gathering deadline', () => {
  let state = createGame(416);
  const lantern = state.jobs[0];
  const theatre = state.jobs.find((j) => j.isPersonal);
  if (!lantern || !theatre) throw new Error('Missing retained objects');
  state = dispatch(state, {
    type: 'work',
    jobId: lantern.id,
    componentId: 'switch',
    intervention: 'replace',
  }).state;
  state = dispatch(state, { type: 'verify', jobId: lantern.id, condition: 'movement' }).state;
  state = dispatch(state, { type: 'deliver', jobId: lantern.id }).state;
  state = dispatch(state, {
    type: 'calibrate',
    jobId: theatre.id,
    componentId: 'governor',
    setting: 1,
  }).state;
  state = dispatch(state, { type: 'verify', jobId: theatre.id, condition: 'load' }).state;
  for (let i = 0; i < 3; i++) state = dispatch(state, { type: 'next-day' }).state;
  state = dispatch(state, { type: 'wait-for-site' }).state;
  state = dispatch(state, { type: 'prepare-event', format: 'garden' }).state;
  const lent = state.jobs.find((j) => j.id === lantern.id)?.model;
  expect(dispatch(state, { type: 'power', jobId: lantern.id, on: false }).ok).toBe(false);
  state = dispatch(state, { type: 'prepare-event', format: 'theatre' }).state;
  expect(state.now).toBe(5220);
  expect(state.community?.preparedFormats).toEqual(['garden', 'theatre']);
  expect(state.community?.resolvedAt).toBe(5220);
  state = dispatch(state, { type: 'wait', minutes: 30 }).state;
  expect(state.community?.phase).toBe('completed');
  expect(state.community?.reservedJobIds).toEqual([]);
  expect(state.jobs.find((j) => j.id === lantern.id)?.model).toEqual(lent);
  expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
});
