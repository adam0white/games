# Playtest 10: HF 2.8.0, engine 5 (2026-10-19)

Source-unread testers, each with a different agenda and model, played a local preview at `http://127.0.0.1:5181/` through a text driver that runs a real headless Chromium. They saw only the screen, not the repository. Their reports are below verbatim. A game-design expert reviewed the same build. The HF-character harness from `packages/playtester` also played the game headlessly.

## Builds and exports (read first)

- **Round 1 build:** commit `7dcdf3a` (game 3.1.0-alpha.1, engine `small-works@5`, HF 2.8.0). **Moving target, confirmed:** `npm run check` ends with `vite build`, which wrote into the `dist/` that `vite preview` was serving. I ran it twice while testers were playing, with uncommitted round-1 fixes in the tree (the owner-trust and kept-word changes). Each driver call reloads the page, so later calls got the newer code. The speedrunner's export replays exactly at `7dcdf3a`, as do the edge, cozy and designer exports. **The sceptic's export replays at no commit**: it carries a kept-word trust change that was uncommitted at `7dcdf3a`. Cozy's mention of "Nora takes your word readily." is also from the newer code.
- **Round 2 build:** commit `ce71918` (game 3.1.0-alpha.2), built once into a separate directory and served from there, so later checks could not change it. All four round-2 exports replay exactly at `ce71918`.
- Round-1 exports are kept in `evidence/playtest-10-{speed,edge,cozy,sceptic,designer}-2026-10-19.json`. They are game 3.1.0-alpha.1, which was never deployed. The current game refuses them on load (provenance mismatch), deliberately: alpha.2 changed engine-5 text that is saved in the world. SHA256: speed `b764a1cf…0422f43`, edge `fd3a8118…50a4de9`, cozy `a23bc1ea…a861fef`, sceptic `acc7487b…dcba4e7`, designer `8b7d84c9…2d56332`.
- **Harness limits, confirmed:** the bench tabs (Object, Meter, Repair, Notes) have `role="tab"`, and the driver first clicked only buttons, so tab clicks timed out until I fixed the driver mid-round. The speedrunner's "Repair would not open" and its lost second accept come from this and from the page reloading to the Workbench on every call, not from the game. The codex wildcard tester could not run: its sandbox blocked Chromium (`bootstrap_check_in … Permission denied (1100)`), so the sceptic was rerun on opus.

## Round 1

| Persona | Model | Calls | Reached | Verdict in brief |
|---|---|---|---|---|
| Speedrunner | haiku | ~38 | Day 1 · 11:45, 1 return | Lantern fine; fan "stopped me" (harness tab bug) |
| Edge pusher | sonnet | ~30 | Day 6 | "breaking promises barely costs anything and never gets worse" |
| Cozy story | fable | ~50 | Day 2 · 09:35, 2 returns | "people are written but not present" |
| Sceptic | opus (codex blocked) | ~60 | Day 3 · 09:00, 4 returns | "The people are labels with timetables they don't keep" |
| Design expert | opus | ~55 | Day 3, 5 returns | "a strong engine without a game yet" |

### Speedrunner (haiku), verbatim

> ## Speedrunner playtest: Mum's walking lantern, then Evan's desk fan
>
> **Driver calls:** about 38 (including about 14 failed calls). Export saved to `…/pt10/speed/export.json`.
>
> **What I did**
> - Skipped the flavour and tried Carry first. The screen said "Light reaches 0% under movement." That was the first wrong turn.
> - Opened the cover, then used the probes: red A to black 0 read 6.00 V, then red B to black C across the switch read 6.00 V with "Large voltage drop across this measured span." I read that as an open switch. That fits the screen.
> - Took the stocked switch, used Replace (30 min), carried the lantern. The screen said "Light reaches 96% under movement; output stays steady." Returned it to Mum. It paid nothing extra: the bench still shows £24 and "Family favour £0."
> - Took the workboard. Evan's fan pays £32 (the highest), Nora's music box £26, reading light £18, all due Day 2 17:00. I accepted the fan. The fan's "Try" test read "Airflow reaches 25% under load; output falls short."
>
> **What felt good**
> - The workboard shows pay, due time and the object's status at once. I could rank the jobs in one look.
> - The lantern test is quick once you know the path: one Replace, one Carry.
>
> **What was confusing, boring or unfair**
> - The inside view and the component picker reset between my driver calls. Each call needed "Look inside", then "Choose a component by name", then the part. That is my cost as a speedrunner, but the game's state is not hidden. It is the UI.
> - Every probe pair is a separate click, and every read costs "10 min." A single speed route needs about 8 clicks to find one fault. The "Pick up the meter" and "Work on the part →" banners forced an order I could not skip.
> - After I accepted the fan, the next "Accept promise" click for Nora's music box did not land. The page showed the bench with the fan selected. I could not confirm whether the accept went through for the music box. I did not see the music box accepted.
> - I could not reach the Repair tab for the fan, even after "Look closely" on the motor. The fan's "Required" under-load test reads "Under load: Required." The Repair tab did not respond to my clicks. I do not know if the game gates the tab behind the Try test or if my selector failed. The lantern's Repair tab only opened through the banner. So for the fan I hit a wall.
> - The day clock ran from 09:55 to 11:45 across my steps. I could not see a total time budget.
>
> **Where I would quit**
> - Right after the fan's Try test, when Repair would not open. Nothing on the screen said how to reach it.
>
> **Verdict:** One lantern repair in about 20 useful calls is fine for a repair game. The fan job stopped me, and the game gave no path forward for a player who skips the guidance.
>
> **Confirmed (seen on screen)**: Carry at start gives "0%." Replace uses the one stocked switch and says "No switch stocked" afterwards. Return gives "£24" on the bench and "Family favour £0." Fan Try: "Airflow reaches 25% under load; output falls short."
>
> **Guessed (not confirmed)**: The Repair tab is gated behind the Try test or the Look closely step. The music box accept did not register.
>
> **Bugs to check, with steps**
> 1. Fan job: Look inside, open Choose a component, pick Motor, then press Repair. The Repair tab did not respond in four attempts. Expected: the tab opens, or the screen says what unlocks it.
> 2. Workboard: accept Evan's fan, then accept Nora's music box. The second accept did not register, and the page showed the bench instead.

My reading: both bugs are harness artefacts (tab role; reload returns to the Workbench). Confirmed from the export: only one accept was ever dispatched.

### Edge pusher (sonnet), verbatim

> **Edge playtest report (about 30 driver calls, not the 45–90 asked for)**
>
> I stopped when pushing further needed things I couldn't reach, not because I was bored. I did not try Import, the "strange things", the Meter tab or the phone layout beyond one screenshot.
>
> **What I tried**
> - **Closing the day.** I closed it at once, on Mum's first day and again on later days, and closed three days in a row. Each close skipped a whole day with no confirmation and no warning that promises were running out.
> - **Taking promises.** I accepted all three incoming promises (Nora's reading light, Evan's fan, Nora's music box), then did nothing with them.
> - **Returning unfinished.** I returned Mum's lantern unfinished and, later, all three of the others.
> - **Spending money.** I bought a motor (£18) and a contact (£4) and was down to £2. I then tried a £48 item.
> - **Taking apart the spare.** I used Recover part on the cracked spare lantern.
>
> **What reacted like people**
> - **The overdue promise.** On Day 2, 09:00, Mum wrote: "You said Day 1 · 17:00 for mum’s walking lantern. I’m still waiting. If it can’t be done, tell me and give it back." That is good. It also appeared as a banner at the top of every screen.
> - **Giving work back.** Returning unfinished got a specific reply: "Thank you for telling me what remains. I’ll make another plan. It came back later than promised." It was kind and not a punishment, though the repeated wording made it feel slightly canned. Mum then said "I took this one to the shop in town."
> - **Spending everything.** The game blocked it politely: "A cell costs £6; you have £2." and "This costs £48; you have £2."
> - **Taking apart the spare.** Recovering the cell failed with "The recovered cell is not usable. The donor is committed to salvage." Wrecking the spare had a permanent cost, and I liked that.
> - **Closing the day again and again.** Sam kept saying "I’m back this morning. I have my own afternoon promise again." Neighbours' requests slowed to "No new requests today. The existing objects and promises remain." On Day 4, 15:30 I got "No prepared activity was completed. People kept other plans, were occupied, or stopped before completion." This was interesting, but it didn't say why.
>
> **What the game ignored**
> - **Skipping several days.** Nobody said anything between the first reminders and my giving the work back. Skipping days did nothing to the relationship. The only cost was the "later than promised" line. I broke a deadline by three days and, as far as I could see, Nora didn't mind.
> - **Time passing.** Nobody changed after days passed. The reminders were identical and carried no escalation.
> - **Taking work back.** I did not get to test asking for help and then not showing up. I found no way to ask Sam for help, so I can't say the game ignored it.
> - **Mum's lantern.** The only thing Mum's next message offered was the paper theatre, and she never reacted to how I treated the lantern.
> - **A second reminder.** Day 4 repeated the same line from Nora and Evan; it didn't change.
>
> **Bugs and confusing things**
> 1. **Recover part says nothing is there.** Recovering the bulb on the spare said "That component is absent or unusable; there is nothing to recover." The diagram showed the bulb in place.
> 2. **Component selection doesn't survive a reload.** After leaving or reloading, "Choose a component" is empty again. Not a bug, but it means every repair step has to be redone.
> 3. **Overdue banners are buttons.** I didn't test what they do.
> 4. **Misleading "Evidence retained" text.** Mum's lantern said "Evidence retained; not fully checked" right after I had returned it unfinished, so the label read as though I'd done work.
> 5. **Phone layout.** I took a screenshot at 390×844 but did not look at it.
>
> **Where I'd quit:** after skipping three days with nothing happening, I'd stop. The edge costs almost nothing, so there's little reason to keep pushing it.
>
> **Verdict:** the promise and return-unfinished loop is warm and honest, and the salvage failure is the best moment I found. But breaking promises barely costs anything and never gets worse. Skipped days pass without anyone reacting.

### Cozy story player (fable), verbatim

> **Cozy playtest — about 50 driver calls, Day 1 09:00 to Day 2 09:35.**
>
> **What I did.** Fixed Mum's walking lantern (switch: cleaned, adjusted, then fitted my only spare). Accepted Nora's reading light and her grandmother's music box. Fixed the light by cleaning the dull contact. Spent the rest of Day 1 and the start of Day 2 on the music box: governor collar 2→3→4 moved the drum from 3.75 to 6 rpm, still "melody loses its pace." Closed the day once.
>
> **What felt good.** The lantern is lovely, and the first Carry going dark is a good quiet opening. The best writing is the spare-switch choice: "You have one new switch in stock, and it is your only one. The cracked spare lantern has one too. Taking it costs nothing, but nobody has tested it." After the return, Mum's status read "Now: Read by Mum's walking lantern" — the one moment the place felt alive. Nora's briefs ("I read to my nephew after supper"; "A new motor would miss the point") made me care before I saw either object. The music box has its own picture and parts, which I was grateful for.
>
> **What hurt.**
> 1. The people are in the wrong room. Mum's "I used this lantern on the walk home when you were small. It still has work left in it." and Sam's "If you want company, I'd like to see how you find the fault" exist only in Workshop ☰ > History. The bench shows a quoted brief and nothing else. I only read History when I closed the day.
> 2. Sam is an apprentice I cannot reach. He says twice he has the morning free and wants to watch. I checked every control on People & supplies, Workboard and Workbench: there is no button, no invitation, no sign he is present. Day 2 he is "back this morning" and still untouchable.
> 3. Nobody remembers me. Nora's return produced "Returned to use." and, in History, "Nora's reading light is back in use. Received £18." Mum's: "Mum's walking lantern is back in use." Day 2 adds "Nora takes your word readily." for everyone, identically. No thank-you, no change in voice.
> 4. Numbers where I wanted a feeling: "Light reaches 0% under movement; output falls short." / "Light reaches 96% under movement" / "Drum turns at 3.75 rpm under load (requested 15 ± 3 rpm)". Meter readings are fine; percentages on Carry/Read/Play are not something eyes see.
> 5. The hint forgets. After cleaning the switch and carrying, it reset to "Start at the battery. Put a probe on each marked connection." "Explore freely" was offered every step; I never pressed it, so I cannot say whether it quiets the bar.
> 6. Nora's reading light is the same picture and the same four parts as Mum's lantern. It looked like the object I had just handed back.
> 7. The music box gave me no lead after the governor failed. "Spring: The outside looks intact." for every part, and "B: 7.5 rpm; C: 9 rpm. Rotation change 1.5 rpm" — a governor that speeds things up, which I could not read.
>
> **Where I would quit.** Day 2 · 09:35, after the third governor setting, with no one to ask and Sam idle in a menu. I would not come back tomorrow unless someone spoke to me at the bench.
>
> **Did the people feel like people? Surprises?** Mum, for one History line and one status line. Nora only in her briefs. Sam never. The good surprise was the untested-spare choice; the bad one was the silence after each return.
>
> **Verdict.** A handsome, careful repair toy whose people are written but not present; it rewards patience with readings, not with company.
>
> **Bugs**
> - Notes table unreadable: Notes tab > "Recorded comparisons"; the readings ("6.00 Vbefore work", "90.00 rpm Δbefore work") are drawn so faint they are near-invisible on desktop and phone.
> - Lowercase name: History "I'll take responsibility for nora's keepsake music box"; People & supplies "Back with nora". "Mum" is capitalised in the same sentences.
> - Hint/button mismatch: after the switch replacement and a passed Carry, hint "It stays lit when carried. Give it back to Mum." sits beside a button "Try the lantern →".
> - Day start status missing: at Day 2 · 09:00 People & supplies showed no "Now: …" line for anyone; at 09:35 all four had one.
> - "6 V cell pack" vanished from "Choose a component by name" after the first A→0 reading, then returned later. Seen once.
> - Component note after reload: "Contact: The exposed metal is aged and dull." leaves the Object tab on page reload; it survives only in Notes > Recorded observations. Guess: the inside view is not restored on load.
> - "Actual reports": at Day 1 12:30 and Day 2 09:35 all four opened to nothing; at 14:20 Sam's showed two lines dated 09:00. Saw inconsistency; cannot tell whether the sections are empty or the collapsible does not open reliably.
> - Harness, not game: bench tabs were unclickable until the driver fix mid-run; "Read"/"Play" matched a hidden "Read meter" first.

### Sceptic (opus; the codex wildcard was blocked), verbatim

> I'm stopping at Day 3, 09:00, after about 60 driver calls. All four repairs passed, and nothing I did, right or wrong, changed how anyone treated me.
>
> **What I tried.** The first job was Mum's lantern, which "goes dark" when carried. I went looking for the hint lying. The bulb "looks intact", so I replaced it anyway on no evidence. That wasted my only bulb and 30 minutes, and nobody remarked on it. Then I used the meter.
>
> **What felt good, and I'll admit it.** The contact on Mum's lantern says "The exposed metal is aged and dull", which looks guilty. The meter cleared it: C→D read 0.04 V on the table and 0.00 V while carried. The switch, which "looks intact", read 6.00 V while carried. That was a red herring beaten by honest measurement, and it is the best moment in the game. Cleaning and adjusting the switch failed. Recovering the switch from the cracked spare lantern, after measuring that lantern's switch at 0 V while carried, worked: "Light reaches 96% under movement". The music box was the same story. The reference sheet's ratios let me compute 15 rpm, and I found shaft B at 7.5 rpm against an expected 30.
>
> **Where the hints claim more than I could know.** The very first carry prints "Light reaches 0% under movement". That is a number I never measured. After the meter had already shown me the switch, the next hint said "You have one new switch in stock" and named the cracked spare as a source. It was steering me, not reporting. After my failed clean, the coach reset to "Start at the battery. Put a probe on each marked connection." It had forgotten everything I had shown it. "Look closely" printed the same contact text ("aged and dull") on a healthy contact in one lantern and on the faulty one in Nora's light. Inspection is decoration.
>
> **The person test: failed.** Nora wrote: "This was my grandmother's. A new motor would miss the point; I want this one to work." The box has no motor. So I fitted a new gear on purpose. Nothing warned me. She accepted it: "I can keep this tune in its old box." Every return gets a one-line template: "A light Mum can carry", "I can keep this beside my book while I read". Nora's nephew is ignored.
>
> Schedules are not kept either:
> - I returned Mum's lantern at 16:05, inside her "Visit a neighbour 15:00 – 17:00" slot, and it was accepted at once.
> - Evan was listed under "Collect my children 15:00 – 17:00", but at 15:10 he was "Now: Sort tomorrow's deliveries".
> - Nearly everyone is on "Take a quiet break", often until the same minute.
> - Everyone "takes your word readily".
>
> Sam answered "Sam will consider the lesson after his current activity", and then the request quietly disappeared. Sam's morning offer on Day 1 ("I have the morning free…") sat hidden in a tab I never opened.
>
> **Difficulty.** None of it is arbitrary, but none of it is hard either. I accepted all three Day 2 jobs and finished them by 15:10. Money went from £24 to £68. The wasted bulb cost nothing I could feel. Early choices did not matter.
>
> **Where I quit:** Day 3, 09:00, reading the new workboard. The requests read like a generator:
> - Sam: "On the bench, the melody stops; while driving the figures, the melody stops."
> - Mum: "At rest, the airflow falls short; through the grille, the airflow falls short."
> - Mum also files two near-identical fan jobs, "The meeting-room fan" (£24) and "The community room fan" (£0).
>
> That confirmed what I suspected about scripting, and I closed the tab.
>
> **Verdict:** The meter puzzles are honest and sometimes clever. The bench is a real diagnostic toy. The people are labels with timetables they don't keep, and they do not react to what I do.
>
> **Bugs, with steps**
> 1. **Coach forgets evidence.** Prove the switch at fault (6 V across B→C while carried), then clean it and carry. The hint goes back to "Start at the battery…".
> 2. **Returns ignore the owner's schedule.** Fix Mum's lantern and click "Return to Mum" at 16:05, during her listed 15:00–17:00 outing. It is accepted at once. The same happened with Evan.
> 3. **Lowercase names.** People & supplies shows "Back with nora" and "Back with evan".
> 4. **Mixed parts in one stock count.** After "Recover part" from the spare, the drawer shows "2 stocked". I can't choose the untested recovered switch over the new one, though the hint made that the choice.
> 5. **Request names a missing part.** Nora's music-box request mentions a motor; the box has Spring, Gear, Governor and Drum.
> 6. **Duplicate requests.** Day 3 has two Mum requests for a room fan with different names and pay.
> 7. **Lesson request vanishes.** On Day 2 at 13:10, "Request lesson" gives "REQUEST IS WAITING". By 15:10 it is gone, with no answer from Sam.
> 8. **Table and load readings identical.** On Nora's light, C→D reads 2.67 V on the table and 2.67 V under load, though the hint called load the required check.
> 9. **Lost interface state on reload** (minor). This could be the test driver rather than the game.
> 10. **Couldn't click the on/off switch** (unconfirmed). This may be the test driver, not the game.

My reading of bug 7, confirmed from the export's log: Sam did answer, at Day 2 · 13:15, "I can start a lesson with you before Day 2 · 13:35. Start it when you are ready.", and at 13:35 "I kept that time free and you didn’t start. …". Both lines were only in History. That is the surfacing failure, not a silent drop.

### Game-design expert (opus), verbatim

> # Small Works design review (designer profile)
>
> I played about 55 driver calls, from Day 1 09:00 to the opening of Day 3. I finished five repairs: Mum's lantern, Evan's fan, Nora's reading light, Nora's music box and my own paper theatre, the last with Sam watching. All of them were on time, and £24 grew to £100.
>
> ## What works (seen)
> - **The diagnostic core is real.** Probing B→C while carrying gave 6.00V, and C→D gave 0.00V. That reasoning is genuine circuit logic. The decoy contact ("The exposed metal is aged and dull") paid off later, on Nora's lamp, where C→D read 2.67V under load.
> - **The first choice is meaningful.** One screen offered "You have one new switch in stock, and it is your only one. The cracked spare lantern has one too. Taking it costs nothing, but nobody has tested it." It is a real trade between risk and stock.
> - **Refusals mostly say why.** "Check restored use under load before returning it, or explicitly return unfinished." "There is not enough workshop time left today." "Sam has this object."
> - **Sam is the best thing in the game.** He said: "I have not learned where to begin checking this kind of object. Let me watch its first test." He also said "Sam's acquired knowledge remains his", stopped to "Have food and water", and turned down responsibility honestly. That reads as a person, not a script.
> - **Repaired objects return to life.** People's activities changed to "Read by Mum's walking lantern" and "Read by Nora's reading light".
>
> ## Where it fails each direction
> - **Natural difficulty: fails.** Every fault fell to one measurement plus one action. On Day 1 I accepted all three requests and had them all done by Day 2 10:30, with nothing pushing back. The day ends on a clock ("380 min until closing"), not on anything in the world. All four people share the same 15:00–17:00 commitment on both days, which looks like a template, not a set of lives.
> - **Early meaningful choices: half.** The switch choice is good, but nothing afterwards showed which switch went in. The replace button just said "1 switch (2 stocked)", so the risk I took was invisible. I accepted all three neighbour requests and saw no cost or tension.
> - **Honest hints: fails in places.** On Mum's job, the guide reset to "Start at the battery…" after I had already measured the battery. The game says "The owner's requested 15 ± 3 rpm". Nora only said "The melody sounds wrong." She never asked for rpm. Sam's request ends in the narrator's voice: "I want the figures to turn at 18 rpm, within one rpm." Mum's request reads like generated text: "At rest, the airflow falls short; through the grille, the airflow falls short."
> - **Surfaced crises: fails.** Sam's offer at 09:00 ("I'd like to see how you find the fault") appeared only in History. His stalled responsibility ("I have put the little paper theatre safely aside") appeared only in History and on the workboard card. Mum's Day 3 event, "people arrive at 15:00… two formats, at most", appeared only in History. "£4 covers consumables" appeared only in History. The workbench never showed any of these.
> - **Refusals that say why: mostly pass.** The theatre showed the reason, "Sam has this object." But the workboard card then offered four overlapping buttons: "Review together / Take object back · request lesson / Retry after teaching / Take over / cancel responsibility". I had to guess between them.
> - **Edges kept fun: untested beyond the basics, and dull where tested.** Over-accepting work cost nothing. Adjusting the switch without evidence just failed. The guide then looped back to the battery step instead of naming my mistake.
> - **People feel like people: Sam yes, the neighbours no.** On return, Nora said only one line ("I can keep this tune in its old box."). She did not react to my replacing a gear in her grandmother's music box, after she had said "A new motor would miss the point".
> - **Show rather than count: fails badly.** The screen showed "Light reaches 96% under movement", "3.75 rpm", "−82.50 rpm Δ", "Factor ×0.4 ×0.8 ×1 ×1.2 ×1.6" and "380 min until closing". Fixing the music box was spreadsheet arithmetic: 90 ÷ 3 × factor ÷ 2.
> - **Faith: absent.** That complies with the direction.
>
> ## Three highest-leverage changes, ranked
> 1. **Put people's speech in front of the player.** When Sam or a neighbour says something that needs a decision (an offer, a stall, an event deadline), show it as a card on the workbench with its action buttons. That covers Sam's "Let me watch its first test" and Mum's two-format limit. History should keep a record, not deliver news.
> 2. **Replace the numbers with felt state, and keep requests in the owner's words.** Show the lantern glow dimming, the melody "dragging" or "racing", and a meter needle with a tolerance band. Hide exact rpm and percentages unless the player holds a tool that would measure them. Write every request as speech the character could actually say.
> 3. **Make commitments collide.** Spread deadlines out and give people different schedules. Make accepted promises compete for one bench, Sam's limited hours, and stock (one cell for two "fades" faults). Make outcomes carry the method: when I replace an original part in a keepsake, Nora reacts in her return line. Tag a salvaged part as "untested" so it can fail later. That turns accepting everything into a real gamble and gives the early switch choice a consequence.
>
> ## Bugs seen
> - Lowercase names in generated text: "Back with evan", "Back with nora", "I'll take responsibility for nora's keepsake music box".
> - The Mum lantern guide restarted at "Start at the battery" after a failed adjust, even though the battery was already measured.
> - Clicking "Return checked object" on an uninvestigated fan showed the refusal only as a banner at the top of a long page, far from the button I clicked.
> - The replace step did not say whether the new or the salvaged switch was fitted.
> - Two near-duplicate Day 3 requests from Mum ("meeting-room fan" and "community room fan") look like one fault posted twice.
>
> ## Verdict
> The game shows real reasoning in its circuits and an apprentice who is a real person, but play is a guided tutorial that ends in arithmetic. I solved every job in one or two moves, faced no pressure from the people or the world, and learned the important news from History. For a designer it is a strong engine without a game yet. Fix how people's news is surfaced and how commitments compete before adding content.

### Acted on after round 1 (commits `0713305`, `ce71918`)

| Finding (who) | Change | Gate |
|---|---|---|
| People's words only in History (cozy, sceptic, designer #1) | Today's lines from people show under the header on every screen. Sam's ready window for a lesson or repair shows in the needs-attention strip and opens People. | UI |
| Percentages nobody measured (cozy, sceptic, designer #2) | Trying an object reports what a person notices: "The light goes out while carried", "Bright and steady while carried", "The melody drags a little under load". The meter keeps exact readings. | engine 5 |
| Breaking promises costs nothing and never escalates (edge) | The first overdue notice now lowers the owner's trust in the player's word (HF `noteVoicePromise`); a day later the owner speaks again: "My reading light is a day past what you said. I’ll take it back as it is whenever you like. I won’t plan around your times so readily now." On-time returns count as kept. The People screen shows each person's reading in words. | engine 5 |
| Lowercase names (cozy, sceptic, designer) | "Nora’s keepsake music box" stays capitalised inside sentences; "Back with Nora"; an owner speaks of "my reading light". | engine 5 for log text |
| Recover part reveals a hidden open part for free (edge) | Trying to recover a part that looks present now costs the attempt, then says it is not usable. | engine 5 |
| Coach forgets evidence (cozy, sceptic, designer) | After work on the object, the guide says "Your earlier readings were taken before that change, so they no longer hold. Measure again from the battery." | UI |
| Donor cue overclaimed (designer, sceptic; also an internal review) | Now: "Taking it out costs workshop time, commits the spare to parts, and the part may turn out unusable." | UI |
| "No prepared activity was completed" without why (edge) | "Nobody used what you prepared. Mum: visit a neighbour instead. …" | engine 5 |

Not acted on, with reason and target in the ledger: commitments that collide (designer #3; natural difficulty needs a scenario redesign, not a patch), owners' schedules at return time, method-aware return lines (keepsake gear), request text that repeats itself and the motor in a music-box request, duplicate fan requests, Notes contrast, recovered part indistinguishable from new stock, the music-box governor reading, and a phone layout check.

## Round 2 (build `ce71918`, frozen)

The same four agents replayed from fresh browser profiles against the frozen round-2 build. The speedrunner was not rerun: its round-1 block was the driver's tab bug, now fixed. Exports: `evidence/playtest-10-{edge,cozy,sceptic,designer}-round2-2026-10-19.json` (game 3.1.0-alpha.2). **Confirmed:** all four replay exactly at `ce71918` (checked in a temporary worktree, since removed). The current game refuses them on load, deliberately: alpha.3 changes engine-5 text that is saved in the world. SHA256: edge `30e72493…a1cb2641`, cozy `59a27df6…11abd049`, sceptic `1fb41502…81941bb0`, designer `5f19da54…ae76b5e6`.

| Persona | Model | Inputs | Reached | Verdict in brief |
|---|---|---|---|---|
| Edge pusher | sonnet | 19 | Day 8 | "broken promises now matter … but the reactions stop escalating after the first day" |
| Cozy story | fable | 24 | Day 2 · 10:00 | "The voices moved into the room and the numbers left it" |
| Sceptic | opus | 41 | Day 3 · 09:00 | "the workshop now remembers my promises and the hints stopped lying" |
| Design expert | opus | 34 | Day 3 · 09:10 | "a well-written tutorial, not a management game" |

### Edge pusher (sonnet), round 2, verbatim

**Round 2 edge report (about 20 driver calls, fewer than the 30–50 asked for)**

**Round-1 complaints that are fixed**
- **Broken promises now have a cost.** On Day 2, 17:00 Mum wrote: "My walking lantern is a day past what you said. I’ll take it back as it is whenever you like. I won’t plan around your times so readily now." Nora and Evan said the same on Day 4. In round 1 the days just passed in silence.
- **Trust is now visible.** People & supplies shows "Sam takes your word readily.", "Mum takes your word, with a little caution." and "Nora waits to see whether you mean it."
- **Skipped afternoons are explained.** The Day 4 line now reads "Nobody used what you prepared. Mum: spend 30 minutes on: visit a neighbour instead. Nora: take a break instead…". It no longer says only that nothing was completed.
- **Messages sit on screen.** Overdue lines and reactions appear at the top of each screen, so I didn't have to open History to find them. On the phone screenshot (390 wide) the overdue banners and the reactions stack at the top and fit the width.
- **Mum's lantern wording reads right.** "my walking lantern" replaces the old "mum’s walking lantern" in Mum's own speech.
- **The spare lantern now says it is a donor.** "This object is a donor now. Recover remaining parts; it will not return to service." appears before I act, and the bulb recovery no longer says nothing is there.

**Still wrong**
- **The "returned unfinished" reply is canned and wrong.** Mum and Nora both got "Thank you for telling me what remains. I’ll make another plan. It came back later than promised." Nora's came back on Day 8, five days late, but the line has no number and no change in tone. Returning unfinished also left Mum's trust at "a little caution" and Nora's at "waits to see whether you mean it", so an honest return changed nothing I could see.
- **The nagging stops.** After Day 4 there is no new reminder from Nora, Evan or Mum. Mum's line "I’ll bring you something new once my walking lantern is back." repeats unchanged every morning, Day 3 to Day 8.
- **Recovered parts still fail with no reason.** "The recovered bulb is not usable. The donor is committed to salvage." and the same for the cell. I recovered two parts from the spare and got nothing usable from either.
- **Spending feedback is still thin.** I bought a motor (£18) and a contact (£4) and was down to £2. I didn't re-test the refusal messages.

**New, better or worse**
- **Worse: the first-week panel blocked my buttons.** On Day 8 an afternoon-recorded panel ("Afternoon recorded", "The prepared plans were not attended") sat above the workboard. My first "Return unfinished" clicks timed out until I clicked "Keep the workshop open →". On the phone, the panel pushes the workboard below a long scroll. That is an obstacle, not a prompt.
- **Better: the week-end text.** "The first week is complete. Look at what is back in use, what people can now do, and what you want this workshop to become." This is good.
- **Better: Returned objects list.** Mum's lantern and Nora's reading light appear in a "Returned objects" list at the bottom of the workboard, each marked "returned unfinished" with a day and time.

**What I did not test**
I did not test asking Sam for help, Import, or taking back work I had handed over.

**Where I'd quit:** around Day 6, when nothing new happens, Mum repeats herself daily, and the people no longer say anything about the overdue work.

**Verdict:** broken promises now matter and the trust labels are the best addition, but the reactions stop escalating after the first day and the unfinished-return line never changes.

Export: scratchpad/pt10/edge/export2.json

### Cozy story player (fable), round 2, verbatim

**Round 2 — cozy, fresh profile `cozy2`, 12 driver calls, Day 1 09:00 to Day 2 10:00.**
Export: `scratchpad/pt10/cozy/export2.json`. Screenshots r01–r15 in the same folder.

**Fixed**
- The people are on the bench now. The first screen opens with "Sam I have the morning free. If you want company, I'd like to see how you find the fault." and "Mum I used this lantern on the walk home when you were small. It still has work left in it." above the lantern. I did not have to find History.
- Percentages are gone from the try-outs: "The light goes out while carried." / "Bright and steady while carried." / "It lights, but dimly, under load; not enough." / "The drum crawls under load; the melody drags badly." The lantern is drawn dark when it fails. This is what I asked for.
- "nora" is capitalised everywhere I looked: "I'll take responsibility for Nora's reading light", "Back with Nora".
- The hint reset now explains itself: "Your earlier readings were taken before that change, so they no longer hold. Measure again from the battery." Still a nag, but an honest one.
- A "Return to Nora" button sits on the bench; no detour through the Workboard.
- Nora's return card has her voice: "I can keep this beside my book while I read."

**Remaining**
- Sam is still furniture. He says he has the morning free twice; People & supplies has no control for him at all (checked the full controls list: only Buy buttons). Day 2 he says "I'm back this morning" and I still cannot so much as nod at him.
- The feed shows the three same lines all day. At 11:25 the bench still read "Sam I have the morning free" beside "Mum Mum's walking lantern is back in use." It is a log, not a conversation; nobody speaks to me after a return except as a ledger entry ("Received £18").
- Nora's reading light is still the identical lantern drawing and the identical four parts.
- Notes table readings are still near-invisible ("2.67 Vbefore work" is faint grey on green, r11.png).
- Hint/button mismatch remains: "It stays lit when carried. Give it back to Mum." next to a button "Try the lantern →".
- Day 2 · 09:00: no "Now: …" line for anyone; by 10:00 they are back.

**New, worse**
- The music box lost its only signal. Round 1 told me 3.75 rpm at collar 2 and 6 rpm at collar 4, so I knew I was moving the right way. Now collar 2 and collar 4 both read "The drum crawls under load; the melody drags badly." I cannot tell whether the setting did anything. Show-don't-count needs words that change ("drags a little less") or I am turning a knob blind.

**New, better**
- "A new workshop morning." on Day 2 is a small kindness.

**Where I would quit now**
Day 2 · 10:00, same place: the governor at 4 gave the exact sentence it gave at 2, no one to ask, Sam idle. I would come back tomorrow only if Sam could be invited to the bench, because the opening finally made me want him there.

**Verdict**
The voices moved into the room and the numbers left it, which is real progress; but nobody answers when I speak, the apprentice is still a line of text, and the music box now hides whether I am getting warmer.

### Sceptic (opus), round 2, verbatim

Round 2 sceptic retest of Small Works: export at scratchpad/pt10/sceptic/export2.json (profile sceptic2, about 30 calls, played to Day 3 09:00).

FIXED: (1) Hints no longer claim numbers: carrying now says "The light goes out while carried." and the music box says "The melody keeps its pace under load." There is no 0% or rpm I didn't measure. (2) The coach reset now explains itself: "Your earlier readings were taken before that change, so they no longer hold. Measure again from the battery." That's fair. (3) The salvage hint states its cost: "Taking it out costs workshop time, commits the spare to parts, and the part may turn out unusable." (4) People speak up front: Mum says "I used this lantern on the walk home when you were small." Sam's morning offer is visible at 09:00. (5) Broken promises have consequences now. Next morning Evan says "You said Day 2 · 17:00 for my small desk fan. I'm still waiting. If it can't be done, tell me and give it back." "Return unfinished" exists, and he answers "Thank you for telling me what remains. I'll make another plan. It came back later than promised." "Return checked object" on an untested fan refuses: "Check restored use under load before returning it, or explicitly return unfinished." (6) "Back with Nora" is capitalised.

REMAINS: (a) The person test still fails. Blind gear swap on the grandmother's music box, no diagnosis at all: she says "I can keep this tune in its old box." The request still says "A new motor would miss the point" and the box has no motor. (b) Returning during an owner's listed outing still works. I returned the lantern at 15:35 inside Mum's "Visit a neighbour 15:00–17:00", and she was on "Take a quiet break". Sam was under "Help my sister with her move 15:00–17:00" but "Now: Work on my own stand and plans". Schedules are decoration. (c) Wasting the only bulb gets no remark. (d) The recovered switch and the new one pool as "(2 stocked)". I can't choose which goes in. (e) The Day 3 requests still read as generated ("At rest, the airflow falls short; through the grille, the airflow falls short.") and Mum's two room-fan jobs are still there. (f) Evan's and Nora's complaints are word-for-word identical.

NEW/WORSE: (1) Lowercase in the overdue banner: "Nora is waiting for nora's reading light", "evan's small desk fan", "View mum's walking lantern". (2) Honesty earns nothing visible. After the honest unfinished return, Evan shows "takes your word, with a little caution", the same as Nora, whom I simply ignored. (3) With seed 42 fixed, knowing the answer replays the whole game: I fixed the music box in 45 minutes without a single reading. (4) Clicking "Look inside" when the cover is already open closes it, which is easy to do by accident.

Where I'd quit now: later than round 1. The overdue complaint made me want to go back and fix the reading light. I'd quit at the Day 3 workboard if the next owner again accepts a part swap they explicitly asked me to avoid.

Verdict: the workshop now remembers my promises and the hints stopped lying, but the owners still don't care how their things were fixed, and their timetables still mean nothing.

### Game-design expert (opus), round 2, verbatim

Round 2 Small Works design review (designer2, 33 calls, reached Day 3 09:10). Export: scratchpad/pt10/designer/export2.json

AGAINST MY THREE PROPOSALS
1. Surface people's news (my #1). Half fixed. People's lines now show under the header. The ready window shows on the bench as a strip ("Sam · Take a quiet break … Wait for current activity"), and the lesson panel is honest about limits: "Another pending promise overlaps: Help my sister with her move … Sam chose this lesson and may leave". The community event is a strip ("Community afternoon · site opens Day 4 · 12:00 / 0 formats prepared"). Still failing: the header is a log, not a set of decisions. Sam's 09:00 offer ("I have the morning free…") was still on screen at 11:35, with no button attached and no sign it had expired. Most header lines are narrator text placed in a person's slot: "Mum Mum's walking lantern is back in use." There was no deadline warning anywhere on Day 2. "Close for the day" broke Nora's promise silently.
2. Show rather than count (my #2). The use checks now pass: "The light goes out while carried.", "Bright and steady while carried.", "A steady breeze under load.", "The melody keeps its pace under load." The rest still counts: "1.54V", "6.00V", the bench hint "requested 12 ± 1 rpm", "480 min until closing" and the collar factor table. The spreadsheet core is unchanged. I fixed Nora's lamp (clean the contact) and the theatre (collar to 1) blind, from memory, with no measurement. The game never asked for evidence, so the diagnostic loop can be skipped on replay.
3. Commitments that collide (my #3). Not fixed. I accepted all three requests again with no friction. Everything was done by 14:30 on Day 1 except the music box, which I abandoned on purpose. The new reaction to the broken promise is good writing: "You said Day 2 · 17:00 for my keepsake music box. I'm still waiting. If it can't be done, tell me and give it back." But the cost is trivial. Nora answered "Thank you for telling me what remains. I'll make another plan." £0, and nothing else visibly changed. The salvaged switch is still invisible: "Switch 2 in stock", and replace does not say which one is fitted.

OTHER DIRECTIONS
- Honest hints: improved. The donor cue now reads "Taking it out costs workshop time, commits the spare to parts, and the part may turn out unusable." The guide skipped the battery step correctly when I went straight to the switch.
- Capitalisation: not fully fixed. "Nora is waiting for nora's keepsake music box." and "View mum's walking lantern and its checks →".
- Stale text: on Day 2 the fixed theatre still says "The tune races ahead of the figures."
- Faith: absent. That complies.

VERDICT
These are real but cosmetic improvements to the surface. Felt use-check text, people's lines and an honest broken-promise follow-up all move the game toward the direction. The structural problems remain. There is no pressure: three accepted jobs fit in half a day. Evidence is optional: a remembered fix works with no measurement. A broken promise costs one polite sentence. Until promises compete for the bench, Sam's hours and stock, and owners remember a broken promise in later requests or prices, the game is a well-written tutorial, not a management game.

SEEN vs INFERRED: all quotes are seen. "No lasting cost of the broken promise" is inferred from Day 3 09:10 only. I did not play further.
### Acted on after round 2 (game 3.1.0-alpha.3)

| Finding (who) | Change | Gate |
|---|---|---|
| Unfinished-return reply is canned whatever the lateness (edge, designer) | The owner's answer depends on lateness. In time: "Thank you for telling me in time. I’ll make another plan." Under a day late: "…later than you said, but not by much." One or two days: "I waited a day past your time for this. I’ll make another plan." Longer: "I stopped expecting it some days ago. I’ve made other plans." | engine 5 |
| "I’ll bring you something new once … is back." repeats every morning (edge) | Said once per job. | engine 5 |
| Owners don't care how their things were fixed (sceptic person test) | When a new part goes into the keepsake music box, Nora says after the return, naming each replaced part: "It plays, and I’m glad. You put in a new {part}, though. It isn’t quite her box any more." | engine 5 |
| "A new motor would miss the point" in a box with no motor (sceptic, designer) | New music-box requests say "New parts would miss the point". | engine 5, at request creation |
| Music box lost its gradient (cozy) | Felt use has seven bands from "barely turns; the tune is hard to recognise" to "races; gallops". A failed try also says "Faster than the last try.", "Slower …" or "About the same as the last try." No numbers. | engine 5 |
| Lowercase "nora's …" in the banner and "View mum's …" (sceptic, designer) | Banner and People links capitalise the owner inside sentences. | UI |
| No Day-2 deadline warning (designer) | The needs-attention strip says "{object} is due back today, at HH:MM." from the start of the due day. | UI |
| Stale lines in the header all day (cozy, designer) | Today's lines from people show for two hours, then leave the header (History keeps them). | UI |
| "Nobody used what you prepared. Mum: spend 30 minutes on: visit a neighbour" (edge) | The "spend N minutes on:" prefix is removed. | engine 5 |
| Sam is furniture; no way to answer his offer (cozy) | An "Ask Sam to watch" button sits beside Sam's morning offer while it stands. Confirmed side effect: asking ends the guided first repair, because Sam is now involved. | UI |

**Not acted on in this round, with reasons.** Each is targeted in the ledger.
- **Commitments that collide** (designer #3, the main structural finding). Three jobs still fit in half a day. Natural difficulty needs a scenario redesign: overlapping deadlines, Sam's hours and stock competing. A text patch would not fix it.
- **Owners' schedules at return time** (sceptic). An owner accepts a return during their listed outing. Fixing it means deliveries wait for presence, which changes the return flow.
- **Honesty earns nothing visible** (edge, sceptic). An honest late return and plain neglect read the same in trust. The kept-word reading counts only on-time returns. Distinguishing them needs a modelling decision on how HF's voice trust should treat a late, honest admission.
- **Recovered parts pool with new stock** (sceptic, designer). The player cannot choose which switch goes in.
- **Recovered parts fail with no reason** (edge).
- **Request text repeats itself, duplicate fan jobs, identical complaints across owners** (sceptic).
- **Fixed seed 42** (sceptic). A remembered answer replays the game. Evidence is optional on replay (designer).
- **Meter numbers and "480 min until closing"** (designer). The meter is the deliberate exact instrument; the clock line is a candidate for words.
- **Notes contrast; identical lamp drawing for Nora** (cozy).
- **"Look inside" toggles the cover closed** (sceptic).
- **The first-week panel blocks the workboard** (edge).
- **Stale theatre description after a fix** (designer).

No round-3 retest of alpha.3 by source-unread testers was run. The changes above are covered by unit tests only.

## HF-character harness

`packages/playtester/examples/smallworks-adapter.ts` and `smallworks-session.ts` (in the HF repo, uncommitted, for the coordinator) play the game headlessly with eight HF personas over two seeds. The adapter reads the game read-only through `SMALLWORKS_DIR` and exposes only what the screen shows. Run at game `ce71918`, output in `evidence/hf-playtester-smallworks-2026-10-19.txt`:

| Persona | Seed 1 | Seed 2 |
|---|---|---|
| commuter | stopped for own agenda, 13 min, 4 returns | agenda, 10 min, 2 returns |
| unwinder | quit (distress: rest) 20 min, 4 returns | quit 20 min, 4 returns |
| completionist | quit 20 min, 4 returns (1 late) | quit 20 min, 5 returns |
| restless | quit 20 min, 4 returns | quit 14 min, 4 returns |
| mischief | game over Day 8, 7 unfinished | game over Day 8, 7 unfinished |
| exploiter | quit (boredom: novel) 11 min, 6 unfinished | game over Day 8 |
| rulesLawyer | game over Day 8, 1 return | quit Day 10, 9 unfinished |
| returner | agenda, 10 min, 3 returns | agenda, 8 min, 2 returns |

Readings, confirmed from the runs: the ordinary personas return 2 to 5 objects; most quit near the 20-minute mark on distress, driven by failed re-checks after an intervention that misses the fault (worn and misaligned parts read alike). Mischief and exploiter runs reach the first-week account by returning work unfinished. Assumed, per the adapter's author: pacing (click seconds, reading speed) and promise weights are hand-set, so the time split (about 0.68 watch / 0.32 input) is not a persona finding. Framework findings from the adapter are in the HF requests.

### Harness rerun at alpha.3 (2026-10-19, later)

The harness was rerun at game `3bac17c` (alpha.3), output in `evidence/hf-playtester-smallworks-alpha3-2026-10-19.txt`. Exit 0, 8 personas × 2 seeds.

The playtester package had changed in the HF working tree since the first run. Those changes are another agent's, uncommitted. So the same harness was also rerun against `ce71918`, output in `evidence/hf-playtester-smallworks-ce71918-rerun-2026-10-19.txt`.

**Confirmed: most of the shift from the table above comes from the harness, not the game.** With the same harness, `ce71918` and alpha.3 give identical stops for 13 of 16 runs. Mischief and exploiter seed 2 differ by 0.1 minute. The game changes show up in three runs:
- **Completionist seed 1:** 21 min, Day 3, quit on joy:novel → 57 min, Day 11, first-week account seen, 7 returns, quit on distress:rest.
- **Completionist seed 2:** 51 min, Day 10 → 38 min, Day 6, 6 returns, quit on distress:rest.
- **Unwinder seed 2:** stops at the same minute, ten game-minutes earlier.

Assumed, not tested: the completionist responds to the felt music-box gradient and the lateness-aware replies, the only alpha.3 changes the adapter can read.

Current harness, alpha.3:

| Persona | Seed 1 | Seed 2 |
|---|---|---|
| commuter | quit (joy:novel) 14 min | agenda 14 min |
| unwinder | quit (joy:novel) 22 min | quit (joy:novel) 21 min |
| completionist | quit (distress:rest) 57 min, Day 11 | quit (distress:rest) 38 min, Day 6 |
| restless | quit (boredom) 5 min | quit (boredom) 6 min |
| mischief | game over Day 8 | game over Day 8 |
| exploiter | quit (boredom) 10 min | game over Day 8 |
| rulesLawyer | quit (distress:rest) 10 min | quit (distress:rest) 15 min, Day 10 |
| returner | agenda 13 min | agenda 14 min |
