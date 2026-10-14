import {
  type Affordance,
  begin,
  clearMethodContext,
  createPerson,
  type DecisionRecord,
  decide,
  demonstrateMethod,
  finish,
  type Person,
  perceive,
  promise,
  receiveMethodCues,
  socialEvent,
  tick,
} from '@adam0white/human-framework';
import { adoptRepairAspiration, aspirationAdvances } from './responsibility';
import type { PersonChoice, WorkOption } from './types';

const pending = new WeakMap<Person, { record: DecisionRecord; offers: Affordance[] }>();
const cueList = (cues: Record<string, string>) =>
  Object.entries(cues).map(([cue, value]) => ({ cue, value }));

export function createPeople(seed: number, now: number): Record<string, Person> {
  const profiles = [
    {
      id: 'sam',
      name: 'Sam',
      age: 18,
      sex: 'male' as const,
      values: { achievement: 0.8, stimulation: 0.7 },
      needs: { competence: 0.45, leisure: 0.7 },
    },
    {
      id: 'mum',
      name: 'Mum',
      age: 43,
      sex: 'female' as const,
      values: { benevolence: 0.9, security: 0.8 },
      needs: { belonging: 0.5, leisure: 0.75 },
    },
    {
      id: 'nora',
      name: 'Nora',
      age: 28,
      sex: 'female' as const,
      values: { selfDirection: 0.9, stimulation: 0.8 },
      needs: { autonomy: 0.5, leisure: 0.55 },
    },
    {
      id: 'evan',
      name: 'Evan',
      age: 36,
      sex: 'male' as const,
      values: { conformity: 0.8, security: 0.9 },
      needs: { safety: 0.55, leisure: 0.8 },
    },
  ];
  const people = Object.fromEntries(
    profiles.map((p, index) => [
      p.id,
      createPerson({
        ...p,
        seed: seed + index * 7919,
        now,
        bornAt: now - p.age * 365 * 1440,
        body: { satiety: 0.9, hydration: 0.9, sleepPressure: 0.12, exertion: 0.05 },
        voices: [{ voiceId: 'player', trust: 0.85 }],
      }),
    ]),
  );
  if (people.sam) adoptRepairAspiration(people.sam, now);
  return people;
}

export function tickPeople(people: Record<string, Person>, now: number): void {
  for (const person of Object.values(people)) tick(person, now);
}

/** The host calls this only for an attended, observed demonstration. */
export function teachObserved(
  person: Person,
  contextId: string,
  cues: Record<string, string>,
  action: string,
  demonstrationId: string,
  outcome: 'success' | 'failure',
  now: number,
): boolean {
  tick(person, now);
  if (!receiveMethodCues(person, { contextId, cues: cueList(cues) })) return false;
  return demonstrateMethod(person, {
    id: `observed:${action}`,
    demonstrationId,
    contextId,
    // A fixed collar setting depends on the requested pace. Diagnostic and
    // component procedures retain their sensory conditions across numeric goals.
    // The full public brief remains received above, including requested pace.
    conditions: cueList(cues).filter(
      ({ cue }) => cue !== 'requested-pace' || action.startsWith('calibrate:'),
    ),
    action,
    sourceId: 'player',
    attention: 1,
    outcome,
  });
}

function offer(person: Person, option: WorkOption, contextId: string): Affordance {
  const sleep = option.action === 'sleep';
  const eat = option.action === 'eat';
  const drink = option.action === 'drink';
  const observe = option.action === 'observe';
  const rest = option.action === 'rest';
  const personal = option.action === 'personal';
  const leisure = option.action === 'leisure';
  const help = option.action === 'ask-help';
  const accept = option.action === 'accept-repair';
  const diagnose = /^(measure|probe|inspect):/.test(option.action);
  const fulfills = person.agenda.commitments
    .filter(
      (c) =>
        c.status === 'pending' &&
        c.from <= person.now &&
        (c.actions.includes(option.action) ||
          (option.action === 'observe' && c.actions.includes('complete-lesson'))) &&
        (!c.targetId || c.targetId === contextId),
    )
    .map((c) => c.id);
  return {
    ...option,
    methodContext: contextId,
    targetId: contextId,
    mode: sleep ? 'sleep' : 'awake',
    advertises: drink
      ? { water: 0.7 }
      : sleep
        ? { sleep: 0.9, rest: 0.7 }
        : eat
          ? { food: 0.7, water: 0.4 }
          : observe || accept
            ? { competence: 0.12, belonging: 0.05 }
            : rest
              ? { rest: 0.7, leisure: 0.05 }
              : leisure
                ? { leisure: 0.18, meaning: 0.08 }
                : personal
                  ? { leisure: 0.18, autonomy: 0.12 }
                  : help
                    ? { competence: 0.4, belonging: 0.08 }
                    : diagnose
                      ? { competence: 0.075 }
                      : { competence: 0.05 },
    tags:
      sleep || rest
        ? ['rest']
        : personal
          ? ['leisure']
          : observe
            ? ['work', 'social']
            : eat
              ? ['meal']
              : ['work'],
    fulfills,
    advances: [...(option.advances ?? []), ...aspirationAdvances(person, option.action)],
  };
}

export function chooseActivity(
  person: Person,
  contextId: string,
  cues: Record<string, string>,
  options: WorkOption[],
  now: number,
): PersonChoice {
  tick(person, now);
  if (Object.keys(cues).length) receiveMethodCues(person, { contextId, cues: cueList(cues) });
  else clearMethodContext(person);
  const offers = options.map((option) => offer(person, option, contextId));
  const record = decide(person, offers, { now });
  pending.set(person, { record, offers });
  const chosen = record.considered.find((c) => c.affordanceId === record.chosenAffordanceId);
  return {
    chosenId: record.chosenAffordanceId ?? undefined,
    narration: record.narration,
    reason: record.intention,
    terms: Object.fromEntries((chosen?.terms ?? []).map((t) => [t.source, t.value])),
  };
}

export function startActivity(person: Person, option: WorkOption, now: number): boolean {
  const captured = pending.get(person);
  // The trace survives a save made between choosing and beginning.
  const record = captured?.record ?? person.trace.at(-1);
  if (!record || record.at !== now || record.chosenAffordanceId !== option.id || person.activity)
    return false;
  const selected =
    captured?.offers.find((a) => a.id === option.id) ??
    offer(person, option, person.methods?.context?.id ?? 'workshop');
  pending.delete(person);
  return begin(person, selected, record) !== null;
}

export function finishActivity(
  person: Person,
  option: WorkOption,
  success: boolean,
  now: number,
  advances: string[] = [],
): ReturnType<typeof finish> {
  if (person.activity?.affordance.id !== option.id) return null;
  const activity = person.activity;
  return finish(person, {
    affordanceId: option.id,
    action: option.action,
    targetId: activity.affordance.targetId,
    at: now,
    status: success ? 'completed' : 'failed',
    advances,
    needs:
      success && option.action !== 'accept-repair'
        ? realizedActivityNeeds(activity.affordance.advertises)
        : {},
    fulfills: (activity.affordance.fulfills ?? []).filter((id) => {
      const commitment = person.agenda.commitments.find((c) => c.id === id);
      return (
        !commitment?.actions.includes('complete-lesson') || (success && now >= commitment.until)
      );
    }),
    summary: `${person.name} ${success ? 'completed' : 'could not complete'} ${option.label}.`,
  });
}
/** HF measures sleep and rest from its body's state at begin/finish when these host deltas are omitted. */
export function realizedActivityNeeds(
  advertised: Affordance['advertises'],
): Affordance['advertises'] {
  const needs = { ...advertised };
  delete needs.sleep;
  delete needs.rest;
  return needs;
}

export function promiseJob(person: Person, jobId: string, until: number, now: number): void {
  tick(person, now);
  if (
    person.agenda.commitments.some(
      (c) => c.status === 'pending' && c.targetId === jobId && c.actions.includes('deliver'),
    )
  )
    return;
  promise(person, {
    kind: 'job',
    targetId: jobId,
    actions: ['deliver'],
    from: now,
    until,
    importance: 0.9,
    label: `Return ${jobId}`,
  });
}

/** A proposed lesson becomes a commitment only after HF selects it. */
export function agreeLearningSession(
  person: Person,
  contextId: string,
  minutes: number,
  now: number,
): { accepted: boolean; says: string; until: number } {
  const until = now + Math.max(1, minutes);
  const existing = person.agenda.commitments.find(
    (c) =>
      c.status === 'pending' && c.targetId === contextId && c.actions.includes('complete-lesson'),
  );
  if (existing)
    return {
      accepted: true,
      says: `I agreed to watch until ${clock(existing.until)}.`,
      until: existing.until,
    };
  const choice = chooseActivity(
    person,
    contextId,
    {},
    [
      {
        id: 'observe',
        action: 'observe',
        label: 'Watch the repair lesson',
        duration: minutes,
        effort: 0.005,
      },
      { id: 'eat', action: 'eat', label: 'Have food and water', duration: 15, effort: 0 },
      { id: 'rest', action: 'rest', label: 'Take a break', duration: 15, effort: 0 },
      {
        id: 'personal',
        action: 'personal',
        label: 'Attend to my own plans',
        duration: 20,
        effort: 0.02,
      },
    ],
    now,
  );
  if (choice.chosenId !== 'observe')
    return { accepted: false, says: choiceSpeech(person, choice), until: now };
  promise(person, {
    kind: 'promise',
    targetId: contextId,
    actions: ['complete-lesson'],
    from: now,
    until,
    importance: 0.75,
    label: 'Watch the agreed repair lesson',
  });
  return {
    accepted: true,
    says: `I will watch this repair with you until ${clock(until)}.`,
    until,
  };
}

const clock = (minute: number) =>
  `${Math.floor((minute % 1440) / 60)
    .toString()
    .padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;

export function choiceSpeech(person: Person, choice: PersonChoice): string {
  const strongest = Object.entries(choice.terms)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (strongest?.startsWith('commitment:')) {
    const commitment = person.agenda.commitments.find(
      (c) => c.id === strongest.slice('commitment:'.length),
    );
    if (commitment && commitment.from <= person.now)
      return `I promised to ${commitment.label?.toLowerCase() ?? 'keep this appointment'} before ${clock(commitment.until)}.`;
  }
  if (choice.chosenId === 'drink') return 'I need water. I’ll get a drink before carrying on.';
  if (choice.chosenId === 'eat' || strongest === 'need:food' || strongest === 'need:water')
    return 'I need food and water before I carry on.';
  if (
    choice.chosenId === 'rest' ||
    choice.chosenId === 'sleep' ||
    strongest === 'need:rest' ||
    strongest === 'need:sleep'
  )
    return 'I am tired. I need a break before I carry on.';
  if (choice.chosenId === 'personal') return 'I want some time for my own plans.';
  return choice.narration;
}

/** Record the customer's experienced return; unfinished is honest, not deceit. */
export function reportDelivery(
  owner: Person,
  jobId: string,
  quality: 'checked' | 'unfinished' | 'late',
  now: number,
  actorId = 'player',
  displayTitle = jobId,
  onTime = quality !== 'late',
): void {
  tick(owner, now);
  perceive(owner, [
    {
      at: now,
      channel: 'social',
      kind: `repair-return:${quality}`,
      summary:
        quality === 'checked'
          ? `${displayTitle} was returned after its use checks passed.`
          : quality === 'late'
            ? `${displayTitle} was returned after the promised time.`
            : `${displayTitle} was returned honestly unfinished.`,
      actorId,
      targetId: jobId,
      salience: 0.9,
      valence: quality === 'checked' ? 0.7 : quality === 'late' ? -0.5 : -0.1,
    },
  ]);
  if (quality === 'unfinished' && !onTime)
    perceive(owner, [
      {
        at: now,
        channel: 'social',
        kind: 'repair-return:late',
        summary: `${displayTitle} was returned after the promised time.`,
        actorId,
        targetId: jobId,
        salience: 0.9,
        valence: -0.5,
      },
    ]);
  const late = quality === 'late' || !onTime;
  socialEvent(owner, {
    at: now,
    otherId: actorId,
    byMe: false,
    kind: late ? 'promise-broken' : quality === 'checked' ? 'help' : 'chat',
    magnitude: late ? 0.5 : quality === 'checked' ? 0.6 : 0.15,
  });
}

function readableMethod(action: string, conditions: { cue: string; value: string }[]): string {
  const words = (text: string) => text.replace(/[:_-]/g, ' ');
  const phrases: Record<string, string> = {
    'high-drop': 'a large voltage drop',
    'low-source': 'the source sags under load',
    'slow-drive': 'slower rotation',
    intake: 'an unfamiliar object arrives',
    measured: 'after testing',
    repaired: 'after intervening',
    'open-path': 'an open circuit',
    resistance: 'excess resistance',
    'blocked-drive': 'the drive cannot turn',
    'steady-output': 'steady output',
    'weak-output': 'weak output',
    'no-output': 'no output',
  };
  const specific = conditions.some((c) => c.cue === 'signal' && phrases[c.value]);
  const readable = conditions.filter((c) => !specific || (c.cue !== 'family' && c.cue !== 'stage'));
  const condition = readable
    .map((c) => {
      if (c.cue === 'requested-use') {
        const [device, check] = c.value.split(':');
        return `a ${words(device ?? 'device')} is needed ${check === 'movement' ? 'while being carried' : 'under load'}`;
      }
      if (c.cue === 'requested-pace') return `the requested pace is ${c.value} rpm`;
      if (c.cue === 'observed-span') {
        const [mode, a, b, observed] = c.value.split(':');
        const tests = (observed ?? '')
          .split('+')
          .map((test) =>
            test === 'movement'
              ? 'while moving it'
              : test === 'load'
                ? 'under load'
                : 'on the bench',
          );
        return `${mode === 'motion' ? 'rotation' : mode} between ${a} and ${b} has been measured ${tests.join(' and ')}`;
      }
      if (c.cue.startsWith('comparison-')) {
        const check = c.cue.slice('comparison-'.length);
        const [direction, , reference] = c.value.split('-');
        return `the ${check} reading is ${direction === 'equal' ? 'equal to' : `${direction} than`} the ${reference} reading`;
      }
      if (c.cue === 'part') return `the ${words(c.value)}`;
      if (c.cue === 'signal') return `you observe ${phrases[c.value] ?? words(c.value)}`;
      if (c.cue === 'stage') return phrases[c.value] ?? `the work is ${words(c.value)}`;
      if (c.cue === 'family')
        return `working on ${c.value === 'electrical' ? 'an electrical circuit' : 'a mechanical drive'}`;
      return `${words(c.cue)} is ${words(c.value)}`;
    })
    .join(' and ');
  const scope = specific
    ? conditions
        .filter((c) => c.cue === 'family' || c.cue === 'stage')
        .map((c) =>
          c.cue === 'family'
            ? c.value === 'electrical'
              ? 'electrical work'
              : 'mechanical work'
            : (phrases[c.value] ?? words(c.value)),
        )
        .join(', ')
    : '';
  const [verb, target, a, b, testCondition] = action.split(':');
  const instruction =
    verb === 'probe'
      ? `measure ${target === 'motion' ? 'rotation' : target} between ${words(a ?? '?')} and ${words(b ?? '?')} ${testCondition === 'load' ? 'under load' : testCondition === 'movement' ? 'while moving the object' : 'on the bench'}`
      : verb === 'calibrate'
        ? `set the ${words(target ?? 'governor')} collar to ${a ?? '?'}`
        : verb === 'ask-help'
          ? 'ask for help'
          : `${words(verb ?? action)}${target ? ` the ${words(target)}` : ''}`;
  return `When ${condition}, ${instruction}.${scope ? ` Applies to ${scope}.` : ''}`;
}

/** Install one explicit afternoon commitment; do not simulate unobserved activity. */
export function prepareMorning(person: Person, dayStart: number): void {
  const routines: Record<string, string> = {
    sam:
      [
        'Help my sister with her move',
        'Meet the bike club',
        'Study on my own',
        'Play football',
        'Visit family',
        'Work at my personal stand',
        'Prepare the community event',
      ][Math.floor(dayStart / 1440) % 7] ?? 'Spend time on my own plans',
    mum: 'Visit a neighbour',
    nora: 'Work on my own design',
    evan: 'Collect my children',
  };
  const label = routines[person.id];
  if (!label) return;
  const from = dayStart + 15 * 60;
  const until = dayStart + 17 * 60;
  if (person.agenda.commitments.some((c) => c.label === label && c.from === from)) return;
  promise(person, {
    kind: 'promise',
    actions: ['personal'],
    from,
    until,
    importance: 0.7,
    label,
    ...(person.id === 'mum' ? { targetId: 'nora' } : {}),
  });
}

export function describePerson(person: Person): {
  state: string;
  learned: string[];
  desire: string;
} {
  return {
    state: person.activity
      ? person.activity.affordance.label
      : person.body.exertion > 0.65
        ? 'Tired'
        : 'Available',
    learned: (person.methods?.rules ?? []).map((r) => readableMethod(r.action, r.conditions)),
    desire: person.trace.at(-1)?.intention ?? 'No recent decision',
  };
}
