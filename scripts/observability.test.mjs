// Every Worker that runs code keeps logs, traces and Issues on (workers/OBSERVABILITY.md).
// A Worker with a written privacy reason is listed in EXCEPTIONS with what it may leave off.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { observability } from '../worker-settings.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Worker name -> why its request logs and traces stay off. Issues must still be on unless `issues: false`.
// Changing an entry is an owner decision: these Workers promise players or testers that requests are not logged.
export const EXCEPTIONS = {
  'games-feedback': { reason: 'note text, tokens and tester ids never reach logs (workers/feedback)', issues: false },
  'games-lab-ai': { reason: 'no request logging (workers/lab-ai README)', issues: false },
};

/** Strips comments and trailing commas outside strings, then parses. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; text[i] !== '"'; i++) if (text[i] === '\\') i++;
      out += text.slice(start, i + 1);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function configs(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'archive', 'dist', '.wrangler'].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) configs(path, found);
    else if (/^wrangler\.jsonc?$/.test(entry)) found.push(path);
  }
  return found;
}

const rate = value => typeof value === 'number' && value > 0 && value <= 1;
/** Returns what is wrong with one parsed Worker config; an empty list means it passes. */
export function problems(config) {
  if (!config.main) return [];
  const o = config.observability ?? {};
  const exception = EXCEPTIONS[config.name];
  const wrong = [];
  if (exception) {
    if (exception.issues !== false && o.issues?.enabled !== true) wrong.push('issues.enabled must be true');
    return wrong;
  }
  if (o.enabled !== true) wrong.push('enabled must be true');
  if (o.redact_query_string !== true) wrong.push('redact_query_string must be true');
  if (o.logs?.enabled !== true || !rate(o.logs?.head_sampling_rate)) wrong.push('logs must be enabled with a head_sampling_rate above 0');
  if (o.traces?.enabled !== true || !rate(o.traces?.head_sampling_rate)) wrong.push('traces must be enabled with a head_sampling_rate above 0');
  if (o.issues?.enabled !== true) wrong.push('issues.enabled must be true');
  return wrong;
}

test('every Worker that runs code has logs, traces and Issues on', () => {
  const checked = [];
  for (const path of configs(root)) {
    if (path.includes('template.')) continue;
    const config = parseJsonc(readFileSync(path, 'utf8'));
    assert.deepEqual(problems(config), [], `${relative(root, path)} (${config.name}): copy the block from workers/observability/template.wrangler.jsonc`);
    if (config.main) checked.push(config.name);
  }
  assert.ok(checked.includes('games-static') && checked.includes('games-crumbwar'), 'the scan found the known Workers');
});

test('the template passes and known bad configs fail', () => {
  const template = parseJsonc(readFileSync(join(root, 'workers/observability/template.wrangler.jsonc'), 'utf8'));
  assert.deepEqual(problems(template), []);
  assert.deepEqual(problems({ name: 'assets-only' }), []);
  assert.notDeepEqual(problems({ name: 'x', main: 'a.js' }), []);
  assert.notDeepEqual(problems({ name: 'x', main: 'a.js', observability: { enabled: true } }), []);
  assert.notDeepEqual(problems({ ...template, observability: { ...template.observability, issues: { enabled: false } } }), []);
  assert.notDeepEqual(problems({ ...template, observability: { ...template.observability, traces: { enabled: true, head_sampling_rate: 0 } } }), []);
});

test('the cf deploy and the wrangler rollback give games-static the same settings', () => {
  const o = parseJsonc(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')).observability;
  assert.deepEqual(
    { enabled: o.enabled, redactQueryString: o.redact_query_string,
      logs: { enabled: o.logs.enabled, invocationLogs: o.logs.invocation_logs, headSamplingRate: o.logs.head_sampling_rate },
      traces: { enabled: o.traces.enabled, headSamplingRate: o.traces.head_sampling_rate }, issues: o.issues },
    observability);
  assert.match(readFileSync(join(root, 'cloudflare.config.ts'), 'utf8'), /^\t\tobservability,$/m);
});
