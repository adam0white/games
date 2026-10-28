# Small Works HF4 port, 2026-10-28

Remaining: pass the full lane and hosted review; merge with exact green CI, deploy and verify the clean live manifest. This candidate document is not a delivery receipt. Adam accepts readability and game feel through play, targeted 2026-11-03. No owner decision is pending.

## Scope and decisions

The owner selected latest published HF4, checked on npm as 4.5.2. This game pins it exactly. Immutable release artifacts are lab-client 0.5.2 and lab-kit 0.5.19. Their SHA256 values match the GitHub release assets:

| Artifact | SHA256 |
| --- | --- |
| `adam0white-lab-client-0.5.2.tgz` | `08b4c0e30d9f0def5c5855597954e5a9f0c0df0dca97a063bb52a804b0b9c62d` |
| `adam0white-lab-kit-0.5.19.tgz` | `5602a8755f83644c05c5b1c95e94ede32fccd7b35aa7eb13369c2f7a4ad91b13` |

Client 0.5.2 deliberately depends on HF 4.4.0 for its pure portable bridge and an aliased HF3 legacy adapter. These are released SDK internals. The game's people use the direct HF 4.5.2 package. The former workspace-wide HF3 override is removed so it cannot replace either exact SDK pin. No framework code is copied into this repository.

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

The verified producer/receiver control uses a played Small Works HF4 passport. Commonstead still has no released HF4 producer at this checkpoint. Its existing HF3 receipts remain refused and unchanged; a Commonstead-to-Small-Works HF4 journey is unproved. Current unsupported HF4 foreign heads stop preparation before ownership changes. Recheck that peer journey on 2026-11-03 after Commonstead’s G3/G6/G7 blockers and producer delivery are resolved.

Pre-HF4 shared heads remain in their source. Their characters start fresh with a visible notice and cannot overwrite those heads. A current HF4 head that cannot be admitted stops chapter preparation before ownership changes. The isolated `/file/` route preserves imported opaque sources in its download and does not open or replace native saves or shared histories.

Browser controls on the local candidate verified the public first carry action after reload and Resume. The native slot remained byte-identical at 412,978 characters. A separate real-browser IndexedDB capacity control retained 6,300,000 characters across reload. A synthetic database-open failure displayed the saved-data-preserved error; the isolated file route still opened without page errors. These storage controls do not establish player acceptance.

## Verified controls

On the 2026-10-28 local candidate, a seven-day public-command control reached day 8 with 14 recorded commands and a 26,054,362-character export. Every continuous/restored step matched the complete save. All five people were awake after each overnight transition. Cold restoration, native HF replay and complete game-log replay matched. Full hash: `563ba060cad62a3d861bdde0763bf685c5b82aa0a1d5c8ef7a4e0f562862d7aa`. This checks that workload, not arbitrary-length browser responsiveness.

A played Nora control crossed the source's next-day and paused boundary, admitted all 20 source episodes into a fresh HF4 workshop, and continued through the receiving workshop's next day. It checked the exact admitted passport and explicit clock mapping, allowing only native aging during the actual six milliseconds of receiving inputs. Complete save restoration, native HF replay and complete game replay matched. Full hash: `52e22a5aa4cad41faf21c921dee9e34a840a8ac5cb4a2d4e471e01d85605cfe1`.

On the resumed published HF 4.5.2 candidate, played Nora again retained all 20 source episodes through admission and a receiving next-day transition. Native replay, whole-game replay and byte-exact save restoration passed. Full hash: `c5f81ab511734fccfbda0d39e51fccfa6e6e93f71ba55f4433ea69f28b0761eb`. The preceding 4.5.1 hashes describe their original dated candidate only.

The bridge caches the immutable public export until an accepted HF transaction changes it. A trusted internal game branch copies host state. It can take ownership of an unchanged live public Run; the older branch then restores its immutable archive if used again. Sibling or changed-source branches restore their exact public archive. Host-only commands avoid revalidating unchanged actor history. Imported files retain the complete strict decoder and public restoration path. Mutable runs always have one owner.

A reconsidered activity first produces its interruption outcome. The host then requests a new actual decision; an earlier intention never substitutes for a start receipt. Pending finishes reached within millisecond ingress settle their real host outcomes before the next workshop decision.

The local task report holds the executable controls and raw results. These synthetic controls contain no player archive and do not accept game feel.

The complete-archive controls are materially slower than the earlier per-person saves. The measured three-method campaign took 200.9 seconds while another repository held the full-suite lock. Tests keep their causal and exact-replay assertions, use two workers, and allow five minutes per campaign. CI allows 30 minutes for the full lane and both historical builds. The generator tests reuse identical campaign prefixes and return independent host-job copies; they retain all physical seed cases. These budgets do not claim a latency bound for arbitrary-length browser play.

## Verification and delivery gates

- Exercise an ordinary repair action and a matched headless control. Retain current replay-hash assertions.
- JSON round-trip an active activity and an unresolved request. Continue restored and original runs with equal inputs and require complete equality.
- Require HF `replay` to verify the exported full hash. Rebuild the game from its recorded commands and require the complete export to match.
- Require inspection and preview to leave the live archive unchanged. Settle actual start, finish and interruption outcomes without duplicate host work.
- Refuse malformed or unsupported archives before replacing the current workshop. Old saves may start fresh only after an explicit user action.
- Keep gameplay public. Debug contains only diagnostics, import, export and replay verification beside Lab privacy. No query parameter unlocks a gameplay feature.
- Run `npm run check:lane` before each signed commit. Include the Codex trailer. Use exactly one hosted `@codex review` for the PR and fix its findings there.
- Merge without `--delete-branch`, require green CI on the exact merged commit, run `npm run deploy`, and verify live `/release.json` matches that commit, HF 4.5.2 and `dirty:false`.
- Remove the merged task worktree and its local/origin branches. Stop only task-owned exact PIDs. Technical receipts do not establish owner acceptance.

If a real released-HF gap prevents an existing feature, record the dated blocker in `docs/restart/design.md`, name its matching G-row in the framework needs inventory, and retain the released game. Unimplemented SW-1/G15 and SW-2/G9 requests do not by themselves prove a port regression.
