import { expect, it } from 'vitest';
import { REPAIR_CATALOGUE } from '../src/game/catalogue';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import {
  applyRepair,
  inspectRepair,
  pathTorchActions,
  performPathTorchUseCheck,
  readLongCheck,
  testPathTorchCap,
  testRepair,
} from '../src/game/repairs';
import type { Fault, RepairObject } from '../src/game/types';
import { completePublicAction } from './support/public-attendance';
import { choose, opening } from './support/school-route';

function torch(fault: Fault = 'cap'): RepairObject {
  const spec = REPAIR_CATALOGUE.find((item) => item.id === 'friend-1');
  if (!spec) throw Error('Missing torch');
  return {
    id: spec.id,
    title: spec.title,
    owner: spec.owner,
    story: spec.story,
    form: 'torch',
    fault,
    location: 'bench',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
    inspectText: spec.inspectText,
  };
}
it('the path torch offers the same hypotheses without revealing its hidden cause during inspection', () => {
  const cap = torch();
  const contact = torch('contact');
  expect(inspectRepair(cap)).toBe(inspectRepair(contact));
  expect(cap.evidence).toEqual(['needs-test']);
  expect(pathTorchActions(cap)).toEqual(pathTorchActions(contact));
  expect(pathTorchActions(cap).map(([id]) => id)).toContain('path-torch-test-cap');
});
it('the controlled battery and cap tests distinguish possible causes through retained observations', () => {
  const cap = torch();
  const contact = torch('contact');
  const battery = torch('battery');
  for (const item of [cap, contact, battery]) inspectRepair(item);
  expect(testRepair(cap)).toBe(testRepair(contact));
  expect(cap.evidence?.at(-1)).toBe('still-flickers');
  const capResult = testPathTorchCap(cap);
  const contactResult = testPathTorchCap(contact);
  expect(capResult).toContain('only while');
  expect(contactResult).toContain('still flickers');
  expect(cap.evidence?.at(-1)).toBe('crooked-cap');
  expect(contact.evidence?.at(-1)).toBe('still-flickers');
  expect(testPathTorchCap(battery)).toContain('weak');
  expect(testRepair(battery)).toContain('steady');
  expect(cap.repaired).toBe(false);
});
it('repair guesses remain possible but only the matching adjustment restores function', () => {
  const item = torch();
  inspectRepair(item);
  const failed = applyRepair(item, 'clean-contact', { batteries: 1, holders: 0 });
  expect(failed.succeeded).toBe(false);
  expect(failed.text).not.toContain('must');
  expect(failed.text).not.toContain('thread carries');
  expect(item.repaired).toBe(false);
  expect(applyRepair(item, 'twist-cap', { batteries: 1, holders: 0 }).succeeded).toBe(true);
  expect(item.verified).toBe(false);
});
it('the path torch needs six attended minutes of ordinary use, not an unattended light run', () => {
  const item = torch();
  expect(() => performPathTorchUseCheck(item, 0, 6)).toThrow();
  applyRepair(item, 'twist-cap', { batteries: 0, holders: 0 });
  expect(() => performPathTorchUseCheck(item, 0, 5)).toThrow();
  expect(item.verified).toBe(false);
  item.checkStarted = 0;
  expect(() => readLongCheck(item, 1000)).toThrow('attended');
  expect(item.verified).toBe(false);
  expect(performPathTorchUseCheck(item, 0, 6)).toContain('grip');
  expect(item.verified).toBe(true);
  expect(item.evidence?.at(-1)).toBe('checked');
});

it('public play retains selected cap-test evidence and spends six actual minutes checking the repaired torch', () => {
  let s = opening(42);
  const accept = () => {
    for (let n = 0; n < 20 && !getView(s).actions.some((a) => a.id === 'accept-request'); n++)
      s = choose(
        s,
        getView(s).actions.some((a) => a.id === 'wait-appointment')
          ? 'wait-appointment'
          : 'wait-person',
      );
    s = choose(s, 'accept-request');
  };
  accept();
  for (const id of ['inspect', 'test-battery', 'clean-contact', 'verify']) s = choose(s, id);
  s = completePublicAction(
    s,
    'wait-check',
    (state) => !getView(state).actions.some((a) => a.id === 'wait-check'),
  );
  s = choose(s, 'check-result');
  s = choose(s, 'return');
  accept();
  s = choose(s, 'inspect');
  expect(s.focusId).toBe('friend-1');
  s = choose(s, 'test-battery');
  const beforeTest = s.now;
  s = choose(s, 'path-torch-test-cap');
  // Three minutes to fit, four to compare, three to retain the cap again.
  expect(s.now - beforeTest).toBe(10);
  expect(s.objects.find((o) => o.id === 'friend-1')?.observations.at(-1)).toContain('only while');
  expect(s.objects.find((o) => o.id === 'friend-1')?.evidence?.at(-1)).toBe('crooked-cap');
  expect(restoreGame(serializeGame(s))).toEqual(s);
  s = choose(s, 'twist-cap');
  s = choose(s, 'verify');
  expect(getView(s).actions.some((a) => a.id === 'check-result')).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'wait-check')).toBe(false);
  expect(getView(s).note).toContain('six minutes');
  expect(getView(s).note).toContain('with you present');
  expect(getView(s).note).not.toContain('Tea, waiting');
  s = transition(s, { type: 'action', id: 'rest' });
  expect(s.objects.find((o) => o.id === 'friend-1')?.verified).toBe(false);
  expect(getView(s).note).toContain('still needs six minutes');
  expect(getView(s).note).not.toContain('ready to read');
  const beforeCheck = s.now;
  s = choose(s, 'check-result');
  expect(s.now - beforeCheck).toBe(6);
  expect(s.objects.find((o) => o.id === 'friend-1')?.verified).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
