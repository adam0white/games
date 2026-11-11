import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import createMind from '../src/minds/llm.ts';
import { createBackend, createFakeBackend } from '../src/minds/llm-backends.ts';
import { type Observation, PERSONA } from '../src/types.ts';

vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

// Preserve the legacy backend while keeping this test's scratch writes in the OS temporary directory.
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  const redirect = (path: string) =>
    path.replace('/Users/abdul/code/human-framework/scratch/island/', join(tmpdir(), 'island-test/'));
  return {
    ...fs,
    mkdirSync: (path: string) => fs.mkdirSync(redirect(path), { recursive: true }),
    mkdtempSync: (prefix: string) => fs.mkdtempSync(redirect(prefix)),
  };
});

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    episode: 0,
    step: 0,
    stepsLeft: 60,
    text: 'You stand on grass. A cube lies north.',
    events: [],
    actions: [
      { id: 'move N', kind: 'move', label: 'Walk north' },
      { id: 'look', kind: 'look', label: 'Look farther' },
      { id: 'rest', kind: 'rest', label: 'Rest' },
    ],
    task: '',
    seen: {
      here: { height: 1, onSpire: false, terrain: 'grass' },
      spire: null,
      things: [],
      carrying: null,
    },
    ...overrides,
  };
}

const plan = (actions: string[], why = 'I want to explore.') => JSON.stringify({ plan: actions, why });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(execFileSync).mockReset();
  vi.mocked(spawn).mockReset();
});

describe('text mind', () => {
  it('executes a legal plan across steps and asks again when it runs out', async () => {
    const backend = createFakeBackend([plan(['move N', 'look']), plan(['rest'])]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    expect(await mind.step(observation())).toEqual({ action: 'move N', why: 'I want to explore.' });
    expect((await mind.step(observation({ step: 1 }))).action).toBe('look');
    expect(mind.cost().calls).toBe(1);
    expect((await mind.step(observation({ step: 2 }))).action).toBe('rest');
    expect(mind.cost().calls).toBe(2);
    const prompt = backend.prompts[0] ?? '';
    expect(prompt.startsWith(PERSONA)).toBe(true);
    expect(prompt).toContain('1. move N');
    expect(prompt).toContain('2. look');
    expect(prompt).toContain(observation().text);
    expect(prompt).toContain('60');
  });

  it('replans on events and when the next action becomes illegal', async () => {
    const backend = createFakeBackend([plan(['move N', 'move N']), plan(['look', 'move N']), plan(['rest'])]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    await mind.step(observation());
    expect((await mind.step(observation({ step: 1, events: ['A bright flash appears.'] }))).action).toBe(
      'look',
    );
    expect(backend.prompts[1]).toContain('A bright flash appears.');
    expect(
      (await mind.step(observation({ step: 2, actions: [{ id: 'rest', kind: 'rest', label: 'Rest' }] })))
        .action,
    ).toBe('rest');
    expect(mind.cost()).toMatchObject({ calls: 3, invalid: 0 });
  });

  it.each([
    'not json',
    plan(['fly away']),
    plan([]),
    plan(Array.from({ length: 9 }, () => 'look')),
    JSON.stringify({ plan: ['look'], why: 8 }),
  ])('counts invalid output as one rest step: %s', async (response) => {
    const backend = createFakeBackend([response, plan(['look'])]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    expect((await mind.step(observation())).action).toBe('rest');
    expect(mind.cost()).toMatchObject({ calls: 1, invalid: 1 });
    expect((await mind.step(observation({ step: 1 }))).action).toBe('look');
    expect(mind.cost()).toMatchObject({ calls: 2, invalid: 1 });
  });

  it('stops all calls at the call cap, including notes, and rests even with a cached plan', async () => {
    const backend = createFakeBackend([plan(['move N', 'look'])]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend, maxCalls: 1 });
    await mind.step(observation());
    expect(await mind.step(observation({ step: 1 }))).toEqual({
      action: 'rest',
      why: 'call cap reached, resting',
    });
    expect(await mind.endEpisode(observation({ step: 60 }))).toBe('');
    expect(await mind.selfReport?.()).toBeUndefined();
    expect(mind.cost()).toMatchObject({ calls: 1, invalid: 0 });
  });

  it('refuses a call whose maximum price would exceed the remaining USD cap', async () => {
    const backend = createFakeBackend([plan(['look'])]);
    const mind = createMind({
      seed: 1,
      persona: PERSONA,
      backend: { ...backend, estimateMaxUsd: () => 0.02 },
      maxUsd: 0.01,
    });
    expect(await mind.step(observation())).toEqual({ action: 'rest', why: 'cost cap reached, resting' });
    expect(mind.cost()).toMatchObject({ calls: 0, usd: 0 });
  });

  it('stops after spending the USD cap and does not call for episode notes', async () => {
    const backend = createFakeBackend([
      { text: plan(['look', 'move N']), inputTokens: 20, outputTokens: 10, usd: 0.01 },
    ]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend, maxUsd: 0.01 });
    await mind.step(observation());
    expect(await mind.step(observation({ step: 1 }))).toEqual({
      action: 'rest',
      why: 'cost cap reached, resting',
    });
    await mind.endEpisode(observation({ step: 60 }));
    expect(mind.cost()).toMatchObject({ calls: 1, usd: 0.01, invalid: 0 });
  });

  it('uses the default hard call cap of forty', async () => {
    const backend = createFakeBackend(Array.from({ length: 41 }, () => plan(['look'])));
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    for (let step = 0; step < 40; step++)
      expect((await mind.step(observation({ step }))).action).toBe('look');
    expect(await mind.step(observation({ step: 40 }))).toEqual({
      action: 'rest',
      why: 'call cap reached, resting',
    });
    expect(mind.cost().calls).toBe(40);
  });

  it('reserves the maximum charge of a failed request instead of spending that budget again', async () => {
    const mind = createMind({
      seed: 1,
      persona: PERSONA,
      maxUsd: 0.01,
      backend: {
        name: 'fake',
        estimateMaxUsd: () => 0.006,
        complete: async () => {
          throw new Error('Response lost after billing');
        },
      },
    });
    expect((await mind.step(observation())).action).toBe('rest');
    expect(await mind.step(observation({ step: 1 }))).toEqual({
      action: 'rest',
      why: 'cost cap reached, resting',
    });
    expect(mind.cost()).toMatchObject({ calls: 1, usd: 0, unconfirmedUsd: 0.006, invalid: 1 });
  });

  it('accounts for action and note calls, carries bounded notes, and caches the self-report', async () => {
    const longNotes = Array.from({ length: 130 }, (_, i) => `word${i}`).join(' ');
    const backend = createFakeBackend([
      { text: plan(['look', 'move N']), inputTokens: 100, outputTokens: 20, usd: 0.001 },
      {
        text: JSON.stringify({ notes: longNotes, boredom: 7, feeling: 'I wanted to try more.' }),
        inputTokens: 200,
        outputTokens: 150,
        usd: 0.002,
      },
      plan(['rest']),
    ]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    await mind.step(observation({ events: ['You found a marked stone.'] }));
    const notes = await mind.endEpisode(observation({ step: 60 }));
    expect(notes.split(/\s+/)).toHaveLength(120);
    expect(await mind.selfReport?.()).toEqual({ text: 'I wanted to try more.', boredom: 7 });
    expect(await mind.selfReport?.()).toEqual({ text: 'I wanted to try more.', boredom: 7 });
    expect(mind.cost()).toEqual({ calls: 2, inputTokens: 300, outputTokens: 170, usd: 0.003, invalid: 0 });
    expect(backend.prompts[1]).toContain('You found a marked stone.');
    await mind.step(observation({ episode: 1, task: 'Put cubes on the Spire.' }));
    expect(backend.prompts[2]).toContain(notes);
    expect(backend.prompts[2]).toContain('Put cubes on the Spire.');
    expect(backend.prompts[2]).not.toContain('word120');
  });

  it('preserves previous notes and clears stale reports after malformed end-of-episode output', async () => {
    const backend = createFakeBackend([
      JSON.stringify({ notes: 'Remember the shore.', boredom: 4, feeling: 'I feel alert.' }),
      'bad notes json',
    ]);
    const mind = createMind({ seed: 1, persona: PERSONA, backend });
    await mind.endEpisode(observation());
    expect(await mind.endEpisode(observation({ episode: 1 }))).toBe('Remember the shore.');
    expect(await mind.selfReport?.()).toBeUndefined();
  });

  it('rests on transport failure without exposing the underlying error', async () => {
    const mind = createMind({
      seed: 1,
      persona: PERSONA,
      backend: {
        name: 'fake',
        complete: async () => {
          throw new Error('secret transport detail');
        },
      },
    });
    const result = await mind.step(observation());
    expect(result.action).toBe('rest');
    expect(result.why).not.toContain('secret');
    expect(mind.cost()).toMatchObject({ calls: 1, invalid: 1 });
  });
});

describe('Claude transport (mocked, no model calls)', () => {
  it('uses a fresh empty cwd, disables tools, closes stdin, and returns usage', async () => {
    let directory = '';
    let receivedPrompt = '';
    vi.mocked(spawn).mockImplementation((_command, _args, options) => {
      directory = String(options?.cwd);
      expect(readdirSync(directory)).toEqual([]);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const child = Object.assign(new EventEmitter(), { stdin, stdout, stderr, kill: vi.fn() });
      stdin.on('data', (chunk) => {
        receivedPrompt += chunk.toString();
      });
      stdin.on('finish', () => {
        stdout.write(
          JSON.stringify({
            result: plan(['look']),
            usage: {
              input_tokens: 100,
              cache_read_input_tokens: 20,
              cache_creation_input_tokens: 10,
              output_tokens: 50,
            },
            modelUsage: { sonnet: { costUSD: 0.001 } },
          }),
        );
        child.emit('close', 0);
      });
      return child as unknown as ChildProcess;
    });
    const result = await createBackend({ seed: 1, persona: PERSONA, backend: 'claude' }).complete(
      'Test prompt',
    );
    expect(result).toEqual({ text: plan(['look']), inputTokens: 130, outputTokens: 50, usd: 0.001 });
    expect(receivedPrompt).toBe('Test prompt');
    expect(directory).toContain(join(tmpdir(), 'island-test/claude-cwd/call-'));
    expect(existsSync(directory)).toBe(false);
    const [command, args] = vi.mocked(spawn).mock.calls[0] ?? [];
    expect(command).toBe('claude');
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--model',
        'sonnet',
        '--output-format',
        'json',
        '--safe-mode',
        '--strict-mcp-config',
      ]),
    );
    expect(args?.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2)).toEqual(['--tools', '']);
  });
});

describe('Workers AI transport (mocked, no model calls)', () => {
  it('sends the bounded JSON request and accounts at model list price', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.mocked(execFileSync).mockReturnValue('banner\n{"token":"private-test-token"}\n');
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(
        JSON.stringify({
          success: true,
          result: { response: plan(['look']), usage: { prompt_tokens: 100, completion_tokens: 50 } },
        }),
      );
    });
    const backend = createBackend({ seed: 1, persona: PERSONA, backend: 'workers-ai' });
    const result = await backend.complete('A test observation.');
    expect(result).toMatchObject({ text: plan(['look']), inputTokens: 100, outputTokens: 50 });
    expect(result.usd).toBeCloseTo(0.000025, 12);
    expect(requests[0]?.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/run/@cf/google/gemma-4-26b-a4b-it',
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      messages: [{ role: 'user', content: 'A test observation.' }],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });
    expect(backend.estimateMaxUsd?.('hello')).toBeGreaterThan(0.00009);
  });

  it.each([
    ['@cf/google/gemma-4-26b-a4b-it', 0.000025],
    ['@cf/meta/llama-3.2-3b-instruct', 0.00002184],
    ['@cf/qwen/qwen3-30b-a3b-fp8', 0.00002184],
  ])('handles the choices response and list price for %s', async (model, usd) => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.mocked(execFileSync).mockReturnValue('{"token":"test-token"}');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            result: {
              choices: [{ message: { content: plan(['look']) } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            },
          }),
        ),
    );
    const result = await createBackend({ seed: 1, persona: PERSONA, backend: 'workers-ai', model }).complete(
      'test',
    );
    expect(result.text).toBe(plan(['look']));
    expect(result.usd).toBeCloseTo(usd as number, 12);
  });

  it('discovers the account with whoami and reuses credentials across calls', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', undefined);
    const authCommands: string[][] = [];
    vi.mocked(execFileSync).mockImplementation((_file, args) => {
      authCommands.push([...(args ?? [])]);
      return args?.includes('whoami')
        ? '│ Example account │ 0123456789abcdef0123456789abcdef │'
        : '{"token":"test-token"}';
    });
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            result: { response: plan(['rest']), usage: { prompt_tokens: 10, completion_tokens: 5 } },
          }),
        ),
    );
    const backend = createBackend({ seed: 1, persona: PERSONA, backend: 'workers-ai' });
    expect((await backend.complete('first')).text).toBe(plan(['rest']));
    expect((await backend.complete('second')).text).toBe(plan(['rest']));
    expect(authCommands).toEqual([
      ['wrangler', 'auth', 'token', '--json'],
      ['wrangler', 'whoami'],
    ]);
  });

  it.each([undefined, { prompt_tokens: -1, completion_tokens: 2 }, { prompt_tokens: 1 }])(
    'rejects missing or invalid usage instead of reporting a free call',
    async (usage) => {
      vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
      vi.mocked(execFileSync).mockReturnValue('{"token":"test-token"}');
      vi.stubGlobal(
        'fetch',
        async () =>
          new Response(JSON.stringify({ success: true, result: { response: plan(['rest']), usage } })),
      );
      await expect(
        createBackend({ seed: 1, persona: PERSONA, backend: 'workers-ai' }).complete('test'),
      ).rejects.toThrow('Workers AI request failed');
    },
  );

  it.each(['auth', 'http', 'fetch', 'decode'])('never exposes the token on %s errors', async (failure) => {
    const token = 'TOKEN_THAT_MUST_NEVER_LEAK';
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.mocked(execFileSync).mockImplementation(() => {
      if (failure === 'auth') throw new Error(`auth failed ${token}`);
      return JSON.stringify({ token });
    });
    vi.stubGlobal('fetch', async () => {
      if (failure === 'fetch') throw new Error(`request failed ${token}`);
      if (failure === 'http') return new Response(token, { status: 401 });
      return new Response(token);
    });
    let caught: unknown;
    try {
      await createBackend({ seed: 1, persona: PERSONA, backend: 'workers-ai' }).complete('test');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).not.toContain(token);
    expect(JSON.stringify(caught)).not.toContain(token);
    expect((caught as Error).cause).toBeUndefined();
  });
});
