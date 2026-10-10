import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as seven from '../src/game/engine7';
import { optionalStoryChoices, schoolStoryBeat } from '../src/game/story';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-seven-route.json';
import { finishCabinetAlignment } from './support/cabinet-route';
import { completePublicAction } from './support/public-attendance';
import { choose, nextSchoolAction, opening } from './support/school-route';

it('the actual live published-seven export matches its fixed hash before unchanged eight migration', () => {
  let old = seven.createGame(fixture.seed);
  for (const input of fixture.inputs) old = seven.transition(old, input as GameInput);
  const raw = seven.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  expect(seven.restoreGame(raw)).toEqual(old);
  let current = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...unchanged } = current;
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(old.inputs.length);
  expect(unchanged).toEqual(old);
  current = transition(current, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(current))).toEqual(current);
});
it('an actually finished childhood cabinet stays finished through the school years and its late recollection', () => {
  let s = opening(42);
  s = choose(s, 'workshop-cabinet-look');
  for (const [action, stage] of [
    ['workshop-cabinet-measure', 'measured'],
    ['workshop-cabinet-hang', 'hung'],
  ] as const) {
    for (let n = 0; n < 100 && s.workshop?.cabinet !== stage; n++) {
      s = getView(s).actions.some((a) => a.id === action) ? choose(s, action) : choose(s, 'rest');
      if (s.workshop?.cabinet !== stage) s = choose(s, 'rest');
    }
  }
  s = finishCabinetAlignment(s);
  expect(s.workshop?.cabinet).toBe('finished');
  for (let n = 0; n < 150 && (s.campaign?.holiday ?? 0) < 3; n++)
    s = choose(s, nextSchoolAction(s));
  expect(s.workshop?.cabinet).toBe('finished');
  const year = s.conversation.findLast((l) => l.text.includes('By the next summer'));
  expect(year?.text).toContain('doors you finished');
  const chats = optionalStoryChoices({
    chapter: 'garage',
    focusId: null,
    unlocked: ['story:ask-dad-bench'],
    holiday: 3,
    cabinetStage: s.workshop?.cabinet,
  });
  const recollection = chats.find((c) => c.id === 'dad-cabinet');
  expect(recollection?.label).toContain('finished together');
  expect(recollection?.lines.map((l) => l.text).join(' ')).not.toContain(
    'two doors against the wall',
  );
  expect(
    schoolStoryBeat(3, 'hung')
      .map((l) => l.text)
      .join(' '),
  ).toContain('wait for their final alignment');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('late conversations respect Sam’s earlier graduation and the player’s actual working stage', () => {
  const chats = optionalStoryChoices({
    chapter: 'garage',
    focusId: 'friend-5',
    focusOwner: 'Sam',
    unlocked: ['story:ask-sam-string', 'story:ask-dad-bench'],
    holiday: 4,
    graduated: true,
    cabinetStage: 'finished',
  });
  const sam = chats
    .find((c) => c.id === 'sam-work')
    ?.lines.map((l) => l.text)
    .join(' ');
  expect(sam).toContain('School is finished for me');
  expect(sam).not.toContain('I still have school');
  const dad = chats
    .find((c) => c.id === 'garage-shared')
    ?.lines.map((l) => l.text)
    .join(' ');
  expect(dad).toContain('School is finished now');
  expect(dad).not.toContain('between school terms');
  const school = chats
    .find((c) => c.id === 'sam-school-next')
    ?.lines.map((l) => l.text)
    .join(' ');
  expect(school).toContain('I finished before you');
});
it('the next authored visitor’s known routine is heard on school re-entry and can be waited for without creating a visit agreement', () => {
  let s = opening(42);
  s = choose(s, 'accept-request');
  for (const action of ['inspect', 'test-battery', 'clean-contact', 'verify'])
    s = choose(s, action);
  s = completePublicAction(
    s,
    'wait-check',
    (state) => !getView(state).actions.some((a) => a.id === 'wait-check'),
  );
  s = choose(s, 'check-result');
  s = choose(s, 'return');
  expect(s.requests).toBe(1);
  s = choose(s, 'back-to-school');
  expect(s.now % 1440).toBe(540);
  expect(s.conversation.at(-1)?.text).toContain('usual counter morning ends at one');
  expect(s.unlocked).toContain('known-request:1');
  const wait = getView(s).actions.find((a) => a.id === 'wait-appointment');
  expect(wait?.label).toContain('usual free time');
  expect(wait?.detail).toMatch(/not an (arranged visit|agreed bench session)/);
  const count = s.objects.length,
    repairs = s.repairs;
  s = choose(s, 'wait-appointment');
  expect(s.now % 1440).toBe(13 * 60);
  expect(s.objects.length).toBe(count);
  expect(s.repairs).toBe(repairs);
  for (const p of Object.values(s.people)) expect(p.now).toBe(s.now);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('an evening agreement names its actual upper end instead of pretending it is late afternoon or an unkept dog duty', async () => {
  const { createPerson } = await import('@adam0white/human-framework');
  const { arrangeLearning } = await import('../src/game/apprentice');
  const { createGame } = await import('../src/game/engine');
  const s = createGame(42);
  s.now = 18 * 60;
  s.people.sam = createPerson({
    id: 'sam',
    name: 'Sam',
    sex: 'male',
    seed: 42,
    now: s.now,
    bornAt: -19 * 365 * 1440,
    needs: { competence: 0.02, belonging: 0.02 },
    body: { exertion: 0, sleepPressure: 0 },
  });
  const lines: string[] = [];
  arrangeLearning(s, (_, text) => lines.push(text));
  expect(s.apprentice?.arranged).toBe(true);
  expect(s.apprentice?.visitUntil).toBe(20 * 60 + 30);
  expect(lines.join(' ')).toContain('20:30');
  expect(lines.join(' ')).not.toContain('late afternoon');
  expect(lines.join(' ')).not.toContain('dog still needs me later');
});
it('a completed cabinet does not turn Dad’s actual space refusal into a claim about unfinished cabinet parts', async () => {
  const { applyWorkshopAction, freshWorkshop } = await import('../src/game/workshop');
  const s = opening(42);
  s.workshop = freshWorkshop();
  s.workshop.cabinet = 'finished';
  s.workshop.referral = 'permitted';
  const result = applyWorkshopAction(s, 'workshop-intake-space', {
    graduated: true,
    independentRepair: true,
    paidHelpEligible: true,
    dadHere: true,
    noraHere: true,
    samHere: true,
    dadWillWork: () => false,
    dadWorkReason: () => 'I am too tired to give this careful attention now.',
  });
  expect(result?.lines.map((l) => l.text).join(' ')).toContain('too tired');
  expect(result?.lines.map((l) => l.text).join(' ')).not.toContain('cabinet parts today');
  expect(s.workshop.intakeSpace).toBe(false);
});
