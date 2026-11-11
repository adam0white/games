# The Left Hand retests-1027c, 2026-10-27

- **Build tested:** live https://lefthand.adamwhite.work at `c0f3e8a` (`c0f3e8a0f266e5bce7765b4de0ec093db35a5999`, `/release.json` `dirty:false`), opened with `?labRunSource=agent`. The design doc and Deferred list were read at `origin/main` `c0f3e8a`. The shared checkout is behind at `269201c` and was not used.
- **Previous round:** `retests-1027b`, the first lab-panel round (`docs/games/lefthand-playtest-2026-10-27-panel.md`), on `6c34992`. The fix cycle between the rounds is commits `4246cac` and `c0f3e8a` (fix report `claude-builds/lefthand-panel-fixes.md`).
- **Testers:** the same 15 testers as `retests-1027b`, on a same-tester return visit (iteration 2).
  - 12 standing panel personas: Maya, Emre, Nia, Rosa, Jonas, Aisha, Diego, Mei, Samir, Tessa, Pavel and Leila.
  - Greta Holm and Joseph Mwangi, who were cold testers last round. This is their second visit, so they are no longer cold.
  - The returning Claude cold player (`cold`), on its fourth visit. It read its earlier reports.
  - Each tester was a Claude persona agent and read only its own previous report.
- **Method:** the harness lab driver. Each tester played two fresh sessions, 360x690 phone and 1280x800 desktop, with light mode requested. The floor was 0, the ceiling 20 minutes, and testers stopped freely. Recording stayed on, and runs are labelled as agents.
- **This is a fictional lab panel.** It is not evidence about recruited players or a population.
- **Caveats:**
  - Every report is the tester's final reply, saved by the coordinator, because the subagent's own file write was refused.
  - Old exports are refused by design (schema `left-hand@3`). No tester tried an old export.
  - The page rendered dark although light mode was requested. The driver sets `colorScheme: 'light'`, so the dark page is the game's own night styling. No tester asked for light mode, so it is not routed.
  - Most first_minute lines were logged late (60 to 183 s), and many diary times are the testers' own estimates.
  - Driver time per op rose against `retests-1027b` (phone tap median 1.6 s then, 3.2 s now). The cause is not known.

## Verdict: finished (iteration 2)

This is the second same-tester retest, so the game is finished after this round. Every remaining ask goes to the Deferred list with a date.

- Dispositions: 1 keep, 12 mixed, 2 quit. One quit is marked TOOL.
- **Keep:** Maya. Her "I would stop returning if two runs with different choices began to read the same again" describes a later stop, not a condition on this return. This is the one judgement call.
- **Quit:** Tessa (game: no joke or lie at Tariq, "I have seen the loop"). Greta (TOOL): both of her stops rest on driver time of 4 to 12 s per op; see the harness notes.
- **Mixed:** the other 12. Six of them (Emre, Jonas, Mei, Pavel, Samir, Diego) would return on desktop only. Joseph's condition rests only on timing ("only if I can reach the marker inside the 60 seconds"); his stops were FINISHED, so he is not marked TOOL.
- One new blocking ask follows (F-2153). It is tied to Diego's mixed return condition.
- All six blocking asks from `retests-1027b` (F-1626 to F-1631) were met or mostly met in the testers' words. The asks that still hold return conditions are old numbers: F-1623 (the stop near Home) and F-1632 (the walk against the clock, unreproduced).

### New blocking asks

1. **F-2153. A second run opens on the same evening, and nothing new waits after the three nights.**
   - Diego's return condition: "There must be something new after the three nights, because a replay opened identically. Nothing new has appeared yet."
   - Diego, want_quit at 253 s: "Three nights done and the replay opens identical. I have seen both routes now. Nothing new waits that I can see."
   - Tessa (quit), stop: "Better than before but I have seen the loop and still cannot joke with Tariq."
   - Last round this ask leaned on F-1623 without its own number. F-1623 is where the neighbour stops Yusuf; this ask is about a second run.
   - Confirmed: "Play again" opens on the same evening-1 text (Diego, Emre). Unknown: whether Play again uses a new seed. The design doc says Tariq's lane is seeded, so a new seed may already vary night 1, but no tester saw it vary.
   - **Proposed fix:** give Play again a new seed that changes Tariq's lane and the first witness, and add one evening-1 line that says what is different this run.
   - Target 2026-11-10 (design work).

### Still open from earlier rounds

Fates of the fix cycle (F-1626 to F-1631, fixed in `4246cac` and `c0f3e8a`):

1. **F-1626. Which figure is Yusuf.** Met.
   - Aisha: "I can see which figure is me now (a You label)".
   - Leila: "My figure is labelled You now. That answers my first ask."
   - Jonas, Diego, Joseph, Rosa, Greta and cold said the same.
2. **F-1627. Mornings change with route and lantern.** Met on desktop; partly met when a night repeats.
   - Maya: "Morning 2 differs from Morning 1 in every line and names my well box, hidden lantern, and keeping quiet."
   - Samir: "Morning 3 fits the door choice: Samira says she knows it was me and only her household knows."
   - The repeat case is a new smaller ask, F-2160.
3. **F-1628. A failure names its reason.** Met, with one gap.
   - Diego: "it says the dawn came before I left the envelope and that I was 6 steps from the well. That is the cause and the distance."
   - Jonas: "Leaving at the well box shows Danyal collects in 3 s, dawn in 34, must be collected before dawn. That is the warning I asked for last time."
   - Gap: the morning does not say that a neighbour's stop cost time (Mei: "It does not yet say Danyal's stops cost time"). Pavel's desktop report "only said "did not leave it"", while his phone report gave "Danyal needed 2 more seconds". Target 2026-11-10.
4. **F-1629. Which tile counts as "beside".** Mostly met.
   - Aisha: "The game told me corner to corner does not count and to step onto a highlighted tile."
   - Tessa: "The game now tells me corner to corner does not count. That was my confusion last time."
   - Still open: the rule appears only after a failed try, and the teal tiles are hard to read on the phone. Greta: "That is the rule I asked for, but it appears only when I fail." Greta: "Whether I stood on a highlighted tile. I could not read it from the map at either size." Jonas: "Clear message, but it cost me a try."
   - Greta's "I pressed Leave envelope while standing inside the teal marks and nothing happened" is a refused tap after dawn (harness notes), not a tile fault.
   - Target 2026-11-10: show the rule in the night-start text and thicken the teal outline at 360 px.
5. **F-1630. The cold is shown in time.** Mostly met.
   - Tessa: "Numb warning came with time to act this time."
   - Jonas: "A hidden lantern is a real decision now."
   - Still open: how fast warmth drains. Leila: "I could not tell how fast the cold runs." Tessa (phone): "it went from fine to empty fast."
   - Leila again asks for "slows movement". The design doc says hidden-lantern cold does not slow movement, so this is not claimed. Assumed, not confirmed: any slowdown she felt.
   - Not seen by Mei, Joseph, Pavel and Samir, who never hid the lantern.
   - Target 2026-11-10: put the seconds of warmth left on the bar.
6. **F-1631. A third reply at the neighbour's question.** Met for most; partly met for Tessa, whose quit rests on it.
   - Nia: "Third reply is new and good."
   - Diego: "My choice in night 1 changed night 3. That is learnable risk."
   - Tessa: "It is still a fixed menu with no joke or lie."
   - The design doc says Yusuf "tells no lie", so a lie is excluded by a design rule. A joke is not excluded. This needs owner input. Target 2026-11-10.

Earlier open asks:

7. **F-1623. A neighbour stops Yusuf at the same place near Home every night.** Not met. It is now in three return conditions.
   - Cold's return condition: "as long as the watchers stop catching me two or three steps from Home".
   - Leila's return condition: "or the neighbour interruption stops landing in the same spot every night".
   - Jonas: "I would not return if a neighbour stops me at the same step every night whatever I do." His count: "within about four steps on 5 of 6 nights, whichever route and lantern setting I used."
   - Emre, Tessa and Leila said the same. Samir and Emre saw Danyal and Tariq trade places across runs.
   - Hiding the lantern did not avoid a stop (Jonas, Greta, Nia, cold). Jonas: "Show who is near before I commit." Greta: "I could not see which light reached me."
   - Target 2026-11-03.
8. **F-1632. The walk against the dawn clock.** Unreproduced (driver latency of 3.2 s median per phone tap and 2.8 s per desktop key seen in wall-clock op_ms; see the harness notes).
   - This family is in the most return conditions: Greta (quit), Joseph, Rosa, Leila, Nia, Mei, Emre, Samir and Pavel.
   - Rosa: "Yes, but only on one condition: if walking home in the 60-second night were quicker."
   - Joseph: "Let a slow walker win the first night."
   - Mei: "I tapped the well box on the map and nothing happened." Tap-to-go does not exist.
   - Sessions at 1.4 to 3.6 s per step delivered on one to three nights; Maya reached the phone door by keys at 1.3 s per key op. Every session at 4.6 s or more per step delivered nothing. Not routed as blocking under ruling 5. Target 2026-11-10.
9. **F-1624. The arrows at the fold, and the phone arrows moving.** Not met, and seen in two return conditions' sessions (Diego, Emre).
   - Confirmed at 1280x800: the bottom arrow row is cut by the window edge in `nia/desktop/b-002.png`, with the recording notice open. The fix report's "At 1280x800 the arrows stay above the fold" did not hold with the notice open. Nia, Mei, cold and Tessa said the same.
   - Confirmed on the phone: in `emre/phone/b-002.png` (night 2) the hidden-lantern label stacks the lantern and Leave buttons, and the page opens at the top, so the arrows fall below the fold. Emre: "my coordinate taps hit the lantern button instead and I wasted about 12 seconds and hid my lantern by accident." Diego saw the same on night 2.
   - Cold: Danyal's name label still overlaps "Well box" on the morning 3 map.
   - Target 2026-11-03.
10. **F-1625. Danyal says "I saw your envelope" before anything is left.** Not met.
    - Maya: "On desktop Night 1 he said it before I had left an envelope."
    - Rosa: "Danyal saw my envelope though I have not left it yet; I still find that odd".
    - Mei, Pavel and cold said the same. Pavel: Morning 1 cleared it ("I understand now that he saw me carrying it, not leaving it").
    - Target 2026-11-10.
11. **F-1634. Return home does nothing far from Home.** Not met.
    - Maya: "Return home when far still moves nothing, and only prints a line telling me to return."
    - Samir: "Return home from far still did nothing visible." Rosa and Diego said the same.
    - Target 2026-11-10.
12. **F-1635. Missing home before dawn.** Partly met: a cost is now stated, but its line reads as a failed delivery.
    - Rosa (want_quit, CONFUSED): "The envelope reached Samira, so what stays with the household?"
    - Aisha: "Fix "Tonight's envelope stays with the household". It appears on mornings after a delivery, and it reads as if the envelope was not delivered."
    - Diego: "Also unclear what "stays with the household" means for me."
    - Emre: "The ending said "help reached them on all three nights", but Mornings 1 and 2 said dawn came before I reached home. I could not tell which nights counted."
    - Jonas read it as intended: "The envelope counted although dawn caught me before home".
    - Target 2026-11-10: replace the line with "The envelope reached them. You got home after dawn, so ..." and the cost.
13. **F-1636. Copy that contradicts what happened.** Not met; new instances.
    - Rosa: Evening 2 and 3 say "well collection now takes 3 seconds", though it was already 3 s. Mei: Night 3 said the explanation "already saves 3 seconds" while the countdown showed 3 s.
    - Cold: after Explain, evening 2 said "well collection now takes 6 seconds", longer than before, against a choice text that promised quicker collection.
    - Pavel: the phone ending says "Their need stayed private. Idris keeps his dignity" beside "your help reached them on no night".
    - Cold: the status said "Your lantern is lit" while the button read "Lantern hidden · light (L)". Assumed, not confirmed: it may be a one-frame lag.
    - Target 2026-11-10.
14. **F-1637. Rosa's two long sentences.** Not met. Rosa: "Both sentences read the same as last time, and the Tariq one is now longer because the costs sit inside it." She reread "Tariq will repeat his guess that you are helping Idris and Samira." Target 2026-11-10.
15. **F-1633. Keys are swallowed while a question is open.** Partly met. The prompt says the clock waits, but a lost key press gets no sign.
    - Aisha: "I pressed seven keys while Tariq question was open and nothing moved; the clock stayed at 47, so I lost no time, but I did not notice the question had appeared."
    - Jonas: "my arrow presses still did nothing during it."
    - Target 2026-11-10.
16. **F-1622. Stuck moves by the houses, now with no signal.** Not met. The ask widens to a bump cue.
    - Diego: "Wasted eight arrow presses: I walked into the back of a house and did not move."
    - Joseph: "I walked east first and ran into the house walls; the figure just stopped and nothing told me it was a wall."
    - Aisha said the same. Nobody's return condition names it.
    - Target 2026-11-10.
17. **F-1621. The well drawing and the well prompt.** Partly met. The teal ring works (cold: "I stood on the green ring above the well and the envelope left"). Still open: cold says the route prompt "still says only "marked delivery tile"", and Pavel "could not tell it from the map". Target 2026-11-03.
18. **F-1638. Explain and Keep quiet side by side.** Not seen. No tester reported a wrong tap this round. Target 2026-11-10.

### Smaller asks

1. **F-2154. "1 steps" in the morning report.** Aisha: "You were 1 steps from the door" needs fixing. Greta, Jonas and Maya said the same. Target 2026-11-03.
2. **F-2155. A black map at the start of a morning.** Confirmed in `joseph/desktop/b-002.png`: the canvas is a black rectangle above the morning text. Joseph: "I only saw the map after scrolling up." Samir saw "the map area blank and empty" on the phone's first screen; assumed to be the same fault. Target 2026-11-10.
3. **F-2156. Say the night's length and what shortened it at the night start.** Jonas: "Tell me up front how long the night is and which choices shorten it." Tessa: "the night's length changed between nights without explanation." Tessa's 30 s phone night 1 was a 33 s driver hang on her first tap (harness notes); the rescue's 54 s night is real. Target 2026-11-10.
4. **F-2157. A low-clock warning while walking.** Joseph: "Add a short warning, such as "10 seconds left", while walking." Target 2026-11-10.
5. **F-2158. Tariq's lines after Explain.** Nia tapped Explain at 50.4 s (confirmed in the jsonl), then: "Tariq says I asked for discretion, but I picked Explain; that does not match what I did." Leila: "Tariq then said I had told him, and he asked for discretion." Nia also: "Tariq asks me again whether it is for Idris, though I already explained to him last night." Proposed: keep "discretion" for the third reply only, and let Tariq's next-night question name what he was told. Target 2026-11-10.
6. **F-2159. "Collection · 3s" is drawn like a button.** Rosa: ""Collection · 3s" looks like a button but I think it is a timer." Target 2026-11-10.
7. **F-2160. Mornings repeat word for word when the same night repeats.** Aisha: "Morning 2 on the phone reads almost the same as morning 1: Idris, Samira, Danyal and Tariq repeat their lines word for word." Samir: "On the phone, Morning 3 repeated Morning 1 almost word for word, because I did the same thing both times." Proposed: a second failure of the same kind gets a different line. Target 2026-11-10.

### Met, in the testers' words

- The "You" label (F-1626). Jonas: "There is now a You label on the map. That answers my old ask."
- Mornings answer what the player did (F-1627). Mei: "Morning 2 now reacts to my choices: it names that I explained and Samira trusts me less. Last time the lines repeated."
- Failures name their cause and distance (F-1628). Joseph: "Keep the "N steps from the well/door" morning line. It is the best fairness signal in the game."
- The collection countdown (F-1628). Nia: "the button turned into a Collection 3s countdown so I knew it worked."
- The ending names the nights. Aisha: "The ending names which nights helped." Maya: "It reads like my run, not a template."
- The highlighted tiles and the corner-to-corner message (F-1629). Diego: "That outline answers my old question of which cell counts."
- The cold is stated up front (F-1630). Samir: "The cold warning came before night one." Pavel: "That was my complaint."
- The third reply and its memory (F-1631). Maya: "Tariq remembers the promise and says it is used up. That is the first time a game has paid off a choice that quickly for me." Joseph: "Tariq's "Twice is too many; I told people". It made my earlier choice feel real."
- Samira's door line matches the door choice (Samir's contradiction, fixed in F-1627).
- The well label is hidden on a door night. Maya: "The map now labels only Their door, which fixes my old complaint."
- The costs of each reply are written before the choice, and the clock waits. Rosa: "Costs are now written before I choose: good."
- Phone map, warmth bar and arrows fit on one screen at the start of night 1 (Aisha, Pavel, Samir, Maya).

### Harness notes

- **Driver time per op (ruling 5).** Measured op_ms in `wall-clock.jsonl` (no `select` ops this round):
  - Phone tap, 502 ops: minimum 0.4 s, median 3.2 s, 90th percentile 11.3 s, maximum 36.2 s.
  - Phone key, 344 ops: minimum 1.1 s, median 3.4 s, 90th percentile 6.9 s, maximum 18.4 s.
  - Desktop key, 948 ops: minimum 1.0 s, median 2.8 s, 90th percentile 6.4 s, maximum 20.2 s.
  - Desktop tap, 179 ops: minimum 0.6 s, median 6.8 s, 90th percentile 15.9 s, maximum 37.1 s.
  - Per-session median gap between consecutive tap or key ops (driver time plus the agent's own time) runs from 1.4 s (Maya phone keys; Jonas, Mei and Samir desktop) to 11.5 s (Leila phone).
- **The walk against the clock splits by step time (confirmed from the jsonl and the reports).** Sessions with a median step gap of 1.4 to 3.6 s delivered on one to three nights (for example Emre desktop door run, all three nights; Maya phone; Rosa both sizes). Every session at 4.6 s or more delivered nothing: Greta (5.1 and 6.7 s), Joseph (6.4 and 4.9 s), Leila (6.9 and 11.5 s), Pavel (4.6 and 7.0 s), cold desktop (6.8 s), and the phone sessions of Emre (7.2 s), Mei (7.1 s), Samir (7.7 s) and Diego (10.5 s). At 1.3 s per key op (1.4 s between steps), the phone door route fit with time to spare (Maya, night 1, no hang). No tester reached the door by pad taps at 1 to 3 s per tap, so door play at thumb speed is still unknown. F-1632 stays unreproduced.
- **30 s hangs.** 20 tap ops took 30 s or more, in 13 sessions (19 with a `locator.evaluate` or `locator.isEnabled` timeout). The dawn clock ran during each.
  - Five were the first route tap ("Their door"), so the night started during the wait: Jonas desktop (twice), Mei desktop, Samir desktop and Tessa phone. Jonas's "door nights are 30s" guess and Tessa's "Night 1 was 30 s in session A" are this hang, not the game. TOOL.
  - Three were "Leave envelope" (Aisha desktop and phone, Nia phone). Nia's "Leave envelope did nothing useful or the clock ended during the long tap" is this hang. TOOL.
- **Refused arrow taps (ruling 8).** 116 arrow taps were refused as "not on the page now". The next successful tap after them was Keep quiet 51 times, Next evening 36, Ask him not to tell 9, After three nights 8, Explain 2, a route 4 and Move north 6. So they came from game state (an open question or a finished night). No ambiguous-name refusal appears in any jsonl for this game.
- **Refused Leave envelope after dawn.** Greta's desktop tap was refused as "Leave envelope is not on the page now; it was listed 6 s ago" (6 more taps on Leave envelope were refused as "not on the page now", Greta 2, Joseph 2, Tessa 1, Samir 1). Rosa's desktop tap "left the page just before the tap (game state, not a driver failure)". Greta's "I pressed Leave envelope while standing inside the teal marks and nothing happened" is this: dawn came while the tap was in flight. Her desktop tap median was 10.8 s.
- **Diego's dead pad taps.** His two runs of "Six coordinate taps on the arrow pad did nothing" are 12 `invalid` ops at 64.7 to 70.7 s and 161.8 to 167.3 s (a JSON `SyntaxError`, 20 invalid ops in all). They never reached the page. His later coordinate taps at (180, 597) did land, on the lantern, because the pad was below the fold (F-1624). TOOL for the dead taps. Mei also reported "one coordinate tap failed on my malformed JSON".
- **Greta's TOOL mark.** Her quit sentence: "I cannot tell how much of that was my slow driver clicks and how much was the game." Her op medians were 4.2 s per desktop key, 10.8 s per desktop tap, 6.4 s per phone key and 12.3 s per phone tap.
- **Light mode.** Testers saw a dark page (Emre, Jonas, Leila, Mei, Pavel, Rosa, Samir, Tessa). The driver sets `colorScheme: 'light'` (`scripts/lab-play.ts` line 188), so the dark page is the game's night styling. No tester asked for light mode. Not routed.
- **Helper scripts.** In the Watch round of `retests-1027c`, tester Diego wrote a helper script in /tmp, against the brief's "write no files". It printed `error` and `clickable`; the coordinator deleted it. The Left Hand prompts then added "not even helper scripts in /tmp". The words are not in `lefthand/*/brief.md`, so if they were added, it was in the spawn prompt (not verified). No Left Hand report mentions a helper script.
- **Feedback.** Every tester who opened the Menu saw "I'm stopping" and "I'm confused". Nobody typed or sent a note. Joseph and Rosa pressed Cancel, and it closed the note box.
- **Returner and second visits.** Cold is on its fourth visit and knew the routes. Greta and Joseph are on their second visit. None of the three is first-visit evidence.

## Tester ledger

Disposition: keep is yes with no condition; mixed is yes or maybe with a condition; quit is a sentence that opens with no or not tonight. Session times are the driver's elapsed seconds at the stop line, not the player's own estimate.

| tester | commit | sessions (device, stop reason, driver time) | return sentence | disposition |
| --- | --- | --- | --- | --- |
| Maya Chen | c0f3e8a | phone FINISHED at 281 s; desktop FINISHED at 372 s | Would you return voluntarily? Yes, another evening, probably once or twice more, because this time the neighbours' lines and the ending changed with what I actually did. I would not leave it running, and I would stop returning if two runs with different choices began to read the same again. | keep |
| Emre Kaya | c0f3e8a | desktop FINISHED at 435 s; phone FRUSTRATED at 358 s | Yes, I would come back another evening on the desktop to try explain-every-night against ask-not-to-tell. I would not leave it running, and I would not return on the phone unless one arrow step takes a human clearly less than the 6 to 8 game seconds it cost me through the driver. | mixed |
| Nia Okafor | c0f3e8a | phone FINISHED at 351 s; desktop BORED at 269 s | Would I return voluntarily? Yes, once, on another evening, to try a clean door run. I would not leave it running, and I would not come back for the door route if it still takes one tap per tile. | mixed |
| Rosa Alvarez | c0f3e8a | phone FINISHED at 339 s; desktop FINISHED at 366 s | Yes, but only on one condition: if walking home in the 60-second night were quicker. I would close the game and not leave it running. I would come back another evening only on that same condition. | mixed |
| Jonas Berg | c0f3e8a | desktop FINISHED at 291 s; phone FINISHED at 381 s | Yes, for one more desktop evening: I'd want to see whether an early Explain, or a favour I owe, changes what the later well nights cost me. I would not leave it running, and I would not come back on the phone unless input responds at human speed (I think the tool caused that, but I can't prove it). | mixed |
| Aisha Rahman | c0f3e8a | desktop FINISHED at 321 s; phone FINISHED at 411 s | I would come back another evening to try the quiet route again, but only if the ending kept telling me which nights my help reached them. I would not leave it running, and I would not return tonight. | mixed |
| Diego Silva | c0f3e8a | desktop FINISHED at 258 s; phone CONFUSED at 242 s | Maybe, another evening, on desktop only, and only if the three conditions below hold. Last time I set three conditions; one is met now, one is partly met and one is not. This time: | mixed |
| Mei Tan | c0f3e8a | desktop FINISHED at 301 s; phone FINISHED at 387 s | Would I return voluntarily? Yes, on my laptop on another evening, to try the door with a faster hand. I would not come back on the phone while walking is one tap per tile. I would not leave it running, because the nights need my decisions. | mixed |
| Samir Haddad | c0f3e8a | desktop FINISHED at 283 s; phone FRUSTRATED at 360 s | I might come back another evening on desktop, to try the not-tell route and the door route on different nights and see what Samira, Idris and Tariq say. I would not leave it running. I would not come back on the phone if each arrow tap keeps costing about 7 real seconds for me. | mixed |
| Tessa Williams | c0f3e8a | phone FINISHED at 264 s; desktop FINISHED at 453 s | I would not come back to this on my own tonight; I might try it once more another evening if a friend sent me the link and I could do something properly daft with Tariq or pick when to show my lantern. I would not leave it running. | quit |
| Pavel Novak | c0f3e8a | desktop FINISHED at 468 s; phone FINISHED at 558 s | Pavel: "Yes, once more on the desktop, another evening, because I came within one or two seconds of the well on three nights and I want to deliver one envelope. I would not leave it running, and I would not return on the phone while each tap takes seconds." | mixed |
| Leila Mansour | c0f3e8a | phone FINISHED at 358 s; desktop FINISHED at 550 s | Yes, but only once more, and only if the walk to the door fits in the 60-second night at a normal thumb or keyboard speed, or the neighbour interruption stops landing in the same spot every night. I would not leave it running, because it needs my hands. I would come back another evening, not tonight. | mixed |
| Greta Holm | c0f3e8a | desktop CONFUSED at 449 s; phone FRUSTRATED at 465 s | 1. **Would you return voluntarily?** No, not as things stand. I delivered nothing in six nights across two devices, and I cannot tell how much of that was my slow driver clicks and how much was the game. I would come back one more evening, not tonight, if the dawn clock gave a player acting at human speed a fair chance. I would not leave it running. | quit (TOOL) |
| Joseph Mwangi | c0f3e8a | phone FINISHED at 495 s; desktop FINISHED at 576 s | Yes, I would come back another evening for another try, but only if I can reach the marker inside the 60 seconds. I never delivered an envelope in either session, and I would not leave it running by itself. On the phone I would return only if the walk were quicker. | mixed |
| Claude cold player | c0f3e8a | phone FINISHED at 380 s; desktop FINISHED at 583 s | Feedback choices "I'm stopping" and "I'm confused" are offered in the Menu. I stopped at the ending and did not open them. | mixed |

## Player words

Each tester's return answer and ranked asks are their report's own words. The diary rows are the raw driver diary (`wall-clock.jsonl`), every line that carried words, unedited. Coordinator paths are shortened.

### Maya Chen

**Would you return voluntarily? Yes, another evening, probably once or twice more, because this time the neighbours' lines and the ending changed with what I actually did. I would not leave it running, and I would stop returning if two runs with different choices began to read the same again.**

Ranked asks:
1. Make a missed delivery easier to avoid on the desktop. The map is small and the moves are slow, so a one-tile miss feels cheap to me.
2. Make Danyal's "I saw your envelope" fit what has happened. On desktop Night 1 he said it before I had left an envelope.
3. Make Return home move me home, or say where I must stand. It still only prints "Return to your home."

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.7 | tap Their door · farther, Samira knows it was you |  |  | Last time I took the well; trying the door first, farther but Samira will know. |
| 23.6 | first_minute |  | Night 1, 52s | Opening is the same short paragraph. The map now labels only Their door, which fixes my old complaint. Tariq stopped me and asked if it is for Idris; clock is paused. Still not sure who Tariq is to me. |
| 28.6 | tap Ask him not to tell |  |  | New option I did not have before: ask him not to tell, one second, only once. Trying it. |
| 74.8 | tap Return home |  |  | Testing whether Return home does anything from far away now. |
| 88.0 | pulse 4 |  | Morning 1 | Morning 1 opens with a line recapping exactly what I did: door, lantern lit, Tariq saw me, I asked him not to tell. Tariq answers that he will keep quiet this once. That is a neighbour remembering my choice. Samira now says why she knows it was me. |
| 96.5 | tap Well box · closer, Danyal must collect it before dawn |  |  | Switching to the well this time and I will hide the lantern, to see if the morning text notices the change. |
| 120.3 | tap Keep quiet |  |  | Danyal saw me, which is plausible now since he raised his own lantern. Keeping quiet. |
| 168.3 | pulse 4 |  | Morning 2 | Morning 2 differs from Morning 1 in every line and names my well box, hidden lantern, and keeping quiet. Danyal says he cannot say who it was for; Samira says the need stayed private. That answers my old complaint that mornings read the same. I walked home and Enter worked as Go inside. |
| 176.5 | tap Their door · farther, Samira knows it was you |  |  | Door again, lantern lit, and I will explain if stopped to see something new. |
| 200.1 | tap Explain |  |  | Tariq remembers the promise and says it is used up. That is the first time a game has paid off a choice that quickly for me. Explaining. |
| 264.3 | note |  | Morning 3 | Morning 3 is different again and now gives the cause: Samira and Idris say Tariq told people after promising once, so I trust-cost came from his twice. That answers my old why-did-trust-move question. I feel the promise was used up by me. |
| 270.0 | want_quit | FINISHED | After three nights | The ending now counts nights: one night the village learned, one night nobody talked. It reads like my run, not a template. I would like one more go on another path but I am done on the phone for now. |
| 281.0 | stop | FINISHED | After three nights | Done on the phone after one full run. The cast answered what I actually did, and the ending counted my nights. I want to try the well on all three nights another evening. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 21.2 | tap Well box · closer, Danyal must collect it before dawn |  |  | On desktop I will take the well and see if it differs. |
| 61.6 | first_minute |  | Night 1, 35s | Desktop opens with the same paragraph but a different wide layout; map is still small. Danyal stops me with I saw your envelope before I have left one anywhere. I noted that last time too, so it still feels odd, though the prompt now explains the choice. |
| 71.1 | tap Explain |  |  | Explaining this time to see the quicker collection promised. |
| 115.0 | pulse 4 |  | Morning 1 | I failed night 1: I spent the time explaining and missed the well by one tile. The morning says so plainly: nothing reached Idris and Samira, I was 1 steps from the well (small grammar slip). Idris and Samira say they still need help. That is a real cost and it reads as mine. I feel a bit frustrated at being one step short but it is fair. |
| 131.6 | tap Well box · closer, Danyal must collect it before dawn |  |  | Well again, faster this time, and the evening text says collection now takes 6 seconds because of the talk. That is the cause of the change, shown. |
| 246.3 | pulse 4 |  | Morning 2 | Morning 2 names what I did this run: well box, lantern lit, kept quiet, dawn before I reached home. Idris and Samira thank Danyal, not me, which fits the well box. Samira says the need stayed private. The cast answers the actual choices. |
| 264.8 | tap Their door · farther, Samira knows it was you |  |  | Door, lantern hidden, going straight up the east side to dodge people. |
| 344.6 | note |  | Morning 3 | I hid my lantern all night 3 and the cold made me give up halfway; a neighbour carried me home and I owe them work. The text explains exactly why. Nothing reached the family. This is a fair loss and I understand the rule now: hiding costs warmth and can end the night. |
| 355.4 | want_quit | FINISHED | After three nights | The game ended with a different, worse ending from the phone run, and it matches my failed nights. I want to try again soon but not tonight. |
| 372.0 | stop | FINISHED | After three nights | Stopping on desktop after one full run with a bad ending. I will not send the form. I would try the well on all three nights, lantern lit, another evening. |


### Emre Kaya

**Would you return voluntarily?** Yes, I would come back another evening on the desktop to try explain-every-night against ask-not-to-tell. I would not leave it running, and I would not return on the phone unless one arrow step takes a human clearly less than the 6 to 8 game seconds it cost me through the driver.

**Ranked asks**
1. Make phone movement quick enough to finish a night. I cannot tell whether my thumb would be faster than this tool.
2. Keep the arrow pad on screen on every night. On phone night 2 it fell below the fold and my taps hit the lantern button.
3. Let me see the cost of cold and dawn as numbers before the morning, not only the warmth bar and text.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.3 | note |  |  | Return visit. Same table screen, but now it says a warmth bar empties and a neighbour carries me home. That answers my old meter complaint. I will try the door this time, since last time I never learned if it matters. |
| 23.3 | note |  | Night 1, 49s | Tariq again at the start, near home. But now there is a third choice: Ask him not to tell, 1 second, works once. That is new. I try it. |
| 59.2 | first_minute |  | Night 1, 19s left | Delivered at the door about 50s in. This time the Door label matches and the door tile is clearly marked green. A warmth bar is on screen now. Tariq still stops me near home, but I had a third option. Understanding the job is easy. |
| 83.6 | note |  |  | Morning 1 now names my choices: door, lantern lit, Tariq asked to keep quiet, dawn before home. Each neighbour says something different and tied to what I did. That answers my old complaint about identical text. Dawn missed costs a stated thing: envelope stays with household. |
| 105.6 | note |  | Night 2, 51s | Night 2: Tariq stops me again at the same spot, even though my lantern is hidden. But he remembers last night: he promised once, now he will tell whatever I say. The choice shrinks to Explain or Keep quiet. That is a visible consequence of my earlier pick. Still, the same spot each night is a bit fixed. |
| 162.5 | pulse 4 |  | Morning 2 | Morning 2 is different from Morning 1 and traces back to my night 1 choice: Tariq told people because I asked him twice. I can see cause. Missing dawn twice now with no rescue; I am not sure what dawn actually costs me. Warmth bar helped me judge cold. |
| 199.4 | note |  |  | Evening 3 text says the well now takes 6 seconds because of the village talk from my last night. The previous night changes the next menu. Good. (The Next evening tap reported a driver timeout yet the screen advanced; I assume it was a driver lag.) |
| 266.0 | note |  |  | Ending: Help reached them; trust was lost. It names what happened over the three nights, including the Tariq repeat that cost me Samira trust. I can trace it to my choices. Run 1 took about 4.5 minutes. Now I want to try the opposite: Explain to Tariq on night 1 and use the well, to see if it differs. |
| 416.2 | pulse 4 |  | Morning 1 run 2 | Run 2 night 1: I failed to deliver. Morning says I did not leave the envelope, dawn came, I was 5 steps from the well, nothing reached them. A clear failure I can explain. Part of it was my own misreading of the map (I thought I was diagonal and stepped wrong, and the game told me corner to corner does not count). Idris and Samira say they still need help. Stakes feel real now. |
| 435.0 | stop | FINISHED |  | I am stopping desktop after about 9 minutes: one full three-night run and one failed first night. The feedback panel opens with a note box; I typed nothing and pressed nothing. I have seen what changed. I would play again another evening to try explain-every-night vs ask-not-to-tell, but not leave it running. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.3 | note |  |  | Phone, second visit same evening. Same table text with the warmth bar line. |
| 124.5 | first_minute |  |  | Phone: failed night 1. Each arrow tap cost me 7-8 seconds of game clock through the driver (46, 38, 31, 22, 15, 6), so I was 4 steps from the well at dawn. I suspect this is the driver, not the game, but I cannot be sure. Morning states plainly that nothing reached them; last visit missing dawn cost nothing visible. That is now a stated penalty. Screen fits at 360 wide; warmth bar visible. |
| 179.6 | note |  | Night 2, 40s | Phone night 2: the arrow pad is below the fold here because the intro text is longer, so my coordinate taps hit the lantern button instead and I wasted about 12 seconds and hid my lantern by accident. On night 1 the arrows were visible. Layout moves between nights. |
| 244.0 | pulse 3 |  | Morning 2 | Phone Morning 2: the cold carried me home, I owe work and nights get shorter. That is explained and tied to hiding the lantern by accident. Danyal saw me this time instead of Tariq, so nights vary on phone. I am failing mostly because each tap costs me 3-8 seconds through the driver; I suspect that is the tool, but I cannot prove a thumb would do better. Wanting to see Night 3 once. |
| 341.4 | want_quit | FRUSTRATED |  | Phone: delivered nothing in three nights. Ending is clear and fair in its words (no help reached them, rescue, exhaustion). But I cannot tell if my thumb would be faster than this tool; each arrow step cost me 6-8 game seconds. If real thumbs are that slow, the phone cannot play this. |
| 358.1 | stop | FRUSTRATED |  | I am stopping the phone session after about 6 minutes and three failed nights. The fail is partly my tool speed, which I suspect but cannot prove. I would play the phone again only if arrow steps are quicker or the walk is shorter. Feedback opens a note box; typed nothing, sent nothing. |


### Nia Okafor

Would I return voluntarily? Yes, once, on another evening, to try a clean door run. I would not leave it running, and I would not come back for the door route if it still takes one tap per tile.

Ranked asks:
1. Let the phone walk faster than one tap per tile, so the door route (about 12 tiles) can finish in 60 s at tap speed. I never reached the door in either session.
2. Keep Tariq consistent. He re-asked "Is that for Idris?" after I had explained, and one morning he said I "asked for discretion" when I had picked Explain.
3. On desktop, show the arrow pad fully on an 800px-tall screen. The down, left and right buttons are still cut off at the bottom edge.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.4 | tap Their door · farther, Samira knows it was you |  |  | Door again, I want to beat it this time. Remembering the 60s clock and tap-per-tile walking. |
| 21.5 | note |  |  | Tariq stopped me again, same as before. Reading what I can say this time. |
| 56.9 | TOOL tap |  |  | A reply of my own at last, and it costs only 1 second. Taking it. |
| 62.9 | first_minute |  | Night 1, 17s | Map is visible straight away and the door is marked. But the reply tap took 33 s to return and the clock fell from 49 to 18. Same lag as last time; I suspect driver, not game. I am 5 tiles from the door with 17 s left. Third reply is new and good. |
| 79.1 | note |  |  | Dawn hit, I did not reach the door. Again. Reading the morning. |
| 115.1 | TOOL tap |  |  | Tariq kept his word, nice, and it tells me I was 10 steps short. Going again. |
| 120.9 | tap Well box · closer, Danyal must collect it before dawn |  |  | Door cost me the night. Taking the well to see how the delivery spot looks now. |
| 137.3 | note |  |  | Tariq again on night 2, this time he promised to tell if he sees me again. |
| 143.2 | tap Keep quiet |  |  | Dialogue clearly remembers I asked him once. Good. Keeping quiet, no time cost. |
| 178.2 | pulse 4 |  | Night 2, 15s | Dropped at the well first try, and the button turned into a Collection 3s countdown so I knew it worked. Tariq remembering my earlier reply held me. Still one tap per tile. |
| 222.5 | note |  |  | Morning 2. Reading what the neighbours say. |
| 229.3 | tap Next evening |  |  | Everyone reacts to my choices, and Idris was upset I did not let him choose who knew. Night 3, hiding the lantern to avoid Tariq. |
| 254.8 | tap Keep quiet |  |  | Tariq saw me despite hiding the lantern, I am guessing the lane tile beside him is lit by his own lantern or home. Fine. |
| 321.3 | note |  |  | Night 3 failed: Leave envelope did nothing useful or the clock ended during the long tap, and the cold sent me home. I was one tile off I think. The hidden lantern turned the warmth bar very low fast. |
| 351.5 | stop | FINISHED | After three nights | Ended after three nights, one delivery out of three. The walk is still one tap per tile, but the 10-steps-short message and a reply of my own made it feel fairer. Chose I am stopping in the menu, typed nothing, sent nothing. I would try once more another evening with the well, not leave it running. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.6 | tap Their door · farther, Samira knows it was you |  |  | Desktop, same evening. Door again, with the keyboard. |
| 50.4 | tap Explain |  |  | Trying Explain this time to see how it differs from asking him not to tell. |
| 110.3 | first_minute |  |  | Late note. Door missed again, a few steps short, with each key costing me about 3-4 s via the driver (my slowness, I suspect). The arrow pad is still cut off at the bottom of the 800px window, but keys work. The door is clearly marked now and the morning text told me how far I was. |
| 122.3 | tap Next evening |  |  | Two steps short of the door. Tariq says I asked for discretion, but I picked Explain; that does not match what I did. |
| 173.8 | tap Keep quiet |  |  | Tariq asks me again whether it is for Idris, though I already explained to him last night. Odd that he forgets. Keeping quiet. |
| 210.2 | pulse 4 |  | Night 2, 13s | Well delivery worked. The green cross around the well showed me where to stand, and a Danyal collects 3s label sat on the map. That is the thing I asked for last time. |
| 255.5 | want_quit | BORED | Morning 2 | I got my delivery and saw the new bits. Another night of one-key-per-tile is not pulling me. I would leave here. |
| 269.2 | stop | BORED | Morning 2 | Stopping at morning 2. Chose I am stopping in the menu, typed nothing, sent nothing. Well run worked once the spot was clear. I might come back one evening for a clean door run, not leave it running. |


### Rosa Alvarez

**Would you return voluntarily?** Yes, but only on one condition: if walking home in the 60-second night were quicker. I would close the game and not leave it running. I would come back another evening only on that same condition.

**Ranked asks**
1. Make the walk home shorter, or let "Return home" work from anywhere. "Return home" needs walking, and dawn caught me at home or short of it on 5 of 6 nights.
2. Fix the morning line "Tonight's envelope stays with the household". It follows "Dawn came before you reached home" even when Samira received the envelope. Also fix "now takes 3 seconds" on Evening 2 and 3. Collection was already 3 seconds, so "now" reads as no change.
3. Shorten "Tariq will repeat his guess that you are helping Idris and Samira…" and the lantern sentence. Say plainly whether Tariq's guess is good or bad for me.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.1 | shot |  | Evening 1 | Same envelope screen. The lantern sentence is shorter now? Still three ideas, but I read it once. I choose the well box again, closer. |
| 9.9 | tap Well box · closer, Danyal must collect it before dawn |  |  | The lantern sentence is the same as before; I read it once this time because I remember it. I choose the well box. |
| 13.9 | shot |  | Night 1 | Night is running. I look for the marker and which dot is me. |
| 62.3 | TOOL shot |  |  | One tap took about 33 seconds to answer. I suspect the tool, not the game. |
| 64.9 | first_minute |  | Night 1, 42s left | I see a You label and a green box at the well now. Tariq stops me with a question; the clock waits. Goal is clear. |
| 103.8 | TOOL tap |  |  | Costs are now written before I choose: good. But I reread "Tariq will repeat his guess that you are helping Idris and Samira" - still unclear whether guess is good or bad. That is my first reread. I keep quiet. |
| 122.0 | shot |  |  | Dawn came before I reached the well. I suspect a 30 second tool hang on one tap used most of the night; not only the game. |
| 126.6 | tap Next evening |  |  | "You were 5 steps from the well" tells me exactly how far I was. Useful. Next evening. |
| 145.1 | tap Ask him not to tell |  |  | Third choice. It costs 1 second and only works once. I try it to see. |
| 181.0 | shot |  |  | Envelope left. Now home. Which control is Return home? |
| 185.5 | tap Return home |  |  | I try Return home right away to see if it needs walking. |
| 200.5 | shot |  |  | Morning 2. Let me read it. |
| 204.3 | pulse 3 |  | Morning 2 | Second night delivered and private. Better than last time: I saw a You label and the green tile at the well, and the first loss told me how many steps I was short. Still, "Dawn came before you reached home. Tonight's envelope stays with the household." - I reread this: what does stays with the household mean, since Danyal took it to Samira? Each tap costs me about 3 seconds so the walk home still ends in dawn. |
| 230.5 | tap Keep quiet |  |  | This text was easy: he will tell whatever I say. I keep quiet, it is free. |
| 330.0 | tap I’m stopping |  |  | I would stop here. Game finished. |
| 338.8 | stop | FINISHED | After three nights | Game ended: The help reached them. Clear and kind. This time I knew where to stand and the You label helped. Walking home is still too slow for me; each tap costs me about 3 seconds and dawn catches me. I pressed I am stopping, then Cancel. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.9 | shot |  | Evening 1 | Same game on my other device. Same long first paragraph; I skip the lantern sentence now. |
| 40.0 | first_minute |  | Night 1, 44s | Faster with keys. Tariq stops me again; I now read the three costs first. I choose Explain this time, to see what happens on the next evening. |
| 96.3 | wait |  |  | The envelope is left. I cannot get home in 7 seconds; I wait. "Collection · 3s" looks like a button but I think it is a timer. |
| 100.4 | want_quit | CONFUSED | Morning 1 | I reread "Dawn came before you reached home. Tonight's envelope stays with the household." The envelope reached Samira, so what stays with the household? It is the second sentence I reread this visit (first was Tariq guess). I want to quit for a moment, but the result lines are clear, so I continue. |
| 144.9 | tap Keep quiet |  |  | Danyal saw my envelope though I have not left it yet; I still find that odd, but the costs are written down so I choose Keep quiet. |
| 210.2 | pulse 3 |  | Morning 2 | Two nights delivered out of two. Marker, You label and the steps-from-well line make the walk understandable. Dawn still catches me at home, but it does not seem to matter for the result. Tapping home is the slow part (each key ~3s for me, may be the tool). |
| 232.7 | tap Their door · farther, Samira knows it was you |  |  | For the last night I try the door, to see it. |
| 344.3 | tap After three nights |  |  | I reached the door a moment after dawn. "You were at the door but did not leave it" is clear and a little cruel. The door route is much farther; my fault for choosing it, perhaps also slow tool. |
| 360.0 | tap I’m stopping |  |  | I stop here; I know how it ends. |
| 366.4 | stop | FINISHED | After three nights | Three nights finished on my second device. Ending read clearly. I would play once more another evening, but not leave it running. I pressed I am stopping, then Cancel. |


### Jonas Berg

**Would you return voluntarily?** Yes, for one more desktop evening: I'd want to see whether an early Explain, or a favour I owe, changes what the later well nights cost me. I would not leave it running, and I would not come back on the phone unless input responds at human speed (I think the tool caused that, but I can't prove it).

**Ranked asks:**
1. Stop an interception being the same few steps from home on every night. Danyal or Tariq stopped me within about four steps on 5 of 6 nights, whichever route and lantern setting I used. I want the route and lantern to change who stops me, and when.
2. Show who is near before I commit. Let me see which neighbour's lamp patch I am walking into, so a stop feels like a consequence of my route and not a fixed event.
3. Tell me up front how long the night is and which choices shorten it. The shorter night after a rescue showed up only in the evening text, and the dawn-vs-collection timing only appeared after I had left the envelope.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.1 | shot |  | Evening 1 | Retest. Same table opening, now an explicit warning that any light incl neighbour lantern lets them see me. Door first this time to avoid Danyal. |
| 40.3 | TOOL tap |  |  | There is now a You label on the map. That answers my old ask. Taking the door. |
| 56.4 | shot |  |  | Tariq stopped me after about 3 steps. My arrow presses did nothing; the clock now reads frozen at 22s. |
| 68.2 | tap Ask him not to tell |  |  | Now the prompt says the dawn clock waits and lists costs. Better than before. A third option exists: Ask him not to tell, 1s, works once. Testing it. |
| 99.2 | shot |  |  | Dawn came before I reached the door. Each key press seems to cost about 1.5 game seconds, and the stop with Tariq plus the 1s chat ate the night. The report now says plainly that I did not leave the envelope. |
| 102.2 | first_minute |  | Morning 1 | Logged late. In the first minute I picked the door, got stopped by Tariq (not Danyal) after 3 steps, and chose Ask him not to tell. Failed the night, but the morning says exactly why: 3 steps from the door. That explains itself, which I asked for. |
| 143.3 | TOOL tap |  |  | Evening 2. Door again, but this time I hide the lantern at once to see whether Tariq still stops me. |
| 153.6 | shot |  |  | Danyal stopped me after 4 steps with my lantern hidden, same as before. Hidden lantern does not stop interception, as far as I can tell. |
| 159.5 | tap Keep quiet |  |  | Keeping quiet; the clock was frozen while I decide, good. My dark-lantern walk puts me inside Danyal and Tariq lamp patches, I suppose that is why. |
| 176.7 | shot |  |  | Enter said I must stand on a highlighted tile, not corner to corner. Clear message, but it cost me a try. |
| 187.8 | pulse 3 |  | Morning 2 | Two failed nights, both by 1 to 3 steps. The game tells me exactly how far I was, which helps, but I cannot tell if I am slow or the night is tight. Moves cost about 1.5 game seconds each at my speed. |
| 197.7 | tap Well box · closer, Danyal must collect it before dawn |  |  | Evening 3. Two door failures; switching to the closer well box, lantern lit, moving straight. |
| 214.7 | shot |  |  | Tariq stops me within 4 steps again. It looks like some neighbour always stops me about four steps from home. |
| 220.6 | tap Explain |  |  | The promise from night 1 shows up here: he tells people whatever I say. That is a consequence I can trace. Time is plentiful (56s), so I will pay 3s to Explain and see whether well collection gets quicker. |
| 244.9 | TOOL note |  | Night 3 | Leaving at the well box now shows: Danyal collects in 3 s, dawn in 34, must be collected before dawn. That is the warning I asked for last time. |
| 263.3 | note |  | Night 3 | Leaving at the well box shows Danyal collects in 3 s, dawn in 34, must be collected before dawn. That is the warning I asked for last time. |
| 266.2 | pulse 4 |  | Morning 3 | The morning now ties together my night-1 favour (ask Tariq to stay quiet), my being out again, and him telling people. That is a causal chain I can trace and plan around. Still: someone always stops me about four steps from home. |
| 272.2 | want_quit | FINISHED |  | Game ended at about 4.5 min. There is a Play again button. I want to retest with the knowledge that door nights are 30s and well nights are 60s (guess) but a second desktop run is not required. |
| 290.9 | stop | FINISHED |  | Stopped after about 4.7 min because the game ended. Feedback offered I am stopping and I am confused; I tapped I am stopping, typed nothing, sent nothing. I would play once more mostly to test whether an early Explain changes the well nights. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.7 | shot |  |  | Phone, second visit the same evening. Taking the well box with the lantern lit this time, since the desktop run taught me to expect someone to stop me. |
| 27.6 | tap Move north |  |  | Using the on-screen pad by tap. |
| 34.4 | tap Move north |  |  | Using the on-screen pad by tap. |
| 41.1 | tap Move north |  |  | Using the on-screen pad by tap. |
| 52.2 | tap Keep quiet |  |  | Each tap on the phone costs about 6 to 7 real seconds, so about 6 game seconds each; the desktop key costs about 1.5. I suspect the driver, but I cannot be sure. Danyal stopped me after 3 steps. |
| 80.2 | first_minute |  | Night 1 | Logged late. On the phone I left the envelope at the well box; the game warns that Danyal collects in 2 s with dawn in 12. Each step costs me about 3 real seconds through this tool, so I will not get home. That looks like latency, not design, but I cannot prove it. |
| 126.8 | pulse 3 |  | Morning 1 | The envelope counted although dawn caught me before home, and the morning says so: Tonights envelope stays with the household. That answers my last visit question about missing home. Engagement held back only by my slow input. |
| 141.3 | tap Their door · farther, Samira knows it was you |  |  | Evening 2 on phone: trying the door with a hidden lantern from the start. |
| 177.0 | tap Keep quiet |  |  | Tariq stops me again within 4 steps, hidden lantern or not. Keeping quiet this time. |
| 224.4 | shot |  |  | The hidden lantern made the cold carry me home before the door. At least the morning says so. |
| 229.5 | pulse 4 |  | Morning 2 | The cold now has a stated price: a neighbour lost work, I owe it, later nights are shorter. A hidden lantern is a real decision now. Phone input is still slow, which is probably the tool. |
| 245.7 | tap Well box · closer, Danyal must collect it before dawn |  |  | Evening 3: well box with the lantern lit, nearer route because of the shorter night. |
| 303.0 | tap Ask him not to tell |  |  | Tariq again, on my first steps. Trying Ask him not to tell this time. |
| 362.1 | want_quit | FINISHED |  | Game ended on the phone at about 6 minutes: two of three envelopes counted. I do not need a replay on this device. |
| 381.4 | stop | FINISHED |  | Ended after about 6.4 min with a result page that fits my choices. I tapped I am stopping, typed nothing, sent nothing. Phone latency remained the main drag, which I suspect is the tool. |


### Aisha Rahman

**Would you return voluntarily?** I would come back another evening to try the quiet route again, but only if the ending kept telling me which nights my help reached them. I would not leave it running, and I would not return tonight.

**Ranked asks:**
1. Make morning reports respond to repeated failures. Phone mornings 1 and 2 had identical neighbour lines, and "You were 1 steps from the door" needs fixing.
2. Fix "Tonight's envelope stays with the household". It appears on mornings after a delivery, and it reads as if the envelope was not delivered.
3. Tell me before a key press is lost. A key into a house wall gave no hint on desktop. Tariq's and Danyal's questions swallow keys, and nothing says so when I press one.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.2 | shot |  |  | Same start. The text now explains lantern, cold and being carried home before I choose. Better. |
| 11.5 | tap Well box · closer, Danyal must collect it before dawn |  |  | Well box again, the gentler one. |
| 15.4 | shot |  |  | There is now a You label above my figure at Home. The map shows the well straight north. |
| 31.0 | shot |  |  | Tariq asks again. My arrow keys did nothing for a few presses while his question is open; at least the clock says 49 and holds. |
| 36.8 | tap Ask him not to tell |  |  | The costs are spelled out now. I will try asking him not to tell, which I do not remember being offered. |
| 66.7 | shot |  |  | The green outlined tiles around the well box look like where delivery counts. I overshot north by one, corrected. |
| 105.7 | first_minute |  | Morning 1 | I can see which figure is me now (a You label), and the green tiles near the well show where delivery counts. The morning names what I did: lantern lit, Tariq saw me, I asked him not to tell. I was a tile too far north at first, but could fix it. Dawn caught me before I got home, and that is stated plainly. |
| 118.8 | tap Their door · farther, Samira knows it was you |  |  | Night 2, I try the door this time; I want Samira to know someone cares, and I will hide my lantern. |
| 166.2 | shot |  |  | I walked into a house wall and lost several key presses without any message. I think the lane I took was blocked; I only saw it in the picture. |
| 172.3 | tap Keep quiet |  |  | The clock held while Danyal asked, and the text said so. Keep quiet. |
| 185.2 | shot |  |  | Dawn came before I could reach the door. I was too slow, not misled. |
| 188.2 | pulse 4 |  | Morning 2 | Morning 2 is different from morning 1 and describes my night: set out for the door, Danyal saw me, cold forced me to shelter, a neighbour carried me home and I owe work. I am engaged. I still lost a lot of key presses against a house wall without a hint. |
| 214.8 | tap Explain |  |  | Third night, I explain to Danyal. He is the one who collects it, so I would rather he know the need and be careful. |
| 254.4 | tap Return home |  |  | A Return home button appeared once the envelope was delivered. I will press it. |
| 320.6 | stop | FINISHED | After three nights | Stopping here: I reached the ending (help reached them on nights 1 and 3). This time I could see which figure was me and the mornings answered what I did. The ending names which nights helped. I would try the quiet route once more some other evening. I opened I am stopping; a note box appeared and I typed nothing and sent nothing. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.7 | shot |  |  | Second visit on my phone. Looking at how the first screen fits. |
| 12.9 | shot |  |  | On the phone the map, You label and arrows: checking whether it all fits. |
| 53.6 | shot |  |  | I pressed seven keys while Tariq question was open and nothing moved; the clock stayed at 47, so I lost no time, but I did not notice the question had appeared. |
| 64.2 | tap Keep quiet |  |  | Keep quiet on the phone, the buttons are large enough to touch. |
| 112.1 | TOOL tap |  |  | The game told me corner to corner does not count and to step onto a highlighted tile. That answers my old question about where beside the marker is. |
| 116.5 | first_minute |  | Morning 1 | On the phone the map, You label and arrows fit one screen. I reached the well and ran out of dawn, mostly my slow taps and keys. The morning now matches what happened (no envelope, Tariq guessing). Tariq line no longer claims an envelope was delivered. |
| 131.1 | tap Their door · farther, Samira knows it was you |  |  | Evening 2, the door on the phone. I will hide my lantern. |
| 254.2 | pulse 3 |  | Morning 2 | Morning 2 on the phone reads almost the same as morning 1: Idris, Samira, Danyal and Tariq repeat their lines word for word. It says I was 1 steps from the door, which reads oddly. The game does count how close I got, which I like, but the neighbours did not react to a second failure. |
| 331.6 | tap Keep quiet |  |  | Danyal now stops me on the phone too. Nothing moves while he asks, and I should have looked before pressing. |
| 411.2 | stop | FINISHED | After three nights | Stopping on the phone: ending reached, help reached them only on night 3. The ending says it plainly and names the nights. I opened I am stopping; a note box appeared and I typed nothing and sent nothing. |


### Diego Silva

**Would you return voluntarily?** Maybe, another evening, on desktop only, and only if the three conditions below hold. Last time I set three conditions; one is met now, one is partly met and one is not. This time:
- The game must keep telling me why a delivery failed, and how far I was. It does now.
- Arrow input must be dependable on a phone. It was not tonight.
- There must be something new after the three nights, because a replay opened identically. Nothing new has appeared yet.

I would not leave it running. I would come back another evening, but only for a new situation, not a third run of the same village.

**Ranked asks**
1. On the phone, make the arrow pad reliable and keep it on screen. Six coordinate taps on the pad did nothing twice. On night 2 the pad was below the visible screen, so my coordinate taps may have hit other buttons. I cannot tell how much of this is my tool.
2. Show when I am blocked. On desktop night 2 I pressed Up 8 times against the back of a house and nothing signalled I was not moving.
3. Give a reason to replay. "Play again" opens on the same evening-1 text, and the ending is still a short summary.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 10.3 | tap Well box · closer, Danyal must collect it before dawn |  |  | Closer one, well box, I know it from last time. The cold and who sees me is now stated up front, nice. |
| 29.2 | tap Ask him not to tell |  |  | New: each answer now says what it costs, and there is a third option. I take the cheap one-second ask. |
| 29.5 | first_minute |  | Night 1, 45s to dawn | Well box chosen; I can find myself with the You label now. Tariq stopped me again but the answers spell out their costs. Clear and responsive so far. |
| 59.2 | tap Leave envelope |  |  | I am inside the green outline next to the well box. That outline answers my old question of which cell counts. |
| 63.5 | key Enter |  |  | Enter said deliver or return home; trying it. |
| 75.0 | tap Return home |  |  | Delivered. There is a Return home button; I will press it rather than walk. |
| 82.8 | note |  | Morning 1 | Delivered, and the morning accounts say exactly who did what, including Tariq keeping his word. I did not get home by dawn and that is stated plainly. But I could not tell what Return home did: the button did not carry me home. Also unclear what "stays with the household" means for me. |
| 91.5 | tap Their door · farther, Samira knows it was you |  |  | Night 2: door this time, with lantern hidden, to try the risky line. |
| 139.4 | key l |  |  | Wasted eight arrow presses: I walked into the back of a house and did not move. The map shows a wall but nothing told me I was blocked. The cold warning is loud and clear now; lighting the lantern. |
| 155.5 | pulse 4 |  | Morning 2 | The morning says plainly what failed: I set out, did not leave the envelope, the cold made me seek shelter, a neighbour lost work, I owe it and later nights are shorter. That is the explanation I wanted last time. I do feel it was partly my fault for walking into a wall, which is fair but nobody told me. |
| 183.1 | tap Keep quiet |  |  | Tariq remembers my night-1 favour and says the ask is used up; the choice shrank to two. That is a visible memory. Keeping quiet saves time. |
| 238.2 | pulse 5 |  | Morning 3 | This is the good part. The favour I spent on night 1 came back: Tariq says twice is too many and told people, and Idris and Samira each react in their own voice. My choice in night 1 changed night 3. That is learnable risk. |
| 246.3 | tap Play again |  |  | Ending matches what I did. Short again, but it reads as consequences. I will replay once to see whether the village is the same. |
| 253.1 | want_quit | FINISHED |  | Three nights done and the replay opens identical. I have seen both routes now. Nothing new waits that I can see. |
| 255.8 | tap I’m stopping |  |  | Choosing I am stopping in Feedback; typing nothing. |
| 258.1 | stop | FINISHED |  | Stopping on desktop. This time the game told me why things failed, and an earlier choice came back three nights later. I got stuck on a wall once with no signal. I opened Feedback, chose I am stopping, typed nothing, no Send. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.0 | tap Well box · closer, Danyal must collect it before dawn |  |  | Second device, same evening. Well box again, since that is where it went wrong on the phone last time. |
| 56.9 | tap Keep quiet |  |  | Danyal stops me; each option now spells out cost. Keeping quiet. |
| 87.2 | tap Move north |  |  | Six coordinate taps on the arrow pad did nothing visible; my figure did not move. Trying the named control. |
| 104.6 | note |  | Morning 1 | This is what I asked for last time: it says the dawn came before I left the envelope and that I was 6 steps from the well. That is the cause and the distance. I think the six coordinate taps on the pad did not register, but I cannot tell whether that is the tool or the game. |
| 104.6 | first_minute |  | Night 1 | On the phone the map and arrow pad fit; Danyal stopped me and the answers spell out costs. Coordinate taps on the arrows looked dead, named taps worked but slowly (about 7 to 13 s of dawn each). |
| 153.3 | scroll |  |  | On night 2 the page is laid out differently: the long text pushes the map up and the arrow pad is below the visible screen. My earlier coordinate taps probably hit other buttons (my lantern is now hidden by accident). I have to scroll to find the pad. |
| 209.9 | TOOL tap |  |  | Six coordinate taps on the pad again did nothing, even with a still page. Named tap is the only thing that moves me, and it costs 7 to 13 s of dawn. |
| 222.1 | want_quit | CONFUSED |  | Night 2 failed again on the phone and the morning says I was 10 steps from the well. I know why, which is better than last time, but my arrow taps did nothing and the dawn clock kept running. I suspect the tool, not the game, but I cannot tell. I am leaving. |
| 242.4 | stop | CONFUSED |  | Stopping on the phone. The game now says why and how far, which I wanted. But my pad taps did nothing and each action lagged the dawn clock, so two nights were lost to something I cannot name as game or tool. I opened Feedback, chose I am confused, typed nothing, no Send. |


### Mei Tan

Would I return voluntarily? Yes, on my laptop on another evening, to try the door with a faster hand. I would not come back on the phone while walking is one tap per tile. I would not leave it running, because the nights need my decisions.

**Ranked asks**
1. Make the walk possible by touch. Hold-to-walk, or tap a place and Yusuf goes there. I tapped the well box on the map and nothing happened.
2. Keep the "you were N steps from the door/well" line, and add why: it names the step count but not that the walk was too slow, or that Danyal's stop cost time.
3. On the phone, show what the stop-questions cost in time before I am already committed. Also make the "your hands are numb" warning stand out. I never hid my lantern this time, so I did not check that warning.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 36.9 | TOOL tap |  |  | Back on laptop. Trying the door with lantern lit, as I planned last time. |
| 73.9 | tap Keep quiet |  |  | Danyal saw the envelope even though lantern lit. Keeping quiet again. |
| 81.7 | first_minute |  | Night 1, 16 s to dawn | Dark theme, same layout as before. Walking by arrow keys. Danyal stopped me mid-way (not at the door); I kept quiet. I suspect I will not reach the door, about 7 rows to go with 16 s left. |
| 100.6 | pulse 4 |  | Morning 1 | Morning 1: report now says how far I got (5 steps from the door) and why nothing arrived. That answers what I asked last time. Missed because my driver is slow, probably. |
| 109.6 | tap Well box · closer, Danyal must collect it before dawn |  |  | Door was too far for my pace. Well box, straight there. |
| 132.5 | tap Explain |  |  | Danyal saw my envelope when I was only carrying it, again. Trying Explain this time to see what it does to the well. |
| 153.8 | pulse 4 |  | Night 2, 32 s | Night 2: envelope left at the well box with 32 s to spare. New: a Collection 3s countdown button and a line saying it must be collected before dawn to count. That is the countdown I asked for. |
| 191.0 | pulse 4 |  | Morning 2 | Morning 2 now reacts to my choices: it names that I explained and Samira trusts me less. Last time the lines repeated. Also I did not get home before dawn, and it says so plainly. |
| 196.6 | tap Well box · closer, Danyal must collect it before dawn |  |  | Last night: well box again, keep quiet if Danyal stops me. |
| 220.2 | tap Ask him not to tell |  |  | A third option I do not remember: ask him not to tell, 1 second, once only. Trying it. |
| 301.2 | stop | FINISHED | After three nights | The game ended after three nights, two delivered, with a specific summary. I chose I am stopping in the menu and typed nothing. I would play again another evening to try the door with a faster hand. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 11.0 | tap Well box · closer, Danyal must collect it before dawn |  |  | Phone. Well box, since the door was too far to walk by touch last time. |
| 20.1 | tap |  |  | Trying to tap the well box on the map to see whether Yusuf walks there. |
| 28.8 | first_minute |  | Night 1, 51 s | Phone: scene fits on one screen. I tapped the well box on the map hoping Yusuf would walk there; nothing happened, he stayed home. So walking is still one arrow tap per tile. 51 s to dawn and I am still at home. |
| 110.3 | pulse 3 |  | Morning 1 | Morning 1: nothing reached them, and the report now says I was 5 steps from the well. That is the reason I asked for. But the walk is still one tap per tile; tapping the map did nothing. I suspect my tool is slow (3 to 13 s per call) but I cannot say how much a thumb would help. |
| 125.5 | tap Well box · closer, Danyal must collect it before dawn |  |  | Well box again, straight to it this time. |
| 212.7 | want_quit | FRUSTRATED | Morning 2 | Two nights lost on the phone because of tile-by-tile tapping. Each of my taps takes 7-9 s through the tool, so partly my tool, but I still see no way to walk except tapping every tile. |
| 235.5 | tap Well box · closer, Danyal must collect it before dawn |  |  | Last night. Same plan, no looking around. |
| 386.5 | stop | FINISHED | After three nights | The game ended: no help reached them on any night. I chose I am stopping and typed nothing. On the phone I never got an envelope delivered; walking is still tile by tile and I do not want to try again that way. |


### Samir Haddad

**Would you return voluntarily?** I might come back another evening on desktop, to try the not-tell route and the door route on different nights and see what Samira, Idris and Tariq say. I would not leave it running. I would not come back on the phone if each arrow tap keeps costing about 7 real seconds for me.

**Ranked asks**
1. Make phone walking cost less real time, or give more dawn seconds on the phone. I could not finish a night on the phone in any of three tries. I suspect my driver (about 6.5 s per tap).
2. Make "Return home" say something when I am far from home. It still does nothing visible. The Explain and Keep quiet panel could also show how many steps remain to the door or well.
3. Keep the Morning 3 lines different from Morning 1 even when my choices repeat. On the phone, Morning 3 repeated Morning 1 almost word for word, because I did the same thing both times.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.7 | shot |  | Evening 1 | Now the table text warns that an empty warmth bar means a neighbour carries me home. That was my last ask. Recording notice is visible. |
| 41.4 | TOOL tap |  |  | This time I try the door, to see whether Samira really knows. |
| 55.1 | first_minute |  | Night 1, 23s | New: Tariq now offers a third choice, ask him not to tell. The cold warning came before night one. The clock still waits for my answer. Engagement good. |
| 62.6 | tap Ask him not to tell |  |  | A discreet middle option, costs 1 second, only once. I take it. |
| 92.0 | note |  | Morning 1 | Morning 1: dawn came 4 steps from the door; it now tells me how many steps short I was. Good. Tariq line differs because I asked him not to tell. Probably my slow keys. Next evening, I will go quicker, door again. |
| 117.3 | tap Keep quiet |  |  | The promise is used up and the panel says he will tell people regardless. Consistent with what he said. Keeping quiet. |
| 148.3 | tap Return home |  |  | Trying Return home from far away, as I did last time, to see if it says something now. |
| 178.6 | pulse 5 |  | Morning 2 | Morning 2 followed from what I did: I asked Tariq not to tell, then went out again, and Idris, Samira and Tariq all name that broken promise. That feels earned, and the accounts differ from before. Return home from far still did nothing visible. |
| 184.7 | tap Their door · farther, Samira knows it was you |  |  | Last night: the door, since Samira wanted to meet Danyal alone. |
| 196.6 | shot |  |  | New: Danyal stops me this time, not Tariq. |
| 201.8 | tap Keep quiet |  |  | Danyal only tells what he saw; keeping quiet. |
| 259.5 | note |  | Morning 3 | Morning 3 fits the door choice: Samira says she knows it was me and only her household knows. That was my second ask and it is met here. The lines differ from Morning 1. Dawn came just before I got in again, probably my slow keys. |
| 282.6 | stop | FINISHED | After three nights | Finished the three nights, the ending named what each person felt and matched what I did. I opened Feedback and chose I am stopping; typed nothing and did not send. I would come back another evening to try the not-tell route with the door every night. Not leave it running. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.7 | shot |  |  | Phone, same evening. Starting a new game. |
| 15.7 | tap Well box · closer, Danyal must collect it before dawn |  |  | Phone: well box, since taps are slow for me. |
| 49.7 | note |  |  | Each arrow tap still costs me about 6.5 real seconds through the driver, and the game clock drops with it; I cannot tell if that is the driver or the game. All four arrows and the map are on one screen now. |
| 60.5 | first_minute |  |  | Danyal stops me on the phone too. The question panel fits on screen with the map. Taps are still slow for me; near dawn. |
| 105.0 | note |  | Morning 1 | Morning 1 tells me I was 3 steps from the well. That helps; I can see I was just slow. Trying night 2 with the same route. |
| 158.7 | tap Explain |  |  | This time I deliberately choose Explain, to see the faster well collection. |
| 208.7 | pulse 3 |  | Morning 2 | Explain showed up in the morning accounts (Danyal and Tariq), which is a visible consequence even though I failed to deliver. My slow phone taps keep ending nights, I suspect the driver. |
| 323.8 | want_quit | FRUSTRATED | Night 3 | Third phone night lost again: I need about 8 taps, each costing me roughly 7 real seconds, and the clock runs with them. I suspect my driver, but from my seat I cannot finish a night on the phone. The layout itself is better now. |
| 360.5 | stop | FRUSTRATED | After three nights | Stopping on the phone: three nights, no envelope delivered, ending says the household needs more help. Fair verdict. I opened Feedback and chose I am confused, typed nothing, sent nothing. On a real thumb it may be fine, but from my seat I cannot finish a night here. |


### Tessa Williams

**I would not come back to this on my own tonight; I might try it once more another evening if a friend sent me the link and I could do something properly daft with Tariq or pick when to show my lantern. I would not leave it running.**

**Ranked asks:**
1. Let me say something of my own to Tariq, a joke or a lie. "Ask him not to tell" is better than before, but it is still a menu of set lines.
2. Make the walk forgiving. I was still 5, 2 and 10 steps short of the door, and the night's length changed between nights without explanation.
3. Make the first night's cold a risk I can see before the shaking warning.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.2 | shot |  |  | Same opening. I will try the door again and see what changed. |
| 39.1 | TOOL tap |  |  | Door again, riskier one. |
| 42.5 | shot |  |  | The tap reported a timeout error but the night started; clock already running. |
| 72.3 | first_minute |  | Night 1, 11 s to dawn | Walk is still a timed run. This time Danyal stopped me, not Tariq. Still only Explain or Keep quiet, no joke option. The cost of each is spelled out now, which helps. |
| 75.2 | tap Keep quiet |  |  | Keeping quiet, nothing about the family gets out. |
| 93.1 | note |  |  | Missed the door by 10 steps. Each neighbour says something different in the morning, still good. Going to the well box next, closer. |
| 102.5 | tap Well box · closer, Danyal must collect it before dawn |  |  | Well box, and I will hide my lantern this time to see how the cold shows up. |
| 125.2 | tap Ask him not to tell |  |  | A third option now, Ask him not to tell. Not a joke, but it is a different thing to say. Trying it. |
| 159.4 | TOOL tap |  |  | Shaking warning plus an almost empty bar. At least the meter is visible, but it went from fine to empty fast. Lighting up. |
| 163.8 | pulse 3 |  | Morning 2 | Carried home again after hiding the lantern, no envelope. But Tariq answered my new option with his own line, and the cold had a visible bar and a Shaking warning. Better than before, still a trap-ish feeling. |
| 192.6 | tap Keep quiet |  |  | He remembers his promise was one-time. Nice, my earlier choice stuck. Only two options again because the favour is spent. |
| 223.3 | tap Move north |  |  | The game now tells me corner to corner does not count. That was my confusion last time. |
| 248.1 | tap After three nights |  |  | The neighbours now answer how I helped: Idris wanted to choose who knew, Samira wants to meet Danyal alone. That is the response to my way of helping I asked for. |
| 251.4 | want_quit | FINISHED |  | Ended on needs more help again, but the verdict now names what happened: one night, the rescue, Idris and Samira reactions. I got one envelope across in three nights again. I have seen the loop; I would want to try the lantern-lit door run once. |
| 264.2 | stop | FINISHED |  | I am stopping here. The ending finished fairly and said more about what I did. I got one envelope across again. Better than before but I have seen the loop and still cannot joke with Tariq. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.8 | shot |  |  | Second device, same evening. Starting fresh. This time I will try the door with the lantern hidden at first, to see the cold, since I know the well box is safer. |
| 26.9 | key l |  |  | Hiding the lantern right away on the desktop. |
| 67.0 | first_minute |  |  | Tariq stopped me early, clock paused. Night 1 gave me about 53 seconds this time. The phone started at 30, so the length might depend on something. |
| 109.4 | key l |  |  | Numb warning came with about 30 s left, and it was earlier than last time. Lighting. |
| 134.7 | pulse 3 |  | Morning 1 | 5 steps short of the door. Numb warning came with time to act this time. Morning lines reflect who saw me. Want another go at the door with the lantern lit. |
| 208.6 | tap Explain |  |  | Trying Explain this time to compare with the phone. |
| 277.4 | shot |  |  | Missed by a few seconds again, because the tiles I wasted on the paused Tariq prompt cost me nothing but my own slowness. Reading the morning. |
| 350.7 | shot |  |  | Tariq stops me at the same lane spot every night. Only the replies change. |
| 440.7 | want_quit | FINISHED |  | Ended on needs more help again. This ending names what each choice did: Explain made Idris and Samira react, asking Tariq kept his silence. I only got the one envelope across, but I can tell why. |
| 453.5 | stop | FINISHED |  | I am stopping here. Ending was fair and named my choices, but I cannot say a silly thing to Tariq and I have now seen the walk three nights on two devices. |


### Pavel Novak

**Would you return voluntarily?** Pavel: "Yes, once more on the desktop, another evening, because I came within one or two seconds of the well on three nights and I want to deliver one envelope. I would not leave it running, and I would not return on the phone while each tap takes seconds."

**Ranked asks**
1. Let a slow player reach the well. Show where the well is, or lengthen the night or the first stop. Every night I lost was by seconds (1 s, 2 s, "at the well but did not leave it").
2. Name the cause when a night is lost by seconds. The Morning 3 report does so on the phone ("Danyal needed 2 more seconds"). The desktop report only said "did not leave it".
3. End the story honestly when nothing arrives. The phone ending says "Their need stayed private. Idris keeps his dignity", which sits oddly beside "your help reached them on no night".

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 16.7 | tap Their door · farther, Samira knows it was you |  |  | The table now says up front that hidden lantern builds cold and an empty warmth bar means being carried home. That was my complaint. I take the door first this time. |
| 61.2 | shot |  |  | Danyal stopped me mid-walk and the clock sits still at 37 seconds. I get no choice yet? |
| 73.5 | tap Explain |  |  | Now the costs are written before I choose: 3 seconds, and what each does. Good. But he saw my envelope and I have not delivered yet; I am confused by that. I explain. |
| 120.5 | first_minute |  | Morning 1 | Real-time walk, slow with my slow keys; stopped by Danyal, clock waited and the cost of Explain (3 seconds) was shown first. Warmth bar now visible on the page. Dawn came 4 steps from the door; the morning report says so plainly. I understand now that he saw me carrying it, not leaving it. |
| 130.4 | tap Next evening |  |  | I was 4 steps short because Explain cost 3 seconds and my keys are slow. Fair, and the report tells me exactly that. This time I take the well. |
| 143.1 | tap Well box · closer, Danyal must collect it before dawn |  |  | The evening text tells me how last night changed the well: 6 seconds now. This is new to me and it is useful. |
| 179.7 | tap Keep quiet |  |  | Danyal again, early. Last time I explained and lost time; now I keep quiet to save seconds. |
| 275.1 | pulse 3 |  | Morning 2 | Two nights, no envelope. Both times I misjudged the walk and my slow keys; I walked past the well. The page was fair, but I lose by my own hand and I am not sure the pace is for a man of 70. |
| 307.1 | tap |  |  | Morning 2 report named my route, the well, and that I kept quiet, and Tariq changed his words. That meets my first ask. Last night: the well again, straight there. |
| 433.6 | tap After three nights |  |  | At the well but dawn took me while my Enter was in flight; I suspect my slow driver (5 seconds left, Enter took 7). The report says exactly where I stood. No envelope in three nights on desktop. |
| 467.7 | want_quit | FINISHED |  | Three nights over with no envelope delivered. The ending is fair and says why. I am not angry, but I lost by being slow and by misjudging the well twice. |
| 467.8 | stop | FINISHED |  | Finished three nights, delivered nothing. I pressed I am stopping, typed nothing, sent nothing. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 20.9 | tap Well box · closer, Danyal must collect it before dawn |  |  | Second visit, same evening, on my phone. The cold is explained before the walk now. I take the well, which I know is about 8 squares up and 3 left. |
| 182.9 | first_minute |  | Morning 1 | Phone: the map, bar and arrow pad fit on one screen now, which they did not last time. But the first tap took 16 seconds and each key about 5, so I could not make 11 steps in 60 seconds. I suspect my driver, not the game; I cannot prove it. |
| 340.9 | pulse 2 |  | Morning 2 | Two nights again lost on the phone because each key takes me about 5 seconds; the 60-second night needs 11 steps. I suspect my driver, but from my chair the game ends the night on me. |
| 376.2 | tap |  |  | One second short at the well last night, and the report says so exactly. Once more. |
| 510.8 | key Enter |  |  | Envelope left at the well with 1 second to spare; Danyal collected it. |
| 558.2 | want_quit | FINISHED |  | Three nights over. I came one second and then two seconds short on the phone; the report says it plainly. The ending text reads kindly, but I did not give them help; it is odd to be told their dignity was kept when nothing arrived. |
| 558.3 | stop | FINISHED |  | Finished three nights on the phone, no envelope arrived. I pressed I am stopping, typed nothing, sent nothing. |


### Leila Mansour

**Would you return voluntarily?** Yes, but only once more, and only if the walk to the door fits in the 60-second night at a normal thumb or keyboard speed, or the neighbour interruption stops landing in the same spot every night. I would not leave it running, because it needs my hands. I would come back another evening, not tonight.

**Ranked asks**
1. Make the night's walk reachable. I ended 10, 7, 4 and 4 steps short of the door. Ten steps was on the phone, seven and four on desktop. Tariq's interruption lands at the same place every night.
2. Say at the first lantern toggle that hiding the lantern slows you. It now says "you grow colder" and the morning says the cold forced me home, but nothing says it slows movement or how fast the warmth runs out.
3. Make the well-box route clearer as the easy choice, or say so. Its collection delay grows to 6 seconds on night 3, and the clock was still too tight with taps at about 10 driver seconds each.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 16.1 | tap Their door · farther, Samira knows it was you |  |  | Retest. Intro now mentions the warmth bar and being carried home. Taking the door this time. |
| 36.9 | tap Move north |  |  | My figure is labelled You now. That answers my first ask. |
| 60.2 | first_minute |  | Night 1, 21s to dawn | I know the job and which figure is me (You label). Each tap costs about 10 driver seconds, so half the night is gone; I suspect driver lag. Tariq interrupted again, clock waits. |
| 79.2 | tap Ask him not to tell |  |  | A third option I did not have before. One second, he keeps it to himself once. Trying it. |
| 118.3 | tap Next evening |  |  | Ten steps from the door: that line tells me how far I was. Good. Tariq kept quiet as asked. |
| 131.3 | tap Well box · closer, Danyal must collect it before dawn |  |  | Door is too far at my tap speed; trying the closer well box. |
| 198.9 | tap Keep quiet |  |  | The earlier promise now bites: he tells anyway. Clear cause and effect. Keeping quiet, saves time. |
| 212.7 | pulse 3 |  | Morning 2 | Two nights, two failures at about 10 driver seconds a tap; I suspect my latency, not just the game. The text is clear about why (steps from the door, promise running out) but I cannot get there in time. |
| 272.6 | tap Lantern lit · hide (L) |  |  | Testing the lantern hide to see what it says about cost. |
| 334.5 | tap After three nights |  |  | Hiding the lantern: the game now says I grow colder, and the morning says the cold forced me home. Still nothing about moving slowly, but the warmth bar and the cost are stated. |
| 336.8 | want_quit | FINISHED |  | Three nights, zero deliveries; ending text is precise. Mostly my tap speed, I suspect. I would not replay tonight. |
| 358.3 | stop | FINISHED | After three nights | Game ended. I chose I am stopping in Feedback, typed nothing, sent nothing. The marker and the step counts helped; my taps are too slow for the clock, I suspect the driver. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.4 | tap Their door · farther, Samira knows it was you |  |  | Desktop, second visit tonight. Door again. |
| 54.0 | first_minute |  | Night 1, 39s | Faster here, about 4-5s per key. You label is clear. Tariq stopped me early again at the same place; clock waits. I will keep quiet this time. |
| 128.1 | pulse 3 |  | Morning 1 | Seven steps short at dawn; each key about 4-5s of driver time, so I suspect I am slower than a human. Morning accounts are clear and differ from the phone run. |
| 228.1 | tap Explain |  |  | Trying Explain this time, to see what it costs and gives. |
| 305.4 | pulse 4 |  | Morning 2 | Four steps short this time; improvement is visible and the step count tells me. Close enough to want one more go. |
| 534.3 | want_quit | FRUSTRATED | After three nights | Four steps short of the door two nights running, zero deliveries. I suspect my key latency, but I cannot tell what a human would manage. Ending text is precise. |
| 550.3 | stop | FINISHED | After three nights | Game ended with zero deliveries. I chose I am stopping in Feedback, typed nothing, sent nothing. The player marker is fixed; I would try once more only if the walk were a little shorter or Tariq did not stop me at the same spot. |


### Greta Holm

1. **Would you return voluntarily?** No, not as things stand. I delivered nothing in six nights across two devices, and I cannot tell how much of that was my slow driver clicks and how much was the game. I would come back one more evening, not tonight, if the dawn clock gave a player acting at human speed a fair chance. I would not leave it running.

**Ranked asks:**
1. Make the real-time dawn clock fair to a player who needs more than about 4 seconds per step, or let me slow it. I never reached delivery in six nights.
2. Show the "stand on a highlighted tile, not corner to corner" rule before the night starts, not only after a failed delivery.
3. Fix "1 steps" in the morning report, and make it easier to see which tiles are highlighted on the phone.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 14.5 | tap Their door · farther, Samira knows it was you |  |  | Door again, to see what changed. |
| 34.5 | tap Lantern lit · hide (L) |  |  | Hiding lantern first this time, I remember that rule. |
| 60.3 | shot |  |  | Moving up; the clock seems to move with my steps again. |
| 62.6 | first_minute |  | Night 1, 26s to dawn | Tariq saw me even with the lantern hidden, after only 4 steps. Start text now says light can come from a neighbour lantern, which explains it, but I could not see his light reach me. |
| 76.4 | tap Ask him not to tell |  |  | New option. I try Ask him not to tell: cheap, and it says it works once. |
| 122.1 | shot |  |  | Dawn came before I arrived. The 1-second conversation plus my own slow keypresses used the clock. I suspect I was slow, not the game. |
| 135.6 | tap Next evening |  |  | The morning report now says I was 6 steps from the door. That is useful. Failure was my slow keys mostly. |
| 145.8 | tap Well box · closer, Danyal must collect it before dawn |  |  | Change one thing: the well box, closer. |
| 200.1 | tap Keep quiet |  |  | Danyal saw me carrying the envelope near the well. Keep quiet, nothing about the family gets out. |
| 260.5 | pulse 3 |  | Morning 2 | Two nights lost. I reached the well but did not leave the envelope; probably my key presses are slow (about 4s each against a 60s night), or I was not on a teal tile. The morning line at least says where I was. I cannot tell which. |
| 284.0 | tap Well box · closer, Danyal must collect it before dawn |  |  | Well box again, straight there this time, no talk. |
| 382.0 | TOOL tap |  |  | I am on the tile above the well box, inside the teal marks. |
| 396.5 | want_quit | CONFUSED |  | Morning says I was at the well but did not leave the envelope. I pressed Leave envelope while standing inside the teal marks and nothing happened. I cannot tell whether it was my slowness (3s left) or the tile. |
| 448.6 | stop | CONFUSED |  | Ending: household received no help on any night. I stop. I never delivered once; I could not tell if that was my slow keys or the delivery tile. Chose I am confused; did not type or send. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 7.0 | tap Well box · closer, Danyal must collect it before dawn |  |  | Phone: well box, it is the closer one. |
| 97.8 | first_minute |  | Night 1 | Phone: each tap costs me about 11 seconds, so I made 3 moves and the 60-second night ended. I suspect the driver is slow, not the game, but I cannot be sure. |
| 131.0 | tap Well box · closer, Danyal must collect it before dawn |  |  | Again the well box. I will try arrow keys on the phone to be quicker, though a real phone has none. |
| 269.4 | pulse 2 |  | Morning 2 | Second night lost, the same way: I reach the well with seconds left. My ops take 4 to 11 s each; a person would be faster, so I do not blame the game. Still, no one told me how many steps I need. |
| 397.7 | shot |  |  | Now the game says stand on a highlighted tile, not corner to corner. That is the rule I asked for, but it appears only when I fail. |
| 402.1 | want_quit | FRUSTRATED |  | One step short of the well on night 3, and the morning says 1 steps. I have no delivery in three nights. Part of this is my slow taps; I would stop here. |
| 465.2 | stop | FRUSTRATED |  | I am stopping. No delivery in three nights on the phone either; I was always a step or seconds short. Chose I am stopping; did not type or send. |


### Joseph Mwangi

**Would you return voluntarily?** Yes, I would come back another evening for another try, but only if I can reach the marker inside the 60 seconds. I never delivered an envelope in either session, and I would not leave it running by itself. On the phone I would return only if the walk were quicker.

**Ranked asks**
1. Let a slow walker win the first night. I lost all six nights across both sessions, and the clock moves about 2 to 2.5 seconds for each step I send. I suspect part of that is the driver's slowness, but a human with big fingers would feel the same. A few more seconds, or fewer squares to the door, would do it.
2. Tell me when a step is blocked. On the desktop I walked east into house walls and the figure just stopped, with no message at all.
3. Keep the "N steps from the well/door" morning line. It is the best fairness signal in the game. Add a short warning, such as "10 seconds left", while walking.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 14.2 | tap Well box · closer, Danyal must collect it before dawn |  |  | I remember this opening; I will take the closer well box first, as an old man would. |
| 64.1 | first_minute |  |  | I can now see a label saying You on the map, which helps. Each walking tap is slow; Tariq has stopped me with a question and the clock waits. |
| 80.2 | note |  |  | Three answers now, each with its cost in seconds. This is plain and I like it. I ask him not to tell. |
| 112.3 | note |  |  | Dawn came while I was 6 steps from the well. The morning text told me exactly that, which is fair. But each tap seems to take about ten seconds of the clock; I suspect the tool is slow, not the game. |
| 180.5 | tap Keep quiet |  |  | Danyal stopped me early this time. Keeping quiet costs nothing and says nothing about the family; I choose that. |
| 276.4 | pulse 3 |  |  | Two nights lost: I walk too slowly and overshot once. The morning text saying 4 steps from the well is helpful and fair, but I am a little frustrated with myself. |
| 327.9 | tap Keep quiet |  |  | Tariq says he will tell whatever I say, since I asked him once. Plain warning. I keep quiet. |
| 384.1 | want_quit | FRUSTRATED |  | Three nights and I never left an envelope on the phone; I was 2 steps away this time. I suspect much of it is how slowly my taps arrive, but I would feel like putting it down. |
| 426.2 | tap I’m stopping |  |  | Opening the stopping choice; I will not type or send. |
| 494.7 | stop | FINISHED |  | Three nights over, no help reached them. The ending says so plainly and says the village learned of their need, which stings. I understood why. I would try again, but the walking by tap is too slow for me here. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.9 | tap Their door · farther, Samira knows it was you |  |  | On my other device I will try the door, as I wished last time. |
| 76.7 | tap Keep quiet |  |  | Danyal saw me on the lane. I keep quiet; no seconds lost. |
| 76.7 | first_minute |  |  | The You label is on the map now and the opening still tells me plainly what each choice costs. Danyal stopped me early and the clock waited. |
| 159 | note |  |  | Six steps short of the door. The morning says so, which is useful. The map is clear. Trying again. |
| 330.9 | note |  |  | I walked east first and ran into the house walls; the figure just stopped and nothing told me it was a wall. That was my own mistake with the map, but a short message when I am blocked would help. 13 steps short, no one saw me. |
| 539.4 | want_quit | FRUSTRATED |  | I cannot reach the door within 60 seconds at my pace; I suspect the tool is slow, but as a person I would call it too hard in this way. |
| 576.2 | stop | FINISHED |  | Three nights over on desktop; 3 steps from the door at the end. Plain ending. I would try once more with the lane route. |


### Claude cold player

Feedback choices "I'm stopping" and "I'm confused" are offered in the Menu. I stopped at the ending and did not open them.

Yes, I would come back on my own to try the well and door routes again, as long as the watchers stop catching me two or three steps from Home, and I would return another evening rather than leave it running.

**Ranked asks**
1. Do not stop me for a conversation within 2–3 steps of Home. Tariq or Danyal did it on every outing in both sessions, even with my lantern hidden. This is the same ask as last time and still not met.
2. Give a little more slack for slow input. Several nights ended 2 to 5 steps short, and each stop costs 3 to 4 seconds of dawn clock. The driver's button taps took 10 to 25 s each, which I suspect cost me clock. Keys were fast.
3. Put "Stand beside the well" in the well route prompt. The marker exists now, but the prompt still says only "marked delivery tile".

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 59.3 | first_minute |  | night 1, 19 s to dawn | Map fits with controls on screen this time. The well now has a green ring of tiles around it. Tariq still stands beside Home. Each tap costs me about 10 s of dawn clock, and Danyal stopped me 3 steps out (again), though I am walking to his own well. |
| 226.3 | pulse 4 |  | morning 2 | Marked well ring worked: I stood on the green ring above the well and the envelope left. New Ask him not to tell option is clear. Morning 2 lines answer what I did. Tariq still stops me 3 steps out. |
| 379.9 | stop | FINISHED | ending | Ending: household needs more help, help only on night 2. Fair, matches my night 1 and 3 failures. The well works now. Done for this device. I never opened Feedback because I never felt confused or quit. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 88.5 | first_minute |  | night 1, 33 s to dawn | Desktop map fits, controls visible, green marker ring at the door. I hid the lantern with L and still Danyal stopped me after 3 steps with his own light. He is mid-lane, not near the door. |
| 362.5 | pulse 3 |  | morning 2 | Two nights lost: night 1 to the 3 s explain plus cold, night 2 to 5 steps short of the door after Tariq stopped me 2 steps out. Morning lines now say how many steps short I was, which helps. I suspect my slow tapping cost seconds; keys are quick but the Keep quiet tap took about 16 s real. |
| 583.1 | stop | FINISHED | ending | Ending: help reached them on no night. Fair given 3 steps/2 steps short, but 3 nights with zero delivery feels harsh and I suspect my slow tapping cost seconds. I would try again on another evening. |
