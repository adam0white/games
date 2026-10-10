import {
  createPerson,
  demonstrateMethod,
  receiveMethodCues,
  tick,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { advanceApprentice, freshApprentice, startApprenticeJob } from '../src/game/apprentice';
import { createGame, transition } from '../src/game/engine';
import { agreeCheckedCollection } from '../src/game/practices';
import type { RepairCue } from '../src/game/repairs';
import type { Fault, GameState, RepairObject } from '../src/game/types';

function fixture(fault: Fault): GameState {
  const s = createGame(51);
  s.people.sam = createPerson({
    id: 'sam',
    name: 'Sam',
    seed: 42,
    now: 840,
    bornAt: 840 - 19 * 365 * 1440,
    sex: 'male',
    relationships: [{ otherId: 'player', roles: ['friend'] }],
    retention: { trace: 32, chronicleDays: 31 },
  });
  s.apprentice = {
    ...freshApprentice(),
    arranged: true,
    visitUntil: 1100,
    supervisedCompleted: true,
  };
  const object: RepairObject = {
    id: `heldout-${fault}`,
    owner: 'Nora',
    title: 'An unfamiliar porch light',
    story: 'Another appearance; the same observed diagnostic structure.',
    form: 'lamp',
    fault,
    location: 'bench',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
  };
  s.objects.push(object);
  s.focusId = object.id;
  return s;
}
function teach(s: GameState, alternative = false) {
  const p = s.people.sam;
  if (!p) throw Error('Missing Sam');
  const steps: [RepairCue, string][] = [
    ['intake', 'inspect'],
    ['needs-test', alternative ? 'clean-contact' : 'test-battery'],
    ['battery-steady', 'replace-battery'],
    ['still-flickers', 'clean-contact'],
    ['light-steady', 'verify'],
    ['check-running', 'wait-check'],
    ['check-ready', 'check-result'],
    ['checked', 'return'],
  ];
  for (const [cue, action] of steps)
    for (let n = 0; n < 1; n++) {
      receiveMethodCues(p, { contextId: 'lesson', cues: [{ cue: 'stage', value: cue }] });
      expect(
        demonstrateMethod(p, {
          id: 'careful-light-repair',
          demonstrationId: `${cue}:${n}`,
          contextId: 'lesson',
          conditions: [{ cue: 'stage', value: cue }],
          action,
          sourceId: 'player',
          outcome: 'success',
        }),
      ).toBe(true);
    }
}
function run(s: GameState) {
  const object = s.objects.at(-1);
  if (!object) throw Error('Missing job');
  startApprenticeJob(s, object, false, () => {});
  advanceApprentice(
    s,
    950,
    () => {},
    () => true,
  );
  s.now = 950;
  return object;
}
it('HF-acquired methods complete two unfamiliar supported faults through independent owner handback', () => {
  for (const fault of ['battery', 'contact'] as const) {
    const s = fixture(fault);
    teach(s);
    const item = run(s);
    expect(item.location).toBe('returned');
    expect(item.verified).toBe(true);
    expect(item.completedBy).toBe('sam');
    expect(s.apprentice?.completedJobIds).toEqual([item.id]);
    expect(item.stepDecisions?.every((d) => d.methods.length > 0)).toBe(true);
  }
});
it('withheld and skill-only controls keep identical offers and fail to establish the same independent repair', () => {
  for (const skillOnly of [false, true]) {
    const s = fixture('battery');
    if (skillOnly) {
      const skill = s.people.sam?.skills.repair;
      if (skill) skill.level = 0.95;
      else if (s.people.sam)
        s.people.sam.skills.repair = { level: 0.95, practice: 10000, lastPracticed: 840 };
    }
    const item = run(s);
    expect(item.completedBy).not.toBe('sam');
    expect(s.apprentice?.completedJobIds).toEqual([]);
    expect(item.stepDecisions?.flatMap((d) => d.methods)).toEqual([]);
    expect(s.apprentice?.needsHelp).toBeTruthy();
  }
});
it('a valid alternative taught sequence changes the acquired step choice under the same host fault and offers', () => {
  const usual = fixture('contact'),
    alternative = fixture('contact');
  teach(usual);
  teach(alternative, true);
  const one = run(usual),
    two = run(alternative);
  expect(one.verified).toBe(true);
  expect(two.verified).toBe(true);
  expect(one.stepDecisions?.[1]?.action).toBe('test-battery');
  expect(two.stepDecisions?.[1]?.action).toBe('clean-contact');
});
it('out-of-scope broken holder evidence elicits genuine help instead of a fictional expertise bonus', () => {
  const s = fixture('holder');
  teach(s);
  const item = run(s);
  expect(item.inspected).toBe(true);
  expect(item.repaired).toBe(false);
  expect(item.stepDecisions?.at(-1)?.action).toBe('request-help');
  expect(s.apprentice?.completedJobIds).toEqual([]);
});

it('partial inspection and rescued work remain assisted after repeated delegation', () => {
  const s = fixture('battery');
  const item = s.objects.at(-1);
  if (!item) throw Error('Missing job');
  item.inspected = true;
  startApprenticeJob(s, item, false, () => {});
  expect(item.independent).toBe(false);
  expect(item.playerAssisted).toBe(true);
  item.inspected = false;
  startApprenticeJob(s, item, false, () => {});
  expect(item.independent).toBe(false);
});

it('owner presence is queried at the actual Sam handback event, not the outer elapsed target', () => {
  const s = fixture('battery');
  teach(s);
  const item = s.objects.at(-1);
  if (!item) throw Error('Missing job');
  startApprenticeJob(s, item, false, () => {});
  const times: number[] = [];
  advanceApprentice(
    s,
    950,
    () => {},
    (_id, at) => {
      times.push(at);
      return at >= 940;
    },
  );
  expect(times[0]).toBe(892);
  expect(times.at(-1)).toBe(940);
  expect(times[0]).toBeLessThan(940);
  expect(item.awaitingCollection).toBe(false);
  expect(item.collectedAt).toBe(940);
  expect(s.apprentice?.independentCompleted).toBe(1);
});

it('a handback inside a watch interval keeps the promise at the real event time', () => {
  let s = fixture('battery');
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  teach(s);
  const item = s.objects.at(-1);
  if (!item) throw Error('Missing item');
  startApprenticeJob(s, item, false, () => {});
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  agreeCheckedCollection(player, item.id, 'nora', 895);
  for (let n = 0; n < 3; n++) s = transition(s, { type: 'action', id: 'watch-sam' });
  const returned = s.objects.find((x) => x.id === item.id);
  if (!returned) throw Error('Missing returned item');
  expect(returned.collectedAt).toBeLessThan(895);
  expect(
    s.people.player?.agenda.commitments.find((c) => c.label === `Checked collection: ${item.id}`)
      ?.status,
  ).toBe('kept');
});
it('an actual worker absence pauses the current step and preserves work until return', () => {
  const s = fixture('battery');
  teach(s);
  const item = s.objects.at(-1);
  if (!item) throw Error('Missing item');
  startApprenticeJob(s, item, false, () => {});
  const present = (at: number) => at < 845 || at >= 1020;
  advanceApprentice(
    s,
    900,
    () => {},
    () => true,
    present,
  );
  expect(item.inspected).toBe(true);
  expect(item.tested).toBe(false);
  expect(item.repaired).toBe(false);
  expect(s.apprentice?.pausedStep).toBeTruthy();
  expect(s.apprentice?.completedJobIds).toEqual([]);
  advanceApprentice(
    s,
    1020,
    () => {},
    () => true,
    present,
  );
  advanceApprentice(
    s,
    1090,
    () => {},
    () => true,
    present,
  );
  expect(item.verified).toBe(true);
  expect(item.completedBy).toBe('sam');
});
it('a player taking the last spare reserves it before concurrent Sam work, without crashing a visible action', () => {
  let s = fixture('battery');
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  teach(s);
  const job = s.objects.at(-1);
  if (!job) throw Error('Missing job');
  job.inspected = true;
  job.tested = true;
  job.evidence = ['battery-steady'];
  startApprenticeJob(s, job, false, () => {});
  const playerItem: RepairObject = {
    ...job,
    id: 'player-spare',
    assignedTo: undefined,
    stepDecisions: [],
    observations: [],
    evidence: ['battery-steady'],
  };
  s.objects.push(playerItem);
  s.focusId = playerItem.id;
  s.parts.batteries = 1;
  s = transition(s, { type: 'action', id: 'replace-battery' });
  expect(s.parts.batteries).toBe(0);
  expect(s.objects.find((o) => o.id === playerItem.id)?.repaired).toBe(true);
  expect(s.objects.find((o) => o.id === job.id)?.repaired).toBe(false);
});

it('a material disappearing after Sam begins a step causes an honest saved stop, not a crash or invented repair', () => {
  let s = fixture('battery');
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  teach(s);
  const job = s.objects.at(-1);
  if (!job) throw Error('Missing job');
  job.inspected = true;
  job.tested = true;
  job.evidence = ['battery-steady'];
  startApprenticeJob(s, job, false, () => {});
  s.parts.batteries = 1;
  advanceApprentice(
    s,
    844,
    () => {},
    () => true,
  );
  expect(s.apprentice?.pending?.step).toBe('replace-battery');
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  tick(player, 844);
  s.now = 844;
  const playerItem: RepairObject = {
    ...job,
    id: 'player-in-flight-spare',
    assignedTo: undefined,
    stepDecisions: [],
    observations: [],
    evidence: ['battery-steady'],
  };
  s.objects.push(playerItem);
  s.focusId = playerItem.id;
  s = transition(s, { type: 'action', id: 'replace-battery' });
  expect(s.parts.batteries).toBe(0);
  expect(s.objects.find((o) => o.id === playerItem.id)?.repaired).toBe(true);
  expect(s.objects.find((o) => o.id === job.id)?.repaired).toBe(false);
  expect(s.apprentice?.pending).toBeUndefined();
  expect(s.apprentice?.needsHelp).toContain('matching part');
  expect(s.apprentice?.completedJobIds).toEqual([]);
});
