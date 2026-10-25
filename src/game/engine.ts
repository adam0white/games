import { perceive, releaseCommitment } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import {
  admissionFacts,
  admitWorkshop,
  type CastChapter,
  castRole,
  validateCastChapter,
} from './cast';
import { discoveredAccounts } from './cast-content';
import {
  beginPreparation,
  completePreparation,
  createCommunityEvent,
  finalizeCommunityEvent,
  resolveCommunityEvent,
} from './community';
import { evidenceContext } from './evidence-context';
import { helpFeedback } from './help-feedback';
import {
  calibrate,
  compatiblePart,
  createModel,
  feltUse,
  inspectComponent,
  intervene,
  measure,
  runUseTest,
  supportedFaults,
  terminals,
} from './model';
import { restoreOpeningPeople } from './opening';
import {
  agreeLearningSession,
  choiceSpeech,
  chooseActivity,
  createPeople,
  enableCurrentPeople,
  finishActivity,
  notePlayerWord,
  playerAsk,
  prepareMorning,
  promiseJob,
  reportDelivery,
  startActivity,
  teachObserved,
  tickPeople,
} from './people';
import { LEGACY_PROVENANCE, MAX_RECORDED_INPUTS, SAVE_PROVENANCE } from './recording';
import {
  abandonResponsibility,
  adoptResponsibility,
  completeRepairAspiration,
  completeResponsibility,
  responsibilityAdvances,
  responsibilityOutcomeAdvances,
} from './responsibility';
import type {
  Command,
  CommandResult,
  Component,
  ComponentKind,
  Condition,
  DeviceKind,
  Evidence,
  GameState,
  Job,
  NpcWork,
  Observation,
  TestCondition,
  WorkOption,
} from './types';

export const COSTS = {
  inspect: 10,
  measure: 10,
  clean: 20,
  adjust: 20,
  replace: 30,
  verify: 15,
  deliver: 10,
  salvage: 25,
  buy: 20,
  assign: 0,
};
export const PART_PRICES: Partial<Record<ComponentKind, number>> = {
  cell: 6,
  switch: 9,
  contact: 4,
  bulb: 7,
  motor: 18,
  spring: 12,
  gear: 8,
  governor: 10,
  drum: 16,
};
export const UPGRADE_CATALOG = [
  {
    id: 'second-bench',
    name: 'A second workbench',
    price: 48,
    description: 'Work beside Sam instead of sharing one bench.',
  },
  {
    id: 'precision-meter',
    name: 'A load tester',
    price: 35,
    description: 'Compare bench and loaded readings in one measurement.',
  },
];
const DAY = 1440;
const OPEN = 540;
const CLOSE = 1020;
const CONDITIONS: TestCondition[] = ['bench', 'movement', 'load'];
const terminalStates = new Set(['delivered', 'declined', 'salvaged']);
export function dayTime(now: number): string {
  const minute = now % DAY;
  return `Day ${Math.floor(now / DAY) + 1} · ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
export function dayRemaining(state: GameState): number {
  return Math.max(0, CLOSE - (state.now % DAY));
}
export function requiredChecks(job: Job): TestCondition[] {
  return job.requiredConditions ?? [job.kind === 'lantern' ? 'movement' : 'load'];
}
export function jobReadiness(job: Job): string {
  if (job.returnedUnfinished) return 'The object was returned honestly, unfinished.';
  if (job.status === 'delivered')
    return `The object is back with ${job.ownerId.charAt(0).toUpperCase()}${job.ownerId.slice(1)}.`;
  if (job.status === 'ready')
    return `The object passed these checks: ${requiredChecks(job).join(', ')}.`;
  if (job.assignedTo) return 'Sam has responsibility.';
  return job.verified.length
    ? `The object passed these checks: ${job.verified.join(', ')}.`
    : job.evidence.length
      ? 'The observations are saved. The object still needs checks.'
      : 'The object has not been examined yet.';
}
/** A title inside a sentence. Engine 5 keeps a person's name capitalised ("Nora’s reading light"). */
function named(s: GameState, title: string): string {
  if (!currentRules(s)) return title.toLowerCase();
  const [first = '', ...rest] = title.split(' ');
  const keep = /[’']s$/.test(first);
  return [keep ? first : first.toLowerCase(), ...rest.map((w) => w.toLowerCase())].join(' ');
}
/** The owner speaking of their own object: "my reading light". */
function own(title: string): string {
  const [first = '', ...rest] = title.split(' ');
  return /[’']s$/.test(first) ? `my ${rest.join(' ').toLowerCase()}` : title.toLowerCase();
}
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** Engine 5: an owner's answer to an honest unfinished return depends on how long they waited. */
function unfinishedReply(s: GameState, job: Job, onTime: boolean): string {
  if (onTime) return 'Thank you for telling me in time. I’ll make another plan.';
  const days = Math.floor((s.now - job.due) / DAY);
  return days < 1
    ? 'Thank you for telling me what remains. It came back later than you said, but not by much.'
    : days < 3
      ? `I waited ${days === 1 ? 'a day' : 'two days'} past your time for this. I’ll make another plan.`
      : 'I stopped expecting it some days ago. I’ve made other plans.';
}
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('A required workshop record is missing.');
  return value;
}
function random(s: GameState): number {
  let value = s.rng | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  s.rng = value >>> 0;
  return s.rng / 0x100000000;
}
function log(
  s: GameState,
  speaker: string,
  text: string,
  tone: 'ordinary' | 'good' | 'warning' = 'ordinary',
): void {
  s.log.push({ id: s.nextId++, at: s.now, speaker, text, tone });
  if (s.log.length > 160) s.log.splice(0, s.log.length - 160);
}
function makeJob(
  s: GameState,
  kind: DeviceKind,
  title: string,
  ownerId: string,
  description: string,
  reward: number,
  due: number,
  status: Job['status'] = 'offer',
): Job {
  const seed = Math.floor(random(s) * 100000);
  const model = createModel(kind, seed);
  if (s.day >= 3) {
    for (const part of model.components) setGeneratedCondition(part, 'good');
    const part = model.components[(seed >>> 3) % model.components.length];
    if (part) {
      const faults = supportedFaults[part.kind];
      setGeneratedCondition(part, faults[(seed >>> 6) % faults.length] ?? 'good');
    }
  }
  return {
    id: `object-${s.nextId++}`,
    title,
    ownerId,
    description,
    importance: ownerId === 'mum' ? 'Family object' : 'Neighbourhood work',
    kind,
    model,
    reward,
    due,
    status,
    evidence: [],
    contributions: [],
    pendingLessons: [],
    inspected: [],
    verified: [],
  };
}
function setGeneratedCondition(part: Component, condition: Condition): void {
  part.condition = condition;
  if (part.kind === 'governor') part.setting = condition === 'misaligned' ? 4 : 2;
}
function reportedSymptoms(job: Job, stakes: string): string {
  const bench = runUseTest(job.model, 'bench');
  const movement = runUseTest(job.model, 'movement');
  const load = runUseTest(job.model, 'load');
  if (job.kind === 'lantern') {
    const light = (result: typeof bench, carried = false) =>
      result.output === 0
        ? carried
          ? 'it goes dark'
          : 'it stays dark'
        : result.passes
          ? 'it stays bright'
          : 'it stays dim';
    return `“On the shelf, ${light(bench)}; when carried, ${light(movement, true)}. While working, ${light(load)}. ${stakes}”`;
  }
  if (job.kind === 'fan') {
    const air = (result: typeof bench) =>
      result.output === 0
        ? 'there is no airflow'
        : result.passes
          ? 'the airflow stays steady'
          : 'the airflow falls short';
    return `“At rest, ${air(bench)}; through the grille, ${air(load)}. ${stakes}”`;
  }
  const pace = (result: typeof bench) =>
    result.output === 0
      ? 'the melody stops'
      : result.passes
        ? 'the melody keeps its pace'
        : result.output < (job.model.desiredRPM ?? 15)
          ? 'the melody runs too slowly'
          : 'the melody runs too fast';
  return `“On the bench, ${pace(bench)}; while driving the figures, ${pace(load)}. ${stakes}”`;
}
/** Engine-5 rules: the HF 2.8 opt-ins and the 2026-10-19 lessons. Engine-4 worlds keep engine-4 behaviour. */
export const currentRules = (s: Pick<GameState, 'schema'>): boolean => s.schema === 'small-works@5';
/**
 * Move an engine-4 world to the current rules, recording the input index so a replay applies the old rules before
 * it and the new rules after it. Idempotent for a current world.
 */
export function upgradeRules(s: GameState): GameState {
  if (currentRules(s)) return s;
  s.schema = 'small-works@5';
  s.provenance = { ...SAVE_PROVENANCE };
  s.migratedFrom = { engine: 'small-works@4', atInput: s.inputs?.length ?? 0 };
  enableCurrentPeople(s.people, s.now);
  log(
    s,
    'Workshop',
    'This workshop continues under the current rules. Everything you did so far stays as it was.',
  );
  return s;
}
export function createGame(
  seed = 416,
  rules: 'current' | 'legacy' = 'current',
  openingPeople?: GameState['openingPeople'],
  castChapter?: CastChapter,
): GameState {
  if (castChapter) {
    validateCastChapter(castChapter);
    if (!openingPeople)
      throw new Error('A continuing chapter needs the exact people saved at its start.');
    const expected = createGame(seed).people;
    for (const input of castChapter.inputs) {
      const role = castRole(input.parent.castId)!;
      expected[role] = admitWorkshop(input, expected[role]!);
    }
    if (canonicalPersona(expected) !== canonicalPersona(openingPeople))
      throw new Error('The saved people do not match the people loaded from the source.');
  }
  const now = OPEN;
  const legacy = rules === 'legacy';
  const s: GameState = {
    schema: legacy ? 'small-works@4' : 'small-works@5',
    provenance: { ...(legacy ? LEGACY_PROVENANCE : SAVE_PROVENANCE) },
    inputs: [],
    discoveries: [],
    ...(castChapter ? { castChapter: structuredClone(castChapter) } : {}),
    seed: seed >>> 0,
    rng: seed >>> 0 || 1,
    now,
    day: 1,
    cash: 24,
    reputation: 0,
    stock: { cell: 1, switch: 1, bulb: 1, gear: 1 },
    jobs: [],
    ...(openingPeople ? { openingPeople: restoreOpeningPeople(openingPeople) } : {}),
    people: openingPeople ? restoreOpeningPeople(openingPeople) : createPeople(seed, now),
    npcWork: [],
    watching: false,
    selectedJobId: '',
    log: [],
    nextId: 1,
    upgrades: [],
    independentRepairs: 0,
    weekReviewed: false,
    ended: false,
    dailyCostsPaid: 0,
  };
  if (!legacy) enableCurrentPeople(s.people, now);
  for (const person of Object.values(s.people)) prepareMorning(person, 0);
  log(
    s,
    'Sam',
    'I want to learn to handle a whole repair myself. I still have my own plans and promises.',
  );
  const lantern = makeJob(
    s,
    'lantern',
    'The household walking lantern',
    'mum',
    '“It lights the table. Carry it to the garden and it goes dark. I want to take it to the evening gathering.”',
    0,
    CLOSE,
    'active',
  );
  lantern.model = createModel('lantern', seed, [{ componentId: 'switch', condition: 'worn' }]);
  lantern.acceptedAt = now;
  lantern.quote = 'This is a family favour. Return it by 17:00 if you can.';
  const personal = makeJob(
    s,
    'music-box',
    'The little paper theatre',
    'player',
    'A music-box drive moves this cardboard street. The tune plays too fast for the figures. Keep it, improve it, or take your time.',
    0,
    DAY * 30 + CLOSE,
    'active',
  );
  personal.isPersonal = true;
  personal.model = createModel('music-box', seed, [
    { componentId: 'governor', condition: 'misaligned' },
  ]);
  personal.model.desiredRPM = 12;
  personal.model.tolerance = 1;
  const donor = makeJob(
    s,
    'lantern',
    'The cracked spare lantern',
    'player',
    'The casing is ruined, but some parts inside still work. Once you recover a part, this object can only supply spare parts.',
    0,
    DAY * 30 + CLOSE,
    'active',
  );
  donor.isDonor = true;
  donor.model = createModel('lantern', seed, [
    { componentId: 'bulb', condition: 'open' },
    { componentId: 'cell', condition: 'weak' },
  ]);
  s.jobs.push(lantern, personal, donor);
  s.selectedJobId = lantern.id;
  log(
    s,
    'Sam’s mother',
    'This lantern belongs to the household. We can still use it if it is repaired.',
  );
  log(
    s,
    'Sam',
    'I have the morning free. If you want company, I’d like to see how you find the fault. I promised to help my sister later.',
  );
  log(
    s,
    'Workshop',
    'The clock moves when you act. Tests leave observations you can review. You have limited parts and time to keep promises.',
  );
  for (const input of castChapter?.inputs ?? []) {
    const facts = admissionFacts(castChapter, castRole(input.parent.castId) ?? '');
    if (facts) log(s, facts.cast.name, `${facts.line} ${facts.contacts.join(' ')}`);
  }
  return s;
}
function neighbourOffers(s: GameState, initial = false): void {
  const base = Math.floor(s.now / DAY) * DAY;
  const templates: [DeviceKind, string, string, string, number][] = [
    [
      'lantern',
      'Nora’s reading light',
      'nora',
      '“It is bright for a moment, then fades. I am testing a reading-light design. Please test it with the light actually working.”',
      18,
    ],
    [
      'fan',
      'Rafi’s borrowed desk fan',
      'rafi',
      '“It spins here. Press it against the filter and it slows down. I work at the dish station in Bornova. I am here to learn repairs, not to offer expertise.”',
      32,
    ],
    [
      'music-box',
      'Nora’s keepsake music box',
      'nora',
      '“The melody sounds wrong. This was my grandmother’s. I do not want a new motor; I want this one to work.”',
      26,
    ],
    [
      'lantern',
      'Halil’s visiting lantern',
      'halil',
      '“I came from my town for this workshop visit. I work fewer hours now. It goes out when carried; please do not promise a quick fix.”',
      20,
    ],
    [
      'fan',
      'The meeting-room fan',
      'mum',
      '“We are opening the room on Saturday. The fan needs to move air through its grille, not just turn without it.”',
      24,
    ],
    [
      'music-box',
      'Sam’s winding toy',
      'sam',
      '“I picked this up with my sister. It is meant to move slowly; now it moves too quickly or stops. There is no hurry if you want to try.”',
      22,
    ],
  ];
  const commissionTitles = [
    'Nora’s reading light commission',
    'Rafi’s desk fan commission',
    'Nora’s music-box commission',
    'Halil’s visiting lantern commission',
    'The household room-fan commission',
    'Sam’s winding toy commission',
  ];
  const continuing = s.weekReviewed;
  const familyHistory = (choice: number) =>
    s.jobs.filter(
      (j) =>
        j.ownerId === templates[choice]?.[2] &&
        (j.title === templates[choice]?.[1] || j.title.startsWith(`${commissionTitles[choice]} `)),
    );
  const candidates = templates
    .map((_, index) => index)
    .filter((choice) => {
      if (initial && choice >= 3) return false;
      const history = familyHistory(choice);
      if (!continuing) return history.length === 0;
      return !history.some(
        (j) =>
          ['offer', 'active', 'ready'].includes(j.status) ||
          (j.deliveredAt !== undefined && s.now - j.deliveredAt < 2 * DAY),
      );
    });
  // Engine 5: a neighbour whose last object came back late, or who is still waiting past the promised time,
  // takes this round's request elsewhere and says why. Each late return costs one round, not the friendship.
  if (currentRules(s) && !initial) {
    const elsewhere = new Map<string, string>();
    const said = new Map<string, Job>();
    for (const owner of ['nora', 'rafi', 'halil', 'mum']) {
      const waiting = s.jobs.find(
        (j) =>
          j.ownerId === owner &&
          ['active', 'ready'].includes(j.status) &&
          !j.isPersonal &&
          j.due < s.now,
      );
      const late = s.jobs
        .filter(
          (j) => j.ownerId === owner && j.status === 'delivered' && j.deliveredAt !== undefined,
        )
        .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0))[0];
      if (waiting) {
        // Said once; afterwards the owner simply brings nothing new.
        elsewhere.set(
          owner,
          waiting.withheldNoted
            ? ''
            : `I’ll bring you something new once ${own(waiting.title)} is back.`,
        );
        if (!waiting.withheldNoted) said.set(owner, waiting);
      } else if (late && (late.deliveredAt ?? 0) > late.due && !late.wentElsewhere) {
        late.wentElsewhere = true;
        elsewhere.set(
          owner,
          `I took this one to the shop in town. ${cap(own(late.title))} came back after the time you gave me.`,
        );
      }
    }
    for (const [owner, says] of elsewhere) {
      const before = candidates.length;
      for (let i = candidates.length - 1; i >= 0; i--)
        if (templates[candidates[i] ?? -1]?.[2] === owner) candidates.splice(i, 1);
      if (candidates.length < before && says) {
        log(s, s.people[owner]?.name ?? owner, says, 'warning');
        const job = said.get(owner);
        if (job) job.withheldNoted = true;
      }
    }
  }
  const count = Math.min(initial ? 3 : 2, candidates.length);
  for (let i = 0; i < count; i++) {
    const selected = initial ? 0 : Math.floor(random(s) * candidates.length);
    const choice = candidates.splice(selected, 1)[0];
    if (choice === undefined) continue;
    const t = templates[choice];
    if (!t) continue;
    const title = continuing
      ? `${commissionTitles[choice]} ${familyHistory(choice).length + 1}`
      : t[1];
    const job = makeJob(s, t[0], title, t[2], t[3], t[4], base + DAY + CLOSE);
    if (initial && i === 0)
      job.model = createModel('lantern', s.seed, [{ componentId: 'contact', condition: 'dirty' }]);
    if (initial && i === 1)
      job.model = createModel('fan', s.seed, [{ componentId: 'cell', condition: 'weak' }]);
    if (initial && i === 2)
      job.model = createModel('music-box', s.seed, [{ componentId: 'gear', condition: 'worn' }]);
    if (!continuing && choice === 3)
      job.model = createModel('lantern', (s.seed ^ 0x68616c69) >>> 0, [
        { componentId: 'switch', condition: 'worn' },
      ]);
    if (choice === 5) {
      job.model.desiredRPM = 18;
      job.model.tolerance = 1;
      job.description += ' I want the figures to turn at 18 rpm, within one rpm.';
    }
    if (!initial && (continuing || choice !== 3) && s.day >= 4 && random(s) > 0.5) {
      const extra = job.model.components.find((c) => c.condition === 'good' && c.kind !== 'cell');
      if (extra) {
        const candidates = supportedFaults[extra.kind];
        setGeneratedCondition(
          extra,
          candidates[Math.floor(random(s) * candidates.length)] ?? 'good',
        );
      }
      job.reward += 8;
      job.description += ' It has been stored for years; more than one part may have a fault.';
    }
    if (!initial) {
      const stakes =
        (continuing
          ? [
              'This is another reading light for the room. Please check it while working.',
              'This is another desk fan for a warm room. Please check airflow through its filter.',
              'This is a different music box. Please keep its tune steady under load.',
              'This is a different path lantern. I need it to stay on when carried.',
              'This is another fan for a shared room. Please test it with its grille fitted.',
              'This is a different winding toy. Please check its pace while the figures move.',
            ]
          : [
              'I am testing a reading-light design. Please test it with the light actually working.',
              'I work at the dish station in Bornova. I am here to learn repairs, not to offer expertise.',
              'This was my grandmother’s. I do not want a new motor; I want this one to work.',
              'The garden path is uneven. I need it to stay on when it is carried.',
              'We are opening the room on Saturday. The fan needs to move air through its grille.',
              'I picked this up with my sister. There is no hurry if you want to try.',
            ])[choice] ?? 'Please check it in ordinary use.';
      const stored = job.description.includes('stored for years');
      job.description = reportedSymptoms(job, stakes);
      if (choice === 5) job.description += ' I want the figures to turn at 18 rpm, within one rpm.';
      if (stored)
        job.description += ' It has been stored for years; more than one part may have a fault.';
    }
    job.requiredConditions =
      choice === 0 ? ['load'] : job.kind === 'lantern' ? ['movement'] : ['load'];
    job.quote = `You will receive £${job.reward} if the object is restored and checked. Return it by ${dayTime(job.due)}.`;
    // Engine 5: the music box has no motor; Nora says what she means.
    if (currentRules(s))
      job.description = job.description.replace(
        'I do not want a new motor',
        'I do not want new parts',
      );
    s.jobs.push(job);
  }
  log(
    s,
    'Workshop',
    count === 0
      ? 'There are no new requests today. The existing objects and promises remain.'
      : initial
        ? 'Word of the family repair reaches the neighbours. Three requests are waiting. You do not have to accept all of them.'
        : count === 1
          ? 'One neighbour has brought a request. It can wait while you decide what fits.'
          : 'Two neighbours have brought work. Their requests can wait while you decide what fits.',
  );
}
function ensureNeighbours(s: GameState): void {
  if (!s.jobs.some((j) => j.ownerId !== 'player' && j.ownerId !== 'mum')) neighbourOffers(s, true);
}
function cuesFor(job: Job, actorId?: string): Record<string, string> {
  return evidenceContext(job, actorId);
}
function addEvidence(
  s: GameState,
  job: Job,
  observation: Observation,
  kind: Evidence['kind'],
  extra: Partial<Evidence> = {},
): void {
  job.evidence.push({ id: s.nextId++, at: s.now, kind, ...observation, ...extra });
  if (job.evidence.length > 80) job.evidence.splice(0, job.evidence.length - 80);
}
function canWork(s: GameState, job: Job): string | undefined {
  if (s.community?.reservedJobIds.includes(job.id))
    return 'This object is reserved for the neighbourhood gathering until it comes home.';
  if (job.status !== 'active' && job.status !== 'ready')
    return 'Accept this request before doing the work.';
  if (job.assignedTo) return 'Sam has this object. Recall it before taking over.';
  if (
    !s.upgrades.includes('second-bench') &&
    s.npcWork.some(
      (w) => w.jobId && !['ask-help', 'rest', 'personal', 'eat', 'drink'].includes(w.option.action),
    )
  )
    return 'Sam is using the only bench. Recall his work or add a second bench.';
  return undefined;
}
function canSpendTime(s: GameState, minutes: number): boolean {
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= dayRemaining(s);
}
function activityOptions(s: GameState, job: Job): WorkOption[] {
  const options: WorkOption[] = [];
  const lastWorkId = job.evidence.findLast((e) => e.kind === 'work')?.id ?? 0;
  const currentEvidence = job.evidence.filter(
    (e) => e.id > lastWorkId && e.actorId === job.assignedTo,
  );
  for (const c of job.model.components) {
    if (!currentEvidence.some((e) => e.kind === 'inspection' && e.componentId === c.id))
      options.push({
        id: `inspect:${c.id}`,
        action: `inspect:${c.id}`,
        label: `Examine ${c.label}`,
        duration: 10,
        effort: 0.04,
      });
    for (const condition of CONDITIONS) {
      const id = `measure:${c.id}:${condition}`;
      if (
        !currentEvidence.some(
          (e) =>
            e.kind === 'measurement' &&
            e.componentId === c.id &&
            e.request?.condition === condition,
        )
      )
        options.push({
          id,
          action: id,
          label: `Measure ${c.label} under ${condition}`,
          duration: 10,
          effort: 0.03,
        });
    }
    if (c.kind === 'governor')
      for (let setting = 0; setting <= 4; setting++) {
        const action = `calibrate:${c.id}:${setting}`;
        options.push({
          id: action,
          action,
          label: `Set ${c.label} collar to ${setting}`,
          duration: 20,
          effort: 0.06,
        });
      }
    for (const work of ['clean', 'adjust', 'replace'] as const) {
      if (c.kind === 'governor' && work === 'adjust') continue;
      if (work === 'replace' && !(s.stock[c.kind] ?? 0)) continue;
      const id = `${work}:${c.id}`;
      options.push({
        id,
        action: id,
        label: `${work} ${c.label}`,
        duration: COSTS[work],
        effort: 0.08,
      });
    }
  }
  const nodes = terminals(job.model);
  const modes =
    job.kind === 'music-box' ? (['motion'] as const) : (['voltage', 'continuity'] as const);
  for (const mode of modes)
    for (const a of nodes)
      for (const b of nodes)
        if (a !== b)
          for (const condition of CONDITIONS) {
            const request = { mode, a, b, condition };
            const setup = { ...job.model, power: mode !== 'continuity' };
            if (measure(setup, request).cues.signal === 'invalid') continue;
            if (
              currentEvidence.some(
                (e) =>
                  e.actorId === 'sam' &&
                  e.request?.mode === mode &&
                  e.request.a === a &&
                  e.request.b === b &&
                  e.request.condition === condition,
              )
            )
              continue;
            const action = `probe:${mode}:${a}:${b}:${condition}`;
            options.push({
              id: action,
              action,
              label: `Read ${mode} from ${a} to ${b} under ${condition}`,
              duration: 10,
              effort: 0.03,
            });
          }
  for (const condition of CONDITIONS)
    if (!currentEvidence.some((e) => e.kind === 'use' && e.condition === condition)) {
      const id = `verify:${condition}`;
      options.push({
        id,
        action: id,
        label: `Check ${job.title} under ${condition}`,
        duration: 15,
        effort: 0.04,
      });
    }
  if (
    job.status === 'ready' &&
    !job.isDonor &&
    evidenceContext(job, job.assignedTo).stage === 'ready'
  )
    options.push({
      id: job.isPersonal ? 'complete-project' : 'deliver',
      action: job.isPersonal ? 'complete-project' : 'deliver',
      label: job.isPersonal ? `Finish the checked work on ${job.title}` : `Return ${job.title}`,
      duration: 10,
      effort: 0.04,
    });
  options.push(
    {
      id: 'ask-help',
      action: 'ask-help',
      label: 'Ask for help with the evidence',
      duration: 10,
      effort: 0,
    },
    { id: 'rest', action: 'rest', label: 'Take a proper break', duration: 30, effort: 0 },
    { id: 'personal', action: 'personal', label: 'Keep my own plans', duration: 30, effort: 0 },
    { id: 'eat', action: 'eat', label: 'Have food and water', duration: 25, effort: 0 },
    { id: 'drink', action: 'drink', label: 'Get a glass of water', duration: 5, effort: 0 },
  );
  const person = job.assignedTo ? s.people[job.assignedTo] : undefined;
  return options
    .filter(
      (option) =>
        job.status !== 'ready' ||
        evidenceContext(job, job.assignedTo).stage !== 'ready' ||
        ['complete-project', 'deliver', 'rest', 'personal', 'eat', 'drink'].includes(option.action),
    )
    .filter((o) => canSpendTime(s, o.duration))
    .map((option) => ({
      ...option,
      advances: person
        ? responsibilityAdvances(person, job.responsibility, job.id, option.action)
        : [],
    }));
}
function beginNpc(s: GameState, job: Job): void {
  const personId = job.assignedTo;
  const person = personId ? s.people[personId] : undefined;
  if (!person || person.activity || job.blocked || s.npcWork.some((w) => w.personId === person.id))
    return;
  const options = activityOptions(s, job);
  if (!options.length) return;
  const choice = chooseActivity(person, job.id, cuesFor(job, person.id), options, s.now);
  const option = options.find((o) => o.id === choice.chosenId);
  if (!option || !startActivity(person, option, s.now)) {
    const why = currentRules(s) ? choiceSpeech(person, choice) : '';
    job.blocked = {
      at: s.now,
      kind: 'unavailable',
      reason: why
        ? `I cannot start this work now. ${why} Ask me to reconsider when that changes.`
        : 'I cannot start this work now. Ask me to reconsider when circumstances change.',
    };
    log(
      s,
      person.name,
      why ? `I cannot start this work now. ${why}` : 'I cannot start this work now.',
      'warning',
    );
    return;
  }
  let reservedPart: ComponentKind | undefined;
  if (option.action.startsWith('replace:')) {
    const part = compatiblePart(job.model, option.action.split(':')[1] ?? '');
    if (part && (s.stock[part] ?? 0) > 0) {
      s.stock[part] = (s.stock[part] ?? 0) - 1;
      reservedPart = part;
    } else {
      finishActivity(person, option, false, s.now);
      return;
    }
  }
  s.npcWork.push({
    personId: person.id,
    jobId: job.id,
    option,
    startedAt: s.now,
    endsAt: s.now + option.duration,
    ...(reservedPart ? { reservedPart } : {}),
  });
  log(
    s,
    person.name,
    option.action === 'ask-help'
      ? helpFeedback(
          job,
          person,
          options.map((option) => option.action),
        )
      : option.action === 'rest'
        ? 'I need a break before doing careful work.'
        : ['personal', 'eat', 'drink', 'rest'].includes(option.action)
          ? choiceSpeech(person, choice)
          : `I’ll ${option.label.toLowerCase()}.`,
  );
}
function resolvePhysical(s: GameState, job: Job, action: string): boolean {
  const [verb, id, condition] = action.split(':');
  if (verb === 'inspect' && id) {
    const observation = inspectComponent(job.model, id);
    if (!job.inspected.includes(id)) job.inspected.push(id);
    addEvidence(s, job, observation, 'inspection', { componentId: id });
    return true;
  }
  if (verb === 'probe') {
    const [, mode, a, b, testCondition] = action.split(':');
    if (!mode || !a || !b || !testCondition) return false;
    const request = {
      mode: mode as import('./types').MeterMode,
      a,
      b,
      condition: testCondition as TestCondition,
    };
    const priorPower = job.model.power;
    job.model.power = mode !== 'continuity';
    const observation = measure(job.model, request);
    // Continuity requires temporary power-off setup, not a lasting change to the object.
    if (mode === 'continuity') job.model.power = priorPower;
    const component = job.model.components.find(
      (c) => c.terminals.includes(a) && c.terminals.includes(b),
    );
    addEvidence(s, job, observation, 'measurement', {
      request,
      ...(component ? { componentId: component.id } : {}),
      value: observation.value,
      unit: observation.unit,
    });
    return observation.cues.signal !== 'invalid';
  }
  if (verb === 'measure' && id) {
    const component = job.model.components.find((c) => c.id === id);
    if (!component) return false;
    const request = {
      mode: job.kind === 'music-box' ? ('motion' as const) : ('voltage' as const),
      a: component.terminals[0],
      b: component.terminals[1],
      condition: (condition ?? 'bench') as TestCondition,
    };
    job.model.power = true;
    const observation = measure(job.model, request);
    addEvidence(s, job, observation, 'measurement', {
      componentId: id,
      request,
      value: observation.value,
      unit: observation.unit,
    });
    return observation.cues.signal !== 'invalid';
  }
  if ((verb === 'clean' || verb === 'adjust' || verb === 'replace') && id) {
    const result = intervene(job.model, id, verb);
    job.verified = [];
    job.status = 'active';
    addEvidence(s, job, { summary: result.summary, cues: { part: id, signal: 'worked' } }, 'work', {
      componentId: id,
    });
    return result.ok;
  }
  if (verb === 'calibrate' && id) {
    const result = calibrate(job.model, id, Number(condition));
    job.verified = [];
    job.status = 'active';
    addEvidence(s, job, { summary: result.summary, cues: { part: id, signal: 'worked' } }, 'work', {
      componentId: id,
    });
    return result.ok;
  }
  if (verb === 'verify') {
    const tried = runUseTest(job.model, (id ?? 'bench') as TestCondition);
    const condition = (id ?? 'bench') as TestCondition;
    // Engine 5: the ear and eye compare with the last try under the same condition, not with a number.
    const before = (
      job.evidence.findLast((e) => e.kind === 'use' && e.condition === condition) as
        | { output?: number }
        | undefined
    )?.output;
    const change =
      before === undefined || tried.passes || tried.output === 0
        ? ''
        : tried.output > before * 1.05
          ? ' The drum turns faster than it did on the last try.'
          : tried.output < before * 0.95
            ? ' The drum turns slower than it did on the last try.'
            : ' The drum turns at about the same speed as it did on the last try.';
    const felt = feltUse(job.model, condition, tried);
    const use = currentRules(s)
      ? { ...tried, summary: job.model.kind === 'music-box' ? `${felt}${change}` : felt }
      : tried;
    addEvidence(s, job, use, 'use', { condition: (id ?? 'bench') as TestCondition });
    if (use.passes && !job.verified.includes(id as TestCondition))
      job.verified.push(id as TestCondition);
    if (!use.passes) job.verified = job.verified.filter((c) => c !== id);
    job.status = requiredChecks(job).every((c) => job.verified.includes(c)) ? 'ready' : 'active';
    return use.passes;
  }
  return false;
}
function deliver(s: GameState, job: Job, unfinished: boolean, who = 'player'): void {
  if (job.isDonor) return;
  const realChecks = requiredChecks(job).every(
    (c) => runUseTest({ ...job.model, power: true }, c).passes,
  );
  const checked =
    job.status === 'ready' &&
    requiredChecks(job).every((c) => job.verified.includes(c)) &&
    realChecks;
  const onTime = s.now <= job.due;
  const responsible = job.assignedTo ? s.people[job.assignedTo] : undefined;
  if (responsible) {
    if (checked && !unfinished)
      completeResponsibility(responsible, job.responsibility, job.id, true, s.now);
    else {
      abandonResponsibility(responsible, job.responsibility);
      job.responsibility = undefined;
    }
  }
  job.status = 'delivered';
  job.deliveredAt = s.now;
  job.completedBy = who;
  job.assignedTo = undefined;
  job.returnedUnfinished = unfinished || !checked;
  const owner = s.people[job.ownerId];
  if (checked && !unfinished) {
    const payment = onTime ? job.reward : Math.floor(job.reward * 0.7);
    s.cash += payment;
    s.reputation += onTime ? 1 : 0;
    const actions = job.contributions.filter((c) => c.actorId === who).map((c) => c.action);
    const firstIntervention = job.evidence.find((e) => e.actorId === who && e.kind === 'work');
    const diagnosed =
      !!firstIntervention &&
      job.evidence.some(
        (e) =>
          e.actorId === who &&
          e.id < firstIntervention.id &&
          e.kind === 'measurement' &&
          e.request &&
          e.cues.signal !== 'invalid' &&
          e.cues.signal !== 'power-off',
      );
    const independent =
      who !== 'player' &&
      !job.contributions.some((c) => c.actorId === 'player') &&
      actions.includes('intake') &&
      diagnosed &&
      actions.some((a) => /^(clean|adjust|replace|calibrate):/.test(a)) &&
      requiredChecks(job).every((c) => actions.includes(`verify:${c}`));
    if (independent) {
      s.independentRepairs++;
      const person = s.people[who];
      if (person) completeRepairAspiration(person, true, s.now);
    }
    log(
      s,
      owner?.name ?? 'Workshop',
      `${job.title} is back in use.${payment ? ` The workshop received £${payment}.` : ''}${onTime ? '' : ' It came back later than promised.'}${independent ? ' Sam handled the whole repair.' : who !== 'player' ? ' Sam returned the object after shared work.' : ''}`,
      'good',
    );
    const replaced = job.contributions
      .filter((c) => c.action.startsWith('replace:'))
      .map((c) => c.action.slice('replace:'.length));
    if (currentRules(s) && replaced.length && job.description.includes('I want this one to work'))
      log(
        s,
        owner?.name ?? 'Workshop',
        `It plays, and I’m glad. You put in a new ${[...new Set(replaced)].join(' and a new ')}, though. It isn’t quite her box any more.`,
        'warning',
      );
  } else {
    s.reputation -= unfinished ? 0 : 2;
    log(
      s,
      owner?.name ?? 'Workshop',
      unfinished
        ? currentRules(s)
          ? unfinishedReply(s, job, onTime)
          : `Thank you for telling me what remains. I’ll make another plan.${onTime ? '' : ' It came back later than promised.'}`
        : `The unchecked ${named(s, job.title)} is not reliable in use. No payment is due.${onTime ? '' : ' It came back later than promised.'}`,
      'warning',
    );
  }
  if (owner)
    reportDelivery(
      owner,
      job.id,
      job.returnedUnfinished ? 'unfinished' : onTime ? 'checked' : 'late',
      s.now,
      who,
      job.title,
      onTime,
    );
  ensureNeighbours(s);
}
function releaseJob(s: GameState, job: Job): void {
  const person = job.assignedTo ? s.people[job.assignedTo] : undefined;
  if (person) abandonResponsibility(person, job.responsibility);
  job.responsibility = undefined;
  if (person)
    for (const commitment of person.agenda.commitments)
      if (
        commitment.status === 'pending' &&
        commitment.targetId === job.id &&
        commitment.actions.includes('deliver')
      )
        releaseCommitment(person, commitment.id);
  job.assignedTo = undefined;
  delete job.blocked;
  if (s.pendingRequest?.jobId === job.id) s.pendingRequest = undefined;
}

/** HF can withdraw a neglected purpose. Host ownership must follow that actual decision. */
function reconcileResponsibilities(s: GameState): void {
  for (const job of s.jobs) {
    if (
      job.responsibility &&
      terminalStates.has(job.status) &&
      !s.people.sam?.agenda.goals.some((goal) => goal.id === job.responsibility?.goalId)
    )
      job.responsibility = undefined;
    // Ownership alone does not establish an adopted native purpose.
    if (!job.assignedTo || !job.responsibility || !['active', 'ready'].includes(job.status))
      continue;
    const person = s.people[job.assignedTo];
    const goal = person?.agenda.goals.find(
      (candidate) => candidate.id === job.responsibility?.goalId,
    );
    if (goal?.status === 'active') continue;
    const cancelled = s.npcWork.filter(
      (work) => work.jobId === job.id && work.personId === job.assignedTo,
    );
    for (const work of cancelled) {
      if (work.reservedPart) s.stock[work.reservedPart] = (s.stock[work.reservedPart] ?? 0) + 1;
      if (person) finishActivity(person, work.option, false, s.now);
    }
    s.npcWork = s.npcWork.filter((work) => !cancelled.includes(work));
    releaseJob(s, job);
    log(
      s,
      person?.name ?? 'Workshop',
      `I no longer have the goal of repairing ${named(s, job.title)}. The object is back on the bench for you to decide what happens next.`,
      'warning',
    );
  }
}
function finishNpc(s: GameState, work: NpcWork): void {
  const person = s.people[work.personId];
  const job = s.jobs.find((j) => j.id === work.jobId);
  if (!person) return;
  let success = true;
  if (job && !terminalStates.has(job.status)) {
    if (work.option.action === 'accept-repair') {
      if (!job.contributions.length && !job.evidence.length)
        job.contributions.push({ actorId: person.id, action: 'intake', at: s.now });
    } else if (work.option.action === 'deliver') {
      success = !job.isDonor && !job.isPersonal;
      if (success) deliver(s, job, false, person.id);
    } else if (work.option.action === 'complete-project') {
      success =
        job.isPersonal === true &&
        job.status === 'ready' &&
        requiredChecks(job).every(
          (condition) =>
            job.verified.includes(condition) && runUseTest(job.model, condition).passes,
        );
      if (success) {
        success = completeResponsibility(person, job.responsibility, job.id, true, s.now);
        if (success) {
          job.contributions.push({ actorId: person.id, action: 'complete-project', at: s.now });
          job.completedBy = person.id;
          job.assignedTo = undefined;
          job.responsibility = undefined;
          delete job.blocked;
          log(
            s,
            person.name,
            `I have finished the checked work on ${named(s, job.title)}. It stays here for us to use.`,
            'good',
          );
        }
      } else job.status = 'active';
    } else if (work.option.action === 'ask-help') {
      job.blocked = {
        at: s.now,
        kind: 'help',
        reason: helpFeedback(
          job,
          person,
          activityOptions(s, job).map((option) => option.action),
        ),
      };
      log(
        s,
        person.name,
        `I have put ${named(s, job.title)} safely aside. I still have responsibility. ${job.blocked.reason}`,
        'warning',
      );
    } else if (!['rest', 'eat', 'drink', 'personal'].includes(work.option.action)) {
      if (
        /^(clean|adjust|replace|calibrate):/.test(work.option.action) &&
        job.pendingLessons.length
      ) {
        job.pendingLessons = [];
        log(
          s,
          'Workshop',
          'The object changed again before the previous repair step was checked. A later result cannot show which step caused it.',
        );
      }
      const priorEvidenceId = job.evidence.at(-1)?.id ?? 0;
      success = resolvePhysical(s, job, work.option.action);
      job.contributions.push({ actorId: person.id, action: work.option.action, at: s.now });
      for (const evidence of job.evidence.filter((entry) => entry.id > priorEvidenceId)) {
        evidence.actorId = person.id;
        perceiveEvidence(s, person.id, job, evidence);
      }
    }
  }
  const receivedRevision = job
    ? Math.max(
        0,
        ...job.evidence
          .filter((e) => e.actorId === person.id || e.witnessedBy?.includes(person.id))
          .map((e) => e.id),
      )
    : 0;
  finishActivity(
    person,
    work.option,
    success,
    s.now,
    job
      ? responsibilityOutcomeAdvances(
          person,
          job.responsibility,
          job.id,
          work.option.action,
          success && job.blocked?.kind === 'help',
          receivedRevision,
        )
      : [],
  );
}
function perceiveEvidence(s: GameState, personId: string, job: Job, evidence: Evidence): boolean {
  const person = s.people[personId];
  if (!person) return false;
  return (
    perceive(person, [
      {
        at: s.now,
        channel: 'saw',
        kind: `repair-observation:${evidence.kind}`,
        summary: evidence.summary,
        actorId: evidence.actorId ?? 'player',
        targetId: job.id,
        salience: 0.75,
        valence: 0,
      },
    ]).length > 0
  );
}
function releaseLesson(s: GameState): void {
  s.watching = false;
  s.watchUntil = undefined;
  const sam = s.people.sam;
  if (!sam) return;
  for (const commitment of sam.agenda.commitments)
    if (commitment.status === 'pending' && commitment.actions.includes('complete-lesson'))
      releaseCommitment(sam, commitment.id);
}
function acceptResponsibility(s: GameState, job: Job): boolean {
  const sam = s.people.sam;
  if (!sam) return false;
  if (job.isPersonal && job.completedBy) {
    const completedAt = job.contributions.findLast((c) => c.action === 'complete-project')?.at;
    const latestWork = job.evidence.findLast((e) => e.kind === 'work')?.at ?? 0;
    if (completedAt !== undefined && latestWork <= completedAt) {
      log(
        s,
        sam.name,
        'That project is already checked and finished. There is no new work for me to take responsibility for.',
      );
      return false;
    }
  }
  const freshAcceptance = job.assignedTo !== sam.id;
  if (freshAcceptance) {
    if (!canSpendTime(s, 1)) {
      log(s, sam.name, 'There is no time to agree a new repair today.');
      return false;
    }
    const options: WorkOption[] = [
      {
        id: 'accept-repair',
        action: 'accept-repair',
        label: `Accept responsibility for ${job.title}`,
        duration: 1,
        effort: 0,
      },
      {
        id: 'eat',
        action: 'eat',
        label: 'Have food and water',
        duration: Math.min(25, dayRemaining(s)),
        effort: 0,
      },
      {
        id: 'drink',
        action: 'drink',
        label: 'Get a glass of water',
        duration: Math.min(5, dayRemaining(s)),
        effort: 0,
      },
      {
        id: 'rest',
        action: 'rest',
        label: 'Take a break',
        duration: Math.min(30, dayRemaining(s)),
        effort: 0,
      },
      {
        id: 'personal',
        action: 'personal',
        label: 'Keep my own plans',
        duration: Math.min(30, dayRemaining(s)),
        effort: 0,
      },
    ];
    const choice = chooseActivity(
      sam,
      'ordinary-day',
      {},
      options,
      s.now,
      currentRules(s) ? playerAsk('accept-repair', 0.25) : undefined,
    );
    const option = options.find((candidate) => candidate.id === choice.chosenId);
    if (!option || !startActivity(sam, option, s.now)) return false;
    if (option.action !== 'accept-repair') {
      s.npcWork.push({
        personId: sam.id,
        option,
        startedAt: s.now,
        endsAt: s.now + option.duration,
      });
      log(s, sam.name, `I have not accepted ${named(s, job.title)}. ${choiceSpeech(sam, choice)}`);
      return false;
    }
    s.npcWork.push({
      personId: sam.id,
      jobId: job.id,
      option,
      startedAt: s.now,
      endsAt: s.now + 1,
    });
    log(s, sam.name, `I accept responsibility for ${named(s, job.title)}.`);
  }
  job.assignedTo = 'sam';
  job.responsibility ??= adoptResponsibility(sam, job.id, s.now);
  delete job.blocked;
  // Fresh consent can replace a released promise before its original deadline.
  // Continuing responsibility cannot renew a promise or erase a missed return.
  if (
    freshAcceptance &&
    !job.isPersonal &&
    job.due > s.now &&
    !sam.agenda.commitments.some(
      (c) => c.targetId === job.id && c.actions.includes('deliver') && c.status !== 'released',
    )
  )
    promiseJob(sam, job.id, job.due, s.now);
  beginNpc(s, job);
  return true;
}
function handlePendingRequest(s: GameState): void {
  const request = s.pendingRequest;
  if (!request) return;
  if (request.status === 'ready') {
    if (s.now >= (request.readyUntil ?? 0)) {
      releaseLesson(s);
      s.pendingRequest = undefined;
      const sam = s.people.sam;
      if (currentRules(s) && sam) notePlayerWord(sam, false, 'start-lesson', s.now);
      log(
        s,
        'Sam',
        currentRules(s)
          ? 'I kept that time free and you didn’t start. I’ll still come when you ask, but I’ll want to see you begin.'
          : 'The time I set aside to start a lesson has passed. Ask again when you are ready.',
        currentRules(s) ? 'warning' : 'ordinary',
      );
    }
    return;
  }
  const sam = s.people.sam;
  if (!sam || sam.activity || s.npcWork.some((w) => w.personId === 'sam')) return;
  if (request.kind === 'repair') {
    const job = s.jobs.find((j) => j.id === request.jobId);
    s.pendingRequest = undefined;
    if (
      job &&
      ['active', 'ready'].includes(job.status) &&
      !s.community?.reservedJobIds.includes(job.id)
    )
      acceptResponsibility(s, job);
    else log(s, 'Sam', 'That repair offer is no longer available.');
    return;
  }
  const available = Math.min(20, dayRemaining(s));
  if (available < 10) {
    s.pendingRequest = undefined;
    log(s, 'Sam', 'There is no useful time left to start a lesson today.');
    return;
  }
  const agreement = agreeLearningSession(
    sam,
    'workshop-lesson',
    available,
    s.now,
    currentRules(s) ? playerAsk('observe', 0.4) : undefined,
  );
  // Engine 5: a refusal is followed through. Sam actually goes to eat or rest, and says when to ask again.
  const instead =
    !agreement.accepted &&
    currentRules(s) &&
    agreement.instead &&
    agreement.instead.id !== 'observe'
      ? { ...agreement.instead, duration: Math.min(agreement.instead.duration, dayRemaining(s)) }
      : undefined;
  const followed = instead && instead.duration > 0 && startActivity(sam, instead, s.now);
  if (followed && instead)
    s.npcWork.push({
      personId: sam.id,
      option: instead,
      startedAt: s.now,
      endsAt: s.now + instead.duration,
    });
  log(
    s,
    'Sam',
    agreement.accepted
      ? `I can start a lesson with you before ${dayTime(agreement.until)}. Start it when you are ready.`
      : followed && instead
        ? `${agreement.says} Ask me again after ${dayTime(s.now + instead.duration)}.`
        : agreement.says,
  );
  if (agreement.accepted) {
    request.status = 'ready';
    request.readyUntil = agreement.until;
  } else s.pendingRequest = undefined;
}
function beginBackground(s: GameState): void {
  handlePendingRequest(s);
  for (const id of ['sam', 'mum', 'nora', 'rafi', 'halil']) {
    const person = s.people[id];
    if (id === 'halil' && s.day < 3) continue;
    const carried = admissionFacts(s.castChapter, id);
    if (carried && carried.life.place !== 'local-workplace' && s.now < OPEN + 60) continue;
    if (!person || person.activity || s.npcWork.some((w) => w.personId === id)) continue;
    if (id === 'sam') {
      if (s.watching || s.pendingRequest) continue;
      const responsibility = s.jobs.find(
        (j) => j.assignedTo === id && !terminalStates.has(j.status),
      );
      if (responsibility && !responsibility.blocked) {
        beginNpc(s, responsibility);
        if (person.activity) continue;
      }
    }
    let available = dayRemaining(s);
    if (s.community?.resolvedAt === undefined && s.community && s.community.deadline > s.now)
      available = Math.min(available, s.community.deadline - s.now);
    if (available <= 0) continue;
    const currentPromise = person.agenda.commitments.find(
      (c) =>
        c.status === 'pending' &&
        c.actions.includes('personal') &&
        c.from <= s.now &&
        c.until >= s.now,
    );
    const ownWork =
      id === 'sam'
        ? 'Work on my own stand and plans'
        : id === 'mum'
          ? 'Tend the house and garden'
          : id === 'nora'
            ? 'Work on a repair design'
            : id === 'rafi'
              ? 'Label the uncertain parts I brought from Bornova'
              : 'Rest before calling Selin';
    const options: WorkOption[] = [
      {
        id: 'eat',
        action: 'eat',
        label: 'Have food and water',
        duration: Math.min(25, available),
        effort: 0,
      },
      {
        id: 'drink',
        action: 'drink',
        label: 'Get a glass of water',
        duration: Math.min(5, available),
        effort: 0,
      },
      {
        id: 'rest',
        action: 'rest',
        label: 'Take a quiet break',
        duration: Math.min(30, available),
        effort: 0,
      },
      {
        id: 'personal',
        action: 'personal',
        label: currentPromise?.label ?? carried?.assignment ?? ownWork,
        duration: Math.min(45, available),
        effort: 0.02,
      },
    ];
    for (const job of s.jobs.filter(
      (j) =>
        j.ownerId === id &&
        j.status === 'delivered' &&
        !j.returnedUnfinished &&
        !s.community?.reservedJobIds.includes(j.id),
    ))
      options.push({
        id: `use:${job.id}`,
        action: 'leisure',
        label:
          job.kind === 'lantern'
            ? `Read by ${job.title}`
            : job.kind === 'fan'
              ? `Spend time in the room with ${job.title}`
              : `Listen to ${job.title}`,
        duration: Math.min(35, available),
        effort: 0,
      });
    const choice = chooseActivity(person, 'ordinary-day', {}, options, s.now);
    const option = options.find((o) => o.id === choice.chosenId);
    if (option && startActivity(person, option, s.now))
      s.npcWork.push({ personId: id, option, startedAt: s.now, endsAt: s.now + option.duration });
  }
}
/** Engine 5: when a promised return time passes, the owner notices and says so where the player will see it. */
function noteOverdue(s: GameState): void {
  if (!currentRules(s)) return;
  for (const job of s.jobs) {
    if (
      job.isPersonal ||
      job.isDonor ||
      job.ownerId === 'player' ||
      !['active', 'ready'].includes(job.status) ||
      job.due >= s.now
    )
      continue;
    const owner = s.people[job.ownerId];
    if (job.overdueNoted) {
      if (job.overdueAgain || s.now - job.due < DAY) continue;
      job.overdueAgain = true;
      log(
        s,
        owner?.name ?? 'Workshop',
        `${cap(own(job.title))} is a day past what you said. I’ll take it back as it is whenever you like. I will be less willing to rely on the times you promise.`,
        'warning',
      );
      continue;
    }
    job.overdueNoted = true;
    if (owner) notePlayerWord(owner, false, 'deliver', s.now);
    log(
      s,
      owner?.name ?? 'Workshop',
      job.assignedTo
        ? `You said ${dayTime(job.due)} for ${own(job.title)}. Sam has it, I know. I’m still waiting.`
        : `You said ${dayTime(job.due)} for ${own(job.title)}. I’m still waiting. If it can’t be done, tell me and give it back.`,
      'warning',
    );
  }
}
function advance(s: GameState, minutes: number): void {
  const target = s.now + minutes;
  let guard = 0;
  beginBackground(s);
  while (s.now < target && guard++ < 500) {
    const event = s.community;
    const preparationEnds =
      event?.preparations.filter((p) => p.completedAt === undefined).map((p) => p.startedAt + 90) ??
      [];
    const eventBoundary =
      event?.phase === 'completed' || !event
        ? Infinity
        : event.resolvedAt === undefined
          ? event.deadline
          : event.finishesAt;
    const next = Math.min(
      target,
      ...s.npcWork.map((w) => w.endsAt),
      ...preparationEnds,
      eventBoundary,
      s.pendingRequest?.readyUntil ?? Infinity,
      s.watching && (s.watchUntil ?? 0) > s.now ? (s.watchUntil ?? Infinity) : Infinity,
    );
    if (next < s.now)
      throw new Error('A workshop activity has an end time before the current time.');
    s.now = next;
    tickPeople(s.people, next);
    reconcileResponsibilities(s);
    const completed = s.npcWork.filter((w) => w.endsAt <= next);
    s.npcWork = s.npcWork.filter((w) => w.endsAt > next);
    for (const work of completed) finishNpc(s, work);
    if (
      s.watching &&
      s.watchUntil !== undefined &&
      s.now >= s.watchUntil &&
      s.people.sam?.activity?.action !== 'observe'
    ) {
      releaseLesson(s);
      log(s, 'Sam', 'Our agreed learning session has ended. I’ll keep what I actually saw.');
    }
    if (event) {
      for (const preparation of event.preparations)
        if (preparation.completedAt === undefined && preparation.startedAt + 90 <= next) {
          completePreparation(event, preparation.format, preparation.jobId, next);
          const installed = s.jobs.find((job) => job.id === preparation.jobId);
          // This accepted unpaid favour is returned by the physical installation, already included in its 90 minutes.
          // A paid object's temporary loan never settles its separate return promise or earns payment.
          if (
            preparation.completedAt !== undefined &&
            preparation.format === 'reading' &&
            installed?.importance === 'Neighbourhood gathering' &&
            installed.ownerId === 'mum' &&
            installed.reward === 0 &&
            installed.acceptedAt !== undefined &&
            installed.status === 'ready' &&
            !installed.assignedTo &&
            requiredChecks(installed).every(
              (condition) =>
                installed.verified.includes(condition) &&
                runUseTest(installed.model, condition).passes,
            )
          ) {
            installed.contributions.push({
              actorId: 'player',
              action: 'install:reading',
              at: next,
            });
            deliver(s, installed, false);
          }
        }
      if (event.resolvedAt === undefined && next >= event.deadline)
        resolveCommunityEvent(s, event, next);
      if (
        event.resolvedAt !== undefined &&
        next >= event.finishesAt &&
        event.phase !== 'completed'
      ) {
        finalizeCommunityEvent(s, event, next);
        if ((event as import('./community').CommunityState).phase === 'completed')
          log(s, 'Neighbourhood', event.outcome, 'good');
      }
    }
    beginBackground(s);
  }
  s.now = target;
  tickPeople(s.people, target);
  reconcileResponsibilities(s);
  noteOverdue(s);
}
function watcherStart(s: GameState, job: Job, duration: number): WorkOption | undefined {
  if (
    !s.watching ||
    (s.watchUntil !== undefined && s.now + duration > s.watchUntil) ||
    job.assignedTo ||
    s.npcWork.some((w) => w.personId === 'sam')
  )
    return;
  const sam = s.people.sam;
  if (!sam || sam.activity) return;
  const options: WorkOption[] = [
    {
      id: 'observe',
      action: 'observe',
      label: `Watch the work on ${job.title}`,
      duration,
      effort: 0.01,
    },
    { id: 'rest', action: 'rest', label: 'Take a break', duration, effort: 0 },
    { id: 'personal', action: 'personal', label: 'Keep my own plans', duration, effort: 0 },
    { id: 'eat', action: 'eat', label: 'Have food and water', duration, effort: 0 },
    { id: 'drink', action: 'drink', label: 'Get water', duration, effort: 0 },
  ];
  const choice = chooseActivity(sam, 'workshop-lesson', {}, options, s.now);
  if (choice.chosenId !== 'observe') log(s, 'Sam', choiceSpeech(sam, choice));
  const option = options.find((o) => o.id === choice.chosenId);
  if (option && startActivity(sam, option, s.now)) return option;
  return;
}
function playerWork(
  s: GameState,
  job: Job,
  duration: number,
  action: string,
  resolve: () => boolean,
): void {
  const priorCues = cuesFor(job, 'sam');
  const priorEvidenceId = job.evidence.at(-1)?.id ?? 0;
  const lastInterventionId = job.evidence.findLast((e) => e.kind === 'work')?.id ?? 0;
  const priorEvidence = job.evidence.filter(
    (e) => e.id > lastInterventionId && e.witnessedBy?.includes('sam'),
  );
  if (/^(clean|adjust|replace|calibrate):/.test(action) && job.pendingLessons.length) {
    job.pendingLessons = [];
    log(
      s,
      'Workshop',
      'The object changed again before the previous repair step was checked. A later result cannot show which step caused it.',
    );
  }
  const watcher = action === 'deliver' ? undefined : watcherStart(s, job, duration);
  advance(s, duration);
  const success = resolve();
  job.contributions.push({ actorId: 'player', action, at: s.now });
  const newObservations = job.evidence.filter((e) => e.id > priorEvidenceId && e.at === s.now);
  for (const received of newObservations) received.actorId = 'player';
  const sam = s.people.sam;
  if (watcher && sam) {
    finishActivity(sam, watcher, true, s.now);
    if (s.watching && s.watchUntil !== undefined && s.now >= s.watchUntil) {
      releaseLesson(s);
      log(s, 'Sam', 'Our agreed learning session has ended. I’ll keep what I actually saw.');
    }
    if (watcher.action === 'observe') {
      for (const received of newObservations)
        if (perceiveEvidence(s, sam.id, job, received)) received.witnessedBy = ['sam'];
      const witnessedObservations = newObservations.filter((received) =>
        received.witnessedBy?.includes(sam.id),
      );
      if (!witnessedObservations.length) {
        log(
          s,
          'Sam',
          'I was present but did not follow that observation closely enough to learn it.',
        );
        return;
      }
      if (/^(clean|adjust|replace|calibrate):/.test(action)) {
        const componentId = action.split(':')[1];
        const measuredComponent = priorEvidence.filter(
          (e) => e.kind === 'measurement' && e.componentId === componentId,
        );
        const baseline =
          measuredComponent.findLast((e) =>
            [
              'high-drop',
              'low-source',
              'resistance',
              'open-path',
              'slow-drive',
              'blocked-drive',
            ].includes(e.cues.signal ?? ''),
          ) ??
          measuredComponent.at(-1) ??
          priorEvidence.findLast((e) => e.kind === 'use') ??
          (action.startsWith('calibrate:')
            ? priorEvidence.findLast(
                (e) => e.kind === 'measurement' && e.request?.mode === 'motion',
              )
            : undefined);
        job.pendingLessons = job.pendingLessons.filter(
          (l) => l.action.split(':')[1] !== componentId,
        );
        if (!baseline) {
          log(
            s,
            'Sam',
            'I watched the repair step, but I did not see a relevant test after the previous work and before this step. A later check cannot show what this step changed.',
          );
          return;
        }
        job.pendingLessons.push({
          observerId: sam.id,
          action,
          cues: priorCues,
          demonstrationId: `${s.seed}:${s.nextId}:${job.id}:${action}`,
          baseline: structuredClone(baseline),
        });
        log(
          s,
          'Sam',
          'I watched the repair step. I need to watch a check before I know its result.',
        );
      } else {
        for (const observation of witnessedObservations) {
          if (observation.kind !== 'measurement' && observation.kind !== 'use') continue;
          job.pendingLessons = job.pendingLessons.filter((lesson) => {
            const baseline = lesson.baseline;
            const matching =
              observation.kind === 'measurement' &&
              baseline?.request &&
              observation.request &&
              baseline.componentId === observation.componentId &&
              baseline.request.mode === observation.request.mode &&
              baseline.request.a === observation.request.a &&
              baseline.request.b === observation.request.b &&
              baseline.request.condition === observation.request.condition;
            const isCalibration = lesson.action.startsWith('calibrate:');
            const abnormalReading =
              !!baseline &&
              [
                'high-drop',
                'low-source',
                'resistance',
                'open-path',
                'slow-drive',
                'blocked-drive',
              ].includes(baseline.cues.signal ?? '');
            const baselineCondition =
              baseline?.kind === 'use' ? baseline.condition : baseline?.request?.condition;
            const useConditionMatches = isCalibration
              ? observation.condition !== undefined &&
                requiredChecks(job).includes(observation.condition)
              : baselineCondition !== undefined && observation.condition === baselineCondition;
            const observedUse =
              observation.kind === 'use' &&
              baseline !== undefined &&
              useConditionMatches &&
              (isCalibration || (success && abnormalReading) || baseline.kind === 'use');
            if (isCalibration && !observedUse) return true;
            if (!matching && !observedUse) return true;
            // A local resistance/drop reduction is observed improvement even if another fault blocks output.
            const improved =
              (observedUse &&
                success &&
                (baseline.kind !== 'use' || baseline.cues.signal !== 'steady-output')) ||
              (matching &&
                ((baseline.value === null && observation.value !== null) ||
                  (typeof baseline.value === 'number' &&
                    typeof observation.value === 'number' &&
                    (baseline.request?.mode === 'motion'
                      ? false // Changed motion alone is not evidence that the repair helped.
                      : ['cell', 'bulb', 'motor'].includes(observation.componentId ?? '') &&
                          baseline.request?.mode === 'voltage'
                        ? Math.abs(observation.value) > Math.abs(baseline.value)
                        : Math.abs(observation.value) < Math.abs(baseline.value)))));
            teachObserved(
              sam,
              job.id,
              lesson.cues,
              lesson.action,
              lesson.demonstrationId,
              improved ? 'success' : 'failure',
              s.now,
            );
            log(
              s,
              'Sam',
              improved
                ? 'The check showed that repair step helped. I can try it when I have the same observations.'
                : 'The check showed no improvement from that repair step. I’ll remember that result.',
            );
            return false;
          });
        }
        teachObserved(
          sam,
          job.id,
          priorCues,
          action,
          `${s.seed}:${s.nextId}:${job.id}:${action}`,
          // The check procedure succeeded by revealing a result. Device restoration is
          // recorded separately above; a failed use check never grants repair success.
          action.startsWith('verify:') || success ? 'success' : 'failure',
          s.now,
        );
      }
    } else
      log(
        s,
        'Sam',
        watcher.action === 'personal'
          ? 'I kept my own plans during that work.'
          : 'I took a break instead of watching that step.',
      );
  }
}

function sleepToMorning(s: GameState): void {
  for (const work of s.npcWork) {
    if (work.reservedPart) s.stock[work.reservedPart] = (s.stock[work.reservedPart] ?? 0) + 1;
    const person = s.people[work.personId];
    if (person) finishActivity(person, work.option, false, s.now);
  }
  s.npcWork = [];
  releaseLesson(s);
  if (s.pendingRequest) {
    log(s, 'Sam', 'Our unstarted request has ended with the workshop day.');
    s.pendingRequest = undefined;
  }
  const nextBase = Math.floor(s.now / DAY) * DAY + DAY;
  const morning = nextBase + OPEN;
  for (const person of Object.values(s.people)) {
    const duration = morning - s.now;
    const sleep: WorkOption = {
      id: 'sleep',
      action: 'sleep',
      label: 'Sleep through the night',
      duration,
      effort: 0,
    };
    chooseActivity(person, 'home', {}, [sleep], s.now);
    if (startActivity(person, sleep, s.now)) {
      tickPeople({ [person.id]: person }, morning);
      finishActivity(person, sleep, true, morning);
    } else tickPeople({ [person.id]: person }, morning);
    prepareMorning(person, nextBase);
  }
  s.now = morning;
  s.day = Math.floor(morning / DAY) + 1;
  reconcileResponsibilities(s);
  for (const job of s.jobs) if (job.blocked?.kind === 'unavailable') delete job.blocked;
  s.watching = false;
  for (const job of s.jobs) if (job.status === 'offer' && job.due < s.now) job.status = 'declined';
  if (
    s.day > 2 &&
    s.jobs.some((j) => j.ownerId !== 'player' && j.reward > 0 && j.status === 'delivered')
  ) {
    const cost = Math.min(s.cash, 4);
    s.cash -= cost;
    s.dailyCostsPaid += cost;
    log(s, 'Workshop', `£${cost} covers supplies and shared workshop costs for today.`);
  }
  if (s.day === 2) ensureNeighbours(s);
  else neighbourOffers(s);
  if (s.day === 3 && !s.jobs.some((j) => j.ownerId === 'halil')) {
    const visit = makeJob(
      s,
      'lantern',
      'Halil’s visiting lantern',
      'halil',
      '“I came from my town for this visit. I repair things, but I am working fewer hours. This lantern goes dark when carried.”',
      20,
      Math.floor(s.now / DAY) * DAY + DAY + CLOSE,
    );
    visit.model = createModel('lantern', (s.seed ^ 0x68616c69) >>> 0, [
      { componentId: 'switch', condition: 'worn' },
    ]);
    visit.requiredConditions = ['movement'];
    s.jobs.push(visit);
    log(
      s,
      'Halil',
      'I am here for a short workshop visit. My daughter Selin knows I am travelling. I will take a break before we look at the lantern.',
    );
  }
  if (s.day === 3 && !s.community) {
    s.community = createCommunityEvent();
    const fan = makeJob(
      s,
      'fan',
      'The community room fan',
      'mum',
      'The room is ours on Day 4. A fan that moves air through its grille would let Nora read indoors. This is a shared favour, not paid work.',
      0,
      s.community.deadline,
    );
    fan.requiredConditions = ['load'];
    fan.importance = 'Neighbourhood gathering';
    s.jobs.push(fan);
    log(
      s,
      'Sam’s mother',
      `We can use the room and garden tomorrow. The site opens at noon; people arrive at${currentRules(s) ? ' ' : ''}15:00. We have time to prepare two activities, at most. Your paper theatre could be one of them.`,
    );
  }
  log(s, 'Sam', 'I’m back this morning. I have my own afternoon promise again.');
  noteOverdue(s);
  if (s.day === 8 && !s.weekReviewed) {
    s.weekReviewed = true;
    s.ended = true;
    log(
      s,
      'Workshop',
      'The first week is complete. Look at what is back in use, what people can now do, and what you want this workshop to become.',
      'good',
    );
  }
}
export function dispatch(state: GameState, command: Command): CommandResult {
  const s = structuredClone(state);
  const fail = (message: string): CommandResult => ({ state, ok: false, message });
  const done = (message: string): CommandResult => {
    if (s.inputs !== undefined) {
      if (s.inputs.length >= MAX_RECORDED_INPUTS) delete s.inputs;
      else s.inputs.push(structuredClone(command));
    }
    return { state: s, ok: true, message };
  };
  if (s.ended && command.type !== 'continue' && command.type !== 'select')
    return fail('The first-week account is ready. Choose whether to keep this workshop going.');
  const job = 'jobId' in command ? s.jobs.find((j) => j.id === command.jobId) : undefined;
  if ('jobId' in command && !job) return fail('That object is not in this workshop.');
  if (job && s.community?.reservedJobIds.includes(job.id) && !['select'].includes(command.type))
    return fail('This object is reserved for the gathering until it comes home.');
  if (
    job &&
    s.pendingRequest?.kind === 'repair' &&
    s.pendingRequest.jobId === job.id &&
    !['select', 'recall'].includes(command.type)
  )
    return fail('That repair offer is waiting for Sam. Cancel the request before taking it back.');
  if (s.chapterPaused && !['resume-chapter', 'select'].includes(command.type))
    return fail('This chapter is paused for departure. Resume it to act.');
  if (['assign', 'start-lesson', 'request-lesson'].includes(command.type)) {
    const facts = admissionFacts(s.castChapter, 'sam');
    if (
      facts &&
      (!facts.availableForExtraWork ||
        (facts.life.place !== 'local-workplace' && s.now < OPEN + 60))
    )
      return fail(
        'Sam must attend to his existing plans first. He is not available for extra workshop work yet.',
      );
  }
  switch (command.type) {
    case 'pause-chapter':
      s.chapterPaused = true;
      log(
        s,
        'Workshop',
        'The chapter is paused so people can leave. Existing work, duties and illness remain. You can save people for another chapter only when they are available and meet the transfer rules.',
      );
      return done('The chapter is paused.');
    case 'resume-chapter':
      s.chapterPaused = false;
      log(s, 'Workshop', 'The same saved chapter resumes. It does not load newer browser history.');
      return done('The chapter has resumed.');

    case 'ask-about-work': {
      const id = command.personId;
      const person = s.people[id];
      if (!person || (id === 'halil' && s.day < 3))
        return fail('That person has not visited this workshop yet.');
      if (s.discoveries?.includes(id))
        return fail('That conversation is already in the workshop notes.');
      const observed =
        id === 'sam'
          ? s.jobs.some((j) => j.evidence.some((e) => e.witnessedBy?.includes('sam')))
          : s.jobs.some(
              (j) =>
                j.ownerId === id &&
                j.evidence.some((e) => e.kind === 'inspection' || e.kind === 'use'),
            );
      if (!observed)
        return fail(
          id === 'sam'
            ? 'Share an actual observation with Sam first. He has not brought out his notebook yet.'
            : 'Look at an object together first. There is no shared work to ask about yet.',
        );
      s.discoveries ??= [];
      s.discoveries.push(id);
      log(s, person.name, discoveredAccounts[id]);
      return done(`${person.name} chose to tell you about the work.`);
    }

    case 'prepare-event': {
      const event = s.community;
      if (!event) return fail('The gathering has not been proposed yet.');
      const result = beginPreparation(s, event, command.format, s.now);
      if (!result.ok) return fail(result.message);
      advance(s, result.cost);
      return done(
        `This gathering activity is prepared. The organisers will choose what they can join at${currentRules(s) ? ' ' : ''}15:00.`,
      );
    }
    case 'wait-for-site': {
      const event = s.community;
      if (!event || s.now >= event.opensAt)
        return fail('The site is already open or has not been offered.');
      if (Math.floor(s.now / DAY) !== Math.floor(event.opensAt / DAY))
        return fail('Use your workshop day; the site opens tomorrow.');
      advance(s, event.opensAt - s.now);
      return done('The site is open. Preparation time now competes with the rest of your work.');
    }
    case 'select':
      s.selectedJobId = command.jobId;
      return done('The object is selected.');
    case 'accept': {
      if (job?.status !== 'offer') return fail('This request has already been decided.');
      if (job.due < s.now) return fail('The requested return time has passed.');
      job.status = 'active';
      job.acceptedAt = s.now;
      log(s, 'You', `I’ll take responsibility for ${named(s, job.title)} by ${dayTime(job.due)}.`);
      s.selectedJobId = job.id;
      return done(
        'You accepted the promise. You can put the object aside without losing your observations.',
      );
    }
    case 'decline':
      if (job?.status !== 'offer') return fail('Only an unaccepted offer can be declined.');
      job.status = 'declined';
      log(s, 'You', `I cannot promise ${named(s, job.title)} this time.`);
      return done('You declined the request honestly.');
    case 'power':
      if (!job || terminalStates.has(job.status))
        return fail('This object is no longer on the bench.');
      if (job.assignedTo) return fail('Recall the object before changing its setup.');
      job.model.power = command.on;
      job.contributions.push({ actorId: 'player', action: `power:${command.on}`, at: s.now });
      return done(command.on ? 'The power is on.' : 'The power is off.');
    case 'inspect': {
      if (!job) return fail('Choose an object.');
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      if (!job.model.components.some((c) => c.id === command.componentId))
        return fail('Choose a marked component.');
      if (!canSpendTime(s, COSTS.inspect))
        return fail('There is not enough workshop time left today.');
      playerWork(s, job, COSTS.inspect, `inspect:${command.componentId}`, () =>
        resolvePhysical(s, job, `inspect:${command.componentId}`),
      );
      return done(job.evidence.at(-1)?.summary ?? 'The component was examined.');
    }
    case 'measure': {
      if (!job) return fail('Choose an object.');
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      const reading = measure(job.model, command.request);
      if (reading.cues.signal === 'invalid') return fail(reading.summary);
      if (!canSpendTime(s, COSTS.measure))
        return fail('There is not enough workshop time left today.');
      const component = job.model.components.find(
        (c) =>
          c.terminals.includes(command.request.a) &&
          c.terminals.includes(command.request.b) &&
          command.request.a !== command.request.b,
      );
      const defaultMode = job.kind === 'music-box' ? 'motion' : 'voltage';
      const action =
        component && command.request.mode === defaultMode
          ? `measure:${component.id}:${command.request.condition}`
          : `probe:${command.request.mode}:${command.request.a}:${command.request.b}:${command.request.condition}`;
      playerWork(s, job, COSTS.measure, action, () => {
        addEvidence(s, job, reading, 'measurement', {
          request: command.request,
          ...(component ? { componentId: component.id } : {}),
          value: reading.value,
          unit: reading.unit,
        });
        if (s.upgrades.includes('precision-meter') && command.request.condition === 'bench') {
          const extra = measure(job.model, { ...command.request, condition: 'load' });
          addEvidence(s, job, extra, 'measurement', {
            request: { ...command.request, condition: 'load' },
            ...(component ? { componentId: component.id } : {}),
            value: extra.value,
            unit: extra.unit,
          });
        }
        return true;
      });
      return done(reading.summary);
    }
    case 'calibrate': {
      if (!job) return fail('Choose an object.');
      if (job.isDonor)
        return fail(
          'The casing is ruined, so this object can only supply spare parts. Recover its parts instead.',
        );
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      const preview = calibrate(structuredClone(job.model), command.componentId, command.setting);
      if (!preview.ok) return fail(preview.summary);
      if (!canSpendTime(s, 20)) return fail('There is not enough time to set the collar today.');
      playerWork(s, job, 20, `calibrate:${command.componentId}:${command.setting}`, () =>
        resolvePhysical(s, job, `calibrate:${command.componentId}:${command.setting}`),
      );
      return done(
        job.evidence.at(-1)?.summary ?? 'The collar was set. Measure the drive or test its pace.',
      );
    }
    case 'work': {
      if (!job) return fail('Choose an object.');
      if (job.isDonor)
        return fail(
          'The casing is ruined, so this object can only supply spare parts. Recover its parts instead.',
        );
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      const part = compatiblePart(job.model, command.componentId);
      if (!part) return fail('Choose a marked component.');
      const duration = COSTS[command.intervention];
      if (!canSpendTime(s, duration)) return fail('There is not enough workshop time left today.');
      if (command.intervention === 'replace' && !(s.stock[part] ?? 0))
        return fail(`There is no compatible ${part} left. Buy or recover one first.`);
      if (command.intervention === 'replace') s.stock[part] = (s.stock[part] ?? 0) - 1;
      playerWork(s, job, duration, `${command.intervention}:${command.componentId}`, () =>
        resolvePhysical(s, job, `${command.intervention}:${command.componentId}`),
      );
      return done(job.evidence.at(-1)?.summary ?? 'The work is complete.');
    }
    case 'verify': {
      if (!job) return fail('Choose an object.');
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      if (!canSpendTime(s, COSTS.verify))
        return fail('There is not enough workshop time left today.');
      playerWork(s, job, COSTS.verify, `verify:${command.condition}`, () =>
        resolvePhysical(s, job, `verify:${command.condition}`),
      );
      return done(job.evidence.at(-1)?.summary ?? 'The check is complete.');
    }
    case 'deliver': {
      if (!job || terminalStates.has(job.status) || job.status === 'offer' || job.isDonor)
        return fail('This object cannot be returned now.');
      if (job.assignedTo)
        return fail('Sam has responsibility; recall the object before returning it yourself.');
      if (
        !command.unfinished &&
        (job.status !== 'ready' || !requiredChecks(job).every((c) => job.verified.includes(c)))
      )
        return fail(
          `Check restored use under ${
            requiredChecks(job)
              .filter((c) => !job.verified.includes(c))
              .join(', ') || requiredChecks(job).join(', ')
          } before returning it, or choose to return it unfinished.`,
        );
      if (!canSpendTime(s, COSTS.deliver))
        return fail('There is not enough workshop time left today.');
      playerWork(s, job, COSTS.deliver, 'deliver', () => {
        deliver(s, job, Boolean(command.unfinished));
        const owner = s.people[job.ownerId];
        if (currentRules(s) && owner && !job.overdueNoted && !job.isPersonal && s.now <= job.due)
          notePlayerWord(owner, true, 'deliver', s.now);
        return job.status === 'delivered' && !job.returnedUnfinished;
      });
      return done(
        job.returnedUnfinished
          ? 'The object was returned unfinished.'
          : 'The object was returned to use.',
      );
    }
    case 'salvage': {
      if (!job || terminalStates.has(job.status) || !job.isDonor)
        return fail('You can only recover parts from your spare object.');
      const blocked = canWork(s, job);
      if (blocked) return fail(blocked);
      const component = job.model.components.find((c) => c.id === command.componentId);
      if (!component) return fail('Choose a component.');
      // Engine 5: a part that looks present costs the attempt to find it unusable; the screen cannot tell.
      const tried = job.contributions.some((c) => c.action === `salvage:${component.id}`);
      if (component.condition === 'open' && (!currentRules(s) || tried))
        return fail('That component is absent or unusable; there is nothing to recover.');
      if (!canSpendTime(s, COSTS.salvage))
        return fail('There is not enough workshop time left today.');
      // Recovery requires actual visible/tested suitability; hidden truth only resolves yield.
      advance(s, COSTS.salvage);
      if (currentRules(s))
        job.contributions.push({ actorId: 'player', action: `salvage:${component.id}`, at: s.now });
      if (component.condition === 'good') {
        s.stock[component.kind] = (s.stock[component.kind] ?? 0) + 1;
        log(
          s,
          'Workshop',
          `You recovered one working ${component.kind}. The donor can now only supply spare parts.`,
          'good',
        );
      } else
        log(
          s,
          'Workshop',
          `The recovered ${component.kind} is not usable. The donor can now only supply spare parts.`,
          'warning',
        );
      component.condition = 'open';
      if (job.model.components.every((c) => c.condition === 'open')) job.status = 'salvaged';
      job.description =
        'This object now supplies spare parts. Recover its remaining parts. It cannot be used again.';
      return done('You finished recovering the part.');
    }
    case 'buy': {
      const price = PART_PRICES[command.part];
      if (!price) return fail('That part is not stocked.');
      if (s.cash < price) return fail(`A ${command.part} costs £${price}; you have £${s.cash}.`);
      if (!canSpendTime(s, COSTS.buy))
        return fail('There is not enough time for the supplier trip today.');
      s.cash -= price;
      advance(s, COSTS.buy);
      s.stock[command.part] = (s.stock[command.part] ?? 0) + 1;
      log(s, 'Workshop', `You bought one ${command.part} for £${price}.`);
      return done('The part is in the tray.');
    }
    case 'upgrade': {
      const upgrade = UPGRADE_CATALOG.find((u) => u.id === command.id);
      if (!upgrade) return fail('This improvement is not available.');
      if (s.upgrades.includes(upgrade.id)) return fail('That improvement is already installed.');
      if (s.cash < upgrade.price) return fail(`This costs £${upgrade.price}; you have £${s.cash}.`);
      if (!canSpendTime(s, 30)) return fail('There is not enough time to install it today.');
      s.cash -= upgrade.price;
      advance(s, 30);
      s.upgrades.push(upgrade.id);
      log(s, 'Workshop', `${upgrade.name} is ready. ${upgrade.description}`, 'good');
      return done('You improved the workshop.');
    }
    case 'cancel-request': {
      if (!s.pendingRequest && !s.watching) return fail('There is no request or lesson to cancel.');
      const responsibility = s.jobs.find(
        (j) => j.id === s.pendingRequest?.jobId && j.assignedTo === 'sam',
      );
      if (responsibility && !responsibility.blocked)
        responsibility.blocked = {
          at: s.now,
          kind: 'unavailable',
          reason: 'The request to reconsider was cancelled. Ask me to retry when you are ready.',
        };
      s.pendingRequest = undefined;
      releaseLesson(s);
      log(s, 'Sam', 'The request is cancelled. I’ll keep my own plans.');
      return done('The request is cancelled.');
    }
    case 'watch':
    case 'request-lesson':
    case 'start-lesson': {
      const sam = s.people.sam;
      if (!sam) return fail('Sam is not here.');
      if (command.type === 'watch' && !command.enabled) {
        if (s.pendingRequest?.kind === 'lesson') s.pendingRequest = undefined;
        releaseLesson(s);
        log(s, 'Sam', 'I’ll stop watching your work.');
        return done('The learning session has ended.');
      }
      if (s.watching) return fail('The learning session has already started.');
      if (s.jobs.some((j) => j.assignedTo === 'sam' && !j.blocked))
        return fail('Sam has an accepted repair. Recall it before requesting a lesson.');
      if (command.type !== 'start-lesson') {
        if (s.pendingRequest) return fail('There is already a request. Start or cancel it first.');
        if (dayRemaining(s) < 10) return fail('There is no useful lesson time left today.');
        s.pendingRequest = { kind: 'lesson', status: 'requested', requestedAt: s.now };
        handlePendingRequest(s);
        if (command.type === 'request-lesson' || s.pendingRequest?.status !== 'ready')
          return done(
            s.pendingRequest?.status === 'requested'
              ? 'Sam will consider the lesson after his current activity.'
              : s.pendingRequest
                ? 'Sam has set aside time to start a lesson.'
                : 'Sam is keeping his own plans.',
          );
      }
      if (s.pendingRequest?.kind !== 'lesson' || s.pendingRequest.status !== 'ready')
        return fail('Ask Sam for a lesson and wait for his agreement first.');
      if (s.now >= (s.pendingRequest.readyUntil ?? 0))
        return fail('The time Sam set aside to start the lesson has passed.');
      if (sam.activity || s.npcWork.some((w) => w.personId === 'sam'))
        return fail('Sam is still occupied.');
      releaseLesson(s);
      // Engine 5: starting inside the time Sam set aside keeps the player's word.
      if (currentRules(s)) notePlayerWord(sam, true, 'start-lesson', s.now);
      const agreement = agreeLearningSession(
        sam,
        'workshop-lesson',
        Math.min(90, dayRemaining(s)),
        s.now,
        currentRules(s) ? playerAsk('observe', 0.4) : undefined,
      );
      s.pendingRequest = undefined;
      s.watching = agreement.accepted;
      s.watchUntil = agreement.accepted ? agreement.until : undefined;
      log(s, 'Sam', agreement.says);
      return done(agreement.says);
    }
    case 'assign': {
      if (!job || (job.status !== 'active' && job.status !== 'ready'))
        return fail('Accept an active job first.');
      if (job.isDonor)
        return fail('This spare object cannot be used again. Recover its parts yourself.');
      if (command.personId !== 'sam')
        return fail('Only Sam has agreed to help with workshop repairs.');
      if (job.assignedTo || s.jobs.some((j) => j.assignedTo === 'sam'))
        return fail('Sam already has responsibility for a repair.');
      if (s.pendingRequest) return fail('There is already a request. Start or cancel it first.');
      if (s.watching)
        log(s, 'Sam', 'We are ending the lesson so I can consider this repair offer.');
      releaseLesson(s);
      if (s.people.sam?.activity || s.npcWork.some((w) => w.personId === 'sam')) {
        s.pendingRequest = {
          kind: 'repair',
          status: 'requested',
          requestedAt: s.now,
          jobId: job.id,
        };
        log(s, 'Sam', `I’ll consider ${named(s, job.title)} after my current activity.`);
        return done('The repair offer will wait until Sam finishes his current activity.');
      }
      const accepted = acceptResponsibility(s, job);
      return done(
        accepted
          ? 'Sam accepted the repair and is choosing from the evidence he has.'
          : 'Sam declined the repair offer. He keeps his own plans.',
      );
    }
    case 'retry-sam': {
      if (!job?.blocked || job.assignedTo !== 'sam')
        return fail('Sam does not have a blocked repair here.');
      if (s.pendingRequest || s.watching)
        return fail('Finish or cancel the current request or lesson first.');
      if (s.people.sam?.activity || s.npcWork.some((w) => w.personId === 'sam'))
        s.pendingRequest = {
          kind: 'repair',
          status: 'requested',
          requestedAt: s.now,
          jobId: job.id,
        };
      else {
        delete job.blocked;
        beginNpc(s, job);
      }
      return done('Sam will reconsider his accepted repair from the evidence he has.');
    }
    case 'recall': {
      if (!job?.assignedTo) return fail('This object is not delegated.');
      const current = s.npcWork.find((w) => w.jobId === job.id);
      // Engine 5: taking back work Sam accepted and is doing, not work he set aside for help, goes back on the
      // player's word. A blocked repair can be taken back freely.
      const midWork = Boolean(current && !job.blocked && current.option.action !== 'accept-repair');
      if (currentRules(s) && midWork && s.people[job.assignedTo]) {
        notePlayerWord(required(s.people[job.assignedTo]), false, 'recall', s.now);
        log(
          s,
          s.people[job.assignedTo]?.name ?? 'Sam',
          `You handed me ${named(s, job.title)} and I was in the middle of it. Fine. Next time, tell me first if you might want it back.`,
          'warning',
        );
      }
      if (current) {
        if (current.reservedPart)
          s.stock[current.reservedPart] = (s.stock[current.reservedPart] ?? 0) + 1;
        const person = s.people[current.personId];
        if (person) finishActivity(person, current.option, false, s.now);
        s.npcWork = s.npcWork.filter((w) => w !== current);
      }
      releaseJob(s, job);
      log(s, 'You', `I’ll take ${named(s, job.title)} back. Sam still knows what he learned.`);
      return done('You took responsibility back.');
    }
    case 'wait':
      if (!Number.isInteger(command.minutes) || command.minutes <= 0 || command.minutes > 480)
        return fail('Choose between 1 and 480 whole minutes of workshop time.');
      if (!canSpendTime(s, command.minutes))
        return fail('That period goes past closing. End the day instead.');
      advance(s, command.minutes);
      return done(`${command.minutes} minutes passed for everyone.`);
    case 'next-day': {
      const remainder = dayRemaining(s);
      if (remainder) advance(s, remainder);
      sleepToMorning(s);
      return done(
        s.ended ? 'Your first-week account is ready.' : 'A new workshop morning has begun.',
      );
    }
    case 'continue':
      if (!s.ended) return fail('The workshop is already open.');
      s.ended = false;
      log(s, 'You', 'The first week is only the beginning. We’ll keep working at our own scale.');
      return done('The workshop continues with new requests.');
  }
}
export { loadGame, saveGame } from './persistence';
