# The Long Road

A static bake-off prototype. Acceptance is the owner's ten-minute phone or desktop play verdict. No claim about fun follows from bots.

## Built

Five travellers, one cart, twelve stops, and a thirty-day snow deadline. Choose short rough roads or long gentle roads. Change pace and rations. Ask a particular traveller to mend, scout, carry a sick companion's load, watch, or forage. The journey starts in motion. The wheel breaks three seconds after the first input. Its prompt directs the player to exhausted Tavi. HF refuses; Orin can accept and mend. Recovery can also make Tavi willing later.

The seeded host simulation runs at 30 fixed ticks per second without DOM or wall-clock input. HF makes every request and departure choice. The host applies only the chosen action's physical consequences. Work keeps its timer across a stop. Stops provide at least nine seconds to recover and choose a road. Choices default after twelve seconds. Scouting reduces rough-road damage; carrying helps the least healthy companion; watching prevents losses at exposed stops; foraging supplies food. Skilled travellers work more effectively. Leaving removes the person and their skill.

Endings: everyone arrives; fewer people arrive; everyone leaves the leader; winter closes the pass; the party cannot continue from ill health. The first four occurred in the measured bot batch; the ill-health ending exists but was not reached in that batch.

Canvas art includes layered hills and pines, a sun/moon cycle, rain, approaching snow, distinct silhouettes and gaits, fatigue/illness posture, job indicators, a tilted broken cart, and its lantern. Synthesized wind, footsteps, wheel sounds, task cues and stop phrases start on first input. No visible words precede that input. Refusal reasons appear over the person on the next frame. The sparse HUD shows stops, days until snow, food, and cart condition with symbols. Task menus replace the HUD.

## Play

Serve this directory with an ordinary local static server, then open `index.html` through that server. The game itself needs no build, dependency install, external assets, or remote service. Its plain modules load from the same directory, including the supplied `hf.js`. Direct `file:` module loading depends on browser security policy.

Touch/mouse: tap the wheel prompt, then the people. After the first refusal, ask another person. Later, tapping someone opens their five tasks. Bottom-left changes pace; bottom-right changes rations. Dots show the setting, and changing it briefly names it. At a stop, choose a road; the selected road gains a ring while the party rests.

Keyboard: any key starts. `1`–`5` select a traveller from left to right. `M` mend, `S` scout, `C` carry, `W` watch, `F` forage. During the opening, selecting a traveller asks for the repair directly. `P` cycles pace. `R` cycles rations. Left/right choose rough/gentle at stops. Escape dismisses a task menu. Enter/Space restart after an ending.

## HF boundary and missing work

`people.mjs` imports the real bundled HF 4.17.0 `createRun`, `createPerson`, and `step` APIs. It submits `offers.received`, ordinary `suggestion.received`, and `decision.requested` inputs. A real HF action-start boundary supplies the selected task, rest, continuation, or departure. Logs retain that request and decision evidence. Reasons translate HF need/veto evidence into short plain words. No host willingness threshold, random assent roll, or coercion decides agreement or departure.

This is a deliberately limited HF integration. Each ask authors a fresh decision episode from cumulative host fatigue, health, hunger and neglect premises. Those premises author HF body, needs and voice trust. The first Tavi request explicitly authors exhaustion. Later requests use recovered fatigue. HF chooses within those premises, but its autobiographical memory, completed-action learning, promises and voice history do not persist between episodes. Host timers resolve physical work; this prototype does not submit HF action completion receipts. Expected need effects are authored game assumptions. This is not a retained HF journey simulation or an empirical model of people. There is no invented HF call for bargaining: changing conditions and asking again is the available negotiation. Explicit counteroffers are not built.

No save/resume, export UI, account transfer, external playtest, deployment, paid assets, or full-game graduation work. The prototype has no npm dependency or build step. The existing supplied bundle is unchanged. No files outside this directory were edited. Nothing was committed or pushed.

## Verification

Commands from the repository root:

```sh
node prototypes/long-road/bots.mjs 12
node prototypes/long-road/verify.mjs
node --check prototypes/long-road/view.mjs
node --check prototypes/long-road/people.mjs
node --check prototypes/long-road/sim.mjs
```

The 48-run batch, seeds 1–12 for each policy:

| Policy | Endings | Simulated seconds |
| --- | --- | --- |
| Abandoned | 12 snow | 447–500 |
| Ruthless | 12 alone | 372 |
| Hurried, full rations | 9 together, 3 parted | 372 |
| Careful | 12 together | 446–462 |

All runs ended. Every measured run stayed within six to ten minutes. Same seed and policy produced identical decision/event logs. This is policy coverage, not proof for every possible player input.

`verify.mjs` imports the simulation and actual view module in Node. It checks authentic opening refusal, another traveller agreeing, completed repair, unfinished jobs surviving arrival, minimum stop recovery, and later scout completion. It executes drawing/input logic with mocked DOM, Canvas and WebAudio surfaces at 375×812 and 1280×800. It checks zero visible text/audio before input, refusal text on the next frame, the twelve-token display budget on exercised frames, keyboard operation, phone-coordinate wheel/person taps, and first-input sound initialization.

Two independent code reviews found short sessions, instant completion at stops, a bypass of the first refusal, and unreadably small phone reasons. Those issues were corrected. Phone refusal type is now 15 CSS pixels at 375px width; principal hit regions are at least 45 CSS pixels. The scene retains a fixed aspect ratio and letterboxes on tall/wide screens.

Actual browser verification could not run: the Playwright tool was rejected because approval is unavailable, and the sandbox denied binding a local HTTP server. Mocked Canvas execution does not verify pixels, real touch, browser audio policy, audible mix, frame rate, or actual mobile readability. No full ten-minute human play session occurred. Root game/build checks were not run for this isolated prototype-only task.

## Three likely bad feelings

1. The symbol-only pace, ration and resource controls may require too much discovery. Refusal is taught directly; later strategy is less explicit.
2. Twelve legs share a compact landscape and a small event set. The middle minutes may feel repetitive despite snow, food pressure and changing tasks.
3. HF choices use fresh episodes and authored expectations. Repeated requests can feel less personal than persistent relationships or explicit counteroffers would. Tuning that yields sensible bot endings does not establish believable negotiation.

## 2026-11-22: first outside play notes

One tester played the 2026-11-22 build on a phone and gave spoken notes, passed on by the owner. The tester did not understand the game: no start, no goal, no visible effect of any choice, hard words, too slow. They preferred Lantern.

| Note | Done in this change | Left as a proposal |
| --- | --- | --- |
| No menu or tutorial; where am I going, when does it start | Start card: goal, 12 stops, 30 days, tap a traveller, tap to set out | A named route with a map |
| Choices and events show nothing | A message for every event and every choice: refusal with its reason, agreement, finished work and its effect, theft, illness, exhaustion, low food, snow warnings, each stop. Pace, meals and road choices say what they cost | Injuries and other road events; stopping to eat; hunting |
| Hard words (mend, forage; small, fair, full) | fix cart, look ahead, help sick, guard, find food; pace slow, steady, fast; meals small, normal, big; every number has its name | |
| Short and rough against long and gentle means nothing | The stop panel states each road's cost, and choosing one says it again | A visible difference in the landscape |
| Too long | The journey runs 1.3 times faster (`?speed=` to compare); balance is unchanged | A shorter trip |
| The sun rises but it stays dark | Edge darkening cut by more than half | |
| Why no horses | | A draught animal |

The earlier design rules "no visible words before input" and the twelve-word display budget are dropped; `verify.mjs` now expects the start card. This supersedes the wording in the sections above (`I can mend` is now `I’ll fix it`, and so on).

Checked: `bots.mjs 12` endings unchanged; `verify.mjs` passes; played through the opening, a task, pace and a stop in a Chromium phone profile with no page errors. Not verified: a full journey by a person, real-phone feel and sound.

## 2026-11-22: tester t1's answer (notes #31, #33)

- Is it clear now what to do after the start card and messages? "A little" (#31).
- Tester t1 suggests dropping The Long Road and Copper Afternoon to focus on Lantern and Ant Promotion (#33). Recorded as a proposal in `prototypes/NOTES.md`; nothing is removed.
