# Small Works

Owner renewal: 2026-10-14. This restart supersedes the earlier campaign, UI, historical-save requirements and dated campaign queues. Original implementation remains in Git at `9f0e997` and later hosting commits. Source remains private; static deployment and private pushes remain authorized.

## Done

Deliver a reviewed, runnable local/public repair strategy game with genuine diagnostic puzzles, a shared workshop day, consequential parts and promises, and published-HF people whose actual acquired knowledge and competing priorities change autonomous work. Adam accepts enjoyment by playing. Five actual hours of development and revision run from 09:21:55 to 14:21:55 UTC on October 14. Do useful iteration through the deadline, not a short checkpoint followed by idle waiting.

## Game

Working title: Small Works. Begin with a family lantern at a home bench. Restore low-voltage objects by investigating their functional systems. Expand into a neighbourhood workshop through work and teaching. The first week provides a meaningful ending; continuing workshop days provide seeded new constraints. Nothing advances in real time.

The bench presents an original interactive component diagram, a meter, retained readings and a short technical reference. The player chooses probe locations and test conditions. Electrical readings follow a circuit model; mechanical observations follow a drive model. Faults are seeded once and saved. Useful tests distinguish plausible faults. Interventions change actual components, consume time and sometimes finite parts. Running an object on the bench does not establish reliability under its owner's use.

The workboard shows offers, accepted return promises, part inventory and concurrent work. Accepting everything is not a winning policy. Honest unfinished return is viable. Parts can be bought or recovered by sacrificing a donor. Income can support a second bench, better instruments or better stock. Earlier objects and methods remain useful.

Sam can watch real tests and interventions. Only actual attended observation teaches categorical methods through HF 2.2.1. Delegation offers legal alternatives to HF, not a host-selected correct repair. Unknown evidence permits help-seeking. Rest, a personal commitment and understood work compete in ordinary decisions. Actual reports explain activity and knowledge. No scalar training bar grants conditional expertise.

## Interfaces and ownership

`model.ts` owns physical truth and measurements. `people.ts` owns the public-HF adapter and learned action choices. `engine.ts` owns jobs, clock, parts, economic consequences and saves. `App.tsx` and components own pure presentation and player input. Simulation never imports UI. Models and HF snapshots save together under schema and engine `small-works@3`, with strict HF 2.2.1 provenance. The local game version is `3.0.0-alpha.3`. Earlier campaign and Small Works engine-1 and engine-2 packets are intentionally unsupported. Autosaves use `small-works-save-v3` and leave the earlier key untouched.

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
