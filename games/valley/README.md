<!-- Current episode continuity disposition, 2026-11-05: New game always starts a fresh local cast. It skips shelf readiness, enablement, preparation and claims. Stored people stay unchanged. Person checkpoint/alternative publication and their UI controls are closed for this edition. Current local game resume and complete game exports remain supported. UPKEEP will review qualified native 4.17 continuing-person support on 2026-11-12; no account transfer is started. -->

# The Valley: the first morning

A six-hour stewardship episode, from 07:00 to 13:00. Request harvest help, read what people actually answer, and decide how to respond. Visits take time and gifts spend grain. Each person keeps the public HF native faculties. The complete founded cast and native history remain in the replaying export.

The episode ends before the harvest is settled. It does not simulate the following years. Old Valley saves cannot continue in this edition; keep exported files and start fresh. Download the complete run from the menu or ending. See AGENTS.md for current acceptance and HANDOFF.md for unqualified historical gates.

## Run and verify

From the [games workspace root](../../README.md), install with `pnpm install --frozen-lockfile`. Run `pnpm --filter ./games/valley dev`, `pnpm --filter ./games/valley check:lane` and root `pnpm check:lane`. The root builds and deploys the complete games bundle. The Valley path is `/valley/`; the separate file session is `/valley/file/`. Current episode tests are under `test/episode/`; prior tests retain their bytes as `*.test.ts.historical`.

The [first-morning guide record](docs/playtests/2026-11-05-clarity.md) documents the scripted opening and synthetic skim. With a local server running, set `FIRST_MINUTE_URL` to the server origin followed by `/valley` and run `node scripts/first-minute.mjs` for phone/desktop request/reply controls, or `node scripts/guide-preservation.mjs` for reload, denied preference storage and file isolation.

The [older continuous-term description](docs/continuous-term-readme-historical.md) is historical. Winter loans, quarry journeys, later harvests and the three-year gathering are outside this edition.
