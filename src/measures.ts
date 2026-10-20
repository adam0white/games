import type { Frame, Recording } from './types.ts';

function actionKind(action: string): string {
  const verb = action.split(' ')[0] ?? '';
  return verb === 'jump' ? 'climb' : verb;
}

/** Derive metrics from post-action frames; never modify the recording. */
export function measureRecording(recording: Recording): Record<string, number> {
  const free = recording.frames.filter((frame) => frame.e < recording.config.freeEpisodes);
  const kinds = new Map<string, number>();
  const episodes = new Map<number, Frame[]>();
  const boredom = new Map<number, { sum: number; count: number }>();
  let idle = 0;
  let entropy = 0;
  let maxStack = 0;
  let ringGlows = 0;
  let rockCubes = 0;
  let freeSpireObjects = 0;
  let finalTask: Frame | undefined;

  function spireObjects(frame: Frame): number {
    return frame.objects.filter(
      (object) => object.x === recording.world.spire.x && object.y === recording.world.spire.y,
    ).length;
  }

  for (const frame of recording.frames) {
    for (const object of frame.objects) maxStack = Math.max(maxStack, object.level + 1);
    for (const event of frame.events) {
      if (event === 'The ring glows.') ringGlows++;
      if (event === 'The rock cracks, and a small cube breaks off.') rockCubes++;
    }
    if (frame.e === recording.config.freeEpisodes && (!finalTask || frame.s >= finalTask.s)) {
      finalTask = frame;
    }
  }

  for (const frame of free) {
    const kind = actionKind(frame.action);
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    if (kind === 'rest' || kind === 'look') idle++;
    const episode = episodes.get(frame.e) ?? [];
    episode.push(frame);
    episodes.set(frame.e, episode);
    freeSpireObjects = Math.max(freeSpireObjects, spireObjects(frame));
    const reading = frame.inner?.boredom;
    if (reading !== undefined) {
      const aggregate = boredom.get(frame.e) ?? { sum: 0, count: 0 };
      aggregate.sum += reading;
      aggregate.count++;
      boredom.set(frame.e, aggregate);
    }
  }
  for (const count of kinds.values()) {
    const probability = count / free.length;
    entropy -= probability * Math.log2(probability);
  }

  const windows = new Map<string, { count: number; variants: Set<string> }>();
  let totalWindows = 0;
  for (const frames of episodes.values()) {
    for (let i = 0; i + 4 <= frames.length; i++) {
      const window = frames.slice(i, i + 4);
      const key = JSON.stringify(window.map((frame) => actionKind(frame.action)));
      const group = windows.get(key) ?? { count: 0, variants: new Set<string>() };
      group.count++;
      group.variants.add(JSON.stringify(window.map((frame) => frame.action)));
      windows.set(key, group);
      totalWindows++;
    }
  }
  let variedWindows = 0;
  for (const group of windows.values()) {
    if (group.variants.size > 1) variedWindows += group.count;
  }

  const measures: Record<string, number> = {
    // Distinct post-action cells visited during free episodes.
    cellsVisited: new Set(free.map((frame) => `${frame.me.x},${frame.me.y}`)).size,
    // Distinct exact action ids chosen during free episodes.
    distinctActs: new Set(free.map((frame) => frame.action)).size,
    // Shannon entropy in bits over free action kinds; jump counts as climb.
    kindEntropy: entropy,
    // Share of episode-local free four-action windows with repeated kinds and differing arguments.
    repeatWithVariation: totalWindows ? variedWindows / totalWindows : 0,
    // Highest object stack level plus one across all frames; zero when no objects appear.
    maxStack,
    // Number of canonical ring-glow events across all frames.
    ringGlows,
    // Number of canonical rock-created-cube events across all frames.
    rockCubes,
    // Share of free actions that are rest or look.
    idleShare: free.length ? idle / free.length : 0,
    // Largest number of objects on the Spire in any free frame.
    freeSpireObjects,
    // Number of cubes on the Spire in the final task frame; zero without a task frame.
    taskScore: finalTask
      ? finalTask.objects.filter(
          (object) =>
            object.id.startsWith('cube-') &&
            object.x === recording.world.spire.x &&
            object.y === recording.world.spire.y,
        ).length
      : 0,
  };
  // boredomMeanN is the mean of available inner.boredom readings in free episode N; absent if none.
  for (const [episode, aggregate] of boredom)
    measures[`boredomMean${episode}`] = aggregate.sum / aggregate.count;
  return measures;
}
