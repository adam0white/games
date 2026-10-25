import { readPerson, restore, snapshot } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  agreeLearningSession,
  choiceSpeech,
  chooseActivity,
  createPeople,
  describePerson,
  finishActivity,
  prepareMorning,
  promiseJob,
  reportDelivery,
  startActivity,
  teachObserved,
  tickPeople,
} from '../src/game/people';
import type { WorkOption } from '../src/game/types';

const now = 600;
const cues = { contact: 'dirty', family: 'electrical' };
const option = (action: string, effort = 0.15): WorkOption => ({
  id: action,
  action,
  label: action,
  duration: 10,
  effort,
});
const options = [
  'clean:contact',
  'replace:contact',
  'inspect:contact',
  'ask-help',
  'rest',
  'personal',
].map((a) => option(a, a === 'rest' ? 0 : 0.15));
const sam = () => {
  const person = createPeople(72, now).sam;
  if (!person) throw new Error('Missing Sam');
  return person;
};
describe('published HF workshop adapter', () => {
  it('an awake break records actual rest and never claims to relieve sleep pressure', () => {
    const p = sam();
    p.body.exertion = 0.75;
    p.body.sleepPressure = 0.6;
    const rest = { ...option('rest', 0), duration: 30 };
    chooseActivity(p, 'break', {}, [rest], now);
    expect(startActivity(p, rest, now)).toBe(true);
    const bodyStart = p.body.sleepPressure;
    const restStart = p.activity?.needsAtStart.rest;
    expect(p.activity?.affordance.advertises.sleep).toBeUndefined();
    tickPeople({ sam: p }, now + 30);
    const actualRest = readPerson(p).needs.find((n) => n.id === 'rest')?.level;
    const report = finishActivity(p, rest, true, now + 30);
    expect(p.body.sleepPressure).toBeGreaterThan(bodyStart);
    const outcome = p.memory.expectations.find((e) => e.key === 'rest@break');
    expect(outcome?.needs.sleep).toBeUndefined();
    expect(report?.realized.rest).toBeCloseTo((actualRest ?? 0) - (restStart ?? 0));
    expect(outcome?.needs.rest).toBeLessThan(0.7);
    expect(outcome?.needs.rest).not.toBe(0.7);
  });
  it('a real night records its measured physiological recovery', () => {
    const p = sam();
    p.body.sleepPressure = 0.85;
    p.body.exertion = 0.75;
    const sleep = { ...option('sleep', 0), duration: 600 };
    chooseActivity(p, 'home', {}, [sleep], now);
    expect(startActivity(p, sleep, now)).toBe(true);
    const startSleep = p.activity?.needsAtStart.sleep ?? 0;
    const pressure = p.body.sleepPressure;
    expect(p.body.asleep).toBe(true);
    tickPeople({ sam: p }, now + sleep.duration);
    const measuredSleep = readPerson(p).needs.find((n) => n.id === 'sleep')?.level ?? 0;
    const report = finishActivity(p, sleep, true, now + sleep.duration);
    expect(p.body.asleep).toBe(false);
    expect(p.body.sleepPressure).toBeLessThan(pressure);
    expect(report?.realized.sleep).toBeCloseTo(measuredSleep - startSleep);
    expect(report?.realized.sleep).toBeGreaterThan(0);
    expect(report?.realized.sleep).not.toBe(0.9);
    expect(report?.realized.rest).not.toBe(0.7);
  });
  it('still supplies actual food and water through native body consumption', () => {
    const p = sam();
    p.body.satiety = 0.2;
    p.body.hydration = 0.2;
    const eat = { ...option('eat', 0), duration: 25 };
    const before = { satiety: p.body.satiety, hydration: p.body.hydration };
    chooseActivity(p, 'kitchen', {}, [eat], now);
    expect(startActivity(p, eat, now)).toBe(true);
    const report = finishActivity(p, eat, true, now + 25);
    expect(p.body.satiety).toBeGreaterThan(before.satiety);
    expect(p.body.hydration).toBeGreaterThan(before.hydration);
    expect(report?.realized.food).toBeGreaterThan(0);
    expect(report?.realized.water).toBeGreaterThan(0);
  });
  it('records Sam and the actual object title when Sam returns an object', () => {
    const owner = createPeople(72, now).nora;
    if (!owner) throw new Error('Missing owner');
    const playerBefore = structuredClone(
      owner.social.relationships.find((r) => r.otherId === 'player'),
    );
    reportDelivery(owner, 'object-44', 'checked', now, 'sam', 'Nora’s reading light');
    expect(
      owner.memory.episodes.some(
        (e) =>
          e.actorId === 'sam' &&
          e.targetId === 'object-44' &&
          e.summary.includes('Nora’s reading light'),
      ),
    ).toBe(true);
    expect(owner.social.relationships.find((r) => r.otherId === 'sam')).toBeDefined();
    expect(owner.social.relationships.find((r) => r.otherId === 'player')).toEqual(playerBefore);
  });
  it('keeps probe geometry and governor settings in learned instructions', () => {
    const p = sam();
    teachObserved(
      p,
      'job',
      { stage: 'examined' },
      'probe:voltage:cell-plus:switch-out:load',
      'geometry',
      'success',
      now,
    );
    teachObserved(
      p,
      'job',
      { signal: 'slow-drive' },
      'calibrate:governor:3',
      'collar',
      'success',
      now,
    );
    expect(describePerson(p).learned[0]).toContain(
      'voltage between cell plus and switch out while the object works harder',
    );
    expect(describePerson(p).learned[1]).toContain('set the speed control ring to 3');
    const thirsty = sam();
    thirsty.body.hydration = 0.2;
    const drink = { ...option('drink', 0), duration: 5 };
    const choice = chooseActivity(thirsty, 'workshop', {}, [drink, option('personal')], now);
    expect(choiceSpeech(thirsty, choice)).toBe(
      'I need water. I’ll get a drink before carrying on.',
    );
    expect(startActivity(thirsty, drink, now)).toBe(true);
    const food = thirsty.body.satiety;
    finishActivity(thirsty, drink, true, now + 5);
    expect(thirsty.body.hydration).toBeGreaterThan(0.85);
    expect(thirsty.body.satiety).toBeLessThan(food);
  });

  it('explains diagnostic cues without changing conditional scope', () => {
    const p = sam();
    teachObserved(
      p,
      'job',
      { part: 'switch', signal: 'high-drop', family: 'electrical', stage: 'measured' },
      'replace:switch',
      'drop',
      'success',
      now,
    );
    const description = describePerson(p).learned[0];
    expect(description).toContain('the voltage falls a lot between the two test points');
    expect(description).toContain('replace the switch');
    expect(description).toContain('after testing');
    expect(description).not.toContain('family is');
    expect(description).not.toContain('high drop');
  });

  it('explains learned use tests and every successful condition without mutating the person', () => {
    const p = sam();
    teachObserved(
      p,
      'job',
      { stage: 'checked-bench-movement', signal: 'steady-output', family: 'electrical' },
      'verify:load',
      'checks',
      'success',
      now,
    );
    const before = snapshot(p);
    const description = describePerson(p).learned[0];
    expect(description).toContain('test the object while the object works harder');
    expect(description).toContain(
      'after successful tests on the table and while carrying the object',
    );
    expect(description).not.toMatch(/verify the load|checked bench|steady output/);
    expect(snapshot(p)).toEqual(before);
  });

  it('keeps future appointments out of morning fulfillment and speech', () => {
    const p = sam();
    prepareMorning(p, 0);
    const personal = option('personal', 0);
    const choice = chooseActivity(p, 'job', {}, [personal], now);
    expect(Object.keys(choice.terms).some((k) => k.startsWith('commitment:'))).toBe(false);
    expect(startActivity(p, personal, now)).toBe(true);
    expect(p.activity?.affordance.fulfills).toEqual([]);
    expect(choiceSpeech(p, choice)).not.toContain('promised');
    finishActivity(p, personal, true, now + 10);
    expect(p.agenda.commitments.find((c) => c.actions.includes('personal'))?.status).toBe(
      'pending',
    );
  });
  it('traces meal pressure after native overnight metabolism', () => {
    const p = sam();
    const inspect = option('inspect:contact', 0.1);
    teachObserved(
      p,
      'lesson',
      { stage: 'intake', family: 'electrical' },
      inspect.action,
      'inspect',
      'success',
      now,
    );
    tickPeople({ sam: p }, 18 * 60);
    const sleep = { ...option('sleep', 0), duration: 15 * 60 };
    chooseActivity(p, 'home', {}, [sleep], p.now);
    startActivity(p, sleep, p.now);
    finishActivity(p, sleep, true, 1440 + 9 * 60);
    prepareMorning(p, 1440);
    const eat = { ...option('eat', 0), duration: 25 };
    const drink = { ...option('drink', 0), duration: 5 };
    const offers = [
      eat,
      drink,
      inspect,
      option('ask-help', 0),
      option('personal', 0),
      option('rest', 0),
    ];
    const records = [];
    for (let turn = 0; turn < 5; turn++) {
      const choice = chooseActivity(
        p,
        'job',
        { stage: turn < 2 ? 'intake' : 'examined', family: 'electrical' },
        offers,
        p.now,
      );
      records.push({
        at: p.now,
        chosen: choice.chosenId,
        food: p.body.satiety,
        water: p.body.hydration,
        terms: choice.terms,
      });
      const selected = offers.find((o) => o.id === choice.chosenId);
      if (!selected) throw new Error('No chosen option');
      startActivity(p, selected, p.now);
      finishActivity(p, selected, true, p.now + selected.duration);
    }
    expect(records.map((r) => r.chosen)).toEqual([
      'eat',
      'inspect:contact',
      'ask-help',
      'drink',
      'ask-help',
    ]);
    expect(records[3]?.terms['need:water']).toBeGreaterThan(0);
    expect(records[3]?.terms['need:food']).toBeUndefined();
    expect(records[4]?.water).toBeGreaterThan(0.95);
    expect(records[4]?.food).toBeLessThan(records[3]?.food ?? 0);
    expect(records[3]?.water).toBeLessThan(0.5);
    expect(
      records.every((r) => !Object.keys(r.terms).some((k) => k.startsWith('commitment:'))),
    ).toBe(true);
  });

  it('agrees to a lesson and keeps its promise pending through partial observations', () => {
    const p = sam();
    const agreement = agreeLearningSession(p, 'lesson', 90, now);
    expect(agreement.accepted).toBe(true);
    const observe = { ...option('observe', 0.02), duration: 10 };
    const alternatives = [observe, option('rest', 0), option('eat', 0), option('personal', 0.05)];
    for (let elapsed = 0; elapsed < 90; elapsed += 10) {
      expect(chooseActivity(p, 'lesson', {}, alternatives, now + elapsed).chosenId).toBe('observe');
      expect(startActivity(p, observe, now + elapsed)).toBe(true);
      finishActivity(p, observe, true, now + elapsed + 10);
      const commitment = p.agenda.commitments.find((c) => c.actions.includes('complete-lesson'));
      expect(commitment?.status).toBe(elapsed === 80 ? 'kept' : 'pending');
    }
    const interrupted = sam();
    expect(agreeLearningSession(interrupted, 'lesson', 90, now).accepted).toBe(true);
    interrupted.body.exertion = 0.99;
    interrupted.body.sleepPressure = 0.12;
    expect(chooseActivity(interrupted, 'lesson', {}, alternatives, now + 1).chosenId).toBe('rest');
    const tired = sam();
    tired.body.exertion = 0.98;
    tired.body.sleepPressure = 0.12;
    expect(agreeLearningSession(tired, 'lesson', 90, now).accepted).toBe(false);
  });
  it('records customer experience and readable acquired methods', () => {
    const checked = sam();
    const unfinished = sam();
    const late = sam();
    reportDelivery(checked, 'repair', 'checked', now);
    reportDelivery(unfinished, 'repair', 'unfinished', now);
    reportDelivery(late, 'repair', 'late', now);
    const relation = (p: typeof checked) =>
      p.social.relationships.find((r) => r.otherId === 'player');
    expect(relation(checked)?.trust).toBeGreaterThan(relation(unfinished)?.trust ?? 0);
    expect(relation(unfinished)?.trust).toBeGreaterThan(relation(late)?.trust ?? 0);
    expect(checked.memory.episodes.length).toBeGreaterThan(0);
    teachObserved(checked, 'job', cues, 'clean:contact', 'one', 'success', now);
    expect(describePerson(checked).learned[0]).toContain('clean the contact');
  });

  it('chooses to observe fresh and recovers through two real HF nights', () => {
    const p = sam();
    const observe = option('observe', 0.02);
    const rest = option('rest', 0);
    const eat = option('eat', 0);
    expect(
      chooseActivity(p, 'watch', {}, [observe, rest, eat, option('personal', 0.05)], now).chosenId,
    ).toBe('observe');
    for (let day = 0; day < 2; day++) {
      const bedtime = day * 1440 + 22 * 60;
      p.body.sleepPressure = 0.85;
      p.body.exertion = 0.85;
      const sleep = { ...option('sleep', 0), duration: 10 * 60 };
      chooseActivity(p, 'night', {}, [sleep], bedtime);
      expect(startActivity(p, sleep, bedtime)).toBe(true);
      expect(p.body.asleep).toBe(true);
      tickPeople({ sam: p }, bedtime + sleep.duration);
      finishActivity(p, sleep, true, bedtime + sleep.duration);
      expect(p.body.asleep).toBe(false);
      expect(p.body.sleepPressure).toBeLessThan(0.3);
      expect(p.body.exertion).toBeLessThan(0.3);
      chooseActivity(p, 'breakfast', {}, [eat], p.now);
      expect(startActivity(p, eat, p.now)).toBe(true);
      finishActivity(p, eat, true, p.now + eat.duration);
      expect(p.body.satiety).toBeGreaterThan(0.6);
    }
  });
  it('records own afternoon routine once per day and lets it compete', () => {
    const p = sam();
    prepareMorning(p, 0);
    prepareMorning(p, 0);
    expect(
      p.agenda.commitments.filter((c) => c.label === 'Help my sister with her move'),
    ).toHaveLength(1);
    expect(
      chooseActivity(p, 'job', {}, [option('personal'), option('ask-help')], 16 * 60 + 45).chosenId,
    ).toBe('personal');
    prepareMorning(p, 1440);
    expect(p.agenda.commitments.filter((c) => c.label === 'Meet the bike club')).toHaveLength(1);
  });

  it('requires matching received cues and lets contrary evidence weaken a method', () => {
    const p = sam();
    teachObserved(p, 'job', cues, 'clean:contact', 'success', 'success', now);
    expect(chooseActivity(p, 'job', { contact: 'good' }, options, now).chosenId).toBe('ask-help');
    teachObserved(p, 'job', cues, 'clean:contact', 'failure', 'failure', now);
    expect(chooseActivity(p, 'job', cues, options, now).chosenId).toBe('ask-help');
  });

  it('chooses acquired conditional actions over unfamiliar alternatives', () => {
    const novice = sam();
    const clean = sam();
    const replace = sam();
    teachObserved(clean, 'lesson', cues, 'clean:contact', 'clean-1', 'success', now);
    teachObserved(replace, 'lesson', cues, 'replace:contact', 'replace-1', 'success', now);
    const unknown = chooseActivity(novice, 'new-job', cues, options, now);
    const taught = chooseActivity(clean, 'new-job', cues, options, now);
    const alternative = chooseActivity(replace, 'new-job', cues, options, now);
    expect(unknown.chosenId).toBe('ask-help');
    expect(taught.chosenId).toBe('clean:contact');
    expect(alternative.chosenId).toBe('replace:contact');
    expect(Object.keys(taught.terms).some((k) => k.startsWith('method:'))).toBe(true);
  });
  it('acquires no rule without received cues and ignores duplicate demonstrations', () => {
    const p = sam();
    expect(teachObserved(p, 'job', {}, 'clean:contact', 'missing', 'success', now)).toBe(false);
    expect(p.methods?.rules ?? []).toHaveLength(0);
    expect(teachObserved(p, 'job', cues, 'clean:contact', 'one', 'success', now)).toBe(true);
    expect(teachObserved(p, 'job', cues, 'clean:contact', 'one', 'success', now)).toBe(false);
    expect(chooseActivity(p, 'job', {}, options, now).chosenId).toBe('ask-help');
  });
  it('lets bodily exertion compete with acquired methods', () => {
    const fresh = sam();
    teachObserved(fresh, 'job', cues, 'clean:contact', 'one', 'success', now);
    const tired = restore(snapshot(fresh));
    tired.body.exertion = 0.95;
    tired.body.sleepPressure = 0.12;
    expect(chooseActivity(fresh, 'job', cues, options, now).chosenId).toBe('clean:contact');
    expect(chooseActivity(tired, 'job', cues, options, now).chosenId).toBe('rest');
  });
  it('lets a promised return change the chosen activity', () => {
    const p = sam();
    const offers = [option('deliver'), option('personal')];
    const before = chooseActivity(p, 'job', {}, offers, now).chosenId;
    promiseJob(p, 'job', now + 11, now);
    const after = chooseActivity(p, 'job', {}, offers, now);
    expect(after.chosenId).toBe('deliver');
    expect(before).not.toBe(after.chosenId);
    expect(Object.keys(after.terms).some((k) => k.startsWith('commitment:'))).toBe(true);
  });
  it('begins the captured decision once and resumes the same learned state', () => {
    const p = sam();
    teachObserved(p, 'job', cues, 'clean:contact', 'one', 'success', now);
    const choice = chooseActivity(p, 'job', cues, options, now);
    const resumed = restore(snapshot(p));
    const selected = options.find((o) => o.id === choice.chosenId);
    if (!selected) throw new Error('Missing selected option');
    expect(startActivity(p, option('replace:contact'), now)).toBe(false);
    expect(startActivity(p, selected, now)).toBe(true);
    expect(startActivity(resumed, selected, now)).toBe(true);
    expect(p.trace).toHaveLength(1);
    finishActivity(p, selected, true, now + 10);
    finishActivity(resumed, selected, true, now + 10);
    expect(snapshot(resumed)).toEqual(snapshot(p));
  });
});
