/** The session against a real Chromium page. Runs only when PLAYWRIGHT_MODULE names an installed Playwright. */
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Page } from '../src/instrument/play-page.ts';
import { playSession } from '../src/session.ts';
import { op, stopOp } from './fakes.ts';

describe.skipIf(!process.env.PLAYWRIGHT_MODULE)('playSession with a real browser', () => {
  it('shows the model only rendered text and controls, taps by accessible name, and stores receipts', async () => {
    const site = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html lang="en"><body><h1>The well</h1>
        <p id="state">The bucket is empty.</p><p hidden>SECRET-STATE</p>
        <button onclick="document.getElementById('state').textContent = 'The bucket is full.'">Draw water</button>
        <button disabled>Rest</button></body></html>`);
    });
    site.listen(0, '127.0.0.1');
    await once(site, 'listening');
    const address = site.address();
    if (!address || typeof address === 'string') throw new Error('No site port');
    const require = createRequire(import.meta.url);
    const imported = await import(pathToFileURL(require.resolve(process.env.PLAYWRIGHT_MODULE ?? '')).href);
    const playwright = imported.chromium ? imported : imported.default;
    const browser = await playwright.chromium.launch({ headless: true });
    const stored = new Map<string, string | Uint8Array>();
    const seen: string[] = [];
    const replies = [
      op({ op: 'tap', name: 'Rest', reaction: 'Try the disabled one.' }),
      op({ op: 'tap', name: 'button "Draw water"', reaction: 'Role wrapper, as models often send.' }),
      op({ op: 'shot', file: 'after.png', reaction: 'Look.' }),
      stopOp('I drew water.'),
    ];
    try {
      const page = (await browser.newPage({ viewport: { width: 1280, height: 800 } })) as Page;
      const result = await playSession({
        session: {
          model: '@cf/qwen/qwen3-30b-a3b-fp8',
          game: 'fixture',
          url: `http://127.0.0.1:${address.port}/`,
          persona: 'Maya Chen',
          floor: 0,
          ceiling: 2,
          control: false,
        },
        page,
        protocol: 'PROTOCOL',
        panel: '### Maya Chen\nBrief.\n',
        expectedDay: new Date().toISOString().slice(0, 10),
        infer: async (_model, messages) => {
          seen.push(messages.at(-1)?.content ?? '');
          return replies.shift() ?? stopOp('out of script');
        },
        store: async (name, body) => void stored.set(name, body),
        sleep: async () => {},
      });
      expect(result).toMatchObject({ failure: null, stop: { report: 'I drew water.' }, turns: 4 });
      expect(seen[0]).toContain('The bucket is empty.');
      expect(seen[0]).toContain('Draw water');
      // The disabled control is refused as game state, and nothing was tapped.
      expect(seen[1]).toContain('disabled right now');
      expect(seen[1]).toContain('The bucket is empty.');
      expect(seen[2]).toContain('The bucket is full.');
      expect(seen.join('\n')).not.toContain('SECRET-STATE');
      const png = stored.get('after.png');
      expect(png instanceof Uint8Array && png[0] === 0x89 && png[1] === 0x50).toBe(true);
      expect(String(stored.get('wall-clock.jsonl')).trim().split('\n')).toHaveLength(5);
      expect([...stored.keys()].filter((key) => key.startsWith('turns/'))).toHaveLength(4);
    } finally {
      await browser.close();
      site.close();
    }
  });
});
