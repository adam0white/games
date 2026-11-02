# Smoke on the Stairs

A fire in Lale Apartmanı. You are the caretaker. Four neighbours can walk out. They must decide to leave, and they can refuse you.

## What ends the work

A complete small run, deterministic replay export, exact HF 4.8.0 pin, signed source, exact green CI, live release manifest, central listing ready, independent Codex review, and lab round 1 readiness. The coordinator owns the panel and retest. Adam accepts the new-games increment on 2026-11-03. This delivery does not claim panel acceptance.

## Win and loss

Lead everyone who is home through the front door before the stair closes or the caretaker loses breath. The seed changes who needs rescuing and where smoke starts. Run length is measured by the fixed-seed bot controls in docs/validation.md, rather than promised in advance. A lost run names who walked out with you, who escaped alone, and who was left inside. People left inside may die. The owner allowed death on 2026-10-26; this supersedes the earlier review constraint. Death belongs to this possible night and changes no other game. Partial rescue is an outcome. Reruns show how this night could have gone. This game never writes into Stairwell.

## Why this is a game

Movement spends time. A shout can burn trust. Choosing how to answer Sevim costs time that Hacer may need. Silent proximity cannot rescue everyone. Burak knows something you do not: he checks the exit and returns to help Sevim without an order. Smoke waves lengthen visibly before closure. You can learn when to cross and choose whom to believe. There is no score or hidden correct dialogue sequence.

## Technology and HF

PixiJS 8 WebGL renders a cut-paper stairwell at 60 fps. TypeScript 7 strict runs one deterministic simulation at 20 Hz in a dedicated worker. The main thread renders committed snapshots. Worker requests preserve input order and fence exports and resets behind submitted ticks. HF 4.8.0 owns people, decisions, assent, voice trust, beliefs and bodily change through its public run API. The host owns positions, fire, authored speech, offered actions and actual world outcomes. Lab client 0.5.5 is consumed from its published release artifact.

HF time uses integer milliseconds; each fixed game tick is 50 ms. Following is a sequence of finite walking intervals. An interval does not promise eventual rescue: HF must choose the next interval, and the host reports actual progress at its boundary. A resident reaches safety only when their world position reaches the street. Offers and suggestions retain stable identities and registered sources. The host settles each requested action before advancing and publishes staged world changes only after HF accepts their receipts.

New exports use smoke-8 and retain the seed, ordered timed game inputs, complete host state and exact HF archive with engine identity and hashes. HF replay and rebuilding Smoke from its input log are separate checks. Unsupported exports are refused with a keep-file/start-fresh message. This migration does not preserve 3.x numerical behavior or old exports.

Smoke and caretaker breath remain game hazards. Resident smoke exposure also belongs to the host hazard. Each fixed tick adds the smoke density at the resident’s current floor. A per-seed, per-person tolerance of 850–1200 density-ticks determines when exposure becomes fatal. Outside residents stop accumulating exposure. This is a game rule, not a physiological model. Early evacuation remains possible; later and thicker smoke consumes more of that margin. No local body, trust or decision kernel substitutes for HF.

Every gameplay feature is public. Query strings do not enable gameplay or diagnostics. The seed parameter selects the night’s data. Diagnostics remain in one collapsed Debug item beside lab privacy.

The original slice chose the main thread for four people. During the HF 4.4.0 port, repeated CI runs exceeded the unchanged 16 ms frame CPU gate. Timing breakdowns identified simulation work. The port moves that work into a worker and separately checks committed ticks and backlog so smooth drawing cannot hide delayed simulation. Both reviews require persuasion, readable refusal, independent companion help, no canonical death, and actual partial outcomes. The first slice adopted those constraints. Iteration 4 follows the owner’s later permission for death in this possible night; all other agreed review changes remain. Astra proposes Cross Together as another game; it is outside this brief. The later stack trial confirmed direct PixiJS/HF integration and short-run deterministic replay at both sizes. This iteration keeps PixiJS because the faults are in the game design, not its rendering stack.

## Cast

Hacer (58), Burak (31), Sevim (69), Derya (44), using their canonical identities. Tarık is away. Hacer's uncertainty comes from being a guest, not frailty. Everyone who decides to go can walk out. No one becomes cargo. No new foreground person is introduced. The fire, hospital and death outcomes belong only to this game's possible night.

## Phone and keyboard

At 360×690 the building occupies the space above a separate bottom thumb area. A tap on a landing moves; a tap on a figure selects. Speech buttons remain below the figures. Keyboard at 1280×800 uses arrows/WASD, selection and speech shortcuts. A focused line makes the person's reason explicit; hesitation alone is insufficient. Iteration 3 adds a visible Street button, a current status under every name, and DOM text for smoke-wave and closure timing. Following means walk toward the caretaker, then wait beside them until the caretaker moves. The screen tells the player to lead followers to the street. Feedback pauses. Background tabs do not accrue simulation catch-up.

## Walk cue (2026-10-31)

The first LIGHT panel could not tell whether a landing tap had registered. Native pointer taps already set the walk target on phone and desktop; the screen did not say so. A line under the controls now states where the caretaker is, where the last tap sends them and the time left at the current speed (thick smoke slows it, and the line says so). A ring marks the destination and the caretaker carries a YOU label. A second tap only changes the destination; it never restarts the walk. Followers walk to the caretaker, so they leave when the caretaker is at the street; the line says this. Speed, clock and difficulty are unchanged.

## Evidence gates

First test one moving companion and Sevim's refusal before expanding the run. Browser checks must show her stated reason and an available response. That is a readability proxy; only actual panel play can establish whether players understand and change action. Measure Chromium under 4× CPU slowdown and report the actual frame distribution. Do not call an automated proxy human evidence.

## Deferred

- 2026-11-10: preferences from the first LIGHT panel, not mechanism faults: faster walk, longer clock, richer death narration, per-person numeric clocks, an empty Feedback draft with an extra Back button, hiding key letters on the phone. Walk speed, clock and difficulty change only after a separate C14 human-speed comparison.
- 2026-11-10: whether "Show the stair" should unlock the instant a neighbour says she is ready (unproved), and one-tap approach (selection stays two-step; no automatic compliance).
- 2026-11-03: source/input clarification of stable neighbour button names while aiming, asked by Jonas (F-2377) and Marta (F-2389); stale accessible names and tool latency stay qualified, not a broken-pointer claim. Needs source/input clarification before any change.
- 2026-11-03: panel observation of refusal readability and whether players change action; coordinator owns panel.
- 2026-11-03: longer six-minute run and sound, after the short run proves persuasion.
- 2026-11-03: carrying a downed person, only if it improves this game without turning people into cargo.
- 2026-11-03: cross-game continuation remains deliberately absent; needs a separate reviewed decision.
- 2026-11-03: HF fast response request review by the all director; no local framework substitute.

## Historical HF 3.2.0 route evidence — 2026-10-27

The coordinator rejected the torch-on, repeated Come now strategy that never shows the stair. Torchlight now lights the caretaker but does not establish a resident's route. A following resident who has not seen the stair stops during thick smoke, even with the torch on. The player can approach, show the stair, and invite them again. Thin smoke still permits following without route evidence. HF still owns assent, refusal and protest; this changes only the host's hazard and movement rule. Burak's independent stair check still establishes his own route.

Measured before at base `5b2fab9`, and after this rule, on the same seeds 1–20 at 20 Hz. Each strategy uses the same inputs and cadence before and after. Repeated pushing uses one command plus five ticks per loop, approaches a waiting resident, presses Come now until someone follows, then leads them to Street; it never shows the stair or helps with books. The torch variant switches the torch on once. Careful play uses the existing `competent` policy: torch, books where needed, route evidence, gentle invitation, then Street.

| Strategy                                         | Before | After |
| ------------------------------------------------ | -----: | ----: |
| Torch on, push, never show stair (`torch-pushy`) |  18/20 |  7/20 |
| Careful (`competent`)                            |  20/20 | 20/20 |
| Careless, push without torch (`pushy`)           |   6/20 |  6/20 |

The older policy named `careless` is an idle upper-floor exposure control, not the coordinator's careless pushing policy; it remains 0/20. The visible-text `cold` control remains 20/20. These are deterministic bot measurements, not human playtest evidence. All 120 exports in each measurement (six policies × 20 seeds) replayed to their exact complete-state hash. Primary-strategy rows are in [route-rule-measurements.json](route-rule-measurements.json). Reproduce the after measurement with `SMOKE_MEASUREMENT_PATH=/tmp/smoke-after.json pnpm test src/sim-bots.test.ts`. The added torch policy was also run against the unchanged baseline before applying the rule.

The targeted regression covers stopping with the torch on and recovery by showing the stair; the existing headless controls cover successful careful play. No panel or human playtest was run. Gameplay and seeded nights are public without `?lab`; the pause menu has one collapsed Debug item beside Lab privacy, with seed/tick and an exact replay check. The diagnostic browser API and bounded frame samples no longer require a query flag.

That delivery used HF 3.2.0 and smoke-5. The measurements above are historical, not HF 4.4.0 results. The HF 4.4.0 bridge preserves the explicit stop/recovery rule. The focused lane uses one seed with silent, competent and visible-text controls; the historical twenty-seed measurement and its strategy assertions remain available through the command above. Current exports use smoke-6. Smoke-5 and older exports require their original builds; keep those files and start fresh here.


### Final fixed retest: closing dated record (2026-11-02)

This is qualified fictional AI panel evidence, not human play or Adam’s acceptance. The two fixed iterations are the cap; no third ordinary panel is requested. Earlier asks remain open. Three target returners (Jonas, Aisha, Diego), first-Smoke franchise-experienced Rosa, and fictional first-HF Iria supplied five reports. Leila’s original reports remain retained; this is not a four-returner comparison.

Actual collection89152 exited0/completione852f6. Six stops reached the explicit ending; four were voluntary unfinished stops, with no budget/tool/coordinator cut. Root verified480sampled identities absent, five profiles removed, eleven BIND-free ports and17frozen inputs stable before reading. The first BIND snapshot failed with EADDRINUSE at an unrecorded port; a later diagnostic and full check passed without establishing the cause. Root full-read all five reports, checked100literalspans,55requested reaction strings (54successful+1rejected), five exact final-message byte comparisons and10ending responses. This does not establish perception, comprehension, backend/consent/recording state or model-serving identity.

Sealed coordinator packet source-packets/smoke-retest2 has44payloads/35exactcopies, manifestSHA256 `69f183bb5d03707394136cbe3aa4e8998bcec275e986e7b111909153a0993ca1`, external rootsealSHA256 `e2fd07db7d96a08cf8d5762b1c45a15dea663f5677ae1ae30dcce08616d12224`. Both independent defaultCodex packet reviews are CLEAR; root rehashed318review evidence records. Internal NOTSEALED labels remain historical freeze provenance. Canonical HF import of the44payloadpacket/10ledgerrows/5logicalrows/4complete standing diary appends remains separate and PENDING. This record does not claim publication on main.

Two participant-reached blocking questions are not two established bugs. Rosa’s tied/tying response later refreshed; snapshot delay leaves its cause unknown. Iria did not understand individual-air urgency separately from stair closure; death before closure does not establish closure causation. Aisha stopped before an ending, so later death-account context is untested. Preserve neighbour autonomy, difficulty, smoke danger, approximate state and existing reading/slowdown rules. Positive keep-asks are preservation preferences; requests for clarity do not mandate numerical timers, guaranteed rescue or automatic compliance.

| ID     | Tester | Exact ask                                                                                                                                                                                                                                                                        | Full return statement                                                                                                                                                | Classification                       | Target / date          | Root qualification                                                                                                                                                                                        |
| ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-3123 | jonas  | 1. Give me a harder choice after I learn the torch-and-follow routine, with visible clues about its cost. Both orders succeeded here, although Derya’s breathing warning made the second trip feel consequential. I cannot tell from two runs how often either order would work. | **I would not return voluntarily for another attempt tonight; I have seen the two orders I wanted to try. I would not leave it running.**                            | preference                           | fix:smoke / 2026-11-10 | Taste request after two successes, not evidence every order is easy; keep danger and difficulty.                                                                                                          |
| F-3124 | aisha  | 1. When someone dies, acknowledge what I tried. Derya died while following me down, and the line I saw did not mention that I had reached her.                                                                                                                                   | I would come back another evening to see another night, but I would want the account of a death to recognise the help I tried to give; I would not leave it running. | unresolved-prior-clarity-lead        | fix:smoke / 2026-11-03 | Earlier death-account ask encountered again; reached death while following, quit before ending. No ending-context absence proved.                                                                         |
| F-3125 | aisha  | 2. Keep the walking destination, estimate and smoke slowdown messages. They made movement much clearer to me.                                                                                                                                                                    | I would come back another evening to see another night, but I would want the account of a death to recognise the help I tried to give; I would not leave it running. | preservation-preference              | fix:smoke / 2026-11-10 | Preserve observed walking destination/estimate/smoke slowdown clarity; no new blocker.                                                                                                                    |
| F-3126 | aisha  | 3. Keep the neighbours able to help one another. Burak checking the stair and helping Sevim gave him a place in the night beyond my instructions.                                                                                                                                | I would come back another evening to see another night, but I would want the account of a death to recognise the help I tried to give; I would not leave it running. | preservation-preference              | fix:smoke / 2026-11-10 | Preserve independent neighbour help and motives; no guaranteed compliance or new blocker.                                                                                                                 |
| F-3127 | diego  | 1. Make it easier to notice when someone stops following. I reached the street on desktop before I saw Derya had stopped upstairs.                                                                                                                                               | **Would I return voluntarily?** I might return another evening: rescuing Derya after leaving her behind was satisfying. I would not leave the game running.          | reached-clarity-lead-not-new-blocker | fix:smoke / 2026-11-03 | Stopped follower discovered at street; missed transition, exact stop cause unknown. Inspect notice without removing follower autonomy or difficulty.                                                      |
| F-3128 | diego  | 2. Show more clearly how much danger a neighbour is in before I choose who waits. “Smoke is making breathing difficult” gave me urgency, but not a sense of how much time Derya had.                                                                                             | **Would I return voluntarily?** I might return another evening: rescuing Derya after leaving her behind was satisfying. I would not leave the game running.          | reached-clarity-lead-not-new-blocker | fix:smoke / 2026-11-03 | Breathing warning observed but individual urgency unclear; inspect qualitative danger without mandated numerical countdown or softened danger.                                                            |
| F-3129 | rosa   | 1. **Keep the current instruction consistent with the latest answer.** On the phone, “The bundle is tied” appeared while Sevim still showed “tying the books” and the hint told me to wait. This was the new blocking question I reached.                                        | I would return voluntarily another evening on the large screen to help the other neighbours, but I would close it now and not leave it running.                      | reached-blocker-qualified-cause      | fix:smoke / 2026-11-03 | Tied event plus tying status/wait hint retained in driver response; later hint corrected. Snapshot delay complicates cause; no permanently broken books action or human-speed reproduction established.   |
| F-3130 | rosa   | 2. Put “Turn on Torch, then Show the stair” at the first moment I need it. That instruction was clear when it appeared.                                                                                                                                                          | I would return voluntarily another evening on the large screen to help the other neighbours, but I would close it now and not leave it running.                      | preference                           | fix:smoke / 2026-11-10 | Instruction was understood when reached during stopping; inspect earlier placement, preserve action prerequisites.                                                                                        |
| F-3131 | rosa   | 3. Keep the neighbours’ concrete answers and the confirmation that they reached the street with their belongings. Sevim keeping her books mattered to me.                                                                                                                        | I would return voluntarily another evening on the large screen to help the other neighbours, but I would close it now and not leave it running.                      | preservation-preference              | fix:smoke / 2026-11-10 | Preserve concrete replies, belongings and outside confirmation; no new blocker.                                                                                                                           |
| F-3132 | iria   | 1. Help me understand how urgently a neighbour needs air, separate from the time until the stair closes. Hacer died while following me, and I did not understand how much time she had. This is the new blocking ask I reached.                                                  | I would not voluntarily return tonight; I would leave the desktop game paused, not running.                                                                          | reached-blocker-qualified-cause      | fix:smoke / 2026-11-03 | Hacer death while following occurred before stair closure; participant did not understand separate air urgency. Inspect qualitative communication, not survival guarantee or numerical countdown mandate. |

#### Attached current qualifications

Inherited W/SW/NR/SWF/NC and per-person prior Smoke limits remain attached through the sealed packet’s exact own-history maps and referenced qualification sources. Selected-prefix/hash transfer is not a full archive audit. The complete current qualifications follow.

##### SF1 — visual-access

All five reports claim successful image views (Jonas2,Aisha2,Diego4,Rosa4,Iria2); no actual view_image call or image-tool return is retained in any current stream. UNVERIFIABLE visual access, not evidence that images were unseen. Saved PNGs and this audit cannot establish tester perception.

##### SF2 — history-delivery

Stored stdout is complete and exact for all selected histories. Jonas/Aisha/Diego explicitly report truncated direct delivery and uncertain unread ranges; retain their statements. Rosa claims all read, but literal stdout does not prove model delivery or comprehension. Prior selected-history composition review transfers by exact prefix/hash, not full archive completeness.

##### SF3 — shell-failures

Diego line160 and Iria line66 each issued malformed literal apostrophe curl; exit1, stdout zsh:1: unmatched quote. Retry succeeds with Unicode escape. Reports omit these failed shell commands. Preserve failures and retries; no gameplay action from failed shell inferred.

##### SF4 — checkpoint-timing

Jonas desktop58.754 and Diego desktop59.997 first_minute are premature. Corrected61.561/62.384 do not erase them. All sessions reached actionable play before valid after60 note. Rosa phone75.598 note occurs while paused in Feedback; snapshot_ms13342. All sessions stop before180; no pulse owed. All ten automatic first-minute shots occur before stop and do not establish image viewing or diary compliance. No late autoscreenshot or automatic ceiling in retained wall rows.

##### SF5 — raw-diary

All55 requested diary reaction strings (54 successful entries plus Iria’s failed initial attempt) occur verbatim in full reports; no word corrections authorized. Response/report and wall timestamps differ by1ms in listed rows; retain both clocks. Failed Iria opening Invalid reason is not a successful diary. All five final captured agent messages exactly match report file bytes, with no terminal newline added or removed.

##### SF6 — stops

Ten actual stop logs, one per device, with no later tester gameplay. Six FINISHED stops have Everyone is out ending text. Aisha desktop FRUSTRATED,Rosa phone CONFUSED,Rosa desktop TASTE,Iria desktop TASTE are nonending. No BUDGET/TOOL stops or coordinator cuts. This supports participant stopping, not game-wide completion or predicted enjoyment.

##### SF7 — feedback

Feedback dialogs visibly open and Not now closes them on all10 devices. Jonas/both, Aisha/both, Diego/both, Iria/both show selected pressed label after retries. Rosa menu shortcuts auto-fill draft but no explicit Feedback quick-label press observed; offered label is not proof selection. Diego misses Feedback during phone confusion. No type/select/Submit/toggle/owner-settings/link-opening command observed. Backend absence of send, attribution, actual consent defaults remain unverified.

##### SF8 — rosa-reread

Rosa actual phone quit98.367 reports rereading The bundle is tied. and Wait while the bundle is tied.; stop121.495 CONFUSED persists after later clearer hint. No desktop reread; desktop95.331 TASTE. Rule is conditional, not a quota. Counts include settings/retention/privacy/recording/Feedback/Debug and lab subjects, but are grouped selfreports with18->22->23 opening and13->14 menu corrections. Do not call counts exhaustive measured concepts or invent rereads.

##### SF9 — rosa-cause

Phone wait52.228 snapshot_ms1 and shot86.317 snapshot_ms1 contain new tied log with old selected Hold these steady answer, tying status, Wait while bundle is tied hint. first_minute75.598 snapshot_ms13342 and quit98.367 snapshot_ms12051 repeat prior snapshot. Pause102.203 snapshot_ms0 updates needs-to-see-stair and Torch hint. Cause unknown; do not infer a persistent books-action bug, driver-only cause, or human1-3s reproduction.

##### SF10 — cohort-comparison

Jonas/Aisha/Diego only target returners. Rosa FIRST Smoke/franchise experienced. Iria assigned fictional cold/empty2line history. Requested Terra low / Rosa Sol medium is not serving identity. Jonas revisits Street/followers; Aisha movement and death acknowledgment; Diego movement/danger and cannot revisit Sevim (away both). Current different nights do not prove causal improvement.

##### SF11 — new-asks

Rosa consistency and Iria individual-air-danger clarity are two participant-reached new blocking questions, not established defects. Aisha death acknowledgment is an earlier ask revisited before ending; later ending context untested. Jonas and Diego say no new blocking ask. Preserve observations versus preference versus unknown cause.

##### SF12 — boundaries

All596 completed commands:302sed,4cat cleanup,288 parsed assigned local gameplay,2 failed quoting calls. No source/peer/hidden-state reads observed outside supplied own history, no helper/script/network-other commands. Unknown omitted tool events remain unverified. Dynamic named-control failures/disabled controls/ambiguities remain raw; no bug causality inferred. Diego4 selection errors and point recovery preserve uneven tool evidence; not silently converted into game failure or forced TOOL stop.

##### SF13 — physical-source-bounds

Stored root receipts say89152/e852f6 exit0;480 sampled original identities gone,5 profiles absent,11 BINDfree ports,17 stable payloads before report reads. Initial EADDRINUSE at unknown port remains unexplained. Source delivery and SDK released/archive/served markers are bounded static evidence, not backend/player/source-wide equivalence proof. This audit did no runtime probe.

##### SF14 — authority

Finalizer5reports/10eligible stops are audit counts, not protocol enforcement. Root manual full report/raw evidence audit remains mandatory. This independent audit does not grant rootVerified, admission, owner acceptance, third panel or iteration cap reset. Final Smoke ordinary cap remains.

#### Response and wall-clock differences

Both clocks remain literal, in seconds.

| Tester | Device  | Transcript line | Wall row | Response | Wall    | Difference |
| ------ | ------- | --------------- | -------- | -------- | ------- | ---------- |
| jonas  | phone   | 202             | 5        | 12.183   | 12.182  | 0.001      |
| jonas  | desktop | 157             | 5        | 9.618    | 9.617   | 0.001      |
| jonas  | desktop | 181             | 18       | 61.561   | 61.56   | 0.001      |
| aisha  | phone   | 251             | 18       | 61.949   | 61.948  | 0.001      |
| aisha  | phone   | 267             | 26       | 83.543   | 83.542  | 0.001      |
| aisha  | desktop | 218             | 41       | 131.37   | 131.369 | 0.001      |
| diego  | phone   | 135             | 20       | 64.552   | 64.551  | 0.001      |
| diego  | phone   | 166             | 34       | 113.341  | 113.34  | 0.001      |
| diego  | desktop | 217             | 28       | 121.173  | 121.172 | 0.001      |
| diego  | desktop | 228             | 33       | 131.77   | 131.769 | 0.001      |
| rosa   | phone   | 249             | 7        | 32.782   | 32.781  | 0.001      |
| rosa   | phone   | 270             | 18       | 98.367   | 98.366  | 0.001      |
| rosa   | phone   | 278             | 22       | 121.495  | 121.494 | 0.001      |
| rosa   | desktop | 308             | 16       | 68.553   | 68.552  | 0.001      |
| iria   | phone   | 43              | 20       | 61.07    | 61.069  | 0.001      |
| iria   | phone   | 62              | 29       | 110.175  | 110.174 | 0.001      |
| iria   | desktop | 149             | 40       | 155.776  | 155.775 | 0.001      |
