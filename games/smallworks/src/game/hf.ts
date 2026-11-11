/** Small Works' public HF4 boundary. This module owns receipts and read models, never actor rules. */
import {
  type ActionRequest,
  type ActionResolution,
  createPerson as authorPerson,
  type BeliefReading,
  createRun,
  DEFAULT_NORMS,
  exportRun,
  type HostRequest,
  type Input,
  inspect,
  type Offer,
  type Payloads,
  type PerceptData,
  type PersonAuthoring,
  type PortableAdmission,
  type Result,
  type Run,
  type RunArchive,
  type RunSpec,
  readRunHistory,
  restoreRun,
  step,
} from '@adam0white/human-framework';
import { authoredPerson } from './hf-authoring.ts';

type Actor = RunArchive['current']['people'][string];
type Mutable<T> = T extends object ? { -readonly [P in keyof T]: Mutable<T[P]> } : T;
export type Goal = Actor['agenda']['goals'][number];
export type Suggestion =
  NonNullable<Actor['trace'][number]['suggestion']> extends infer _T
    ? { voiceId: string; affordanceId: string; strength: number; adviceId?: string }
    : never;
export interface Affordance {
  id: string;
  action: string;
  nativeAction?: string;
  label: string;
  duration: number;
  effort: number;
  focus?: number;
  mode?: 'awake' | 'sleep';
  targetId?: string;
  methodContext?: string;
  advertises: Partial<
    Record<
      | 'food'
      | 'water'
      | 'sleep'
      | 'rest'
      | 'relief'
      | 'safety'
      | 'belonging'
      | 'esteem'
      | 'autonomy'
      | 'competence'
      | 'leisure'
      | 'meaning',
      number
    >
  >;
  tags?: string[];
  fulfills?: string[];
  advances?: string[];
  with?: string[];
  alongside?: string[];
}
export type DecisionRecord = Actor['trace'][number] & { narration: string };
export interface Activity {
  id: string;
  affordanceId: string;
  action: string;
  targetId?: string;
  affordance: Affordance;
  startedAt: number;
  endsAt: number;
  reviewAt: number;
  effort: number;
  thresholdAt?: number;
  dozedAt?: number;
}
/** Cache populated only through inspect and the host's own action ledger. All times here are game minutes. */
export interface Person {
  id: string;
  name: string;
  now: number;
  life: { bornAt: number; sex: 'female' | 'male' };
  body: Mutable<Actor['body']>;
  traits: Actor['traits'];
  values: Actor['values'];
  agenda: Actor['agenda'];
  methods: Actor['methods'];
  will: { voices: Actor['will']['voices'] };
  trace: DecisionRecord[];
  activity: Activity | null;
  social: { relationships: Actor['social']['relationships'] };
  skills: Actor['skills'];
  memory: { beliefs: readonly BeliefReading[]; sourceTrust: Actor['memory']['sourceTrust'] };
}
interface HostAction {
  id: string;
  person: string;
  offer: Affordance;
  native: Offer;
  start: number;
  end: number;
}
export interface WorkshopRuntime {
  version: 'workshop-hf4/1';
  archive: RunArchive;
  nextInput: number;
  offers: Record<string, Affordance[]>;
  revisions: Record<string, number>;
  active: Record<string, HostAction>;
  decisions: Record<string, DecisionRecord>;
  pending: HostRequest[];
  queue: Input[];
  receipts: Record<string, ActionResolution>;
  nextAt: number | null;
  interruptions: { person: string; at: number; action: string; offerId: string }[];
}
interface AcceptedCall {
  readonly previous?: AcceptedCall;
  readonly batch: { until: number; inputs: Input[] };
}
interface Context {
  run: Run;
  live?: Run;
  provider?: Context;
  base?: RunArchive;
  calls?: AcceptedCall;
  archive?: RunArchive;
  resolveFinishes?: () => void;
  data: WorkshopRuntime;
  people: Record<string, Person>;
}
/** One mutable public Run owner; other branches retain public call history, not kernel copies. */
function runtimeContext(
  run: Run | undefined,
  data: WorkshopRuntime,
  people: Record<string, Person>,
  checkpoint = {
    base: data.archive,
    calls: undefined as AcceptedCall | undefined,
    archive: data.archive as RunArchive | undefined,
  },
  source?: Context,
): Context {
  const c: Context = {
    live: run,
    provider: source?.live ? source : source?.provider,
    get run() {
      if (!c.live) {
        const provider = c.provider;
        c.provider = undefined;
        if (provider?.live && provider.base === c.base && provider.calls === c.calls) {
          c.live = provider.live;
          provider.live = undefined;
        } else {
          if (!c.base) throw new Error('Missing public workshop checkpoint.');
          c.live = need(restoreRun(c.base));
          const calls: AcceptedCall[] = [];
          for (let call = c.calls; call; call = call.previous) calls.push(call);
          for (const call of calls.reverse()) need(step(c.live, call.batch));
        }
      }
      return c.live;
    },
    set run(value: Run) {
      c.live = value;
    },
    base: checkpoint.base,
    calls: checkpoint.calls,
    archive: checkpoint.archive,
    data,
    people,
  };
  Object.defineProperty(data, 'archive', {
    enumerable: true,
    configurable: true,
    get: () => archiveOf(c),
  });
  return c;
}
const contexts = new WeakMap<Person, Context>();
const rosters = new WeakMap<Record<string, Person>, Context>();
export const MINUTE = 60000;
const need = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code} ${r.error.path}: ${r.error.message}`);
  return r.value;
};
/** A cold immutable public export can be reused until the next accepted transaction. */
function archiveOf(c: Context): RunArchive {
  if (!c.archive) {
    c.archive = exportRun(c.run) as RunArchive;
    c.base = c.archive;
    c.calls = undefined;
  }
  return c.archive;
}
function context(p: Person) {
  const c = contexts.get(p);
  if (!c) throw new Error('Workshop people must be attached to their saved run.');
  return c;
}
const clone = <T>(v: T): Mutable<T> => structuredClone(v) as Mutable<T>;
function times<T>(v: T, scale: number): T {
  const keys = new Set([
    'at',
    'from',
    'until',
    'adoptedAt',
    'lastAdvancedAt',
    'deadline',
    'recurUntil',
    'recurEveryMs',
  ]);
  function visit(x: unknown): unknown {
    if (Array.isArray(x)) return x.map(visit);
    if (x && typeof x === 'object')
      return Object.fromEntries(
        Object.entries(x).map(([k, v]) => [
          k,
          keys.has(k) && typeof v === 'number' ? v * scale : visit(v),
        ]),
      );
    return x;
  }
  return visit(v) as T;
}
function refresh(c: Context): void {
  const view = need(
    inspect(c.run, {
      perspective: { kind: 'host' },
      people: Object.keys(c.people),
      select: [
        'summary',
        'body',
        'traits',
        'relationships',
        'methods',
        'agenda',
        'beliefs',
        'sourceTrust',
        'skills',
      ],
    }),
  );
  for (const item of view.people) {
    if (item.kind !== 'host') throw new Error('Host inspection unavailable.');
    const p = c.people[item.id];
    if (!p) throw new Error('Unexpected workshop actor.');
    for (const part of item.parts) {
      if (part.select === 'summary') {
        p.name = part.value.name;
        if (part.value.activity === null) p.activity = null;
      } else if (part.select === 'body') p.body = clone(part.value.state);
      else if (part.select === 'traits') p.traits = clone(part.value);
      else if (part.select === 'relationships') {
        p.will = { voices: clone(part.value.voices) };
        p.social = { relationships: clone(part.value.ties) };
      } else if (part.select === 'methods') p.methods = times(clone(part.value), 1 / MINUTE);
      else if (part.select === 'agenda') p.agenda = times(clone(part.value), 1 / MINUTE);
      else if (part.select === 'beliefs') p.memory.beliefs = times(clone(part.value), 1 / MINUTE);
      else if (part.select === 'sourceTrust') p.memory.sourceTrust = clone(part.value);
      else if (part.select === 'skills')
        p.skills = Object.fromEntries(
          part.value.map((s) => [
            s.id,
            {
              level: s.competence,
              practicedMs: s.practicedMs,
              lastPracticed: s.lastPracticed / MINUTE,
            },
          ]),
        ) as Actor['skills'];
    }
    p.now = Math.floor(view.at / MINUTE);
    const action = c.data.active[p.id];
    if (action)
      p.activity = {
        id: action.id,
        affordanceId: action.offer.id,
        action: action.offer.action,
        targetId: action.offer.targetId,
        affordance: clone(action.offer),
        effort: action.offer.effort,
        startedAt: Math.floor(action.start / MINUTE),
        endsAt: Math.floor(action.start / MINUTE) + action.offer.duration,
        reviewAt:
          c.data.nextAt === null
            ? action.end / MINUTE
            : Math.min(action.end, c.data.nextAt) / MINUTE,
      };
    if (!action) p.activity = null;
    p.trace = c.data.decisions[p.id] ? [clone(c.data.decisions[p.id]!)] : [];
  }
}
function accept(c: Context, until: number, inputs: Input[]) {
  if (!c.base) archiveOf(c);
  const batch = { until, inputs: JSON.parse(JSON.stringify(inputs)) as Input[] };
  const result = need(step(c.run, batch));
  c.calls = { previous: c.calls, batch };
  c.archive = undefined;
  c.data.pending = result.boundary.type === 'world-required' ? clone(result.boundary.requests) : [];
  c.data.nextAt = result.nextAt;
  for (const event of result.events) {
    if (event.data.kind === 'decision' && event.person) {
      const record = times(clone(event.data.decision), 1 / MINUTE);
      record.at = Math.floor(record.at);
      c.data.decisions[event.person] = {
        ...record,
        narration: event.narration.map((l) => l.text).join(' '),
      };
    }
  }
  refresh(c);
  return result;
}
function ingress(c: Context, minute: number): number {
  return Math.max(
    Math.round(minute * MINUTE),
    Math.round(need(inspect(c.run, { perspective: { kind: 'host' }, people: [], select: [] })).at) +
      1,
  );
}
function input<K extends keyof Payloads>(
  p: Person,
  kind: K,
  payload: Payloads[K],
  minute = p.now,
): Input<K> {
  const c = context(p),
    id = `workshop:${c.data.nextInput++}`;
  return {
    id,
    at: ingress(c, minute),
    source: { type: 'host', id: 'repair' },
    kind,
    payload,
  } as Input<K>;
}
function submit(p: Person, entry: Input) {
  const c = context(p);
  settleAutomatic(c);
  if (c.data.pending.length) {
    c.data.queue.push(entry);
    return;
  }
  entry.at = ingress(c, entry.at / MINUTE);
  return accept(c, entry.at, [entry]);
}
function drain(c: Context): void {
  while (c.data.queue.length && !c.data.pending.length) {
    const entry = c.data.queue.shift()!;
    entry.at = ingress(c, entry.at / MINUTE);
    accept(c, entry.at, [entry]);
  }
}
export function createPeopleRuntime(
  seed: number,
  now: number,
  actions: string[],
): Record<string, Person> {
  const spec: RunSpec = {
    id: `small-works:${seed}`,
    seed,
    start: Math.round(now * MINUTE),
    host: { id: 'repair', edition: 'small-works-hf4', schema: 'workshop-hf4/1' },
    definitions: {
      actions: [...new Set(actions)].map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: 'awake', requires: {} },
        tags: [],
        norms: [],
      })),
      norms: DEFAULT_NORMS,
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        { type: 'host', id: 'repair' },
        { type: 'voice', id: 'player' },
        ...['sam', 'mum', 'nora', 'rafi', 'halil'].map((id) => ({ type: 'person' as const, id })),
      ],
      lexicon: { names: {}, roles: {}, actions: {}, prefer: 'name' },
      calendar: {
        id: 'workshop-calendar',
        epoch: { id: 'workshop-epoch', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: 86400000,
        days: [],
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: { revision: 0, facts: [], hostState: {} },
  };
  const run = need(createRun(spec)),
    people: Record<string, Person> = {};
  const data: WorkshopRuntime = {
    version: 'workshop-hf4/1',
    archive: exportRun(run) as RunArchive,
    nextInput: 1,
    offers: {},
    revisions: {},
    active: {},
    decisions: {},
    pending: [],
    queue: [],
    receipts: {},
    nextAt: null,
    interruptions: [],
  };
  rosters.set(people, runtimeContext(run, data, people));
  return people;
}
export function createPerson(
  people: Record<string, Person>,
  options: {
    id: string;
    name: string;
    age: number;
    sex: 'male' | 'female';
    traits?: Partial<Actor['traits']>;
    values?: Partial<Actor['values']>;
    needs?: Partial<Actor['needs']>;
    now: number;
    body?: Partial<PersonAuthoring['state']['body']>;
    portable?: PortableAdmission;
  },
): Person {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop opening.');
  const author = authoredPerson(
    options.id,
    options.name,
    options.sex,
    Math.round(options.now * MINUTE),
  );
  author.identity.birthAt = Math.round((options.now - options.age * 365 * 1440) * MINUTE);
  author.state.traits = { ...author.state.traits, ...options.traits };
  author.state.values = { ...author.state.values, ...options.values };
  author.state.needs = { ...author.state.needs, ...options.needs };
  author.state.body = {
    ...author.state.body,
    satiety: 0.9,
    hydration: 0.9,
    sleepPressure: 0.12,
    exertion: 0.05,
    ...options.body,
  };
  author.state.voices = [{ voiceId: 'player', trust: 0.85 }];
  if (options.id === 'halil')
    author.state.body.illnesses = [
      {
        id: 'hypertension',
        kind: 'hypertension',
        severity: 0.2,
        trendPerDay: 0,
        contagious: false,
        chronic: true,
        baseline: 0.2,
        aggravatedBy: ['smoke'],
        since: options.now * MINUTE,
      },
    ];
  if (options.portable) author.portable = options.portable;
  need(authorPerson(c.run, author));
  c.archive = undefined;
  c.base = undefined;
  c.calls = undefined;
  const p = {
    id: options.id,
    name: options.name,
    now: options.now,
    life: { bornAt: author.identity.birthAt / MINUTE, sex: options.sex },
    values: clone(author.state.values),
    memory: { beliefs: [], sourceTrust: {} },
    trace: [],
    skills: {},
    activity: null,
  } as unknown as Person;
  people[p.id] = p;
  contexts.set(p, c);
  refresh(c);
  return p;
}
/** Copy host metadata without invoking its cold archive getter. */
function copiedMetadata(c: Context): Omit<WorkshopRuntime, 'archive'> {
  return structuredClone(
    Object.fromEntries(
      Object.keys(c.data)
        .filter((key) => key !== 'archive')
        .map((key) => [key, c.data[key as keyof WorkshopRuntime]]),
    ),
  ) as Omit<WorkshopRuntime, 'archive'>;
}
export function snapshotRuntime(people: Record<string, Person>): WorkshopRuntime {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop runtime.');
  return { ...copiedMetadata(c), archive: archiveOf(c) };
}
/** Fork trusted host metadata; preserve older branches through exact public step calls. */
export function forkWorkshop(
  people: Record<string, Person>,
  sourcePeople: Record<string, Person>,
): WorkshopRuntime {
  const source = rosters.get(sourcePeople);
  if (!source) throw new Error('Missing source workshop run.');
  if (!source.base) archiveOf(source);
  const data = { ...copiedMetadata(source), archive: source.base! };
  const c = runtimeContext(
    undefined,
    data,
    people,
    { base: source.base!, calls: source.calls, archive: source.archive },
    source,
  );
  rosters.set(people, c);
  for (const person of Object.values(people)) contexts.set(person, c);
  return data;
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
export function attachWorkshop(state: {
  people: Record<string, Person>;
  hf: WorkshopRuntime;
}): void {
  const data = state.hf;
  const bad = () => {
    throw new Error(
      'This saved workshop people runtime is incomplete or invalid. Keep the file and start fresh.',
    );
  };
  const record = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const expectedKeys =
    'active,archive,decisions,interruptions,nextAt,nextInput,offers,pending,queue,receipts,revisions,version';
  if (
    !record(data) ||
    Object.keys(data).sort().join(',') !== expectedKeys ||
    data.version !== 'workshop-hf4/1' ||
    !Number.isSafeInteger(data.nextInput) ||
    data.nextInput < 1 ||
    !record(data.archive) ||
    data.archive.engine.package !== '@adam0white/human-framework@4.17.0' ||
    !record(data.active) ||
    !record(data.offers) ||
    !record(data.revisions) ||
    !record(data.decisions) ||
    !record(data.receipts) ||
    !Array.isArray(data.pending) ||
    !Array.isArray(data.queue) ||
    !Array.isArray(data.interruptions) ||
    (data.nextAt !== null && !Number.isSafeInteger(data.nextAt))
  )
    bad();
  const run = need(restoreRun(data.archive));
  if (
    !record(state.people) ||
    Object.keys(state.people).sort().join(',') !==
      Object.keys(data.archive.current.people).sort().join(',') ||
    canonical(data.pending) !== canonical(data.archive.current.pending)
  )
    bad();
  const accepted = readRunHistory(data.archive).flatMap((t) => t.inputs);
  const sequence = accepted
    .filter((i) => /^workshop:\d+$/.test(i.id))
    .map((i) => Number(i.id.slice(9)));
  if (
    sequence.some((n) => n >= data.nextInput) ||
    new Set(data.queue.map((i) => i.id)).size !== data.queue.length ||
    (!data.pending.length && (data.queue.length || Object.keys(data.receipts).length))
  )
    bad();
  const revisions: Record<string, number> = {},
    offers: Record<string, readonly Offer[]> = {};
  for (const entry of accepted)
    if (entry.kind === 'offers.received') {
      revisions[entry.payload.person] = entry.payload.revision;
      offers[entry.payload.person] = clone(entry.payload.offers) as Offer[];
    }
  if (
    canonical(revisions) !== canonical(data.revisions) ||
    Object.keys(offers).sort().join(',') !== Object.keys(data.offers).sort().join(',')
  )
    bad();
  for (const [id, book] of Object.entries(data.offers))
    if (
      !Array.isArray(book) ||
      !state.people[id] ||
      canonical(book.map((a) => nativeOffer(state.people[id]!, a))) !== canonical(offers[id])
    )
      bad();
  for (const [id, actor] of Object.entries(data.archive.current.people)) {
    const active = data.active[id],
      actual = actor.activity;
    const pendingStart = data.pending.some(
      (r) => r.kind === 'action' && r.person === id && r.stage === 'start',
    );
    if (Boolean(active) !== Boolean(actual && !pendingStart)) bad();
    if (
      active &&
      actual &&
      (Object.keys(active).sort().join(',') !== 'end,id,native,offer,person,start' ||
        active.person !== id ||
        active.id !== actual.id ||
        active.start !== actual.startedAt ||
        active.end !== actual.endsAt ||
        canonical(active.native) !== canonical(actual.offer) ||
        canonical(nativeOffer(state.people[id]!, active.offer)) !== canonical(actual.offer))
    )
      bad();
    const original = data.archive.initial.people.find((p) => p.id === id);
    if (!original) bad();
    const portable = original!.portable;
    state.people[id]!.life = {
      bornAt:
        (portable?.person.version === 2
          ? portable.person.retained.bornAt + portable.mapping.offsetMs
          : original!.identity.birthAt) / MINUTE,
      sex: portable?.person.version === 2 ? portable.person.retained.sex : original!.identity.sex,
    };
    state.people[id]!.values = clone(
      portable?.person.state.values ?? original!.state.values,
    ) as Actor['values'];
    const last = actor.trace.at(-1),
      saved = data.decisions[id];
    if (
      Boolean(last) !== Boolean(saved) ||
      (last &&
        saved &&
        canonical({ ...times(last, 1 / MINUTE), at: Math.floor(last.at / MINUTE) }) !==
          canonical((({ narration: _n, ...rest }) => rest)(saved)))
    )
      bad();
  }
  for (const id of Object.keys(data.active)) if (!state.people[id]) bad();
  for (const id of Object.keys(data.receipts))
    if (!data.pending.some((r) => r.id === id && r.kind === 'action')) bad();
  for (const queued of data.queue)
    if (
      !record(queued) ||
      Object.keys(queued).sort().join(',') !== 'at,id,kind,payload,source' ||
      !Number.isSafeInteger(queued.at) ||
      queued.source.type !== 'host' ||
      queued.source.id !== 'repair' ||
      !/^workshop:\d+$/.test(queued.id) ||
      Number(queued.id.slice(9)) >= data.nextInput ||
      accepted.some((i) => i.id === queued.id)
    )
      bad();
  const checkpoint = exportRun(run) as RunArchive;
  const c = runtimeContext(run, data, state.people, {
    base: checkpoint,
    calls: undefined,
    archive: checkpoint,
  });
  for (const p of Object.values(state.people)) contexts.set(p, c);
  rosters.set(state.people, c);
  refresh(c);
}

export function tickPeopleRuntime(people: Record<string, Person>, now: number): void {
  const first = Object.values(people)[0];
  const c = rosters.get(people) ?? (first ? context(first) : undefined);
  if (!c) throw new Error('Missing workshop runtime.');
  const target = Math.round(now * MINUTE);
  for (let guard = 0; guard < 256; guard++) {
    settleAutomatic(c);
    drain(c);
    if (c.data.pending.length) return;
    const at = need(inspect(c.run, { perspective: { kind: 'host' }, people: [], select: [] })).at;
    if (target <= at) return;
    accept(c, target, []);
  }
  throw new Error('The workshop clock did not reach its requested boundary.');
}

export function receiveMethodCues(
  p: Person,
  data: { contextId: string; cues: { cue: string; value: string }[] },
): boolean {
  submit(
    p,
    input(p, 'method.cues', {
      person: p.id,
      evidenceId: `method-cues:${context(p).data.nextInput}`,
      contextId: data.contextId,
      cues: data.cues,
    }),
  );
  return true;
}
export function clearMethodContext(p: Person): void {
  if (p.methods.context)
    submit(p, input(p, 'method.context-left', { person: p.id, contextId: p.methods.context.id }));
}
export function demonstrateMethod(
  p: Person,
  data: {
    id: string;
    demonstrationId: string;
    contextId: string;
    conditions: { cue: string; value: string }[];
    action: string;
    sourceId: string;
    attention: number;
    outcome: 'success' | 'failure';
  },
): boolean {
  submit(
    p,
    input(p, 'method.demonstrated', {
      person: p.id,
      evidenceId: `demo:${data.demonstrationId}`,
      demonstrationId: data.demonstrationId,
      methodId: data.id,
      contextId: data.contextId,
      conditions: data.conditions,
      action: data.action,
      teacher: data.sourceId,
      outcome: data.outcome,
      receivedAttention: data.attention,
    }),
  );
  return p.methods.rules.some((r) => r.action === data.action);
}
/** Read retained method support against a declared hypothetical offer, without changing the live run. */
export function methodEvidence(p: Person, action: string, contextId: string) {
  const c = context(p);
  const query = {
    perspective: { kind: 'host' as const },
    people: [p.id],
    select: ['methods' as const],
    method: { person: p.id, action, contextId },
  };
  const current = need(inspect(c.run, query)).method!;
  if (current.support !== 0 || !p.methods.rules.some((rule) => rule.action === action))
    return current;
  // HF4 method inspection considers offered actions. A remembered procedure may
  // still be relevant when the current workshop lacks its time or parts.
  const archive = archiveOf(c);
  if (archive.current.pending.length) return current;
  const branch = need(restoreRun(archive));
  const at = archive.current.at + 1;
  const revision = (c.data.revisions[p.id] ?? 0) + 1;
  need(
    step(branch, {
      until: at,
      inputs: [
        {
          id: `method-hypothesis:${p.id}:${action}:${revision}`,
          at,
          source: { type: 'host', id: 'repair' },
          kind: 'offers.received',
          payload: {
            person: p.id,
            revision,
            offers: [
              JSON.parse(
                JSON.stringify(
                  nativeOffer(p, {
                    id: `method-hypothesis:${action}`,
                    action,
                    label: action,
                    duration: 0,
                    effort: 0,
                    methodContext: contextId,
                    advertises: {},
                  }),
                ),
              ) as Offer,
            ],
          },
        },
      ],
    }),
  );
  return need(inspect(branch, query)).method!;
}
export function tick(p: Person, now: number): void {
  tickPeopleRuntime(context(p).people, now);
}
function nativeOffer(p: Person, a: Affordance): Offer {
  return {
    id: a.id,
    actionId: a.nativeAction ?? a.action,
    label: a.label,
    person: p.id,
    durationMs: Math.max(1, Math.round(a.duration * MINUTE)),
    target: a.targetId,
    participants: [],
    alongside: a.alongside ?? [],
    demands: { mode: a.mode ?? 'awake', effort: a.effort, focus: a.focus ?? 0, requires: {} },
    tags: a.tags ?? [],
    norms: [],
    expected: { needs: a.advertises ?? {}, followedBy: [], provenance: ['authored:workshop'] },
    methodContext: a.methodContext,
    fulfills: a.fulfills ?? [],
    advances: a.advances ?? [],
    diminishes: [],
  };
}
export function decide(
  p: Person,
  offers: Affordance[],
  options: { now: number; suggestion?: Suggestion },
): DecisionRecord {
  const c = context(p);
  settleAutomatic(c);
  if (c.data.pending.some((r) => r.kind === 'action' && r.stage === 'finish'))
    c.resolveFinishes?.();
  if (c.data.pending.length)
    throw new Error(
      `Settle workshop work before ${p.id} decision at ${options.now}; pending ${JSON.stringify(c.data.pending)}`,
    );
  c.data.offers[p.id] = clone(offers);
  const revision = (c.data.revisions[p.id] ?? 0) + 1;
  c.data.revisions[p.id] = revision;
  const at = ingress(c, options.now),
    inputs: Input[] = [
      input(
        p,
        'offers.received',
        { person: p.id, revision, offers: offers.map((a) => nativeOffer(p, a)) },
        options.now,
      ),
    ];
  if (options.suggestion)
    inputs.push(
      input(
        p,
        'suggestion.received',
        {
          person: p.id,
          received: {
            kind: 'ordinary',
            suggestion: {
              ...options.suggestion,
              adviceId: options.suggestion.adviceId ?? `ask:${c.data.nextInput}`,
            },
          },
        },
        options.now,
      ),
    );
  inputs.push(
    input(
      p,
      'decision.requested',
      {
        person: p.id,
        reason: 'workshop choice',
        treatment: p.activity ? 'reconsider' : 'ordinary',
        offerRevision: revision,
      },
      options.now,
    ),
  );
  for (const entry of inputs) entry.at = at;
  accept(c, at, inputs);
  // A reconsideration can request only the old activity's interruption. HF
  // chooses again after that outcome; a prior intention is not a start receipt.
  if (
    c.data.pending.some((r) => r.kind === 'action' && r.person === p.id && r.stage === 'interrupt')
  ) {
    settleAutomatic(c);
    const reconsidered: Input[] = [];
    if (options.suggestion)
      reconsidered.push(
        input(
          p,
          'suggestion.received',
          {
            person: p.id,
            received: {
              kind: 'ordinary',
              suggestion: { ...options.suggestion, adviceId: `ask:${c.data.nextInput}` },
            },
          },
          options.now,
        ),
      );
    reconsidered.push(
      input(
        p,
        'decision.requested',
        {
          person: p.id,
          reason: 'workshop choice after interruption',
          treatment: 'ordinary',
          offerRevision: revision,
        },
        options.now,
      ),
    );
    const reopenedAt = ingress(c, options.now);
    for (const entry of reconsidered) entry.at = reopenedAt;
    accept(c, reopenedAt, reconsidered);
  }
  const record = c.data.decisions[p.id];
  if (!record) throw new Error('HF supplied no workshop decision.');
  return clone(record);
}
export function pendingOffer(p: Person, id: string): Affordance | undefined {
  return context(p).data.offers[p.id]?.find((a) => a.id === id);
}
export function begin(p: Person, a: Affordance, record: DecisionRecord): Activity | null {
  const c = context(p),
    request = c.data.pending.find(
      (r): r is ActionRequest => r.kind === 'action' && r.person === p.id && r.stage === 'start',
    );
  if (!request || request.offerId !== a.id || record.chosenAffordanceId !== a.id) return null;
  const native = nativeOffer(p, a),
    action: HostAction = {
      id: request.activityId,
      person: p.id,
      offer: clone(a),
      native,
      start: request.boundaryAt,
      end: request.boundaryAt + native.durationMs,
    };
  c.data.active[p.id] = action;
  resolve(c, request, {
    requestId: request.id,
    requestHash: request.requestHash,
    person: p.id,
    activityId: request.activityId,
    stage: 'start',
    worldRevision: request.worldRevision,
    disposition: 'accepted',
    observations: [],
  });
  return p.activity;
}
function resolve(c: Context, r: ActionRequest, resolution: ActionResolution): void {
  const entry: Input<'action.resolved'> = {
    id: `receipt:${r.id}`,
    at: r.boundaryAt,
    source: { type: 'host', id: 'repair' },
    kind: 'action.resolved',
    payload: resolution,
  };
  accept(c, r.boundaryAt, [entry]);
  drain(c);
}

export interface Finished {
  affordanceId: string;
  action: string;
  targetId?: string;
  at: number;
  status: 'completed' | 'failed' | 'interrupted';
  needs?: Affordance['advertises'];
  advances?: string[];
  fulfills?: string[];
  summary?: string;
  preserveNextStart?: boolean;
}
export function finish(
  p: Person,
  outcome: Finished,
): { achieved: Goal[]; status: Finished['status'] } | null {
  const c = context(p),
    active = c.data.active[p.id];
  if (!active || active.offer.id !== outcome.affordanceId) return null;
  let request = c.data.pending.find(
    (r): r is ActionRequest => r.kind === 'action' && r.person === p.id && r.stage !== 'start',
  );
  if (!request) {
    if (outcome.at >= Math.floor(active.start / MINUTE) + active.offer.duration)
      tickPeopleRuntime(c.people, active.end / MINUTE);
    else {
      submit(
        p,
        input(
          p,
          'activity.interrupted',
          { person: p.id, activityId: active.id, reason: outcome.summary ?? 'workshop stopped' },
          outcome.at,
        ),
      );
    }
    request = c.data.pending.find(
      (r): r is ActionRequest => r.kind === 'action' && r.person === p.id && r.stage !== 'start',
    );
  }
  if (!request && !c.data.active[p.id]) return null;
  if (!request)
    throw new Error(
      `HF did not request settlement for ${p.id} ${active.offer.action} ending ${active.end}, requested ${outcome.at * MINUTE}; at ${archiveOf(c).current.at}; pending ${JSON.stringify(c.data.pending)}`,
    );
  const prior = new Set(p.agenda.goals.filter((g) => g.status === 'achieved').map((g) => g.id));
  const needs = outcome.needs ?? {};
  const psychological = Object.fromEntries(
    Object.entries(needs).filter(
      ([k]) => !['food', 'water', 'sleep', 'rest', 'relief'].includes(k),
    ),
  );
  const status = request.stage === 'interrupt' ? 'interrupted' : outcome.status;
  delete c.data.active[p.id];
  resolve(c, request, {
    requestId: request.id,
    requestHash: request.requestHash,
    person: p.id,
    activityId: active.id,
    stage: request.stage,
    worldRevision: request.worldRevision,
    disposition: status,
    outcome: {
      activityId: active.id,
      offerId: active.native.id,
      actionId: active.native.actionId,
      target: active.native.target,
      start: active.start,
      end: request.boundaryAt,
      status,
      evidenceId: `outcome:${request.id}`,
      actual: {
        psychological,
        consumed: { food: needs.food, water: needs.water },
        exposures: [],
        observedProgress: [],
      },
      fulfills: outcome.fulfills ?? [],
      advances: outcome.advances ?? [],
      summary: outcome.summary,
    },
    observations: [],
  });
  if (!outcome.preserveNextStart) settleAutomatic(c);
  return {
    status,
    achieved: p.agenda.goals.filter((g) => g.status === 'achieved' && !prior.has(g.id)),
  };
}
export function promise(
  p: Person,
  data: Omit<Actor['agenda']['commitments'][number], 'id' | 'status'>,
): Actor['agenda']['commitments'][number] {
  const id = `commit:${p.id}:${context(p).data.nextInput}`;
  submit(
    p,
    input(p, 'agenda.requested', {
      person: p.id,
      request: { type: 'commit', commitment: times({ ...data, id }, MINUTE) },
    }),
  );
  return p.agenda.commitments.find((c) => c.id === id)!;
}
export function releaseCommitment(p: Person, id: string, authority = 'player'): boolean {
  submit(
    p,
    input(p, 'agenda.requested', {
      person: p.id,
      request: { type: 'release', commitmentId: id, authority },
    }),
  );
  return p.agenda.commitments.find((c) => c.id === id)?.status === 'released';
}
export function adoptGoal(
  p: Person,
  data: {
    label: string;
    serves: Goal['serves'];
    importance: number;
    advancedBy: Goal['advancedBy'];
  },
  now: number,
): Goal {
  const id = `goal:${p.id}:${context(p).data.nextInput}`;
  submit(
    p,
    input(
      p,
      'agenda.requested',
      {
        person: p.id,
        request: {
          type: 'goal',
          goal: {
            ...data,
            id,
            progress: 0,
            baseImportance: data.importance,
            completionHalfLifeMs: 86400000,
          },
        },
      },
      now,
    ),
  );
  return p.agenda.goals.find((g) => g.id === id)!;
}
export function abandonGoal(p: Person, id: string): boolean {
  submit(
    p,
    input(p, 'agenda.requested', { person: p.id, request: { type: 'abandon-goal', goalId: id } }),
  );
  return p.agenda.goals.find((g) => g.id === id)?.status === 'abandoned';
}
export function noteVoicePromise(
  p: Person,
  voiceId: string,
  data: { kept: boolean; at: number; action?: string },
): void {
  submit(
    p,
    input(
      p,
      'voice.promise-received',
      {
        person: p.id,
        evidenceId: `word:${context(p).data.nextInput}`,
        voiceId,
        promise: { kept: data.kept, action: data.action },
      },
      data.at,
    ),
  );
}
export function perceive(
  p: Person,
  percepts: {
    at: number;
    channel: PerceptData['channel'];
    kind: string;
    summary: string;
    salience: number;
    valence?: number;
    actorId?: string;
    targetId?: string;
  }[],
): PerceptData[] {
  const sequence = context(p).data.nextInput;
  const evidenceId = `observation:${sequence}`;
  const prepared: PerceptData[] = percepts.map((v, i) => {
    const { at, ...rest } = v;
    return {
      ...rest,
      id: `percept:${sequence}:${i}`,
      occurredAt: Math.round(at * MINUTE),
      claims: [],
      norms: [],
      advice: [],
      consequences: [],
      withdrawConsequences: [],
      witnesses: [],
      reports: [],
      provenance: [],
    };
  });
  const result = submit(
    p,
    input(p, 'observation.received', {
      person: p.id,
      evidenceId,
      percepts: prepared,
    }),
  );
  const attended = new Set(
    result?.events.flatMap((event) =>
      event.person === p.id &&
      event.data.kind === 'observation-attended' &&
      event.data.evidenceId === evidenceId &&
      event.data.attention > 0
        ? [event.data.perceptId]
        : [],
    ),
  );
  return prepared.filter((percept) => attended.has(percept.id));
}
export function socialEvent(
  p: Person,
  event: {
    at: number;
    otherId: string;
    kind: Payloads['social.received']['event']['kind'];
    byMe: boolean;
    magnitude: number;
  },
): void {
  const { at, otherId, ...rest } = event;
  submit(
    p,
    input(
      p,
      'social.received',
      {
        person: p.id,
        evidenceId: `social:${context(p).data.nextInput}`,
        other: otherId,
        event: rest,
      },
      at,
    ),
  );
}
export function reviewed(p: Person): void {
  submit(
    p,
    input(p, 'review.requested', { person: p.id, reason: 'workshop attended-work review' }),
  );
}
export function readPerson(p: Person) {
  return {
    body: need(
      inspect(context(p).run, { perspective: { kind: 'host' }, people: [p.id], select: ['body'] }),
    ).people[0],
  };
}

export function exportPersonRun(p: Person): RunArchive {
  return structuredClone(exportRun(context(p).run)) as RunArchive;
}
export function projectPerson(p: Person, castId: string, castRevision: string) {
  const c = context(p);
  if (
    c.data.pending.some((r) =>
      r.kind === 'action' ? r.person === p.id : r.speaker === p.id || r.recipients.includes(p.id),
    )
  )
    throw new Error('Finish pending work before saving this person for another chapter.');
  const view = need(
    inspect(c.run, {
      perspective: { kind: 'host' },
      people: [p.id],
      select: ['persona', 'calendar'],
      portable: { person: p.id, castId, castRevision },
    }),
  );
  const person = view.people[0];
  if (person?.kind !== 'host') throw new Error('Person projection unavailable.');
  const part = person.parts.find((p) => p.select === 'persona');
  if (part?.select !== 'persona') throw new Error('Person projection unavailable.');
  return clone(part.value);
}
/** Reconstruct only the pre-play opening. Admission never edits a running actor archive. */
export function admitOpeningPerson(p: Person, portable: PortableAdmission): Person {
  const c = context(p),
    archive = archiveOf(c);
  if (
    Object.keys(c.data.active).length ||
    c.data.pending.length ||
    Object.keys(c.data.offers).length
  )
    throw new Error('A continuing person can enter only before workshop play starts.');
  const facts = [...archive.initial.spec.world.facts];
  const spec = {
    ...archive.initial.spec,
    definitions: structuredClone(archive.initial.spec.definitions),
    world: { ...archive.initial.spec.world, facts },
  } as unknown as RunSpec;
  const passport = portable.person;
  if (passport.version !== 2)
    throw new Error(
      'This workshop needs a retained HF4 person. Keep the old file and start fresh.',
    );
  const entities = new Set<string>();
  for (const episode of [...passport.retained.memory.episodes, ...passport.retained.memory.gists])
    for (const id of [episode.actorId, episode.targetId, episode.placeId]) if (id) entities.add(id);
  for (const expectation of passport.retained.memory.expectations) {
    const split = expectation.key.lastIndexOf('@');
    if (split >= 0) entities.add(expectation.key.slice(split + 1));
  }
  for (const duty of passport.retained.agenda.commitments)
    for (const id of [duty.toId, duty.targetId]) if (id) entities.add(id);
  for (const id of entities)
    if (!spec.world.facts.some((f) => f.subject === id))
      facts.push({
        id: `history-entity:${id}`,
        subject: id,
        predicate: 'source-history-reference',
        value: { source: passport.source.game },
        at: spec.start,
        provenance: { source: 'repair', evidenceId: `retained:${passport.castId}` },
      });
  // Commonstead's literal action vocabulary stays available to retained
  // memories and duties. Historical actions do not create workshop offers.
  if (passport.source.game === 'commonstead' || passport.source.game === 'repair') {
    const historical = [
      'wait',
      'rest',
      'work',
      'move',
      'eat',
      'drink',
      'sleep',
      'pray',
      'talk',
      'spar',
      'try-grip',
      'share-story',
      'inspect',
      'yield',
      'correction',
      'visit',
      'letter',
      'telescope',
      'deliver',
    ];
    spec.definitions.actions = [
      ...spec.definitions.actions,
      ...historical
        .filter(
          (id) =>
            !spec.definitions.actions.some((a) => a.id === id) &&
            portable.mapping.references.some(
              (binding) => binding.kind === 'action' && binding.target === id,
            ),
        )
        .map((id) => ({
          id,
          label: id === 'pray' ? 'Pray' : id,
          demands: { effort: 0, focus: 0, mode: 'awake' as const, requires: {} },
          tags: id === 'rest' ? ['rest'] : id === 'pray' ? ['worship'] : [],
          norms: [],
        })),
    ];
  }
  // Published Commonstead4's player voice is a distinct historical source. Keeping its literal
  // identity does not turn its past statements into this workshop player's statements.
  if (
    ['commonstead', 'repair'].includes(passport.source.game) &&
    portable.mapping.references.some(
      (binding) =>
        binding.kind === 'source' &&
        binding.source === 'commander' &&
        binding.target === 'commander',
    ) &&
    !spec.definitions.sources.some((source) => source.id === 'commander')
  )
    spec.definitions.sources = [...spec.definitions.sources, { id: 'commander', type: 'voice' }];
  const run = need(createRun(spec));
  for (const original of archive.initial.people) {
    const authored = structuredClone(original) as PersonAuthoring;
    if (authored.id === p.id) authored.portable = clone(portable);
    need(authorPerson(run, authored));
  }
  for (const transaction of readRunHistory(archive)) {
    const inputs: Input[] = [];
    for (const original of transaction.inputs) {
      const entry = structuredClone(original) as Input;
      if (
        entry.kind === 'agenda.requested' &&
        entry.payload.person === p.id &&
        entry.payload.request.type === 'commit'
      ) {
        const view = need(
          inspect(run, { perspective: { kind: 'host' }, people: [p.id], select: ['agenda'] }),
        ).people[0];
        const part =
          view?.kind === 'host' ? view.parts.find((part) => part.select === 'agenda') : undefined;
        if (part?.select !== 'agenda') throw new Error('The admitted calendar cannot be read.');
        const proposed = entry.payload.request.commitment;
        if (
          part.value.commitments.some(
            (existing) =>
              existing.label === proposed.label &&
              existing.from === proposed.from &&
              existing.until === proposed.until &&
              existing.targetId === proposed.targetId &&
              canonical(existing.actions) === canonical(proposed.actions),
          )
        )
          continue;
        if (part.value.commitments.some((existing) => existing.id === proposed.id))
          entry.payload.request.commitment = { ...proposed, id: `receiving:${proposed.id}` };
      }
      inputs.push(entry);
    }
    need(step(run, { until: transaction.until, fidelity: transaction.fidelity, inputs }));
  }
  c.run = run;
  c.archive = undefined;
  c.base = undefined;
  c.calls = undefined;
  archiveOf(c);
  p.life = {
    bornAt: (passport.retained.bornAt + portable.mapping.offsetMs) / MINUTE,
    sex: passport.retained.sex,
  };
  p.values = clone(passport.state.values) as unknown as Actor['values'];
  refresh(c);
  return p;
}

export function rejectPendingStart(p: Person): void {
  const c = context(p),
    request = c.data.pending.find(
      (r): r is ActionRequest => r.kind === 'action' && r.person === p.id && r.stage === 'start',
    );
  if (request)
    resolve(c, request, {
      requestId: request.id,
      requestHash: request.requestHash,
      person: p.id,
      activityId: request.activityId,
      stage: 'start',
      worldRevision: request.worldRevision,
      disposition: 'rejected',
      observations: [],
    });
}

/** Old offer revisions describe the previous host world. Refresh them after a boundary. */
function settleAutomatic(c: Context): void {
  for (let guard = 0; guard < 128; guard++) {
    const request = c.data.pending.find(
      (r): r is ActionRequest =>
        r.kind === 'action' &&
        (r.stage === 'interrupt' || (r.stage === 'start' && !c.data.active[r.person])),
    );
    if (!request) return;
    if (request.stage === 'start') {
      resolve(c, request, {
        requestId: request.id,
        requestHash: request.requestHash,
        person: request.person,
        activityId: request.activityId,
        stage: 'start',
        worldRevision: request.worldRevision,
        disposition: 'rejected',
        observations: [],
      });
      continue;
    }
    const active = c.data.active[request.person];
    if (!active) throw new Error('An HF interruption has no matching host activity.');
    c.data.interruptions.push({
      person: request.person,
      at: request.boundaryAt,
      action: active.offer.action,
      offerId: active.offer.id,
    });
    delete c.data.active[request.person];
    resolve(c, request, {
      requestId: request.id,
      requestHash: request.requestHash,
      person: request.person,
      activityId: active.id,
      stage: 'interrupt',
      worldRevision: request.worldRevision,
      disposition: 'interrupted',
      outcome: {
        activityId: active.id,
        offerId: active.native.id,
        actionId: active.native.actionId,
        target: active.native.target,
        start: active.start,
        end: request.boundaryAt,
        status: 'interrupted',
        evidenceId: `interrupted:${request.id}`,
        actual: { exposures: [], observedProgress: [] },
        fulfills: [],
        advances: [],
        summary: 'The person stopped before completing the workshop activity.',
      },
      observations: [],
    });
  }
  throw new Error('HF workshop boundaries did not settle after128 receipts.');
}
/** Actual finished boundaries, in HF order. The host must apply their physical outcomes first. */
export function pendingFinishes(people: Record<string, Person>): string[] {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop run.');
  return c.data.pending
    .filter((r): r is ActionRequest => r.kind === 'action' && r.stage === 'finish')
    .map((r) => r.person);
}
/** Register the host's real physical-outcome resolver for boundaries reached by ingress. */
export function bindWorkshopResolver(people: Record<string, Person>, resolver: () => void): void {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop run.');
  c.resolveFinishes = resolver;
}
export function hasUnsettledWork(people: Record<string, Person>): boolean {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop run.');
  return c.data.pending.some((request) => request.kind === 'action' && request.stage !== 'start');
}
export function takeInterruptions(people: Record<string, Person>) {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop run.');
  const result = c.data.interruptions;
  c.data.interruptions = [];
  return result;
}
export function activityEndMs(p: Person): number {
  return context(p).data.active[p.id]?.end ?? Number.MAX_SAFE_INTEGER;
}
export function workshopMinute(people: Record<string, Person>): number {
  const c = rosters.get(people);
  if (!c) throw new Error('Missing workshop run.');
  return Math.floor(
    need(inspect(c.run, { perspective: { kind: 'host' }, people: [], select: [] })).at / MINUTE,
  );
}
/** Reach the actual completion boundary before applying any physical repair. */
export function prepareActivityFinish(p: Person, minute: number): boolean {
  const c = context(p),
    active = c.data.active[p.id];
  if (!active) return false;
  if (minute < Math.floor(active.start / MINUTE) + active.offer.duration) return false;
  tickPeopleRuntime(c.people, active.end / MINUTE);
  return Boolean(
    c.data.active[p.id] &&
      c.data.pending.some((r) => r.kind === 'action' && r.person === p.id && r.stage === 'finish'),
  );
}
/** Cold host checkpoint used by focused adapter controls. It contains the entire shared Run. */
export function checkpointPeople(p: Person) {
  const c = context(p);
  return { selected: p.id, people: structuredClone(c.people), hf: snapshotRuntime(c.people) };
}
/** The host owns these read models; actor state still changes only through the Run protocol. */
export function workshopRoster(p: Person): Record<string, Person> {
  return context(p).people;
}
/** A real awake arrival at the new opening. The host never writes the body's asleep flag. */
export function arriveForDay(p: Person, minute: number): boolean {
  const fulfills = p.agenda.commitments
    .filter(
      (c) =>
        c.status === 'pending' &&
        c.actions.includes('start-day') &&
        c.from <= minute &&
        c.until >= minute,
    )
    .map((c) => c.id);
  const offer: Affordance = {
    id: 'start-day',
    action: 'start-day',
    label: 'Wake and arrive at the workshop',
    duration: 0,
    effort: 0,
    mode: 'awake',
    advertises: {},
    fulfills,
  };
  const decision = decide(p, [offer], { now: minute });
  if (decision.chosenAffordanceId !== offer.id) {
    rejectPendingStart(p);
    return false;
  }
  if (!begin(p, offer, decision)) return false;
  finish(p, {
    affordanceId: offer.id,
    action: offer.action,
    at: minute,
    status: 'completed',
    needs: {},
    advances: [],
    fulfills,
    summary: 'The person woke and arrived for the workshop day.',
  });
  return !p.body.asleep;
}

/** Current host readings. The UI renders words, never faculty scores. */
export function livePersonWords(p: Person): string[] {
  const view = need(
    inspect(context(p).run, {
      perspective: { kind: 'host' },
      people: [p.id],
      select: ['affect', 'expectations'],
    }),
  ).people[0];
  if (view?.kind !== 'host') return [];
  const words: string[] = [];
  for (const part of view.parts) {
    if (part.select === 'affect') {
      const mood = part.value.mood.valence;
      words.push(
        `${p.name} feels ${mood > 0.2 ? 'in good spirits' : mood < -0.2 ? 'low' : 'fairly settled'}.`,
      );
      for (const feeling of part.value.emotions)
        words.push(
          `${p.name} feels ${feeling.intensity > 0.6 ? 'strong ' : ''}${feeling.id.replaceAll('-', ' ')}${feeling.targetId && context(p).people[feeling.targetId] ? ` toward ${context(p).people[feeling.targetId]!.name}` : ''}.`,
        );
    }
    if (part.select === 'expectations') {
      for (const learned of part.value) {
        const [action] = learned.key.split('@');
        const label = liveActionWords(action ?? '');
        words.push(
          `${p.name} expects ${label} to ${learned.successRate > 0.7 ? 'usually work' : learned.successRate < 0.3 ? 'often go wrong' : 'have an uncertain result'}.`,
        );
      }
      if (!part.value.length) words.push(`${p.name} has no learned expectations to report yet.`);
    }
  }
  return words;
}

function liveActionWords(action: string): string {
  const verb = action.split(':')[0] ?? '';
  const words: Record<string, string> = {
    sleep: 'sleeping',
    rest: 'resting',
    eat: 'eating',
    drink: 'drinking',
    inspect: 'examining an object',
    measure: 'measuring an object',
    probe: 'testing a circuit',
    clean: 'cleaning a part',
    replace: 'replacing a part',
    adjust: 'adjusting a part',
    calibrate: 'setting the speed control',
    verify: 'checking an object in use',
    deliver: 'returning an object',
    observe: 'watching the work',
    pray: 'praying',
    personal: 'taking personal time',
    leisure: 'taking leisure time',
  };
  return words[verb] ?? 'this kind of work';
}
