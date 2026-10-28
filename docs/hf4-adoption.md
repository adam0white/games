# Small Works HF4 port, 2026-10-28

Remaining: complete the full lane and signed follow-up, merge with exact green CI, deploy and verify the clean live manifest. The requested hosted review is complete; its findings are fixed in this PR. This candidate document is not a delivery receipt. Adam accepts readability and game feel through play, targeted 2026-11-03. No owner decision is pending.

## Scope and decisions

The owner selected latest published HF4, checked on npm as 4.6.0. This game pins it exactly. Immutable release artifacts are lab-client 0.5.2 and lab-kit 0.5.19. Their SHA256 values match the GitHub release assets:

| Artifact | SHA256 |
| --- | --- |
| `adam0white-lab-client-0.5.2.tgz` | `08b4c0e30d9f0def5c5855597954e5a9f0c0df0dca97a063bb52a804b0b9c62d` |
| `adam0white-lab-kit-0.5.19.tgz` | `5602a8755f83644c05c5b1c95e94ede32fccd7b35aa7eb13369c2f7a4ad91b13` |

Client 0.5.2 deliberately depends on HF 4.4.0 for its pure portable bridge and an aliased HF3 legacy adapter. These are released SDK internals. The game's people use the direct HF 4.6.0 package. The former workspace-wide HF3 override is removed so it cannot replace either exact SDK pin. No framework code is copied into this repository.

The implementer chose game 4.2.0 and provenance `4.2.0+hf4`. The host schema name remains `small-works@5`; exact provenance and the run archive identify the new edition. Older saves receive the explicit start-fresh refusal. This is authorized abandonment of old-save compatibility, not conversion of an old person into a fresh replacement. Fixed historical archives and their builder remain separate.

New saves sort object keys before JSON encoding. HF restoration may change object insertion order in accepted history records; sorting keeps a save byte-identical after restoration. Arrays, accepted transaction order, evidence and HF hashes are unchanged. The outer save decoder rejects unknown fields and requires saved person caches to match the restored archive's inspections.

One Run owns actor state. Inputs and world-required receipts replace mutable Person calls. The game owns objects, hidden faults, parts, prices, promises to customers and actual repair outcomes. HF owns perceived evidence, methods, decisions, bodily changes, relationships and agenda. Inspection supplies host read models; these are projections, never a second actor simulation. Game minutes convert to integer milliseconds at the bridge. The game keeps world state, host RNG and ordered commands beside the exact HF archive.

All faculties remain on. The old `enableFatigueStore` and `enableFullness` calls have no HF4 selector equivalent. Differences belong in authored state and actual outcomes.

The HF3 host used a synthetic `onFinished` call to credit a goal outside the actor's action lifecycle. The port instead ties responsibility credit to an actual accepted delivery or personal-project completion and its resolved outcome. Independent-repair mastery uses a distinct declared delivery action only after the host verifies the required independent evidence. A player-assisted delivery releases the responsibility; it does not claim that Sam achieved it. This is an implementer decision under the owner's HF4 authorization.

Overnight inputs use actor ID order, so JSON restoration cannot reorder accepted transactions. Each next-day workshop arrival is an authored commitment recorded before sleep. The morning offer fulfills that commitment through a real accepted awake activity lasting one native millisecond. The actor may refuse; the host never clears an asleep flag or grants an outcome directly. This keeps the visible integer-minute clock while respecting HF's closed input times.

HF4 method inspection requires the hypothesis to be present in the current offer book. A question about a remembered procedure may concern work that is unavailable now. That query restores a public HF run in a separate branch, supplies the hypothetical offer through the public receipt, and inspects the branch. The live run, active work and pending requests remain unchanged. The game does not duplicate HF's matching rules or support equation.

Public community outcomes now name interrupted attendees even when other people completed the gathering. An accepted owner discussion preserves its selected next start while resolving the previous activity; it cannot silently discard the agreed five minutes.

## Saving and shared histories

Complete HF archives exceed the former two-megabyte save limit during normal play. Native workshop saves, the optional chapter and source journals now use IndexedDB. Startup awaits its read transaction. A failed open leaves existing data in place and offers retry or the isolated file route. A failed write shows an export action. Legacy localStorage data is removed only after the new transaction commits. Writes run in invocation order and a failed write does not prevent the next write.

The decoder bounds a complete save at 268,435,456 characters. This is a defensive input limit, not a tested gameplay duration. The source journal retains complete local snapshots. Distinct character revision rows reference one SHA256-identified snapshot instead of copying the same workshop for every character. Every revision binding remains in the export. Source archives stay out of telemetry and the shared character shelf.

The host accepts its own `workshop-hf4/1` passport and Commonstead’s exact `commonstead-retained/4` passport on HF 4.6.0. Both carry the public retained-v2 projection. Unknown passports, changed identities and unsupported current versions stop preparation before ownership changes. Pre-HF4 receipts remain in their source. Actual longer-day Commonstead producer controls passed for Nora and Sam at source tick1800: the original public passport was equal to the admitted passport, the shelf claim completed, save/load matched exactly, and both native HF and game replay verified. Envelope-only fixtures are separate admission guards.

Pre-HF4 shared heads remain in their source. Their characters start fresh with a visible notice and cannot overwrite those heads. A current HF4 head that cannot be admitted stops chapter preparation before ownership changes. The isolated `/file/` route preserves imported opaque sources in its download and does not open or replace native saves or shared histories.

Browser controls on the local candidate verified the public first carry action after reload and Resume. The native slot remained byte-identical at 412,978 characters. A separate real-browser IndexedDB capacity control retained 6,300,000 characters across reload. A synthetic database-open failure displayed the saved-data-preserved error; the isolated file route still opened without page errors. These storage controls do not establish player acceptance.

## Verified controls

On the 2026-10-28 local candidate, a seven-day public-command control reached day 8 with 14 recorded commands and a 26,054,362-character export. Every continuous/restored step matched the complete save. All five people were awake after each overnight transition. Cold restoration, native HF replay and complete game-log replay matched. Full hash: `563ba060cad62a3d861bdde0763bf685c5b82aa0a1d5c8ef7a4e0f562862d7aa`. This checks that workload, not arbitrary-length browser responsiveness.

A played Nora control crossed the source's next-day and paused boundary, admitted all 20 source episodes into a fresh HF4 workshop, and continued through the receiving workshop's next day. It checked the exact admitted passport and explicit clock mapping, allowing only native aging during the actual six milliseconds of receiving inputs. Complete save restoration, native HF replay and complete game replay matched. Full hash: `52e22a5aa4cad41faf21c921dee9e34a840a8ac5cb4a2d4e471e01d85605cfe1`.

On the resumed published HF 4.5.2 candidate, played Nora again retained all 20 source episodes through admission and a receiving next-day transition. Native replay, whole-game replay and byte-exact save restoration passed. Full hash: `c5f81ab511734fccfbda0d39e51fccfa6e6e93f71ba55f4433ea69f28b0761eb`. The preceding 4.5.1 hashes describe their original dated candidate only.

The bridge materializes its immutable public archive at a save/export checkpoint. A trusted internal branch copies host metadata and can take the unchanged live public Run. Older or sibling branches retain a checkpoint plus an immutable list of accepted public `step` calls; public restoration and those exact calls reconstruct that branch on demand. They never share a mutable Run, clone a private kernel or implement actor rules. Forward branches release their source-context reference on acquisition, so old game states do not accumulate merely because play advances. Imported files retain complete strict decoding and public restoration. Full-hash fixtures are retained and re-recorded for the published 4.6.0 engine. A control checks unsaved siblings, subsequent cold restoration and native replay.

A reconsidered activity first produces its interruption outcome. The host then requests a new actual decision; an earlier intention never substitutes for a start receipt. Pending finishes reached within millisecond ingress settle their real host outcomes before the next workshop decision.

The local task report holds the executable controls and raw results. These synthetic controls contain no player archive and do not accept game feel.

The complete-archive controls are materially slower than the earlier per-person saves. The measured three-method campaign took 200.9 seconds while another repository held the full-suite lock. Tests keep their causal and exact-replay assertions, use two workers, and allow ten minutes per campaign. CI allows 60 minutes for the full lane and both historical builds. The generator tests reuse identical campaign prefixes and return independent host-job copies; they retain all physical seed cases. These budgets do not claim a latency bound for arbitrary-length browser play.

## Verification and delivery gates

- Exercise an ordinary repair action and a matched headless control. Retain current replay-hash assertions.
- JSON round-trip an active activity and an unresolved request. Continue restored and original runs with equal inputs and require complete equality.
- Require HF `replay` to verify the exported full hash. Rebuild the game from its recorded commands and require the complete export to match.
- Require inspection and preview to leave the live archive unchanged. Settle actual start, finish and interruption outcomes without duplicate host work.
- Refuse malformed or unsupported archives before replacing the current workshop. Old saves may start fresh only after an explicit user action.
- Keep gameplay public. Download and opening a saved workshop live in the ordinary menu. Debug contains only diagnostics, seed and replay verification beside Lab privacy. No query parameter unlocks a gameplay feature.
- Run `npm run check:lane` before each signed commit. Include the Codex trailer. Use exactly one hosted `@codex review` for the PR and fix its findings there.
- Merge without `--delete-branch`, require green CI on the exact merged commit, run `npm run deploy`, and verify live `/release.json` matches that commit, HF 4.6.0 and `dirty:false`.
- Remove the merged task worktree and its local/origin branches. Stop only task-owned exact PIDs. Technical receipts do not establish owner acceptance.

If a real released-HF gap prevents an existing feature, record the dated blocker in `docs/restart/design.md`, name its matching G-row in the framework needs inventory, and retain the released game. Unimplemented SW-1/G15 and SW-2/G9 requests do not by themselves prove a port regression.


Runtime evidence, 2026-10-28: the initial x64 CI run passed 17 files without an assertion failure before its obsolete head was cancelled at 27 minutes. The checkpoint optimization passes the same replay hashes, 35 focused tests and the seven save-boundary controls. A three-day CPU control measured 4.97s, 3.16s and 5.68s per next-day command, followed by a 10,602,924-character save in 0.46s on the shared local machine. The profile's largest self-time owners are HF cloneData, memory integration and body integration; exported-archive work is only part of that cost. This is a measured runtime limitation, not a browser latency guarantee or a reason to skip causal/replay assertions.

The checkpoint candidate also passed the public browser workflow at1280×800 and360×690: Resume09:15, Carry→09:30, reload/Resume09:30, no horizontal overflow. Its in-app replay verifier accepted both recorded actions. The actual downloaded HF4.5.2 file reproduced the exact365,915-character workshop save in Node; native full hash `baec56323c3eac4db26655f9ccbeda931ce1d9a064f2d4fba95b180d28c24ff8`. These are synthetic local checks, not player acceptance.

## Published 4.6.0 follow-up

The frozen actor target is the latest published package checked at 09:47 UTC on 2026-10-28. Format 5 bounds duplicated event/receipt journals while retaining accepted input history. Earlier hashes above remain evidence for their original pins. Current ordinary-save SHA256 is `9e4c5f4164f5792dc1a1bb59f6effc18937b4484361cb62a86ee3834b36d00b8`; the lesson native full hash is `109a6a7bb88ec2cbde710d7330af3f1ec4629950df9ddabdba80d0a44abefb3c`. Both assertions remain in the test suite.

Played Nora retained all 20 source episodes through admission and a receiving next day on 4.6.0. Complete save restoration, native HF replay and complete game replay passed; full hash `a86bc5169894362d8ec3ae606ae0ad2ac91b913fd7c932fe67a49ec90e071964`.

The 4.6.0 browser build refused its earlier 4.5.2 save with a preserved-data/start-fresh message. After confirmed New game, Carry advanced 09:00 to09:15; reload/Resume retained09:15. Both 1280×800 and360×690 had no horizontal overflow. The public replay verifier accepted its one recorded action. Its actual downloaded file reproduced the complete369,389-character save in Node, full hash `0acefe2de0612887426e443c7658d7684334eab8cdd7f5a78ccf8006e4e0bce5`. Task browser and preview were stopped; no screenshots remain. These are engineering controls, not a player round.

Commonstead admission registers that host’s literal historical action vocabulary so retained memories and duties retain their references. It does not create matching workshop jobs. A person with a pending prayer duty receives an optional Pray activity during the duty window; HF owns the decision and fulfillment. The host supplies no spiritual-worth score or copied calendar rules. Complete Commonstead game archives remain with their original local source journal.

The hosted service automatically reviewed the refund-fix push without a second request and found one additional P1: refusing a scene after HF interrupted background work could leave two host records for one person. The same PR now removes the interrupted record and refunds its reservation before starting an alternative. The actual HF regression failed with duplicate records before the fix and passes immediate save/load and no-second-refund checks afterward.

The reproduced Commonstead controls are bound to producer source `879d1d4eb067b2c2b9ff841bd47d689009f9a241` (only its CI workflow was dirty; runtime source matched that commit). Both ran to tick1800, paused, admitted the complete original passport, claimed, and passed exact save/load, native replay and complete game replay. HF considered the optional prayer offer in a retained pending-duty window. Nora: 88 retained episodes, full hash `990569bdd1b4383958c3a3f08e227a7549a3c3db8e9ebec52b94e05b875ffa31`, actual HF prayer choice `pray`. Sam: 88 retained episodes, full hash `f4015acb5602685d240b6fee5fab26b9c802bde5263c6655cc55cdf3833616b1`, actual HF prayer choice `pray`. This is receiving-game engineering evidence; Commonstead’s separate PR14 delivery and owner feel acceptance remain separate.

The 4.6.0 checkpoint commit’s normal precommit lane: lint/typecheck/build PASS;365 tests in58files PASS,646.38seconds.271 lint warnings and a bundle-size warning remain. Both fixed historical archive builds also pass. Exact source and merged CI, deployment and the live clean manifest remain delivery gates.

The coordinator’s public-menu correction joins this same PR. Download this workshop and Open a saved workshop are ordinary Workshop menu actions. Debug stays in that menu beside Lab privacy and holds seed, replay verification and error detail; it no longer appears on the title. The title uses What became of Sam, Nora, Rafi and Halil and describes hearing their accounts and taking on one more job. Older versions of this game is at the bottom of the menu. The people link remains People across games.

A follow-up control found that callers could not find a prayer offer appended only to a local list. The shared host-owned offer list now includes the actual HF alternative, so callers can start it. The regression checks native choice, actual start and completion, kept duty and exact native replay. Sleep-only batches and awake slots shorter than fifteen minutes do not advertise that offer. All nine focused actor-boundary tests pass.

The final prayer/menu follow-up normal lane passes368 tests in58files (682.06seconds), lint, typecheck and build.273 lint warnings and the bundle-size warning remain. Actual public-menu download, chooser cancel, file import, Resume and return to the preserved native workshop pass at360×690/1280×800. The downloaded369,685-character file reproduces the complete save and game replay, native full hash `0acefe2de0612887426e443c7658d7684334eab8cdd7f5a78ccf8006e4e0bce5`.
