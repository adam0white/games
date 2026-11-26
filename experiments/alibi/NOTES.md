# Alibi

Alibi is a phone whodunit. Tap a portrait to read its picture alibi, visit the claimed time and compare it with the room in the replay. To accuse, tap Accuse and a portrait, or drag the stamp onto the suspect.

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

## Cold play audit — 2026-11-24

The first pass used the default campaign on a local server. Inputs came from screenshots, with browser-delivered touch taps and drags. Neither player read the game source, notes, state hook or answer before playing. WebKit used the iPhone 13 profile at 390×664. Chromium used a 360×640 mobile viewport. Chromium deduced cases 1–8 without solution hints. During the WebKit run the Chromium report disclosed the repeated owl in cases 3–6, so those four WebKit solves are repeat-interaction evidence. Both solved cases 1–8, opened the notebook, pause menu, case picker, calendar and Daily, reached a loss, viewed a share card and reloaded during play. Chromium also solved through case 14 to open Hard Daily normally. The game has no endless mode.

Paths below are relative to the requested `shots/audit-alibi/` directory. Each numbered file records an action or an observation. The `webkit/d` filename prefix marks the original eight-case run. The `verified-` files and `chromium-after/` record touch replays. Chromium also reused its original progressed tab for Hard Daily and the new share card. Those later files start at `chromium/231-after-fixes-home.png`.

| Rank | First-play observation | Change and replay evidence |
| --- | --- | --- |
| 1 | No stated objective. The claim looked like a status badge. At the right time, the tutorial illustrated stamping the selected **truthful** cat. Tapping the stamp gave no lasting response. `webkit/001-play.png`, `003-cat.png`, `004-time.png`, `008-stamp-again.png` in the same directory | Ask who lied. Let the player inspect a portrait, visit its time and compare against the outlined room. Remove the tutorial accusation. Label the stamp **Accuse**. Tapping it arms a separate portrait tap and offers Cancel. The original drag still works. `webkit/verified-001-first-case.png` through `verified-003-claimed-time.png`, `verified-013-hedgehog-alibi.png` through `verified-016-accusation.png`. |
| 2 | A mid-case reload put the player on the title screen with no way back to their evidence. `chromium/005-time.png`, `chromium/011-mid-case-reload.png`, `webkit/017-reload.png` | On normal reload, return to Pause and restore the same investigation, active time, selected suspect, clock, notes and rejected suspects. The checkpoint belongs to the tab in session storage. Durable scores still use the original local save and format. Explicit Menu leaves the case. `webkit/verified-009-pin-current.png` through `verified-011-resume-with-pin.png`, `chromium-after/023-inspect-bear.png` through `028-verify-notes.png`. |
| 3 | A miss crossed out a face and removed a star, with little explanation. The loss said only “Try again”. During the first fixed replay the last portrait tap also activated the newly exposed Menu button. `webkit/d057-daily-miss1.png`, `webkit/d059-daily-loss.png`, `chromium-after/033-wrong-owl.png` | Explain the truthful alibi and the star cost. On loss, explain the three innocent accusations and how to compare a statement on retry. Suppress the canvas touch's follow-on click so the loss stays up until the next action. `chromium-after/022-accused-cat.png`, `chromium-after/088-third9.png`, `chromium-after/089-stable-loss.png`. |
| 4 | The empty notebook covered the claim and gave no clear instruction. Its 31 px rows made erasing the intended note difficult. Portrait targets were 42 px tall. The case buttons were 43 px tall and Privacy was an inline link. `webkit/002-notebook.png`, `webkit/012-cases.png`, `chromium/001-home.png`, `chromium/002-play.png` | Explain hold-to-pin, jump and erase. Distinguish a duplicate from a full book. Enlarge the portrait, note and menu targets. `webkit/verified-004-empty-book.png`, `chromium-after/010-notebook.png` through `016-remove-bear.png`, `chromium-after/001-home.png`, `chromium-after/003-cases.png`. |
| 5 | The shutter hid the entire incident just as I went looking for it. Hard Daily added sound marks with little indication of how to read them. Retapping the current clock mark made a tone without moving the clock. `chromium/052-c3-crime.png`, `chromium/220-endless.png`, `webkit/004-time.png` | Explain the shutter and direct the player to the time each suspect claimed. In a blackout, tell them to match the portrait and room sound symbols. Remove the redundant clock tone. `chromium-after/043-shutter.png`, `chromium/233-after-blackout.png`, `chromium/234-after-blackout-claim.png`. |
| 6 | Cases 3–6 revealed the owl four times in succession. Guessing the owl replaced deduction. `chromium/060-c3-accuse.png`, `070-c4-accuse.png`, `080-c5-accuse.png`, `090-c6-accuse.png` | Swap two portraits in each of default cases 4 and 6. The eight reveals now show hedgehog, cat, owl, rabbit, owl, bear, mouse and fox. Actor IDs, claims, rooms and stored stars carry over. Custom seeds and Daily are unchanged. `chromium-after/046-c3-accuse.png`, `051-c4-accuse.png`, `056-c5-accuse.png`, `061-c6-accuse.png`. |
| 7 | The locked ◆ Ⅱ looked like an unnamed mode. The calendar and sound toggle also relied on glyphs. Both calendar streaks lacked labels. Home still said the game records play after opt-out. `chromium/009-recording.png`, `011-mid-case-reload.png`, `122-endless.png`, `226-expert-calendar.png`, `228-mute.png` | Name Hard Daily and its case 14 unlock, label both streaks, show sound and recording status in words. `chromium-after/001-home.png`, `002-sound-off.png`, `005-calendar.png`, `033-wrong-owl.png`, `chromium/231-after-fixes-home.png`. |
| 8 | Again was the highlighted action on a campaign win, which caused an accidental replay. The Daily image did not identify the game or mode in words. Image gave no feedback when tapped. `chromium/035-continue.png`, `025-share.png`, `026-share-image.png` | Highlight Next on a campaign win. Put the game name, mode and full date on the PNG. Label the available share or save action and acknowledge the browser download. `webkit/verified-017-next-primary.png`, `chromium/240-after-share.png`, `241-after-save-image.png`. |

The before-and-after passes found no clipped menu or obscured primary control at either requested size. In-scene actors and the individual ticks of a twelve-mark timeline can still be closer than 44 px. The portrait grid offers an alternative for each identifiable actor. The clock is one continuous scrub surface, and the claim jumps directly to its mark. The calendar days display history and do not accept input. The notebook temporarily covers part of the house while open. It can be closed to inspect that part of the replay.

Source inspection paired the remaining sound events with a visual action: case start opens the house, scrubbing changes the clock and scene, inspection selects a portrait or claim, grabbing or aiming the stamp changes its drawing, pinning changes the notebook, accusations change the stars or screen, and the reveal shows the incident. There was no independent audio capture or listening test. Actual audibility, physical thumb occlusion, native sharing, browser process termination, live lab receipt and human first-play comprehension remain unverified. The first eight cases still use the same deduction rule. The portrait change removes the repeated-answer shortcut. Enjoyment and difficulty still need a human playtest.

The smallest remaining evidence marks are the eight sound badges in Hard Daily. The selected alibi repeats the badge above the house, but reading every badge at once on a 360 px screen still takes effort. Enlarging all eight within the portrait strip would cover faces. The hard-mode layout and costume set are unchanged pending a player test of symbol recognition. See `chromium/234-after-blackout-claim.png`. The tightly spaced clock marks and nearby actors are visible in that image and `webkit/d041-case8-check-cat.png`. A separate larger alternative already exists for both operations.

### Verification

| Check | Result |
| --- | --- |
| Game browser suite, WebKit iPhone 13, 390×664 | Passed |
| Game browser suite, Chromium Pixel 7, 412×839 | Passed |
| Game browser suite, Chromium, 360×640 | Passed |
| Shared phone suite, Alibi selection | Passed on WebKit and Chromium |
| Rules bots | Passed all 36 defaults, 6,912 seeded campaign cases and 732 dailies. The observing bot solved 6,528 of 6,528 non-tutorial cases. |

The new regressions failed on the original behavior before the fixes. They exercise the objective, truth comparison, tap accusation and cancel, accidental accusation animation, notebook messages and target edges, shutter and blackout instructions, loss, reload recovery, opening cast variety, consent copy, mode labels, calendar, menu target sizes, Next and PNG download feedback. The click-through assertion failed on the intermediate tap-to-accuse implementation. A native touch trace showed the final canvas release followed by a click on the newly visible Menu button. The corrected release kept the loss visible. The existing suite still loads old saves and intercepts the solved, wrong and left lab outcomes.

Concurrent browser runs on the host caused earlier action and screenshot timeouts. The final game suite runs its menu context before opening its campaign context, uses touch for menu controls and passed all three profiles. The browser confirmed PNG generation and a download event. Native share-sheet delivery remains untested.

## Words and pictures — 2026-11-24

| Cold-play instruction | What the player sees now |
| --- | --- |
| Find the lie and inspect a portrait. | The short question “Who lied?” sets the goal. A ghost finger pulses over a portrait. |
| Tap the alibi to visit its time. | A ghost finger taps the alibi’s chevron while an arrow marks the corresponding replay tick. |
| Compare the suspect with the outlined room and accuse a liar. | Matching brackets link the alibi’s room icon with the room in the replay. In chapter I, and in a Daily before case 8, the suspect stays circled when visible (see the middle and late game audit). A circle and square beside the stamp illustrate the general rule. |
| Tap a portrait to accuse or cancel. | The stamp rises above the portrait strip, the available targets gain corner marks, and the stamp control becomes Cancel with a cross. |
| Hold to pin, tap to jump, or cross out a note. | The ghost finger holds until its ring fills and a copy of the portrait moves into the notebook. The first note’s clock and replay tick light up together. The crossed chips erase notes. A duplicate marks its matching row with an equals sign. A full book shows all three slots filled and emphasizes erase. |
| The shutter obscured the incident. Check the stated times. | The replay shows a crossed-out camera over the closed panels. The ghost finger points to a portrait or to its claim time. |
| Match sound symbols in the blackout. | Matching corners link the selected portrait’s sound symbol and its statement. In the blackout lesson (case 22) they also mark the same symbol in the replay. If the claim refers to a different time, the ghost finger points to the clock on the claim and the replay tick before the game shows the accusation rule. |
| A truthful alibi cost a star. After three misses, compare again on retry. | The star falls, the matching room icons and claim time appear together, and a ghost finger moves to another portrait. The loss card repeats the comparison, shows the three crossed-out portraits and all three empty stars. The win card shows the culprit, the two different rooms and the stars earned. |
| The share action succeeded, was canceled, or started a download. | A check, cross or download arrow appears. The corresponding status is announced. |

The objective stays in words because a portrait and a stamp alone do not say to find a lie. Accuse and Cancel name actions that can spend a star or put the stamp away. Menu and share controls, the Hard Daily unlock condition, the two streaks and sound status retain short labels. The recording notice and toggle retain the disclosure and choice. The share image includes the game, mode, full local-language date and elapsed time. Screen-reader cues and outcome summaries use the same English and Turkish table.

Language changes apply immediately on the menu and pause card. A manual choice supersedes a `lang` query parameter and is saved by the kit. The campaign save, tab checkpoint, lab outcomes and shared drag hint use their existing contracts.

The browser suite checks key and placeholder parity, language persistence, English leaks in rendered Turkish copy, and layout bounds in both languages. The screenshot pass covers the menu, case list, calendar, replay and teaching states, notebook, pause, reveal, win, loss and both share cards at 360×640 and the iPhone 13 viewport. The lab endpoint was simulated. A Turkish speaker has yet to review the wording, and a first-time player has yet to interpret the new pictures. Physical-phone touch and audio, screen-reader announcements on a device, native share delivery and live lab receipt remain unverified.

| Check | Result |
| --- | --- |
| WebKit, iPhone 13 viewport at 390×664 | Game and shared phone suites passed |
| Chromium, Pixel 7 viewport at 412×839 | Game and shared phone suites passed |
| Chromium, 360×640 | Game suite passed |
| Rules bots | Passed 36 default cases, 6,912 seeded campaign cases and 732 dailies |

## Middle and late game audit — 2026-11-24

A returning player continued past the opening in Turkish (tr-TR) on a local server. All inputs were touch taps at coordinates read from screenshots. The player did not read the source, the state hook or the answers before Phase 1 ended. Paths below are relative to the requested `shots/deep-alibi/` directory. Every action has a numbered screenshot.

### How far each browser was played by touch

- **WebKit, iPhone 13 profile (390×664).**
  - Cases 1–36 cleared by touch, 3 stars each (`p1-webkit/`).
  - Daily cleared on three dates, 2026-11-24 to 11-26, each 3 stars. The clock was moved to reach the later dates.
  - One Daily retry was lost on purpose (`p1-webkit/968-d1r-*` to `978-d1r-loss.png`).
  - Hard Daily cleared on three dates (`p1-webkit-daily/`):
    - 2026-11-26: 3 stars.
    - 2026-11-27: 2 stars, after one miss.
    - 2026-11-28: 3 stars.
- **Chromium (360×640, touch).**
  - Cases 1–12 cleared by touch (`p1-chromium/`). Case 9 took one miss.
  - Cases 13–14 and 16–21, 23–33 were skipped. The skips copied the game-written save and raised `level`. Those cases had been cleared by touch in WebKit only.
  - Cases 15, 22 and 34–36 were played. Case 35 took one miss, from tapping the wrong portrait position.
  - Daily cleared on three dates, 3 stars each.
  - Hard Daily cleared once, 2026-11-26, 3 stars.
- **No endless or long mode exists**, as the cold audit found.

### Findings, ranked by how likely each is to make a player quit

1. **The middle and late game needs no deduction.**
   - **What happens.** Selecting a suspect circles that suspect in the scene. At the claimed time the game outlines the claimed room. In a blackout it brackets the suspect's sound symbol. So an unmasked liar is found by checking whether the circle sits inside the outline.
   - **Scale.** 30 of 36 cases were solved this way with no reasoning. So were all three standard Dailies and Hard Daily 1 and 3.
   - **Examples.**
     - Case 16: `p1-webkit/321-c16-s1.png` to `332-c16-s6-time.png`.
     - Case 22: `p1-webkit/489-c22-open.png` and the c22 survey shots.
     - Hard Daily 3: `p1-webkit-daily/122-h3-open.png` and the h3 survey shots, then `144-h3acc-result.png`.
     - Chromium: `p1-chromium/*-c22-s*-time.png` and `*-h1-s*-time.png`.
   - **Cases that did need reasoning.** Only cases 18, 34 and 35 and Hard Daily 2 required tracking a mask. Each had a masked liar.
   - **Why this ranks first.** A returning player gets no new thinking from chapter II on. This is the most likely reason to stop.
2. **New rules appear without being taught.**
   - **Masks and the swap (case 15).** The only cue is a ghost finger sliding along the clock and a small "mask ⇄ mask" bubble at 7:25. Nothing shows that a mask keeps the identity of whoever stood in that spot at 7:10. See `p1-webkit/270-c15-open.png` and `271-c15-teach1.png` to `274-c15-teach4.png`.
   - **The blackout (case 22).** It appears with sound badges and a finger on the 7:30 tick (`p1-webkit/489-c22-open.png`).
   - **Chapter V's item carrier.** At 7:15 a suspect carries the stolen item. It is never explained and looks like the culprit.
   - **Daily.** A new player meets masks in the Daily because it uses chapter III cases. The daily shows no lesson.
3. **Cases repeat, and masks are usually irrelevant.**
   - Cases 8–14, 15–17 and 19–21 share one rhythm: shutter at 7:05, swap at 7:25 and claims after 7:30.
   - Masks appear but play no part in cases 15, 16, 17, 19, 20, 21, 27, 28 and 32, and in every Daily played.
   - Chapter V (cases 29–36) remixes the earlier houses and adds no new rule. The carrier is the only new object, and it is a decoy.
   - Each house always loses the same item from the same room.
4. **The ending is flat, and nothing sets a goal past the next case.**
   - Solving case 36 shows the ordinary result card with Yeniden and Menü (`p1-webkit/938-c36-result.png`, `p1-chromium/*-c36-final.png`).
   - Home then reads "Oyna 36/36" and replays case 36 (`p1-webkit/941-end-home.png`).
   - No total of stars and no chapter completion is shown.
5. **Bug: the case picker hides the stars of the current case.** After a full clear, cell 36 shows no stars although the save holds `36: 3` (`p1-webkit/942-end-cases.png`, `p1-chromium/*-end-cases.png`).
6. **Hard Daily timeline taps are fine-grained.** Twelve ticks across about 276 px put them 25 px apart. My taps at 7:25 landed on 7:30 several times (`p1-webkit-daily/103-h2-t196.png`, `114-h2-t725.png`). This was already noted in the cold audit, and the scrub alternative works.
7. **The claim time looks clipped at 360 px while the jump hint pulses.** The ghost-tap ring at the chevron crosses the last digit of the time, so "7:10" reads "7:1C" (`p1-chromium/004-c1-s1.png`).
8. **Miss feedback is clear.**
   - My three misses all showed the matching rooms, the time and the star cost: WebKit Hard Daily 2 (`p1-webkit-daily/110-h2acc-accuse.png`) and Chromium cases 9 and 35.
   - All three misses were my reading errors. In two, I misread a room icon or a portrait position. In the third, I took the wrong time.
   - The room icons are about 20 px at 360 px. Studio (an easel) and living room (a sofa) were the pair I confused.

**Turkish text.** No English text appeared on any screen visited. Nothing was clipped in the DOM. The wording read naturally: "Kim yalan söyledi?", "Suçla", "İptal", "Sonraki", "Vakalar", "Günlük (Zor)", "14. vakayı çöz", "Duraklatıldı", "Devam et", "Paylaş" and the recording notice.

### What was fixed

Fixes are in harm order. Fixes 1–5 and 7 each have a check that failed on the old behavior. For fix 1 the bots check ran before the change. For fixes 2–5 and 7 the browser check ran against a scratch copy of the game with that one change reverted.

1. **Masked liars (finding 1, finding 3).**
   - **Change in `sim.js`.** In every mask case after the lesson, and in every standard Daily, the liar is now a suspect under a mask. Where the tape allows it, the liar's false room holds another mask at the claimed time. That other mask is a decoy a careless player can mistake for the liar.
   - **What did not change.** The public replay is unchanged for all 36 cases and 366 Daily dates. Hard Dailies are fully unchanged. Only the liar and the private shutter frame differ. The liar changed in cases 16–21, 28, 32 and 34.
   - **Check.** `bots.mjs` asserts both rules over every mask case and 366 Dailies. The first rule failed before the change with cases 16, 17, 19, 21, 32 and others listed. The full bots run still proves every case solvable by comparison: 6,528 of 6,528, with the crime-room bot at chance.
2. **Training marks retire after their lessons (finding 1).**
   - **Change in `game.js`.** The circle on the chosen suspect in the scene now shows only in chapter I, and in a Daily for a player who has not finished case 7. The bracket on the matching sound symbol now shows only in the blackout lesson (case 22). The claimed-room outline and the `≠ → stamp` plate remain, because they show the rule rather than the answer.
   - **Check.** `check.mjs` (`checkGuides`) counts canvas fills and strokes per style in the last drawn frame:
     - the circle is drawn in case 1 and not in case 16;
     - selecting a suspect in the blackout adds four more bracket strokes in case 22 than in case 23.
   - **Mutation runs.** Forcing the circle on failed the case 16 check. Forcing the bracket on failed with 8 and 8.
3. **Masks taught by pictures (finding 2).**
   - **Change in `game.js`.** In the mask lesson (case 15), a small head tag above each mask names the animal under it. The tags show on the mark where masks first go on and on the exchange mark. After the exchange, the tags show the swapped owners. A Daily shows the same tags to a player who has not reached case 15. No words were added.
   - **Check.** `checkGuides` asserts:
     - tags on marks 4 and 6 of case 15;
     - none on mark 5 of case 15;
     - none in case 16;
     - tags in a Daily for a save at case 5 and none for a save at case 20.
   - **Mutation runs.** Turning the tags off failed the case 15 check and the Daily check.
4. **A visible goal and an ending (finding 4).**
   - **Changes in `game.js`, `index.html` and `words.js`.** The case picker shows a star total ("Yıldız: 49/108"). Each solved campaign case shows the total under the result card.
     - Chapter ends add "N. bölüm çözüldü."
     - Case 14 adds "Günlük (Zor) açıldı."
     - Case 36 shows "36 vakanın hepsi çözüldü. Her gün yeni bir Günlük vaka var."
     - The Daily card is unchanged.
     - The new strings are in both language tables.
   - **Check.** `check.mjs` (`checkProgress`) asserts the picker total, the finale line, the chapter 1 and chapter 2 lines, and a mid-chapter case showing only the total. With the result-card update removed, the finale assertion failed.
5. **Picker stars on the current case (finding 5).**
   - **Change in `index.html`.** The stars on the gold current-case cell are now dark brown.
   - **Check.** `checkProgress` asserts WCAG contrast of at least 4.5:1 between the stars and the cell. With the CSS line removed, it failed at 1.02:1.
6. **Claim time under the pulsing hint (finding 7).**
   - **Change in `game.js`.** The time text moved 4 px left. The chevron and the ghost tap moved 7 px right. The ring no longer crosses the last digit.
   - **Check.** There is no automated check. This was confirmed by screenshot only: `p3-chromium/006-c1-s1.png` at 360 px and `p3-webkit/009-c15-s1.png`.
7. **A tab checkpoint could resume a lost case (found while changing the liar).**
   - **What happened.** The tab checkpoint stores the rejected suspects and is rebuilt from seed and level on reload. A checkpoint written by the old build could list the new liar as already rejected, or hold three misses, and still resume.
   - **Change in `game.js`.** `reopenInvestigation` now refuses a checkpoint whose rejected list is not an array, holds three or more entries, names an unknown suspect, or includes the current liar.
   - **Check.** `checkProgress` writes a case 16 checkpoint that rejects the liar and asserts it does not resume, and one that rejects an innocent suspect and asserts it does. With the guard removed, the check failed ("checkpoint with rejected 3 resumes: false").
8. **Mask tags drawn under the exchange bubble.**
   - **What happened.** On the exchange mark the bubble covered one tag. For a new player in the Daily, the owl tag was hidden (`p3-chromium-b/005-nd-b5.png`).
   - **Change in `game.js`.** Tags are now drawn after the exchange bubble. Both tags show: `p3-chromium-b/010-nd2-b5.png`.
   - **Check.** Screenshot only. `checkGuides` counts the tags but not what covers them.

`bots.mjs` also now asserts that every Daily puts its masks on at mark 4, because `checkGuides` looks for the Daily tags there on whatever date it runs.

### Confirmed by touch after the fixes (Phase 3)

Screenshots are under `p3-webkit/` (iPhone 13, tr-TR) and `p3-chromium/` (360×640, tr-TR).

- **Picker.**
  - WebKit `003-picker.png`: 108/108, and stars visible on the gold cell 36.
  - Chromium `003-picker.png`: 49/108 for a save with skipped cases.
- **Case 15 tags.**
  - WebKit `006-c15-beat3.png`: hedgehog and bear tags.
  - WebKit `007-c15-beat4.png`: no tags.
  - WebKit `008-c15-beat5.png`: owners swapped after the exchange.
  - Chromium `012`–`014`.
  - Solved, mid-chapter card with the total only: `020-c15-result.png`.
- **Case 16 (WebKit).**
  - No circle on the chosen suspect: `030`–`035`.
  - The liar is the frog under the purple mask. The yellow mask sits in the frog's claimed room.
  - Solved with 3 stars: `040-c16-result.png`.
- **No circle on a chosen, unmasked suspect.** WebKit case 16, the cat: `030-c16-s1.png`. Chromium case 17, the fox: `028-c17-s1.png`.
- **Case 17 (Chromium).** The liar is the blue cat under a mask. Solved, and the total rose from 49 to 52: `039-c17-result.png`.
- **Case 21 (Chromium).** The liar is the owl under the yellow mask. The red mask is in the owl's claimed room. Solved, with "3. bölüm çözüldü.": `065-c21-result.png`.
- **Blackout.**
  - Case 22 keeps the sound bracket: WebKit `063-c22-s1-730.png`.
  - Case 23 has none: `046-c23-s1-730.png` to `052-c23-s7.png`. Solved: `057-c23-result.png`.
- **Case 28 (WebKit).** The liar is the blue cat under a mask after a swap. The green mask is in the blue cat's claimed room. Solved, with "4. bölüm çözüldü.": `090-c28-result.png`.
- **Case 36 finale.** WebKit `116-c36-result.png` and Chromium `074-c36-result.png`.
- **Chapter I keeps the circle.** Chromium `006-c1-s1.png`.
- **Daily for a returning player.** No tags were shown, and both liars were masked:
  - WebKit 2026-11-27, the bear: `138-d4-result.png`.
  - Chromium 2026-11-28, the rabbit: `097-d5-result.png`.
- **Daily for a new player (Chromium, no save, `p3-chromium-b/`).** 2026-11-29 showed tags at 7:15 and 7:25, above the bubble after the draw-order fix (`009-nd2-b3.png`, `010-nd2-b5.png`). The liar was the blue cat under a mask. Solved with 3 stars: `025-nd2-result.png`.
- **Hard Daily (Chromium, 2026-11-29).** Opened and surveyed through mark 11 by touch (`028-hd-open.png` to `039-hd-b11.png`). No circle, tags or bracket showed. It was not solved: the run stopped before the accusation.

### Left, and why

- **The claimed-room outline remains.** An unmasked liar in chapters II, IV and V can still be found by checking whether the suspect stands in the outlined room. The outline shows the comparison the game asks for, and removing it would make chapter II much harder without a lesson. The masked-liar change covers chapter III, the mask cases of IV and V, and every Daily.
- **The masked-liar rule narrows the suspects.** A player who learns that the liar always wears a mask in mask cases can ignore the unmasked suspects. This trade was accepted because the old cases needed no mask tracking at all. A later change could mask the liar only most of the time.
- **Chapter V carrier.** The carrier is still an untaught decoy, and there is still no new rule in chapter V. Making the carrier part of the deduction is a design change to the generator with a new bot proof. It was out of scope here.
- **Repeated rhythm.** Cases still share the same rhythm. Each house still loses the same item.
- **Hard Daily ticks.** The 25 px Hard Daily tick spacing is unchanged, and scrubbing works.
- **Room icon size.** The small studio and lounge icons at 360 px are unchanged.
- **Turkish review.** No Turkish speaker has reviewed the new strings.

### Verification after the changes

| Check | Result |
| --- | --- |
| `bots.mjs` | Passed, rerun after the last change. Every case and Daily solvable by comparison (6,528/6,528). The crime-room bot stayed at chance. The masked-liar assertions passed. |
| `check.mjs`, iphone (WebKit 390×664) | Passed: English and Turkish, training marks and progress, full suite |
| `check.mjs`, pixel (Chromium 412×839) | Passed: same three groups |
| `check.mjs`, 360 (Chromium 360×640) | Passed: same three groups |
| `kit/check/phone.mjs alibi` | ok on WebKit and Chromium |

**Not verified.**
- No new player has tried the mask tags. Whether the tags teach the swap without words is an untested design claim.
- The Daily tags for a new player were played by touch once, in Chromium only.
- Chromium Hard Daily was solved once (Phase 1, 2026-11-26), not three times. The Phase 3 Hard Daily run was not finished. Hard Dailies are unchanged by the fixes apart from the retired marks.
- Chromium was played by touch for cases 1–12, 15, 17, 21, 22 and 34–36, plus the Dailies listed. The cases between were cleared only in WebKit.
- After the changes, cases 18–20, 24–27 and 29–35 were not replayed by touch in either browser. Their liar changes are covered by the bots only.
- Physical phones, audio and screen readers were not tested. No Turkish speaker has reviewed the text.

## Open items from the middle and late game audit — 2026-11-24

This section handles the six items the audit above left open.

### What changed, and why

- **The claimed-room outline is now a teaching aid that is taken away.**
  - Where it shows: cases 1–6, and a new player's Daily while progress is case 7 or earlier.
  - Case 7 is the lesson. On the first comparison the outline shrinks onto the room sign, the picture the player must now compare by eye. Later comparisons show no outline.
  - Where it is gone: case 8 onward, returning players' Dailies and the Hard Daily. The blackout no longer lights the claimed room, and the room sign no longer gets corner marks.
  - The scene circle of chapter I is kept.
  - Why: matching a suspect against the outline solved cases without comparing anything.
- **The liar is masked only about half the time.**
  - In mask cases, a coin from a salted stream (`culpritDraw`) picks the masked or the unmasked side. The main `draw` stream does not shift, so the public replay and the saved stars are unchanged.
  - Why: the old rule "the liar is always masked" let a player ignore every unmasked suspect.
- **The chapter V carrier now matters.**
  - At the mark before the hand-off, the carrier's room holds four people. One of the three who are not the carrier gave the item. The carrier never lies, and the liar is one of the three givers.
  - Case 29 is the lesson. Gold corners mark the carrier at the hand-off. A hand moves the timeline back one mark. There, the room gets gold corners and each giver gets an item badge.
  - The Hard Daily shows this aid while progress is case 29 or earlier.
  - Why: the carrier was an untaught decoy.
- **Cases are read in more ways.**
  - Three new items with their own houses and rooms: honey (bakery, room 4), a spyglass (ship, room 1) and a pumpkin (greenhouse, room 3). Each has its own reveal icon, held item and trace (`EVIDENCE`). Crimes 6–8 are used in cases 10, 13, 17, 20, 24, 26, 31, 34 and 36.
  - Two time marks: cases 12, 14 and 30. The claim card shows two clocks. Tapping either one jumps to its mark. The liar may lie at either mark.
  - Floor sounds: case 23 (lesson) and case 26. In these blackouts a sound places a suspect on a floor, not in a room, so the player must narrow the room from another mark.
  - Why: cases shared one rhythm, and each house lost the same item.
- **Ticks and room signs are easier to tap and read.**
  - Timelines with ticks under 32 logical px apart (10 or more marks) get a loupe. A tap on the clock opens a strip of 5 marks, 58×46 px each, 62 px apart. A tap on a strip mark scrubs to that mark. The strip closes after 8 s idle or on any other touch.
  - Room signs grew from 24 to 34 px.
  - Rooms 1, 3 and 4 got new glyphs: a sofa, a palette and books.
  - Rejected tick layouts:
    - Two rows: 26 px tall targets, and there was not enough vertical space.
    - Staggered lanes: a small gain.
    - Fisheye: no gain for quick taps.

### Assertions

**Changed.**
- `bots.mjs`: "mask cases hide the liar under a mask" became a balance assertion. The rule it checked was removed on purpose.
- `check.mjs`: the sound bracket comparison uses cases 22 and 24, not 22 and 23. Case 23 is now the floors lesson and shows the bracket too.

**Added to `bots.mjs`.**

| Bot | Result |
| --- | --- |
| Check masked suspects only | 49.10% of campaign mask cases |
| Check unmasked suspects only | 50.90% of campaign mask cases |
| Outline matcher, cases 3–6 | 100% |
| Outline matcher, case 8 onward and Dailies | 14.53% (chance is 14.06%) |
| Compare the trail suspects, carrier cases | 100% |
| Accuse the carrier | 0% |
| Liar lies at the second mark, two-mark cases | 47.92% |
| Floor-sound cases | No room-level sounds; every suspect heard on a floor; the lie crosses floors |

Every case and Daily is still solved uniquely by comparison. Every suspect assignment keeps the replay the same.

**Added to `check.mjs` (`checkOpenItems`).**
- Outline: drawn in case 4; absent in cases 8 and 20, in the later comparisons of case 7, and in the Hard Daily.
- No gold claimed room in the blackout.
- Two-mark card: mark taps and cues.
- Floor band: drawn in cases 23 and 26, not in 22.
- Trail: drawn in case 29 and not in case 30.
- Loupe: opens with 5 marks of at least 44×44 px, at least 48 px apart. A tap on the neighbour mark corrects the beat.
- Room signs: at least 28 px.
- Glyph silhouettes: studio and lounge differ by at least 25, and the closest pair differs by at least 15.

**Shown failing on old code.**
- The new `check.mjs` assertions were run against an unchanged copy of the game. Every section failed or threw.
- The old glyph silhouette distances: studio and lounge 19.4–21.7, closest pair 13.7–14.6.
- Six sim mutations each failed `bots.mjs`: old mask rule, outline kept, carrier as decoy, one lie mark, floor sounds equal to room sounds, free liar choice.

### Played by touch (Playwright touchscreen, locale tr-TR)

**WebKit, iPhone 13. All won:**
- Case 7, outline lesson: 3 stars.
- Case 23, floors lesson: 3 stars.
- Case 29, carrier lesson, with the loupe used: won.
- Case 26, late floors case: 3 stars.
- The standard Daily of 2026-11-24: won by tracking a mask exchange to a masked liar.

**Chromium 360×640. All won:**
- Case 12, two marks: won.
- Case 30, late, carrier with two marks: won. The liar lied at the second mark.
- Hard Daily 2026-11-24 (12 marks): 3 stars. The loupe corrected two taps. The liar was a giver who swapped masks at 7:25 and was not in the claimed room at 7:40.

### Still open

- The Hard Daily still puts a mask on everyone.
- Floor sounds appear in only two campaign cases.
- An open loupe covers the second row of portraits. Any touch outside it closes it.
- The solved card in a floors case shows the exact true room. This is fine after the case, but it gives no picture of the floor-only reasoning.
- The scene ghost finger still shows in chapter IV.

### Not verified

- Whether a new player understands the picture lessons (outline shrink, trail hand, floor band, loupe). No human has tried them.
- The new Turkish strings, by a native speaker.
- Physical phones.
- The reveal animation details for crimes 6–8 were seen only in passing.

### Verification after the changes

| Check | Result |
| --- | --- |
| `bots.mjs` | Passed: 36 defaults, 6,912 seeded campaign cases and 732 Dailies all uniquely solvable; replay independent of the liar in 272 case/seed pairs |
| `check.mjs`, iphone, pixel and 360 | Passed: all three groups on each profile, including `checkOpenItems` |
| `kit/check/phone.mjs alibi` | ok on WebKit and Chromium |

## Second cold play — 2026-11-24

A first-time player who reads no English played in Turkish (tr-TR) by touch only. Coordinates were picked from screenshots, and the player looked at a screenshot after every action. The player did not read the source, `words.js`, these notes or the state hook before Phase 1 ended. Paths below are relative to the requested `shots/cold2-alibi/` directory.

**What was played.**
- **WebKit, iPhone 13 profile (390×664).** From an empty save, cases 1–29 by touch: 84 of 87 stars. That includes the extra lessons: case 7 (outline retires), 23 and 26 (floor sounds) and 29 (carrier).
  - The 2026-11-24 Daily: 3 stars, then the share card.
  - The Hard Daily: lost after three wrong accusations.
  - Case 6: lost on purpose, then a reload in the middle of the retry.
  - Also visited: the case picker, Takvim, the language button and the sound toggle.
- **Chromium (360×640, touch).** From an empty save: case 1, a reload in the middle of case 2, the pause card and the sound toggle.

### Findings, ranked by harm to a first-time player

1. **After a miss, the ghost finger points at a portrait the player has already checked.**
   - **What happens.** Once every suspect has been inspected, the post-miss finger fell back to the first suspect not yet rejected. A player who cannot read reads a finger on a portrait as "accuse this one."
   - **Case 6.** I followed it twice and lost: the yellow-white "cat" (the owl), then the mouse, then the hedgehog. See `mE.png`.
   - **Hard Daily.** After the frog, the finger moved to the rabbit, then to the owl. See `w469-hacc.png`, `w470-hacc2.png` and the loss, `w471-hloss.png`.
   - The plain inspect cue had the same fallback. With nobody left unseen, it pointed at portrait 0, even when that suspect had already been rejected.
2. **After the mask lesson, nothing shows who put on which mask.** Case 15 tags the mask-on mark; cases 16 onward do not.
   - The sim keeps every suspect in place on the mask-on mark, but no picture says so.
   - **Case 20.** I matched masks to animals by guesswork and lost a star (`m-c20u.png`).
   - **Case 18.** The answer rested on a guess about positions (`m-c18t.png`).
   - **Case 28.** My mask tracking made both the blue cat and the rabbit look like liars. The sim confirms only the blue cat lies, so this was my tracking error (`m-c28t.png`).
   - **Hard Daily.** It masks all eight suspects in similar colours and was effectively a guess (`m-hardt.png`). This adds to the known open item "the Hard Daily still puts a mask on everyone."
3. **The loss card never shows who lied.** It shows the three crossed-out portraits and the last wrong comparison, then Yeniden or Menü (`w471-hloss.png`). A player who loses learns nothing about the answer.
4. **In the sound lessons the finger covers the symbol it teaches.** In cases 22 and 23 the fingertip sat on the first portrait's sound symbol (`z22.png`).
5. **The pictures were misread.** I called the owl a "yellow cat" for all 29 cases. Portraits are compared by picture, so it cost nothing, but players will name it "the other cat."
6. **Repetition.** Cases 1–11 each turn on one plain contradiction. In cases 15–17, 19, 21 and 29, I solved without the mask or the carrier. The repeated rhythm is a known item.
7. **Carrier lesson, case 29.** At the hand-off the item badge sat between the bear and the mouse, so I could not tell who held it (`z29.png`). The lesson did not cost a case.
8. **The sound label wraps.** In Turkish at 360 px, "Ses kapalı" wraps to two lines and moves the menu panel up about 16 px under the thumb (`c007-sndoff.png`). "Sound off" wraps the same way in English at 390 px (`m-lang.png`).
9. **A stray space.** Play read "30 /36" (`m-menu-takvim.png`).
10. **Minor.**
    - "Ses açık" can read as a state or as an action.
    - The result card's clock shows the theft time, not the time of the lie.
    - The broken-glass card over the curtained rooms is never explained, but it is harmless.
11. **Seen again, already known.** The loupe covers the second portrait row (`w480-c30b3.png`), and the sound symbols are small.

No English appeared on any Turkish screen visited. Nothing else was clipped. The calendar, the case picker, pause, both reloads and the share card all worked.

**Was each new rule taught before it cost a case?**

| Rule | Answer |
| --- | --- |
| Case 7, the outline retires | Yes. The room sign matches the bubble icon. No miss. |
| Case 12, two marks | Yes. The finger on the second half taught it. No miss. |
| Case 15, masks | The swap picture taught the exchange. Who sits under each mask after case 15 was not taught, and that cost a star in case 20. |
| Case 22, room sounds | Yes, though the finger covered the symbol. |
| Cases 23 and 26, floor sounds | Yes. The floor band with brackets read clearly. No miss. |
| Case 29, carrier | Only partly; the badge was ambiguous. It was not needed to solve the case. |
| Hard Daily | No. Eight masks with no identity cue, and it was lost. |

### What was fixed, with the assertion for each

1. **The post-miss and inspect finger points only at a suspect not yet inspected.** With nobody left, no portrait finger is drawn (`game.js`, `drawTeaching`).
   - **Assertion.** `check.mjs` `checkGuides`: in case 16, a miss after inspecting one suspect draws the finger ring. A miss after inspecting all six draws none.
   - **Failure on old code.** A copy with the `?? others[0]` fallback restored failed: "after a miss with every suspect inspected, a portrait hand is not drawn".
2. **Builder: mask-on tags in every mask case.**
   - **Change.** `aids().maskTags` is now `'all'`, `'on'` or `false`.
     - `'all'`: the lesson and a new player's Daily tag the mask-on mark and the exchange, as before.
     - `'on'`: every later mask case, every returning player's Daily and the Hard Daily tag the mask-on mark only.
   - **Why.** Nobody moves on that mark, so the tags save only bookkeeping. Following the exchange and the later moves is still the puzzle.
   - **What did not change.** The sim's cases are unchanged, so the bot tables do not move (see below).
   - **Assertions.**
     - `bots.mjs` checks the tag mode for cases 15, 16, 34 and 8, both kinds of Daily, and the Hard Daily. It also checks that nobody moves on the mask-on mark in every mask case, 60 Dailies and the Hard Daily. With the old `aids()` it failed: "case 15 mask tags".
     - `check.mjs` `checkGuides` gained exchange-mark checks for the Daily.
   - **Changed assertions, and why.**
     - "case 16 shows no tags at mark 4" became "case 16 shows tags at mark 4 and none at mark 6".
     - "a player at case 20 sees no Daily tags at mark 4" became "tags at mark 4, no exchange tags at mark 6".
     - Both old assertions encoded the retirement this change reverses on purpose.
   - **Failure on old code.** A copy with both halves of the old mask code failed: "case 16 mask tags at mark 4".
3. **In the blackout and floor lessons the finger points at the sound symbol from the left.** A ring sits on the symbol, which stays visible.
   - **Assertion.** `checkGuides` now records the fingertip of every ghost hand drawn (`window.alibiHands`). In cases 22 and 23 at the blackout, no tip may fall on any portrait's sound strip.
   - **Failure on old code.** The old placement failed: "case 22: the ghost finger covers a sound symbol at 97,458".
4. **Play reads "30/36".**
   - **Assertion.** `checkProgress` requires `#progress` to read "36/36".
   - **Failure on old code.** The old string failed it.

No new player-facing strings were added.

### Confirmed by touch after the fixes (Phase 3)

| Fix | Chromium 360×640 | WebKit iPhone 13 |
| --- | --- | --- |
| No portrait finger after a miss once every suspect was inspected | `c014-miss-all.png`, case 16 | `w481-w-miss-all.png`, case 30 |
| Mask-on tags; none on the exchange | `p3-c16-tags.png` and `c013-b4ex.png`, case 16 | `p3-w-daily-tags.png`, returning player's Daily |
| The finger beside the sound symbol | `p3-c22-hand-zoom.png` (case 22) and `c018-c23bo.png` (case 23) | `w486-w22bo.png`, case 22 |
| Play count without the stray space | `c008-p3menu.png` | `w478-wmenu.png` |

Phase 3 used the `level` URL parameter to open cases 16, 22 and 23, as `check.mjs` does. All play inside the cases was by touch.

### Left, and why

- **The loss card does not reveal the liar.** Revealing it would make Yeniden a free 3-star solve and would spoil a Daily retry. A fairer version needs a fresh variant of the case after a loss, which is a change to the generator.
- **The repeated early rhythm and the carrier badge placement.** These are design work beyond this pass. Both are already listed as known.
- **The owl portrait reads as a cat.** It needs an art change: a beak and ear tufts that do not look like cat ears.
- **The sound button wrapping and the "Ses açık" wording.** Both are minor. A fixed two-line height would make the menu taller for every player.
- **Known open items that were seen again:** the loupe over the portrait row, and the small sound symbols.

### Not verified

- Whether the mask-on tags make cases 16–36 and the Hard Daily too easy for a human player. The bots measure solvability, not effort.
- The Hard Daily with the new tags was not replayed to a win by touch.
- Chromium was played cold for case 1 and part of case 2 only. The WebKit run covers the rest of Phase 1.
- Physical phones, audio and a native Turkish speaker.

### Verification after the changes

| Check | Result |
| --- | --- |
| `bots.mjs` | Passed. Every table is identical to the run before the changes; the sim's cases did not change. |
| `check.mjs`, iphone, pixel and 360 | Passed: all three groups on each profile |
| `kit/check/phone.mjs alibi` | ok on WebKit and Chromium |

## Loss reveal, owl portrait and sound label — 2026-11-24

Three items left open by "Second cold play". Paths below are relative to the scratch directory `shots/fix-alibi/`.

### What changed

1. **A lost campaign case shows its liar; Retry deals a fresh variant.**
   - **Loss card.** The liar's portrait sits in a gold frame. A small copy of the liar's head starts in the claimed room (cream box) and moves to the room where they really were at that mark (dark box). Then `≠` and the clock fade in. The move takes 1.4 s; with reduced motion the card shows the end state. The three crossed-out portraits stay. The last wrong comparison (`=`) and the empty stars are gone from this card. The label adds `liarShown` (English and Turkish).
   - **Variants.** `sim.js` `caseVariant(level, n, seed)`: variant 0 is `createCase({ seed, level })`. Variants 1–8 are the same case spec drawn from other seeds, and they repeat in a cycle after 8. Each variant's liar differs in id and portrait from the variant before it and from the original. Variant 1 also differs from variant 8, where the cycle wraps. `createCase` is unchanged.
   - **Storage.** The variant is recorded at the moment of loss in `alibi-save` as `retries: { [level]: losses }`. The field is new and defaults to `{}`; `readProfile` validates it and `syncProfile` merges it by maximum. Every later start of that case, including Menu then Play and the case picker, uses that variant, so going back to the menu cannot bring back the revealed case. The reload checkpoint in `sessionStorage` gains `variant`, defaulting to 0, and keeps `version: 1`. Stars go to the case number, whichever variant was won.
   - **Daily and Hard Daily: no reveal.** A lost Daily writes nothing, Yeniden replays the same date's case, and a win then saves full credit (`saveWin`, `betterScore`). So a lost Daily can be retried for credit, and its loss card keeps the old picture without the liar.
   - `window.alibiState()` gains `variant` and `lossReveal`. `lossReveal` is the liar's id on a revealing loss card and `null` otherwise.
2. **The owl redrawn** (`art.js`). It now has a round face disc made of two pale rings, big front-facing eyes with yellow irises and large pupils, and a small hooked beak. Its ear tufts are short, brown and notched. It has no whiskers and no cat nose. Its hurt mood squints instead of using the shared brows and mouth; its caught mood shrinks the pupils. Contact sheets of all eight at 19, 24 and 39 px heads and 34 px bodies, old row above new: `sheet-webkit.png`, `sheet-chromium.png`. No other portrait has round yellow eyes; bear and hedgehog, the other tan faces, stay distinct.
3. **The menu row with the sound button keeps one line** (`index.html`, class `tight` on that row). Daily, Cases and Sound do not wrap, and they have less side padding and a 6 px gap, so the widths follow the labels. `#pauseSound` also does not wrap. Before this, at 360 px in Turkish, "Ses kapalı" and "Günlük ✦12" each wrapped to two lines. "Sound off" wrapped in English at 360 and 390.

### Assertions, and the failure on old code

| Item | Assertion | Old code |
| --- | --- | --- |
| 1 | `bots.mjs`: for all 36 cases, variants 1–8 keep the case spec. Each passes `prove`, `checkAlternatives` (case 3 on), and the carrier-trail, mask-on, masked-lie, floor and two-mark checks. Each liar differs in id and portrait from the run before and from the original, and each layout differs. | With `caseVariant` returning the original: "case 1: retry 1 has a different liar from the run it follows". With the liar filter removed: the same failure at retry 2. |
| 1 | `check.mjs` `checkMenus`: the loss card reveals the liar; Retry deals variant 1 with a different layout and liar; the revealed portrait does not win; the variant win saves the stars. A lost Daily shows no reveal, Retry replays the same Daily, and the win saves 3 stars. `runCampaign`: a reload during a retry keeps the variant, and Menu then Play does not bring back the revealed case. | The old `game.js` failed all eight new `checkMenus` findings. The two Daily findings failed only because the state fields `lossReveal` and `variant` did not exist, so they guard the new behaviour rather than show an old fault. |
| 2 | `check.mjs` `checkPortraits` renders each head at 24 px, 3×. The owl needs a large dark pupil inside a yellow iris ring in both eyes, an orange beak and no dark whisker pixels beside the face. No other animal may have the owl's eyes. | Old art: "the owl reads as an owl at 24 px: bigEyes false, beak false". |
| 3 | `check.mjs` `checkSoundLabel`, on all three profiles: in tr and en, with streaks 12 and 365, sound on, off and on, every button in the sound row is one text line with no overflow, and the panel top does not move. The two pause-row buttons are one line too. | Old CSS: "tr, sound on, streak 12: menu button daily "Günlük ✦12" keeps one line". |

**Changed assertions, and why.**
- `checkMenus` accused `campaign.culprit` after Yeniden. Yeniden now deals a variant, so it accuses the variant's liar.
- `checkLanguages` required `=` on the loss card. It now requires `≠`, the liar's contradiction, which replaced the last wrong comparison on that card.
- `checkLanguages` used case 1's fixed liar in both languages. The first language's loss moves case 1 to a variant, so it reads the case actually on screen.
- `checkFirstPlay` loses case 1, and that loss now records a variant. It clears `alibi-save` at its end, so `runCampaign` still starts from an empty save.

### Confirmed by touch (tr-TR)

| Step | Chromium 360×640 | WebKit iPhone 13 |
| --- | --- | --- |
| Menu, Ses açık → Ses kapalı on one line; panel did not move | `c/002-sound-off.png` | `w/002-sound-off.png` |
| Case 3: lost by accusing frog, bear and mouse; the owl is revealed | `c/006-acc-mouse-loss.png` (mid-move), `c/007-loss-final.png` | `w/007-loss-final.png` |
| Yeniden: the new cast has no owl; solved by comparing the cat's 7:20 claim with the replay; 3 stars saved | `c/012-win.png` | `w/013-win.png` |
| Case 12 (two marks): lost by accusing frog, bear and fox; the hedgehog is revealed. In the variant the hedgehog's two marks both held, and the cat's 7:15 mark did not; 3 stars saved | `c12/006-loss12.png`, `c12/009-h-715.png`, `c12/013-win12.png` | — |
| The new owl in the menu scene, the lineup and the loss card | `c/002-sound-off.png`, `c/007-loss-final.png` | `w/002-sound-off.png`, `w/007-loss-final.png` |

Both browsers saved `retries: { 3: 1 }` and `stars: { 3: 3 }`, and Chromium also saved `retries: { 12: 1 }` and `stars: { 12: 3 }`. Neither logged a console error. Cases 3 and 12 were opened with `?level=`. Everything inside each case was played by touch.

**A known property.** Each variant's liar differs from the previous liar's id as well as its animal. So the liar never sits in the same lineup slot twice in a row, which a player could in principle use to rule out one slot.

### Not verified

- Whether players read the moving head as "where they said" against "where they were." The motion is short and the head is small (19 px).
- Variants are checked for 8 per case. A ninth loss repeats variant 1, whose liar differs from variant 8 but may match an earlier variant's liar.
- A lost Daily by touch. That path is covered only by `check.mjs`, and only for the standard Daily. The Hard Daily uses the same `daily` flag but its loss card was not asserted.
- The reduced-motion end state of the loss card.
- Whether two portraits can be confused. This was judged by eye from the contact sheets; `checkPortraits` only checks that no other animal has the owl's eyes.
- Whether a player understands that Yeniden deals a new case. The revealed animal can come back innocent, as the hedgehog did in case 12.
- Physical phones, audio and a native Turkish speaker.

### Verification

| Check | Result |
| --- | --- |
| `bots.mjs` | Passed. Every table is identical to the run before the changes. |
| `check.mjs`, iphone, pixel and 360 | Passed: all three groups on each profile. |
| `kit/check/phone.mjs alibi` | ok on WebKit and Chromium. |

## 2026-11-24: a practice case and times under the line (tester t1, note #245)

The note: make a tutorial level because the game is confusing, and add the time underneath the line. "The line" is read as the timeline; the reply asks whether that is right.

- **Practice case.** "How to play" on the menu opens it (gold edge until there is a save). Three suspects, eight short steps in words, English and Turkish: story, drag the clock, open an alibi, jump to its time, compare a true alibi, compare a false one, accuse. A step ends when the player does the move. Accuse appears only at the last step. A wrong accusation costs nothing and says so. `practiceCase()` in `sim.js` is fixed and is not in `CASES`, so level numbers and saves do not change.
- Nothing of practice is saved, and a reload does not resume it. The lab record names the run `practice`.
- **Times under the line.** Every mark shows its time, the current one in gold. The line moved up 8 units to make room. Cases with more than 10 marks use smaller figures.
- Own addition: the practice result states the rule in one line ("Same picture: true. Different picture: a lie.") and Play goes on to the next campaign case.

Checks: `checkPractice` in `check.mjs` (steps, time labels, no loss, nothing saved, no resume) and a practice line in `kit/check/phone.mjs`, both engines. `bots.mjs` is unchanged and passes. The check's portrait hold was too short on a busy Mac (the notebook checks failed the same way on untouched main); it is longer now.

Not verified: a new player, a real phone, a native Turkish reader; the 9-unit figures of 11- and 12-mark timelines on a small phone.

### Left as a proposal (2026-11-24)

- ~~Offer practice by itself on a first visit, as Lantern does.~~ Done 2026-11-25 (note #260), below.
- Show the step sentences in words in cases 1–7 too; they exist in both languages but only screen readers get them.

## 2026-11-25: practice opens by itself for a new player (tester t1, note #260, answering #252)

The tester chose "Open the tutorial by itself for new players" from the lab's question.

- A player with no `alibi-save` who has never opened practice gets the practice case when they tap Play, instead of case 1. Opening practice (by Play or by How to play) writes the new key `alibi-practice` = `'1'`, so the next Play goes to case 1. Practice still writes nothing to `alibi-save`.
- A player who already has a save is never sent to practice. A `?level=` link skips the offer, so the browser checks that open `?level=1` are unchanged.
- To skip practice: pause, Menu, Play. There is no Skip button on the first step; Lantern asks first and offers Skip. Recorded below.

Checks: new lines in `kit/check/phone.mjs` (`alibi`): the first Play opened practice and wrote the key and no save; with the key removed, Play opens practice at step 0; after it, a reload and Play opens case 1; a player with a save is not sent to practice and is not marked. With the old `game.js` the check fails at "the first Play opened practice" on WebKit and Chromium. `check.mjs` passed on all three profiles.

Not verified: a real phone; whether a new player finds the way out of practice without a Skip button.

### Left as a proposal (2026-11-25)

- A Skip button on the first practice step, if new players want to go straight to case 1.


## 2026-11-25: the guide line in words in cases 1 to 7 (tester t1, note #268, answering #267)

The note picked "Show the hints in words in the first cases too". That was the proposal of 2026-11-24 above.

- In campaign cases 1 to 7 (`WORDS_UNTIL` in `game.js`), the guide line that only screen readers got (`#playGuide`) now shows on screen. It sits in a box styled like the practice coach, between the title and the house: "Who lied? Tap a portrait to see its alibi.", "Tap the alibi to jump to 7:10.", and so on. It changes with each move, as before. Case 8 on and the Daily keep it for screen readers only. Practice keeps its own coach. No new key, and the save is unchanged.
- Checks: new lines in `kit/check/phone.mjs` (`alibi`): the line is visible in cases 1 and 7 and hidden in case 8, ok on WebKit and Chromium. With the toggle removed it fails at "case 1". `check.mjs` passed on all three profiles. Looked at in WebKit at iPhone 13 size, in cases 1, 3, 5 and 7, in English and in Turkish, with and without a suspect chosen. The box does not cover the alibi bubble or the rooms.
- Not verified: a real phone; whether the longest lines (the sign, floor and trail lines, two or three lines on a 360 px screen) cover the top of the roof in a case that uses them.

### Left as a proposal (2026-11-25)
- A switch to keep the words on in every case, for players who want them.
