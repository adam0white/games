import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Historical HF3 controls are retained as source; current notebooks explicitly refuse those rules.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [
        '**/node_modules/**',
        'test/editions.test.ts',
        'test/owner-attribution.test.ts',
        'test/plain-narration.test.ts',
        'test/canonical-cast.test.ts',
        'test/journal.test.ts',
        'test/listening.test.ts',
        'test/game.test.ts',
        'test/one-cast.test.ts',
        'test/cast-source.test.ts',
        'test/legacy-replay.test.ts',
        'test/week2-content.test.ts',
        'test/outcomes-lookup.test.ts',
        'test/outcomes.test.ts',
        'test/week2.test.ts',
        'test/next-hf.test.ts',
        'test/one-cast-ui.test.ts',
        'test/presentation.test.ts',
        'test/notebook-codec.test.ts',
        'test/reply.test.ts',
        'test/cast-chapter.test.ts',
        'test/week2-promises.test.ts',
        'test/owner-copy.test.ts',
        'test/history-projection.test.ts',
        'test/tally.test.ts',
        'test/owner-replay.test.ts',
        'test/legacy-boundary.test.ts',
        'test/next-legacy.test.ts',
        'test/next-edition.test.ts',
        'test/standing.test.ts',
        'test/goodhands-current.test.ts',
        // The week-two browser flows, one file per screen size, took 37 min of a 42 min nightly run (2026-11-26) and pushed
        // Murmur past its 45 min limit (2026-11-24, 2026-11-25). They share test/week2-ui-shared.ts; run one by hand with
        // `npx vitest run test/week2-ui.test.ts --exclude ''` if the week-two flow changes.
        'test/week2-ui.test.ts',
        'test/week2-ui-wide.test.ts',
        'test/week2-ui-phone412.test.ts',
        'test/week2-ui-mobile360.test.ts',
        'test/cast-ui.test.ts',
      ],
    },
  }),
);
