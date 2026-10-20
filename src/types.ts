/**
 * The contract every part of the island shares. The world, the minds, the runner and the viewer meet here.
 *
 * Fairness rule: every mind gets the same `Observation` text and the same legal `Action` list each step, the same
 * number of steps per episode, the same resets, and the same chance to carry something across resets (`notes` for
 * text minds, Person state for HF minds). No mind sees the world's code or state beyond the observation.
 */

/** A grid cell. x grows east, y grows south. */
export interface Cell {
  x: number;
  y: number;
}

export type ObjectKind = 'cube' | 'rock' | 'ring';

export interface WorldObject {
  id: string; // 'cube-1', 'rock', 'ring'
  kind: ObjectKind;
  at: Cell | null; // null while carried
  /** Stack level on its cell, 0 = on the ground. */
  level: number;
}

/** Full world state: plain JSON, seeded RNG inside, never shown to a mind. */
export interface WorldState {
  seed: number;
  rng: number; // RNG state
  size: number; // island is size x size; the rim is water
  height: number[][]; // [y][x], 0 = water, 1..4 = land height
  spire: Cell; // the highest hilltop, named "the Spire" in observations
  me: Cell;
  carrying: string | null;
  objects: WorldObject[];
  episode: number;
  step: number;
  /** Counters for measures only; never in observations. */
  found: { rockMakesCube: number; ringGlow: number };
}

/** One legal action this step. `id` is stable text such as 'move N', 'pick cube-3', 'throw rock E hard'. */
export interface Action {
  id: string;
  /** Class for metrics: move | climb | pick | place | throw | rest | look. */
  kind: string;
  /** Plain words, as an LLM mind sees it. */
  label: string;
}

export interface Observation {
  episode: number;
  step: number;
  stepsLeft: number;
  /** What the body sees and feels now, in plain words (the only world description any mind gets). */
  text: string;
  /** What just happened as a result of the last action or around the mind, plain words. */
  events: string[];
  actions: Action[];
  /** Set during the later task episode only; empty during free time. */
  task: string;
  /**
   * The same facts as `text`, machine-readable, for minds that do not read prose (HF, random). It never holds more
   * than `text` says: anything here must also be in `text`, and the reverse.
   */
  seen: {
    here: { height: number; onSpire: boolean; terrain: string };
    spire: { dx: number; dy: number } | null; // null when out of sight
    things: { id: string; kind: ObjectKind; dx: number; dy: number; level: number; inRing: boolean }[];
    carrying: string | null;
  };
}

/** HF2 goal audit. HF proposals adopt immediately in the public API. */
export interface GoalReading {
  id: string;
  label: string;
  minute: number;
  status: 'active' | 'achieved' | 'abandoned';
  source: 'hf' | 'task';
  proposed: boolean;
  adopted: boolean;
}
export interface Inner {
  [key: string]: number | GoalReading[] | undefined;
  boredom?: number;
  engagement?: number;
  rememberedTargetMove?: number;
  goals?: GoalReading[];
}

/** A mind chooses one action id from `obs.actions`, may keep notes, and may report itself. */
export interface MindStep {
  action: string;
  /** Text minds: their short reason, as given. HF minds: the top scored terms. */
  why?: string;
  /** HF readings and, for HF2, goal audit records. Text minds: omitted. */
  inner?: Inner;
}

export interface Mind {
  name: string; // 'hf', 'hf-no-boredom', 'random', 'llm-workers-ai', 'llm-claude'
  /** Called once per step. May be async (LLM minds). */
  step(obs: Observation): MindStep | Promise<MindStep>;
  /** Called at each reset, before the world resets. Text minds return notes they keep; HF minds may return a gist. */
  endEpisode(obs: Observation): string | Promise<string>;
  /** Optional final outcome readings, merged into the last frame of the episode. */
  closingInner?(): Inner;
  /** LLM minds: a self-report of boredom/interest, in its own words plus a 0..10 number. HF minds: none. */
  selfReport?(): Promise<{ text: string; boredom: number } | undefined>;
}

/** One recorded step. */
export interface Frame {
  e: number; // episode
  s: number; // step
  me: Cell;
  carrying: string | null;
  objects: { id: string; x: number; y: number; level: number }[]; // carried objects omitted
  action: string;
  events: string[];
  why?: string;
  inner?: Inner;
}

export interface Recording {
  format: 'island-recording@1';
  mind: string;
  seed: number;
  hf: string; // exact HF package version, '2.9.0'
  world: { size: number; height: number[][]; spire: Cell };
  config: { freeEpisodes: number; stepsPerEpisode: number; taskSteps: number; task: string };
  frames: Frame[];
  notes: string[]; // what the mind carried out of each episode
  selfReports: { episode: number; text: string; boredom: number }[];
  measures: Record<string, number>;
  /** Text minds: calls made and list-price cost; HF and random: zero. */
  cost: { calls: number; inputTokens: number; outputTokens: number; usd: number };
}

/**
 * Every mind module in src/minds/<name>.ts default-exports a factory. The runner picks the module by name:
 * `random`, `hf` (options.boredom false gives the `hf-no-boredom` arm), `llm` (options.backend picks the model).
 */
export interface MindOptions {
  seed: number;
  /** Plain-words persona every mind shares: HF reads it as temperament, LLMs read it as text. */
  persona: string;
  [key: string]: unknown;
}
export type MindFactory = (options: MindOptions) => Mind;

/** The persona all minds share (Eko's SOUL.md described its agent as curious and easily bored). */
export const PERSONA = 'You are curious and easily bored. Nobody has given you a task.';
