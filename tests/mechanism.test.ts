import { expect, it } from 'vitest';
import { catalogueItem } from '../src/game/catalogue';
import {
  applyRepair,
  catchActions,
  cueFor,
  inspectRepair,
  readLongCheck,
  repairDuration,
  testCatch,
} from '../src/game/repairs';
import type { Fault, RepairObject } from '../src/game/types';

function box(fault: Fault): RepairObject {
  const authored = catalogueItem('friend-4');
  if (!authored) throw Error('Missing sewing box');
  return {
    id: authored.id,
    title: authored.title,
    owner: authored.owner,
    story: authored.story,
    inspectText: authored.inspectText,
    repairText:
      fault === 'hinge'
        ? authored.repairText
        : 'The keeper now meets the freely moving catch squarely.',
    form: 'box',
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
}

it('requires the player to distinguish identical dusty catch inspections and choices using motion', () => {
  const hinge = box('hinge');
  const keeper = box('catch-offset');
  expect(inspectRepair(hinge)).toBe(inspectRepair(keeper));
  expect(hinge.evidence).toEqual(keeper.evidence);
  expect(catchActions(hinge)).toEqual(catchActions(keeper));
  expect(catchActions(hinge).map(([id]) => id)).toEqual([
    'test-catch',
    'lubricate-hinge',
    'adjust-catch',
  ]);
  expect(testCatch(hinge)).toContain('still drags');
  expect(testCatch(keeper)).toContain('pivots freely');
  expect(cueFor(hinge, 0)).toBe('hinge-stiff-clear');
  expect(cueFor(keeper, 0)).toBe('keeper-rubs');
  const parts = { batteries: 1, holders: 1, springs: 1, gears: 1 };
  expect(applyRepair(hinge, 'lubricate-hinge', parts).succeeded).toBe(true);
  expect(applyRepair(keeper, 'adjust-catch', parts).succeeded).toBe(true);
});

it.each([
  ['hinge', 'adjust-catch', 'lubricate-hinge', 'hinge-stiff-clear'],
  ['catch-offset', 'lubricate-hinge', 'adjust-catch', 'keeper-rubs'],
] as const)(
  'recovers an ordinary wrong first attempt on %s through actionable observed motion',
  (fault, wrong, right, evidence) => {
    const item = box(fault);
    inspectRepair(item);
    const parts = { batteries: 2, holders: 1, springs: 1, gears: 1 };
    const originalParts = { ...parts };
    const result = applyRepair(item, wrong, parts);
    expect(result.succeeded).toBe(false);
    expect(result.text).toContain('That step did not free');
    expect(cueFor(item, 0)).toBe(evidence);
    expect(repairDuration(wrong)).toBeGreaterThan(0);
    expect(parts).toEqual(originalParts);
    expect(item.attempted).toBe(1);
    expect(applyRepair(item, right, parts).succeeded).toBe(true);
    item.checkStarted = 20;
    expect(() => readLongCheck(item, 29)).toThrow('not ready');
    expect(readLongCheck(item, 30)).toContain('without sticking');
    expect(item.verified).toBe(true);
  },
);

it.each([
  ['hinge', 'lubricate-hinge'],
  ['catch-offset', 'adjust-catch'],
] as const)(
  'allows a correct untested guess on %s without inventing test evidence',
  (fault, step) => {
    const item = box(fault);
    inspectRepair(item);
    expect(applyRepair(item, step, { batteries: 0, holders: 0 }).succeeded).toBe(true);
    expect(item.tested).toBe(false);
    expect(item.evidence).toEqual(['catch-needs-test', 'mechanism-working']);
  },
);

it('a later request preserves the actual earlier box and cannot invent a completed repair', async () => {
  const { acceptCatchReturn, catchReturnActions } = await import('../src/game/catch-return');
  const { earnedHandoff } = await import('./support/earned-handoff');
  const { freshServiceWeek } = await import('../src/game/service-week');
  const s = earnedHandoff(true);
  s.serviceWeek = { ...freshServiceWeek(), startedAt: s.now };
  s.now = Math.floor(s.now / 1440) * 1440 + 3 * 1440 + 14 * 60;
  const original = s.objects.find((o) => o.id === 'friend-4');
  if (!original) throw Error('Missing actually returned box');
  const originalNotes = [...original.observations];
  const beforeCash = s.workshop?.cash;
  expect(catchReturnActions(s, false)).toEqual([]);
  expect(catchReturnActions(s, true).map((a) => a.id)).toEqual(['sewing-box-again']);
  const held = structuredClone(s);
  const heldBox = held.objects.find((o) => o.id === 'friend-4');
  if (!heldBox) throw Error('Missing box');
  heldBox.location = 'shelf';
  expect(catchReturnActions(held, true)).toEqual([]);
  heldBox.location = 'returned';
  heldBox.verified = false;
  expect(catchReturnActions(held, true)).toEqual([]);
  acceptCatchReturn(s, true);
  expect(s.objects.filter((o) => o.id === 'friend-4')).toHaveLength(1);
  expect(original.observations.slice(0, originalNotes.length)).toEqual(originalNotes);
  expect(original.observations.at(-1)).toContain('Earlier school-break repair');
  expect(original.story).toContain('same box');
  expect(original.fault).toBe('catch-offset');
  expect(original.verified).toBe(false);
  expect(original.checkStarted).toBeUndefined();
  expect(s.workshop?.cash).toBe(beforeCash);
  expect(catchReturnActions(s, true)).toEqual([]);
});

it('Sam’s actually taught lamp methods do not grant an unknown mechanical repair', async () => {
  const { advanceApprentice, startApprenticeJob } = await import('../src/game/apprentice');
  const { earnedHandoff } = await import('./support/earned-handoff');
  const s = earnedHandoff();
  const item = box('catch-offset');
  item.id = 'mechanical-control';
  s.objects.push(item);
  const spoken: string[] = [];
  const say = (_speaker: string, text: string) => spoken.push(text);
  startApprenticeJob(s, item, false, say);
  advanceApprentice(
    s,
    s.now + 120,
    say,
    () => true,
    () => true,
  );
  expect(item.repaired).toBe(false);
  expect(item.attempted).toBe(0);
  expect(s.apprentice?.needsHelp).toContain('unsure');
  expect(
    item.stepDecisions?.some((step) => step.action === 'request-help' || step.action === null),
  ).toBe(true);
  expect(item.stepDecisions?.some((step) => step.action === 'adjust-catch')).toBe(false);
});

it('the public private-week route revisits the same box, recovers a wrong first step and replays its completed history', async () => {
  const { getView, restoreGame, serializeGame } = await import('../src/game/engine');
  const { earnedHandoff } = await import('./support/earned-handoff');
  const { positiveAction: choose } = await import('./support/public-attendance');
  let s = earnedHandoff(true);
  const count = s.objects.length;
  const earlierBox = structuredClone(s.objects.find((o) => o.id === 'friend-4'));
  expect(earlierBox?.verified).toBe(true);
  expect(earlierBox?.location).toBe('returned');
  s = choose(s, 'service-begin');
  s = choose(s, 'service-private');
  for (let day = 0; day < 3; day++) s = choose(s, 'service-next-day');
  for (let n = 0; n < 40 && !getView(s).actions.some((a) => a.id === 'sewing-box-again'); n++)
    s = choose(s, 'wait-person');
  s = choose(s, 'sewing-box-again');
  expect(s.objects.length).toBe(count);
  s = choose(s, 'inspect');
  expect(getView(s).actions.map((a) => a.id)).toEqual(
    expect.arrayContaining(['test-catch', 'lubricate-hinge', 'adjust-catch']),
  );
  s = choose(s, 'lubricate-hinge');
  expect(getView(s).focus?.observations.at(-1)).toContain('pivots freely');
  const pending = serializeGame(s);
  expect(restoreGame(pending)).toEqual(s);
  for (const id of ['adjust-catch', 'verify', 'wait-check', 'check-result', 'return'])
    s = choose(s, id);
  const returned = s.objects.find((o) => o.id === 'friend-4');
  expect(returned?.verified).toBe(true);
  expect(returned?.location).toBe('returned');
  expect(returned?.observations.slice(0, earlierBox?.observations.length)).toEqual(
    earlierBox?.observations,
  );
  expect(s.serviceWeek?.jobs).toEqual([]);
  expect(s.workshop?.cash ?? 0).toBe(0);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
