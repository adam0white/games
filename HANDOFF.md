# Handoff

Updated 2026-10-19 for the HF 2.8.0 / engine 5 level-up (game 3.1.0-alpha.3). Earlier sections are historical.

## What remains

Deferred 2026-10-19 under the owner's soft stop. Each item below is deferred to **2026-10-26** for the owner to choose from; none is started unasked.

- **Natural difficulty is not there yet.** The game-design expert's main finding stands after two rounds: three accepted jobs fit in half a day, and a broken promise costs a sentence and some trust in the player's word. Promises do not compete for the bench, Sam's hours or stock. This needs a scenario redesign (overlapping deadlines, owners who remember a broken promise in later requests), not a patch. Deferred to 2026-10-26, or the next Small Works increment the owner sets.
- **Open findings from [playtest 10](docs/restart/playtest-10.md):**
  - owners accept a return during their listed outing;
  - an honest late return and plain neglect read the same in trust;
  - recovered parts pool with new stock;
  - repeated request text and duplicate fan jobs;
  - fixed seed 42, so a remembered answer replays the game;
  - "Look inside" toggles the cover closed;
  - the first-week panel blocks the workboard;
  - Notes contrast.
- **No retest of alpha.3 by source-unread testers.** The round-2 fixes are covered by unit tests only.
- **HF requests SW-1 and SW-2** are in [the framework boundary](docs/framework-boundary.md) and were returned to the HF coordinator. They are not implemented here.
- Adam accepts feel personally.

## HF 2.8.0 and engine 5 (2026-10-19)

- **Delivered:** clean `5623597aba2310112c2294cfff9c686404e95f59`, pushed on main.
- **CI:** [CI 39320840965](https://github.com/adam0white/repair-game/actions/runs/39320840965) passed.
- **Deploy:** repeated lint, types, **259 tests across 29 files** and build. Cloudflare version `cdda086b-e9e0-44b2-afbf-adf84b2d97e5`.
- **Live `/release.json`:** commit `5623597…`, dirty false, game 3.1.0-alpha.3, framework 2.8.0, engine `small-works@5`.
- **Live smoke:** a driver smoke on the live site clicked "Ask Sam to watch" and opened the Workboard, with no page errors. It is not a playtest.
- Later documentation-only commits do not change the published UI.

- **Framework:** HF bumped to exactly 2.8.0. Registry integrity and provenance checked.
- **Saves:** new worlds are `small-works@5`. Engine-4 saves and exports load as engine-4 worlds and replay exactly under engine-4 rules; only HF's per-person engine stamp differs. The app then continues them under engine 5 (`upgradeRules`), recording the input index where it switched. The real-export tests are in `tests/legacy-v4.test.ts`.
- **People are truer:**
  - People answer the player's word through HF's voice trust. Broken promises lower it and kept ones raise it.
  - Each owner speaks again a day after an overdue notice.
  - An unfinished return gets a reply that depends on how late it is.
  - A keepsake owner minds new parts.
  - Sam's lesson ready window and today's spoken lines are on screen.
- **Use checks:** they report felt use instead of percentages, and the music box compares each try with the last one.
- **Recovery:** recovering a hidden-open part costs the attempt.
- **Fatigue:** HF's fatigue store and fullness are enabled. Faith stays background.
- **Playtests:**
  - [Playtest 10](docs/restart/playtest-10.md) records two rounds of source-unread testers (speedrunner haiku, edge sonnet, cozy fable, sceptic opus; the codex wildcard was blocked by its sandbox) and a game-design expert (opus). Their reports are verbatim, with exports.
  - It also has the HF-character harness run: 8 personas × 2 seeds, exit 0.

## Previous focused UX delivery

Adam accepts feel personally. The focused first-repair UX renewal is delivered locally and publicly at clean `39793cd92dcea494a3bf64df8098aeb19cf0a6b9`, privately pushed on main. Deployment repeated lint, types, **241 tests across 25 files** and build. [CI 38679966443](https://github.com/adam0white/repair-game/actions/runs/38679966443) passed. Cloudflare version is `cdf74c5d-0a25-49e1-9b31-07756effb16f`; the exact clean live manifest was verified. Later documentation-only commits do not change this published UI.

[Desktop and mobile first-visitor evidence](docs/restart/playtest-9.md) supports a purposeful opening and completed guided repair. Desktop retained 48 exact-replay inputs; mobile retained 14. Existing mentor and visitor 48-input saves also replay exactly. Public desktop keyboard tabs and 390-width layout/switch checks pass without runtime errors. These guided runs do not prove independent diagnosis. Small meter terminals, meter scrolling and the electrical reason for measuring across the switch remain limits. No additional implementation queue is selected.

[The focused UX spec](docs/restart/first-repair-ux.md) records the scope. The earlier five-hour delivery below is historical.

## Earlier five-hour delivered build

Play [Small Works](https://repair.adamwhite.work). Published UI code is clean `0e80d89be803a9625dcd07974ed6c85396fa71ec`; gameplay core is `38cbae0`. The game is `3.0.0-alpha.4`, engine/schema `small-works@4`, with exactly published HF `2.2.1`. Main is privately pushed. [CI 38576890933](https://github.com/adam0white/repair-game/actions/runs/38576890933) passed. Deployment repeated lint, types, **233 tests across 23 files** and build; Cloudflare version is `6c8c45de-c057-4223-aed7-fe3a47afb86b`. The exact clean public manifest was verified. Later documentation-only commits need not change this UI code hash.

Public checks cover keyboard component selection, accessible buttons, direct probes, narrow layout, export/import/replay, rejected malformed input without clock change and self-hosted licensed fonts. Zero runtime/CSP errors were recorded. The paired mentoring follow-up also verified clearer pending instructions, actual contribution rows and paused export. Its replay-based account is not fresh whole-repair play.

## Evidence and limits

[General candidate-4 play](docs/restart/playtest-7.md) reached six checked returns and a meaningful retained-theatre performance. It found diagnosis enjoyable and teaching administration tiring. It secured no export after a harness download timeout; no replay is claimed.

[Focused mentoring play and paired follow-up](docs/restart/playtest-8.md) retained 48 exact-replay inputs. Sam learned some steps, requested help, inspected and measured actual work, and usefully returned a player-repaired object. It recorded **zero whole independent repairs**. Root's legal seven-day continuation generated a checked 55-input first-week account without changing saved facts. The mentor's 46-second public follow-up checked presentation, not a new story.

Earlier playtests and manifests remain unchanged under their original versions. The initial Astra diagnosis accidentally disclosed by root remains excluded. Tests establish bounded conditional learning and responsibility behavior; they do not establish general realism or Adam's enjoyment.

## Compatibility and authority

Autosaves use `small-works-save-v4`, preserving older keys. Earlier campaign and Small Works engines 1–3 are intentionally unsupported. Source remains private at [adam0white/repair-game](https://github.com/adam0white/repair-game). Static publication and private pushes are authorized; public source and licensing remain undecided. This repository owns the game. HF owns people through released public APIs.

On **2026-10-15**, contingent on Adam playing, review natural whole-handoff usability and teaching burden before selecting more world scope. This is a review priority, not scheduled unattended work.

Read README.md, [vision](docs/vision.md), [MVP](docs/mvp.md), [design](docs/restart/design.md) and [ledger](docs/restart/ledger.md) before resuming. Dated earlier campaign documents are provenance, not the active queue. The [HF 2.2.1 release](https://github.com/adam0white/human-framework/releases/tag/v2.2.1) and [resolved issue 5](https://github.com/adam0white/human-framework/issues/5#issuecomment-6168092827) record the generic method-evidence correction separately.
