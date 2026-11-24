#!/usr/bin/env node
// Prints the Cloudflare Issues that are active for this project's Workers, one per line:
//   <id>:<statusUpdated> <service> <type> <count>
// A plain script: one API call through the cf CLI, no model. check.sh starts Claude only for a line it has not seen.
// The key carries statusUpdated, so an issue that was resolved and then came back is new again.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACCOUNT = 'a20259cba74e506296745f9c67c1f3bc';
// Workers of this project whose config lives in another repository.
export const ELSEWHERE = { 'human-framework': 'adam0white/human-framework' };
// Cloudflare's own scan reports ("Potential vulnerability scan") are not code faults.
const SKIP_TYPES = new Set(['security']);

/** Names of every Worker configured in this checkout, archived ones left out. */
export function workerNames(root) {
  // WORKER_ISSUES_EXTRA: more Worker names, space separated, for a Worker not yet on main or a test.
  const names = new Set([...Object.keys(ELSEWHERE), ...(process.env.WORKER_ISSUES_EXTRA ?? '').split(/\s+/).filter(Boolean)]);
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      if (['node_modules', '.git', 'archive', 'dist', '.wrangler'].includes(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/^wrangler\.jsonc?$/.test(entry)) {
        const name = /"name"\s*:\s*"([^"]+)"/.exec(readFileSync(path, 'utf8'))?.[1];
        if (name && !name.includes('<')) names.add(name);
      }
    }
  };
  walk(root);
  return names;
}

/** Picks the issues worth starting a run for. */
export function select(issues, names) {
  return issues
    .filter(issue => issue.status === 'active' && names.has(issue.service) && !SKIP_TYPES.has(issue.type))
    .map(issue => `${issue.id}:${issue.statusUpdated} ${issue.service} ${issue.type} ${issue.count}`);
}

export function cf(args) {
  // Run outside the checkout: cf loads a cloudflare.config.ts it finds in the working directory.
  // The timeout is long because cf takes about 40 seconds to start under launchd's background priority (measured 2026-11-24).
  const out = execFileSync(process.env.CF_BIN || 'cf', [...args, '--quiet'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT },
  });
  return JSON.parse(out.slice(out.search(/[[{]/)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // One short line for the log instead of a stack.
  process.on('uncaughtException', error => { console.error(`${error.code ?? error.name}: ${String(error.message).split('\n')[0]}`); process.exit(1); });
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const issues = [];
  for (let page = 1; page <= 10; page++) {
    const batch = cf(['o11y', 'issues', 'list', '--status', 'active', '--per-page', '100', '--page', String(page)]);
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  for (const line of select(issues, workerNames(root))) console.log(line);
}
