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
