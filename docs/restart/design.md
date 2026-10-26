# Small Works

Owner renewal: 2026-10-14. This restart supersedes the earlier campaign, UI, historical-save requirements and dated campaign queues. Original implementation remains in Git at `9f0e997` and later hosting commits. Source remains private; static deployment and private pushes remain authorized.

## Done

Deliver a reviewed, runnable local/public repair strategy game with genuine diagnostic puzzles, a shared workshop day, consequential parts and promises, and published-HF people whose actual acquired knowledge and competing priorities change autonomous work. Adam accepts enjoyment by playing. Five actual hours of development and revision run from 09:21:55 to 14:21:55 UTC on October 14. Do useful iteration through the deadline, not a short checkpoint followed by idle waiting.

## Busy afternoon, 2026-10-25

The optional `busy-workshop@1` scenario addresses playtest 10’s competing-promises request (F138). After returning the household lantern, open the workboard and choose **Try a busy afternoon**, before accepting other requests, recovering a switch or buying switches. Start by 13:30. Waiting for the agreed visit spends actual workshop time through the actor loop. This scenario replaces the three unaccepted opening offers; it does not change an accepted customer promise.

At 13:30, Nora’s path lantern, Rafi’s filter fan and Nora’s work light arrive with returns requested at 14:30, 15:00 and 15:30. They have real faults, not hidden completion scores. One new switch arrives; more reach the supplier next morning. The cracked lantern still offers a recoverable switch, at the cost of recovery time and its donor object. New and recovered parts remain separate within the conserved stock total. The player can choose which source to fit. Sam reserves and returns the same source on cancellation. His learned HF methods, actual assent and own afternoon commitment remain in force. His work can occupy the only bench. Costed player tests, repairs and recovery reserve that bench throughout their actual duration. A second bench permits parallel physical work; waiting, shopping and returning work do not reserve a repair bench. No acceptance or successful repair is forced.

An actual late return remains in the owner’s later request. An outstanding overdue object still withholds new work, and the existing next-request response remains. Planned activities are labelled as plans. In this scenario, a return to Sam’s mother waits while she actually performs her neighbour visit; a planned outing alone does not establish absence. Other people’s personal work is not automatically an outing.

The opt-in command and `busyWorkshop.edition` are saved and replayed. Without that command, existing `canonical-workshop@2` inputs retain their rules and saved state. A fresh browser seed changes generated later work; the first guided fault and ordinary opening requests remain authored. Remembering a valid repair is allowed. This is a bounded challenge, not a claim that the broader business progression is implemented.

## Verified delivery, 2026-10-26

App source [`7ad0c204b79bdc9bc2a3fe620b870fa2be23eb1a`](https://github.com/adam0white/repair-game/commit/7ad0c204b79bdc9bc2a3fe620b870fa2be23eb1a) passed the one independent review after its bench-reservation correction, the normal 341-test lane and [exact CI](https://github.com/adam0white/repair-game/actions/runs/40247182903). A fresh clean managed deployment reports that exact source and `dirty:false` in the [live manifest](https://repair.adamwhite.work/release.json). Builder checks covered both required Chrome sizes and controlled WebKit Feedback choices. The owner’s existing save was preserved. No new player round or owner acceptance is claimed.

## Deferred and reconciled, 2026-10-25

| Source | Current disposition | Owner / target |
|---|---|---|
| F138 / GDI033 | Optional busy afternoon delivered in `7ad0c20`, 2026-10-26. Acceptance is an observed player result, not a test gate. | Adam / lab director, 2026-11-03 |
| GDI034 / 036 / 038 | Actual outing boundary, distinct recovered stock and duplicate meeting-room fan suppression apply to the opt-in scenario. Earlier ordinary worlds retain their saved behavior. | Adam / lab retest, 2026-11-03 |
| GDI037 | Current `reportedSymptoms` groups equal readings rather than repeating a generated clause. No duplicate rewrite. | Adam / lab retest, 2026-11-03 |
| GDI039 | Fresh browser starts use a saved random seed. Replay retains its recorded seed. Opening faults are intentionally authored; no claim of a different opening puzzle on every run. | Adam / lab retest, 2026-11-03 |
| GDI040 | Current Look inside sets the cover open; it does not toggle it shut. Historical defect no longer matches source. | Reconciled; no new player evidence claimed |
| GDI041 / 042 | First-week continuation now precedes the long account. Notes use readable light text on the dark tool surface. | Adam / lab retest, 2026-11-03 |
| Quiet Feedback choices / GDI690 | Immutable client0.4.11 and kit0.5.12; the Feedback page offers “I'm stopping” and “I'm confused”. Selection sends nothing. Submit retains the ordinary note receipt and optional run/privacy boundary. | Adam / lab retest, 2026-11-03 |
| F137 / F247 | Retain the existing honest-return account, performed-work presentation and next test beside the repair response. | Adam / lab retest, 2026-11-03 |
| SW1 / SW2 | Generic focus depletion and voice companionship remain routed to HF’s director. The pinned HF3.0.0 package is not extended in this host. Earlier requests in the boundary document remain historical evidence, not a local fork. | all, 2026-10-30 |
| GDI043 / 044 and current UI, cast, recording readiness | No player round or owner acceptance by this worker. The lab director owns retesting. | lab director / Adam, 2026-11-03 |
| Pre-restart campaign and long-term roadmap | The October14 restart retires old chapter queues. Current vision retains crew, management, economy and multiplayer ambitions behind their recorded activation conditions. No server or economy slice selected here. | Adam; roadmap review 2026-11-09 |


## Game

Working title: Small Works. Begin with a family lantern at a home bench. Restore low-voltage objects by investigating their functional systems. Expand into a neighbourhood workshop through work and teaching. The first week provides a meaningful ending; continuing workshop days provide seeded new constraints. Nothing advances in real time.

The bench presents an original interactive component diagram, a meter, retained readings and a short technical reference. The player chooses probe locations and test conditions. Electrical readings follow a circuit model; mechanical observations follow a drive model. Faults are seeded once and saved. Useful tests distinguish plausible faults. Interventions change actual components, consume time and sometimes finite parts. Running an object on the bench does not establish reliability under its owner's use.

The workboard shows offers, accepted return promises, part inventory and concurrent work. Accepting everything is not a winning policy. Honest unfinished return is viable. Parts can be bought or recovered by sacrificing a donor. Income can support a second bench, better instruments or better stock. Earlier objects and methods remain useful.

Sam can watch real tests and interventions. Only actual attended observation teaches categorical methods through HF 2.2.1. Delegation offers legal alternatives to HF, not a host-selected correct repair. Unknown evidence permits help-seeking. Rest, a personal commitment and understood work compete in ordinary decisions. Actual reports explain activity and knowledge. No scalar training bar grants conditional expertise.

## Interfaces and ownership

`model.ts` owns physical truth and measurements. `people.ts` owns the public-HF adapter and learned action choices. `engine.ts` owns jobs, clock, parts, economic consequences and saves. `App.tsx` and components own pure presentation and player input. Simulation never imports UI. Models and HF snapshots save together under schema and engine `small-works@4`, with strict HF 2.2.1 provenance. The local game version is `3.0.0-alpha.4`. Earlier campaign and Small Works engine-1, engine-2 and engine-3 packets are intentionally unsupported. Autosaves use `small-works-save-v4` and leave the earlier key untouched.

## Checks

- Several hidden causes share symptoms; discriminating tests separate them.
- Repeated blind interventions consume resources without granting repair progress.
- Verification checks bench, movement and load where relevant.
- Finite parts cannot be spent twice; parallel work cannot own the same object.
- Attended teaching changes later HF choices; withheld and alternative teaching controls differ.
- Fatigue and commitments can change actual activity selection.
- Identical seed/actions and save/resume produce identical rule state.
- Source-unread players diagnose one repair and describe at least one consequential choice.
- Desktop, narrow screen and keyboard interaction remain usable.

## Consultation

Astra recommends diagnostic workshop strategy over a room simulator or a management clicker. Independent wildcard recommends deterministic consequences, chosen probe locations and a shared time budget. Both warn that exhaustive testing followed by a highlighted fix reproduces the old problem. Primary references: [SHENZHEN I/O](https://www.zachtronics.com/shenzhen-io/), [Into the Breach](https://www.subsetgames.com/itb.html), [Overboard!](https://www.inklestudios.com/overboard/), [Assemble with Care](https://ustwogames.co.uk/our-games/assemble-with-care/).

## Published dependency correction

HF 2.2.1 corrects acquired-method evidence: another independently successful action is no longer counted as failure of an earlier action. Same-action failure and bounds on attention, trust, decay and restore remain. Required cues still must match; unobserved hidden exceptions are not detected. The [release](https://github.com/adam0white/human-framework/releases/tag/v2.2.1) is consumed as an exact npm dependency. Sixteen focused consumer checks pass, including uncontrolled teaching versus withheld teaching; final integrated review and actual play remain required.

## Integrated engine-4 checkpoint

The current local game is `3.0.0-alpha.4`, schema/engine `small-works@4`, autosave key `small-works-save-v4`, with exact published HF 2.2.1. The integrated check passed lint, types, **233 tests across 23 files** and production build. The public build is now verified as engine 4 at clean UI `0e80d89` (gameplay core `38cbae0`). The engine-3 publication at `7570eea` remains historical.

Sam's delivery options require actor-received checks. Ordinary diagnostic and part methods transfer across requested paces; calibration retains the exact requested pace. Matching-condition intervention safeguards prevent a check under another condition from proving the intervention. Actual native goal withdrawal releases responsibility and survives save/restore in a regression. Self-hosted licensed fonts replace Google imports blocked by live CSP.

These are technical checks. Source-unread play has not established a whole independent mechanical repair, and Adam has not accepted feel. The exact integration is frozen and publicly verified. Candidate-4 play is recorded; whole independent repair and owner acceptance remain unestablished.

## Verified engine-4 publication

Main is integrated and privately pushed at `38cbae0694006cd5157add4e144b35cea686aa61`. Branch and main CI passed. Deployment reran 233 tests, build and dry-run checks. The live [game](https://repair.adamwhite.work) matches clean source, alpha.4, engine 4 and HF 2.2.1. Public basic UI, save/replay, accessibility exposure, narrow layout and same-domain fonts pass smoke checks. Candidate 4 is frozen at hash `a26396d98b27966f098f4a36b1427cd4b73516f79a826420108d12de88904ada`. Two actual candidate-4 play records are complete. The final public presentation and paired mentoring follow-up pass; Adam accepts feel later. Technical delivery does not establish enjoyment, whole independent repair in natural play or Adam's acceptance.
