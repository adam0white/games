import {
  type Affordance,
  begin,
  clearMethodContext,
  createPerson,
  type DecisionRecord,
  decide,
  demonstrateMethod,
  enableFatigueStore,
  enableFullness,
  finish,
  noteVoicePromise,
  type Person,
  perceive,
  promise,
  receiveMethodCues,
  type Suggestion,
  sicken,
  socialEvent,
  tick,
} from '@adam0white/human-framework';
import { canonicalCast } from '@adam0white/lab-client';
import { CAST_IDS } from './cast';
import { adoptRepairAspiration, aspirationAdvances } from './responsibility';
import type { PersonChoice, WorkOption } from './types';

const pending = new WeakMap<Person, { record: DecisionRecord; offers: Affordance[] }>();
const cueList = (cues: Record<string, string>) =>
  Object.entries(cues).map(([cue, value]) => ({ cue, value }));

export function createPeople(seed: number, now: number): Record<string, Person> {
  const profiles = [
    ...Object.entries(CAST_IDS).map(([id, castId]) => {
      const cast = canonicalCast(castId);
      return {
        id,
        name: cast.name,
        age: cast.age,
        sex: (id === 'nora' ? 'female' : 'male') as 'female' | 'male',
        traits: cast.traits,
        values: cast.values,
        needs: {
          leisure: id === 'sam' ? 0.7 : 0.55,
          ...(id === 'sam' ? { competence: 0.45 } : {}),
        },
      };
    }),
    {
      id: 'mum',
      name: 'Sam’s mother',
      age: 43,
      sex: 'female' as const,
      needs: { belonging: 0.5, leisure: 0.75 },
    },
  ];
  profiles.sort(
    (a, b) =>
      ['sam', 'mum', 'nora', 'rafi', 'halil'].indexOf(a.id) -
      ['sam', 'mum', 'nora', 'rafi', 'halil'].indexOf(b.id),
  );
  const people = Object.fromEntries(
    profiles.map((p, index) => [
      p.id,
      createPerson({
        ...p,
        lexicon: { plainEnglish: true },
        seed: seed + index * 7919,
        now,
        bornAt: now - p.age * 365 * 1440,
        body: { satiety: 0.9, hydration: 0.9, sleepPressure: 0.12, exertion: 0.05 },
        voices: [{ voiceId: 'player', trust: 0.85 }],
      }),
    ]),
  );
  if (people.halil)
    sicken(people.halil, {
      kind: 'hypertension',
      severity: 0.2,
      trendPerDay: 0,
      contagious: false,
      chronic: true,
      baseline: 0.2,
      aggravatedBy: ['smoke'],
    });
  if (people.sam) adoptRepairAspiration(people.sam, now);
  return people;
}

/**
 * Engine-5 people (HF 2.8): a slow fatigue store, so a long day at the bench tires a person and a night's sleep
 * restores them, and fullness, so an idle person stops looping on drinks and snacks they no longer need.
 */
export function enableCurrentPeople(people: Record<string, Person>, _now: number): void {
  for (const person of Object.values(people)) {
    enableFatigueStore(person);
    enableFullness(person);
  }
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
  ask?: Suggestion,
): PersonChoice {
  tick(person, now);
  if (Object.keys(cues).length) receiveMethodCues(person, { contextId, cues: cueList(cues) });
  else clearMethodContext(person);
  const offers = options.map((option) => offer(person, option, contextId));
  const record = decide(person, offers, ask ? { now, suggestion: ask } : { now });
  pending.set(person, { record, offers });
  const chosen = record.considered.find((c) => c.affordanceId === record.chosenAffordanceId);
  const answer = ask ? record.suggestion : undefined;
  return {
    chosenId: record.chosenAffordanceId ?? undefined,
    narration: record.narration,
    reason: record.intention,
    terms: Object.fromEntries((chosen?.terms ?? []).map((t) => [t.source, t.value])),
    ...(answer
      ? { answer: { verdict: answer.verdict, says: answer.says, reason: answer.reason } }
      : {}),
  };
}

/** The player's own ask, carried in the player's voice (engine 5). Trust in that voice weighs it. */
export function playerAsk(affordanceId: string, strength = 0.5): Suggestion {
  return { voiceId: 'player', affordanceId, strength };
}

/**
 * Engine 5: the player asked Sam to set time aside and then started (kept) or let it lapse (broken). HF moves his
 * trust in the player's voice, which weighs the player's next asks.
 */
export function notePlayerWord(person: Person, kept: boolean, action: string, now: number): void {
  tick(person, now);
  noteVoicePromise(person, 'player', { kept, at: now, action });
}

/** How readily a person takes the player's word, in words, never a number (engine 5 presentation). */
export function playerWordReading(person: Person): string | undefined {
  const voice = person.will.voices.find((v) => v.voiceId === 'player');
  if (!voice) return undefined;
  return voice.trust >= 0.8
    ? 'takes your word readily'
    : voice.trust >= 0.6
      ? 'takes your word, with a little caution'
      : voice.trust >= 0.4
        ? 'waits to see whether you mean it'
        : 'no longer counts on what you say';
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
  ask?: Suggestion,
): { accepted: boolean; says: string; until: number; instead?: WorkOption } {
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
  const options: WorkOption[] = [
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
  ];
  const choice = chooseActivity(person, contextId, {}, options, now, ask);
  if (choice.chosenId !== 'observe')
    return {
      accepted: false,
      says: choiceSpeech(person, choice),
      until: now,
      instead: options.find((o) => o.id === choice.chosenId),
    };
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
  if (choice.answer?.says && !['assented', 'complied'].includes(choice.answer.verdict))
    return choice.answer.says;
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
  const words = (text: string) =>
    text === 'governor' ? 'speed control' : text.replace(/[:_-]/g, ' ');
  const conditionWords = (test: string) =>
    test === 'load'
      ? 'while the object works harder'
      : test === 'movement'
        ? 'while carrying the object'
        : 'on the table';
  const phrases: Record<string, string> = {
    'high-drop': 'the voltage falls a lot between the two test points',
    'low-source': 'the cell pack voltage falls while the object works harder',
    'slow-drive': 'the shaft turns slowly',
    intake: 'an unfamiliar object arrives',
    examined: 'after looking inside',
    rotation: 'the shaft turns',
    connected: 'electricity can flow through the path',
    voltage: 'a voltage reading is available',
    timing: 'the melody runs at the wrong speed',
    'control-setting': 'the speed control ring setting is visible',
    'aged-surface': 'the exposed metal looks aged and dull',
    intact: 'the outside looks intact',
    'power-off': 'the power is off',
    invalid: 'the test cannot give a reading',
    measured: 'after testing',
    repaired: 'after a repair step',
    worked: 'a repair step was performed',
    'open-path': 'electricity cannot flow through the path',
    resistance: 'the path resists the flow of electricity too much',
    'blocked-drive': 'the drive cannot turn',
    'steady-output': 'the object works steadily',
    'weak-output': 'the object works weakly',
    'no-output': 'the object does not work',
  };
  const specific = conditions.some((c) => c.cue === 'signal' && phrases[c.value]);
  const readable = conditions.filter((c) => !specific || (c.cue !== 'family' && c.cue !== 'stage'));
  const condition = readable
    .map((c) => {
      if (c.cue === 'requested-use') {
        const [device, check] = c.value.split(':');
        return `a ${words(device ?? 'device')} is needed ${(check ?? 'bench').split('+').map(conditionWords).join(' and ')}`;
      }
      if (c.cue === 'requested-pace') return `the requested pace is ${c.value} turns per minute`;
      if (c.cue === 'observed-span') {
        const [mode, a, b, observed] = c.value.split(':');
        const tests = (observed ?? '').split('+').map((test) => conditionWords(test));
        return `${mode === 'motion' ? 'rotation' : mode} between ${a} and ${b} has been measured ${tests.join(' and ')}`;
      }
      if (c.cue.startsWith('comparison-')) {
        const check = c.cue.slice('comparison-'.length);
        const [direction, , reference] = c.value.split('-');
        return `the reading ${conditionWords(check)} is ${direction === 'equal' ? 'equal to' : `${direction} than`} the reading ${conditionWords(reference ?? 'bench')}`;
      }
      if (c.cue === 'part') return `you are checking the ${words(c.value)}`;
      if (c.cue === 'signal') return `your observation is “${phrases[c.value] ?? words(c.value)}”`;
      if (c.cue === 'stage') {
        if (c.value === 'intake') return 'an unfamiliar object arrives';
        if (c.value === 'examined') return 'you have looked inside';
        if (c.value === 'measured') return 'you have tested the object';
        if (c.value === 'repaired') return 'you have done a repair step';
        if (c.value === 'ready') return 'the required tests have passed';
        if (c.value.startsWith('checked-'))
          return `the object has passed a test ${c.value.slice(8).split('-').map(conditionWords).join(' and ')}`;
        return `the work has reached “${words(c.value)}”`;
      }
      if (c.cue === 'family')
        return `you are working on ${c.value === 'electrical' ? 'an electrical circuit' : 'a mechanical drive'}`;
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
            : c.value.startsWith('checked-')
              ? `after successful tests ${c.value.slice(8).split('-').map(conditionWords).join(' and ')}`
              : (phrases[c.value] ?? words(c.value)),
        )
        .join(', ')
    : '';
  const [verb, target, a, b, testCondition] = action.split(':');
  const instruction =
    verb === 'probe'
      ? `measure ${target === 'motion' ? 'rotation' : target} between ${words(a ?? '?')} and ${words(b ?? '?')} ${conditionWords(testCondition ?? 'bench')}`
      : verb === 'verify'
        ? `test the object ${conditionWords(target ?? 'bench')}`
        : verb === 'calibrate'
          ? `set the speed control ring to ${a ?? '?'}`
          : verb === 'ask-help'
            ? 'ask for help'
            : `${words(verb ?? action)}${target ? ` the ${words(target)}` : ''}`;
  return `When ${condition}, ${instruction}.${scope ? ` This method applies to ${scope}.` : ''}`;
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
    rafi: 'Write to my cousin Can about the workshop exchange',
    halil: 'Take a quiet break before calling my daughter Selin',
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
      ? `${person.name} is doing this activity: ${person.activity.affordance.label}.`
      : person.body.exertion > 0.65
        ? `${person.name} is tired.`
        : `${person.name} is available.`,
    learned: (person.methods?.rules ?? []).map((r) => readableMethod(r.action, r.conditions)),
    desire: person.trace.at(-1)?.intention ?? `${person.name} has not made a recent decision.`,
  };
}
