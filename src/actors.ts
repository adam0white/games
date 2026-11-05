import {
  type ActionResolution,
  type Run as ActorRun,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun,
  type Input,
  inspect,
  type Offer,
  type PerceptData,
  type PersonAuthoring,
  type Result,
  type RunArchive,
  type RunSpec,
  replay,
  restoreRun,
  step,
} from "@adam0white/human-framework";
import {
  admitPortablePerson,
  canonicalCast,
  type LifePreparation,
  type PersonaEnvelope,
  projectPortablePerson,
  validatePortablePerson,
} from "@adam0white/lab-client";

export const ENGINE = "4.17.0";
export const START = 1200 * 60_000;
const MINUTE = 60_000;
const DAY = 86_400_000;
const SOURCE = { type: "host", id: "lefthand" } as const;
export type Archive = DeepReadonly<RunArchive>;
export type ActorReading = {
  id: string;
  name: string;
  now: number;
  body: { asleep: boolean; alive: boolean };
  social: { relationships: readonly { otherId: string; trust: number }[] };
};
export type ActorState = { actorsRun: Archive; people: ActorReading[] };
const live = new WeakMap<object, ActorRun>();
export function need<T>(result: Result<T>): T {
  if (!result.ok)
    throw Error(
      `${result.error.code} ${result.error.path}: ${result.error.message}`,
    );
  return result.value;
}
function authoredPerson(
  id: string,
  name: string,
  sex: "female" | "male" = "female",
): PersonAuthoring {
  return {
    id,
    identity: { name, birthAt: START - 30 * 365 * DAY, sex },
    biography: [],
    origin: {
      kind: "authored",
      basis: { kind: "evidence", id: `author:${id}` },
      traits: {
        kind: "explicit-authoring",
        evidence: { kind: "evidence", id: `traits:${id}` },
      },
    },
    state: {
      traits: {
        honesty: 0.5,
        emotionality: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        conscientiousness: 0.5,
        openness: 0.5,
      },
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
        since: START,
        doze: {
          context: { posture: "upright", stimulation: 0.5 },
          basis: { kind: "authored", author: "world", at: START },
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
        scarcity: {
          kind: "prior",
          value: 0,
          basis: "engineering:source-zero-context",
        },
        smoking: { kind: "unobserved" },
      },
      relationships: [],
      voices: [{ voiceId: "player", trust: 0.5 }],
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
export const CAST = [
  ["yusuf", "Yusuf", 34],
  ["idris", "Idris", 41],
  ["samira", "Samira", 29],
  ["danyal", "Danyal", 52],
  ["tariq", "Tariq", 16],
] as const;
export function opening(
  seed: number,
  arrivals: LifePreparation[] = [],
): Archive {
  const demands = { effort: 0, focus: 0, mode: "awake" as const, requires: {} };
  const spec: RunSpec = {
    id: "lefthand",
    seed,
    start: START,
    host: { id: "lefthand", edition: "left-hand@5", schema: "left-hand@5" },
    definitions: {
      actions: ["check-well", "walk-lane", "sleep"].map((id) => ({
        id,
        label: id,
        demands: {
          ...demands,
          mode: id === "sleep" ? ("sleep" as const) : ("awake" as const),
        },
        tags: [],
        norms: [],
      })),
      norms: [],
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        SOURCE,
        { type: "voice", id: "player" },
        ...CAST.map(([id]) => ({ type: "person" as const, id })),
      ],
      lexicon: {
        names: Object.fromEntries(CAST.map(([id, name]) => [id, name])),
        roles: {},
        prefer: "name",
        actions: {
          "check-well": {
            base: "check the well",
            past: "checked the well",
            gerund: "checking the well",
          },
          "walk-lane": {
            base: "walk the lane",
            past: "walked the lane",
            gerund: "walking the lane",
          },
          sleep: { base: "sleep", past: "slept", gerund: "sleeping" },
        },
        wordings: {
          "decision.act": [
            "Tonight I will {action}.{why}",
            "For my evening round, I choose to {action}.{why}",
            "I have decided to {action} tonight.{why}",
            "This evening, I intend to {action}.{why}",
          ],
          "decision.wait": [
            "Tonight I will wait.",
            "I will wait here for now.",
            "For now, I choose to wait.",
            "I have decided to wait this evening.",
          ],
          "body.woke": [
            "I woke in the winter night.",
            "I am awake again tonight.",
            "I have woken in the night.",
            "I woke up during the winter night.",
          ],
        },
      },
      calendar: {
        id: "winter",
        epoch: { id: "winter-epoch", simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: [0, 1, 2, 3].map((dayIndex) => ({
          dayIndex,
          start: dayIndex * DAY,
          windows: [],
        })),
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: ["family-home", "lane", "well", "family door"].map((id) => ({
        id: `place:${id.replaceAll(" ", "-")}`,
        subject: id,
        predicate: "place",
        value: id,
        at: START,
        provenance: { source: "lefthand", evidenceId: `authored:place:${id}` },
      })),
      hostState: { active: [] },
    },
  };
  const run = need(createRun(spec));
  for (const [id, name, age] of CAST) {
    const person = authoredPerson(
      id,
      name,
      id === "samira" ? "female" : "male",
    );
    person.identity.birthAt = START - age * 365 * DAY;
    person.identity.castId = `hf.cast.${id}.well`;
    person.state.traits.honesty = id === "danyal" ? 0.9 : 0.5;
    person.state.body.sleepPressure = id === "samira" ? 0.85 : 0.15;
    if (id === "samira") {
      person.state.body.circadianPeakMs = 8 * 60 * MINUTE;
    }
    person.state.body.doze.context = {
      posture: id === "samira" ? "reclined" : "upright",
      stimulation: id === "samira" ? 0.1 : 0.5,
    };
    const arrival = arrivals.find(
      (a) => a.parent.castId === person.identity.castId,
    );
    const admitted = arrival ? admitArrival(arrival, person) : person;
    need(createPerson(run, admitted));
  }
  hosts.set(run, { revision: 0, active: [] });
  const archive = exportRun(run);
  live.set(archive, run);
  return archive;
}
/** SCOPE: one shelf admission before the first step; the pinned input owns replay.
 * Clinical premises, clocks and unsupported references are validated by HF. */
function admitArrival(
  arrival: LifePreparation,
  person: PersonAuthoring,
): PersonAuthoring {
  const portable = validatePortablePerson(arrival.parent.transfer.portable);
  return admitPortablePerson(arrival.parent, "lefthand", person, {
    offsetMs: portable.version === 2 ? START - portable.retained.at : 0,
    references: [],
  });
}
/** Validate a single candidate without claiming any shelf head. */
export function validateArrival(seed: number, arrival: LifePreparation): void {
  if (!CAST.some(([id]) => arrival.parent.castId === `hf.cast.${id}.well`))
    throw Error("No authored role here");
  opening(seed, [arrival]);
}
export function departure(
  s: ActorState,
  id: string,
  previous?: PersonaEnvelope,
): Record<string, unknown> {
  const run = take(s);
  const archive = exportRun(run);
  const castId = `hf.cast.${id}.well`;
  const person = archive.current.people[id];
  if (!person) throw Error("Missing current actor");
  const cast = canonicalCast(castId);
  if (cast.revision !== "1") throw Error("Unsupported cast edition");
  return projectPortablePerson({
    castId,
    game: "lefthand",
    engine: ENGINE,
    person,
    history: [
      "Continued a Left Hand chapter in the Well settlement. Exact events remain in the chapter export.",
    ],
    previous,
    hostObligations: [],
    calendar: {
      definition: archive.initial.spec.definitions.calendar,
      norms: archive.initial.spec.definitions.norms,
    },
  });
}
const stateRuns = new WeakMap<ActorState, ActorRun>();
function take(s: ActorState): ActorRun {
  const cached = stateRuns.get(s);
  if (cached) return cached;
  const run = live.get(s.actorsRun) ?? need(restoreRun(s.actorsRun));
  stateRuns.set(s, run);
  const world = s.actorsRun.current.world;
  if (!hosts.has(run))
    hosts.set(run, {
      revision: world.revision,
      active: structuredClone((world.hostState as { active: Active[] }).active),
    });
  // Materialize the complete archive only for saves, hashes and exports. JSON
  // round-trips retain the archive and restore their own independent HF run.
  Object.defineProperty(s, "actorsRun", {
    enumerable: true,
    configurable: true,
    get: () => exportRun(run),
  });
  return run;
}
function keep(s: ActorState, run: ActorRun) {
  s.people = readings(run);
}
function clock(run: ActorRun) {
  return need(
    inspect(run, {
      perspective: { kind: "host" },
      people: ["yusuf"],
      select: ["summary"],
    }),
  ).at;
}
function readings(run: ActorRun): ActorReading[] {
  const view = need(
    inspect(run, {
      perspective: { kind: "host" },
      people: CAST.map(([id]) => id),
      select: ["body", "summary", "relationships"],
    }),
  );
  return view.people.map((person) => {
    if (person.kind !== "host") throw Error("Expected host reading");
    const body = person.parts.find((p) => p.select === "body");
    const summary = person.parts.find((p) => p.select === "summary");
    const ties = person.parts.find((p) => p.select === "relationships");
    if (
      body?.select !== "body" ||
      summary?.select !== "summary" ||
      ties?.select !== "relationships"
    )
      throw Error("Missing actor reading");
    return {
      id: person.id,
      name: summary.value.name,
      now: view.at,
      body: { ...body.value.state, alive: summary.value.alive },
      social: { relationships: ties.value.ties },
    };
  });
}
export function refresh(s: ActorState) {
  const run = take(s);
  keep(s, run);
}
/** Each ingress uses the next integer millisecond after the last accepted batch.
 * The 1-second game tick leaves room for all authored events before its end. */
function ingress(
  s: ActorState,
  make: (at: number, id: string, run: ActorRun) => Input[],
): void {
  const run = take(s);
  const at = clock(run) + 1;
  const id = `lh:${at}`;
  serve(run, at, make(at, id, run));
  keep(s, run);
}
type Active = {
  id: string;
  person: string;
  offerId: string;
  actionId: string;
  start: number;
};
type HostLedger = { revision: number; active: Active[] };
const hosts = new WeakMap<ActorRun, HostLedger>();
function host(run: ActorRun): HostLedger {
  const value = hosts.get(run);
  if (!value) throw Error("Missing host ledger");
  return value;
}
function serve(run: ActorRun, until: number, inputs: Input[] = []) {
  let staged: HostLedger | undefined;
  for (let attempts = 0; attempts < 100; attempts++) {
    const result = need(step(run, { until, inputs }));
    if (staged) {
      hosts.set(run, staged);
      staged = undefined;
    }
    if (result.boundary.type === "until") return;
    const current = host(run);
    const active = { active: structuredClone(current.active) };
    let revision = current.revision;
    inputs = [...result.boundary.requests]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((request) => {
        const base = {
          id: `receipt:${request.id}`,
          at: request.boundaryAt,
          source: SOURCE,
        };
        if (request.kind === "communication")
          return {
            ...base,
            kind: "communication.resolved",
            payload: {
              requestId: request.id,
              requestHash: request.requestHash,
              worldRevision: revision,
              speaker: request.speaker,
              emittedItemIds: [],
              received: [],
            },
          };
        const common = {
          requestId: request.id,
          requestHash: request.requestHash,
          person: request.person,
          activityId: request.activityId,
          stage: request.stage,
          worldRevision: revision,
        };
        const change = () => ({
          expectedRevision: revision++,
          revision,
          put: [],
          remove: [],
          hostState: structuredClone(active),
        });
        let payload: ActionResolution;
        if (request.stage === "start") {
          if (!["check-well", "walk-lane", "sleep"].includes(request.offerId))
            throw Error("Unknown requested routine");
          active.active.push({
            id: request.activityId,
            person: request.person,
            offerId: request.offerId,
            actionId: request.offerId,
            start: request.boundaryAt,
          });
          payload = {
            ...common,
            disposition: "accepted",
            observations: [],
            worldChange: change(),
          };
        } else {
          const index = active.active.findIndex(
            (a) => a.id === request.activityId && a.person === request.person,
          );
          const activity = active.active[index];
          if (!activity) throw Error("Unknown active routine");
          active.active.splice(index, 1);
          const status =
            request.stage === "interrupt" ? "interrupted" : "completed";
          payload = {
            ...common,
            disposition: status,
            observations: [],
            outcome: {
              activityId: activity.id,
              offerId: activity.offerId,
              actionId: activity.actionId,
              start: activity.start,
              end: request.boundaryAt,
              status,
              evidenceId: `outcome:${request.id}`,
              actual: { exposures: [], observedProgress: [] },
              fulfills: [],
              advances: [],
            },
            worldChange: change(),
          };
        }
        return { ...base, kind: "action.resolved", payload };
      });
    staged = { revision, active: active.active };
  }
  throw Error("HF boundary settlement budget exhausted");
}
export function advance(s: ActorState, tick: number) {
  const run = take(s);
  serve(run, START + tick * 1000);
  keep(s, run);
}
export function nightRoutines(s: ActorState): Record<string, string> {
  const chosen: Record<string, string> = {};
  const pending = host(take(s)).active;
  if (pending.length)
    ingress(s, (at, id) =>
      pending.map((activity) => ({
        id: `${id}:${activity.person}`,
        at,
        source: SOURCE,
        kind: "activity.interrupted",
        payload: {
          person: activity.person,
          activityId: activity.id,
          reason: "evening round ended",
        },
      })),
    );
  ingress(s, (at, prefix, run) =>
    CAST.filter(([person]) => person !== "samira").flatMap(([person]) => {
      const id = `${prefix}:${person}`;
      const sleep = person === "samira";
      const view = need(
        inspect(run, {
          perspective: { kind: "host" },
          people: [person],
          select: ["summary"],
        }),
      );
      const personView = view.people[0];
      if (personView?.kind !== "host") throw Error("Expected host reading");
      const summary = personView.parts[0];
      if (summary?.select === "summary" && summary.value.activity)
        throw Error("Routine already active");
      const actions = sleep ? ["sleep"] : ["check-well", "walk-lane"];
      const offers: Offer[] = actions.map((actionId) => ({
        id: actionId,
        actionId,
        label: actionId,
        person,
        durationMs: sleep ? 600_000 : 60_000,
        participants: [],
        alongside: [],
        demands: {
          effort: actionId === "check-well" ? 0.1 : 0.05,
          focus: 0,
          mode: sleep ? "sleep" : "awake",
          requires: {},
        },
        tags: [],
        norms: [],
        expected: {
          needs:
            actionId === "check-well" ? { competence: 0.4 } : { leisure: 0.3 },
          followedBy: [],
          provenance: ["authored:lefthand"],
        },
        fulfills: [],
        advances: [],
        diminishes: [],
      }));
      const revision = at;
      return [
        {
          id: `${id}:offers`,
          at,
          source: SOURCE,
          kind: "offers.received",
          payload: { person, revision, offers },
        },
        {
          id: `${id}:decision`,
          at,
          source: SOURCE,
          kind: "decision.requested",
          payload: {
            person,
            reason: "evening round",
            treatment: "ordinary",
            offerRevision: revision,
          },
        },
      ];
    }),
  );
  for (const active of host(take(s)).active)
    chosen[active.person] = active.actionId;
  withdrawRoutineOffers(s);
  return chosen;
}
function withdrawRoutineOffers(s: ActorState) {
  ingress(s, (at, prefix) =>
    CAST.map(([person]) => ({
      id: `${prefix}:withdraw:${person}`,
      at,
      source: SOURCE,
      kind: "offers.received" as const,
      payload: { person, revision: at, offers: [] },
    })),
  );
}
export function interrupt(
  s: ActorState,
  person: string,
  reason = "audible knock at the door",
) {
  const active = host(take(s)).active.find((a) => a.person === person);
  if (active)
    ingress(s, (at, id) => [
      {
        id,
        at,
        source: SOURCE,
        kind: "activity.interrupted",
        payload: {
          person,
          activityId: active.id,
          reason,
        },
      },
    ]);
}
/** The episode ending stops local rounds through the ordinary HF lifecycle.
 * It does not clear commitments, wake people or manufacture completed work. */
export function closeChapter(s: ActorState) {
  withdrawRoutineOffers(s);
  for (const [id] of CAST) interrupt(s, id, "the winter chapter has ended");
}
export type Percept = Omit<Partial<PerceptData>, "channel"> & {
  at: number;
  channel: PerceptData["channel"];
  kind: string;
  summary: string;
  salience: number;
};
export function perceive(s: ActorState, person: string, percepts: Percept[]) {
  ingress(s, (at, id) =>
    percepts.flatMap((p, index): Input[] => {
      const evidenceId = `${id}:${index}`;
      const { at: _oldAt, ...data } = p;
      const percept: PerceptData = {
        id: evidenceId,
        occurredAt: at,
        claims: [],
        norms: [],
        advice: [],
        consequences: [],
        withdrawConsequences: [],
        witnesses: [],
        reports: [],
        provenance: ["authored:lefthand"],
        ...data,
      };
      const inputs: Input[] = [
        {
          id: `${evidenceId}:observation`,
          at,
          source: SOURCE,
          kind: "observation.received",
          payload: { person, evidenceId, percepts: [percept] },
        },
      ];
      if (p.channel === "social" && p.actorId)
        inputs.push({
          id: `${evidenceId}:social`,
          at,
          source: SOURCE,
          kind: "social.received",
          payload: {
            person,
            evidenceId: `${evidenceId}:social`,
            other: p.actorId,
            event: {
              kind:
                p.kind === "harm"
                  ? "harm"
                  : p.kind === "shared-work"
                    ? "shared-work"
                    : "gift",
              byMe: false,
              magnitude: Math.abs(p.valence ?? 0),
            },
          },
        });
      return inputs;
    }),
  );
}
export function verifyArchive(archive: Archive) {
  const result = need(replay(archive));
  if (!result.verified || result.fullHash !== archive.hashes.full)
    throw Error("HF replay hash mismatch");
  return result;
}

/** SCOPE: public self narration, rendered by HF with recorded wording choices.
 * Read only when opening the menu; no host-private events or extra RNG route. */
export function eveningAccounts(
  s: ActorState,
): { name: string; line: string }[] {
  const run = take(s);
  return CAST.flatMap(([id, name]) => {
    const view = need(
      inspect(run, {
        perspective: { kind: "person", observer: id },
        people: [id],
        select: ["events"],
      }),
    );
    const lines = view.events.flatMap((event) => event.narration);
    const line = lines.at(-1)?.text;
    return line ? [{ name, line }] : [];
  });
}
