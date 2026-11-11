import type { LifePreparation } from "@adam0white/lab-client";
import {
  type ActorReading,
  type Archive,
  advance,
  closeChapter,
  ENGINE as FRAMEWORK_VERSION,
  interrupt,
  nightRoutines,
  opening,
  perceive,
  refresh,
  verifyArchive,
} from "./actors.ts";

export const TICK_HZ = 10;
export const WIDTH = 15,
  HEIGHT = 18,
  NIGHT_LIMIT = 600;
export type Command =
  | { type: "plan"; route: "door" | "well" }
  | { type: "move"; dx: number; dy: number }
  | { type: "lantern" }
  | { type: "act" }
  | { type: "recover"; choice: Reply }
  | { type: "next" }
  | { type: "wait" };
type Point = { x: number; y: number };
/** Replies to a neighbour's question. All replies are honest: "ask" names nobody
 * and asks him to keep what he saw to himself. */
export type Reply = "explain" | "keepquiet" | "ask" | "joke";
type Actor = Point & {
  id: string;
  reaction: string;
  routine: string;
  lantern: boolean;
};
type Input = { tick: number; command: Command };
type Witness = {
  id: string;
  place: string;
  fact: string;
  explanation: string;
  recovered: null | Reply;
  sight: "carrying" | "empty-handed" | "leaving";
  /** He already kept one promise for Yusuf; a second sighting ends it. */
  repeat: boolean;
};
export type State = {
  schema: "left-hand@5";
  engine: string;
  seed: number;
  carryover: {
    inputs: LifePreparation[];
    blocked: { castId: string; reason: string }[];
  };
  rng: number;
  tick: number;
  nightTick: number;
  hasMoved: boolean;
  returningHome: boolean;
  exposureNights: number;
  /** Nights when only Tariq's guess named the family: village talk, no lost trust. */
  talkNights: number;
  /** Door nights no neighbour saw the envelope: the family alone knows the giver. */
  thankedNights: number;
  directHandoffTonight: boolean;
  /** Neighbours who promised not to tell. A second sighting by one is exposure. */
  promised: string[];
  /** Lantern state when tonight's envelope was left; null before it is left. */
  lanternAtDrop: boolean | null;
  rescues: number;
  ending:
    | ""
    | "sheltered"
    | "thanked"
    | "talked"
    | "exposed"
    | "rescued"
    | "unsupported";
  conversationTicksRemaining: number;
  night: number;
  phase: "evening" | "night" | "morning" | "ended";
  route: "door" | "well";
  player: Point & { lantern: boolean };
  people: ActorReading[];
  actorsRun: Archive;
  actors: Actor[];
  witness: Witness | null;
  recoveryPending: boolean;
  delivered: number;
  deliveredTonight: boolean;
  envelopePlaced: boolean;
  wellPendingTick: number | null;
  assistedWell: boolean;
  cold: number;
  outcome: string;
  status: string;
  morningLines: { id: string; name: string; line: string }[];
  history: {
    night: number;
    delivered: boolean;
    witness: Witness | null;
    route: "door" | "well";
    lanternAtDrop: boolean | null;
    exposed: boolean;
    talk: boolean;
    thanked: boolean;
    rescued: boolean;
    lines: State["morningLines"];
    reason: string;
  }[];
  inputs: Input[];
  routineOffset: number;
};
export type Run = {
  schema: "left-hand-run@5";
  engine: string;
  seed: number;
  ticks: number;
  inputs: Input[];
  finalHash: string;
  state: State;
};
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function required<T>(value: T | undefined | null): T {
  if (value == null) throw new Error("Invalid host state");
  return value;
}
const HOME = { x: 7, y: 15 },
  DOOR = { x: 11, y: 3 },
  WELL = { x: 4, y: 7 };
const CAST = [
  ["yusuf", "Yusuf", 34],
  ["idris", "Idris", 41],
  ["samira", "Samira", 29],
  ["danyal", "Danyal", 52],
  ["tariq", "Tariq", 16],
] as const;
const STARTS = [
  HOME,
  { x: 12, y: 3 },
  { x: 10, y: 3 },
  { x: 4, y: 8 },
  { x: 8, y: 14 },
];
function random(s: State): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function isWall(x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= WIDTH - 1 || y >= HEIGHT - 1) return true;
  return (
    ((x >= 1 && x <= 3) || (x >= 10 && x <= 13)) &&
    ((y >= 1 && y <= 2) || (y >= 10 && y <= 12))
  );
}
function los(a: Point, b: Point): boolean {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - x),
    dy = -Math.abs(b.y - y),
    sx = x < b.x ? 1 : -1,
    sy = y < b.y ? 1 : -1;
  let e = dx + dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y += sy;
    }
    if (isWall(x, y)) return false;
  }
  return true;
}
function distance(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function lit(s: State, p: Point): boolean {
  if (isWall(p.x, p.y)) return false;
  const lamps = [WELL, DOOR, { x: 7, y: 14 }];
  if (s.player.lantern) lamps.push(s.player);
  lamps.push(...s.actors.filter((a) => a.lantern));
  return lamps.some((l) => distance(l, p) <= 3 && los(l, p));
}
export function createGame(
  seed = 1,
  carryover: State["carryover"] = { inputs: [], blocked: [] },
): State {
  seed >>>= 0;
  const s: State = {
    schema: "left-hand@5",
    engine: FRAMEWORK_VERSION,
    seed,
    carryover: copy(carryover),
    rng: seed,
    tick: 0,
    nightTick: 0,
    hasMoved: false,
    returningHome: false,
    exposureNights: 0,
    talkNights: 0,
    thankedNights: 0,
    directHandoffTonight: false,
    promised: [],
    lanternAtDrop: null,
    rescues: 0,
    ending: "",
    conversationTicksRemaining: 0,
    night: 1,
    phase: "evening",
    route: "door",
    player: { ...HOME, lantern: true },
    people: [],
    actorsRun: opening(seed, carryover.inputs),
    actors: CAST.map(([id], i) => ({
      id,
      ...required(STARTS[i]),
      reaction: "",
      routine: "at home",
      lantern: id === "danyal" || id === "tariq",
    })),
    witness: null,
    recoveryPending: false,
    delivered: 0,
    deliveredTonight: false,
    envelopePlaced: false,
    wellPendingTick: null,
    assistedWell: false,
    cold: 0,
    outcome: "",
    status: `Prepare one envelope for Idris and Samira. Tariq walks the ${openingRoutine(seed).lane} lane; ${openingRoutine(seed).firstWitness === "tariq" ? "Tariq" : "Danyal"} is the first neighbour you can meet. Your route and lantern change where he sees you. Choose their door or the well box.`,
    morningLines: [],
    history: [],
    inputs: [],
    routineOffset: 0,
  };
  refresh(s);
  return s;
}
/** True when an earlier explanation left a trusting neighbour who shortens collection. */
function neighbourAssists(s: State): boolean {
  return s.history.some(
    (h) =>
      h.delivered &&
      h.witness?.recovered === "explain" &&
      (required(
        s.people.find((p) => p.id === h.witness?.id),
      ).social.relationships.find((r) => r.otherId === "yusuf")?.trust ?? 0.5) >
        0.5,
  );
}
/** Dawn-clock seconds the well collection will take on the coming night. */
export function upcomingWellSeconds(s: State): number {
  return ((neighbourAssists(s) ? 0 : 30) + s.exposureNights * 30) / 10;
}
function chooseRoutines(s: State) {
  s.routineOffset = Math.floor(random(s) * 80);
  const choices = nightRoutines(s);
  for (const a of s.actors) {
    if (a.id === "samira") {
      a.routine = "sleeping at home";
      continue;
    }
    const choice = choices[a.id];
    a.routine =
      a.id !== "tariq" && choice === "check-well"
        ? "checking the well"
        : "walking the lane";
  }
}
/** Seeded public opening facts also let Play again choose a visibly different run. */
export function openingRoutine(seed: number) {
  return {
    lane: (seed >>> 0) % 2 === 0 ? "east" : "north",
    firstWitness: Math.floor((seed >>> 0) / 2) % 2 === 0 ? "tariq" : "danyal",
  } as const;
}
function expectedWitness(s: State): string {
  const first = openingRoutine(s.seed).firstWitness;
  return s.night % 2 === 1 ? first : first === "tariq" ? "danyal" : "tariq";
}
function laneTarget(s: State, id: string): Point {
  return id === "tariq"
    ? openingRoutine(s.seed).lane === "east"
      ? { x: 12, y: 15 }
      : { x: 7, y: 9 }
    : { x: 7, y: 13 };
}
function startNight(s: State) {
  s.phase = "night";
  s.nightTick = 0;
  s.hasMoved = false;
  s.returningHome = false;
  s.player = { ...HOME, lantern: true };
  s.cold = 0;
  s.deliveredTonight = false;
  s.directHandoffTonight = false;
  s.lanternAtDrop = null;
  s.envelopePlaced = false;
  s.wellPendingTick = null;
  s.assistedWell = neighbourAssists(s);
  s.witness = null;
  s.recoveryPending = false;
  s.morningLines = [];
  s.actors.forEach((a, i) => {
    Object.assign(a, STARTS[i]);
    a.reaction = "";
  });
  chooseRoutines(s);
  s.status = `Night ${s.night}: ${s.route === "door" ? "Samira takes the envelope at her door. If no neighbour sees your envelope, only her household knows it was you" : `Danyal, who keeps the well, collects the envelope ${wellDelay(s) / 10} seconds after you leave it${s.assistedWell ? " (your earlier explanation already saves 3 seconds)" : ""}${s.exposureNights ? ", longer now because Samira waits to meet him alone" : ""}. He must collect it before dawn`}. Then return home. Your lantern is lit: light lets a nearby neighbour see you. Hidden, you stay unseen but lose warmth; if the warmth bar empties, a neighbour must carry you home.${s.rescues ? ` Your rescue left you exhausted: tonight you have ${nightLimit(s) / 10} seconds before you must rest.` : ""}`;
}
function where(place: string): string {
  return place === "lane" ? "on the lane" : `at the ${place}`;
}
function placeName(s: State): string {
  return distance(s.player, WELL) <= 1
    ? "well"
    : distance(s.player, DOOR) <= 1
      ? "family door"
      : "lane";
}
function encounter(
  s: State,
  visibleId?: string,
  sight: Witness["sight"] = s.envelopePlaced ? "empty-handed" : "carrying",
) {
  if (s.witness) return;
  // One seeded neighbour can witness this night; route and light decide where.
  const id = visibleId ?? expectedWitness(s);
  const a = required(s.actors.find((a) => a.id === id));
  const p = required(s.people.find((p) => p.id === id));
  const adjacent = required(
    [
      { x: s.player.x + 1, y: s.player.y },
      { x: s.player.x - 1, y: s.player.y },
      { x: s.player.x, y: s.player.y + 1 },
      { x: s.player.x, y: s.player.y - 1 },
    ].find((t) => !isWall(t.x, t.y)),
  );
  if (!visibleId) {
    Object.assign(a, adjacent);
    a.lantern = true;
  }
  const place = placeName(s),
    fact = `I saw Yusuf ${sight === "leaving" ? "leave an envelope" : sight === "carrying" ? "carrying an envelope" : "empty-handed"} ${where(place)}.`;
  const explanation =
    id === "tariq" && sight !== "empty-handed"
      ? "I think Yusuf is helping Idris and Samira."
      : "";
  const repeat = s.promised.includes(id);
  s.witness = { id, place, fact, explanation, recovered: null, sight, repeat };
  s.recoveryPending = true;
  perceive(s, p.id, [
    {
      at: p.now,
      channel: "saw",
      kind: "envelope-sighting",
      actorId: "yusuf",
      placeId: place,
      near: true,
      salience: 1,
      summary: fact,
      claims: [
        {
          prop: `night-${s.night}:yusuf-at-${place.replaceAll(" ", "-")}`,
          value: true,
          confidence: 1,
        },
      ],
    },
  ]);
  a.reaction =
    id === "danyal"
      ? sight === "empty-handed"
        ? "Danyal raises his lantern. “I saw you on the lane.”"
        : sight === "carrying"
          ? "Danyal raises his lantern. “I see you carrying an envelope.”"
          : "Danyal raises his lantern. “I saw you leave the envelope.”"
      : sight === "empty-handed"
        ? "Tariq turns. “Out late, Yusuf?”"
        : "Tariq turns. “Is that for Idris?”";
  s.status = repeat
    ? `${a.reaction} He promised once to keep quiet. Seeing you again, he will tell people what he saw, whatever you say. The dawn clock waits for your reply.`
    : `${a.reaction} ${canAsk(s.witness) ? "Explain, keep quiet, joke, or ask him not to tell" : "Explain, keep quiet, or joke"}. The dawn clock waits for your reply.`;
}
/** Asking is offered only when the sighting would cost the family's privacy
 * (he saw the envelope left, or Tariq has a guess) and he has not promised before. */
export function canAsk(w: Witness): boolean {
  return !w.repeat && (w.sight === "leaving" || !!w.explanation);
}
function recover(s: State, choice: Reply) {
  if (!s.recoveryPending || !s.witness) return;
  if (choice === "ask" && !canAsk(s.witness)) {
    s.status = s.witness.repeat
      ? "He will not promise twice. Explain or keep quiet."
      : "There is nothing to ask him to hide: he saw nothing about the family. Explain or keep quiet.";
    return;
  }
  s.witness.recovered = choice;
  s.recoveryPending = false;
  const p = required(s.people.find((p) => p.id === s.witness?.id));
  if (choice === "explain") {
    // Subsequent fixed ticks run the same cold, collection and dawn rules.
    s.conversationTicksRemaining = 30;
    const summary =
      "The envelope is for Idris and Samira. Please deliver it if you find it, and let them choose what to say.";
    perceive(s, p.id, [
      {
        at: p.now,
        channel: "told",
        kind: "delivery-explanation",
        actorId: "yusuf",
        targetId: p.id,
        near: true,
        salience: 0.9,
        summary,
      },
      {
        at: p.now,
        channel: "social",
        kind: "shared-work",
        actorId: "yusuf",
        targetId: p.id,
        near: true,
        valence: 0.8,
        salience: 1,
        summary:
          "Yusuf and I agree how to get this labelled envelope to the household. I will help coordinate the delivery.",
      },
    ]);
    s.witness.explanation =
      "Yusuf told me the envelope was for Idris and Samira; he asked for discretion.";
  }
  if (choice === "ask") {
    s.conversationTicksRemaining = 10;
    s.promised.push(p.id);
    perceive(s, p.id, [
      {
        at: p.now,
        channel: "told",
        kind: "discretion-request",
        actorId: "yusuf",
        targetId: p.id,
        near: true,
        salience: 0.8,
        summary:
          "Yusuf asked me to keep what I saw tonight to myself. He named nobody.",
      },
    ]);
  }
  if (choice === "joke") {
    s.conversationTicksRemaining = 10;
    perceive(s, p.id, [
      {
        at: p.now,
        channel: "told",
        kind: "honest-joke",
        actorId: "yusuf",
        targetId: p.id,
        near: true,
        salience: 0.5,
        summary:
          "Yusuf joked: ‘At this hour, even my shadow wants to go home.’ He named nobody and denied nothing.",
      },
    ]);
  }
  s.status =
    choice === "joke"
      ? "‘At this hour, even my shadow wants to go home.’ You name nobody and deny nothing. The joke takes 1 second. He can still repeat what he saw or guessed."
      : choice === "ask"
        ? "You ask him to keep what he saw to himself, and you name nobody. It takes 1 second. He promises, this once: if he sees you out again, he will tell people."
        : choice === "explain"
          ? "You spend 3 seconds naming Idris and Samira and agreeing how to help them. Your neighbour will help, but the family’s need is now named."
          : s.witness.sight === "leaving"
            ? "You keep quiet. Your neighbour saw you leave the envelope and will say so."
            : s.witness.explanation
              ? "You keep quiet. Tariq will still tell people his own guess, but nobody can confirm it."
              : "You keep quiet. Your neighbour will tell only what he saw.";
}
/** Warmth runs out after this many hidden-lantern ticks (lit ticks warm twice as fast). */
export const COLD_LIMIT = 420;
function collectionSecondsLeft(s: State): number {
  return s.wellPendingTick === null
    ? 0
    : Math.max(1, Math.ceil((s.wellPendingTick - s.nightTick) / 10));
}
/** Cardinal-move distance from Yusuf to the nearest tile that counts for tonight's marker. */
function stepsToTarget(s: State): number {
  const target = s.route === "door" ? DOOR : WELL;
  const seen = new Set([`${s.player.x},${s.player.y}`]);
  let frontier: Point[] = [s.player];
  for (let steps = 0; frontier.length; steps++) {
    const next: Point[] = [];
    for (const p of frontier) {
      if (distance(p, target) <= 1) return steps;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const q = { x: p.x + dx, y: p.y + dy };
        const key = `${q.x},${q.y}`;
        if (!isWall(q.x, q.y) && !seen.has(key)) {
          seen.add(key);
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return 0;
}
function wellDelay(s: State) {
  return (s.assistedWell ? 0 : 30) + s.exposureNights * 30;
}
function nightLimit(s: State) {
  return NIGHT_LIMIT - s.rescues * 60;
}
const NAMES: Record<string, string> = { danyal: "Danyal", tariq: "Tariq" };
/** Why tonight cost the family's privacy, in one clause. */
function exposureCause(w: Witness): string {
  const name = NAMES[w.id] ?? w.id;
  return w.repeat
    ? `${name} saw Yusuf out again after promising once to keep quiet, and told people`
    : w.recovered === "explain"
      ? `Yusuf named us to ${name}`
      : `${name} saw Yusuf leave the envelope ${where(w.place)} by lantern light`;
}
/** Yusuf's own account: route, lantern, who saw him and his reply. */
function recap(s: State, w: Witness | null): string {
  const spot = s.route === "door" ? "their door" : "the well box";
  const route =
    s.lanternAtDrop === null
      ? `You set out for ${spot} but did not leave the envelope.`
      : `You left the envelope at ${spot} with your lantern ${s.lanternAtDrop ? "lit" : "hidden"}.`;
  if (!w) return `${route} No neighbour saw you.`;
  const name = NAMES[w.id] ?? w.id;
  const seen =
    w.sight === "leaving"
      ? "leave the envelope"
      : w.sight === "carrying"
        ? "carrying the envelope"
        : "empty-handed";
  const reply =
    w.recovered === "explain"
      ? "You explained."
      : w.recovered === "ask"
        ? "You asked him not to tell."
        : w.recovered === "joke"
          ? "You joked, naming nobody and denying nothing."
          : "You kept quiet.";
  return `${route} ${name} saw you ${seen} ${where(w.place)}. ${reply}`;
}
function morning(s: State, reason: string, rescued = false) {
  if (s.recoveryPending)
    throw new Error("Morning requires a resolved encounter");
  // A scheduled handoff is not receipt. The delivery window has closed.
  s.wellPendingTick = null;
  s.conversationTicksRemaining = 0;
  const w = s.witness;
  const promise = w?.recovered === "ask";
  // Trust is lost when the family's need is confirmed in public: Yusuf named
  // them, a neighbour saw him leave the envelope and did not promise silence,
  // or a neighbour who already promised once saw him again.
  const exposed =
    !!w &&
    (w.recovered === "explain" ||
      w.repeat ||
      (w.sight === "leaving" && !promise));
  // Tariq's guess alone is village talk: nobody can confirm it. A promise keeps it unsaid.
  const talk = !exposed && !promise && !!w?.explanation;
  // A door handoff no neighbour talked about: only the family knows, and Idris
  // can thank him.
  const thanked = !exposed && !talk && s.directHandoffTonight;
  if (exposed) s.exposureNights++;
  if (talk) s.talkNights++;
  if (thanked) s.thankedNights++;
  if (rescued) s.rescues++;
  const report = w
    ? w.fact +
      (w.explanation
        ? ` ${w.explanation}`
        : " I cannot say who the envelope was for.")
    : "I did not see Yusuf last night.";
  const cause = w && exposed ? exposureCause(w) : "";
  for (const id of ["idris", "samira"]) {
    const p = required(s.people.find((p) => p.id === id));
    if (!promise)
      perceive(s, p.id, [
        {
          at: p.now,
          channel: "told",
          kind: "morning-account",
          actorId: w?.id ?? "danyal",
          targetId: id,
          salience: 0.9,
          summary: report,
        },
      ]);
    if (exposed)
      perceive(s, p.id, [
        {
          at: p.now,
          channel: "social",
          kind: "harm",
          actorId: "yusuf",
          targetId: id,
          near: true,
          valence: -0.8,
          salience: 1,
          summary:
            id === "idris"
              ? `The village is discussing our need: ${cause}. I wanted to choose whom to tell.`
              : `Yusuf let our household become village talk: ${cause}. I need a more private handoff next time.`,
        },
      ]);
    if (talk && id === "idris")
      perceive(s, p.id, [
        {
          at: p.now,
          channel: "heard",
          kind: "rumour",
          actorId: "tariq",
          targetId: id,
          valence: -0.3,
          salience: 0.7,
          summary:
            "Tariq is guessing in the lane that we need help. Nobody can confirm it, but people listen.",
        },
      ]);
    if (thanked)
      perceive(s, p.id, [
        {
          at: p.now,
          channel: "social",
          kind: "gift",
          actorId: "yusuf",
          targetId: id,
          near: true,
          valence: 0.6,
          salience: 1,
          summary:
            "Yusuf brought the envelope to our door himself and no neighbour talked about it. We can thank him quietly.",
          claims: [{ prop: "gift-giver:yusuf", value: true, confidence: 1 }],
        },
      ]);
    if (s.deliveredTonight && w?.recovered === "explain")
      perceive(s, p.id, [
        {
          at: p.now,
          channel: "told",
          kind: "gift",
          actorId: "yusuf",
          targetId: id,
          valence: 0.7,
          salience: 1,
          summary:
            "The envelope Yusuf arranged reached our household. We know whom to thank.",
          claims: [{ prop: "gift-giver:yusuf", value: true, confidence: 0.9 }],
        },
      ]);
  }
  const door = s.route === "door";
  const idris = (): string => {
    if (!s.deliveredTonight)
      return talk
        ? "No envelope reached us, and Tariq is guessing about us in the lane. We still need food and fuel."
        : "No envelope reached us last night. We still need food and fuel.";
    if (exposed)
      return s.exposureNights >= 2
        ? `The help is ours, but ${cause}. Everyone discusses our need now. I will not discuss it with Yusuf.`
        : `I accept the help, but ${cause}, so people know we need it. I wanted to choose who knew.`;
    if (thanked)
      return "Yusuf brought it to our door himself, and no neighbour talked about it. I can thank him quietly.";
    if (talk)
      return `The envelope reached us${door ? " at our door" : " from the well box"}. Tariq is guessing about us in the lane; I hope nobody believes him.`;
    return door
      ? "The envelope reached us at our door. We will use it for food and fuel."
      : "Danyal brought the envelope from the well box. We will use it for food and fuel.";
  };
  const samira = (): string => {
    if (!s.deliveredTonight)
      return s.envelopePlaced
        ? "Danyal did not knock before dawn. We managed this morning, but we need help before the next one."
        : "We managed this morning. We need help before the next one.";
    const handed = door
      ? "Yusuf handed it to me at our door, so I know it was him."
      : "Danyal knocked and handed me the envelope from the well box.";
    if (exposed)
      return `${handed} But ${cause}. I trust Yusuf less with our privacy; next time Danyal must wait until I can meet him alone.`;
    if (talk)
      return `${handed} Tariq guesses, but ${door ? "only our household knows for sure" : "nobody knows who gave it"}.`;
    return `${handed} ${door ? "Only our household knows." : "Our need has stayed private."}`;
  };
  const neighbour = (id: string): string => {
    const actor = required(s.actors.find((a) => a.id === id));
    if (id === w?.id)
      return promise
        ? "Yusuf asked me to keep last night to myself, and I will, this once. I am saying nothing about what I saw."
        : w.repeat
          ? `${report} He asked me once before to keep quiet. Twice is too many; I told people.`
          : report;
    if (exposed)
      return "People are talking about Yusuf helping Idris and Samira.";
    if (talk)
      return "Tariq says Yusuf is helping Idris and Samira. Nobody can say for sure.";
    if (id === "danyal" && !door)
      return s.deliveredTonight
        ? "I collected an envelope from the well box and took it to Samira. I did not see who left it."
        : s.envelopePlaced
          ? "There was an envelope in the well box, but dawn came before I could take it to Samira."
          : "Nothing was left in the well box last night.";
    return `I was ${actor.routine} last night and did not see Yusuf.`;
  };
  s.morningLines = CAST.map(([id, name]) => ({
    id,
    name,
    line:
      id === "yusuf"
        ? `${recap(s, w)} ${reason}`
        : id === "idris"
          ? idris()
          : id === "samira"
            ? samira()
            : neighbour(id),
  }));
  s.history.push({
    night: s.night,
    delivered: s.deliveredTonight,
    witness: copy(w),
    route: s.route,
    lanternAtDrop: s.lanternAtDrop,
    exposed,
    talk,
    thanked,
    rescued,
    lines: copy(s.morningLines),
    reason,
  });
  s.phase = "morning";
  s.status = reason;
}
function receiveAid(s: State) {
  if (s.deliveredTonight) return;
  s.deliveredTonight = true;
  // Samira sees Yusuf at her own door even if a neighbour saw him earlier.
  s.directHandoffTonight = s.route === "door";
  if (s.directHandoffTonight)
    perceive(s, "samira", [
      {
        at: required(s.people[2]).now,
        channel: "saw",
        kind: "door-handoff",
        actorId: "yusuf",
        targetId: "samira",
        placeId: "family-home",
        salience: 1,
        summary: "Yusuf handed our envelope to me at our door.",
        claims: [{ prop: "gift-giver:yusuf", value: true, confidence: 1 }],
      },
    ]);
  s.delivered++;
  s.wellPendingTick = null;
  const p = required(s.people[2]);
  interrupt(s, "samira");
  // The host authors the audible knock. HF owns waking at its existing salience gate.
  perceive(s, p.id, [
    {
      at: p.now,
      channel: "heard",
      kind: "knock",
      actorId: s.route === "door" ? "yusuf" : "danyal",
      targetId: p.id,
      near: true,
      salience: 0.9,
      summary:
        s.route === "door"
          ? "A knock announces an envelope at the door."
          : "The well keeper knocks and hands over the labelled envelope.",
    },
  ]);
  perceive(s, p.id, [
    {
      at: p.now,
      channel: "saw",
      kind: "gift-received",
      targetId: "samira",
      placeId: "family-home",
      salience: 1,
      summary:
        "An envelope addressed to Idris and Samira reached the household.",
      claims: [
        { prop: `night-${s.night}:aid-received`, value: true, confidence: 1 },
      ],
    },
  ]);
  s.status =
    s.route === "door"
      ? "Samira takes the envelope at her door. The help remains theirs. Return home."
      : "Danyal collects the envelope and takes it to Samira. The help remains theirs. Return home.";
}
/** Shortest walk home, one tile every four fixed ticks; never teleport or stop time. */
function homewardStep(start: Point): Point {
  const queue = [{ point: start, first: start }];
  const seen = new Set([`${start.x},${start.y}`]);
  for (const { point, first } of queue) {
    if (distance(point, HOME) <= 1) return first;
    for (const [dx, dy] of [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      const key = `${next.x},${next.y}`;
      if (isWall(next.x, next.y) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ point: next, first: first === start ? next : first });
    }
  }
  return start;
}
function deliver(s: State) {
  if (s.envelopePlaced) {
    s.status = s.deliveredTonight
      ? "Tonight’s envelope is delivered. Return to your home."
      : distance(s.player, HOME) <= 1
        ? "You are home. Danyal has not collected the envelope yet; wait for him, then go inside."
        : "Danyal is on his way to collect the envelope. You are walking home; a direction key stops the walk.";
    if (distance(s.player, HOME) > 1) {
      s.returningHome = true;
      s.status =
        "You are walking home. The clock and cold still run. A direction key stops the walk.";
    }
    return;
  }
  const target = s.route === "door" ? DOOR : WELL;
  const marker = s.route === "door" ? "door" : "well";
  if (distance(s.player, target) > 1) {
    s.status =
      Math.abs(s.player.x - target.x) === 1 &&
      Math.abs(s.player.y - target.y) === 1
        ? `You are corner to corner with the ${marker}. That does not count: step onto a highlighted tile, directly next to it.`
        : `Stand on a highlighted tile: the ${marker} itself or directly next to it, not corner to corner. Then leave the envelope.`;
    return;
  }
  s.envelopePlaced = true;
  s.lanternAtDrop = s.player.lantern;
  if (s.route === "well" && wellDelay(s) > 0) {
    s.wellPendingTick = s.nightTick + wellDelay(s);
    const dawn = nightLimit(s) - s.nightTick;
    s.status = `The envelope is in the well box. Danyal collects it in ${wellDelay(s) / 10} seconds${s.exposureNights ? ", once Samira can meet him alone" : ""}.${wellDelay(s) > dawn ? ` Dawn comes in ${Math.ceil(dawn / 10)} seconds, before he can collect it.` : ""} You may start walking home.`;
  } else receiveAid(s);
  if (!s.witness)
    encounter(s, undefined, s.player.lantern ? "leaving" : "empty-handed");
}
function normalized(c: Command): Command {
  if (c.type === "move") {
    if (
      !Number.isInteger(c.dx) ||
      !Number.isInteger(c.dy) ||
      Math.abs(c.dx) + Math.abs(c.dy) !== 1
    )
      throw new Error("Move must be one cardinal tile");
    return { type: "move", dx: c.dx, dy: c.dy };
  }
  if (c.type === "plan" && !["door", "well"].includes(c.route))
    throw new Error("Unknown route");
  if (
    c.type === "recover" &&
    !["explain", "keepquiet", "ask", "joke"].includes(c.choice)
  )
    throw new Error("Unknown recovery");
  if (
    !["move", "plan", "recover", "lantern", "act", "next", "wait"].includes(
      c.type,
    )
  )
    throw new Error("Unknown command");
  return copy(c);
}
/** Mutates and returns the authoritative state. One call is one fixed 10 Hz tick.
 * One tick advances one game second (HF time uses integer milliseconds).
 */
export function step(s: State, command?: Command): State {
  const conversing = s.conversationTicksRemaining > 0;
  if (command) {
    command = normalized(command);
    s.inputs.push({ tick: s.tick, command });
  }
  if (command?.type === "plan" && s.phase === "evening") {
    s.route = command.route;
    startNight(s);
  } else if (command?.type === "next" && s.phase === "morning") {
    if (s.night === 3) {
      closeChapter(s);
      s.phase = "ended";
      const nights = s.history.filter((h) => h.delivered).map((h) => h.night);
      s.outcome =
        nights.length === 3
          ? "The household has food and fuel: your help reached them on all three nights."
          : nights.length === 2
            ? `The household has food and fuel: your help reached them on nights ${nights[0]} and ${nights[1]}, at least two of the three.`
            : `The household received too little help: your help reached them ${nights.length ? `only on night ${nights[0]}` : "on no night"}. They need another source of support.`;
      s.ending =
        s.delivered < 2
          ? "unsupported"
          : s.rescues
            ? "rescued"
            : s.exposureNights >= 2
              ? "exposed"
              : s.talkNights >= 2
                ? "talked"
                : s.thankedNights >= 2
                  ? "thanked"
                  : "sheltered";
      s.outcome +=
        s.exposureNights >= 2
          ? " Repeated exposure made their need village talk. Idris keeps his distance; Samira no longer trusts Yusuf with a private delivery. Future help must be arranged with them directly."
          : s.exposureNights
            ? " On one night the village learned of their need. Idris wanted to choose who knew; Samira now asks Danyal to wait until she can meet him alone."
            : s.talkNights || s.thankedNights
              ? ""
              : " Their need stayed private. Idris keeps his dignity; Samira trusts the quiet arrangement.";
      if (s.thankedNights)
        s.outcome += ` ${s.thankedNights === 1 ? "On one night" : s.thankedNights === 2 ? "On two nights" : "On all three nights"} Yusuf handed the envelope over at their door and no neighbour talked about it. The household knows who helped, and Idris thanked him quietly.`;
      if (s.talkNights)
        s.outcome +=
          s.talkNights >= 2
            ? " Tariq kept telling people his guess. Nobody could confirm it, but the village is guessing about Idris and Samira, and Idris worries what people believe."
            : " Tariq told people his guess once. Nobody could confirm it, and the talk faded.";
      for (const id of s.promised)
        if (!s.history.some((h) => h.witness?.id === id && h.witness.repeat))
          s.outcome += ` ${NAMES[id] ?? id} kept his promise not to tell, but he knows Yusuf has a secret.`;
      s.outcome += s.rescues
        ? ` Yusuf needed ${s.rescues === 1 ? "one rescue" : `${s.rescues} rescues`}. He remains exhausted and owes the neighbours the work they missed bringing him home; he cannot keep making these walks alone.`
        : " Yusuf needed no rescue.";
      s.status = s.outcome;
    } else {
      s.night++;
      s.phase = "evening";
      s.status =
        "Prepare the next envelope. Choose their door or the well box.";
    }
  } else if (s.phase === "night" && command && !conversing) {
    if (command.type === "recover") recover(s, command.choice);
    else if (!s.recoveryPending) {
      if (command.type === "move") {
        s.returningHome = false;
        const p = { x: s.player.x + command.dx, y: s.player.y + command.dy };
        if (!isWall(p.x, p.y)) {
          Object.assign(s.player, p);
          s.hasMoved = true;
        }
      }
      if (command.type === "lantern") s.player.lantern = !s.player.lantern;
      if (command.type === "act") {
        if (s.deliveredTonight && distance(s.player, HOME) <= 1)
          morning(s, "You returned home. The household keeps the help.");
        else deliver(s);
      }
    }
  }
  s.tick++;
  advance(s, s.tick);
  required(s.actors[0]).x = s.player.x;
  required(s.actors[0]).y = s.player.y;
  if (s.phase === "night") {
    if (conversing) s.conversationTicksRemaining--;
    if (s.returningHome && !s.recoveryPending && !conversing) {
      if (distance(s.player, HOME) <= 1) {
        s.returningHome = false;
        if (s.deliveredTonight) {
          morning(s, "You returned home. The household keeps the help.");
          return s;
        } else
          s.status =
            "You are home. Wait for Danyal to collect the envelope, then go inside.";
      } else if (s.nightTick % 4 === 0) {
        Object.assign(s.player, homewardStep(s.player));
        Object.assign(required(s.actors[0]), { x: s.player.x, y: s.player.y });
      }
    }
    if (!s.recoveryPending) s.nightTick++;
    if (!s.recoveryPending && (s.nightTick + s.routineOffset) % 20 === 0) {
      for (const a of s.actors.filter(
        (a) => a.id === "danyal" || a.id === "tariq",
      )) {
        if (a.id === s.witness?.id) continue;
        const outward =
          Math.floor((s.nightTick + s.routineOffset) / 100) % 2 === 0;
        const target = outward
          ? a.routine === "checking the well"
            ? WELL
            : laneTarget(s, a.id)
          : required(STARTS[CAST.findIndex(([id]) => id === a.id)]);
        const candidates = [
          { x: a.x + Math.sign(target.x - a.x), y: a.y },
          { x: a.x, y: a.y + Math.sign(target.y - a.y) },
        ];
        const next = candidates.find(
          (p) => !isWall(p.x, p.y) && distance(p, target) < distance(a, target),
        );
        if (next) Object.assign(a, next);
      }
    }
    if (!s.recoveryPending)
      s.cold += s.player.lantern ? -Math.min(s.cold, 2) : 1;
    if (s.wellPendingTick !== null && s.nightTick >= s.wellPendingTick)
      receiveAid(s);
    // F-1623: no automatic stop at Home. The route changes the sighting area;
    // hiding the lantern leaves actual patrol light and delivery as the triggers.
    const sightingY =
      s.route === "well"
        ? s.player.lantern
          ? 9
          : 7
        : s.player.lantern
          ? 6
          : 4;
    if (
      !s.witness &&
      s.hasMoved &&
      s.nightTick >= 10 &&
      s.player.y <= sightingY
    ) {
      const visible = s.actors.find(
        (a) =>
          a.id === expectedWitness(s) &&
          distance(a, s.player) <= 4 &&
          lit(s, s.player) &&
          los(a, s.player),
      );
      if (visible) encounter(s, visible.id);
    }
    // A sighting or delivery can trigger a witness, never waiting beside Home.
    if (!s.recoveryPending && s.cold >= COLD_LIMIT)
      morning(
        s,
        `The cold forced you to seek shelter. A neighbour missed work to bring you home. You owe that work, and exhaustion shortens later nights.${s.deliveredTonight ? " Tonight’s envelope stays with the household." : s.envelopePlaced ? ` The envelope in the well box never reached them: Danyal needed ${collectionSecondsLeft(s)} more seconds.` : " You had not left the envelope, so nothing reached them."}`,
        true,
      );
    else if (!s.recoveryPending && s.nightTick >= nightLimit(s))
      morning(
        s,
        s.deliveredTonight
          ? "Dawn came before you reached home. Tonight’s envelope stays with the household."
          : s.envelopePlaced
            ? `Dawn came first. Danyal needed ${collectionSecondsLeft(s)} more seconds to collect the envelope from the well box, so it did not reach Idris and Samira.`
            : `Dawn came before you left the envelope, so nothing reached Idris and Samira. ${stepsToTarget(s) === 0 ? `You were at the ${s.route === "door" ? "door" : "well"} but did not leave it.` : `You were ${stepsToTarget(s)} ${stepsToTarget(s) === 1 ? "step" : "steps"} from the ${s.route === "door" ? "door" : "well"}.`}`,
      );
  }
  return s;
}
/** The marker that counts right now: tonight's delivery spot, then Home. */
function activeMarker(s: State): Point | null {
  if (s.phase !== "night") return null;
  if (s.deliveredTonight) return HOME;
  if (s.envelopePlaced) return null;
  return s.route === "door" ? DOOR : WELL;
}
export function projection(s: State) {
  const marker = activeMarker(s);
  return {
    width: WIDTH,
    height: HEIGHT,
    tick: s.tick,
    nightTick: s.nightTick,
    nightLimit: nightLimit(s),
    exposureNights: s.exposureNights,
    talkNights: s.talkNights,
    thankedNights: s.thankedNights,
    rescues: s.rescues,
    ending: s.ending,
    night: s.night,
    phase: s.phase,
    route: s.route,
    player: copy(s.player),
    landmarks: [
      { name: "Yusuf’s home", ...HOME, kind: "home" },
      { name: "Idris and Samira", ...DOOR, kind: "door" },
      { name: "Labelled well box", ...WELL, kind: "well" },
    ],
    tiles: Array.from({ length: WIDTH * HEIGHT }, (_, i) => {
      const x = i % WIDTH,
        y = Math.floor(i / WIDTH);
      return {
        x,
        y,
        wall: isWall(x, y),
        lit: lit(s, { x, y }),
        playerLit:
          s.player.lantern &&
          !isWall(x, y) &&
          distance(s.player, { x, y }) <= 3 &&
          los(s.player, { x, y }),
        label:
          x === DOOR.x && y === DOOR.y
            ? "door"
            : x === WELL.x && y === WELL.y
              ? "well"
              : x === HOME.x && y === HOME.y
                ? "home"
                : "",
        /** The marker tile or one directly next to it: where the action works. */
        target: !!marker && !isWall(x, y) && distance(marker, { x, y }) <= 1,
      };
    }),
    people: s.actors
      .filter((a) => a.id !== "yusuf")
      .map((a) => ({
        ...copy(a),
        name: required(s.people.find((p) => p.id === a.id)).name,
        awake: !required(s.people.find((p) => p.id === a.id)).body.asleep,
      })),
    status: s.status,
    recoveryPending: s.recoveryPending,
    conversationTicksRemaining: s.conversationTicksRemaining,
    witness: s.witness
      ? { id: s.witness.id, fact: s.witness.fact, repeat: s.witness.repeat }
      : null,
    cold: s.cold,
    coldLimit: COLD_LIMIT,
    morningLines: copy(s.morningLines),
    delivered: s.delivered,
    deliveredTonight: s.deliveredTonight,
    deliveryPending: s.wellPendingTick !== null,
    handoffRemaining:
      s.wellPendingTick === null
        ? 0
        : Math.max(0, s.wellPendingTick - s.nightTick),
    assistedWell: s.assistedWell,
    coldWarning:
      s.phase !== "night"
        ? ""
        : s.cold >= 360
          ? "Shaking with cold. Light the lantern now or be carried home."
          : s.cold >= 240
            ? "Hands numb. Light the lantern soon to warm up."
            : s.cold >= 120
              ? "Getting cold. A lit lantern warms you back up."
              : "",
    outcome: s.outcome,
    home: HOME,
    door: DOOR,
    well: WELL,
  };
}
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return (
    "{" +
    Object.keys(v)
      .sort()
      .flatMap((k) => {
        // actorsRun is a complete native export getter. Read it once per hash.
        const value = (v as Record<string, unknown>)[k];
        return value === undefined
          ? []
          : [`${JSON.stringify(k)}:${stable(value)}`];
      })
      .join(",") +
    "}"
  );
}
/** Full authoritative state, including HF Persons, all RNG, history and inputs. */
export function hash(s: State): string {
  const t = stable(s);
  let a = 2166136261,
    b = 0x9e3779b9;
  for (let i = 0; i < t.length; i++) {
    a = Math.imul(a ^ t.charCodeAt(i), 16777619);
    b = Math.imul(b ^ t.charCodeAt(i), 2246822519);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
export function exportRun(s: State): Run {
  return copy({
    schema: "left-hand-run@5",
    engine: s.engine,
    seed: s.seed,
    ticks: s.tick,
    inputs: s.inputs,
    finalHash: hash(s),
    state: s,
  });
}
export function replayRun(run: Run): State {
  if (
    run.schema !== "left-hand-run@5" ||
    run.engine !== FRAMEWORK_VERSION ||
    !Number.isSafeInteger(run.ticks) ||
    run.ticks < 0
  )
    throw new Error(
      "This run uses an unsupported engine or save version. Keep the file and start fresh.",
    );
  verifyArchive(run.state.actorsRun);
  const s = createGame(run.seed, run.state.carryover);
  let cursor = 0;
  for (let t = 0; t < run.ticks; t++) {
    const e = run.inputs[cursor];
    if (e && e.tick < t) throw new Error("Invalid input order");
    step(s, e?.tick === t ? required(run.inputs[cursor++]).command : undefined);
  }
  if (
    cursor !== run.inputs.length ||
    hash(s) !== run.finalHash ||
    hash(run.state) !== run.finalHash
  )
    throw new Error("Replay hash mismatch");
  return s;
}
