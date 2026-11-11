export interface SceneFrame {
  age: number;
  phase: "prepare" | "movement" | "aftermath" | "ending";
  action: string | null;
  available: boolean;
  flood: boolean;
  food: number;
  repairs: number;
  chapter: number;
}

type Ink = {
  line(points: number[], color: number, width?: number, alpha?: number): void;
  circle(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha?: number,
  ): void;
  polygon(points: number[], color: number, alpha?: number): void;
  clear(): void;
};
const C = {
  linen: 0xede4cf,
  dark: 0x343d39,
  thread: 0xa34f35,
  teal: 0x547b75,
  pale: 0xc3c9af,
  water: 0x789991,
  gold: 0xbc9560,
};
const W = 720,
  H = 380;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function stitch(
  p: Ink,
  points: number[],
  color = C.dark,
  width = 1.8,
  dash = 5,
) {
  for (let i = 2; i < points.length; i += 2) {
    const x = points[i - 2] ?? 0,
      y = points[i - 1] ?? 0,
      dx = (points[i] ?? 0) - x,
      dy = (points[i + 1] ?? 0) - y;
    const length = Math.hypot(dx, dy);
    for (let d = 0; d < length; d += dash * 1.8) {
      const end = Math.min(d + dash, length);
      p.line(
        [
          x + (dx * d) / length,
          y + (dy * d) / length,
          x + (dx * end) / length,
          y + (dy * end) / length,
        ],
        color,
        width,
      );
    }
  }
}
function jar(p: Ink, x: number, y: number, full = true, scale = 1) {
  p.polygon(
    [
      x - 8 * scale,
      y - 13 * scale,
      x + 8 * scale,
      y - 13 * scale,
      x + 12 * scale,
      y + 3 * scale,
      x + 7 * scale,
      y + 12 * scale,
      x - 7 * scale,
      y + 12 * scale,
      x - 12 * scale,
      y + 3 * scale,
    ],
    C.gold,
  );
  stitch(
    p,
    [
      x - 8 * scale,
      y - 13 * scale,
      x - 12 * scale,
      y + 3 * scale,
      x - 7 * scale,
      y + 12 * scale,
      x + 7 * scale,
      y + 12 * scale,
      x + 12 * scale,
      y + 3 * scale,
      x + 8 * scale,
      y - 13 * scale,
    ],
    C.thread,
    1.4,
    3,
  );
  p.line(
    [x - 7 * scale, y - 13 * scale, x + 7 * scale, y - 13 * scale],
    C.dark,
    2,
  );
  if (full)
    p.line(
      [x - 5 * scale, y - 7 * scale, x + 5 * scale, y - 7 * scale],
      C.teal,
      3,
    );
}
function person(
  p: Ink,
  x: number,
  y: number,
  color: number,
  size = 1,
  pose = "stand",
  step = 0,
) {
  const s = size;
  p.circle(x, y - 36 * s, 6 * s, C.linen);
  stitch(
    p,
    [
      x - 5 * s,
      y - 40 * s,
      x + 4 * s,
      y - 42 * s,
      x + 7 * s,
      y - 36 * s,
      x + 3 * s,
      y - 30 * s,
      x - 5 * s,
      y - 32 * s,
      x - 5 * s,
      y - 40 * s,
    ],
    color,
    1.7,
    2.4,
  );
  p.polygon(
    [
      x - 5 * s,
      y - 28 * s,
      x + 5 * s,
      y - 28 * s,
      x + 10 * s,
      y - 8 * s,
      x - 10 * s,
      y - 8 * s,
    ],
    color,
    0.85,
  );
  stitch(
    p,
    [
      x - 5 * s,
      y - 27 * s,
      x - 10 * s,
      y - 8 * s,
      x + 10 * s,
      y - 8 * s,
      x + 5 * s,
      y - 27 * s,
    ],
    color,
    1.6,
    3,
  );
  const stride = pose === "walk" ? Math.sin(step) * 7 * s : 2 * s;
  p.line([x - 3 * s, y - 8 * s, x - 5 * s - stride, y], color, 2.5);
  p.line([x + 3 * s, y - 8 * s, x + 5 * s + stride, y], color, 2.5);
  const arms =
    pose === "refuse"
      ? [x - 19 * s, y - 24 * s, x, y - 23 * s, x + 22 * s, y - 24 * s]
      : pose === "count"
        ? [
            x - 14 * s,
            y - 13 * s,
            x - 4 * s,
            y - 23 * s,
            x + 6 * s,
            y - 22 * s,
            x + 21 * s,
            y - 12 * s,
          ]
        : pose === "look"
          ? [
              x - 11 * s,
              y - 12 * s,
              x - 4 * s,
              y - 24 * s,
              x + 6 * s,
              y - 24 * s,
              x + 11 * s,
              y - 37 * s,
            ]
          : pose === "freeze"
            ? [
                x - 15 * s,
                y - 19 * s,
                x - 5 * s,
                y - 25 * s,
                x + 5 * s,
                y - 25 * s,
                x + 15 * s,
                y - 19 * s,
              ]
            : [
                x - 12 * s,
                y - 12 * s,
                x - 5 * s,
                y - 25 * s,
                x + 5 * s,
                y - 25 * s,
                x + 12 * s,
                y - 12 * s,
              ];
  p.line(arms, color, 2.5);
}
function draw(
  p: Ink,
  frame: SceneFrame,
  progress: number,
  clock: number,
  reduced: boolean,
) {
  p.clear();
  p.polygon([0, 0, W, 0, W, H, 0, H], C.linen);
  // Irregular warp and weft: the scene is a sewn sampler, including its paths.
  for (let y = 7; y < H; y += 9)
    p.line([0, y, W, y + Math.sin(y) * 1.2], C.dark, 0.45, 0.055);
  for (let x = 5; x < W; x += 9)
    p.line([x, 0, x + 1, H], C.thread, 0.45, 0.055);
  stitch(p, [15, 15, 705, 15, 705, 365, 15, 365, 15, 15], C.thread, 1.5, 5);
  stitch(p, [22, 22, 698, 22, 698, 358, 22, 358, 22, 22], C.thread, 0.7, 3);
  // Small repeated border flowers.
  for (let x = 45; x < 700; x += 44) {
    p.line([x, 32, x, 41], C.teal, 1);
    p.line([x - 3, 35, x + 3, 39, x + 3, 35, x - 3, 39], C.thread, 1);
    p.line([x, 339, x, 348], C.teal, 1);
    p.line([x - 3, 341, x + 3, 345, x + 3, 341, x - 3, 345], C.thread, 1);
  }
  // Upper path and lower path remain visible as two physically different choices.
  stitch(p, [142, 232, 233, 168, 346, 104, 460, 112, 552, 163], C.gold, 5, 7);
  stitch(p, [145, 238, 267, 271, 405, 282, 550, 221], C.gold, 5, 7);
  if (frame.flood) {
    p.polygon(
      [245, 252, 313, 244, 395, 261, 445, 280, 415, 303, 326, 296, 257, 278],
      C.water,
      0.38,
    );
    for (let n = 0; n < 5; n++)
      stitch(
        p,
        [
          270 + n * 9,
          263 + n * 5,
          315 + n * 11,
          260 + n * 5,
          353 + n * 11,
          270 + n * 4,
        ],
        C.teal,
        1.5,
        5,
      );
  }
  // Home: an open doorway with household stores.
  p.polygon([65, 156, 114, 113, 163, 156, 157, 227, 72, 227], C.pale, 0.58);
  stitch(p, [59, 156, 114, 110, 169, 156], C.thread, 3, 6);
  stitch(p, [72, 160, 72, 227, 157, 227, 157, 160], C.dark, 2, 5);
  p.polygon([100, 184, 125, 184, 125, 228, 100, 228], C.dark, 0.8);
  for (let n = 0; n < Math.max(1, Math.min(5, Math.ceil(frame.food))); n++)
    jar(p, 76 + n * 19, 255, n < frame.food, 0.66);
  // Hills and a reserve spring at the end of the upper path.
  stitch(
    p,
    [230, 134, 272, 88, 298, 110, 336, 66, 382, 115, 419, 82, 464, 126],
    C.teal,
    2,
    5,
  );
  for (let n = 0; n < 3; n++)
    p.line([404 + n * 8, 136, 409 + n * 8, 143, 405 + n * 8, 150], C.teal, 1.4);
  // The well, with a small roof and a visibly worn/repaired brace.
  p.circle(563, 198, 32, C.teal, 0.18);
  stitch(p, [531, 197, 535, 220, 563, 230, 593, 220, 596, 197], C.dark, 2.4, 4);
  p.line(
    [532, 197, 547, 187, 578, 187, 595, 197, 579, 207, 548, 207, 532, 197],
    C.dark,
    2,
  );
  stitch(p, [537, 190, 537, 147, 587, 147, 587, 191], C.thread, 2.5, 4);
  p.line([527, 149, 562, 129, 597, 149], C.thread, 3);
  p.line([562, 150, 562, 186], C.dark, 1.5);
  if (frame.repairs > 0) p.line([539, 180, 552, 151], C.teal, 3);
  else stitch(p, [583, 166, 592, 174, 582, 184], C.thread, 2, 3);
  if (frame.available) person(p, 615, 191, C.teal, 1.06);
  // Waiting households are stitched into the right margin.
  person(p, 610, 296, C.dark, 0.86);
  person(p, 646, 308, C.teal, 0.9);
  person(p, 677, 293, C.gold, 0.72);
  jar(p, 597, 311, false, 0.65);
  jar(p, 635, 324, false, 0.65);
  person(p, 181, 234, C.teal, 1.08); // Zehra remains a visible body at home.
  const action = frame.action || "";
  const active =
    frame.phase === "movement" ||
    frame.phase === "aftermath" ||
    frame.phase === "ending";
  const t = active ? progress : 0;
  const eased = t * t * (3 - 2 * t);
  const target: [number, number] =
    action === "look"
      ? [370, 128]
      : action === "wait"
        ? [520, 228]
        : action === "refuse"
          ? [564, 294]
          : action === "freeze"
            ? [324, 225]
            : action === "count"
              ? [291, 302]
              : [256, 232];
  let x = mix(227, target[0], eased),
    y = mix(240, target[1], eased);
  if (action === "look") y -= Math.sin(t * Math.PI) * 48;
  const walking = active && t < 0.98 && !reduced && action !== "freeze";
  const pose = walking ? "walk" : active ? action : "stand";
  const size = 0.68 + Math.min(18, frame.age) / 60;
  person(p, x, y, C.thread, size, pose, clock / 100);
  if (active && action === "count") {
    for (let n = 0; n < 4; n++) {
      jar(p, 319 + n * 31, 315, n < 3, 0.8);
      if (t > n / 5)
        stitch(
          p,
          [314 + n * 31, 286, 318 + n * 31, 290, 326 + n * 31, 280],
          C.thread,
          1.8,
          3,
        );
    }
  }
  if (active && action === "freeze") {
    stitch(p, [x - 22, y + 10, x - 32, y - 1, x - 24, y - 12], C.thread, 2, 3);
    stitch(p, [x + 22, y + 10, x + 32, y - 1, x + 24, y - 12], C.thread, 2, 3);
  }
  if (active && action === "wait") {
    jar(p, x + 22, y - 3, false, 0.65);
    p.line([x - 14, y + 8, x + 14, y + 8], C.thread, 1.6);
  }
  if (active && action === "refuse")
    stitch(p, [583, 266, 583, 313], C.thread, 2.2, 4);
}

export async function createRenderer(
  host: HTMLElement,
  forceCanvas = false,
): Promise<{ update(frame: SceneFrame): void; destroy(): void; kind: string }> {
  let app: import("pixi.js").Application | undefined;
  let canvas: HTMLCanvasElement = document.createElement("canvas");
  let pen: Ink | undefined;
  let kind = "canvas2d";
  if (!forceCanvas) {
    try {
      const { Application, Graphics } = await import("pixi.js");
      app = new Application();
      await app.init({
        width: W,
        height: H,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: "webgl",
      });
      const graphic = new Graphics();
      app.stage.addChild(graphic);
      pen = {
        clear: () => graphic.clear(),
        line: (pts, color, width = 1, alpha = 1) => {
          graphic.moveTo(pts[0] ?? 0, pts[1] ?? 0);
          for (let i = 2; i < pts.length; i += 2)
            graphic.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
          graphic.stroke({ color, width, alpha });
        },
        circle: (x, y, r, color, alpha = 1) => {
          graphic.circle(x, y, r).fill({ color, alpha });
        },
        polygon: (pts, color, alpha = 1) => {
          graphic.poly(pts).fill({ color, alpha });
        },
      };
      canvas = app.canvas;
      kind = "pixi";
      app.stop();
    } catch {
      try {
        app?.destroy(true);
      } catch {
        /* A partially initialized renderer may have no view. */
      }
      app = undefined;
    }
  }
  if (!app) {
    canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A canvas renderer is unavailable.");
    const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
    pen = {
      clear: () => context.clearRect(0, 0, W, H),
      line: (pts, color, width = 1, alpha = 1) => {
        context.globalAlpha = alpha;
        context.strokeStyle = css(color);
        context.lineWidth = width;
        context.beginPath();
        context.moveTo(pts[0] ?? 0, pts[1] ?? 0);
        for (let i = 2; i < pts.length; i += 2)
          context.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
        context.stroke();
        context.globalAlpha = 1;
      },
      circle: (x, y, r, color, alpha = 1) => {
        context.globalAlpha = alpha;
        context.fillStyle = css(color);
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      },
      polygon: (pts, color, alpha = 1) => {
        context.globalAlpha = alpha;
        context.fillStyle = css(color);
        context.beginPath();
        context.moveTo(pts[0] ?? 0, pts[1] ?? 0);
        for (let i = 2; i < pts.length; i += 2)
          context.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
        context.closePath();
        context.fill();
        context.globalAlpha = 1;
      },
    };
  }
  if (!pen) throw new Error("A drawing surface is unavailable.");
  const scenePen = pen;
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame: SceneFrame = {
    age: 3,
    phase: "prepare",
    action: null,
    available: true,
    flood: false,
    food: 3,
    repairs: 2,
    chapter: 0,
  };
  let started = performance.now(),
    raf = 0,
    dead = false;
  function paint(now: number) {
    if (dead) return;
    const progress =
      motion.matches || frame.phase !== "movement"
        ? 1
        : Math.min(1, (now - started) / 3400);
    draw(scenePen, frame, progress, now, motion.matches);
    app?.render();
    if (frame.phase === "movement" && progress < 1)
      raf = requestAnimationFrame(paint);
  }
  function resize() {
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight || (width * H) / W);
    if (app) {
      app.renderer.resize(width, height);
      app.stage.scale.set(width / W, height / H);
    } else {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas
        .getContext("2d")
        ?.setTransform((width * dpr) / W, 0, 0, (height * dpr) / H, 0, 0);
    }
    cancelAnimationFrame(raf);
    paint(performance.now());
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const motionChange = () => {
    cancelAnimationFrame(raf);
    paint(performance.now());
  };
  motion.addEventListener("change", motionChange);
  return {
    kind,
    update(next) {
      if (
        next.phase === "movement" &&
        (frame.phase !== "movement" ||
          next.action !== frame.action ||
          next.chapter !== frame.chapter)
      )
        started = performance.now();
      frame = { ...next };
      cancelAnimationFrame(raf);
      paint(performance.now());
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener("change", motionChange);
      if (app) app.destroy(true, { children: true });
      else canvas.remove();
    },
  };
}
