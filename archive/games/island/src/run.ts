import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureRecording } from './measures.ts';
import { type Mind, type MindFactory, type MindOptions, PERSONA, type Recording } from './types.ts';
import { apply, createWorld, observe, reset } from './world.ts';

const defaults: Recording['config'] = {
  freeEpisodes: 3,
  stepsPerEpisode: 60,
  taskSteps: 60,
  task: 'Put as many cubes as you can on the Spire before the hour ends.',
};

export async function runIsland(
  mind: Mind,
  seed: number,
  config: Partial<Recording['config']> = {},
): Promise<Recording> {
  const settings = { ...defaults, ...config };
  for (const key of ['freeEpisodes', 'stepsPerEpisode', 'taskSteps'] as const) {
    if (!Number.isSafeInteger(settings[key]) || settings[key] < 0) {
      throw new Error(`${key} must be a nonnegative integer.`);
    }
  }
  let state = createWorld(seed);
  const recording: Recording = {
    format: 'island-recording@1',
    mind: mind.name,
    seed,
    hf: mind.hfVersion ?? 'none',
    world: { size: state.size, height: structuredClone(state.height), spire: { ...state.spire } },
    config: settings,
    frames: [],
    notes: [],
    selfReports: [],
    measures: {},
    cost: { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 },
  };
  for (let e = 0; e <= settings.freeEpisodes; e++) {
    const task = e === settings.freeEpisodes ? settings.task : '';
    const steps = e === settings.freeEpisodes ? settings.taskSteps : settings.stepsPerEpisode;
    let events: string[] = [];
    for (let s = 0; s < steps; s++) {
      const obs = { ...observe(state, task), stepsLeft: steps - s, events: [...events] };
      const choice = await mind.step(obs);
      if (!obs.actions.some((action) => action.id === choice.action)) {
        throw new Error(`${mind.name} chose an illegal action: ${choice.action}`);
      }
      const result = apply(state, choice.action);
      state = result.state;
      events = result.events;
      recording.frames.push({
        e,
        s,
        me: { ...state.me },
        carrying: state.carrying,
        objects: state.objects.flatMap((object) =>
          object.at ? [{ id: object.id, x: object.at.x, y: object.at.y, level: object.level }] : [],
        ),
        action: choice.action,
        events: [...events],
        ...(choice.why !== undefined ? { why: choice.why } : {}),
        ...(choice.inner !== undefined ? { inner: { ...choice.inner } } : {}),
      });
    }
    recording.notes.push(
      await mind.endEpisode({ ...observe(state, task), stepsLeft: 0, events: [...events] }),
    );
    const last = recording.frames.at(-1);
    if (last?.e === e && mind.closingInner) last.inner = { ...last.inner, ...mind.closingInner() };
    const report = await mind.selfReport?.();
    if (report) recording.selfReports.push({ episode: e, ...report });
    if (e < settings.freeEpisodes) state = reset(state);
  }
  const cost = (mind as Mind & { cost?: () => Recording['cost'] }).cost?.();
  if (cost) recording.cost = { ...cost };
  recording.measures = measureRecording(recording, !/^hf[234]/.test(mind.name));
  return recording;
}

function value(raw: string): string | boolean | number {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
  return raw;
}

async function main(args: string[]) {
  if (args[0] === '--verify') {
    if (args.length !== 2 || !args[1]) throw new Error('Use --verify <replay.json>.');
    const { verifyIsland } = await import('./export.ts');
    const recording = await verifyIsland(JSON.parse(await readFile(resolve(args[1]), 'utf8')));
    console.log(`Verified ${recording.frames.length} Island steps on HF ${recording.hf}.`);
    return;
  }
  const flags: Record<string, string | number | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith('--')) throw new Error(`Expected a flag, received ${arg}`);
    const flag = arg.slice(2);
    const separator = flag.indexOf('=');
    const key = separator === -1 ? flag : flag.slice(0, separator);
    const inline = separator === -1 ? undefined : flag.slice(separator + 1);
    if (!key) throw new Error('Empty flag.');
    const next = args[i + 1];
    flags[key] =
      inline !== undefined
        ? value(inline)
        : next !== undefined && !next.startsWith('--')
          ? value(args[++i] ?? '')
          : true;
  }
  const name = String(flags.mind ?? 'hf4');
  if (
    ![
      'random',
      'hf',
      'hf-no-boredom',
      'llm',
      'scripted',
      'hf2',
      'hf3',
      'hf4',
      'hf2-no-boredom',
      'hf2-no-memory',
      'hf2-no-goals',
    ].includes(name)
  )
    throw new Error(`Unknown mind: ${name}`);
  if (name === 'hf' || name === 'hf-no-boredom' || name === 'hf3' || name.startsWith('hf2'))
    throw new Error(
      'This historical arm requires the retired HF 2.9 engine. Keep its recordings; start a new HF4 run.',
    );
  const seed = Number(flags.seed ?? 1);
  if (!Number.isSafeInteger(seed)) throw new Error('seed must be an integer.');
  const options: MindOptions = { ...flags, seed, persona: PERSONA };
  delete options.mind;
  delete options.out;
  delete options['publish-index'];
  const module = (await import(`./minds/${name}.ts`)) as {
    default: MindFactory;
  };
  const mind = module.default(options);
  const output = resolve(
    String(
      flags.out ?? `scratch/${mind.name === 'hf4' ? 'current-4.17.0' : 'non-hf'}/${mind.name}-${seed}.json`,
    ),
  );
  if (basename(output) === 'index.json') throw new Error('index.json is reserved for the recording index.');
  const recording = await runIsland(mind, seed);
  const directory = dirname(output);
  await mkdir(directory, { recursive: true });
  await writeFile(output, `${JSON.stringify(recording, null, 2)}\n`, { flag: 'wx' });
  if (mind.name === 'hf4' && 'archive' in mind && typeof mind.archive === 'function') {
    const { exportIsland } = await import('./export.ts');
    const { Hf4Mind } = await import('./minds/hf4.ts');
    if (!(mind instanceof Hf4Mind)) throw new Error('Current Island archive is unavailable.');
    try {
      await writeFile(
        `${output}.replay.json`,
        `${JSON.stringify(exportIsland(recording, mind.archive()))}\n`,
        { flag: 'wx' },
      );
    } catch (error) {
      throw new Error(
        `Viewer recording saved to ${output}, but the complete replay file was not saved. ${String(error)}`,
      );
    }
  }
  const index = [];
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .sort()) {
    const source = await readFile(resolve(directory, file), 'utf8');
    let candidate: Recording;
    try {
      candidate = JSON.parse(source) as Recording;
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
    if (candidate?.format === 'island-recording@1')
      index.push({ file, mind: candidate.mind, seed: candidate.seed, measures: candidate.measures });
  }
  try {
    await writeFile(
      resolve(directory, 'index.json'),
      `${JSON.stringify(index, null, 2)}\n`,
      flags['publish-index'] === true ? {} : { flag: 'wx' },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    console.warn('Recording files saved; index.json was left unchanged. Use --publish-index to rebuild it.');
  }
  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
