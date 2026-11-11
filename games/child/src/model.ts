import type { Run as HumanRun } from "@adam0white/human-framework";
import * as HF from "./hf.ts";

type Traits = HF.Traits;
type MethodCue = HF.Cue;
export const practices = ["count", "look", "wait", "refuse"] as const;
export type Practice = (typeof practices)[number];
export type Input =
  | { type: "teach"; practice: Practice }
  | { type: "work" }
  | { type: "crisis" }
  | { type: "reveal" }
  | { type: "arrange"; practice: Practice };
export type Phase = "prepare" | "movement" | "aftermath" | "ending";
export interface Conditions {
  available: boolean;
  flood: boolean;
  seep: boolean;
  pressure: boolean;
  variant: number;
  carriersFed: boolean;
}
export interface Outcome {
  age: number;
  action: string;
  success: boolean;
  line: string;
  cost: string;
  movement: string;
  memory: string;
}
export interface Game {
  edition: 6;
  seed: number;
  slice: boolean;
  chapter: number;
  age: number;
  phase: Phase;
  preparations: number;
  food: number;
  waterReserve: number;
  repairs: number;
  routeKnown: boolean;
  run: HumanRun;
  completedEpisodes: HF.NativeArchive[];
  readonly child: ReturnType<typeof HF.actor>;
  losses: {
    person: string;
    at: number;
    firstChapter: number;
    evidence: HF.NativeEvents[number][];
  }[];
  inputs: Input[];
  conditions: Conditions;
  outcome: Outcome | null;
  history: Outcome[];
  lastLesson: string;
  rememberedLessons: Partial<Record<Practice, string>>;
  months: number;
}
export const teachers: Record<Practice, string> = {
  count: "Maryam",
  look: "Yusuf",
  wait: "Danyal",
  refuse: "Zehra",
};
const YEAR = HF.YEAR;
const cueFor: Record<Practice, MethodCue> = {
  count: { cue: "supply", value: "scarce" },
  look: { cue: "route", value: "uncertain" },
  wait: { cue: "keeper", value: "needed" },
  refuse: { cue: "pressure", value: "repeated" },
};
const baselineTraits: Traits = {
  honesty: 0.5,
  emotionality: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  conscientiousness: 0.5,
  openness: 0.5,
};
const profiles: Record<string, Traits> = {
  Zehra: { ...baselineTraits },
  Yusuf: {
    honesty: 0.75,
    emotionality: 0.4,
    extraversion: 0.5,
    agreeableness: 0.6,
    conscientiousness: 0.85,
    openness: 0.5,
  },
  Maryam: {
    honesty: 0.8,
    emotionality: 0.6,
    extraversion: 0.6,
    agreeableness: 0.8,
    conscientiousness: 0.8,
    openness: 0.4,
  },
  Danyal: {
    honesty: 0.9,
    emotionality: 0.4,
    extraversion: 0.4,
    agreeableness: 0.7,
    conscientiousness: 0.8,
    openness: 0.5,
  },
  Tariq: {
    honesty: 0.6,
    emotionality: 0.3,
    extraversion: 0.7,
    agreeableness: 0.6,
    conscientiousness: 0.5,
    openness: 0.7,
  },
};
export function createGame(seed = 21, slice = false): Game {
  const age = slice ? 6 : 3;
  const run = HF.opening(
    seed,
    slice,
    profiles,
    baselineTraits,
    practices.map((id) => ({ id, action: id, conditions: [cueFor[id]] })),
  );
  const g: Game = {
    edition: 6,
    seed,
    slice,
    chapter: 0,
    age,
    phase: "prepare",
    preparations: 0,
    food: 9,
    waterReserve: 2,
    repairs: 7,
    routeKnown: false,
    run,
    completedEpisodes: [],
    get child() {
      return HF.actor(this.run, "elif");
    },
    losses: [],
    inputs: [],
    conditions: {
      variant: 0,
      carriersFed: true,
      available: false,
      flood: false,
      seep: false,
      pressure: true,
    },
    outcome: null,
    history: [],
    lastLesson: slice
      ? "You are Zehra. Elif watches the work you choose. Her father Yusuf checks paths, old Maryam counts shares, and Danyal keeps the village well."
      : "You are Zehra. Your daughter Elif copies the work she sees. Her father Yusuf checks paths, old Maryam counts shares, and Danyal keeps the village well.",
    months: 0,
    rememberedLessons: {},
  };
  refresh(g);
  return g;
}
function refresh(g: Game) {
  g.conditions = {
    variant: (g.seed + g.chapter + Math.max(0, 5 - g.repairs)) % 3,
    available:
      HF.isAlive(g.run, "Danyal") &&
      ((g.age === 18 &&
        (g.food < 5 ||
          (g.seed + g.chapter + Math.max(0, 5 - g.repairs)) % 3 === 1) &&
        g.repairs >= 3 &&
        (g.seed + g.chapter) % 3 !== 0) ||
        (g.seed + g.chapter + Math.max(0, 4 - g.repairs)) % 3 !== 0),
    flood: (g.seed + g.chapter) % 2 === 1,
    seep: g.repairs >= 3 && (g.seed + g.chapter) % 3 !== 0,
    carriersFed: g.food >= 5,
    pressure: true,
  };
}
export function teacherAvailable(g: Game, practice: Practice): boolean {
  return HF.isAlive(g.run, teachers[practice]);
}
function teach(g: Game, practice: Practice, id: string) {
  if (!teacherAvailable(g, practice))
    throw Error(
      `${teachers[practice]} has died. Choose a living companion. Her earlier lessons remain.`,
    );
  if (!g.child.body.alive)
    throw Error("Elif has died. Her yearbook keeps what happened.");
  const cues = [cueFor[practice]];
  const at = HF.nextIngressAt(g.run);
  HF.serve(
    g.run,
    at,
    [
      HF.input(
        g.run,
        `${id}:0-cues`,
        "method.cues",
        {
          person: "elif",
          evidenceId: `${id}:cues`,
          contextId: "work",
          cues,
        },
        at,
      ),
      HF.input(
        g.run,
        `${id}:1-demonstration`,
        "method.demonstrated",
        {
          person: "elif",
          evidenceId: `${id}:evidence`,
          demonstrationId: id,
          methodId: practice,
          contextId: "work",
          conditions: cues,
          action: practice,
          teacher: teachers[practice],
          receivedAttention: 1,
          outcome: "success",
        },
        at,
      ),
      HF.input(
        g.run,
        `${id}:2-contact`,
        "social.received",
        {
          person: "elif",
          evidenceId: `${id}:contact`,
          other: teachers[practice],
          event: { kind: "shared-work", byMe: false, magnitude: 0.5 },
        },
        at,
      ),
      HF.input(
        g.run,
        `${id}:3-left`,
        "method.context-left",
        {
          person: "elif",
          contextId: "work",
        },
        at,
      ),
    ],
    (events) => recordLosses(g, events),
  );
}
export const lessonLines: Record<Practice, string[]> = {
  count: [
    "Maryam sets aside a jar for each house. Elif moves the empty cups into a row.",
    "Elif counts the filled jars again before Maryam shares the last one.",
    "Maryam divides the grain. Elif leaves a small pile beside each bowl.",
  ],
  look: [
    "Yusuf checks the upper path before carrying water. Elif follows his footprints.",
    "Elif stops beside Yusuf and checks whether the path stones are dry.",
    "Yusuf lifts a loose cover. Elif leans down to see the water beneath it.",
  ],
  wait: [
    "Danyal tells a neighbour to wait for him before opening the heavy gate. Elif sits and waits too.",
    "Elif puts down her jar where Danyal puts his. They wait for the well to clear.",
    "Danyal asks who is on duty before anyone lifts the rope. Elif waits for him before she touches it.",
  ],
  refuse: [
    "You keep the evening jar when a neighbour asks again. Elif places her hand across its lid.",
    "You say the household needs this grain. Elif pulls its bowl back from the edge.",
    "A neighbour pushes forward. You hold your place. Elif stands beside your elbow.",
  ],
};
const lessonMemories: Record<Practice, string[]> = {
  count: [
    "Maryam set a jar aside for each house.",
    "Maryam counted the filled jars again before sharing.",
    "Maryam left a pile of grain beside each bowl.",
  ],
  look: [
    "Yusuf checked the upper path before carrying water.",
    "Yusuf touched the stones to check whether they were dry.",
    "Yusuf lifted a cover to check the water beneath it.",
  ],
  wait: [
    "Danyal made us wait for him before opening the gate.",
    "Danyal put his jar down and waited for the well to clear.",
    "Danyal asked who was on duty before lifting the rope.",
  ],
  refuse: [
    "Mother kept the evening jar when a neighbour asked again.",
    "Mother kept a bowl of grain back for home.",
    "Mother held her place when a neighbour pushed forward.",
  ],
};
export function step(g: Game, input: Input): void {
  if (
    g.phase === "prepare" &&
    (input.type === "teach" || input.type === "work") &&
    g.preparations < 3
  ) {
    if (input.type === "teach") {
      teach(g, input.practice, `scene-${g.chapter}-${g.preparations}`);
      const base = (
        lessonLines[input.practice][g.preparations % 3] ?? ""
      ).replace(
        "Elif stands beside your elbow.",
        g.age >= 14
          ? "Elif helps you hold the place for the waiting households."
          : "Elif stands beside you.",
      );
      g.rememberedLessons[input.practice] =
        lessonMemories[input.practice][g.preparations % 3] ?? "";
      const growing: Record<number, string[]> = {
        3: [
          "Elif reaches for the smallest cup.",
          "She copies each movement she sees.",
          "She carries a jar against her chest.",
        ],
        6: [
          "Elif tries the task without a hand on her shoulder.",
          "She checks her own work before looking up.",
          "She takes the first steps home alone.",
        ],
        10: [
          HF.isAlive(g.run, "Tariq")
            ? "Elif shows her half-brother Tariq what she noticed."
            : "Elif checks what she noticed by herself.",
          "She asks who will be on duty tomorrow.",
          "She makes room for another child beside her.",
        ],
        14: [
          "Elif takes over the last part of the task.",
          "She works out what the waiting families need.",
          "She leaves the next household a clear place.",
        ],
        18: [
          "Elif watches the queue so the work can go on.",
          "She puts a spare jar beside the well.",
          "She checks who has yet to receive water.",
        ],
      };
      g.lastLesson = `${base} ${growing[g.age]?.[g.preparations] ?? ""}`;
      if (input.practice === "count" || input.practice === "refuse")
        g.food -= 2;
      if (input.practice === "look") {
        g.food -= 1;
        g.routeKnown = true;
      }
      if (input.practice === "wait") g.repairs -= 2;
    } else {
      g.food += 2;
      g.repairs += 1;
      g.lastLesson =
        g.age >= 10
          ? "You work in the field. Elif practises alone by the well. No adult shows her a new way today."
          : "You work in the field. Elif plays with an empty jar. No adult shows her a new way today.";
    }
    g.food = Math.max(0, Math.min(12, g.food));
    g.repairs = Math.max(0, Math.min(10, g.repairs));
    g.preparations++;
  } else if (
    input.type === "crisis" &&
    g.phase === "prepare" &&
    g.preparations === 3
  ) {
    resolve(g);
    if (g.child.body.alive) g.phase = "movement";
  } else if (input.type === "reveal" && g.phase === "movement") {
    g.phase = "aftermath";
    if (g.outcome) g.history.push({ ...g.outcome });
  } else if (input.type === "arrange" && g.phase === "aftermath") {
    if (g.slice || g.chapter === 4) g.phase = "ending";
    else nextChapter(g, input.practice);
  } else throw Error("That choice is not available now.");
  g.inputs.push({ ...input });
  // Host resources and presentation are separate from actor faculties. The public
  // world route records their revision for native/host export reconciliation.
  HF.publish(
    g.run,
    () => JSON.parse(JSON.stringify(hostState(g))),
    `host:${g.inputs.length}`,
    (events) => recordLosses(g, events),
  );
}
function resolve(g: Game) {
  // Elif receives what a child can see, not which method will work: water is
  // always short, the path always uncertain and someone always asks again. Only
  // Danyal's presence is visible. Which held method she uses therefore depends
  // on how often and how recently she watched it, so a scattered upbringing
  // gives her several equally familiar ways and no reason to pick the right one.
  const cues: MethodCue[] = [
    { cue: "supply", value: "scarce" },
    { cue: "route", value: "uncertain" },
    {
      cue: "keeper",
      value:
        g.conditions.available && g.age !== 14 && g.age !== 3
          ? "needed"
          : "away",
    },
    { cue: "pressure", value: "repeated" },
    {
      cue: "availability",
      value: g.conditions.available ? "present" : "absent",
    },
  ];
  HF.serve(
    g.run,
    HF.nextIngressAt(g.run),
    [
      HF.input(g.run, `crisis:${g.chapter}:cues`, "method.cues", {
        person: "elif",
        evidenceId: `crisis:${g.chapter}:cues`,
        contextId: "crisis",
        cues,
      }),
    ],
    (events) => recordLosses(g, events),
  );
  const heldMethods = HF.heldMethods(g.run);
  const held = practices.filter((a) => heldMethods.some((r) => r.action === a));
  const candidates = held.length ? held : ["try"];
  const conditional = HF.conditionalMethodEvidence(
    g.run,
    candidates,
    `crisis:${g.chapter}`,
  );
  const matching = held.filter((a) =>
    conditional.evidence.some(
      (entry) => entry.action === a && entry.evidence.support > 0,
    ),
  );
  // She uses the way she has watched most, counting the task that stayed with
  // her between chapters. Two ways watched equally often give her nothing to
  // prefer; the margin only absorbs evidence decay, since lessons in one chapter
  // share a minute.
  const ranked = matching
    .map((a) => ({
      a,
      s:
        conditional.evidence.find((entry) => entry.action === a)?.evidence
          .support ?? 0,
    }))
    .sort((x, y) => y.s - x.s || (x.a < y.a ? -1 : 1));
  const [first, second] = ranked;
  // All methods inside the existing tie margin are equally familiar here.
  // Name them in stable order so millisecond ingress does not change the account.
  const torn =
    first && second && first.s - second.s < 0.01
      ? ranked
          .filter((entry) => first.s - entry.s < 0.01)
          .map((entry) => entry.a)
          .sort()
          .slice(0, 2)
      : null;
  const result = torn
    ? null
    : HF.decide(g.run, candidates, `crisis:${g.chapter}`, (events) =>
        recordLosses(g, events),
      );
  // Alternatives close at acceptance. Method context ends only when the
  // attempt has actually ended, or this scene exits without an attempt.
  HF.serve(
    g.run,
    HF.nextIngressAt(g.run),
    [
      HF.input(g.run, `crisis:${g.chapter}:left`, "method.context-left", {
        person: "elif",
        contextId: "crisis",
      }),
    ],
    (events) => recordLosses(g, events),
  );
  if (!g.child.body.alive || result?.status === "dead") {
    g.phase = "ending";
    g.outcome = null;
    g.lastLesson = "Elif has died. Her yearbook keeps the days she lived.";
    return;
  }
  const action = torn
    ? "freeze"
    : result?.status === "completed"
      ? result.action
      : (result?.status ?? "no-choice");
  let success = false;
  let line = "";
  let cost = "The household comes home short tonight.";
  let movement = "Elif stops between the path and the well.";
  // Completed methods keep the original physical table. Freeze retains its
  // authored shortfall branch; interruption/no choice earns no completed work.
  if (torn || result?.status === "completed") {
    if (g.age === 6 && action === "look") {
      success = true;
      line = "I checked the stones above the water. The upper path was dry.";
      cost = "The longer walk leaves the field work unfinished.";
      movement =
        "Elif walks uphill, tests the stones, then carries her jar home.";
      g.food -= 1;
    }
    if (g.age === 6 && action === "count") {
      success = true;
      line = "I took the small jars. I could carry them on the safe path.";
      cost = "The extra trips wear the well rope.";
      movement =
        "Elif lines up small jars and carries them home one at a time.";
      g.repairs -= 1;
    }
    if (g.age === 6 && action === "wait") {
      success = g.conditions.available;
      line = success
        ? "I found Danyal on duty. We brought the jars together."
        : "I waited where Danyal waits. Nobody came before dusk.";
      cost = success
        ? "Danyal leaves the well repairs until tomorrow."
        : "The household comes home short tonight.";
      movement =
        "Elif sits beside the well, then returns with " +
        (success ? "a full jar." : "an almost empty jar.");
      if (success) g.repairs -= 2;
    }
    if (g.age === 6 && action === "refuse") {
      line = g.conditions.flood
        ? "I kept clear of the flooded path. Our jar was still empty at dusk."
        : "I kept our jar at home. It was still empty at dusk.";
      movement = "Elif holds her arm across the lower path and stays at home.";
    }
    if (g.age !== 6) {
      const variant = g.conditions.variant;
      const table: Record<
        number,
        Partial<Record<string, [boolean, string, string, string]>>
      > = {
        3: {
          count: [
            true,
            "I left one cup for each house and kept our evening jar.",
            HF.isAlive(g.run, "Maryam")
              ? "Maryam misses the meal work while the sharing takes time."
              : "The sharing takes time before Elif brings our jar home.",
            "Elif counts the cups, then carries one jar into the house.",
          ],
          refuse: [
            true,
            "I put my hand on the lid. We needed that jar for supper.",
            "The neighbour must wait for the morning water.",
            "Elif stands beside the jar with her arm across its lid.",
          ],
          look: [
            !g.conditions.flood,
            "I went to see whether the neighbour had another jar.",
            g.conditions.flood
              ? "The path was wet. The household comes home short."
              : "The walk costs an afternoon of field work.",
            "Elif follows the path to the neighbour, then turns toward home.",
          ],
        },
        10: {
          count: [
            variant !== 1,
            "I counted the households and set out their places.",
            variant === 1
              ? "The older children ignore the places. Our household loses its turn."
              : "The waiting children need food from our stores.",
            "Elif lines up jars at the well.",
          ],
          look: [
            variant === 1,
            "I checked the side entrance before joining the queue.",
            variant === 1
              ? "The side path works, but its gate needs repair."
              : "Both entrances join the same crowded queue. We lose our turn.",
            "Elif walks around the queue and checks the side gate.",
          ],
          refuse: [
            true,
            "I stayed in our place when the older children pushed past.",
            "The older children leave angry. Tomorrow the queue will need help.",
            "Elif holds her arm across the queue.",
          ],
          wait: [
            g.conditions.available,
            g.conditions.available
              ? "Danyal saw whose jars were already waiting."
              : "I waited for Danyal. Our turn passed while he was away.",
            g.conditions.available
              ? "Danyal delays his repair work to settle the queue."
              : "The household comes home short.",
            "Elif waits beside the well while the queue moves.",
          ],
        },
        14: {
          count: [
            true,
            "I measured a smaller share for every household.",
            "Our meals will be thin until spring.",
            "Elif divides the jars into equal groups.",
          ],
          look: [
            g.conditions.seep,
            "I checked the store beyond the upper path.",
            g.conditions.seep
              ? "The stored water supplies everyone. Moving it delays well repairs."
              : "The upper store is empty. The sharing leaves our household short.",
            "Elif takes the upper path to the water store.",
          ],
          refuse: [
            !g.conditions.seep,
            "I held back the last jars until the missing families arrived.",
            !g.conditions.seep
              ? "Nobody goes without, but the queue waits into the cold."
              : "The upper stored water was needed. Some neighbours miss their share.",
            "Elif guards the remaining jars with an outstretched arm.",
          ],
        },
        18: {
          count: [
            !g.conditions.seep ||
              (g.conditions.carriersFed && g.conditions.variant !== 1),
            "I counted the waiting houses and divided our stored water between them.",
            !g.conditions.seep ||
            (g.conditions.carriersFed && g.conditions.variant !== 1)
              ? "Everyone has water. Our household gives up its stored water."
              : g.conditions.carriersFed
                ? "Our household’s own water store was empty. There was nothing to divide. The last households go without."
                : "The carriers had missed meals. Dividing the water at the well left too many trips before night. The last households go without.",
            "Elif counts the jars and carries a share to every house.",
          ],
          look: [
            g.conditions.seep,
            "I checked the upper spring before carrying the jars.",
            g.conditions.seep
              ? "Everyone has water. The path needs days of repair."
              : "The spring is dry. The last households go without.",
            "Elif follows the upper path and carries water down to the houses.",
          ],
          refuse: [
            !g.conditions.seep,
            "I held the queue and stopped people taking a second jar.",
            g.conditions.seep
              ? "The well alone cannot fill every jar. The upper spring was needed. The last households go without."
              : "Everyone has water, but the neighbours wait into the night.",
            "Elif stands across the queue, then lets each household through.",
          ],
          wait: [
            g.conditions.available,
            g.conditions.available
              ? "Danyal and I kept each household in its turn."
              : "Danyal was away. I kept waiting while the queue emptied the well.",
            g.conditions.available
              ? "Everyone has water. Danyal cannot repair the well today."
              : "The last households go without.",
            "Elif waits by the well, then walks along the queue.",
          ],
        },
      };
      const row = table[g.age]?.[action];
      success = row?.[0] ?? false;
      line = row?.[1] ?? "";
      cost =
        row?.[2] ??
        (g.age === 18
          ? "The last households go without water before night."
          : "The household comes home short.");
      movement =
        row?.[3] ??
        {
          3: "Elif stands beside the evening jar and looks from one way to the other.",
          10: "Elif stops between the queue and the side gate.",
          14: "Elif stands between the jars and does not begin the sharing.",
        }[g.age] ??
        "Elif stops between the path and the well.";
      if (success) {
        if (action === "count" || action === "refuse") g.food -= 2;
        else g.repairs -= 2;
      }
    }
  }
  if (g.age < 18 && !success) {
    if (g.waterReserve > 0) {
      g.waterReserve--;
      cost +=
        " One emergency household share of stored water covers today's missing water.";
    } else {
      cost +=
        " The emergency store is empty. There is no stored water left to cover today's shortfall.";
    }
  }
  if (g.age === 18 && g.waterReserve === 0) {
    success = false;
    cost =
      "The emergency store is empty. The last households need stored water while the carriers return. They have no water before night. " +
      reserveHistory(g);
  } else if (g.age === 18 && success) {
    g.waterReserve--;
    cost +=
      " One emergency household share supplies the last households while the carriers return.";
  }
  if (!success) g.food -= 3;
  const tornNames = (torn ?? []).map((p) =>
    p === "refuse" ? "Mother" : teachers[p as Practice],
  );
  if (action === "try") {
    line = "I had no way I knew to try. I came home short.";
  } else if (action === "freeze") {
    line = `I remembered ${tornNames.join("’s way and ")}’s way, watched just as often. I could not choose between them. I came home short.`;
  } else if (!matching.includes(action as Practice)) {
    const source =
      teachers[action as Practice] === "Zehra"
        ? "Mother"
        : teachers[action as Practice];
    line = `I tried ${source}’s way. It did not fit today. ${success ? "I found a way to finish." : "I came home short."}`;
  }
  if (g.age === 18 && g.waterReserve === 0 && !success)
    line += " We could not finish the last deliveries before night.";
  if (g.age === 18 && !success) {
    if (action === "count")
      line =
        "I tried Maryam’s way and counted the waiting houses. There was not enough water for the last deliveries.";
    const incomplete: Record<string, string> = {
      count: "Elif counts the waiting households",
      look: "Elif checks the upper spring",
      wait: "Elif waits by the well",
      refuse: "Elif holds the queue",
      freeze: "Elif stops between the path and the well",
      try: "Elif stands beside the unfilled jars",
    };
    movement = `${incomplete[action] ?? "Elif returns to the well"}; the last households still wait.`;
  }
  if (action === "interrupted" || action === "no-choice") {
    line =
      action === "interrupted"
        ? "I began, but I could not finish. We came home short."
        : "I did not begin the task. We came home short.";
    movement =
      action === "interrupted"
        ? "Elif stops before the water task is finished."
        : "Elif stays beside the unfilled jars.";
  }
  g.food = Math.max(0, Math.min(12, g.food));
  g.repairs = Math.max(0, Math.min(10, g.repairs));
  if (g.food === 0)
    cost += " Our food stores are empty. There is no supper tonight.";
  if (g.repairs === 0)
    cost += " The well rope is frayed. It needs repair before the next season.";
  const remembered = g.rememberedLessons[action as Practice];
  const memory = remembered
    ? `${remembered} ${line} ${success ? "That was enough today." : "That was not enough today."}`
    : action === "freeze" || action === "interrupted" || action === "no-choice"
      ? line
      : "I had watched nobody work through this task. I did not know where to begin. We came home short.";
  g.outcome = { age: g.age, action, success, line, cost, movement, memory };
}
/** Calendar targets come from the authored chapter boundary, never the live
 * ingress timestamp. This is a target for HF's one clock, not an aging loop. */
export function chapterMonthAt(
  age: number,
  next: number,
  month: number,
  openingAge = 3,
): number {
  const start = Math.ceil(((age - openingAge) * YEAR) / HF.DAY) * HF.DAY;
  const months = (next - age) * 12;
  return (
    Math.ceil((start + ((next - age) * YEAR * month) / months) / HF.DAY) *
    HF.DAY
  );
}
function nextChapter(g: Game, practice: Practice) {
  const ages = [3, 6, 10, 14, 18];
  const next = ages[g.chapter + 1];
  if (next === undefined) throw Error("No later chapter.");
  const months = (next - g.age) * 12;
  // The intervening years are a narrated time skip. Each visible chapter has
  // its own native run; the export retains every completed episode verbatim.
  g.completedEpisodes.push(HF.nativeExport(g.run));
  g.run = HF.opening(
    g.seed + g.chapter + 1,
    false,
    profiles,
    baselineTraits,
    practices.map((id) => ({ id, action: id, conditions: [cueFor[id]] })),
    next,
  );
  // A fresh episode does not resurrect a person whose death was recorded.
  // Reassert that host-observed fact through the public lifecycle route.
  for (const loss of g.losses) {
    const at = HF.nextIngressAt(g.run);
    const id = `chapter:${g.chapter + 1}:prior-death:${loss.person}`;
    HF.serve(
      g.run,
      at,
      [
        HF.input(
          g.run,
          id,
          "lifecycle.received",
          {
            type: "death",
            person: { kind: "actor", id: loss.person },
            basis: {
              evidence: {
                kind: "evidence",
                id: `${id}:${loss.evidence[0]?.id}`,
              },
              worldRevision: HF.current(g.run).world.revision,
            },
          },
          at,
        ),
      ],
      () => {},
    );
  }
  g.months += months;
  if (teacherAvailable(g, practice)) {
    teach(g, practice, `chapter-opening-${g.chapter + 1}`);
    g.rememberedLessons[practice] =
      `At the start of this chapter, I watched ${practice === "refuse" ? "my mother" : teachers[practice]} demonstrate ${practice}.`;
  }

  g.food = Math.max(
    0,
    Math.min(
      12,
      g.food +
        6 -
        (practice === "count" || practice === "refuse"
          ? 3
          : practice === "look"
            ? 1
            : 0),
    ),
  );
  g.repairs = Math.max(
    0,
    Math.min(10, g.repairs + 4 - (practice === "wait" ? 3 : 0)),
  );
  if (practice === "look") g.routeKnown = true;
  g.chapter++;
  g.age = next;
  g.phase = "prepare";
  g.preparations = 0;
  g.outcome = null;
  g.lastLesson = `Years pass between chapters. Elif is ${next} now. ${practice === "refuse" ? "You show" : `${teachers[practice]} shows`} her one task before the next three afternoons.`;
  if (!teacherAvailable(g, practice))
    g.lastLesson = `${teachers[practice]} has died. Nobody gives a fresh lesson in that person's name. She is ${next} now.`;
  refresh(g);
}
/** Observe actual live step results before any subsequent host work. Retained
 * evidence is detached from both the native event window and the caller. */
export function recordLosses(g: Game, events: HF.NativeEvents): void {
  for (const event of events) {
    const person =
      event.data.kind === "body-change" && event.data.change.kind === "died"
        ? event.person
        : event.data.kind === "lifecycle" &&
            event.data.receipt.type === "death" &&
            event.data.receipt.person.kind === "actor"
          ? event.data.receipt.person.id
          : undefined;
    if (!person) continue;
    let loss = g.losses.find((entry) => entry.person === person);
    if (!loss) {
      loss = {
        person,
        at: event.at,
        firstChapter: g.chapter + 1,
        evidence: [],
      };
      g.losses.push(loss);
    }
    loss.at = Math.min(loss.at, event.at);
    if (!loss.evidence.some((retained) => retained.id === event.id))
      loss.evidence.push(structuredClone(event));
  }
}
export const chapterGoals: Record<number, string> = {
  3: "Keep the household’s evening jar of water at home.",
  6: "Bring the household water home.",
  10: "Keep the household’s place in the queue.",
  14: "Divide the winter store so nobody goes without.",
  18: "Bring water to every waiting household by night.",
};
function reserveHistory(g: Game): string {
  return g.history
    .filter((outcome) => !outcome.success)
    .map((outcome) => {
      if (outcome.action === "interrupted")
        return `At ${outcome.age}, Elif began the water task but could not finish and came home short.`;
      if (outcome.action === "no-choice")
        return `At ${outcome.age}, Elif did not begin the water task and came home short.`;
      const source = teachers[outcome.action as Practice];
      return `At ${outcome.age}, ${source ? `Elif tried ${source === "Zehra" ? "Mother" : source}’s way` : outcome.action === "freeze" ? "Elif was torn between two ways she had watched equally often" : "Elif had no workable plan"} and came home short.`;
    })
    .join(" ");
}
export function endingReason(g: Game): string {
  return g.outcome ? `${g.outcome.memory} ${g.outcome.cost}` : "";
}
export function conditionsText(g: Game): string {
  const variant = g.conditions.variant;
  const physical =
    g.age === 3
      ? "A neighbour has asked for the evening jar again."
      : g.age === 6
        ? g.conditions.flood
          ? "The lower path is flooded. The upper stones are dry."
          : "The lower path is dry. Smaller jars can cross safely."
        : g.age === 10
          ? variant === 1
            ? "The older children ignore the marked places. The side gate is open."
            : "The older children respect a marked place. The side gate is locked."
          : g.age === 14
            ? g.conditions.seep
              ? "The upper store still has water."
              : "The upper store is empty. Some families arrive late."
            : g.conditions.seep
              ? "Water still flows from the upper spring. The well alone cannot fill every household’s jar."
              : "The upper spring is dry. The well can fill smaller shares if nobody takes a second jar.";
  const danyal = !HF.isAlive(g.run, "Danyal")
    ? g.rememberedLessons.wait
      ? "Danyal has died. Her yearbook records the work she watched him do."
      : "Danyal has died. He cannot be on duty or teach her a new task."
    : g.conditions.available
      ? "Danyal will be on duty when she goes alone."
      : "Danyal will be away when she goes alone.";
  const householdStore =
    g.age === 18 && g.conditions.seep && g.conditions.variant === 1
      ? "The household’s own water store is empty. It is separate from the emergency store."
      : "";
  const finalHint =
    g.age === 18 &&
    g.conditions.seep &&
    (g.conditions.variant === 1 || !g.conditions.carriersFed)
      ? HF.isAlive(g.run, "Danyal") && g.conditions.available
        ? "Counting shares at the well alone will not reach the last households; she needs to inspect the spring or work with Danyal."
        : "Counting shares at the well alone will not reach the last households; she needs to inspect the spring."
      : "";
  const carriers =
    g.age === 18
      ? g.conditions.carriersFed
        ? "In earlier years food was set aside for the carriers. They can make extra trips if there is stored water to share."
        : "In earlier years the carriers missed meals, so they cannot make many extra trips."
      : "";
  return [
    ...g.losses
      .filter((loss) => loss.person !== "Danyal")
      .map(
        (loss) =>
          `${loss.person === "elif" ? "Elif" : loss.person} has died. Her yearbook keeps the days she lived.`,
      ),
    physical,
    `The emergency store has ${g.waterReserve} household ${g.waterReserve === 1 ? "share" : "shares"} left.`,
    g.age === 18
      ? "The last households need one stored household share while the carriers return. Without it, the last deliveries cannot arrive before night."
      : "A shortfall spends one emergency household share if any remain. Nothing refills this emergency store.",
    danyal,
    carriers,
    householdStore,
    finalHint,
  ]
    .filter(Boolean)
    .join(" ");
}
export interface Run {
  game: "child";
  edition: 6;
  engine: "4.17.0";
  seed: number;
  slice: boolean;
  inputs: Input[];
  state: HostState;
  native: HF.NativeArchive;
  episodes: HF.NativeArchive[];
  finalHash: string;
}
export type HostState = Omit<Game, "run" | "child" | "completedEpisodes">;
export function hostState(g: Game): HostState {
  const { run: _run, child: _child, completedEpisodes: _episodes, ...host } = g;
  return structuredClone(host);
}
export function hash(value: unknown): string {
  const g = value as Partial<Game> | null;
  const data =
    g && typeof g === "object" && g.run
      ? {
          host: hostState(g as Game),
          native: HF.nativeExport(g.run),
          episodes: g.completedEpisodes,
        }
      : value;
  let h = 2166136261;
  const s = JSON.stringify(data);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function exportRun(g: Game): Run {
  const state = hostState(g);
  const native = HF.nativeExport(g.run);
  if (
    g.inputs.length > 0 &&
    !HF.sameJson(native.current.world.hostState, state)
  )
    throw Error(
      "Child exported host state differs from the native publication.",
    );
  return {
    game: "child",
    edition: 6,
    engine: "4.17.0",
    seed: g.seed,
    slice: g.slice,
    inputs: structuredClone(g.inputs),
    state,
    native,
    episodes: structuredClone(g.completedEpisodes),
    finalHash: hash({ host: state, native, episodes: g.completedEpisodes }),
  };
}
const FRESH =
  "This save needs its original game version. Start a fresh upbringing.";
function admitted(run: Run) {
  if (
    run?.game !== "child" ||
    run.edition !== 6 ||
    run.engine !== "4.17.0" ||
    !Number.isSafeInteger(run.seed) ||
    typeof run.slice !== "boolean" ||
    !Array.isArray(run.inputs) ||
    run.inputs.length > 1000 ||
    !run.native ||
    !Array.isArray(run.episodes) ||
    run.episodes.length > 4
  )
    throw Error(FRESH);
  if (
    hash({ host: run.state, native: run.native, episodes: run.episodes }) !==
    run.finalHash
  )
    throw Error("This run does not match its saved result.");
}
/** Import is exact whole-host replay; retained-person admission is a separate stage. */
export function replay(run: Run): Game {
  admitted(run);
  for (const episode of run.episodes) {
    const verified = HF.need(HF.nativeReplay(episode));
    if (!verified.verified)
      throw Error("HF could not verify an earlier chapter.");
  }
  const result = HF.nativeReplay(run.native);
  if (!result.ok && result.error.code === "unsupported-archive")
    throw Error(FRESH);
  const native = HF.need(result);
  if (!native.verified) throw Error("HF could not verify this run.");
  const g = createGame(run.seed, run.slice);
  for (const input of run.inputs) step(g, input);
  const expected = exportRun(g);
  if (JSON.stringify(expected) !== JSON.stringify(run))
    throw Error("This run does not match its saved result.");
  return g;
}
/** Replay already validates the native archive and reconstructs the complete host.
 * Keep that exact reconstructed Run rather than executing its native history a third time. */
export function restore(run: Run): Game {
  return replay(run);
}
