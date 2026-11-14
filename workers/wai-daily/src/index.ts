/** Worker entry: bindings and bundled text in, one scheduled daily run out. It serves no requests. */
import { launch } from '@cloudflare/playwright';
import panel from '../docs/lab-personas.md';
import protocol from '../docs/playtester-prompt.md';
import type { Page } from './instrument/play-page.ts';
import type { Ai, Bucket } from './ledger.ts';
import { runScheduled } from './run.ts';

interface Env {
  LAB: Bucket;
  AI: Ai;
  BROWSER: Parameters<typeof launch>[0];
}
export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const outcome = await runScheduled({
      LAB: env.LAB,
      AI: env.AI,
      protocol,
      panel,
      openPage: async () => {
        // An idle browser closes after one minute by default; one model call may take that long.
        const browser = await launch(env.BROWSER, { keep_alive: 180_000 });
        const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
          colorScheme: 'light',
          deviceScaleFactor: 1,
        });
        return { page: page as unknown as Page, close: () => browser.close() };
      },
    });
    console.log(JSON.stringify({ wai_daily: outcome }));
  },
  fetch(): Response {
    return new Response(null, { status: 404 });
  },
};
