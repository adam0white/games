# Seed Sling

A portrait seed-slinging experiment. All game files are in this directory. No build, dependencies, external art, commits or deployment.

## Play

Tap a flower to select it. Pull back anywhere and release. The dotted arc shows the first part of the flight. Each soil or lily patch can grow one flower, which becomes another launch point. Fill every glowing patch. A miss costs a seed; it never removes a flower. Restart takes one tap from pause or the end card.

Arrows adjust the pull, Space releases, Tab selects another flower, R restarts, and P or Escape pauses. Leaving the page pauses and cancels a held gesture.

Fifteen small lessons introduce selection, climbing, rock bounce, water, lily pads, wind, thorns and bee carry. All gardens can be selected from the menu. Stars are 3 at par, 2 at par+1, and 1 at par+2. More throws still complete the garden. The device keeps the highest star count for each lesson.

The daily garden has nine patches in three rows. The canonical UTC date seeds an LCG. Generation varies positions, widths, wind and hazards. Each candidate is replayed through the collision rules; an unsolved candidate is rejected. There are at most 40 attempts, followed by a solver-checked fallback. No network or local device identifier affects generation. A run keeps the date it started with across midnight.

## Rules and decisions

- `sim.js` owns every gameplay rule. It has no browser state, `Math.random` or `Date.now`. Physics uses 1/60-second steps in a 360×560 world. The page owns effects and advances the same rules.
- Gravity is 650 world units/s². Pull gain is 5.2 and pull length is capped at 100. Soil and water are horizontal surfaces crossed on descent. Rocks bounce with 0.78 vertical restitution. Thorns also catch an upward crossing. A lily grows a flower over a wider water surface. A bee carries a seed at its displayed vector for exactly 24 ticks, then releases it.
- Gusts follow the global simulation tick, including idle time. Both the arrow and drifting marks show that rhythm. Preview uses the present phase and does not change the run.
- The solver proposes inverse-ballistic gestures, then accepts only gestures the actual collision simulation completes. Recorded routes include wind-phase waits. `guide(state)` can solve from existing flowers and the current gust phase. Par is a best known route. Fourteen lessons attain the one-seed-per-target lower bound; the lily lesson uses an extra intermediate flower. Its par is not an exhaustive optimality proof.
- Daily runs use nine targets so a complete garden needs several route choices. The 15-lesson progression takes 220.8 simulated seconds with an assumed three-second aiming pause per throw. The 2026-11-23 daily route takes 36.8 seconds of flights and gust waits, or 63.8 seconds under that aiming model. These are modelled durations, not human playtest measurements. Lessons individually are short.
- Dawn is the default palette. Dusk is a second selectable look on pause. Neither has owner taste acceptance yet.

## Shared board and saves

The board is labelled **All gardens** because it ranks across dates. Higher is better: `1,000,000 - seeds*1,000 - min(999, floor(seconds))`. Ranked runs accept 1–999 seeds, so one fewer seed always outranks time. A run above that limit still completes and is saved locally, but cannot be shared. Time beyond 999 seconds ties for the same seed count.

GET happens only after a daily win. POST happens only on a separate Share tap. That tap sends exactly `{id,n,s}`. The UUID is created on the first valid Share and reused. There is no automatic share, background retry or name transmission while typing. Names use the server's NFKC normalization and letter/digit/space/underscore/dot/dash filter, with at most 16 characters. Invalid names get a validation message before an ID is created.

The client accepts both the brief's `{ok,place,rows}` and the existing Worker's successful `{place,rows}` response. Evidence: `workers/lab-ai/src/board.mjs`, `tidyName`, `validateScore`, and the final HTTP 200 response. Rows use text nodes. Requests time out after four seconds. A 404, unavailable network, malformed response or rejected share leaves local results playable and saved. Retrying needs another Share tap.

Save contracts:

- `sling-save`: `{v:1, stars:[15 numbers], best, days:{UTC-date:{seeds,seconds,score}}, sound, look, level, runs}`. All valid daily history is retained. Each date keeps its best seeds/time result. `best` is the highest ranked daily score.
- `sling-name`: the locally saved name. `sling-board-id`: the board UUID, absent before a valid Share.
- `sling:hint`: the kit's first-use hold-and-move hint.

The required kit lab recorder is separate from the board. It shows its notice on the menu and its switch on pause. Start, sling, restart, leave and win events use the kit. Local checks mark agent runs and mock the recording endpoint.

## Bot evidence

Command: `node experiments/sling/bots.mjs`.

513 checks pass. The careful solver completes all 15 lessons at their recorded pars and reproduces complete event logs. Additional starting gust phases are 0, 53 and 137 ticks. All 120 sampled UTC dates from 2026-01-01 through 2026-04-30 generate nine-target, par-nine gardens that solve and regenerate identically. None of those candidates needed a retry. Adjacent November dates differ; an impossible calendar date is rejected.

The clumsy bot waits three seconds before every throw, replans only from flowers it has actually grown, adds independent uniform ±7-unit errors to both pull axes, and has par+2 seeds. The same policy runs 400 times per lesson. These measure sensitivity to gesture error, not human skill or enjoyment.

| Garden | Par | Clumsy wins / 400 | Success |
| --- | ---: | ---: | ---: |
| 1 | 1 | 400 | 100% |
| 2 | 2 | 380 | 95% |
| 3 | 2 | 371 | 92.8% |
| 4 | 3 | 353 | 88.3% |
| 5 | 2 | 337 | 84.3% |
| 6 | 2 | 323 | 80.8% |
| 7 | 3 | 308 | 77% |
| 8 | 3 | 279 | 69.8% |
| 9 | 3 | 247 | 61.8% |
| 10 | 3 | 227 | 56.8% |
| 11 | 3 | 140 | 35% |
| 12 | 4 | 133 | 33.3% |
| 13 | 3 | 90 | 22.5% |
| 14 | 4 | 63 | 15.8% |
| 15 | 4 | 42 | 10.5% |

Independent probes cover safe soil/lily, loss in water and upward thorns, rock velocity reversal, exact bee displacement, loss followed by retry, pull cap, idle gust direction and a nonempty trajectory preview that leaves state unchanged.

Mutation command: `node experiments/sling/bots.mjs --mutate`. It removes water from the actual water/thorn collision branch in an in-memory module. The independent water probe then reports `FAIL water loses a seed and grows no flower`; process exit is 1. The source file stays intact.

## Browser evidence

Command: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/sling/check.mjs`.

The check serves `experiments/`, supplies the notes script, and mocks both the lab recorder and board. It plays level 1 and the nine-patch daily using trusted browser pointer input. It never changes the page's simulation. A browser gesture may miss when gust phase advances between its Node calculation and pointer release. The harness replans from the actual flowers and permits at most par+6 throws; it verifies one seed spent per throw and every target filled. Browser wins do not prove par; the fixed-tick bot replays do. It covers trajectory drawing, selecting existing flowers, pause/freeze, cancel, restart, replay, local history after reload, no board identity or POST before Share, invalid names, normalized names, real production response shape, and GET/POST 404 and offline recovery. Expected browser network diagnostics during injected outages are kept separate from unexpected errors.

The final full command exited 0 on WebKit iPhone 13 and Chromium Pixel 7, with zero page errors and zero normal-endpoint console errors. Each phone completed level 1 with one seed at par one and all three daily runs (normal, 404 and offline) with nine seeds at par nine. Chromium also passed 360×640 and 1280×800 keyboard/mouse checks. Both phones checked the lily-over-water lesson. Repeated win cards showed the date, title, earned stars and navigation buttons with both scroll positions zero. Screenshots and command logs are under `/private/tmp/night-sling/`; menu, aiming, play, end card, sharing and outage states were visually inspected. The final full browser log is `phone-final.log`, the bot log is `bots.log`, and the expected failing mutation log is `mutation.log`.

The shared kit self-check passed on WebKit and Chromium before and after implementation. The broader baseline shared phone run hit a 30-second Chromium navigation timeout in the `/lab/lantern-3d/` hint case. That failure is unresolved; the run does not include Sling, and no shared files were changed. Its log is `/private/tmp/night-sling/kit-before.log`. The isolated kit self-check log is `kit-after.log` in the same folder.

Review caught and fixed the board response mismatch, invalid-name failure message, missing mechanic hints, a stale GET that could overwrite a share result, a restored scroll position that could hide a repeated win card's stars, and a vacuous preview test. A phone harness anchor that could select the wrong flower was moved to clear space. Its solver input remains genuine pointer input.

## Not verified and open work

- No real phone, audible sound check, human play duration, thumb comfort or owner fun verdict. Phone profiles do not establish those outcomes.
- The live leaderboard and deployed lab recorder were not contacted. All integration checks use mocks. Shipping and live verification belong to the coordinator.
- No shared files were changed. The coordinator must add `sling` to Human Framework's `LAB_PROTOTYPES` and add its save/hint coverage to the shared phone check. This task's directory-only rule prevents those edits here. This directory needs no new Worker route or service.
- No paid assets, publication, third-party sign-in or account work.
- Open design questions: whether the later narrow ledges feel fair; whether the bee lesson should require using the bee; whether the lily lesson has a two-seed route; which palette the owner prefers. Synthetic success rates do not answer these.
