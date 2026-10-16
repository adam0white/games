# Handoff

Updated 2026-10-16 for archived experiments and new-host research. Earlier delivery evidence remains below.

## What remains

The latest request prioritizes autonomous coding/testability and HF evidence over theme. [The reviewed full-list assessment](docs/research/autonomous-coding-fit-2026-10-16.md) supersedes the previous theme-first shortlist: Concordia is the provisional first research choice; Wesnoth is the first game harness to validate locally, with FreeCol second. AI Town/Smallville and 3D are lower priority. No new host, comparison study or adapter is selected for implementation. Adam chooses the next increment and accepts game feel.

Actual feasibility evidence: upstream Concordia `6fbfbc5` installed in isolated Python 3.12.13; 19 engine/action-spec/sequential/simultaneous/checkpoint tests passed without model calls. This is neither an HF adapter nor an HF-versus-LLM result. Other hosts received source/test-harness inspection only. A later game spike must run an unchanged test and a deliberately failing scenario before integrating HF. The proposed study requires a simple table-learner baseline and equal information, not just HF versus random or a weak LLM prompt.

[Recovered original ideas](docs/research/original-game-ideas-2026-10-16.md) distinguish Adam's originals from assistant suggestions and include private provenance. Keep research documents outside public site assets. Astra and two independent research reviewers contributed; both technical causality and experience value remain future acceptance gates.

The two repair versions are preserved on private archive branches and at public paths. Clean public source `f44f651` passed CI 38860955111; live root/archive manifests, launch, separate progress and reload checks passed. [Archive delivery](docs/research/archives-2026-10-16.md) records source commits, build adaptations and actual checks. Source remains private. Root current game remains available; no current save is automatically moved or deleted.

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
