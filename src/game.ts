/** Host-owned appointment, practical terms and exact input protocol.
 * SCOPE: HF 4.0 owns the five people: their beliefs, testimony with its source, source trust,
 * relationships and what each person hears. Every change reaches HF as one timestamped input to
 * `step`; every reading leaves through `inspect` or the run archive. The host owns presence, the
 * appointment clock, money, agreements and consent. Consent below is an authored contract between
 * living people, not a psychological prediction. Ink externals read this state; commands run once,
 * outside Ink evaluation. Not modelled here: retelling drift and audience tuning (HF 4.1 work).
 */
import {
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun as exportHfRun,
  type Input as HfInput,
  type HostRequest,
  inspect,
  type PerceptData,
  type PersonAuthoring,
  type Result,
  type Run,
  type RunArchive,
  step,
} from '@adam0white/human-framework';
import { Story } from 'inkjs';

type PerceptClaim = PerceptData['claims'][number];
/** The part of HF's tie to the nephew that the ending reads. */
type Tie = { trust: number; familiarity: number };

import content from './story.json' with { type: 'json' };

const EDITION = 'word-5';
const HF = '4.17.0';
const PROP = 'floor-reserved-for-morning-repairs';
const ORDER_PROP = 'order.supports-late-service';
const ORDER = ['halil', 'riza', 'osman', 'ferda'] as const;
type Who = (typeof ORDER)[number];
type Page = 'opening' | 'table' | 'hear' | 'offer' | 'private' | 'signing' | 'ending';
export type Input = { choice: string };
export type Proposal = {
  id: number;
  kind: 'morning' | 'late' | 'shared';
  cost: number;
  terms: string;
  consents: Who[];
  smaller: boolean;
  concessions: Who[];
  /** How many times each person has refused this agreement. A new agreement starts fresh. */
  refusals?: Partial<Record<Who, number>>;
};
/** Host state only. The HF run is held beside it (see `runs`) and travels in the export archive. */
export type GameState = {
  edition: typeof EDITION;
  framework: typeof HF;
  seed: number;
  inputs: Input[];
  page: Page;
  remaining: number;
  result: 'playing' | 'win' | 'loss';
  log: { at: number; text: string }[];
  asked: Who[];
  letter: boolean;
  told: Partial<Record<'halil' | 'riza', boolean>>;
  caught: boolean;
  halilLeft: boolean;
  spent: number;
  proposal: Proposal | null;
  nextProposal: number;
  speaker: string;
  speech: string;
  note: string;
};

const MINUTE = 60_000;
const DAY = 86_400_000;
/** The meeting starts at 10:00 on simulation day 0; one appointment minute is one HF minute. */
const START = 10 * 60 * MINUTE;
const MEETING = 24;
const HOST = { type: 'host', id: 'word' } as const;
/** logit(0.97): each person's opening account is held with credence 0.97. */
const FIRM = 3.4760986898352733;
const NAMES: Record<Who | 'nephew', string> = {
  halil: 'Halil',
  riza: 'Rıza',
  osman: 'Osman',
  ferda: 'Ferda',
  nephew: 'You',
};

const baselineTraits = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  emotionality: 0.5,
  honesty: 0.5,
};
const baselineValues = {
  selfDirection: 0.5,
  stimulation: 0.5,
  hedonism: 0.5,
  achievement: 0.5,
  power: 0.5,
  security: 0.5,
  conformity: 0.5,
  tradition: 0.5,
  benevolence: 0.5,
  universalism: 0.5,
};

type Hf = { run: Run; at: number };
const runs = new WeakMap<GameState, Hf>();
function need<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`HF refused ${result.error.path}: ${result.error.message}`);
  return result.value;
}
function hf(s: GameState): Hf {
  const held = runs.get(s);
  if (!held) throw new Error('This meeting has no people. Start a new game.');
  return held;
}
/** The host's appointment clock in HF time. */
function clock(s: GameState): number {
  return START + (MEETING - s.remaining) * MINUTE;
}

function belief(prop: string, value: boolean, source: string) {
  return {
    prop,
    logOdds: value ? FIRM : -FIRM,
    updatedAt: START,
    sources: [{ id: source, value }],
    provenance: { origin: source, firstFrom: source, at: START },
  };
}
function author(
  id: Who | 'nephew',
  age: number,
  sex: 'male' | 'female',
  traits: Partial<typeof baselineTraits>,
  beliefs: ReturnType<typeof belief>[],
  sourceTrust: { sourceId: string; trust: number }[],
): PersonAuthoring {
  return {
    id,
    identity: { name: NAMES[id], birthAt: START - age * 365 * DAY, sex },
    biography: [],
    origin: {
      kind: 'authored',
      basis: { kind: 'evidence', id: `word:cast:${id}` },
      traits: { kind: 'explicit-authoring', evidence: { kind: 'evidence', id: `word:traits:${id}` } },
    },
    state: {
      traits: { ...baselineTraits, ...traits },
      values: { ...baselineValues },
      // Engineering defaults for a rested adult at a late-morning meeting; nobody's body matters here.
      body: {
        satiety: 0.8,
        hydration: 0.85,
        sleepPressure: 0.2,
        exertion: 0,
        fitness: 0.5,
        health: 1,
        pain: 0,
        sleepDebtHours: 0,
        depletion: 0,
        circadianPeakMs: 16 * 60 * MINUTE,
        asleep: false,
        since: START,
        doze: {
          context: { posture: 'upright', stimulation: 0.5 },
          basis: { kind: 'authored', author: 'word', at: START },
        },
        bladder: { fill: 0, pending: 0 },
        injuries: [],
        illnesses: [],
        exposures: [],
      },
      needs: {
        safety: 0.8,
        belonging: 0.7,
        esteem: 0.6,
        autonomy: 0.7,
        competence: 0.6,
        leisure: 0.6,
        meaning: 0.6,
      },
      skills: [],
      heldNorms: [],
      beliefs,
      consequences: [],
      sourceTrust,
      context: {
        scarcity: { kind: 'prior', value: 0, basis: 'engineering:source-zero-context' },
        smoking: { kind: 'unobserved' },
      },
      relationships: [],
      voices: [],
      agenda: {
        exemptions: { traveling: { kind: 'unobserved' }, illnessSeverity: { kind: 'unobserved' } },
        commitments: [],
        goals: [],
        precommitments: [],
        owed: [],
      },
      family: { contactCovered: [], aptitudes: {} },
      groups: [],
      reserve: {},
      retention: { trace: 32, chronicleDays: 120 },
      habits: [],
      expectations: [],
      affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.3, emotions: [] },
      promptings: { reading: 'none', responses: [] },
      review: { style: 'accounting', atMsOfDay: 21 * 60 * MINUTE },
      bonds: { courtships: [], marriages: [] },
    },
  };
}

export function createGame(seed: number): GameState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Choose a valid seed.');
  const run = need(
    createRun({
      id: 'word',
      seed,
      start: START,
      host: { id: 'word', edition: EDITION, schema: EDITION },
      definitions: {
        actions: [],
        norms: [],
        marriageCustoms: [],
        skills: [],
        skillTransfers: [],
        methods: [],
        routines: [],
        sources: [
          HOST,
          ...(['halil', 'riza', 'osman', 'ferda', 'nephew'] as const).map((id) => ({
            type: 'person' as const,
            id,
          })),
        ],
        lexicon: { names: { ...NAMES, nephew: 'Nuri’s nephew' }, roles: {}, prefer: 'name', actions: {} },
        calendar: {
          id: 'word-calendar',
          epoch: { id: 'meeting-day', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
          dayMs: DAY,
          days: [{ dayIndex: 0, start: 0, windows: [] }],
        },
      },
      lifecycle: { kinPremises: [], kinScopes: [] },
      world: { revision: 0, facts: [], hostState: {} },
    }),
  );
  const trustsNephew = { sourceId: 'nephew', trust: 0.8 };
  const cast = [
    author(
      'halil',
      61,
      'male',
      { conscientiousness: 0.6, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, honesty: 0.7 },
      [belief('nuri.promised-morning-work', true, 'nuri')],
      [trustsNephew, { sourceId: 'riza', trust: 0.9 }],
    ),
    author(
      'riza',
      63,
      'male',
      { extraversion: 0.7, agreeableness: 0.7, honesty: 0.65, conscientiousness: 0.45 },
      [belief('nuri.promised-day-storage', true, 'nuri')],
      [{ sourceId: 'halil', trust: 0.9 }, trustsNephew],
    ),
    author(
      'osman',
      55,
      'male',
      { conscientiousness: 0.75, agreeableness: 0.35, honesty: 0.6, extraversion: 0.5 },
      [belief('lease.needs-rent', true, 'ledger')],
      [trustsNephew],
    ),
    author(
      'ferda',
      50,
      'female',
      { conscientiousness: 0.75, honesty: 0.75, extraversion: 0.4 },
      [belief(ORDER_PROP, false, 'opening-budget')],
      [trustsNephew],
    ),
    author('nephew', 30, 'male', {}, [], []),
  ];
  for (const person of cast) need(createPerson(run, person));
  const s: GameState = {
    edition: EDITION,
    framework: HF,
    seed,
    inputs: [],
    page: 'opening',
    remaining: MEETING,
    result: 'playing',
    log: [],
    asked: [],
    letter: false,
    told: {},
    caught: false,
    halilLeft: false,
    spent: 0,
    proposal: null,
    nextProposal: 1,
    speaker: '',
    speech: '',
    note: '',
  };
  runs.set(s, { run, at: START });
  return s;
}

/** Advance HF to a time the host knows, with that moment's inputs. Each request HF issues is
 * resolved exactly once: a conversation is delivered whole to the listening nephew, at full
 * attention, because both sit at the same table. Returns the claims the nephew actually heard. */
function advance(s: GameState, inputs: HfInput[] = [], at = clock(s)): PerceptClaim[] {
  const held = hf(s);
  if (at < held.at && inputs.length)
    throw new Error('His Word tried to send inputs to a time already passed.');
  if (at < held.at || (at === held.at && !inputs.length)) return [];
  const heard: PerceptClaim[] = [];
  const settled = new Set<string>();
  let result = need(step(held.run, { until: at, inputs }));
  while (result.boundary.type === 'world-required') {
    const receipts = result.boundary.requests.map((request) => {
      if (settled.has(request.id)) throw new Error('A request was issued twice.');
      settled.add(request.id);
      return deliver(request, heard);
    });
    result = need(step(held.run, { until: at, inputs: receipts }));
  }
  if (!result.reachedUntil || result.at !== at) throw new Error('HF did not reach the appointment time.');
  held.at = at;
  return heard;
}
function deliver(request: DeepReadonly<HostRequest>, heard: PerceptClaim[]): HfInput {
  // The game offers no actions, so HF can only ask the host to deliver speech.
  if (request.kind !== 'communication') throw new Error('His Word offers no actions to resolve.');
  const itemIds = request.items.map((item) => item.id);
  for (const item of request.items) if (item.data.kind === 'claim') heard.push({ ...item.data.told });
  return {
    id: `word:receipt:${request.id}`,
    at: request.boundaryAt,
    source: HOST,
    kind: 'communication.resolved',
    payload: {
      requestId: request.id,
      requestHash: request.requestHash,
      worldRevision: request.worldRevision,
      speaker: request.speaker,
      emittedItemIds: itemIds,
      received: request.recipients.map((recipient) => ({
        recipient,
        evidenceId: `word:heard:${request.id}:${recipient}`,
        attention: 1,
        itemIds,
      })),
    },
  };
}
function inputId(s: GameState, what: string): string {
  return `word:${s.inputs.length}:${what}`;
}
function socialInput(
  s: GameState,
  who: Who,
  kind: 'deceit-discovered' | 'shared-work',
  magnitude: number,
): HfInput {
  const id = inputId(s, `${kind}:${who}`);
  return {
    id,
    at: clock(s),
    source: HOST,
    kind: 'social.received',
    payload: { person: who, evidenceId: id, other: 'nephew', event: { kind, byMe: false, magnitude } },
  };
}
function contradiction(
  s: GameState,
  who: 'halil' | 'riza',
  value: boolean,
  at: number,
  reporterId?: Who,
): HfInput {
  const id = inputId(s, `contradiction:${who}`);
  return {
    id,
    at,
    source: HOST,
    kind: 'contradiction.received',
    payload: {
      person: who,
      evidenceId: id,
      sourceId: 'nephew',
      prop: PROP,
      value,
      ...(reporterId ? { reporterId } : {}),
    },
  };
}

/** The run archive. HF 4.0 `inspect` has no source-trust or contradiction selection, so these two
 * readings come from the archive, as in HF's own word-and-witness control. Reading never changes it. */
function archive(s: GameState): DeepReadonly<RunArchive> {
  return exportHfRun(hf(s).run);
}
/** HF's actual reading of one person: trust in the nephew as a source, and their tie to him. */
export function reading(s: GameState, who: Who): { sourceTrust: number; tie: Tie | undefined } {
  const found = readings(s, [who])[who];
  if (!found) throw new Error(`${NAMES[who]} has no reading of you.`);
  return found;
}
function readings(s: GameState, people: readonly Who[]) {
  const run = hf(s).run;
  const current = archive(s).current.people;
  const view = need(inspect(run, { perspective: { kind: 'host' }, people, select: ['relationships'] }));
  const out: Partial<Record<Who, { sourceTrust: number; tie: Tie | undefined }>> = {};
  for (const who of people) {
    const sourceTrust = current[who]?.memory.sourceTrust.nephew;
    const person = view.people.find((p) => p.id === who);
    const part = person?.kind === 'host' ? person.parts.find((p) => p.select === 'relationships') : undefined;
    const tie =
      part?.select === 'relationships' ? part.value.ties.find((t) => t.otherId === 'nephew') : undefined;
    if (sourceTrust !== undefined)
      out[who] = { sourceTrust, tie: tie ? { trust: tie.trust, familiarity: tie.familiarity } : undefined };
  }
  return out;
}
/** Wary: trust in the nephew's word fell, or the tie itself turned distrustful. No tie is not wariness. */
function isWary({ sourceTrust, tie }: { sourceTrust: number; tie: Tie | undefined }): boolean {
  return sourceTrust < 0.7 || (tie !== undefined && tie.trust < 0.45);
}
function ferdaBelievesOrder(s: GameState): boolean {
  const view = need(
    inspect(hf(s).run, { perspective: { kind: 'host' }, people: ['ferda'], select: ['beliefs'] }),
  );
  const person = view.people[0];
  const part = person?.kind === 'host' ? person.parts.find((p) => p.select === 'beliefs') : undefined;
  return part?.select === 'beliefs' && part.value.some((b) => b.prop === ORDER_PROP && b.credence > 0.5);
}

function flag(s: GameState, key: string): boolean {
  if (key === 'halil_left') return s.halilLeft;
  if (key === 'can_leave') return !!s.proposal?.consents.includes('halil') && !s.halilLeft;
  if (key === 'waiting')
    return (
      !!s.proposal &&
      s.proposal.consents.length === 3 &&
      !s.proposal.consents.includes('riza') &&
      s.remaining <= 19 &&
      s.remaining > 10
    );
  if (key === 'away') return away(s);
  if (key === 'letter') return s.letter;
  if (key === 'caught') return s.caught;
  if (key === 'told_halil') return s.told.halil !== undefined;
  if (key === 'told_riza') return s.told.riza !== undefined;
  return s.asked.includes(key as Who);
}

/** Fresh Ink VM every projection; functions are pure even in Ink lookahead. */
function ink(s: GameState) {
  const story = new Story(content);
  story.BindExternalFunction('remaining', () => s.remaining, true);
  story.BindExternalFunction('preview', (key: string) => agreementPreview(s, key), true);
  story.BindExternalFunction('flag', (key: string) => flag(s, key), true);
  story.BindExternalFunction(
    'refused_note',
    () => {
      const who = refusedNext(s);
      return who ? ` ${NAMES[who]} has refused this agreement.` : '';
    },
    true,
  );
  story.ChoosePathString(s.page);
  const prose: string[] = [];
  while (story.canContinue) {
    const line = story.Continue()?.trim();
    if (line) prose.push(line);
  }
  return { story, prose };
}

/** "Halil", "Halil and Rıza", "Halil, Rıza and Osman". */
function names(list: string[]): string {
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

function relationshipEnding(s: GameState): string[] {
  const doubtful: string[] = [];
  const warm: string[] = [];
  const all = readings(s, ORDER);
  for (const who of ORDER) {
    const found = all[who];
    if (!found) continue;
    if (isWary(found)) doubtful.push(NAMES[who]);
    else if (found.tie && found.tie.familiarity > 0) warm.push(NAMES[who]);
  }
  return [
    ...(warm.length && s.result === 'win'
      ? [
          `${names(warm)} ${warm.length === 1 ? 'greets' : 'greet'} you and ${warm.length === 1 ? 'asks' : 'ask'} you to sit.`,
        ]
      : []),
    ...(doubtful.length
      ? [
          `${names(doubtful)} ${doubtful.length === 1 ? 'checks' : 'check'} every detail with you. Any future agreement must be in writing.`,
        ]
      : []),
  ];
}

export function view(s: GameState): {
  title: string;
  prose: string[];
  speaker?: string;
  speech?: string;
  choices: { id: string; text: string }[];
  ending?: 'win' | 'loss';
} {
  const { story, prose } = ink(s);
  if (s.result !== 'playing') {
    const terms = s.proposal?.terms ?? '';
    const after =
      s.result === 'win'
        ? [
            `The shop is open. The agreement read: ${terms}`,
            `Ferda paid the agreed rent. ${s.proposal?.kind === 'shared' ? 'Halil kept to his small repairs on the marked bench.' : `Halil completed the ${s.proposal?.kind === 'late' ? 'late' : 'morning'} shifts.`} Rıza kept the agreed storage hours.`,
            `Your contribution was ₺${s.spent}. ${s.spent === 100 ? 'You took the overnight coach home instead of your train.' : 'You kept enough for the train home.'}`,
            ...relationshipEnding(s),
            s.proposal?.kind === 'late' && ferdaBelievesOrder(s)
              ? 'Ferda calls the smaller late service her own choice.'
              : 'Ferda chooses to keep the service small.',
          ]
        : [
            'Osman rented the room to someone else. Ferda did not take the lease.',
            'Halil went back to his own rented workshop. The extra job did not begin. Rıza still brings his cart home each day.',
            'No one signed an agreement they could not keep. You can try the meeting again.',
            ...relationshipEnding(s),
          ];
    return {
      title: s.result === 'win' ? 'They kept their word.' : 'The shop stayed shut.',
      prose: [s.note, ...prose, ...after].filter(Boolean),
      choices: [],
      ending: s.result,
    };
  }
  const titles: Record<Page, string> = {
    opening: 'His Word',
    table: 'At the cutting table',
    hear: 'What they need',
    offer: 'One agreement',
    private: 'Your word',
    signing: 'Read it together',
    ending: 'One month later',
  };
  const deliveryWait =
    !!s.proposal &&
    !s.proposal.consents.includes('riza') &&
    s.remaining > 10 &&
    s.remaining - (s.proposal.consents.includes('halil') ? 0 : 1) - 1 <= 18;
  const refusedBy = refusedNext(s);
  const signingMinutes = s.proposal
    ? Math.max(4 - s.proposal.consents.length, deliveryWait ? s.remaining - 10 + 1 : 0)
    : 0;
  return {
    title: titles[s.page],
    prose: [
      ...(s.page === 'signing' && s.proposal && refusedBy
        ? [
            `${NAMES[refusedBy]} has refused this agreement and will not sign it unless it changes. ${s.remaining} ${s.remaining === 1 ? 'minute remains' : 'minutes remain'}.`,
          ]
        : s.page === 'signing' && s.proposal
          ? [
              `${signingMinutes} ${signingMinutes === 1 ? 'minute' : 'minutes'} needed for the remaining signatures${deliveryWait ? ' including the delivery wait' : ''}. ${s.remaining} ${s.remaining === 1 ? 'minute remains' : 'minutes remain'}.`,
            ]
          : []),
      displayNote(s),
      ...(s.page === 'signing' && s.proposal && !s.note.includes(s.proposal.terms)
        ? [`${s.proposal.terms} Total from your fund: ₺${s.proposal.cost}.`]
        : []),
      ...prose,
      s.halilLeft
        ? 'Halil has left with his signed copy. Rıza cannot compare accounts with him here.'
        : away(s)
          ? 'Rıza is on his delivery round. He returns with 10 minutes left. Halil is here.'
          : s.remaining <= 10
            ? 'Rıza has returned from his delivery round. Halil and Rıza are both at the table.'
            : 'Halil and Rıza are both at the table. Rıza leaves on his delivery round with 18 minutes left and returns with 10.',
    ].filter(Boolean),
    ...(s.speaker ? { speaker: s.speaker, speech: s.speech } : {}),
    choices: story.currentChoices.map((c) => ({ id: `${s.inputs.length}.${c.index}`, text: c.text })),
  };
}

/** Ferda's stated need is a fixed host line, stored unchanged in `note` and `log` so every saved
 * run replays. Once the letter is read the screen says what that line is, and invents no new speech. */
function displayNote(s: GameState): string {
  return s.speaker === NAMES.ferda && s.letter && s.note.startsWith(needs.ferda)
    ? `${s.note} This is her standing need, worded as before the letter. It is not a reply to the letter.`
    : s.note;
}
function away(s: GameState) {
  return s.remaining <= 18 && s.remaining > 10;
}
function record(s: GameState, text: string) {
  s.log.push({ at: 24 - s.remaining, text });
}
/** Host time only. HF follows at the next `advance`, to the time the host has reached. */
function spendTime(s: GameState, minutes: number, finalSignature = false) {
  s.remaining = Math.max(0, s.remaining - minutes);
  if (s.remaining === 0 && minutes > 0 && !finalSignature) {
    s.result = 'loss';
    s.page = 'ending';
    s.note = 'The appointment time came before the last signature. Osman left.';
    record(s, s.note);
  }
}
const needs: Record<Who, string> = {
  halil:
    '“I need paid work on a clear floor. I can work late if the order includes a paid break. Put that in the agreement.”',
  riza: '“I need storage until four. I can take the cart home then. For morning work I can lend my yard instead of renting outside space.”',
  osman:
    '“I need the first month funded. I can offer a one-month trial instead of a full lease, if Ferda chooses it.”',
  ferda:
    '“I cannot run the whole shop. I would choose a smaller service on a trial lease. The letter may tell us whether late work pays.”',
};
/** What a heard claim sounds like in the speaker's mouth. HF chose the claim from the speaker's
 * current beliefs; the host only words it. */
function phrase(claim: PerceptClaim): string {
  if (claim.prop === PROP)
    return claim.value
      ? 'You told me the floor was reserved for morning repairs.'
      : 'You told me the floor was not reserved for morning repairs.';
  if (claim.prop === ORDER_PROP)
    return claim.value
      ? 'The order pays for late work. I can choose the smaller service.'
      : 'I have not seen an order that pays for late work.';
  if (claim.prop === 'nuri.promised-morning-work') return 'Nuri promised me morning repairs.';
  if (claim.prop === 'nuri.promised-day-storage') return 'Nuri promised me cart storage.';
  if (claim.prop === 'lease.needs-rent') return 'The first month must be paid.';
  return '';
}
function talk(s: GameState, who: Who) {
  // One conversation request; HF selects what the speaker says and issues it for delivery.
  const heard = advance(s, [
    {
      id: inputId(s, `conversation:${who}`),
      at: clock(s),
      source: HOST,
      kind: 'conversation.requested',
      payload: {
        speaker: who,
        listener: 'nephew',
        topicIds: [],
        maxClaims: 4,
        temptations: [],
        loyalWarning: false,
      },
    },
  ]);
  s.speaker = NAMES[who];
  s.speech = heard.map(phrase).filter(Boolean).join(' ');
  s.note = `${needs[who]}${isWary(reading(s, who)) ? ' “This time I will rely on what is written, not your word.”' : ''}`;
  if (!s.asked.includes(who)) s.asked.push(who);
  record(s, `${NAMES[who]}: ${s.speech} ${s.note}`);
}

/** Contradictions HF has recorded against the nephew's account of the floor, by weight. */
function noted(s: GameState): number[] {
  const people = archive(s).current.people;
  return (['halil', 'riza'] as const).map(
    (who) =>
      people[who]?.memory.contradictions.find((c) => c.sourceId === 'nephew' && c.prop === PROP)?.weight ?? 0,
  );
}
/** Halil and Rıza compare accounts while both are at the table. Each reports the account he heard;
 * HF decides whether that contradicts what the listener holds from the nephew. The comparison happens
 * within the signing minute; the men's reaction is recorded at its end. */
function compare(s: GameState): boolean {
  if (away(s) || s.halilLeft || s.caught) return false;
  if (s.told.halil === undefined || s.told.riza === undefined || s.told.halil === s.told.riza) return false;
  const before = noted(s);
  // HF 4.0 closes a time once stepped, so a second batch at clock(s) is refused. The host places the
  // comparison at the middle of the signing minute it has already reached; HF never runs ahead of it.
  const at = clock(s) - MINUTE / 2;
  advance(
    s,
    [contradiction(s, 'halil', s.told.riza, at, 'riza'), contradiction(s, 'riza', s.told.halil, at, 'halil')],
    at,
  );
  const after = noted(s);
  const applied = after.some((weight, i) => weight > (before[i] ?? 0));
  if (applied) {
    s.caught = true;
    advance(s, [
      socialInput(s, 'halil', 'deceit-discovered', 0.8),
      socialInput(s, 'riza', 'deceit-discovered', 0.8),
    ]);
    record(
      s,
      'Halil and Rıza compared your accounts. You had promised the same floor for morning work and for storage. Both know the conflicting accounts came from you.',
    );
  }
  return applied;
}

function agreementDraft(
  s: GameState,
  kind: Proposal['kind'],
  smaller = false,
): { proposal: Proposal; blocked: string | null } {
  const blocked =
    kind === 'late' && !s.letter
      ? 'Ferda needs the clothing order before she can fund late work. Fetch the letter.'
      : kind === 'shared' && (s.told.halil === undefined || s.told.riza === undefined || s.caught)
        ? s.caught
          ? 'After your false private word, neither man will waive his ₺40 guarantee. Choose another agreement.'
          : 'Halil wants a ₺40 guarantee before he will accept a smaller repair space. Speak to both men in private, or choose another agreement.'
        : null;
  const deposit = s.caught ? 40 : 0;
  const cost =
    (kind === 'morning' ? (smaller && s.asked.includes('riza') ? 60 : 100) : kind === 'late' ? 40 : 0) +
    deposit;
  const concessions = [...s.asked];
  const terms =
    kind === 'shared'
      ? `Halil does small repairs on the marked bench. Rıza keeps his cart in the marked bay. Ferda runs the agreed service. Both men waive their ₺40 guarantees. The ${smaller ? 'smaller ' : ''}service covers rent. You pay nothing.`
      : kind === 'morning'
        ? `Halil works mornings on a clear floor. Rıza stores his cart ${smaller && concessions.includes('riza') ? 'in his own yard' : 'in rented outside space'}. You cover the rent gap${smaller && concessions.includes('riza') ? '' : ' and storage'}.`
        : `Halil works from five to nine in the evening on the clothing order${concessions.includes('halil') ? ', with a paid break' : ', without a paid break'}. Rıza ${concessions.includes('riza') ? 'takes his cart home at four' : 'keeps his cart inside overnight'}. You pay ₺40 for the first collection.`;
  const proposal: Proposal = {
    id: s.nextProposal,
    kind,
    cost,
    smaller,
    concessions,
    terms: `${terms} ${smaller ? 'Ferda takes a smaller service on a one-month trial lease.' : 'Ferda takes the full shop on a year lease.'}${deposit ? ' You also pay a ₺40 deposit.' : ''}`,
    consents: [],
  };
  return {
    proposal,
    blocked:
      blocked ??
      (cost > 100
        ? `This costs ₺${cost}, including the deposit. You have ₺100. ${
            kind === 'morning' && smaller && !s.asked.includes('riza')
              ? 'Ask Rıza about his yard to lower the cost.'
              : s.letter
                ? 'The smaller late service costs less.'
                : 'Nuri’s letter may offer cheaper late work.'
          }`
        : null),
  };
}

/** Which questions the printed terms follow. The same option can print different terms after you
 * ask Halil or Rıza; this says why, without saying whether anyone not yet asked would accept. */
function termsSource(s: GameState, kind: string, smaller: boolean): string {
  const part = (who: Who, asked: string, unasked: string) =>
    `${NAMES[who]} ${s.asked.includes(who) ? `asked: ${asked}` : `not asked: ${unasked}`}.`;
  const parts =
    kind === 'late'
      ? [
          part('halil', 'paid break', 'no paid break'),
          part('riza', 'cart home at four', 'cart inside overnight'),
        ]
      : kind === 'morning' && smaller
        ? [part('riza', 'his own yard', 'rented outside space')]
        : [];
  if (!parts.length) return '';
  const open = parts.some((p) => p.includes('not asked'));
  return ` Terms follow your questions. ${parts.join(' ')}${open ? ' Asking can change them.' : ''}`;
}

function agreementPreview(s: GameState, key: string): string {
  const kind = key.startsWith('morning') ? 'morning' : key.startsWith('late') ? 'late' : 'shared';
  const { proposal, blocked } = agreementDraft(s, kind, key.endsWith('_small'));
  const unknown: string[] = [];
  const conditions = ORDER.flatMap((who) => {
    // Questions and earlier refusals are player knowledge; private actor state is not.
    const known =
      s.asked.includes(who) || s.log.some((entry) => entry.text.startsWith(`${NAMES[who]} refuses:`));
    if (!known) {
      unknown.push(NAMES[who]);
      return [];
    }
    const reason = refusal(proposal, who);
    return reason ? [reason] : [];
  });
  if (unknown.length) conditions.push(`${names(unknown)}: acceptance unknown; ask before writing.`);
  const terms =
    s.caught && kind === 'shared'
      ? proposal.terms.replace('You pay nothing.', 'The proposed fee waivers would cost nothing.')
      : proposal.terms;
  return ` ${terms}${termsSource(s, kind, key.endsWith('_small'))} Total from your fund: ₺${proposal.cost}. Writing takes 2 minutes, even if someone then refuses. ${[blocked, ...conditions].filter(Boolean).join(' ')}`;
}

function propose(s: GameState, kind: Proposal['kind'], smaller = false) {
  s.proposal = null;
  const { proposal, blocked } = agreementDraft(s, kind, smaller);
  if (blocked) {
    s.note = blocked;
    if (proposal.cost <= 100) record(s, s.note);
    return;
  }
  s.proposal = proposal;
  s.nextProposal++;
  s.page = 'signing';
  s.note = `${s.proposal.terms} Total from your fund: ₺${s.proposal.cost}.`;
  record(s, `Agreement ${s.proposal.id}: ${s.proposal.terms}`);
}
/** Asked again, a person answers as a person: shorter, then harder, then not at all.
 * The first refusal keeps its full instruction. Later lines are chosen by seed, so a
 * replay repeats them exactly. */
const repeatedRefusals: Record<Who, [string[], string[], string[]]> = {
  halil: [
    [
      'Halil does not pick up the pen. “I told you. Late work needs a paid break.”',
      'Halil taps the line about late hours. “No paid break, no signature.”',
    ],
    [
      'Halil folds the page and pushes it back. “Ask me about a change, or stop asking me to sign.”',
      'Halil looks at Osman, not at you. “He keeps handing me the same page.”',
    ],
    ['Halil does not look up. He has already answered you.', 'Halil leaves the pen where it lies.'],
  ],
  riza: [
    [
      'Rıza taps the empty space. “Write down the cart at four. Then I sign.”',
      'Rıza laughs, without warmth. “Four o’clock, on paper. That is all I asked.”',
    ],
    [
      'Rıza stands up. “I will not sign a page that leaves my cart out. Ask me. Do not push me.”',
      'Rıza turns to Osman. “Does he think I will forget by the third time?”',
    ],
    ['Rıza looks out at his cart. He does not answer.', 'Rıza shakes his head before you finish.'],
  ],
  osman: [
    [
      'Osman does not touch the pen. “No trial lease without my agreement. Ask me about rent.”',
      'Osman checks his watch. “The trial lease is not agreed. Ask me first.”',
    ],
    [
      'Osman closes his diary. “I have another tenant waiting. Ask me about rent, or let me go.”',
      'Osman stands, then sits again. “Ask me. Do not wave the page at me.”',
    ],
    ['Osman checks his watch and says nothing.', 'Osman puts on his coat, but stays at the door.'],
  ],
  ferda: [
    [
      'Ferda reads it again and puts it down. “Full rent for a full service. I cannot.”',
      'Ferda shakes her head. “A smaller service and a trial lease. I said so.”',
    ],
    [
      'Ferda pushes the page back. “Change it, or I will not take the lease at all.”',
      'Ferda looks at Osman. “Is there a smaller agreement, or not?”',
    ],
    [
      'Ferda has stopped reading. She is waiting for a different agreement.',
      'Ferda folds her hands on the table.',
    ],
  ],
};
function repeatedRefusal(s: GameState, p: Proposal, who: Who, times: number): string {
  const [second, third, later] = repeatedRefusals[who];
  const stage = times === 2 ? second : times === 3 ? third : later;
  const pick =
    Math.imul(s.seed ^ Math.imul(p.id, 0x9e3779b1) ^ Math.imul(times, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  return stage[pick % stage.length] ?? stage[0] ?? '';
}
/** The next signer when they have already refused this agreement. */
function refusedNext(s: GameState): Who | undefined {
  const p = s.proposal;
  const next = p && ORDER.find((id) => !p.consents.includes(id) && (id !== 'riza' || !away(s)));
  return next && p.refusals?.[next] ? next : undefined;
}
function refusal(p: Proposal, who: Who): string | null {
  if (who === 'halil' && p.kind === 'late' && !p.concessions.includes('halil'))
    return 'Halil refuses: late work needs a paid break. Ask him about a change.';
  if (who === 'riza' && p.kind === 'late' && !p.concessions.includes('riza'))
    return 'Rıza refuses: he can take the cart home at four, but that must be written down. Ask him.';
  if (who === 'osman' && p.smaller && !p.concessions.includes('osman'))
    return 'Osman refuses: a trial lease needs his agreement. Ask him about rent, then write a new agreement with the trial lease.';
  if (who === 'ferda' && !p.smaller)
    return 'Ferda refuses: she needs a smaller service and a trial lease. Choose a smaller service when you change the agreement. Ask Osman about rent before writing the trial lease.';
  return null;
}

/** One percept with its source in `provenance` (and, for speech, its speaker). Salience follows
 * HF's own heard-claim rule, so attention treats it like any other claim. */
function letterPercept(
  id: string,
  at: number,
  channel: 'saw' | 'told',
  summary: string,
  claim: PerceptClaim,
  source: string,
  target?: Who,
): PerceptData {
  return {
    id: `${id}:percept`,
    occurredAt: at,
    channel,
    kind: channel === 'saw' ? 'letter' : 'claim',
    ...(channel === 'told' ? { actorId: source } : {}),
    ...(target ? { targetId: target } : {}),
    salience: Math.round((0.3 + 0.4 * claim.confidence) * 1e9) / 1e9,
    summary,
    claims: [claim],
    norms: [],
    advice: [],
    consequences: [],
    withdrawConsequences: [],
    witnesses: [],
    reports: [],
    provenance: [source],
  };
}

export function act(s: GameState, input: Input): void {
  command(s, input);
  // HF follows the host clock once per decision, including minutes with nothing to tell anyone.
  advance(s);
}
function command(s: GameState, input: Input): void {
  if (input && s.inputs.some((prior) => prior.choice === input.choice)) return;
  if (s.result !== 'playing') throw new Error('This meeting has ended. Start a new game.');
  if (!input || typeof input.choice !== 'string') throw new Error('Choose an available action.');
  const { story } = ink(s);
  const choice = story.currentChoices.find((c) => `${s.inputs.length}.${c.index}` === input.choice);
  if (!choice) throw new Error('Choose an available action.');
  story.ChooseChoiceIndex(choice.index);
  let command = '';
  while (story.canContinue) {
    const line = story.Continue()?.trim() ?? '';
    if (line.startsWith('@')) command = line.slice(1);
  }
  if (!command) throw new Error('The chosen action has no command.');
  s.inputs.push({ choice: input.choice });
  s.note = '';
  s.speaker = '';
  s.speech = '';
  s.page = 'table';
  if (command === 'start') {
    record(
      s,
      'You opened the notebook. Nuri made conflicting promises about work and storage. The letter is at the depot.',
    );
    return;
  }
  if (command === 'hear' || command === 'private' || command === 'offer') {
    if (command === 'offer') {
      if (s.halilLeft) {
        spendTime(s, 2);
        if (s.result !== 'playing') return;
        s.halilLeft = false;
        s.note = 'You call Halil back from the street. He must read and sign a changed agreement again.';
      }
      s.proposal = null;
    }
    s.page = command;
    return;
  }
  if (command === 'back') return;
  if (command === 'leave') {
    s.result = 'loss';
    s.page = 'ending';
    s.note = 'You ended the meeting without an agreement.';
    record(s, s.note);
    return;
  }
  if (command.startsWith('ask_')) {
    spendTime(s, 2);
    if (s.result === 'playing') talk(s, command.slice(4) as Who);
    return;
  }
  if (command === 'letter') {
    spendTime(s, 6);
    if (s.result !== 'playing') return;
    s.letter = true;
    s.note =
      'You brought back the letter. The supplier offers paid repairs collected after nine each evening. The order can cover rent for a smaller late service. The first collection costs ₺40. Ask them which changes they can accept.';
    // Ferda reads the supplier's letter herself: a direct observation with its source, through her attention.
    const id = inputId(s, 'letter:ferda');
    advance(s, [
      {
        id,
        at: clock(s),
        source: HOST,
        kind: 'observation.received',
        payload: {
          person: 'ferda',
          evidenceId: id,
          percepts: [
            letterPercept(
              id,
              clock(s),
              'saw',
              'Ferda reads the supplier’s letter. The clothing order pays for late repairs.',
              { prop: ORDER_PROP, value: true, confidence: 0.97, origin: 'supplier-letter' },
              'supplier-letter',
            ),
          ],
        },
      },
    ]);
    record(s, s.note);
    return;
  }
  if (command === 'tell_halil' || command === 'tell_riza') {
    spendTime(s, 2);
    if (s.result !== 'playing') return;
    const who = command === 'tell_halil' ? 'halil' : 'riza';
    const value = who === 'halil';
    s.told[who] = value;
    // Your private word reaches him as speech from you, through his attention; HF decides what he believes.
    const id = inputId(s, `private-word:${who}`);
    advance(s, [
      {
        id,
        at: clock(s),
        source: HOST,
        kind: 'observation.received',
        payload: {
          person: who,
          evidenceId: id,
          percepts: [
            letterPercept(
              id,
              clock(s),
              'told',
              value
                ? 'Nuri’s nephew says the floor is reserved for morning work.'
                : 'Nuri’s nephew says the floor is not reserved for morning work.',
              { prop: PROP, value, confidence: 0.95 },
              'nephew',
              who,
            ),
          ],
        },
      },
    ]);
    s.note = value
      ? 'Halil agrees to waive his ₺40 guarantee because of what you told him. He will read the marked spaces in the agreement before signing.'
      : 'Rıza agrees to waive his ₺40 guarantee because of what you told him. He will read the marked spaces in the agreement before signing.';
    record(
      s,
      `You told ${NAMES[who]}: ${value ? 'The floor is reserved for morning work.' : 'The floor is not reserved for morning work.'} ${s.note}`,
    );
    return;
  }
  if (command === 'disclose') {
    spendTime(s, 2);
    if (s.result !== 'playing') return;
    // The written confession is direct evidence of our own conflicting account, including for a
    // recipient who receives it while out on the delivery round. It names no other reporter.
    const confession: HfInput[] = [];
    for (const who of ['halil', 'riza'] as const) {
      const account = s.told[who];
      if (account === undefined) continue;
      confession.push(
        contradiction(s, who, !account, clock(s)),
        socialInput(s, who, 'deceit-discovered', 0.8),
      );
    }
    advance(s, confession);
    s.caught = true;
    s.proposal = null;
    const told = (['halil', 'riza'] as const).filter((who) => s.told[who] !== undefined);
    s.note = `You write a correction for ${names(told.map((who) => NAMES[who]))}: your private ${
      told.length === 1 ? 'promise was' : 'promises were'
    } false.${told.includes('riza') && away(s) ? ' Rıza receives his on his delivery round.' : ''} Everyone will consider a new agreement with a ₺40 deposit.`;
    record(s, s.note);
    return;
  }
  if (command === 'release_halil') {
    s.halilLeft = true;
    s.page = 'signing';
    s.note =
      'Halil takes a copy of the agreement and leaves for his workshop. His signature stays on this agreement. He and Rıza cannot compare accounts here after he leaves.';
    record(s, s.note);
    return;
  }
  if (command === 'wait') {
    spendTime(s, Math.max(1, s.remaining - 10));
    if (s.result === 'playing') {
      s.page = 'signing';
      s.note = 'Rıza returns from his delivery round. He can read and sign the agreement now.';
      record(s, s.note);
    }
    return;
  }
  if (command === 'sign') {
    const p = s.proposal;
    if (!p) throw new Error('Write an agreement first.');
    const next = ORDER.find((id) => !p.consents.includes(id) && (id !== 'riza' || !away(s)));
    const finalReady = p.consents.length === 3 && !!next && !refusal(p, next);
    spendTime(s, 1, finalReady);
    if (s.result !== 'playing') return;
    const compared = compare(s);
    if (compared) {
      s.proposal = null;
      s.page = 'table';
      s.note = `Halil and Rıza compare what you told them. You promised each man the whole floor. They withdraw their fee waivers. A new agreement needs a ₺40 deposit paid today. Choose a new agreement. ${
        s.asked.includes('riza')
          ? 'A smaller morning service with Rıza’s yard can fit your fund.'
          : 'Ask Rıza about his yard: a smaller morning service there can fit your fund.'
      } ${s.letter ? 'The letter also supports late work.' : 'Nuri’s letter may support late work.'}`;
      if (s.remaining === 0) {
        s.result = 'loss';
        s.page = 'ending';
        s.note = 'The comparison left no complete agreement at the appointment time. Osman left.';
      }
      record(s, s.note);
      return;
    }
    const who = ORDER.find((id) => !p.consents.includes(id) && (id !== 'riza' || !away(s)));
    if (!who) {
      s.page = 'signing';
      s.note = 'Rıza is still delivering. His signature must wait until he returns with 10 minutes left.';
      return;
    }
    const reason = refusal(p, who);
    if (reason) {
      const times = (p.refusals?.[who] ?? 0) + 1;
      p.refusals = { ...p.refusals, [who]: times };
      s.note = times === 1 ? reason : repeatedRefusal(s, p, who, times);
      s.page = 'signing';
      record(s, s.note);
      return;
    }
    p.consents.push(who);
    advance(s, [socialInput(s, who, 'shared-work', 0.7)]);
    const reasons: Record<Who, string> = {
      halil:
        p.kind === 'shared'
          ? 'The marked bench gives him paid repair work.'
          : 'The agreed shift gives him paid work on a clear floor.',
      riza: 'The cart has a place for the hours he needs.',
      osman: 'The first month of the new rent is funded.',
      ferda: 'The work can pay. She chooses to take the new lease.',
    };
    s.note = `${compared ? 'Halil and Rıza compared your conflicting accounts. They now check everything in the agreement. ' : ''}${NAMES[who]} signs agreement ${p.id}. ${reasons[who]}`;
    record(s, s.note);
    if (p.kind === 'shared' && who === 'halil' && !p.consents.includes('riza'))
      s.note += ' He read the marked spaces first. Rıza must still agree to his own fee waiver.';
    s.page = 'signing';
    if (p.consents.length === ORDER.length) {
      s.spent = p.cost;
      s.result = 'win';
      s.page = 'ending';
      s.note = 'All four signed the same agreement before Osman left. You paid your contribution.';
      record(s, s.note);
    }
    return;
  }
  spendTime(s, 2);
  if (s.result !== 'playing') return;
  if (command === 'shared_small') propose(s, 'shared', true);
  else if (command === 'morning_small') propose(s, 'morning', true);
  else if (command === 'late_small') propose(s, 'late', true);
  else if (command === 'morning' || command === 'late' || command === 'shared') propose(s, command);
  else if (command === 'late_unproved') propose(s, 'late');
  else throw new Error('Unknown story command.');
}

/** Stable, non-security checksum of the host state and the HF run's full archive hash. */
export function hashState(state: GameState): string {
  const text = `${JSON.stringify(state)}|${archive(state).hashes.full}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
/** The playtest export and the save: seed, input log, host state and the HF archive (its own spec,
 * input log, state and hashes). */
export function exportRun(s: GameState) {
  return {
    game: 'word' as const,
    edition: EDITION,
    framework: HF,
    seed: s.seed,
    inputs: structuredClone(s.inputs),
    state: structuredClone(s),
    archive: archive(s),
    hash: hashState(s),
  };
}
const EARLIER =
  'This run is from an earlier version of His Word, which used Human Framework 3. It cannot be replayed here. Start a fresh game.';
const OTHER = 'This run is from another version of His Word. It cannot be replayed here. Start a fresh game.';
/** Rebuilds a current-edition export from its seed and input log, then requires the same host state
 * and the identical HF archive (spec, input log, state and hashes). Anything else is refused before
 * any run exists. HF's own `replay` of the archive is checked in the replay test. */
export function replayRun(value: unknown): GameState {
  if (!value || typeof value !== 'object') throw new Error('This is not a His Word run.');
  const x = value as Partial<ReturnType<typeof exportRun>>;
  if (x.game !== 'word') throw new Error('This is not a His Word run.');
  const hfArchive = x.archive as DeepReadonly<RunArchive> | undefined;
  const fromHf3 =
    (typeof x.framework === 'string' && x.framework.startsWith('3.')) ||
    (hfArchive?.format === 'hf-run' && (hfArchive.version as number) === 3);
  if (fromHf3) throw new Error(EARLIER);
  if (x.edition !== EDITION || x.framework !== HF) throw new Error(OTHER);
  if (hfArchive?.format !== 'hf-run' || hfArchive.version !== 7)
    throw new Error('This run has an invalid Human Framework record.');
  if (!Array.isArray(x.inputs) || typeof x.hash !== 'string' || typeof x.seed !== 'number')
    throw new Error('This run has an invalid input log.');
  const s = createGame(x.seed);
  for (const input of x.inputs) act(s, input);
  if (
    JSON.stringify(archive(s)) !== JSON.stringify(hfArchive) ||
    hashState(s) !== x.hash ||
    JSON.stringify(s) !== JSON.stringify(x.state)
  )
    throw new Error('This run does not match its replay.');
  return s;
}
