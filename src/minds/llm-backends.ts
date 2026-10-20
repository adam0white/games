import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import type { MindOptions } from '../types.ts';

export interface BackendResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export interface LlmBackend {
  name: string;
  complete(prompt: string): Promise<BackendResponse>;
  estimateMaxUsd?(prompt: string): number;
}

export const WORKERS_PRICES: Record<string, readonly [number, number]> = {
  '@cf/google/gemma-4-26b-a4b-it': [0.1, 0.3],
  '@cf/meta/llama-3.2-3b-instruct': [0.0509, 0.335],
  '@cf/qwen/qwen3-30b-a3b-fp8': [0.0509, 0.335],
};
const MAX_OUTPUT = 1024 * 1024;
const TIMEOUT = 60_000;
const PATH = `/opt/homebrew/bin:${process.env.PATH ?? ''}`;
const scratch = '/Users/abdul/code/human-framework/scratch/island/claude-cwd';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid backend response');
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid backend usage');
  return value;
}

export function createFakeBackend(
  responses: readonly (string | BackendResponse)[],
): LlmBackend & { prompts: string[] } {
  let index = 0;
  const prompts: string[] = [];
  return {
    name: 'fake',
    prompts,
    async complete(prompt) {
      prompts.push(prompt);
      const response = responses[index++];
      if (response === undefined) throw new Error('Fake backend responses exhausted');
      return typeof response === 'string'
        ? { text: response, inputTokens: 0, outputTokens: 0, usd: 0 }
        : { ...response };
    },
  };
}

function workersBackend(options: MindOptions): LlmBackend {
  const model = typeof options.model === 'string' ? options.model : '@cf/google/gemma-4-26b-a4b-it';
  const prices = Object.hasOwn(WORKERS_PRICES, model) ? WORKERS_PRICES[model] : undefined;
  if (!prices) throw new Error('Unsupported Workers AI model');
  let credentials: { token: string; account: string } | undefined;
  function auth() {
    if (credentials) return credentials;
    try {
      const settings = {
        encoding: 'utf8' as const,
        timeout: TIMEOUT,
        maxBuffer: MAX_OUTPUT,
        env: { ...process.env, PATH },
        stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
      };
      const token = execFileSync('npx', ['wrangler', 'auth', 'token'], settings).trim();
      const account =
        process.env.CLOUDFLARE_ACCOUNT_ID ||
        execFileSync('npx', ['wrangler', 'whoami'], settings).match(/\b[a-f\d]{32}\b/i)?.[0];
      if (!token || !account || !/^[a-f\d]{32}$/i.test(account)) throw new Error();
      credentials = { token, account };
      return credentials;
    } catch {
      throw new Error('Workers AI authentication failed');
    }
  }
  return {
    name: 'workers-ai',
    // One UTF-8 byte per input token is a conservative upper bound; include chat framing.
    estimateMaxUsd: (prompt) =>
      ((Buffer.byteLength(prompt, 'utf8') + 1024) * prices[0] + 300 * prices[1]) / 1_000_000,
    async complete(prompt) {
      try {
        const { token, account } = auth();
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              max_tokens: 300,
              ...(options.responseFormat === false ? {} : { response_format: { type: 'json_object' } }),
            }),
            signal: AbortSignal.timeout(TIMEOUT),
          },
        );
        if (!response.ok || !response.body) throw new Error();
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > MAX_OUTPUT) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(chunk.value);
        }
        const body = record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        if (body.success === false) throw new Error();
        const result = record(body.result);
        const usage = record(result.usage);
        const inputTokens = count(usage.prompt_tokens);
        const outputTokens = count(usage.completion_tokens);
        const firstChoice = Array.isArray(result.choices) ? result.choices[0] : undefined;
        const responseText =
          typeof result.response === 'string' ? result.response : record(record(firstChoice).message).content;
        if (typeof responseText !== 'string') throw new Error();
        return {
          text: responseText,
          inputTokens,
          outputTokens,
          usd: (inputTokens * prices[0] + outputTokens * prices[1]) / 1_000_000,
        };
      } catch {
        throw new Error('Workers AI request failed');
      }
    },
  };
}

function claudeBackend(options: MindOptions): LlmBackend {
  const model = typeof options.model === 'string' ? options.model : 'sonnet';
  return {
    name: 'claude',
    async complete(prompt) {
      let cwd: string | undefined;
      try {
        mkdirSync(scratch, { recursive: true });
        cwd = mkdtempSync(`${scratch}/call-`);
        const text = await new Promise<string>((resolve, reject) => {
          const child = spawn(
            'claude',
            [
              '-p',
              '--model',
              model,
              '--output-format',
              'json',
              '--tools',
              '',
              '--safe-mode',
              '--restricted',
              '--strict-mcp-config',
              '--mcp-config',
              '{}',
              '--disable-slash-commands',
              '--no-session-persistence',
              '--setting-sources',
              '',
              '--no-chrome',
              '--permission-prompts',
              'none',
              '--system-prompt',
              'Return only the requested JSON. You have no tools or access to files.',
            ],
            { cwd, env: { ...process.env, PATH }, stdio: ['pipe', 'pipe', 'pipe'] },
          );
          const chunks: Buffer[] = [];
          let size = 0;
          let settled = false;
          const fail = () => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            clearTimeout(timer);
            reject(new Error('Claude request failed'));
          };
          const timer = setTimeout(fail, TIMEOUT);
          child.on('error', fail);
          child.stdin.on('error', fail);
          child.stdout.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_OUTPUT) fail();
            else chunks.push(chunk);
          });
          child.stderr.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_OUTPUT) fail();
          });
          child.on('close', (code) => {
            clearTimeout(timer);
            if (settled) return;
            settled = true;
            if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
            else reject(new Error('Claude request failed'));
          });
          child.stdin.end(prompt);
        });
        const result = record(JSON.parse(text));
        if (result.is_error || typeof result.result !== 'string') throw new Error();
        const usage = record(result.usage);
        const inputTokens =
          count(usage.input_tokens) +
          count(usage.cache_read_input_tokens ?? 0) +
          count(usage.cache_creation_input_tokens ?? 0);
        const outputTokens = count(usage.output_tokens);
        const models = record(result.modelUsage);
        const costs = Object.values(models).map((value) => {
          const entry = record(value);
          return count(entry.costUSD ?? entry.cost);
        });
        if (costs.length === 0) throw new Error();
        return {
          text: result.result,
          inputTokens,
          outputTokens,
          usd: costs.reduce((sum, cost) => sum + cost, 0),
        };
      } catch {
        throw new Error('Claude request failed');
      } finally {
        if (cwd) {
          try {
            rmSync(cwd, { recursive: true, force: true });
          } catch {
            // The directory began empty; cleanup failure must not expose transport details.
          }
        }
      }
    },
  };
}

export function createBackend(options: MindOptions): LlmBackend {
  const backend = options.backend;
  if (
    backend &&
    typeof backend === 'object' &&
    'complete' in backend &&
    typeof backend.complete === 'function' &&
    'name' in backend &&
    typeof backend.name === 'string'
  )
    return backend as LlmBackend;
  if (backend === 'fake') {
    if (!Array.isArray(options.responses)) throw new Error('Fake backend requires responses');
    return createFakeBackend(options.responses);
  }
  if (backend === 'claude') return claudeBackend(options);
  if (backend === undefined || backend === 'workers-ai') return workersBackend(options);
  throw new Error('Unsupported LLM backend');
}
