# Alibi

Alibi is a wordless phone whodunit set in a cutaway house. Scrub the evening, compare the room and clock on each animal’s alibi with the replay, and drag the stamp onto the animal whose statement contradicts the scene.

The original premise comes from the brief. Grapevine and Borrowed guided the page structure, kit integration and use of picture clues. The cases, art, characters and rules were drawn and written here.

## First round (historical)

### Rules and progression

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

### Checks

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

### Not verified

Real-phone touch, audio, interrupted play, physical sharing and play by a person are unverified. Mouse and keyboard are implemented but touch profiles are the tested inputs. The production Worker route and the live notes script and recording endpoint were outside the local checks. The shared kit phone suite stops because `experiments/kit/games.json` lacks the slug. The local lab allowlist already contains `alibi`. Its deployed version and recording acceptance are unverified.

Early same-time cases can be solved by watching the crime room. Late cases require checking statements when several animals were present. Individual mechanics can serve as corroboration or red herrings in a combined case even when one source of evidence suffices. The ramp has been measured structurally, and its difficulty for people remains unmeasured.

### Builder

Built a dossier strip so the player can inspect or accuse someone during the blackout. Room signs, dossier icons and the selected clock mark repeat the same information in the three places it is needed. The solved card shows the claimed and observed rooms side by side without exposing the answer after a loss.

Possible next tests include an unaided solve by a new player and checking whether a mixed case should require two independent observations.

### Kit candidates

A coordinate-based ghost gesture could let a game point to its actual drag handle and drop target. This implementation uses the kit idle hint and draws case-specific demonstrations with the replay.


## Second round

Alibi is a wordless whodunit played by scrubbing a clock, comparing an animal’s picture alibi with the replay, and stamping the one contradiction. The evening now plays across a house, a bakery, a ship and a greenhouse.

| Chapter | Cases | Setting | First case teaches |
| --- | --- | --- | --- |
| Ⅰ | 1–7 | House | Scrub, inspect a picture alibi, stamp. Case 3 introduces a shuttered incident and the need to compare an alibi. |
| Ⅱ | 8–14 | Bakery | Alibis can refer to different clock marks. |
| Ⅲ | 15–21 | Ship | Watch costumes go on, then follow the pair that trades costumes. |
| Ⅳ | 22–28 | Greenhouse | Match sound symbols to suspects when the lights go out. |
| Ⅴ | 29–36 | All four | A person carrying the item later still needs an alibi checked. |

- The new site crimes are a missing croissant, compass and orchid blossom. Cases 1–2 still show who is at the crime when it happens. Case 3 onward hides the incident at one closed shutter mark and shows the changed object afterward. The public replay is generated before the culprit changes a statement. Each suspect's two possible claim rooms let the same picture dossiers admit a different culprit under a different replay.
- Clock marks stay five minutes apart. Drag between visible marks to see suspects walk, including via side ladders between floors. At a mark the suspects stir, read, water, paint or work with small tools. A wrong stamp costs one star and the selected innocent shows a hurt expression. A correct stamp immediately saves progress and starts a skippable wordless replay of the theft or tampering, the stamp and the item drop. The result compares the stated room with the observed room.
- Hold a suspect for 460 ms to pin an observation. A visible portrait or a matching sound supplies the room at the current mark. When the camera cannot identify the suspect, the note instead records the stated alibi with quotation marks. A case can hold three distinct notes. Tap a row to jump to its mark, or tap its cross to remove it. A new run clears the notebook.
- Hard Daily unlocks after case 14. It has eight suspects, twelve clock marks, eight costumes, a costume exchange, a blackout, a carrier and staggered alibis. Standard Daily remains available from the start. Both use UTC dates, keep independent streaks, and mark solves in a rolling 28-day calendar. The share PNG shows the mode, date, crime, stars and active time through the correct stamp. It contains no suspect or room comparison.
- The save remains the single `alibi-save` blob. Existing stars, unlocked levels and sound preferences carry over. A completed old case 21 opens case 22. The previous daily streak fills in the dates it establishes. The newly saved date scores retain the best stars and, for a tie, the quickest recorded active time. A forced `?level=` gives test access and advances progress only when it matches the unlocked case.

### Checks

| First accusation, cases 3–36 | Correct | Rate |
| --- | ---: | ---: |
| Compare alibi and replay | 6,528 / 6,528 | 100% |
| Random | 919 / 6,528 | 14.08% |
| Crime room only, seeded sample | 919 / 6,528 | 14.08% |
| Weighted chance for seeded cast sizes | 950.86 / 6,528 expected | 14.57% |
| Crime room only, every culprit in each balanced lineup | 272 / 1,896 | 14.35%, exactly chance |

The observer bot also solved both tutorial cases in every test, all 36 default cases and 366 dates in each daily mode. The balanced proof checks 272 case and seed pairs. For each, every culprit produces the same full public replay. Flipping the relevant room draws shows that the same dossiers also admit every culprit when the replay is omitted. Mutations that plant a second lie or remove required exchange or sound evidence fail. The deterministic cases are learnable by repetition. The test measures what the visible replay can establish on its own.

Browser checks used iPhone 13 WebKit at 390×664, Pixel 7 Chromium at 412×839 and Chromium at 360×640. They drove touch scrubs, a fractional walk, case and daily stamps, a cancelled stamp and hold, the notebook limit and removal, pause and resume, reveal and skip, legacy save migration, both streaks, the calendar, and share PNG generation. Lab outcomes were intercepted for solved, wrong and left. JavaScript syntax checks passed. The shared phone suite passed before the changes. Its repository-wide registry check later stopped on the separate `nightshift` experiment. Restricting that preflight to Alibi in memory let both shared browser checks pass. No kit files changed.

The first screenshot revision distinguished ship and greenhouse wall gaps from house brick, softened the ladders and added floor lighting. The second added an alibi jump chevron, a camera mark on the clock, binding rings and a hold demonstration for the notebook. The reveal now magnifies its room and the calendar shows the date span.

### Not verified

Real-phone touch, sound, interruption and the native share sheet are unverified. No human playtest or live deployment check was performed. Browser tests mock the live lab endpoint. Wordless recognition of all eight costume shapes, the difficulty ramp, and discovery of the optional hold gesture still need a player test. Some mixed cases can be solved without using every clue type.

### Builder

Added the notebook jump-back and a closed shutter at the incident. The shutter creates the same visible opportunity for every suspect and gives the reveal a missing moment to play. The calendar uses separate shapes for standard and hard solves. The result and share PNG use independent drawings so the share can omit the culprit.

### Kit candidates

The Alibi-specific controls use canvas hit targets. The shared hint and save interfaces still fit. An empty notebook's hold demonstration could be reused if another experiment needs a hold-to-pin action.
