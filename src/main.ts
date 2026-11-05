import {
  claimLabNotice,
  createLab,
  gameNavigation,
  PRIVACY_URL,
} from "@adam0white/lab-client";
import { debugFooter } from "@adam0white/lab-kit";
import { eveningAccounts } from "./actors.ts";
import {
  type Command,
  canAsk,
  createGame,
  exportRun,
  hash,
  projection,
  type Run,
  replayRun,
  step,
  upcomingWellSeconds,
} from "./host";
import {
  channel,
  checkpoint,
  freshSession,
  loadSession,
  type Session,
  saveSession,
} from "./shelf";
import { advanceGuide, type GuideState } from "./tutorial.ts";
import "./style.css";

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing ${id}`);
  return node as T;
};
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app");
app.innerHTML = `<main>
<header><div><small>THREE WINTER NIGHTS</small><h1>The Left Hand</h1></div><button id="menu-open" aria-expanded="false" aria-controls="menu">Menu</button></header>
<p id="recording-notice" class="notice" hidden>Play is recorded and linked across the Lab by default. <button id="notice-off">Turn recording off</button> · <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy</a><button id="notice-close" aria-label="Dismiss recording notice">×</button></p>
<p id="chapter" class="chapter"></p><p id="status" role="status"></p>
<section id="evening" aria-label="At Yusuf’s table"><p id="table-line">At the table, Yusuf addresses an envelope to Idris and Samira. They need food and fuel. Outside, if any light reaches you (your lantern, a lamp or a neighbour’s lantern), a nearby neighbour can see you. Hiding your lantern helps you stay unseen, but the cold builds. If the warmth bar empties, a neighbour must carry you home.</p><div id="guide" aria-label="First delivery guide"><strong id="guide-text"></strong><button id="guide-continue" hidden>Continue</button><button id="guide-skip">Skip guide</button></div><p>Where will you leave it?</p><div class="choices"><button id="route-door">Their door · farther, Samira knows it was you</button><button id="route-well">Well box · closer, Danyal must collect it before dawn</button></div><p class="source">Yusuf understands concealed voluntary giving as preferable; open giving is also good. <a href="https://quran.com/2/271" target="_blank" rel="noopener">Qur’an 2:271</a> · <a href="https://sunnah.com/bukhari:1423" target="_blank" rel="noopener">Bukhari 1423</a></p></section>
<div class="village"><canvas id="canvas" tabindex="0" aria-label="Snowy village. Move with arrow keys or WASD, or use the direction buttons."></canvas><p id="loading">Lighting the village… You can choose a route now.</p></div>
<section id="night" aria-label="Delivery controls" hidden><div id="recovery" hidden><p id="recovery-line"></p><div class="choices"><button id="explain">Explain</button><button id="quiet">Keep quiet</button><button id="joke">Make a joke</button><button id="ask">Ask him not to tell</button></div></div><div id="walking"><div class="action-row"><button id="lantern">Lantern lit · hide (L)</button><button id="act">Leave envelope</button></div><div id="warmth" class="warmth"><span id="cold-warning" role="status"></span><span class="bar" role="meter" aria-label="Warmth" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="warmth-fill"></i></span></div><div class="directions" aria-label="Move"><button data-move="0,-1" class="up" aria-label="Move north">↑</button><button data-move="-1,0" class="left" aria-label="Move west">←</button><button data-move="0,1" class="down" aria-label="Move south">↓</button><button data-move="1,0" class="right" aria-label="Move east">→</button></div><p class="hint">Arrows / WASD move · L lantern · Enter deliver or return home</p></div></section>
<section id="morning" aria-label="Morning accounts" hidden><div id="morning-lines"></div><button id="next">Next evening</button></section>
<section id="ending" hidden><h2 id="ending-title"></h2><p id="ending-line"></p><button id="again">Play again</button></section>
<section id="menu" class="menu" aria-label="Menu" hidden><div class="menu-top"><h2>Paused</h2><button id="menu-close">Return to play</button></div><p><label><input id="recording" type="checkbox"> Recording</label> · <a href="/third-party-notices.txt" target="_blank" rel="noopener">Licenses</a></p><div id="privacy-debug"></div><section aria-label="People tonight"><h3>People tonight</h3><div id="people-tonight"></div></section><div class="menu-actions"><button id="guide-replay">Replay first delivery guide</button><button id="download">Download run</button><button id="feedback-stop">I’m stopping</button><button id="feedback-confused">I’m confused</button><button id="fullscreen">Fullscreen</button><button id="new">New game</button><a href="https://human.adamwhite.work/lab/people/">People across games</a><a id="all-games" href="https://human.adamwhite.work/">All games</a></div><div id="new-confirm" hidden><p>End this run and prepare a new envelope?</p><button id="new-yes">Start new game</button><button id="new-no">Keep this run</button></div><form id="feedback" hidden><label for="note">Add a note, if you like</label><textarea id="note" rows="3" maxlength="4000"></textarea><label><input id="share-run" type="checkbox"> Share this run with the note (turns recording on)</label><div class="choices"><button type="submit" id="feedback-send">Send feedback</button><button type="button" id="feedback-cancel">Cancel</button></div></form><p id="shelf-status" role="status"></p><p id="menu-status" role="status"></p></section>
</main>`;

const replayButton = document.createElement("button");
replayButton.id = "verify";
replayButton.textContent = "Verify replay";
const footer = debugFooter(replayButton);
const debug = footer.querySelector("details");
if (!debug) throw Error("Missing Debug menu");
debug.id = "debug";
const privacyDebug = document.getElementById("privacy-debug");
if (!privacyDebug) throw Error("Missing privacy footer");
privacyDebug.append(footer);

const lab = createLab({ game: "lefthand" });
let state = createGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
let session: Session = {
  state,
  context: null,
  status: "Preparing shared people…",
};
let preparing = true;
let checkpointing = false;
let shelf: ReturnType<typeof channel> | undefined;
const getShelf = () => (shelf ??= channel());
function save() {
  session.state = state;
  try {
    saveSession(localStorage, session);
  } catch {
    session.status =
      "This run could not be saved in this browser. Download it from the menu.";
  }
  setText("shelf-status", session.status);
}
async function source() {
  let build = "local";
  try {
    const response = await fetch("/release.json");
    if (response.ok) {
      const data = (await response.json()) as { commit?: unknown };
      if (typeof data.commit === "string") build = data.commit;
    }
  } catch {
    /* local build */
  }
  return { game: "lefthand", engine: "4.17.0", build, rules: "left-hand-5" };
}
async function start(seed: number) {
  preparing = true;
  session = await freshSession(seed, getShelf(), await source());
  state = session.state;
  preparing = false;
  lastStep = performance.now();
  save();
  update();
}
async function checkpointNow() {
  if (checkpointing || preparing || !session.context || state.phase !== "ended")
    return;
  checkpointing = true;
  try {
    session.state = state;
    session.status = await checkpoint(session, getShelf());
    save();
  } finally {
    checkpointing = false;
  }
}
let guide: GuideState = localStorage.getItem("lefthand-guide-done")
  ? "done"
  : "route";
let guideReplayPending = false;
const queue: Command[] = [];
let rendererReady = false;
let menuOpen = false;
let cachedFrame = projection(state);
let lastStep = performance.now();
let feedbackLabel = "";
let lastScreen = "";
let morningKey = "";
const measurements = {
  comparisons: 0,
  mismatches: 0,
  malformedReceipts: 0,
  rendererReady: false,
};
const canvas = element<HTMLCanvasElement>("canvas");
canvas.addEventListener("focus", () => {
  if (guide === "route" && state.phase === "evening") {
    element("guide-skip").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
});
// Godot draws inside the page layout; its window resize policy would escape it.
new ResizeObserver(([entry]) => {
  if (!entry) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(entry.contentRect.width * scale);
  canvas.height = Math.round(entry.contentRect.height * scale);
}).observe(canvas);
const setText = (id: string, text: string) => {
  const node = element(id);
  if (node.textContent !== text) node.textContent = text;
};
const show = (id: string, visible: boolean) => {
  element(id).hidden = !visible;
};
const clone = <T>(value: T): T => structuredClone(value);
function perform(command?: Command) {
  const before = {
    phase: state.phase,
    x: state.player.x,
    y: state.player.y,
    lantern: state.player.lantern,
  };
  step(state, command);
  if (
    command?.type === "plan" &&
    before.phase === "evening" &&
    state.phase !== "evening"
  )
    guide = advanceGuide(guide, "route");
  if (
    command?.type === "move" &&
    (state.player.x !== before.x || state.player.y !== before.y)
  )
    guide = advanceGuide(guide, "move");
  if (command?.type === "lantern" && state.player.lantern !== before.lantern)
    guide = advanceGuide(guide, "lantern");
}
function finishGuide() {
  guide = "done";
  localStorage.setItem("lefthand-guide-done", "1");
  update();
}
function enqueue(command: Command) {
  if (preparing || session.preserveSave) return;
  if (!rendererReady && state.phase === "night") return;
  if (command.type === "recover") {
    for (let i = queue.length - 1; i >= 0; i--)
      if (
        queue[i]?.type === "move" ||
        queue[i]?.type === "act" ||
        queue[i]?.type === "lantern"
      )
        queue.splice(i, 1);
  }
  if (!rendererReady && command.type === "plan" && state.phase === "evening") {
    perform(clone(command));
    update();
  } else if (queue.length < 16) queue.push(clone(command));
  if (!rendererReady && command.type === "plan")
    setText(
      "loading",
      "Your route is chosen. The night begins when the village is ready.",
    );
}
function update() {
  const phase = state.phase;
  if (guideReplayPending && phase === "evening") {
    guide = "route";
    guideReplayPending = false;
  }
  const view = projection(state);
  if (guide !== "done" && phase === "night" && guide === "route")
    guide = "move";
  if (phase !== "evening" && phase !== "night" && guide !== "done")
    guide = "done";
  const panel = element("guide");
  const target =
    guide === "route"
      ? element("evening").querySelector(".choices")
      : guide === "move"
        ? element("walking").querySelector(".directions")
        : element("walking").querySelector(".action-row");
  if (guide !== "done" && target && panel.nextElementSibling !== target)
    target.before(panel);
  show("guide", guide !== "done" && !state.recoveryPending);
  show("guide-continue", guide === "consequence");
  setText(
    "guide-text",
    guide === "route"
      ? "Deliver help on at least two nights. Dawn or cold can stop a delivery. Choose a route."
      : guide === "move"
        ? rendererReady
          ? "Move one step toward the marker."
          : "The village is loading. Movement and lantern controls will be ready when it appears."
        : guide === "lantern"
          ? "Change your lantern using the button."
          : state.player.lantern
            ? "The lit lantern restores warmth, but light can reveal you."
            : "The hidden lantern protects privacy, but your warmth falls.",
  );
  const main = element("night").parentElement;
  const village = document.querySelector<HTMLElement>(".village");
  if (main && village) {
    const evening = element("evening");
    const choices = evening.querySelector(".choices");
    if (guide === "route" && choices) {
      evening.prepend(panel);
      panel.after(choices);
    }
    if (
      guide !== "done" &&
      element("status").nextElementSibling !== element("morning")
    )
      element("morning").before(element("status"));
    if (guide === "done" && element("status").nextElementSibling !== evening)
      evening.before(element("status"));
    if (
      guide !== "done" &&
      phase === "night" &&
      element("night").nextElementSibling !== village
    )
      village.before(element("night"));
    if (guide === "done" && village.nextElementSibling !== element("night"))
      village.after(element("night"));
  }
  app?.setAttribute("data-phase", phase);
  show("status", phase === "evening" || phase === "night");
  const dawnSeconds = Math.max(
    0,
    Math.ceil((view.nightLimit - state.nightTick) / 10),
  );
  const conversationSeconds = Math.ceil(state.conversationTicksRemaining / 10);
  show("evening", phase === "evening");
  show("night", phase === "night");
  show("morning", phase === "morning");
  show("ending", phase === "ended");
  show("recovery", state.recoveryPending);
  if (state.recoveryPending && state.witness) {
    const w = state.witness;
    const name = w.id === "tariq" ? "Tariq" : "Danyal";
    setText(
      "recovery-line",
      w.repeat
        ? `${name} promised once to keep quiet. He has seen you again, so he will tell people what he saw whatever you say. Explain (3 seconds): name the family so he can help. Keep quiet: no time spent.`
        : `${
            w.sight === "leaving"
              ? `${name} saw you leave the envelope and will say so, unless you ask him not to.`
              : w.explanation
                ? "Tariq will repeat his guess that you are helping Idris and Samira. If you keep quiet, it stays a guess: people will talk, but nobody can confirm it."
                : `${name} will tell only what he saw.`
          } Explain (3 seconds): name the family so he can help${state.night < 3 ? "; later well collection can be quicker" : ""}, but people will talk about their need. ${
            canAsk(w)
              ? "Keep quiet: no time spent. Ask him not to tell (1 second): you name nobody and he keeps it to himself, but only once. If he sees you out again, he tells people."
              : "Keep quiet: no time spent, and nothing about the family gets out."
          }`,
    );
    element<HTMLButtonElement>("ask").hidden = !canAsk(w);
    element("recovery-line").append(
      " Make a joke (1 second): name nobody; what he saw and guessed stays the same.",
    );
  }
  show("walking", !state.recoveryPending);
  setText(
    "chapter",
    phase === "evening"
      ? `Evening ${state.night} · At the table`
      : phase === "night"
        ? `Night ${state.night} · ${dawnSeconds} ${dawnSeconds === 1 ? "second" : "seconds"} until dawn`
        : phase === "morning"
          ? `Morning ${state.night}`
          : "After three nights",
  );
  const collectSeconds = Math.ceil(view.handoffRemaining / 10);
  setText(
    "status",
    state.conversationTicksRemaining > 0
      ? `${state.witness?.recovered === "ask" ? "Yusuf asks for his silence" : state.witness?.recovered === "joke" ? "Yusuf jokes about the cold" : "Yusuf explains the errand"}. ${conversationSeconds} ${conversationSeconds === 1 ? "second of conversation remains" : "seconds of conversation remain"}; dawn is getting closer.`
      : view.deliveryPending && phase === "night" && !state.recoveryPending
        ? `Danyal collects the envelope from the well box in ${collectSeconds} ${collectSeconds === 1 ? "second" : "seconds"}; dawn is in ${dawnSeconds}.${collectSeconds > dawnSeconds ? " Dawn will come first, so it will not reach them tonight." : " It must be collected before dawn to count."} You may start walking home.`
        : state.status,
  );
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#lantern, #act, .directions button",
  ))
    button.disabled = !rendererReady || state.conversationTicksRemaining > 0;
  setText(
    "lantern",
    state.player.lantern
      ? "Lantern lit · hide (L)"
      : "Lantern hidden · light (L)",
  );
  element("lantern").setAttribute("aria-pressed", String(state.player.lantern));
  setText(
    "act",
    state.deliveredTonight
      ? Math.abs(state.player.x - view.home.x) +
          Math.abs(state.player.y - view.home.y) <=
        1
        ? "Go inside"
        : "Return home"
      : view.deliveryPending
        ? `Collection · ${Math.ceil(view.handoffRemaining / 10)}s`
        : "Leave envelope",
  );
  // The warning sits beside the lantern button, in a slot that never changes height.
  setText(
    "cold-warning",
    view.coldWarning ||
      (state.player.lantern
        ? "Warmth · lit: you warm up, but nearby neighbours can see you."
        : "Warmth · hidden: unseen, but you grow colder."),
  );
  const warmth = Math.max(
    0,
    Math.round(100 * (1 - view.cold / view.coldLimit)),
  );
  const fill = element("warmth-fill");
  if (fill.style.width !== `${warmth}%`) fill.style.width = `${warmth}%`;
  element("warmth").dataset.level =
    warmth <= 15 ? "danger" : warmth <= 45 ? "low" : "ok";
  element("warmth")
    .querySelector(".bar")
    ?.setAttribute("aria-valuenow", String(warmth));
  setText("next", state.night === 3 ? "After three nights" : "Next evening");
  setText(
    "table-line",
    state.night === 1
      ? "At the table, Yusuf addresses an envelope to Idris and Samira. They need food and fuel. Outside, if any light reaches you (your lantern, a lamp or a neighbour’s lantern), a nearby neighbour can see you. Hiding your lantern helps you stay unseen, but the cold builds. If the warmth bar empties, a neighbour must carry you home."
      : `At the table, Yusuf prepares another envelope.${state.exposureNights ? ` After the village talk, Samira waits to meet Danyal alone, so well collection now takes ${upcomingWellSeconds(state)} seconds. At the door there is no wait, but Samira sees who brings it.` : " Idris and Samira still need food and fuel."}${state.rescues ? ` Yusuf still owes the neighbours work after his rescue. Exhaustion leaves ${view.nightLimit / 10} seconds for tonight’s walk.` : ""}`,
  );
  const key = `${state.night}:${phase}`;
  if (phase === "morning" && morningKey !== key) {
    const lines = element("morning-lines");
    lines.replaceChildren();
    for (const person of state.morningLines) {
      const p = document.createElement("p");
      const name = document.createElement("strong");
      name.textContent = person.id === "yusuf" ? "" : `${person.name}: `;
      p.append(name, person.line);
      lines.append(p);
    }
    morningKey = key;
  }
  if (phase === "ended") {
    setText(
      "ending-title",
      state.delivered >= 2
        ? state.rescues
          ? "Help reached them; Yusuf needs care"
          : state.ending === "exposed"
            ? "Help reached them; trust was lost"
            : state.ending === "talked"
              ? "Help reached them; the village is guessing"
              : state.ending === "thanked"
                ? "Help reached them; they know it was you"
                : "The help reached them"
        : "The household needs more help",
    );
    setText("ending-line", state.outcome);
  }
  if (key !== lastScreen) {
    save();
    if (phase === "ended") void checkpointNow();
    lab.screen(key);
    lastScreen = key;
    // On wide screens the map pushes morning and ending text below the fold.
    if (phase === "morning" || phase === "ended")
      element(phase === "morning" ? "morning" : "ending").scrollIntoView({
        block: "nearest",
      });
    if (phase === "morning" || phase === "ended") lab.milestone(key);
  }
}
function setMenu(open: boolean) {
  if (preparing) return;
  menuOpen = open;
  if (open) {
    save();
    const accounts = element("people-tonight");
    accounts.replaceChildren();
    for (const { name, line } of eveningAccounts(state)) {
      const p = document.createElement("p");
      p.textContent = `${name}: ${line}`;
      accounts.append(p);
    }
    if (!accounts.childNodes.length)
      accounts.textContent = "The evening has not begun.";
  }
  for (const child of document.querySelectorAll<HTMLElement>("main > *"))
    if (child.id !== "menu") child.inert = open;
  show("menu", open);
  element("menu-open").setAttribute("aria-expanded", String(open));
  lastStep = performance.now();
  if (open) element("menu-close").focus();
  else canvas.focus({ preventScroll: true });
}
function reset() {
  if (preparing || checkpointing) return;
  queue.length = 0;
  const entropy = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  const seed = ((entropy & ~3) | ((state.seed ^ 3) & 3)) >>> 0;
  morningKey = "";
  show("new-confirm", false);
  show("feedback", false);
  setMenu(false);
  void start(seed);
}
function recordingUI() {
  element<HTMLInputElement>("recording").checked = lab.telemetryOn;
}
lab.trackRun(() => exportRun(state), { runKey: () => state.seed });
recordingUI();
try {
  if (localStorage.getItem("lefthand-notice-v1") !== "1") {
    localStorage.setItem("lefthand-notice-v1", "1");
    void claimLabNotice().then((needed) => show("recording-notice", needed));
  }
} catch {
  void claimLabNotice().then((needed) => show("recording-notice", needed));
}

Object.assign(window, {
  HFBridge: {
    ready: () => {
      rendererReady = true;
      measurements.rendererReady = true;
      lastStep = performance.now();
      show("loading", false);
      update();
      if (guide !== "done") window.scrollTo({ top: 0, behavior: "instant" });
    },
    get_frame: () => {
      cachedFrame = projection(state);
      return JSON.stringify(cachedFrame);
    },
    input: (dx: number, dy: number) => {
      if (!menuOpen && !document.hidden && state.phase === "night")
        enqueue({ type: "move", dx, dy });
    },
    rendered: (text: string) => {
      measurements.comparisons++;
      try {
        const receipt: unknown = JSON.parse(text);
        if (
          !Array.isArray(receipt) ||
          receipt.length !== cachedFrame.tiles.length
        ) {
          measurements.mismatches++;
          return;
        }
        const actual = new Map<string, boolean>();
        for (const tile of receipt) {
          if (
            !tile ||
            !Number.isInteger(tile.x) ||
            !Number.isInteger(tile.y) ||
            typeof tile.lit !== "boolean"
          )
            throw new Error("Invalid light receipt");
          actual.set(`${tile.x},${tile.y}`, tile.lit);
        }
        if (
          actual.size !== cachedFrame.tiles.length ||
          cachedFrame.tiles.some(
            (tile) => actual.get(`${tile.x},${tile.y}`) !== tile.lit,
          )
        )
          measurements.mismatches++;
      } catch {
        measurements.malformedReceipts++;
        measurements.mismatches++;
      }
    },
  },
});
Object.assign(window, {
  Lefthand: {
    snapshot: () => clone(state),
    command: (command: Command) => enqueue(command),
    export: () => exportRun(state),
    hash: () => hash(state),
    replay: (run: Run) => replayRun(run),
    metrics: () => ({ ...measurements, queued: queue.length }),
  },
});

setInterval(() => {
  const now = performance.now();
  if (
    preparing ||
    session.preserveSave ||
    !rendererReady ||
    menuOpen ||
    document.hidden
  ) {
    lastStep = now;
    return;
  }
  // Retain timer overshoot so ten host ticks take one displayed second.
  // Bound catch-up after a stalled frame; menus and hidden tabs reset above.
  lastStep = Math.max(lastStep, now - 1_000);
  while (now - lastStep >= 100) {
    lastStep += 100;
    if (state.phase === "night" || queue.length) {
      perform(queue.shift());
      update();
    }
  }
}, 20);
window.addEventListener("pagehide", () => {
  save();
  void checkpointNow();
});
document.addEventListener("visibilitychange", () => {
  lastStep = performance.now();
});
element("guide-skip").onclick = finishGuide;
element("guide-continue").onclick = () => {
  guide = advanceGuide(guide, "continue");
  finishGuide();
};
element("guide-replay").onclick = () => {
  if (state.phase !== "evening" && state.phase !== "night") {
    guideReplayPending = true;
    localStorage.removeItem("lefthand-guide-done");
    setText(
      "menu-status",
      state.phase === "ended"
        ? "The guide will start with a new game."
        : "The guide will start at the next evening.",
    );
    return;
  }
  guide =
    state.phase === "evening"
      ? "route"
      : state.phase === "night"
        ? "move"
        : "route";
  localStorage.removeItem("lefthand-guide-done");
  setMenu(false);
  update();
};
element("route-door").onclick = () => enqueue({ type: "plan", route: "door" });
element("route-well").onclick = () => enqueue({ type: "plan", route: "well" });
element("lantern").onclick = () => enqueue({ type: "lantern" });
element("act").onclick = () => enqueue({ type: "act" });
element("explain").onclick = () =>
  enqueue({ type: "recover", choice: "explain" });
element("quiet").onclick = () =>
  enqueue({ type: "recover", choice: "keepquiet" });
element("ask").onclick = () => enqueue({ type: "recover", choice: "ask" });
element("joke").onclick = () => enqueue({ type: "recover", choice: "joke" });
element("next").onclick = () => enqueue({ type: "next" });
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-move]",
))
  button.onclick = () => {
    const [dx = 0, dy = 0] = (button.dataset.move ?? "").split(",").map(Number);
    enqueue({ type: "move", dx, dy });
  };
document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (event.key === "Escape") {
      setMenu(!menuOpen);
      return;
    }
    // Godot may focus the canvas; capture arrow defaults before its handlers.
    if (event.key.startsWith("Arrow") && !menuOpen) event.preventDefault();
    if (menuOpen || state.phase !== "night" || document.hidden) return;
    const directions: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      w: [0, -1],
      ArrowDown: [0, 1],
      s: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      ArrowRight: [1, 0],
      d: [1, 0],
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      enqueue({ type: "move", dx: direction[0], dy: direction[1] });
    } else if (event.key.toLowerCase() === "l") enqueue({ type: "lantern" });
    else if (
      (event.key === "Enter" || event.key === " ") &&
      !(event.target instanceof HTMLButtonElement) &&
      !(event.target instanceof HTMLAnchorElement)
    ) {
      event.preventDefault();
      enqueue({ type: "act" });
    }
  },
  { capture: true },
);
element("menu-open").onclick = () => setMenu(true);
element("menu-close").onclick = () => setMenu(false);
element("notice-close").onclick = () => show("recording-notice", false);
element("notice-off").onclick = () => {
  lab.setTelemetryOff(true);
  recordingUI();
  show("recording-notice", false);
};
element<HTMLInputElement>("recording").onchange = (event) => {
  lab.setTelemetryOff(!(event.target as HTMLInputElement).checked);
  recordingUI();
};
element<HTMLAnchorElement>("all-games").onclick = async (event) => {
  event.preventDefault();
  save();
  await checkpointNow();
  location.href = gameNavigation("https://human.adamwhite.work/");
};
element("fullscreen").onclick = () => {
  void (
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen()
  ).catch(() =>
    setText("menu-status", "Fullscreen is unavailable in this browser."),
  );
};
element("new").onclick = () => show("new-confirm", true);
element("new-no").onclick = () => show("new-confirm", false);
element("new-yes").onclick = reset;
element("again").onclick = reset;
element("download").onclick = () => {
  const run = exportRun(state);
  const url = URL.createObjectURL(
    new Blob(
      [
        session.preserveSave
          ? (localStorage.getItem("lefthand-run@5") ?? "")
          : JSON.stringify(run, null, 2),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `lefthand-${state.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setText(
    "menu-status",
    "Run downloaded with seed, inputs, and complete state.",
  );
};
element("verify").onclick = () => {
  try {
    const restored = replayRun(exportRun(state));
    setText("menu-status", `Replay verified: ${hash(restored)}.`);
  } catch (error) {
    setText("menu-status", `Replay did not verify: ${String(error)}`);
  }
};
function feedback(label: string) {
  feedbackLabel = label;
  show("feedback", true);
  element<HTMLTextAreaElement>("note").focus();
  setText("menu-status", "");
}
element("feedback-stop").onclick = () => feedback("I’m stopping");
element("feedback-confused").onclick = () => feedback("I’m confused");
element("feedback-cancel").onclick = () => show("feedback", false);
element<HTMLFormElement>("feedback").onsubmit = async (event) => {
  event.preventDefault();
  const send = element<HTMLButtonElement>("feedback-send");
  send.disabled = true;
  const note = element<HTMLTextAreaElement>("note").value.trim();
  const sharePlay = element<HTMLInputElement>("share-run").checked;
  try {
    await lab.sendFeedback(`${feedbackLabel}${note ? `\n\n${note}` : ""}`, {
      ...(sharePlay ? { run: exportRun(state), sharePlay: true } : {}),
    });
    setText("menu-status", "Feedback queued for the Lab.");
    show("feedback", false);
    element<HTMLTextAreaElement>("note").value = "";
    recordingUI();
  } catch {
    setText(
      "menu-status",
      "Feedback could not be queued. Your note is still here; try again.",
    );
  } finally {
    send.disabled = false;
  }
};

type EngineInstance = {
  startGame(options: { mainPack: string }): Promise<void>;
};
type EngineClass = new (options: Record<string, unknown>) => EngineInstance;
async function load() {
  const response = await fetch("/engine.json");
  if (!response.ok) throw new Error("Engine manifest unavailable");
  const manifest: { executable: string; script: string; pack: string } =
    await response.json();
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = manifest.script;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Engine script unavailable"));
    document.head.append(script);
  });
  const Engine = (window as unknown as { Engine: EngineClass }).Engine;
  await new Engine({
    executable: manifest.executable,
    canvas,
    canvasResizePolicy: 0,
    focusCanvasOnStart: false,
    ensureCrossOriginIsolationHeaders: false,
  }).startGame({ mainPack: manifest.pack });
}
try {
  const saved = loadSession(localStorage);
  if (saved) {
    session = saved;
    state = saved.state;
    preparing = false;
    lastScreen = `${state.night}:${state.phase}`;
    update();
    if (session.preserveSave) setMenu(true);
  } else void start(state.seed);
} catch {
  void start(state.seed);
}
update();
void load().catch(() => {
  show("loading", true);
  setText(
    "loading",
    "The village could not load. Reload the page to try again. Your night has not started.",
  );
});
