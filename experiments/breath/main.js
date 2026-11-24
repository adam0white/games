import {
  ALCOVE_RADIUS,
  DT,
  LEVELS,
  create,
  step,
  position,
  wave,
  safe,
  careful,
} from "./sim.js";
import { read, readJson, write, writeJson } from "../kit/save.js";
import { sound } from "../kit/audio.js";
import { onLeave, isPauseKey } from "../kit/pause.js";
import { noZoom } from "../kit/zoom.js";
import { screens } from "../kit/screens.js";
import { lab } from "../kit/lab.js";
noZoom();
const $ = (id) => document.getElementById(id),
  query = new URLSearchParams(location.search);
const KEY = "breath-save",
  old = readJson(KEY, null);
const save = {
  v: 1,
  stars: {},
  opened: 1,
  best: 0,
  daily: {},
  runs: 0,
  sound: true,
  look: "night",
};
if (old && typeof old === "object") {
  for (const k of ["stars", "daily"])
    if (old[k] && typeof old[k] === "object" && !Array.isArray(old[k]))
      save[k] = Object.fromEntries(
        Object.entries(old[k]).filter(
          ([key, v]) => Number.isFinite(v) && v >= 0,
        ),
      );
  for (const k of ["opened", "best", "runs"])
    if (Number.isFinite(old[k]))
      save[k] = Math.max(k === "opened" ? 1 : 0, Math.floor(old[k]));
  save.stars = Object.fromEntries(
    Object.entries(save.stars)
      .filter(([key]) => /^(?:[1-9]|1[0-2])$/.test(key))
      .map(([key, value]) => [
        key,
        Math.max(0, Math.min(3, Math.floor(value))),
      ]),
  );
  save.opened = Math.min(12, save.opened);
  save.sound = old.sound !== false;
  if (["night", "ember", "paper"].includes(old.look)) save.look = old.look;
}
const store = () => writeJson(KEY, save);
const utcDay = () => new Date().toISOString().slice(0, 10);
let runDate = utcDay();
function daySeed(date) {
  let h = 2166136261;
  for (const ch of "breath:" + date) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rec = lab("breath");
rec.notice($("menu").firstElementChild);
rec.toggle($("paused").firstElementChild);
const snd = sound({ on: () => save.sound });
const tone = (f = 440, d = 0.1, v = 0.05, type = "triangle", slide = 0) => {
  if (snd.ctx) snd.tone(f, d, v, type, slide);
};
let s = null,
  screen = "menu",
  held = false,
  pointer = null,
  keyboard = false,
  daily = false,
  level = 1,
  acc = 0,
  last = performance.now(),
  clock = 0,
  cam = 0,
  shake = 0,
  pop = 0,
  touched = false,
  fx = [],
  confetti = [],
  toast = "",
  toastT = 0,
  stepSound = 0,
  hum = 0,
  lastWarning = false,
  finished = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HINT_KEY = "breath:hint";
const hintMode = query.get("hint");
let hintDone =
  hintMode === "0" ||
  (!["hand", "ring"].includes(hintMode) &&
    (save.runs > 0 || read(HINT_KEY) === "1"));
let hintIdle = 0;
const PALETTES = {
  night: {
    sky: "#101e2b",
    wall: "#263b48",
    room: "#304c59",
    edge: "#46616c",
    smoke: "#101c2c",
    bright: "#f4ecd6",
    gold: "#ffbf69",
    mint: "#9ce3c2",
  },
  ember: {
    sky: "#291e2c",
    wall: "#4c3440",
    room: "#694652",
    edge: "#95626a",
    smoke: "#231e30",
    bright: "#ffeddb",
    gold: "#ffad72",
    mint: "#bee3c0",
  },
  paper: {
    sky: "#182f40",
    wall: "#214459",
    room: "#2c576b",
    edge: "#7499a6",
    smoke: "#132939",
    bright: "#e2f1ef",
    gold: "#ffe39b",
    mint: "#91ecdd",
  },
};
let C = PALETTES[save.look];
const cv = $("c"),
  g = cv.getContext("2d");
let W = 0,
  H = 0,
  dpr = 1,
  top = 0,
  bottom = 0,
  left = 0,
  right = 0,
  landscape = false,
  worldTop = 0,
  worldBottom = 0,
  bw = 0,
  bx = 0,
  fh = 148,
  baseY = 0;
function layout() {
  W = innerWidth;
  H = innerHeight;
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($("probe"));
  top = parseFloat(cs.paddingTop) || 0;
  bottom = parseFloat(cs.paddingBottom) || 0;
  left = parseFloat(cs.paddingLeft) || 0;
  right = parseFloat(cs.paddingRight) || 0;
  landscape = W > H && H < 550;
  worldTop = top + (landscape ? 76 : 144);
  worldBottom = H - bottom - (landscape ? 55 : 94);
  baseY = H - bottom - (landscape ? 86 : 137);
  bw = Math.min(430, W - 46);
  bx = (W - bw) / 2;
  fh = landscape
    ? Math.min(115, Math.max(54, (baseY - worldTop + 4) / 3))
    : Math.min(156, Math.max(116, (H - top - bottom - 195) / 3.5));
  if (s) cam = cameraTarget(position(s));
  fx = [];
}
addEventListener("resize", layout);
layout();
function cameraTarget(p) {
  const maxCam = Math.max(
    0,
    s.config.floors + 1 - (baseY + 4 - worldTop) / fh,
  );
  const focusY = landscape ? worldTop + (worldBottom - worldTop) * 0.68 : H * 0.64;
  return Math.min(maxCam, Math.max(0, p.y - (baseY - focusY) / fh));
}
const xx = (x) => bx + 22 + x * (bw - 44),
  yy = (y) => baseY - (y - cam) * fh;
const round = (ctx, x, y, w, h, r, c) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};
const disk = (ctx, x, y, r, c) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};
function text(
  str,
  x,
  y,
  size = 16,
  color = C.bright,
  align = "left",
  weight = 600,
  ctx = g,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}
function burst(x, y, n = 10, color = C.gold) {
  for (let i = 0; i < n; i++) {
    let a = i * 2.399 + clock;
    fx.push({
      x,
      y,
      vx: Math.cos(a) * (25 + i * 3),
      vy: Math.sin(a) * 55 - 30,
      life: 0.6,
      max: 0.6,
      color,
    });
  }
}
function chooseScreen(name) {
  screen = name;
  held = false;
  keyboard = false;
  pointer = null;
  show(name);
}
const show = screens(["menu", "select", "paused", "end"], (name) => {
  $("pause").style.display = name === "play" ? "flex" : "none";
  if (name === "menu") menu();
  soundLabel();
});
function soundLabel() {
  $("sound").textContent = `Sound: ${save.sound ? "on" : "off"}`;
  for (const b of document.querySelectorAll("[data-look]"))
    b.setAttribute("aria-pressed", String(b.dataset.look === save.look));
}
function menu() {
  $("menu").classList.toggle("has-played", save.runs > 0);
  $("play").textContent = save.runs ? `Play level ${save.opened}` : "Play";
  const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $("bestLine").textContent = `${stars} / 36 stars · Daily best ${save.best}`;
  drawHero();
}
function begin(which = level, isDaily = false) {
  snd.unlock();
  snd.release();
  level = Math.max(1, Math.min(12, Number(which) || 1));
  daily = isDaily;
  runDate = utcDay();
  s = create({
    level,
    seed: daily
      ? daySeed(runDate)
      : query.has("seed")
        ? Number(query.get("seed")) >>> 0
        : 1700 + level * 97,
    daily,
  });
  finished = false;
  touched = false;
  cam = 0;
  fx = [];
  confetti = [];
  shake = 0;
  pop = 0.5;
  acc = 0;
  last = performance.now();
  toast = daily ? "Tower of the day" : `Level ${level}`;
  toastT = 2.4;
  hum = 0;
  lastWarning = false;
  chooseScreen("play");
  document.activeElement?.blur();
  rec.start({ level, daily, seed: s.seed, date: daily ? runDate : undefined });
  tone(330, 0.16, 0.06, "triangle", 160);
}
function finish() {
  if (finished) return;
  finished = true;
  held = false;
  keyboard = false;
  pointer = null;
  save.runs++;
  if (s.over === "win") {
    save.stars[level] = Math.max(save.stars[level] || 0, s.stars);
    save.opened = Math.min(12, Math.max(save.opened, level + 1));
  }
  if (daily) {
    const score = s.score || s.rescued || 0;
    save.best = Math.max(save.best, score);
    save.daily[runDate] = Math.max(save.daily[runDate] || 0, score);
    save.daily = Object.fromEntries(
      Object.entries(save.daily).sort().slice(-30),
    );
  }
  store();
  rec.end(s.over, {
    level,
    daily,
    rescued: daily ? s.totalRescued : s.rescued,
    seconds: Math.round(s.t),
    breath: Math.round(s.breath),
    stars: s.stars,
    score: s.score || 0,
  });
  $("endLabel").textContent = daily ? "Tower of the day" : `Level ${level}`;
  $("endTitle").textContent =
    s.over === "win" ? "Everyone out!" : "Take a breather";
  $("stars").textContent = daily
    ? `${s.score || 0} points`
    : "★ ".repeat(s.stars || 0) + "☆ ".repeat(3 - (s.stars || 0));
  $("rescued").textContent = daily
    ? String(s.totalRescued)
    : `${s.rescued} / ${s.people.length}`;
  $("breathLeft").textContent =
    `${Math.round(Math.max(0, s.minimumBreath ?? s.breath))}%`;
  $("time").textContent = `${Math.round(s.t)}s`;
  $("endTip").textContent =
    s.over === "win"
      ? "Safe at last."
      : "Stop in mint doorways. Wait for the whole line.";
  $("next").textContent = daily
    ? "Play today again"
    : s.over === "win" && level < 12
      ? "Next level"
      : s.over === "win"
        ? "Play the daily tower"
        : "Try again";
  chooseScreen("end");
  drawResult();
  if (s.over === "win") {
    for (let i = 0; i < 70; i++)
      confetti.push({
        x: W * (0.15 + (i % 12) / 16),
        y: -i * 7,
        vx: Math.sin(i) * 38,
        vy: 60 + (i % 8) * 11,
        color: [C.gold, C.mint, C.bright, "#f18c80"][i % 4],
        spin: i,
      });
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => {
        if (screen === "end") tone(f, 0.35, 0.06);
      }, i * 105),
    );
  } else {
    tone(230, 0.3, 0.05, "sine", -80);
  }
}
function pause() {
  if (screen !== "play" || s?.over) return;
  chooseScreen("paused");
  keepDaily();
  snd.hold();
  acc = 0;
}
function resume() {
  if (screen !== "paused") return;
  chooseScreen("play");
  snd.release();
  acc = 0;
  last = performance.now();
}
function keepDaily() {
  if (!daily || !s) return;
  const score =
    (s.score || 0) +
    (s.over ? 0 : s.rescued * 200 + Math.floor(s.progress * 20));
  save.best = Math.max(save.best, score);
  save.daily[runDate] = Math.max(save.daily[runDate] || 0, score);
  save.daily = Object.fromEntries(Object.entries(save.daily).sort().slice(-30));
  store();
}
function leave() {
  keepDaily();
  if (s && !finished)
    rec.end("left", {
      level,
      daily,
      rescued: daily ? s.totalRescued : s.rescued,
      seconds: Math.round(s.t),
    });
  s = null;
  finished = true;
  snd.release();
  chooseScreen("menu");
}
$("play").onclick = () => begin(save.opened);
$("daily").onclick = () => begin(1, true);
$("resume").onclick = resume;
$("restart").onclick = () => {
  keepDaily();
  rec.end("restart", { level, daily });
  begin(level, daily);
};
$("pause").onclick = pause;
$("toMenu").onclick = leave;
$("endMenu").onclick = leave;
$("again").onclick = () => begin(level, daily);
$("next").onclick = () => {
  if (daily) begin(1, true);
  else if (s.over === "win" && level < 12) begin(level + 1);
  else if (s.over === "win") begin(1, true);
  else begin(level);
};
$("choose").onclick = () => {
  const list = $("levels");
  list.replaceChildren();
  for (let i = 1; i <= 12; i++) {
    const b = document.createElement("button");
    b.disabled = i > save.opened;
    b.innerHTML = `${i}<small>${i > save.opened ? "—" : "★".repeat(save.stars[i] || 0) || "·"}</small>`;
    b.onclick = () => begin(i);
    list.append(b);
  }
  chooseScreen("select");
};
$("selectBack").onclick = () => chooseScreen("menu");
$("sound").onclick = () => {
  save.sound = !save.sound;
  store();
  soundLabel();
  if (save.sound) {
    snd.unlock();
    tone(660, 0.15, 0.06);
  } else snd.hold();
};
for (const b of document.querySelectorAll("[data-look]"))
  b.onclick = () => {
    save.look = b.dataset.look;
    C = PALETTES[save.look];
    store();
    soundLabel();
    tone(520, 0.1, 0.04);
  };
onLeave(pause);
function press(e) {
  if (screen !== "play" || pointer !== null) return;
  e.preventDefault();
  pointer = e.pointerId;
  held = true;
  touched = true;
  dismissHint();
  snd.unlock();
  try {
    cv.setPointerCapture(pointer);
  } catch {}
  pop = 0.16;
  burst(e.clientX, e.clientY, 7, C.mint);
  tone(220, 0.09, 0.045, "triangle", 110);
  rec.event("hold", { at: Math.round(s.progress * 100) / 100 });
}
cv.addEventListener("pointerdown", press);
function release(e) {
  if (e.pointerId !== pointer) return;
  pointer = null;
  held = false;
  pop = 0.18;
  tone(160, 0.08, 0.04, "sine", -35);
  if (screen === "play")
    rec.event("release", { at: Math.round(s.progress * 100) / 100 });
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  cv.addEventListener(type, release);
addEventListener("keydown", (e) => {
  if (isPauseKey(e)) {
    e.preventDefault();
    screen === "paused" ? resume() : pause();
    return;
  }
  if (
    screen === "play" &&
    [" ", "ArrowUp", "ArrowRight", "w", "W"].includes(e.key)
  ) {
    e.preventDefault();
    if (!keyboard) {
      tone(220, 0.1, 0.04);
      pop = 0.15;
    }
    keyboard = true;
    touched = true;
    dismissHint();
    snd.unlock();
  }
});
addEventListener("keyup", (e) => {
  if ([" ", "ArrowUp", "ArrowRight", "w", "W"].includes(e.key)) {
    keyboard = false;
    tone(160, 0.08, 0.04);
  }
});
function dismissHint() {
  if (hintDone) return;
  hintDone = true;
  write(HINT_KEY, "1");
}

const holdHand = new Path2D(
  "M-4 15V1Q-4-4 0-4Q4-4 4 1V10Q7 7 10 11Q14 9 16 14Q20 12 21 17V26Q20 36 13 39H3Q-1 38-4 33L-11 22Q-14 17-10 15Q-7 14-4 19Z",
);
function gesture(x, y, lift, ringOnly = false) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = lift > 0.5 ? C.mint : C.gold;
  g.fillStyle = lift > 0.5 ? "#18323e" : "#ffbf6944";
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (!ringOnly) {
    g.translate(0, -lift * 19);
    g.fillStyle = C.bright;
    g.strokeStyle = "#0b1b27";
    g.lineWidth = 1.8;
    g.fill(holdHand);
    g.stroke(holdHand);
  }
  g.restore();
}
function liftArrow(x, y) {
  g.strokeStyle = C.mint;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y + 14);
  g.lineTo(x, y);
  g.moveTo(x - 4, y + 4);
  g.lineTo(x, y);
  g.lineTo(x + 4, y + 4);
  g.stroke();
}
function drawGestureHint(x, y, release) {
  const age = release ? s.t - s.gustStarted : hintIdle - 3;
  const t = age % 2.8;
  const lift = release
    ? Math.min(1, t / 0.32)
    : t < 0.3
      ? 1 - t / 0.3
      : Math.min(1, Math.max(0, (t - 1.58) / 0.3));
  g.save();
  if (landscape) {
    g.translate(x, y);
    g.scale(0.78, 0.78);
    x = y = 0;
  }
  if (reduced && !release) {
    round(g, x - 68, y - 32, 136, 78, 18, "#0b1b27f5");
    gesture(x - 36, y, 0);
    gesture(x + 30, y, 1);
    liftArrow(x + 54, y - 15);
    text("→", x, y + 3, 21, C.mint, "center");
  } else {
    round(g, x - 27, y - 27, 56, 72, 15, "#0b1b27f5");
    gesture(x - 3, y, reduced ? 1 : lift, !release && hintMode === "ring");
    if (release) liftArrow(x + 18, y - 15);
  }
  g.restore();
}

function person(
  ctx,
  x,
  y,
  kind = "firefighter",
  breath = 100,
  moving = false,
  dir = 1,
  scale = 1,
  phase = clock,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * dir, scale);
  const me = kind === "firefighter",
    cat = kind === "cat",
    child = kind === "child";
  const bounce = moving && !reduced ? Math.sin(phase * 13) * 1.8 : 0,
    crouch = me && !moving ? 0.75 : 1;
  ctx.translate(0, bounce);
  ctx.scale(1, crouch * (1 + pop * 0.18));
  ctx.shadowColor = "#0005";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  disk(ctx, 0, -2, 11, "#091c2850");
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (cat) {
    round(ctx, -10, -18, 20, 11, 5, "#f1b58c");
    disk(ctx, 8, -20, 7, "#f4c4a0");
    ctx.fillStyle = "#f4c4a0";
    ctx.beginPath();
    ctx.moveTo(3, -24);
    ctx.lineTo(3, -32);
    ctx.lineTo(10, -26);
    ctx.lineTo(15, -31);
    ctx.lineTo(15, -23);
    ctx.fill();
    ctx.strokeStyle = "#f1b58c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-9, -16);
    ctx.quadraticCurveTo(-21, -24, -18, -31);
    ctx.stroke();
    disk(ctx, 11, -21, 1.4, C.sky);
    round(ctx, -8, -9, 4, 9, 2, C.gold);
    round(ctx, 4, -9, 4, 9, 2, C.gold);
  } else {
    const body = me
      ? C.gold
      : child
        ? "#ed9c8b"
        : kind === "elder"
          ? "#c1b1d3"
          : C.mint;
    const z = child ? 0.79 : 1;
    ctx.scale(z, z);
    const stride = moving && !reduced ? Math.sin(phase * 13) * 5 : 0;
    round(ctx, -9 + stride * 0.3, -13, 7, 14, 3, "#152e3a");
    round(ctx, 2 - stride * 0.3, -13, 7, 14, 3, "#152e3a");
    round(ctx, -12 + stride * 0.3, -3, 11, 4, 2, "#091a24");
    round(ctx, 1 - stride * 0.3, -3, 11, 4, 2, "#091a24");
    if (me) round(ctx, -15, -32, 9, 21, 4, "#94b3b0");
    round(ctx, -11, -34, 23, 25, 7, body);
    round(ctx, -10, -18, 21, 4, 1, me ? "#fff3bf" : "#ffffff40");
    round(ctx, 6, -29, 13, 7, 3, body);
    disk(ctx, 4, -42, 10, "#f4d6ad");
    round(ctx, 3, -44, 13, 7, 2, me ? "#173743" : "#f4d6ad");
    if (me) {
      round(ctx, -8, -51, 23, 9, 5, C.gold);
      round(ctx, -12, -45, 31, 4, 2, C.gold);
      round(ctx, -1, -53, 6, 9, 2, C.bright);
      round(ctx, 8, -27, 6, 8, 2, C.bright);
    } else {
      ctx.fillStyle = kind === "elder" ? "#e7e9df" : "#3c3440";
      ctx.beginPath();
      ctx.arc(3, -45, 10, Math.PI, Math.PI * 2);
      ctx.fill();
      disk(ctx, 9, -41, 1.4, C.sky);
      if (kind === "elder") {
        ctx.strokeStyle = "#e3be85";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(16, -20);
        ctx.lineTo(20, 0);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  if (breath < 99 && kind !== "firefighter") {
    round(ctx, x - 13 * scale, y - 66 * scale, 26 * scale, 5, 3, "#071521");
    round(
      ctx,
      x - 13 * scale,
      y - 66 * scale,
      (26 * scale * Math.max(0, breath)) / 100,
      5,
      3,
      breath < 35 ? "#f49d88" : C.mint,
    );
  }
}
function drawHero() {
  const c = $("hero"),
    q = c.getContext("2d");
  c.width = 560;
  c.height = 200;
  q.scale(2, 2);
  round(q, 34, 8, 212, 87, 14, "#0e2532");
  for (let i = 0; i < 3; i++) {
    round(q, 52 + i * 70, 20, 40, 63, 10, "#42645f");
    round(q, 58 + i * 70, 26, 28, 56, 7, "#9ce3c21b");
  }
  q.strokeStyle = "#52727a";
  q.lineWidth = 3;
  q.beginPath();
  q.moveTo(34, 88);
  q.lineTo(246, 88);
  q.stroke();
  person(q, 140, 89, "firefighter", 100, true, 1, 1.2, 1);
  person(q, 96, 89, "child", 100, true, 1, 0.8, 2);
  person(q, 67, 89, "cat", 100, true, 1, 0.8, 3);
}
function drawResult() {
  const c = $("resultArt"),
    q = c.getContext("2d");
  c.width = 560;
  c.height = 180;
  q.scale(2, 2);
  const n = s.people.length,
    sc = Math.min(1, 230 / ((n + 1) * 40));
  person(q, 140 - n * 20 * sc, 80, "firefighter", 100, false, 1, sc, 1);
  s.people.forEach((p, i) =>
    person(
      q,
      140 - n * 20 * sc + (i + 1) * 40 * sc,
      80,
      p.kind,
      100,
      false,
      1,
      sc,
      1,
    ),
  );
}
function drawClock(f, y) {
  if (y - 20 < worldTop || y + 20 > worldBottom) return;
  const w = wave(s, f),
    x = bx + bw - (landscape ? 63 : 25),
    r = 12;
  if (w.phase2 !== null && w.phase2 !== undefined) {
    g.strokeStyle = "#a6b2d74a";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(
      x,
      y,
      18,
      -Math.PI / 2,
      -Math.PI / 2 + Math.max(0.02, w.phase2) * Math.PI * 2,
    );
    g.stroke();
  }
  g.strokeStyle = "#ffffff20";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, Math.PI * 1.5);
  g.stroke();
  g.strokeStyle = w.smoke > 0.3 ? "#c4b6cc" : w.warning ? C.gold : C.mint;
  g.beginPath();
  g.arc(
    x,
    y,
    r,
    -Math.PI / 2,
    -Math.PI / 2 + Math.max(0.02, w.phase) * Math.PI * 2,
  );
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(
    x + Math.sin(w.phase * Math.PI * 2) * 9,
    y - Math.cos(w.phase * Math.PI * 2) * 9,
  );
  g.stroke();
  if (w.warning) {
    disk(g, x - 29, y, 3, C.gold);
  }
}
function drawFloor(f) {
  const y = yy(f),
    roof = y - fh + 12;
  if (y + 13 < worldTop || roof > worldBottom) return;
  round(g, bx - 4, roof, bw + 8, fh - 10, 4, C.wall);
  round(g, bx + 7, roof + 9, bw - 14, fh - 29, 4, C.room);
  // Door recesses mark the three safe pockets. The full doorway lights up when occupied.
  for (const a of [0, 0.5, 1]) {
    const x = xx(a);
    round(g, x - 18, roof + 22, 36, fh - 39, 8, "#132f37");
    g.fillStyle = "#9ce3c216";
    g.fillRect(x - 17, roof + 22, 34, fh - 39);
    g.strokeStyle = "#9ce3c265";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 17, y - 3);
    g.lineTo(x - 17, roof + 29);
    g.quadraticCurveTo(x - 17, roof + 22, x - 10, roof + 22);
    g.lineTo(x + 10, roof + 22);
    g.quadraticCurveTo(x + 17, roof + 22, x + 17, roof + 29);
    g.lineTo(x + 17, y - 3);
    g.stroke();
    round(g, x - 17, y - 5, 34, 5, 2, C.mint);
    if (fh >= 96) disk(g, x + 9, roof + 58, 2, C.gold);
  }
  const w = wave(s, f);
  if (w.smoke > 0.025 || w.warning) {
    const strength = Math.max(w.smoke, w.warning ? 0.12 : 0),
      dir = f % 2 ? 1 : -1;
    g.save();
    g.beginPath();
    g.rect(bx + 8, roof + 10, bw - 16, fh - 18);
    g.clip();
    for (let i = 0; i < 19; i++) {
      const u = (((i * 0.077 + clock * 0.038 * dir) % 1) + 1) % 1;
      const x = bx + u * bw;
      const vy = roof + 15 + ((i % 3) + 0.5) * (fh - 22) / 3;
      g.globalAlpha = strength * (0.18 + (i % 4) * 0.08);
      disk(g, x, vy, 25 + (i % 5) * 6, C.smoke);
      g.globalAlpha = strength * 0.15;
      disk(g, x - 7, vy - 7, 22, "#b9bcc5");
    }
    if (w.gust) {
      g.strokeStyle = "#dce1ed";
      g.lineWidth = 2;
      g.globalAlpha = strength * 0.6;
      for (let i = 0; i < 10; i++) {
        const x = bx + ((i * 0.19 + clock * 0.8 * dir + 20) % 1) * bw;
        const y = roof + 15 + (i % 5) * (fh - 24) / 5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + dir * 27, y + 1);
        g.stroke();
      }
    }
    g.restore();
  }
  if (w.gust) {
    const x = xx(0.5),
      radius = ALCOVE_RADIUS * (bw - 44);
    round(g, x - radius, y - 5, radius * 2, 5, 2, C.mint);
    g.strokeStyle = C.mint;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x - 18, roof + 22, 36, fh - 39, [8, 8, 3, 3]);
    g.stroke();
  }
  g.fillStyle = C.edge;
  g.fillRect(bx - 5, y, bw + 10, 8);
  g.fillStyle = "#101f2c";
  g.fillRect(bx - 5, y + 8, bw + 10, 5);
  text(String(f).padStart(2, "0"), bx + (landscape ? 53 : 18), roof + 22, 14, C.bright);
  drawClock(f, roof + 23);
  // The rail at each stair makes the zigzag legible.
  if (f > 0) {
    const side = f % 2 ? 0 : 1,
      x = xx(side);
    g.strokeStyle = "#a9bec17a";
    g.lineWidth = 2;
    for (let j = 0; j < 6; j++) {
      const y1 = y + (j * fh) / 6;
      g.beginPath();
      g.moveTo(x + (side ? -13 : 13), y1);
      g.lineTo(x + (side ? 12 : -12), y1);
      g.stroke();
    }
  }
}
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = C.sky;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(
    W * 0.5,
    H * 0.3,
    10,
    W * 0.5,
    H * 0.3,
    H * 0.75,
  );
  glow.addColorStop(0, "#41657333");
  glow.addColorStop(1, "#0a182300");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  // Quiet neighbouring facades and code-drawn rain.
  g.fillStyle = "#ffffff04";
  for (let i = 0; i < 9; i++) {
    const x = (i * 83 + 19) % W;
    g.fillRect(x, 0, 30 + (i % 3) * 10, H);
    for (let j = 0; j < 8; j++)
      round(g, x + 8, j * 103 + 25, 8, 17, 2, "#ffe1a30b");
  }
  if (s) {
    const p = position(s, s.progress);
    cam += (cameraTarget(p) - cam) * 0.12;
    g.save();
    g.beginPath();
    g.rect(0, worldTop, W, worldBottom - worldTop);
    g.clip();
    if (shake > 0 && !reduced)
      g.translate(
        Math.sin(clock * 83) * shake,
        Math.cos(clock * 91) * shake * 0.4,
      );
    const flo = s.config.floors;
    for (let f = 0; f <= flo; f++) drawFloor(f);
    // Street stays in the world as the camera rises.
    const street = yy(0) + (landscape ? 13 : 20);
    const streetLine = street + (landscape ? 2 : 6);
    g.fillStyle = "#18313c";
    g.fillRect(bx - 22, street, W - bx + 22, 70);
    g.strokeStyle = C.mint;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(bx, streetLine);
    g.lineTo(bx + bw, streetLine);
    g.stroke();
    text("STREET", bx + bw / 2, street + (landscape ? 13 : 18), 14, C.mint, "center");
    const folks = s.people.filter((p) => !p.rescued);
    for (const n of folks) {
      const at = position(s, n.progress);
      const x = xx(at.x),
        y = yy(at.y);
      if (y > worldTop && y < worldBottom + 64) {
        if (!n.joined) {
          const markerX = x + (landscape ? 26 : 0);
          const markerY = y - (landscape ? 33 : 70);
          disk(g, markerX, markerY, 11, "#f4ecd618");
          text(n.kind === "cat" ? "♪" : "!", markerX, markerY, 16, C.gold, "center");
        }
        person(
          g,
          x,
          y - 2,
          n.kind,
          n.breath,
          n.joined && (held || keyboard),
          p.x >= 0.5 ? -1 : 1,
          (n.kind === "child" ? 0.9 : 0.85) * (landscape ? 0.76 : 1),
          clock + n.id,
        );
      }
    }
    const x = xx(p.x),
      y = yy(p.y);
    if (safe(s, s.progress)) {
      disk(g, x, y - 2, 23 + Math.sin(clock * 3) * 1.5, "#9ce3c21a");
    }
    person(
      g,
      x,
      y - 2,
      "firefighter",
      s.breath,
      (held || keyboard) && screen === "play",
      Math.sign(position(s, Math.min(s.length, s.progress + 0.025)).x - p.x) ||
        (p.x > 0.5 ? -1 : 1),
      landscape ? 0.76 : 1,
      clock,
    );
    if (s.breath < 40) {
      g.strokeStyle = "#f1a187";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y - 28, 31, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    // Small route chevrons indicate direction without requiring a steering input.
    const target = position(s, Math.min(s.length, s.progress + 0.13));
    if (releaseHint(p)) {
      drawGestureHint(xx(0.5) + (s.returning ? -67 : 67), yy(1) - fh * 0.53, true);
    } else if (!(p.floor === 1 && wave(s, 1).gust && safe(s))) {
      const dx = Math.sign(target.x - p.x),
        dy = Math.sign(target.y - p.y);
      g.globalAlpha = 0.55 + Math.sin(clock * 4) * 0.2;
      g.strokeStyle = C.gold;
      g.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const ax = x + dx * (30 + i * 14),
          ay = y - 18 - dy * (30 + i * 14);
        g.beginPath();
        if (dx) {
          g.moveTo(ax - dx * 5, ay - 5);
          g.lineTo(ax, ay);
          g.lineTo(ax - dx * 5, ay + 5);
        } else {
          g.moveTo(ax - 5, ay + dy * 5);
          g.lineTo(ax, ay);
          g.lineTo(ax + 5, ay + dy * 5);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.restore();
    drawHUD(p);
  }
  for (const b of fx) {
    g.globalAlpha = Math.max(0, b.life / b.max);
    disk(g, b.x, b.y, 3, b.color);
  }
  g.globalAlpha = 1;
  if (screen === "play") {
    const width = Math.min(W - 40, 390),
      x = (W - width) / 2,
      y = worldBottom + 4,
      height = landscape ? 44 : 60;
    round(g, x, y, width, height, 22, "#0b1b27ee");
    g.strokeStyle = held || keyboard ? C.gold : C.mint;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, y, width, height, 22);
    g.stroke();
    const holding = held || keyboard;
    text(
      holding ? "RELEASE TO SHELTER" : "HOLD TO RUN",
      W / 2,
      y + (landscape ? 13 : 23),
      16,
      holding ? C.gold : C.mint,
      "center",
      800,
    );
    text(
      holding
        ? "Keep the whole line together"
        : safe(s, s.progress)
          ? "Sheltered · breathe"
          : "Crouching",
      W / 2,
      y + (landscape ? 31 : 44),
      14,
      C.bright,
      "center",
      400,
    );
    if (toastT > 0) {
      g.globalAlpha = Math.min(1, toastT);
      const { x, y, width, height } = toastBounds();
      round(g, x, y, width, height, 14, "#0b1b27ee");
      text(toast, x + width / 2, y + height / 2, 16, C.bright, "center");
      g.globalAlpha = 1;
    }
    if (idleHint()) {
      const buildingRight = bx + bw;
      const gap = W - right - buildingRight;
      const x = landscape && gap > (reduced ? 115 : 58)
        ? buildingRight + gap / 2
        : W / 2;
      drawGestureHint(x, worldBottom - 74, false);
    }
  }
  for (const b of confetti) {
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.spin + clock * 2);
    g.fillStyle = b.color;
    g.fillRect(-3, -5, 6, 10);
    g.restore();
  }
}
function idleHint() {
  return screen === "play" && !hintDone && hintIdle >= 3;
}
function releaseHint(p) {
  return (
    hintMode !== "0" && screen === "play" && (held || keyboard) &&
    p.floor === 1 && !p.stair && Math.abs(p.corridor - 0.5) < 0.29 &&
    wave(s, 1).gust
  );
}
function toastBounds() {
  const width = Math.min(310, landscape ? W / 2 - right - 68 : W - 50);
  return {
    x: landscape ? W - right - 68 - width : (W - width) / 2,
    y: top + (landscape ? 10 : 82),
    width,
    height: 34,
  };
}
function drawHUD(p) {
  const x = landscape ? left + 18 : Math.max(16, (W - 454) / 2),
    w = Math.min(380, landscape ? W / 2 - x - 12 : W - 88),
    y = top + 14;
  round(g, x - 8, y - 7, w + 9, landscape ? 58 : 70, 18, "#101e2be8");
  text(daily ? `DAILY · ${s.round}` : `LEVEL ${level}`, x, y + 8, 14, C.mint);
  text(
    `${s.returning ? "↓ Street" : "↑ Rescue"} · ${s.people.filter((p) => p.joined || p.rescued).length}/${s.people.length}`,
    x + w - 15,
    y + 8,
    14,
    C.bright,
    "right",
  );
  const bw1 = w - 68;
  round(g, x, y + 30, bw1, 13, 7, "#0a1721");
  round(
    g,
    x,
    y + 30,
    (bw1 * Math.max(0, s.breath)) / 100,
    13,
    7,
    s.breath < 35 ? "#f1a187" : C.gold,
  );
  text(
    `${Math.ceil(Math.max(0, s.breath))}%`,
    x + bw1 + 10,
    y + 36,
    16,
    C.bright,
  );
  const wv = wave(s, Math.round(p.y));
  if (wv.warning || wv.permanent || s.blocked)
    text(
      wv.permanent
        ? "THICK SMOKE"
        : s.blocked
          ? "WAITING FOR CLEAR AIR"
          : "WAVE COMING",
      landscape ? toastBounds().x + toastBounds().width / 2 : W / 2,
      top + (landscape ? 59 : 128),
      14,
      C.gold,
      "center",
    );
}
function tick() {
  const was = s.progress;
  step(s, held || keyboard);
  for (const e of s.events || []) {
    if (
      [
        "join",
        "pickup",
        "joined",
        "rescue",
        "rescued",
        "turn",
        "return",
      ].includes(e.type)
    ) {
      toast =
        e.type === "turn" || e.type === "return"
          ? "Bring them home"
          : "Together. Keep going.";
      toastT = 2.2;
      const p = position(s, s.progress);
      burst(xx(p.x), yy(p.y) - 32, 18, C.mint);
      tone(660, 0.2, 0.06, "triangle", 220);
      pop = 0.3;
      rec.event(e.type, { id: e.id, floor: e.floor });
    }
    if (e.type === "refuse") {
      toast = "Waiting for clear air";
      toastT = 2;
      tone(190, 0.18, 0.05);
    }
    if (e.type === "tower") {
      keepDaily();
      toast = "Next five floors";
      toastT = 3;
      burst(W / 2, H / 2, 30, C.mint);
      tone(784, 0.3, 0.06);
    }
    if (["hit", "cough", "smoke"].includes(e.type)) {
      shake = 3;
      tone(95, 0.1, 0.035);
    }
  }
  if (s.progress > was) {
    stepSound += DT;
    if (stepSound > 0.28) {
      stepSound = 0;
      tone(145 + (Math.floor(s.t * 3) % 2) * 35, 0.035, 0.018, "sine");
      if (!reduced) {
        const p = position(s, s.progress);
        burst(xx(p.x) - 5, yy(p.y), 2, "#d3d6c5");
      }
    }
  }
  const w = wave(s, Math.round(position(s, s.progress).y));
  if (w.warning) {
    hum += DT;
    if (hum > 0.5) {
      hum = 0;
      tone(
        105 + Math.max(w.phase, w.phase2 || 0) * 90,
        0.38,
        0.025,
        "sine",
        50,
      );
    }
  }
  lastWarning = w.warning;
  if (s.over) finish();
}
function frame(now) {
  const delta = Math.min(0.12, (now - last) / 1000);
  last = now;
  clock += delta;
  if (screen === "play" && s && !s.over) {
    if (!hintDone) hintIdle += delta;
    acc += delta;
    while (acc >= DT) {
      acc -= DT;
      tick();
      if (s.over) break;
    }
  }
  shake = Math.max(0, shake - delta * 10);
  pop = Math.max(0, pop - delta * 2);
  toastT = Math.max(0, toastT - delta);
  for (const b of fx) {
    b.life -= delta;
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    b.vy += 100 * delta;
  }
  fx = fx.filter((b) => b.life > 0);
  for (const b of confetti) {
    b.x += b.vx * delta;
    b.y += b.vy * delta;
  }
  confetti = confetti.filter((b) => b.y < H + 20);
  draw();
  requestAnimationFrame(frame);
}
// Snapshot for diagnostics. The explicit advisor is used only by the phone check.
window.breathState = () => ({
  screen,
  held: held || keyboard,
  t: s?.t || 0,
  progress: s?.progress || 0,
  breath: s?.breath ?? 100,
  over: s?.over,
  level,
  daily,
  rescued: s?.rescued || 0,
  stars: s?.stars || 0,
  people: s?.people || [],
  minTouchPx: 48,
  touched,
  sound: save.sound,
  seed: s?.seed,
  date: runDate,
  best: save.best,
  opened: save.opened,
  fx: fx.length,
  confetti: confetti.length,
  hint: idleHint() ? "hold-release" : s && releaseHint(position(s)) ? "release" : null,
  view: {
    top: worldTop,
    bottom: worldBottom,
    floorHeight: fh,
    floors: s ? Array.from({ length: s.config.floors }, (_, i) => yy(i + 1)) : [],
    toast: screen === "play" && toastT > 0 ? toastBounds() : null,
  },
});
window.breathAdvice = () => (s && !s.over ? careful(s) : false);
chooseScreen("menu");
requestAnimationFrame(frame);
