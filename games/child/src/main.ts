import "./style.css";
import { foodStatus, preparationChoices, preparationProgress } from "./choices";
import { initLab } from "./lab";
import {
  chapterGoals,
  conditionsText,
  createGame,
  endingReason,
  exportRun,
  type Input,
  type Practice,
  practices,
  replay,
  step,
  teacherAvailable,
  teachers,
} from "./model";
import { createRenderer } from "./render";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw Error("Page is missing.");
let game = createGame(21);
let saveWarning = "";
let autosaveBlocked = false;
function preserveRefusedSave(raw: string): boolean {
  try {
    const keyCount = localStorage.length;
    for (let i = 0; i < keyCount; i++) {
      const key = localStorage.key(i);
      if (
        key !== null &&
        /^child-run-refused:\d+$/.test(key) &&
        localStorage.getItem(key) === raw
      )
        return true;
    }
    // With keyCount existing keys, at least one of these slots is unused.
    for (let i = 0; i <= keyCount; i++) {
      const key = `child-run-refused:${i}`;
      const existing = localStorage.getItem(key);
      if (existing === raw) return true;
      if (existing === null) {
        localStorage.setItem(key, raw);
        return localStorage.getItem(key) === raw;
      }
    }
  } catch {
    return false;
  }
  return false;
}
let saved: string | null = null;
let guide = false;
try {
  saved = localStorage.getItem("child-run");
  guide = saved === null && localStorage.getItem("child-guide-done") !== "1";
} catch {
  autosaveBlocked = true;
  guide = true;
}
if (saved !== null) {
  try {
    game = replay(JSON.parse(saved));
  } catch {
    saveWarning =
      "This save needs its original game version. A fresh upbringing has begun.";
    autosaveBlocked = !preserveRefusedSave(saved);
  }
}
if (autosaveBlocked) {
  saveWarning +=
    " SAVE BLOCKED: This device's original save could not be protected. Saving is disabled. You can keep playing and export this upbringing.";
}
const lab = initLab(
  () => game.run,
  () => exportRun(game),
);
let timer: ReturnType<typeof setTimeout> | undefined;
let feedbackOpen = false;
const header = document.createElement("header");
header.className = "masthead";
header.innerHTML =
  '<a href="https://human.adamwhite.work">A HUMAN FRAMEWORK GAME</a><button type="button">Menu</button>';
const top = document.createElement("div");
top.className = "topline";
const scene = document.createElement("div");
scene.className = "scene";
scene.setAttribute("role", "img");
scene.setAttribute("aria-label", "Elif and the paths around the village well.");
const story = document.createElement("section");
story.className = "story";
story.setAttribute("aria-live", "polite");
const choices = document.createElement("div");
choices.className = "choices";
const status = document.createElement("p");
status.className = "status";
app.append(header, top, scene, story, choices, status);
let renderer = await createRenderer(scene, false);
function button(title: string, detail: string, fn: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = detail;
  b.append(strong, span);
  b.onclick = () => {
    if (guide && game.phase === "aftermath") stopGuide();
    fn();
  };
  if (guide && !choices.querySelector("[data-guide-target]"))
    b.dataset.guideTarget = "";
  choices.append(b);
}
function stopGuide() {
  guide = false;
  try {
    localStorage.setItem("child-guide-done", "1");
  } catch {
    // The guide also works without storage.
  }
  draw();
}
function save() {
  if (autosaveBlocked || game.slice) return;
  let run: ReturnType<typeof exportRun>;
  try {
    run = exportRun(game);
    const raw = JSON.stringify(run);
    localStorage.setItem("child-run", raw);
    if (localStorage.getItem("child-run") !== raw)
      throw Error("The saved upbringing could not be verified.");
    saveWarning = "";
  } catch (error) {
    console.error("Child local save failed", error);
    saveWarning =
      "This device could not save the page. Keep the game open and export this upbringing before leaving.";
    return;
  }
  try {
    lab.captureSave(run);
  } catch (error) {
    console.error("Child play recording failed after local save", error);
    saveWarning =
      "This page is saved on this device, but its play recording could not be queued.";
  }
}
function scheduleReveal() {
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      if (!menu.open && !feedbackOpen) dispatch({ type: "reveal" });
    },
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 2000 : 4000,
  );
}
function dispatch(input: Input) {
  step(game, input);
  save();
  lab.event("choice", input.type);
  draw();
  if (game.phase === "movement") scheduleReveal();
}
const costs: Record<Practice, string> = {
  count: "She counts jars. Maryam leaves meal work undone.",
  look: "She checks a path. Yusuf leaves field work undone.",
  wait: "She waits with Danyal. Work on the well rope is delayed.",
  refuse: "You keep a jar for home. Staying home uses food stores.",
};
function draw() {
  app?.classList.toggle("guiding", guide);
  top.textContent = `WHAT THE CHILD SAW · ELIF AT ${game.age}`;
  renderer.update({
    age: game.age,
    chapter: game.chapter,
    phase: game.phase,
    action: game.outcome?.action ?? null,
    available: game.conditions.available,
    flood: game.conditions.flood,
    food: game.food,
    repairs: game.repairs,
  });
  choices.replaceChildren();
  story.replaceChildren();
  const h = document.createElement("h1"),
    p = document.createElement("p");
  story.append(h, p);
  if (guide) {
    const cue = document.createElement("p");
    cue.dataset.guideCue = "";
    cue.className = "guide-cue";
    cue.textContent =
      game.phase === "prepare"
        ? game.preparations < 3
          ? `Help Elif keep water at home. Choose who she watches (${3 - game.preparations} left). Her lesson can leave water short.`
          : "Now let Elif go. Watch what her lessons lead her to do."
        : game.phase === "movement"
          ? "Watch what Elif does."
          : "Her choice has a cost. Continue with a companion.";
    if (game.phase === "aftermath" || game.phase === "ending")
      cue.dataset.guideResult = "";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.dataset.guideSkip = "";
    skip.className = "guide-skip";
    skip.textContent = "Skip guide";
    skip.onclick = stopGuide;
    choices.append(cue, skip);
  }
  if (game.phase === "prepare") {
    h.textContent =
      game.preparations === 0
        ? "She watches your hands."
        : game.preparations === 3
          ? "Now she goes alone."
          : "One ordinary afternoon.";
    p.textContent = game.lastLesson;
    const progress = document.createElement("p");
    progress.className = "preparation-progress";
    progress.textContent =
      game.preparations === 0
        ? "Choose work for three afternoons. Then she goes alone, using the way she watched most often. After each time skip, her chosen companion shows one task again. For example, that opening counting demonstration and two new checking tasks give her more practice checking. If two ways are tied, she cannot choose between them."
        : preparationProgress(game.preparations);
    story.append(progress);
    if (game.preparations === 0) {
      const goal = document.createElement("p");
      goal.textContent = chapterGoals[game.age] ?? "";
      story.append(goal);
    }
    const c = document.createElement("p");
    c.className = "conditions";
    c.textContent = conditionsText(game);
    story.append(c);
    if (game.preparations < 3) {
      for (const choice of preparationChoices(game))
        button(choice.title, choice.detail, () => dispatch(choice.input));
    } else
      button("Let her go", "Watch what she does.", () =>
        dispatch({ type: "crisis" }),
      );
  } else if (game.phase === "movement") {
    h.textContent = "Watch Elif.";
    p.textContent = "";
    scene.setAttribute(
      "aria-label",
      game.outcome?.movement ?? "Elif moves toward the well.",
    );
  } else if (game.phase === "aftermath") {
    h.textContent = game.outcome?.success
      ? game.age === 6
        ? "She brought the water."
        : "She did what was needed."
      : "She came home short.";
    p.textContent = `“${game.outcome?.line}”`;
    const c = document.createElement("p");
    c.textContent = game.outcome?.cost ?? "";
    story.append(c);
    if (game.slice || game.chapter === 4)
      button("Close this page", "Keep what happened in her yearbook.", () =>
        dispatch({ type: "arrange", practice: "count" }),
      );
    else {
      const arrange = document.createElement("p");
      arrange.textContent =
        "After the years pass, who will show her one task at the next chapter’s opening?";
      story.append(arrange);
      for (const practice of practices.filter((practice) =>
        teacherAvailable(game, practice),
      ))
        button(
          practice === "refuse"
            ? "Keep working with you"
            : `Keep working with ${teachers[practice]}`,
          costs[practice],
          () => dispatch({ type: "arrange", practice }),
        );
    }
  } else {
    h.textContent = game.outcome?.success
      ? game.slice
        ? "The household has water."
        : "Every household has water."
      : game.slice
        ? "Tonight they use the water stored at home."
        : "The last households go without.";
    p.textContent = game.slice
      ? "This day stays in her yearbook."
      : "Elif is the adult on duty now. What she did came from the work she watched.";
    if (game.outcome) {
      const consequence = document.createElement("p");
      consequence.className = "ending-consequence";
      consequence.textContent = endingReason(game);
      story.append(consequence);
    }
    if (!game.child.body.alive) {
      h.textContent = "Elif has died.";
      p.textContent = game.lastLesson;
    }
    const journal = document.createElement("div");
    journal.className = "journal";
    for (const memory of game.history) {
      const row = document.createElement("p");
      row.textContent = `At ${memory.age}: “${memory.memory}”`;
      journal.append(row);
    }
    story.append(journal);
    button("Begin again", "Another upbringing can teach another way.", () => {
      game = createGame(game.seed + 1, game.slice);
      save();
      draw();
    });
  }
  status.textContent = `${saveWarning ? `${saveWarning} ` : ""}${foodStatus(game.food)} Emergency water: ${game.waterReserve} household ${game.waterReserve === 1 ? "share" : "shares"}. ${game.repairs <= 3 ? "The well rope needs work." : "The well rope is holding."}`;
}
const menu = document.createElement("dialog");
menu.className = "menu";
const menuTitle = document.createElement("h2");
menuTitle.textContent = "Take a moment.";
menu.append(menuTitle);
function menuButton(label: string, fn: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.onclick = fn;
  menu.append(b);
  return b;
}
menuButton("Resume", () => {
  menu.close();
  if (game.phase === "movement") scheduleReveal();
});
menuButton("Replay guide", () => {
  guide = true;
  menu.close();
  draw();
  if (game.phase === "movement") scheduleReveal();
});
const feedbackButton = menuButton("Feedback", () => {
  feedbackOpen = true;
  menu.close();
  const restoreMenu = () => {
    feedbackOpen = false;
    if (!menu.open) menu.showModal();
    feedbackButton.focus();
  };
  if (!lab.feedback(restoreMenu)) restoreMenu();
});
const recording = document.createElement("button");
recording.type = "button";
function recordingLabel() {
  recording.textContent = `Recording: ${lab.recording() ? "on" : "off"}`;
  recording.setAttribute("aria-pressed", String(lab.recording()));
}
recordingLabel();
recording.onclick = () => {
  lab.setRecording(!lab.recording());
  recordingLabel();
};
menu.append(recording);
menuButton("Full screen", () => {
  void document.documentElement.requestFullscreen?.();
});
const all = document.createElement("a");
all.href = "https://human.adamwhite.work";
all.textContent = "All games";
menu.append(all);
menuButton("New game", () => {
  if (confirm("Start a new upbringing?")) {
    clearTimeout(timer);
    game = createGame(game.seed + 1);
    save();
    menu.close();
    draw();
  }
});
{
  menuButton("Export playtest", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(exportRun(game))], { type: "application/json" }),
    );
    a.download = "child-playtest.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json";
  file.setAttribute("aria-label", "Replay playtest");
  file.onchange = async () => {
    try {
      const f = file.files?.[0];
      if (f) {
        clearTimeout(timer);
        game = replay(JSON.parse(await f.text()));
        save();
        menu.close();
        draw();
        if (game.phase === "movement") scheduleReveal();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "This run could not be read.");
    }
  };
  menu.append(file);
}
const starts = document.createElement("details");
const startsTitle = document.createElement("summary");
startsTitle.textContent = "Other ways to begin";
starts.append(startsTitle);
const ageSix = document.createElement("button");
ageSix.type = "button";
ageSix.textContent = "Begin at age six";
ageSix.onclick = () => {
  if (
    !confirm(
      "Start a separate age-six day? Your saved upbringing stays on this device.",
    )
  )
    return;
  clearTimeout(timer);
  game = createGame(21, true);
  menu.close();
  draw();
};
starts.append(ageSix);
menu.append(starts);
const diagnostics = document.createElement("div");
diagnostics.className = "diagnostics";
const privacy = document.createElement("a");
privacy.href = "https://human.adamwhite.work/lab/privacy/";
privacy.textContent = "Lab privacy";
privacy.target = "_blank";
privacy.rel = "noopener";
const debug = document.createElement("details");
const debugTitle = document.createElement("summary");
debugTitle.textContent = "Debug";
debug.append(debugTitle);
const canvas = document.createElement("button");
canvas.type = "button";
canvas.textContent = "Use Canvas renderer";
canvas.onclick = async () => {
  renderer.destroy();
  scene.replaceChildren();
  renderer = await createRenderer(scene, true);
  document.documentElement.dataset.renderer = renderer.kind;
  draw();
};
debug.append(canvas);
diagnostics.append(privacy, debug);
menu.append(diagnostics);
document.body.append(menu);
header.querySelector("button")?.addEventListener("click", () => {
  if (feedbackOpen || menu.open) return;
  clearTimeout(timer);
  menu.showModal();
});
menu.addEventListener("cancel", () => {
  if (game.phase === "movement") scheduleReveal();
});
draw();
if (game.phase === "movement") scheduleReveal();
document.documentElement.dataset.ready = "true";
document.documentElement.dataset.renderer = renderer.kind;
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    clearTimeout(timer);
    return;
  }
  clearTimeout(timer);
  renderer.destroy();
  lab.destroy();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    draw();
    if (game.phase === "movement" && !menu.open && !feedbackOpen)
      scheduleReveal();
  }
});
