# Alibi

Alibi is a wordless phone whodunit set in a cutaway house. Scrub the evening, compare the room and clock on each animal’s alibi with the replay, and drag the stamp onto the animal whose statement contradicts the scene.

The original premise comes from the brief. Grapevine and Borrowed guided the page structure, kit integration and use of picture clues. The cases, art, characters and rules were drawn and written here.

## Rules and progression

- The replay opens at 7:00 and snaps to five-minute clock marks. You can drag continuously between marks, or tap a mark directly. Tap a portrait or a visible, undisguised actor to inspect their alibi. Tap the alibi to visit the stated time.
- Drag the stamp onto a portrait or an undisguised actor. Three stars start each case. Each distinct wrong accusation costs one star. A solved case keeps its remaining stars. Three misses end the case and leave the solution hidden for a retry.
- The 21 ordered cases have a fixed default campaign seed. The case picks the animals, alibis and blocking from its seed. `?seed=` accepts an unsigned integer and `?level=` selects a campaign case by number.
- In staggered cases a truthful bystander shares the crime room at the incident. The two costumes go on in place and later exchange in place. Shared walks have two animals leave one room and arrive in the same other room. The blackout hides bodies at one clock mark and shows a distinct sound symbol for each animal’s room. The honest carrier has the item after the incident.
- The Daily uses the UTC calendar and cycles across cases 16–21, with a seed for the date. One solve per date advances the streak. The share image shows crime, stars, date and streak without naming the culprit.
- The game stores progress, best stars, sound and daily history in the `alibi-save` JSON blob. The kit separately stores its one-shot hint flag and manages shared consent and recording keys.

| Chapter | Cases | Suspects | Rooms | Clock marks | Alibi marks | Introduced |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–7 | 6–7 | 3–5 | 5–7 | 1–4 | Scrub, inspect, accuse, staggered statements |
| 2 | 8–14 | 7–8 | 5–6 | 8–10 | 1–4 | Costume exchange, shared path, blackout |
| 3 | 15–21 | 8 | 6 | 10–12 | 1–5 | Honest carrier and combined mechanics |

## Checks

`bots.mjs` validates 192 seeds for each case and prints the per-case difficulty table. The observing policy sees the same room, portrait, costume, time and sound data supplied to the renderer. It does not read the answer or private schedules. This is a rules-level test, separate from browser rendering.

| First accusation | Correct | Rate |
| --- | ---: | ---: |
| Observing | 4,032 / 4,032 | 100% |
| Random | 552 / 4,032 | 13.7% |
| No scrub | 528 / 4,032 | 13.1% |
| Weighted chance | | 13.8% |

Every campaign default and 366 daily dates also have exactly one visible contradiction. Counterfactual replays preserve the opening view and every dossier for every possible culprit in 252 case/seed pairs. A planted second lie fails the proof. Removing blackout sound symbols hides the culprit’s contradiction in 1,152 trials. Ignoring the swap breaks the verdict in 984 trials.

`check.mjs` serves the experiment at `/alibi/` with its kit. It exercises the 390×664 iPhone 13 WebKit profile, the Pixel 7 Chromium profile and a 360×640 Chromium profile. The checks use touch events for scrubbing, inspecting and stamping. They cover pause/resume, leaving for the menu, losing stars, solving, retry, save/reload, daily streak transitions, share-card preview and mocked lab records for solved, wrong and left. The static experiment planner includes `alibi`.

Reviewed screenshots at 390 and 360 CSS pixels. Three visual revisions added exterior supports and warm light, separated the stamp silhouette from its dock and replaced small sound waveforms with shape symbols, then added foreground detail and improved result and blackout cues.

## Not verified

Real-phone touch, audio, interrupted play, physical sharing and play by a person are unverified. Mouse and keyboard are implemented but touch profiles are the tested inputs. The production Worker route and the live notes script and recording endpoint were outside the local checks. The shared kit phone suite stops because `experiments/kit/games.json` lacks the slug. The local lab allowlist already contains `alibi`. Its deployed version and recording acceptance are unverified.

Early same-time cases can be solved by watching the crime room. Late cases require checking statements when several animals were present. Individual mechanics can serve as corroboration or red herrings in a combined case even when one source of evidence suffices. The ramp has been measured structurally, and its difficulty for people remains unmeasured.

## Builder

Built a dossier strip so the player can inspect or accuse someone during the blackout. Room signs, dossier icons and the selected clock mark repeat the same information in the three places it is needed. The solved card shows the claimed and observed rooms side by side without exposing the answer after a loss.

Possible next tests include an unaided solve by a new player and checking whether a mixed case should require two independent observations.

## Kit candidates

A coordinate-based ghost gesture could let a game point to its actual drag handle and drop target. This implementation uses the kit idle hint and draws case-specific demonstrations with the replay.
