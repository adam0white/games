/** Child's physical host. HF alone owns people, decisions and elapsed life. */
import {
  type ActionRequest,
  type ActionResolution,
  type ActorActivity,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun,
  forkRun,
  type Input,
  inspect,
  type MethodEvidence,
  type Offer,
  type PersonAuthoring,
  preview,
  type Result,
  type Run,
  type RunArchive,
  type RunSpec,
  replay,
  restoreRun,
  type StepResult,
  step,
} from "@adam0white/human-framework";

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const YEAR = 365.25 * DAY;
export const HOST = { type: "host", id: "child" } as const;
export const ENGINE = "4.17.0" as const;
export const EDITION = 6 as const;
export const cast = [
  "elif",
  "Zehra",
  "Yusuf",
  "Maryam",
  "Danyal",
  "Tariq",
] as const;
export type Traits = PersonAuthoring["state"]["traits"];
export type Cue = { cue: string; value: string };
export function need<T>(result: Result<T>): T {
  if (!result.ok)
    throw Error(
      `${result.error.code} ${result.error.path}: ${result.error.message}`,
    );
  return result.value;
}
export function current(run: Run) {
  const value = need(
    inspect(run, {
      perspective: { kind: "host" },
      people: [],
      select: ["current"],
    }),
  ).current;
  if (!value) throw Error("HF did not return current host control data.");
  return value;
}
export function actor(run: Run, person: string) {
  const value = current(run).people[person];
  if (!value) throw Error(`Missing household member ${person}.`);
  return value;
}
export function isAlive(run: Run, person: string) {
  const view = need(
    inspect(run, {
      perspective: { kind: "host" },
      people: [person],
      select: ["summary"],
    }),
  ).people[0];
  if (view?.kind !== "host") throw Error(`Missing household member ${person}.`);
  const summary = view.parts.find((part) => part.select === "summary");
  if (summary?.select !== "summary")
    throw Error(`Missing life status for ${person}.`);
  return summary.value.alive;
}
export function spec(
  seed: number,
  methods: readonly { id: string; action: string; conditions: Cue[] }[],
): RunSpec {
  return {
    id: "child",
    seed,
    start: 0,
    host: { id: "child", edition: "child-6", schema: "child-6" },
    definitions: {
      actions: [...methods.map((m) => m.action), "try", "sleep", "rest"].map(
        (id) => ({
          id,
          label: id,
          demands: {
            effort: id === "sleep" ? 0.1 : 0.01,
            focus: 0,
            mode: id === "sleep" ? "sleep" : "awake",
            requires: {},
          },
          tags: id === "rest" ? ["rest"] : [],
          norms: [],
        }),
      ),
      methods,
      norms: [],
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      routines: [],
      sources: [
        HOST,
        ...cast.map((id) => ({ type: "person" as const, id })),
        ...["Maryam", "Yusuf", "Danyal", "Zehra"].map((id) => ({
          type: "voice" as const,
          id,
        })),
      ],
      lexicon: {
        names: {
          elif: "Elif",
          Zehra: "Zehra",
          Yusuf: "Yusuf",
          Maryam: "Maryam",
          Danyal: "Danyal",
          Tariq: "Tariq",
        },
        roles: {},
        prefer: "name",
        actions: {},
      },
      // Civil time only. No prayer windows or religious rulings are invented.
      calendar: {
        id: "child-days",
        epoch: {
          id: "child-opening",
          simulationAt: 0,
          dayIndex: 0,
          msOfDay: 0,
        },
        dayMs: DAY,
        // A chapter simulates one visible day. Include its following midnight;
        // the fifteen fictional years are host time skips, not 5,500 native days.
        days: Array.from({ length: 2 }, (_, dayIndex) => ({
          dayIndex,
          start: dayIndex * DAY,
          windows: [],
        })),
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: [
        {
          id: "danyal-faith",
          subject: "Danyal",
          predicate: "authored-faith",
          value: "Christian",
          at: 0,
          provenance: { source: "child", evidenceId: "design:cast" },
        },
      ],
      hostState: null,
    },
  };
}
export function person(
  id: string,
  name: string,
  years: number,
  traits: Traits,
): PersonAuthoring {
  const roles: Record<string, Record<string, string[]>> = {
    elif: {
      Zehra: ["mother"],
      Yusuf: ["father"],
      Tariq: ["half-brother"],
      Maryam: ["teacher"],
      Danyal: ["teacher"],
    },
    Zehra: { elif: ["daughter"], Yusuf: ["husband"], Tariq: ["stepson"] },
    Yusuf: { elif: ["daughter"], Zehra: ["wife"], Tariq: ["son"] },
    Tariq: { elif: ["half-sister"], Yusuf: ["father"], Zehra: ["stepmother"] },
    Maryam: { elif: ["pupil"] },
    Danyal: { elif: ["pupil"] },
  };
  return {
    id,
    identity: {
      name,
      birthAt: -years * YEAR,
      sex:
        id === "elif" || id === "Zehra" || id === "Maryam" ? "female" : "male",
    },
    biography: [],
    origin: {
      kind: "authored",
      basis: { kind: "evidence", id: `child:cast:${id}` },
      traits: {
        kind: "explicit-authoring",
        evidence: { kind: "evidence", id: `child:traits:${id}` },
      },
    },
    state: {
      traits,
      values: {
        benevolence: 0.5,
        universalism: 0.5,
        tradition: 0.5,
        conformity: 0.5,
        security: 0.5,
        achievement: 0.5,
        power: 0.5,
        hedonism: 0.5,
        stimulation: 0.5,
        selfDirection: 0.5,
      },
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
        since: 0,
        doze: {
          context: { posture: "upright", stimulation: 0.5 },
          basis: { kind: "authored", author: "child", at: 0 },
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
      beliefs: [],
      consequences: [],
      sourceTrust: [],
      context: {
        scarcity: { kind: "prior", value: 0, basis: "child:authored-opening" },
        smoking: { kind: "unobserved" },
      },
      relationships: Object.entries(roles[id] ?? {}).map(
        ([otherId, roles]) => ({
          otherId,
          roles,
          affection: 0,
          trust: 0.5,
          respect: 0,
          familiarity: 1,
          ledger: 0,
          lastInteraction: 0,
        }),
      ),
      voices:
        id === "elif"
          ? ["Maryam", "Yusuf", "Danyal", "Zehra"].map((voiceId) => ({
              voiceId,
              trust: 0.85,
            }))
          : [],
      agenda: {
        exemptions: {
          traveling: { kind: "unobserved" },
          illnessSeverity: { kind: "unobserved" },
        },
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
      affect: {
        mood: { valence: 0, arousal: 0.3 },
        regulation: 0.3,
        emotions: [],
      },
      promptings: { reading: "none", responses: [] },
      review: { style: "accounting", atMsOfDay: 21 * 60 * MINUTE },
      bonds: { courtships: [], marriages: [] },
    },
  };
}
export function opening(
  seed: number,
  slice: boolean,
  traits: Record<string, Traits>,
  baseline: Traits,
  methods: Parameters<typeof spec>[1],
  chapterAge = slice ? 6 : 3,
): Run {
  const run = need(createRun(spec(seed, methods)));
  need(createPerson(run, person("elif", "Elif", chapterAge, baseline)));
  for (const [id, years] of [
    ["Zehra", 31],
    ["Yusuf", 34],
    ["Maryam", 68],
    ["Danyal", 52],
    ["Tariq", 16],
  ] as const)
    need(
      createPerson(
        run,
        person(
          id,
          id,
          years + chapterAge - (slice ? 6 : 3),
          traits[id] ?? baseline,
        ),
      ),
    );
  return run;
}
/** New host interactions occur later on the same native clock. Receipts use
 * their requested boundary explicitly; accepted inputs are never rescheduled. */
function ingressAfter(now: number): number {
  const at = now + 1;
  if (!Number.isSafeInteger(at))
    throw Error("Child ingress exceeds exact time.");
  return at;
}
export function nextIngressAt(run: Run): number {
  return ingressAfter(
    need(
      inspect(run, {
        perspective: { kind: "host" },
        people: [],
        select: [],
      }),
    ).at,
  );
}
export function input<K extends Input["kind"]>(
  run: Run,
  id: string,
  kind: K,
  payload: Extract<Input, { kind: K }>["payload"],
  at = nextIngressAt(run),
): Extract<Input, { kind: K }> {
  return { id, at, source: HOST, kind, payload } as Extract<Input, { kind: K }>;
}
export function offer(
  person: string,
  actionId: string,
  durationMs: number,
  methodContext?: string,
): Offer {
  return {
    id: actionId,
    actionId,
    label: actionId,
    person,
    durationMs,
    participants: [],
    alongside: [],
    demands: {
      effort: actionId === "sleep" ? 0.1 : 0.01,
      focus: 0,
      mode: actionId === "sleep" ? "sleep" : "awake",
      requires: {},
    },
    tags: actionId === "rest" ? ["rest"] : [],
    norms: [],
    expected: {
      needs: actionId === "sleep" ? { sleep: 1 } : {},
      followedBy: [],
      provenance: ["child:daily-household"],
    },
    fulfills: [],
    advances: [],
    diminishes: [],
    ...(methodContext ? { methodContext } : {}),
  };
}
/** Settle real public requests at their exact boundaries. Nothing sets actor state. */
const stepMilliseconds = new WeakMap<Run, number>();
export function takeStepMilliseconds(run: Run): number {
  const elapsed = stepMilliseconds.get(run) ?? 0;
  stepMilliseconds.set(run, 0);
  return elapsed;
}
export type NativeEvents = DeepReadonly<StepResult>["events"];
export type EventSink = (events: NativeEvents) => void;

type StepObserver = (
  result: DeepReadonly<StepResult>,
  inputs: readonly Input[],
) => void;
/** A boundary-only drive settles every real request at the first reached
 * boundary, then returns native nextAt to its synchronous caller. */
function serveThrough(
  run: Run,
  until: number,
  inputs: readonly Input[],
  sink: EventSink,
  observe?: StepObserver,
  boundaryOnly = false,
): DeepReadonly<StepResult> {
  const events: DeepReadonly<StepResult>["events"][number][] = [];
  let batch = inputs;
  let target = until;
  for (;;) {
    const started = performance.now();
    const result = need(
      step(run, {
        until: target,
        fidelity: { mode: "daily", dayMs: DAY, anchor: 0 },
        inputs: batch,
      }),
    );
    // Capture timing only; observation precedes all further host work.
    const nativeMilliseconds = performance.now() - started;
    sink(result.events);
    stepMilliseconds.set(
      run,
      (stepMilliseconds.get(run) ?? 0) + nativeMilliseconds,
    );
    observe?.(result, batch);
    events.push(...result.events);
    if (result.boundary.type === "until") return { ...result, events };
    if (boundaryOnly) target = result.at;
    // Read only settlement control data, freshly after each step.
    const state = need(
      inspect(run, {
        perspective: { kind: "host" },
        people: [
          ...new Set(
            result.boundary.requests.flatMap((request) =>
              request.kind === "action" ? [request.person] : [],
            ),
          ),
        ],
        select: ["control", "summary"],
      }),
    );
    if (state.worldRevision === undefined)
      throw Error("HF did not return the current world revision.");
    const worldRevision = state.worldRevision;
    batch = [...result.boundary.requests]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((request) => {
        if (request.kind === "communication")
          return input(
            run,
            `receipt:${request.id}`,
            "communication.resolved",
            {
              requestId: request.id,
              requestHash: request.requestHash,
              worldRevision,
              speaker: request.speaker,
              emittedItemIds: [],
              received: [],
            },
            request.boundaryAt,
          );
        const view = state.people.find(
          (person) => person.id === request.person,
        );
        const part = view?.parts[0];
        if (view?.kind !== "host" || part?.select !== "control")
          throw Error(`Missing host control data for ${request.person}.`);
        const summary = view.parts.find((part) => part.select === "summary");
        if (summary?.select !== "summary")
          throw Error(`Missing life control data for ${request.person}.`);
        const alive = summary.value.alive;
        const active = part.value.activity;
        const held = part.value.offers?.offers.find(
          (o) => o.id === request.offerId,
        );
        const started = request.stage === "start";
        const finishing = request.stage === "finish";
        const completed = finishing && alive;
        const status = completed
          ? "completed"
          : finishing
            ? "failed"
            : "interrupted";
        if (
          !active ||
          active.id !== request.activityId ||
          active.offer.id !== request.offerId
        )
          throw Error(
            `Pending action differs from ${request.person}'s activity.`,
          );
        const chosen = started
          ? alive && part.value.offers?.revision === request.offerRevision
            ? held
            : undefined
          : active.offer;
        return input(
          run,
          `receipt:${request.id}`,
          "action.resolved",
          {
            requestId: request.id,
            requestHash: request.requestHash,
            worldRevision,
            person: request.person,
            activityId: request.activityId,
            stage: request.stage,
            disposition: started ? (chosen ? "accepted" : "rejected") : status,
            observations: [],
            ...(!started && active && chosen
              ? {
                  outcome: {
                    activityId: request.activityId,
                    offerId: request.offerId,
                    actionId: chosen.actionId,
                    start: active.startedAt,
                    end: request.boundaryAt,
                    status,
                    evidenceId: `outcome:${request.id}`,
                    summary: !alive
                      ? "The person died before the household task was completed."
                      : !completed
                        ? "The household task was interrupted."
                        : chosen.actionId === "sleep"
                          ? "Rested at home."
                          : "The household task ended.",
                    actual: { exposures: [], observedProgress: [] },
                    fulfills: [],
                    advances: [],
                  },
                }
              : {}),
          },
          request.boundaryAt,
        );
      });
  }
}
export function serve(
  run: Run,
  until: number,
  inputs: readonly Input[],
  sink: EventSink,
): NativeEvents {
  return serveThrough(run, until, inputs, sink).events;
}
export function evidence(run: Run, action: string, contextId: string) {
  return need(
    inspect(run, {
      perspective: { kind: "host" },
      people: ["elif"],
      select: [],
      method: { person: "elif", action, contextId },
    }),
  ).method;
}
export function heldMethods(run: Run) {
  return actor(run, "elif").methods.rules;
}
/** The same candidate batch is used on a disposable fork and for a real choice. */
function crisisBatch(run: Run, actions: readonly string[], id: string) {
  const state = current(run);
  const at = ingressAfter(state.at);
  const revision = (state.offers.elif?.revision ?? 0) + 1;
  const inputs: Input[] = [
    input(
      run,
      `${id}:0-offers`,
      "offers.received",
      {
        person: "elif",
        revision,
        offers: actions.map((a) => offer("elif", a, MINUTE, "crisis")),
      },
      at,
    ),
    input(
      run,
      `${id}:1-decide`,
      "decision.requested",
      {
        person: "elif",
        reason: "crisis",
        treatment: "ordinary",
        offerRevision: revision,
      },
      at,
    ),
  ];
  return { at, revision, inputs };
}
export type ConditionalMethodEvidence = {
  hypothetical: true;
  label: "HOST-PRIVATE CONDITIONAL METHOD EVIDENCE — HYPOTHETICAL, NOT LIVE HISTORY";
  at: number;
  evidence: readonly {
    action: string;
    evidence: DeepReadonly<MethodEvidence>;
  }[];
};
const conditionalMilliseconds = new WeakMap<Run, number>();
export function takeConditionalMilliseconds(run: Run): number {
  const elapsed = conditionalMilliseconds.get(run) ?? 0;
  conditionalMilliseconds.set(run, 0);
  return elapsed;
}
/** A hypothetical choice may already have happened at this endpoint. Never
 * adopt the fork or report its evidence as live, pre-choice evidence. */
export function conditionalMethodEvidence(
  run: Run,
  actions: readonly string[],
  id: string,
): ConditionalMethodEvidence {
  const started = performance.now();
  try {
    const before = current(run);
    const branch = forkRun(run);
    const batch = crisisBatch(branch, actions, id);
    // Exactly one native step: no receipts, settlement loop or live event sink.
    const result = need(
      step(branch, {
        until: batch.at,
        fidelity: { mode: "daily", dayMs: DAY, anchor: 0 },
        inputs: batch.inputs,
      }),
    );
    const endpoint = current(branch);
    const book = endpoint.offers.elif;
    const expectedOffers = actions.map((a) =>
      offer("elif", a, MINUTE, "crisis"),
    );
    const fail = (reason: string): never => {
      throw Error(`Conditional method endpoint refused: ${reason}`);
    };
    if (
      result.at !== batch.at ||
      endpoint.at !== batch.at ||
      !book ||
      book.revision !== batch.revision ||
      book.receivedAt !== batch.at ||
      book.cause !== `${id}:0-offers` ||
      book.rejected.length !== 0 ||
      !sameJson(book.offers, expectedOffers)
    )
      fail("current candidate offers were not admitted exactly");
    if (
      JSON.stringify(Object.keys(endpoint.people).sort()) !==
        JSON.stringify(Object.keys(before.people).sort()) ||
      cast.some((person) => !endpoint.people[person])
    )
      fail("full household identity changed");
    for (const person of cast) {
      const prior = before.people[person];
      const after = endpoint.people[person];
      if (
        !prior ||
        !after ||
        JSON.stringify(prior.memory.sourceTrust) !==
          JSON.stringify(after.memory.sourceTrust) ||
        JSON.stringify(prior.will.voices) !== JSON.stringify(after.will.voices)
      )
        fail(`hypothetical endpoint changed trust or voices for ${person}`);
    }
    return {
      hypothetical: true,
      label:
        "HOST-PRIVATE CONDITIONAL METHOD EVIDENCE — HYPOTHETICAL, NOT LIVE HISTORY",
      at: result.at,
      evidence: actions.map((action) => {
        const method = evidence(branch, action, "crisis");
        if (!method) return fail(`missing method evidence for ${action}`);
        return { action, evidence: structuredClone(method) };
      }),
    };
  } finally {
    conditionalMilliseconds.set(
      run,
      (conditionalMilliseconds.get(run) ?? 0) + performance.now() - started,
    );
  }
}
type SettledAction = Extract<
  NativeEvents[number]["data"],
  { kind: "action-settled" }
>;
type CrisisAttempt = {
  activity: DeepReadonly<ActorActivity>;
  start: DeepReadonly<ActionRequest>;
  accepted: SettledAction;
};
type CrisisTerminal = {
  request: DeepReadonly<ActionRequest>;
  resolution: DeepReadonly<ActionResolution>;
  settled: SettledAction;
};
export type CrisisResult =
  | { status: "no-choice" | "dead" }
  | (CrisisAttempt & {
      status: "completed" | "interrupted";
      action: string;
      terminal: CrisisTerminal;
    });

/** One synchronous authored attempt. All choices and boundaries remain native. */
export function decide(
  run: Run,
  actions: readonly string[],
  id: string,
  sink: EventSink,
): CrisisResult {
  const batch = crisisBatch(run, actions, id);
  const oldActivity = actor(run, "elif").activity?.id;
  const requests = new Map<string, DeepReadonly<ActionRequest>>(
    current(run).pending.flatMap((request) =>
      request.kind === "action" ? [[request.id, request] as const] : [],
    ),
  );
  const progress: {
    attempt?: CrisisAttempt;
    terminal?: CrisisTerminal;
    awaitingFreshChoice: boolean;
  } = { awaitingFreshChoice: false };
  const observe: StepObserver = (result, inputs) => {
    if (result.boundary.type === "world-required")
      for (const request of result.boundary.requests)
        if (request.kind === "action") requests.set(request.id, request);
    for (const event of result.events) {
      if (event.person !== "elif") continue;
      if (event.data.kind === "decision") {
        progress.awaitingFreshChoice = false;
      } else if (event.data.kind === "action-requested") {
        requests.set(event.data.request.id, event.data.request);
      } else if (event.data.kind === "action-settled") {
        const settled = event.data;
        const request = requests.get(settled.requestId);
        const receipt = inputs.find(
          (entry) =>
            entry.kind === "action.resolved" &&
            entry.payload.requestId === settled.requestId,
        );
        if (!request || !receipt || receipt.kind !== "action.resolved")
          throw Error(
            "Crisis settlement lacks its actual request and receipt.",
          );
        if (
          request.stage === "start" &&
          settled.disposition === "accepted" &&
          request.offerRevision === batch.revision
        ) {
          const activity = actor(run, "elif").activity;
          if (
            !activity ||
            activity.id !== request.activityId ||
            activity.offer.methodContext !== "crisis" ||
            !actions.includes(activity.offer.actionId)
          )
            throw Error(
              "Accepted crisis start differs from its frozen activity.",
            );
          progress.attempt = { activity, start: request, accepted: settled };
        } else if (
          progress.attempt?.activity.id === request.activityId &&
          request.stage !== "start"
        ) {
          progress.terminal = { request, resolution: receipt.payload, settled };
        } else if (
          (request.activityId === oldActivity && request.stage !== "start") ||
          (request.stage === "start" && settled.disposition === "rejected")
        ) {
          // Settlement schedules a fresh ordinary choice. Use its public nextAt,
          // not the choice that only interrupted the previous activity.
          progress.awaitingFreshChoice = true;
        }
      }
    }
  };
  let result = serveThrough(run, batch.at, batch.inputs, sink, observe);
  let withdrawn = false;
  const withdraw = () => {
    if (withdrawn) return;
    withdrawn = true;
    const book = current(run).offers.elif;
    // Never erase a later, independently valid rest/work book.
    if (book?.revision !== batch.revision || book.cause !== `${id}:0-offers`)
      return;
    result = serveThrough(
      run,
      nextIngressAt(run),
      [
        input(run, `${id}:close-offers`, "offers.received", {
          person: "elif",
          revision: book.revision + 1,
          offers: [],
        }),
      ],
      sink,
      observe,
    );
  };
  for (;;) {
    if (progress.attempt) {
      // Commitment closes alternatives, not the accepted frozen activity.
      withdraw();
      if (!isAlive(run, "elif")) return { status: "dead" };
      if (progress.terminal) {
        const terminal = progress.terminal;
        const status =
          terminal.request.stage === "finish" &&
          terminal.resolution.disposition === "completed" &&
          terminal.settled.disposition === "completed"
            ? "completed"
            : "interrupted";
        return {
          ...progress.attempt,
          status,
          action: progress.attempt.activity.offer.actionId,
          terminal,
        };
      }
      const active = actor(run, "elif").activity;
      if (!active || active.id !== progress.attempt.activity.id)
        throw Error(
          "Crisis activity disappeared without a terminal settlement.",
        );
      result = serveThrough(run, active.endsAt, [], sink, observe, true);
    } else if (!isAlive(run, "elif")) {
      withdraw();
      return { status: "dead" };
    } else if (progress.awaitingFreshChoice) {
      const at = current(run).at;
      if (result.nextAt === null || result.nextAt <= at)
        throw Error("Native crisis continuation lacks a later boundary.");
      result = serveThrough(run, result.nextAt, [], sink, observe, true);
    } else {
      // Null choice or continued old work is not a physical crisis attempt.
      withdraw();
      return { status: "no-choice" };
    }
  }
}
/** Future daily inputs remain in HF's accepted queue; do not resubmit on boundaries. */
export function householdInputs(run: Run, until: number): Input[] {
  const state = current(run);
  const inputs: Input[] = [];
  // Each month's batch is authored once, then serve settles it without
  // resubmission. Start after the reached book, including any crisis closure.
  const revisions = new Map(
    cast.map((id) => [id, state.offers[id]?.revision ?? 0]),
  );
  for (let day = Math.floor(state.at / DAY); day * DAY < until; day++) {
    for (const id of cast.filter((id) => state.people[id]?.body.alive)) {
      for (const hour of [1, 7, 13, 19]) {
        const at = day * DAY + hour * 60 * MINUTE;
        if (at <= state.at || at > until) continue;
        const receiptId = `care:${day}:${hour}:${id}`;
        inputs.push(
          input(
            run,
            receiptId,
            "body.received",
            {
              person: id,
              evidenceId: receiptId,
              receipt: {
                type: "consumed",
                actionReceipt: receiptId,
                received: { food: 0.5, water: 0.5 },
              },
            },
            at,
          ),
        );
      }
      const at = day * DAY + 22 * 60 * MINUTE;
      if (at <= state.at || at > until) continue;
      const revision = (revisions.get(id) ?? 0) + 1;
      revisions.set(id, revision);
      const prefix = `night:${day}:${id}`;
      inputs.push(
        input(
          run,
          `${prefix}:0-offers`,
          "offers.received",
          {
            person: id,
            revision,
            offers: [
              offer(id, "sleep", 8 * 60 * MINUTE),
              offer(id, "rest", 8 * 60 * MINUTE),
            ],
          },
          at,
        ),
      );
      inputs.push(
        input(
          run,
          `${prefix}:1-decide`,
          "decision.requested",
          {
            person: id,
            reason: "Night at home",
            treatment: "ordinary",
            offerRevision: revision,
          },
          at,
        ),
      );
    }
  }
  return inputs;
}
/** Compare complete JSON values; object key order does not change their meaning.
 * Array order and all field values remain significant. Native archives stay byte-exact. */
export function sameJson(left: unknown, right: unknown): boolean {
  const json = (value: unknown) =>
    JSON.stringify(value, (_key, part: unknown) =>
      part !== null && typeof part === "object" && !Array.isArray(part)
        ? Object.fromEntries(
            Object.entries(part).sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          )
        : part,
    );
  return json(left) === json(right);
}
export function publish(
  run: Run,
  readHostState: () => RunSpec["world"]["hostState"],
  id: string,
  sink: EventSink,
): void {
  for (let publication = 0; publication < cast.length + 1; publication++) {
    const state = current(run);
    const snapshot = structuredClone(readHostState());
    const publicationId =
      publication === 0 ? id : `${id}:reconcile:${publication}`;
    serve(
      run,
      nextIngressAt(run),
      [
        input(run, publicationId, "world.changed", {
          expectedRevision: state.world.revision,
          revision: state.world.revision + 1,
          put: [],
          remove: [],
          hostState: snapshot,
        }),
      ],
      sink,
    );
    if (sameJson(current(run).world.hostState, readHostState())) return;
  }
  throw Error(
    "Child host publication did not reconcile after the bounded publications.",
  );
}
export function previewCrisis(run: Run, inputs: Input[]) {
  return need(
    preview(run, {
      perspective: { kind: "person", observer: "elif" },
      person: "elif",
      // These are newly authored conditional inputs, already timestamped by the
      // caller. Preview executes the same admission rules on a detached branch.
      until: Math.max(current(run).at, ...inputs.map((entry) => entry.at)),
      fidelity: { mode: "daily", dayMs: DAY, anchor: 0 },
      inputs,
    }),
  );
}
export {
  exportRun as nativeExport,
  replay as nativeReplay,
  restoreRun as nativeRestore,
};
export type NativeArchive = DeepReadonly<RunArchive>;
