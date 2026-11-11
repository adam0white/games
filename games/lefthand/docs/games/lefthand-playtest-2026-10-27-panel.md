# The Left Hand lab-panel round, 2026-10-27

- **Build tested:** live https://lefthand.adamwhite.work at `6c34992` (`/release.json` `dirty:false`), opened with `?labRunSource=agent`.
  - `origin/main` has since moved to `dd97496`. That commit was not tested. This round says nothing about it.
  - The Deferred list and design doc were read at `dd97496`, a docs-only commit that put the earlier retest asks on the list.
- **Previous round:** the one-tester retest, `docs/games/lefthand-playtest-2026-10-27.md`. This is The Left Hand's first lab-panel round.
- **Testers:** 15.
  - 12 standing panel personas on a first visit: Maya, Emre, Nia, Rosa, Jonas, Aisha, Diego, Mei, Samir, Tessa, Pavel and Leila. Each read only its own diary from other games.
  - 2 cold testers on a first visit with an empty diary: Greta Holm and Joseph Mwangi.
  - 1 returning cold Claude player (`cold`), on its third visit. It read its two earlier reports, so it is not blind.
  - Each tester was a Claude persona agent.
- **Method:** the harness lab driver. Each tester played two fresh sessions, 360x690 phone and 1280x800 desktop, with light mode requested. The floor was 0, the ceiling 20 minutes, and testers stopped freely. Recording stayed on, and runs are labelled as agents.
- **This is a fictional lab panel.** It is not evidence about recruited players or a population.
- **Caveats:**
  - Emre's own-history.md was cut by the Read tool's line cap (607 of 876 lines loaded). Other standing histories may be cut the same way. Only Emre reported it.
  - Phone players reported 3 to 7 s per tap and 30 s locator timeouts. The measured driver time per tap is in the harness notes.
  - The page rendered dark although light mode was requested. This is confirmed in screenshots (for example `emre/desktop/a-004.png`). Whether the game offers a light theme at all is unknown.
  - Every report is the tester's final reply, saved by the coordinator, because the subagent's own file write was refused.
  - The Left Hand repo docs had no F-numbers. This round takes F-1621 to F-1638 from the one central F sequence (never reused; the highest in use before this round was F-1574, and Valley and Night Watch took F-1575 to F-1620). It gives the five asks from the previous retest the numbers F-1621 to F-1625, and new asks start at F-1626.

## Verdict: needs a fix cycle

A **new blocking ask** has no earlier F-number and is tied to the condition in a quit or mixed return sentence.

- Dispositions: 0 keep, 13 mixed (one of them TOOL), 2 quit.
- Tessa and Jonas quit. Neither quit was caused by the driver.
- Nia is marked TOOL because both of her stops rested on driver latency (desktop key median 2.9 s, against 0.5 to 1.3 s for most testers). Pavel's and Samir's phone stops also leaned on latency, but their desktop stops did not, so they are not marked TOOL.
- Six new blocking asks follow (F-1626 to F-1631). Each is tied to at least one return condition.
- Targets: F-1621, F-1623, F-1624 and F-1626 to F-1630 by 2026-11-03. F-1622, F-1625, F-1631 (design work) and F-1632 to F-1638 by 2026-11-10.

### New blocking asks

1. **F-1626. The player cannot tell which figure on the map is Yusuf.**
   - Aisha's return condition: "only if I could always tell which figure on the map is me".
   - Leila's return condition: "if the game showed me which figure on the map is me". Her correction at 341 s: "The lit figure is me and the ringed one is Danyal; I overshot the door going too far north both nights."
   - Jonas: "I identified my own dot by guessing, twice."
   - Rosa: "I cannot tell which dot is me. I guess the one at left."
   - Diego, Joseph and Nia said the same. The neighbours have name labels; Yusuf has none (seen in `emre/desktop/a-004.png`).
   - **Proposed fix:** label Yusuf "You" and give him a colour or outline that no neighbour uses.
2. **F-1627. Mornings and endings do not change with route or lantern.**
   - Maya's return condition: "if the neighbours' lines changed with what I did". Her note: "Morning 3 repeats Morning 2 almost word for word, though I switched from door to well and hid my lantern."
   - Aisha's return condition: "the mornings changed with what I did".
   - Emre's return condition: "only if the neighbours' reactions changed more from night to night". His note: "Door plus lit lantern and the well plus hidden lantern gave me the same report."
   - Pavel: "Morning 3 text is word for word the same as Morning 1, yet I went by the door this time, not the well."
   - Samir: "Samira says nobody knows, though the door choice said Samira knows it was me".
   - Maya: "I cannot tell why being seen at her door costs trust".
   - Confirmed by several testers: Explain and Keep quiet do change the mornings. Route and lantern do not, as far as testers saw.
   - **Proposed fix:** give each morning one line per person that names the route and whether Yusuf was seen. Make the door morning say that Samira knows. When trust drops, name the cause in the same line.
3. **F-1628. A failed delivery does not say why.**
   - Diego's return condition: "only if ... I can tell why a delivery failed". His stop: "my envelope did not land and I could not tell why".
   - Mei's return condition: "the morning report tells me what went wrong". Her note: "it does not say I was a second short."
   - Jonas: "Say why the envelope counted as undelivered when I left it one second before dawn".
   - Leila: "I did not know collection also had to finish before dawn."
   - Aisha: the ending said help reached them "on at least two nights", and "I could not tell which nights".
   - **Proposed fix:** name the cause in the morning ("Danyal needed 3 more seconds; dawn came first", or "You were not beside the well"). Show a collection countdown at the well before dawn. Name the nights in the ending.
4. **F-1629. The player cannot tell which tile counts as "beside" the marker.**
   - Greta's return condition: "only if the "beside the marker" rule were clearer". Her CONFUSED stop: "I could not tell which tile counts as beside the marker; I stood next to Samira and the game said stand beside the marked tile, and dawn came."
   - Cold: "On desktop I stood diagonally next to it and got "Stand beside the marked delivery tile". Directly below it worked."
   - Aisha: ""Stand beside the marked delivery tile" did not tell me which tile counts."
   - Emre: "I had to stand orthogonally beside the well (diagonal did not work)".
   - Tessa and Nia said the same.
   - This is a separate ask from F-1621. F-1621 asks to draw the well marker. F-1629 asks to show which tiles count, at the door and at the well.
   - **Proposed fix:** highlight the tiles that count when Yusuf is near the marker, and say "Stand directly next to the marker, not on a diagonal."
5. **F-1630. The cold cost is not visible until seconds before a rescue.**
   - Leila's return condition: "warned me that hiding the lantern slows me down". Her note: "Hiding costs movement. Learned by failing".
   - Tessa (quit): "I feel tricked by the cold, though it was explained at the start."
   - Pavel: "So hiding the lantern too long has a price I was not told in numbers."
   - Samir: "I did not understand that meant being carried home."
   - Joseph: ""You are shaking from cold" came with about 15 seconds left, and then I was carried home."
   - Mei: "the warning was a line among many and I was pressing keys fast."
   - Greta: "Tell me at the start of the night, before I move, that a lit lantern gets me seen and a hidden one costs warmth."
   - Assumed, not confirmed: Leila's claim that numb hands slow movement. Nothing in the jsonl shows it.
   - **Proposed fix:** show a cold bar under the map that fills while the lantern is hidden. Put the numb-hands warning beside the lantern button, not in the text line.
6. **F-1631. The neighbour's question offers only Explain or Keep quiet.**
   - Tessa (quit): "I might try it once more another evening if a friend sent me the link and I knew I could do something daft". Her first ask: "Let me joke, lie or say my own thing to Tariq instead of only "Explain" or "Keep quiet"."
   - Nia: "Give me one reply of my own at the neighbour's question, not just Explain or Keep quiet."
   - This rests on one quit sentence and one other ask.
   - **Proposed fix:** add a third reply per neighbour, such as a deflection that changes the subject, with its own morning consequence.

### Still open from earlier rounds

1. **F-1621. Draw the well delivery marker and say "Stand beside the well".** Not met.
   - Cold: "The door has a marker. The well still has none, and the text says "marked delivery tile"."
   - Rosa: "I see no marked tile at the well, only one at the door."
   - Seen this round too: the "Door · deliver beside marker" label stays on the map on a well night. Emre: "The map still labels the Door marker though I picked the well box". Maya and Greta said the same.
   - Rosa's return condition names it: "the game showed me where to stand".
2. **F-1622. Reduce stuck moves on the way to the door.** Partly met. Cold: "I did not get stuck on the houses east of Home." Joseph still could not step east on the door row: "I cannot tell why I do not move right; maybe a wall."
3. **F-1623. Start Tariq farther from Home, or show where he is looking.** Not met.
   - Cold: "He stopped me within about four steps in A night 1 and in B night 1 and night 3."
   - Jonas: "Danyal stopped me after about four steps on every night on the desktop run, whichever route and lantern setting I used."
   - Emre, Tessa, Samir, Maya and Leila also met the neighbour at the same spot each night.
   - Greta's return condition, "if a new run changes something I can see, such as a different neighbour or a different route", and Diego's, "there is something new after the three nights", lean on this.
4. **F-1624. The "Danyal" label over "Well", and the arrow buttons at the fold.** Partly met.
   - Cold: the Well label is "no longer overlapped by Danyal's name, but it is still tight".
   - The desktop arrow pad is still cut off at 800 px (cold, Nia, Tessa, Emre). Joseph: "The Explain and Keep quiet buttons sit below the screen edge".
   - Seen this round on the phone: the arrows move when the text line grows. Samir: "In `b-006.png` the arrow buttons had moved about 22 px down since `b-005.png`". Mei saw the same in b-005 and b-007, and cold in a-004.
5. **F-1625. Danyal says "I saw your envelope" when he is the collector.** Not met. Cold: "Danyal, who is the one meant to collect my envelope, stops me with I saw your envelope." Rosa and Maya were puzzled by the same line.

### Smaller asks

1. **F-1632. Walking by touch takes one tap per tile.** Mei: "Make the walk possible by touch: hold-to-walk, or tap a place and let Yusuf go there." Nia, Rosa, Joseph, Samir, Pavel and Emre asked the same.
   - Nia's return condition rests only on this ("Only if the walk gets easier"). Mei's and Rosa's conditions include it.
   - Timing complaint under ruling 5: unreproduced (driver latency of 0.1 to 34.6 s per phone tap seen in wall-clock op_ms; see harness notes). It is not routed as blocking.
2. **F-1633. While a neighbour's question is open, the arrows leave the page and arrow keys do nothing, without saying so.**
   - Jonas: "My keypresses were silently swallowed behind his prompt, no feedback." Aisha, Mei and Samir said the same.
   - Confirmed in the jsonl: 170 arrow taps were refused as "not on the page now". The next tap after 130 of them was Keep quiet or Explain, and after 36 of them Next evening. Key presses in the same state returned no error.
   - The dawn clock waits during the question, so no time is lost.
   - **Proposed fix:** keep the arrows visible but greyed, with "Answer first".
3. **F-1634. Return home does nothing until Yusuf is on the home tile.** Maya: "tapping it did nothing until I was on the exact home tile". Samir and Rosa said the same.
4. **F-1635. "Dawn came before you reached home" shows no consequence.** Emre: "Missing dawn on the phone cost nothing visible". Jonas, Samir and cold said the same. Pavel misread "Tonight's envelope stays with the household".
5. **F-1636. Copy that contradicts what happened.**
   - Aisha: "Tariq says "I saw Yusuf carrying an envelope" on mornings when no envelope was delivered".
   - Cold: a well route showed "Samira receives the envelope", which "reads oddly when Danyal collects".
   - Cold: evening 3 says "well collection now takes 3 seconds", but night 3 says it is "longer now".
6. **F-1637. Two long sentences are reread.** Rosa: "Outside, if any light reaches you (your lantern, a lamp or a neighbour's lantern), a nearby neighbour can see you." and "Tariq will repeat his guess that you are helping Idris and Samira." She also read the cost of Explain only after choosing.
7. **F-1638. Explain and Keep quiet are the same size, side by side.** Samir tapped the wrong one: "Two buttons side by side and I did not read my own tap."

### Met, in the testers' words

- The dawn clock waits during a neighbour's question. Aisha: "The clock stopping for Tariq was kind." Rosa: "The clock waits - good, I can read."
- Explain and Keep quiet have a visible price. Samir: "That is a real moral cost with no obvious right answer, which I like." Tessa: "Different act, different reply. That is what I want."
- Choices carry into later nights. Rosa: "The game remembered that I explained: the well now takes 6 seconds."
- The morning accounts. Greta: "Morning report is the best part: each neighbour tells only what they saw."
- The ending reads clearly. Diego: "The ending summary matched what I did, which I like."
- The lantern button reads as an action, and the door marker is drawn (cold, from the previous retest).
- The phone map and arrows fit on one screen at the start of a night (Aisha, Diego, Mei, Pavel, Rosa).

### Harness notes

- **Driver time per tap (ruling 5).** Measured op_ms for tap and key ops in `wall-clock.jsonl`:
  - Phone, 1,244 ops: minimum 0.1 s, median 1.6 s, 90th percentile 6.5 s, maximum 34.6 s. Per-tester medians run from 0.4 s (Maya) to 6.7 s (Samir).
  - Desktop, 1,708 ops: minimum 0.3 s, median 1.2 s, 90th percentile 2.9 s, maximum 33.9 s. Nia and Rosa had desktop medians near 3 s; Greta and Emre about 0.5 s.
  - Joseph (phone median 1.1 s) and Emre (1.5 s) completed phone nights. Nia (2.5 s, inside the 1 to 3 s band) missed the door by a few tiles. Nobody reproduced the walk at human speed, so F-1632 stays unreproduced.
- **30 s locator timeouts.** 20 `locator.evaluate` or `locator.isEnabled` timeouts of 30 s appear across both sizes, in 14 sessions (cold, Jonas, Nia, Pavel, Rosa, Tessa, Leila, Aisha, Diego, Mei, Samir, Emre, Greta). Testers report the game had advanced each time. Each cost up to 30 s of a 60 s night. Jonas's, Leila's, Nia's and Pavel's first nights were partly lost this way. TOOL.
- **Greta's lantern.** Her lantern tap at 85 s ended in a 30 s `locator.isEnabled` timeout, so the control was disabled by game state at that moment. Her "I lost the night to a button I could not press" is TOOL, unverified. Why the button was disabled is unknown.
- **Refused arrow taps (ruling 8).** All 170 "not on the page now" refusals on arrow buttons came from game state (an open question or a finished night), not from ambiguous names. No ambiguous-name refusal appears in any jsonl for this game. Joseph and Tessa also got "shown but disabled" replies on arrows, at the end of a night.
- **Light mode.** Light mode was requested, and screenshots are dark. The game's own theme may always be dark. Unverified.
- **Lab client.** Cold: "On the phone, Cancel on the note form did not close the menu." Unverified, and lab-client, not game.
- **Returner.** Cold knew the well tile from an earlier visit ("I guessed it right from last visit memory"). Its F-1621 and F-1629 evidence is not a first-visit result.

## Tester ledger

Disposition: keep is yes with no condition; mixed is yes or maybe with a condition; quit is a sentence that opens with no or not tonight. Session times are the driver's elapsed seconds at the stop line, not the player's own estimate.

| tester | commit | sessions (device, stop reason, driver time) | return sentence | disposition |
| --- | --- | --- | --- | --- |
| Maya Chen | 6c34992 | phone FINISHED at 237 s; desktop FINISHED at 162 s | Would you return voluntarily? Yes, once or twice more, if the neighbours' lines changed with what I did. I would not leave it running, and I would not come back for a fourth identical ending. | mixed |
| Emre Kaya | 6c34992 | desktop FINISHED at 338 s; phone FINISHED at 345 s | I would come back voluntarily for one more evening, but only if I could learn whether going to the door or the well box matters, and only if the neighbours' reactions changed more from night to night. I would not leave it running. On a phone I would come back only if the arrow buttons were easier to hit quickly. | mixed |
| Nia Okafor | 6c34992 | phone FRUSTRATED at 339 s; desktop FRUSTRATED at 223 s | Would I return voluntarily? Only if the walk gets easier. I would come back on another evening for one more try at a different route, but I would not leave it running. | mixed (TOOL) |
| Rosa Alvarez | 6c34992 | phone FINISHED at 351 s; desktop FINISHED at 329 s | Yes, but only on one condition: if walking to the well and back were quicker, and the game showed me where to stand. I would close it and not leave it running. I would come back another evening only on that same condition. | mixed |
| Jonas Berg | 6c34992 | desktop FINISHED at 266 s; phone FINISHED at 369 s | Not on this evening's terms. I would play it again another evening, but only for one reason: to see whether the door and the well box really lead anywhere different. The desktop run answered most of that in four minutes, and I would not leave it running. I would not come back on the phone unless the controls responded at human speed, and I can't tell whether the delay was the game or the driver. | quit |
| Aisha Rahman | 6c34992 | desktop FINISHED at 333 s; phone FINISHED at 372 s | I might come back another evening to try the other route, but only if I could always tell which figure on the map is me and the mornings changed with what I did. I would not leave it running, and I would not return tonight. | mixed |
| Diego Silva | 6c34992 | desktop FINISHED at 354 s; phone CONFUSED at 218 s | Maybe, another evening, but only if three things hold: I can tell why a delivery failed, I can't be tied up by questions I can't act on, and there is something new after the three nights. I would not leave it running. | mixed |
| Mei Tan | 6c34992 | desktop FINISHED at 356 s; phone FINISHED at 366 s | Would I return voluntarily? Yes, I would come back on another evening on my laptop, but only if the night's walk can be done without a keyboard and the morning report tells me what went wrong; I would not leave it running. I would not come back to it on my phone as it stands. | mixed |
| Samir Haddad | 6c34992 | desktop BORED at 415 s; phone FRUSTRATED at 308 s | I might come back another evening on desktop, to try the door every night and see what Samira says. I would not leave it running. I would not come back on the phone if each arrow tap keeps costing real seconds. | mixed |
| Tessa Williams | 6c34992 | phone FINISHED at 272 s; desktop FINISHED at 310 s | I would not come back to this on my own tonight. I might try it once more another evening if a friend sent me the link and I knew I could do something daft or choose when to show my lantern. | quit |
| Pavel Novak | 6c34992 | desktop FINISHED at 261 s; phone FRUSTRATED at 361 s | Pavel: "Yes, once more on the desktop, another evening, to try the other door and see whether a different route changes what Idris and Samira say. I would not leave it running, and I would not return on the phone while taps stall." | mixed |
| Leila Mansour | 6c34992 | phone FINISHED at 278 s; desktop FINISHED at 394 s | Would you return voluntarily? Yes, but only for one more try: if the game showed me which figure on the map is me and warned me that hiding the lantern slows me down. As it is, I would not leave it running, and tonight I am done. I might come back another evening to try the door route properly. | mixed |
| Greta Holm | 6c34992 | desktop FINISHED at 149 s; phone CONFUSED at 246 s | Would you return voluntarily: Yes, once, if a new run changes something I can see, such as a different neighbour or a different route. I would not leave it running. I would come back one more evening to try to beat the gossip, and only if the "beside the marker" rule were clearer. This is conditional, and the phone session made it weaker. | mixed |
| Joseph Mwangi | 6c34992 | phone FINISHED at 212 s; desktop FINISHED at 170 s | Yes, I would come back another evening, for one more night of choosing, but only if walking stays easy on the keyboard and the 60-second walk stays short. I would not leave it running by itself, and I would not play it on the phone again unless the buttons got bigger. | mixed |
| Claude cold player | 6c34992 | phone FINISHED at 275 s; desktop FINISHED at 182 s | Yes, I would come back on my own to see whether a third route changes what Samira, Idris and the village say about me. I would want a marker on the well delivery tile, and Danyal and Tariq kept off the doorway so a night is not decided in its first four steps. | mixed |

## Player words

Each tester's return answer and ranked asks are their report's own words. The diary rows are the raw driver diary (`wall-clock.jsonl`), every line that carried words, unedited. Coordinator paths are shortened.

### Maya Chen

**Would you return voluntarily? Yes, once or twice more, if the neighbours' lines changed with what I did. I would not leave it running, and I would not come back for a fourth identical ending.**

Ranked asks:
1. Make the morning and ending text react to what I actually did differently. Mornings 2 and 3 on the phone run 1 were nearly identical, though I switched from door to well and hid my lantern. All three endings were almost word for word the same.
2. Explain why trust moves. Samira said she trusted Yusuf less with her privacy after I delivered to her own door (phone run 2, desktop Morning 2). I could not tell the cause.
3. Make delivery clearer. The map label "Door · deliver beside marker" stays on screen even when I chose the well box. The Return home button does not work until I am on the exact tile where it becomes "Go inside".

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.1 | tap Well box · closer, Danyal collects later |  |  | Closer sounds safer; I do not know who Danyal is yet, guessing. |
| 17.6 | first_minute |  | Night 1, 52s until dawn | I am to leave an anonymous envelope for a family. I chose the well box because it sounded closer. I walked up and Danyal stopped me: he saw the envelope. The clock pauses for my reply, which is a relief. I like that he reacts to me; I do not yet know who Danyal is to me. |
| 18.4 | tap Explain |  |  | Trying the talk option first; I want to see who reacts. |
| 41.7 | tap Lantern lit · hide (L) |  |  | Hiding lantern to stay unseen on the way back, even if it gets colder. |
| 69.9 | tap Lantern hidden · light (L) |  |  | Numb hands, so I raise the lantern. The cold was a real cost for hiding. |
| 73.5 | pulse 4 |  | Morning 1 | Dawn came before I reached home, and everyone reacted by name: Samira trusts Yusuf less, Idris wanted to choose who knew. That is exactly what I like. I was slow with the movement and did not know the door marker was not my target; the label said Door while I chose the well. |
| 79.7 | tap Their door · farther, Samira knows it was you |  |  | Trying the door this time; Samira said she wanted to meet alone, so I want to see her reaction to being seen. |
| 90.8 | tap Keep quiet |  |  | Trying the other answer; I want to see whether Tariq remembers me being evasive. |
| 125.7 | note |  | Morning 2 | Everyone reacted differently to my keeping quiet. Samira says nobody knows, Danyal says nobody can say for sure. The cast remembers last night and talks about each other. I like this. Movement itself I find fiddly on the phone but fine. |
| 131.2 | tap Well box · closer, Danyal collects later |  |  | Last night door, so now the well, with the lantern hidden to see whether Tariq catches me. |
| 157.4 | note |  | Morning 3 | Morning 3 repeats Morning 2 almost word for word, though I switched from door to well and hid my lantern. I expected Samira or Danyal to notice that change. Mild letdown. |
| 164.6 | want_quit | FINISHED | After three nights | The game ended after three nights with a summary. Short, but it said what happened and who was left guessing. I would want to see another run to try another path. |
| 177.2 | tap Cancel |  |  | Chose I am stopping to see the form; I will not send. Curious to replay and try the explaining path. |
| 188.3 | tap Their door · farther, Samira knows it was you |  |  | Second run: door on night 1 to see how openness plays out, and I will Explain if stopped. |
| 196.6 | tap Explain |  |  | Tariq stops me at the same place as before, right outside my house. Explaining to him this time. |
| 232.2 | pulse 3 |  | Morning 1 run 2 | Second run, explained to Tariq and went to the door. Morning text for Idris and Samira reads like my first run Morning 1 and I wonder how much my explaining mattered. Still engaged but now comparing. |
| 236.7 | stop | FINISHED | Evening 2 run 2 | Stopping the phone after one full run and a replay start. In run 2 Samira said she trusted Yusuf less with her privacy even though I delivered at her door, and I cannot tell why. The first run felt good; the replay made me wonder how much my choices change. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 9.6 | first_minute |  | Night 1, 55s | Same game as my phone; the map is small in the middle of a wide screen but readable. Walking with arrow keys now. I remember the neighbours reacting last time, so I am curious if it is the same cast and lines. |
| 35.8 | key Enter |  |  | Trying Enter, which the help line says delivers. |
| 56.3 | pulse 4 |  | Morning 1 | Same lines as my phone Morning 1 despite a slightly different path; Tariq stopped me this time before Danyal did. The cast is consistent and I like the paragraphs. Keyboard is easier than phone buttons. |
| 59.9 | key l |  |  | Hide the lantern with L to see if Tariq still catches me. |
| 72.9 | tap Explain |  |  | Explaining this time. Even with my lantern hidden Tariq still catches me within three steps of home, so I do not see how hiding helps there. |
| 105.9 | note |  | Morning 2 | Morning 2: I delivered at Samira door and she says she trusts Yusuf less with her privacy. I cannot tell why being seen at her door costs trust; it feels odd. I like that the neighbours speak differently from each other. |
| 152.9 | want_quit | FINISHED | After three nights | The game ended again with a summary. Different path, similar summary shape. I understood it more quickly this time. |
| 162.1 | stop | FINISHED | After three nights | Done for tonight on desktop after one full run. Three endings across both devices were nearly identical, so I do not feel a strong pull to run it a fourth time, though it was a good ten minutes. |


### Emre Kaya

**Would you return voluntarily?** I would come back voluntarily for one more evening, but only if I could learn whether going to the door or the well box matters, and only if the neighbours' reactions changed more from night to night. I would not leave it running. On a phone I would come back only if the arrow buttons were easier to hit quickly.

**Ranked asks**
1. Show me how my choices and my slowness change the outcome. The two identical endings gave me the same morning text. Missing dawn on the phone cost nothing visible, and the cleanest ending came on the run where I was slowest.
2. Make movement quicker to do. On the phone each arrow tap is one step. Hold-to-move or bigger buttons would help. The well marker is also hard to find, and the map still says "Door" when I pick the well.
3. Let each night differ. Tariq stopped me at the same spot every night on desktop. The mornings repeated word for word.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 2.8 | shot |  |  | Practical: an envelope for Idris and Samira, two routes with a tradeoff. Door is farther but she knows it was me; well box is closer. Cold builds if I hide the lantern. |
| 6.9 | tap Well box · closer, Danyal collects later |  |  | I pick the well box: closer means less time in the cold, and I accept a middleman. Guessing Danyal is a risk. |
| 18.7 | tap Keep quiet |  |  | A neighbour guessed. Keeping quiet costs no time and the rule says it stays a guess. I choose that; the clock waits so I could read. |
| 30.9 | tap Leave envelope |  |  | The prompt says stand beside the marked tile, but on the map I cannot find the well marker; guessing and moving left. |
| 35.3 | tap Leave envelope |  |  | The map still labels the Door marker though I picked the well box; the well is the dark circle. I walk up next to it. |
| 52.8 | first_minute |  | Morning 1 | Goal: get an envelope to a needy family without being seen. I made a clear choice in 5s, walked the map with arrow keys, one neighbour conversation, delivered, went home. Morning report shows each person speaking. I understand the tradeoff (seen vs cold). Small friction: map still labelled Door when I chose well, and the well marker was hard to find. |
| 56.7 | tap Next evening |  |  | No cold or stock number was shown at all after the night. I do not know what hiding the lantern cost me or what Idris still needs. I go on. |
| 60.8 | tap Their door · farther, Samira knows it was you |  |  | Second night: I try the door to compare the tradeoff. I hide my lantern from the start this time. |
| 72.3 | tap Explain |  |  | Same Tariq again even with my lantern hidden. This time I explain, to see the difference; it costs 3 seconds of a 60 second night. |
| 97.6 | shot |  |  | Hands numb warning appeared after about 8 seconds hidden. That is the cold cost made visible, good. I am deciding whether to light the lantern near the neighbours. |
| 115.6 | note |  | Morning 2 | I can explain this setback: I hid the lantern all night and was too slow on the long walk, so I got rescued and owe work. Samira trusts me less because I told Tariq. I did not know hiding would drain me that fast, there was no meter, only text warnings. Fair but a bit sudden. |
| 120.7 | tap Well box · closer, Danyal collects later |  |  | 54 seconds because of exhaustion, explained. Well is closer so I take it, I will keep the lantern lit by default and hide only when I am next to neighbours. |
| 126.9 | tap Keep quiet |  |  | Tariq again, every night at the same spot. He is a fixed obstacle; I keep quiet, it costs nothing. |
| 152.9 | note |  | After three nights | Ending summary is clear: help reached them, but cost named, rescue, trust and village guess. I can explain every outcome. That was short: about 2.5 minutes for three nights. I want to know whether the door every night would have been different. |
| 163.5 | tap Play again |  |  | One short run only. I want to test whether going to the door every night with the lantern lit is cheaper than what I did. |
| 179.6 | pulse 3 |  | Night 1 (run 2) | Replay: same Tariq stop at the same place. The choices are real but the first loop is short and the second run feels the same so far. |
| 223.6 | tap Next evening |  |  | Identical morning text to the well run. Door plus lit lantern and the well plus hidden lantern gave me the same report. I cannot see what the choice changed yet. |
| 286.4 | tap Their door · farther, Samira knows it was you |  |  | Third night of the replay, the same door route. The morning lines are word for word the same so I am not learning anything from them. |
| 331.4 | want_quit | FINISHED | After three nights (run 2) | Both endings seen. The second ending says village is guessing and no rescue. The same Tariq beat every night; I do not feel a reason for a third run. |
| 338.0 | stop | FINISHED | After three nights | I am stopping after two short runs (about 5.5 minutes). I understood the tradeoff and saw consequences I could explain, but the second run felt the same and I have no new decision to test tonight. I would come back another evening only if the three nights could play out differently by who is outside; I would not leave it running. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.5 | shot |  |  | Second visit on my phone the same evening. Same choice screen as on desktop. |
| 8.2 | tap Their door · farther, Samira knows it was you |  |  | On the phone I try the door route. |
| 80.3 | first_minute |  | Night 1 phone | Phone: whole map and four arrow buttons fit on screen, readable. I understood the job fast. But each tap on an arrow is one step and I am slow with it, so the 60 second night is tight with touch; I suspect it is partly my tapping speed. |
| 109.3 | shot |  |  | Dawn came before I got home, with no stated penalty. On phone it is hard to be quick, but nothing happened to me, which makes the clock feel soft. |
| 115.1 | tap Well box · closer, Danyal collects later |  |  | The phone makes me choose the closer well box: fewer taps. |
| 214.8 | pulse 3 |  | Night 2 phone | On the phone it is the same loop, and my slow taps make me miss dawn. The screen fits and reads fine; tapping one arrow per step is the tedious part. Different neighbour event this time, so there is some variety. |
| 337.2 | note |  | After three nights phone | Ending: help reached them, talk faded, no rescue. This was the cleanest ending of my four nights-sets, and I got it by being slow and lucky with neighbours, which I cannot fully explain. Missing dawn twice cost me nothing visible. |
| 340.9 | tap I’m confused |  |  | I am not confused about the controls. I am unsure why this ending is better than the others. I open the I am confused choice just to check it exists; I type and send nothing. |
| 344.5 | stop | FINISHED | After three nights phone | I am stopping after one run on the phone, about 5.5 minutes. I finished it; the three nights are over and I understood each result. I would come back another evening if I could answer whether the door or the well matters, but I would not leave it running and on the phone I would prefer bigger arrow buttons or held movement. |


### Nia Okafor

Would I return voluntarily? Only if the walk gets easier. I would come back on another evening for one more try at a different route, but I would not leave it running.

Ranked asks:
1. Make walking forgiving on a phone, so the door route can be done at tap speed. Every tile costs one tap and the 60-second clock keeps running.
2. Show clearly where the delivery spot is and when I am beside it. "Stand beside the marked delivery tile" only appeared after a failed try.
3. Give me one reply of my own at the neighbour's question, not just Explain or Keep quiet.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.4 | shot |  |  | A letter to neighbours. Short opening, I can act at once. Rather like it. |
| 11.1 | tap Their door · farther, Samira knows it was you |  |  | Picking the door, the riskier one, to see what happens. |
| 47.1 | TOOL tap |  |  | Hiding the lantern, I want to be sneaky. |
| 57.2 | first_minute |  |  | I wanted to drop the envelope at Samira door. Delivery buttons look tappable. Real-time countdown: 60s to dawn, and the lantern tap seemed to take 33 seconds to return, so I lost half the night before moving. Cold is building and I cannot tell where I am. Not sure if my slowness or game. |
| 67.4 | shot |  |  | Failed night one. I got rescued and now I owe work. Harsh but clear. |
| 75.4 | tap Well box · closer, Danyal collects later |  |  | Well box this time, it is closer. Keeping my lantern lit. |
| 94.1 | wait |  |  | Tariq stopped me mid walk. Interesting, a person reacting. |
| 99.5 | tap Keep quiet |  |  | Secret is the point of the game title, I keep quiet. Though I wish I could say something of my own, only two choices. |
| 126.1 | tap Leave envelope |  |  | At the well. Dropping it. |
| 139.1 | pulse 4 |  |  | Delivered! Real thrill when the countdown ticks and a neighbour interrupts. But tapping arrows one tile at a time on a phone is slow, and a 60s clock gives me little room. |
| 147.6 | tap Next evening |  |  | That payoff was good: everyone talks about my secret. I want to see what Tariq does next. |
| 167.5 | tap Explain |  |  | Trying the other answer this time to see what changes. |
| 210.9 | shot |  |  | I rushed and walked off from the well without being beside the marker. Own mistake: the marker is hard to see and the leave button says nothing about distance until it fails. |
| 229.4 | tap After three nights |  |  | Three nights done fast. One delivery out of three. Let me see the ending. |
| 233.2 | pulse 3 |  |  | Ended after 3 nights, about 4 min. Wanted to do better at the door, which is a reason to replay. |
| 243.8 | tap Play again |  |  | One more go, I want the door route and no rescue. |
| 324.3 | want_quit | FRUSTRATED |  | The door looks like too many tiles for one-tap-per-tile on a phone; the clock ran out with me a few tiles short. I do not know if it is possible at all at my tap speed. I would leave. |
| 339.0 | stop | FRUSTRATED |  | Stopping. I liked the neighbour interruption and the morning gossip. I did not like walking one tile per tap against a clock. I picked I am stopping in the menu; no note, no send. I might come back for a different route on another evening, not leave it running. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.2 | shot |  |  | Desktop: same opening. I will try the door with the keyboard this time. |
| 101.4 | wait |  |  | Missed the door by a hair on keyboard too. Each key press still costs me about 3 real seconds through the driver, so I suspect partly my slowness. |
| 107.6 | first_minute |  |  | Desktop: I wanted to drop the envelope at the door; arrows and keys worked, but the on-screen arrow pad sits at the bottom edge of the 800px window. At 60s I had met Tariq and was walking north in the dark. |
| 209.9 | want_quit | FRUSTRATED |  | Two nights, I reached the door tile region and dawn hit with 1 second left. I cannot tell whether the door route is meant to be possible or whether my driver lag costs me the seconds. Either way I would leave. |
| 223.2 | stop | FRUSTRATED |  | Stopping at night 2 morning. Chose I am stopping in the menu, typed nothing, sent nothing. I liked the quiet-or-explain moment. Would not leave it running; might come back one evening to try the well route properly. |


### Rosa Alvarez

**Would you return voluntarily?** Yes, but only on one condition: if walking to the well and back were quicker, and the game showed me where to stand. I would close it and not leave it running. I would come back another evening only on that same condition.

**Ranked asks**
1. Show where to stand for the well box, as the door already shows its marker. Make walking faster or shorter.
2. Say the first time what "Explain" and "Keep quiet" will cost me. Show which dot is me.
3. Shorten the long sentences, such as the lantern sentence and "Tariq will repeat his guess…".

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.0 | shot |  |  | A title and an envelope for Idris and Samira. Food and fuel, I understand. Which sentence is hard: Outside, if any light reaches you (your lantern, a lamp or a neighbour lantern) - long, I read it slowly. |
| 8.2 | tap Well box · closer, Danyal collects later |  |  | I do not know who Danyal is, but closer sounds easier. I choose the well box. Reread: the lantern sentence, once, who sees me when. |
| 11.3 | shot |  |  | Now it is real time, 60 seconds until dawn. I am nervous: I act slowly. Where is the well from me? |
| 18.1 | tap Move north |  |  | One tap, one step? I go up toward the well. |
| 26.4 | shot |  |  | Tariq asks me a question. The clock waits - good, I can read. |
| 31.8 | tap Keep quiet |  |  | I keep quiet. The title says Left Hand, I think the point is secret giving. Reread: Tariq will repeat his guess... it stays a guess - I read it twice. What is a guess to repeat? |
| 34.6 | first_minute |  |  | I have to take an envelope to the well in 60 seconds. I understand: leave it for the neighbours, do not be seen. I met Tariq and chose to keep quiet. The tap-per-step is slow but clear. Two rereads so far (lantern sentence, Tariq guess). |
| 53.2 | tap Leave envelope |  |  | I think I am next to the well. I try to leave it. |
| 67.0 | tap Move north |  |  | I cannot tell which dot is me. I guess the one at left. Going north to the well. |
| 75.2 | want_quit | CONFUSED |  | I read twice "Tariq will repeat his guess that you are helping Idris and Samira" and "Stand beside the marked delivery tile, then leave the envelope" - I see no marked tile at the well, only one at the door. Which dot am I? I want to stop, but I keep going to see what dawn does. |
| 86.6 | tap Menu |  |  | I failed. I look for help in the menu. |
| 91.4 | tap I’m confused |  |  | I am confused: which dot am I and where is the well tile. I press I am confused. |
| 101.8 | tap Next evening |  |  | I try one more evening, with a better look at the map. |
| 140.0 | tap Keep quiet |  |  | Danyal says he saw the envelope, but I did not leave it yet? I do not understand what he saw. I keep quiet again. |
| 156.3 | shot |  |  | The envelope is in the well box. I did it, a little proud. How do I go home now? |
| 190.0 | pulse 3 |  |  | Second night worked: envelope reached Samira, private. I like that. But I did not see where the well tile is until I walked until it said done, and I was late home. Mixed. |
| 197.7 | tap Well box · closer, Danyal collects later |  |  | Same choice. Now I know the way, I hope. |
| 350.7 | stop | FINISHED |  | The game ended: The help reached them. I understood the ending and was glad. But the first night I failed because I could not see where to stand, and walking home was too slow for me. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.7 | shot |  |  | Same game as on my phone earlier. I remember the envelope and the lantern sentence. |
| 19.1 | tap Their door · farther, Samira knows it was you |  |  | This time I take the door: the marker is drawn there, so I can see where to go. |
| 48.6 | tap Explain |  |  | Tariq again, same as on my phone. This time I Explain, to see; it costs 3 seconds. |
| 48.6 | first_minute |  |  | The keyboard is much faster than the phone arrows. I remember Tariq asking me at the same place. I know the goal now: deliver, do not be seen, go home. Rereads so far: none new, I remember the old ones. |
| 116.7 | want_quit | FRUSTRATED |  | Again dawn came before I delivered. I was one step short and I spent 3 seconds explaining. I suspect I am slow because each key press takes me about 3 seconds, not because of the game. I try one more evening. |
| 133.5 | tap Well box · closer, Danyal collects later |  |  | The game remembered that I explained: the well now takes 6 seconds. That is a clear result of my choice. I like that. |
| 212.2 | pulse 3 |  |  | Delivered to the well box on the second night. Interested in the cause and effect (6 seconds). Tired of the slow walking and the same long text. The marker only shows the door, never the well box. |
| 329.2 | stop | FINISHED |  | Finished the three nights on my second device. Ending read clearly. I would come back only if walking were quicker. |


### Jonas Berg

**Would you return voluntarily?** Not on this evening's terms. I would play it again another evening, but only for one reason: to see whether the door and the well box really lead anywhere different. The desktop run answered most of that in four minutes, and I would not leave it running. I would not come back on the phone unless the controls responded at human speed, and I can't tell whether the delay was the game or the driver.

**Ranked asks:**
1. I want a failed night to explain itself. Say why the envelope counted as undelivered when I left it one second before dawn, and give me a visible dawn-versus-collection warning before I commit to the well box.
2. I want a reason to choose differently between nights. Danyal stopped me after about four steps on every night on the desktop run, whichever route and lantern setting I used. I want the lantern and the route to change what happens.
3. I want a player marker on the map that I can tell apart from the neighbours. I identified my own dot by guessing, twice.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 2.7 | shot |  |  | A title-less start: I am already at a table with an envelope. Two choices, door or well box, each with a cost. I like that the trade is labelled. |
| 8.7 | tap Well box · closer, Danyal collects later |  |  | Map shows lit patches around people. I guess light is what gets me seen. Taking the closer well box first to learn the baseline. |
| 29.6 | tap Keep quiet |  |  | Danyal saw me before I had even reached the well, as far as I can tell. Clear trade: explain costs 3 seconds and exposes their need; quiet is free. Testing quiet. |
| 55.7 | key l |  |  | Delivered. Hiding the lantern on the way back to see what the cold does. |
| 66.8 | first_minute |  | Night 1, 13s to dawn | I delivered to the well box and am heading home in the dark. Real time, 60s a night. Danyal saw me anyway while my lantern was lit. Keyboard moves one step per press; I cannot tell which dot is me, I guess the one with the lit squares. Hypothesis: hidden lantern means unseen but colder. |
| 79.9 | note |  | Morning 1 | Morning accounts show exactly who saw what. That is the visible consequence I want. I missed home by seconds; the lantern-off walk cost me nothing I can see, but I do not know what the cold did. The only visible clue was Danyal seeing me while lit. |
| 88.4 | tap Well box · closer, Danyal collects later |  |  | Repeating the well to see if conditions matter, but this time lantern hidden from the start. |
| 102.6 | tap Explain |  |  | Danyal stopped me again, even with my lantern hidden. Same place, same time. Now testing Explain, the other branch. |
| 131.1 | key l |  |  | Now there is a clue: hands numb after a long dark walk. So hidden lantern costs warmth, as the intro said. Lighting it again and racing home. |
| 148.7 | pulse 4 |  | Morning 2 | Night 2 differed because I chose Explain: Idris now says he wanted to choose who knew. Explain-versus-quiet has a visible price. But the route and Danyal interception were identical, so the planning part is thin so far. |
| 160.3 | tap Their door · farther, Samira knows it was you |  |  | The text now tells me how last night changed this one: Samira waits to meet Danyal alone. That is a clue I can plan with. Trying the door for the other trade. |
| 188.8 | tap Keep quiet |  |  | Third night, Danyal again stops me after about four steps, even on the door route and with my first four keys. My keypresses were silently swallowed behind his prompt, no feedback. |
| 251.6 | tap After three nights |  |  | The door route had a clean result: only her household knows. I missed home again by one second; I do not know whether missing home matters. |
| 254.9 | want_quit | FINISHED | After three nights | Game ended after three nights, about four minutes. I want to replay once to test whether explaining or door has a real downside, but the route and Danyal stop were identical each night, so I suspect there is little to optimise. |
| 265.7 | stop | FINISHED | After three nights | Game ended at about four minutes; I tapped I’m stopping, a note box and Send feedback appeared, I typed nothing and sent nothing. I would play once more only to see the other branch, not leave it running. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.6 | shot |  |  | Second visit, same evening, phone. Same opening text. Remembering Danyal stopping me every night; this time I choose the door and see if I can avoid him. |
| 118.1 | tap Keep quiet |  |  | On the phone, my first two taps each hung about 30 seconds before the driver gave a timeout error, though the game did move (I may have lost seconds of a 60 second night). I suspect the tool, not the game, but I cannot be sure. |
| 141.8 | pulse 3 |  | Morning 1 | First night failed: no envelope delivered. I think my slow phone taps cost most of the minute, so I cannot judge the game on it. The morning report is honest about failure, which I like. Taking the well box this time as the closer route. |
| 195.8 | tap Keep quiet |  |  | Each phone tap costs about seven real seconds here, so I get roughly eight steps in a 60 second night. On desktop it was about one second per step. I suspect the tool, but a real thumb has no such delay. Switching to the arrow keys through the driver to finish this night. |
| 247.2 | note |  | Morning 2 | I left the envelope in the well box one second before dawn and Danyal needed three more seconds, so it counts as undelivered. That is a clear rule, but with tool lag every step is far slower than a person, so I cannot tell if the game is tight or my driver is slow. |
| 352.5 | want_quit | FINISHED | After three nights | Ended on the phone with one delivery out of three; the result says the household needs more help. I do not know how much of that was my tool lag. I would not replay on this device. |
| 369.3 | stop | FINISHED | After three nights | Game finished at about 6 minutes on the phone. I chose I’m confused (the closer match: why only one of three counted), typed nothing, sent nothing. I would not return on this device unless taps were fast. |


### Aisha Rahman

**Would you return voluntarily?** I might come back another evening to try the other route, but only if I could always tell which figure on the map is me and the mornings changed with what I did. I would not leave it running, and I would not return tonight.

**Ranked asks:**
1. Mark which figure on the map is me, and say where "beside the marker" is. I overshot the well on desktop night 2, and on night 3 I stood next to the door marker and still could not deliver before dawn.
2. Make the morning reports respond to what I did, on every route. The repeated morning after the quiet route was word for word the same as the day before.
3. Pause the dawn timer when a key press is dropped, or say that Tariq's question swallows keys. My movement stopped for a stretch each time he turned.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.4 | shot |  |  | A winter village, an envelope for Idris and Samira. I want to know who they are before choosing. |
| 10.1 | tap Well box · closer, Danyal collects later |  |  | I would rather not be known to Samira; the well box seems gentler. Guessing what Danyal does. |
| 27.2 | tap Keep quiet |  |  | Tariq asks if it is for Idris. I appreciate that the clock waits for me. I do not want to name a family who is struggling; I keep quiet. |
| 47.7 | shot |  |  | I cannot tell which little figure is me on the map; labels are on others, and Home label sits near the bottom. |
| 86.4 | first_minute |  | Morning 1 | I understood the job: carry an envelope in secret. The clock stopping for Tariq was kind. But I could not tell which figure was me, I ran out of dawn before getting home, and Tariq guessed anyway. I like hearing from Idris and Samira the next morning. |
| 86.5 | pulse 3 |  | Morning 1 | Curious about the neighbours; a bit rushed by the timer and unsure what my lantern did. |
| 96.0 | tap Well box · closer, Danyal collects later |  |  | Same again, but I will hide my lantern this time to see what the cold does. |
| 113.9 | tap Keep quiet |  |  | Tariq again even with my lantern hidden. I wonder if hiding helped at all; I did not see a sign. Keeping quiet again to protect their dignity. |
| 147.7 | key l |  |  | My hands are numb. I think I overshot: I am the small figure at the top-left, far from the well. I never knew which dot was me. |
| 179 | pulse 3 |  | Morning 2 | Morning 2 reads word for word like morning 1. I overshot because I never knew which figure was me. I want the neighbours to react to what I actually did differently (hidden lantern, cold). |
| 187.7 | tap Their door · farther, Samira knows it was you |  |  | Last evening I try the door: Samira will know it was me, which feels warmer but less private. |
| 280.8 | want_quit | FRUSTRATED | Morning 3 | I walked to the door and was told to stand beside the marker, but dawn came. I could not tell which tile counted. Tariq froze my key presses mid-walk. Night 3 was my best attempt and it failed. I will see the ending first. |
| 317.5 | pulse 3 |  | After three nights | The ending is fair and gentle: help reached them, village guessing. Nice that Idris worries about what people believe. It was over in under 10 minutes and I do not know what I could have done differently. |
| 333.0 | stop | FINISHED | After three nights | Stopping here: I reached the ending (help reached them, village guessing) in about nine minutes. I liked Idris and Samira next morning and the stopped clock for Tariq. I could not tell which figure was me, and mornings repeat. Feedback offered I am stopping, which opened a note box; I typed nothing and did not send. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.3 | shot |  |  | Second visit on my phone. Same start I expect; hoping to find which dot is me. |
| 14.2 | tap Their door · farther, Samira knows it was you |  |  | On the phone I try the door route; I want Samira to know someone cares. |
| 76.2 | tap Keep quiet |  |  | On the phone each arrow tap costs me about seven seconds of the sixty; I suspect that is my driver being slow, not the game. I will not be able to reach the door in time. |
| 102.7 | first_minute |  | Morning 1 | On the phone the map and arrows fit on one screen, which is good. But I failed night 1: my taps are slow and Tariq stopped me. Idris says no envelope reached us. The morning is kind but it still lands as a failure. |
| 120.1 | tap Well box · closer, Danyal collects later |  |  | Closer one this time: I want a delivery. |
| 215.3 | pulse 2 |  | Morning 2 | Two nights without delivery on the phone. The game was told I tapped the well box but I was walking to the door; I am not sure what I picked. The Danyal and Tariq lines changed between mornings, which I like. |
| 274.1 | tap Explain |  |  | Two nights failed. This time I explain to Tariq to see whether naming the family makes things easier, even though it exposes their need. I am guessing here. |
| 371.7 | stop | FINISHED | After three nights | Stopping on the phone: ending reached, household needs more help. Explaining to Tariq made Idris and Samira say they wanted to choose who knew; that respected what happened and was my favourite moment. I pressed I am stopping; a note box appeared empty; I typed nothing and did not send. |


### Diego Silva

**Would you return voluntarily?** Maybe, another evening, but only if three things hold: I can tell why a delivery failed, I can't be tied up by questions I can't act on, and there is something new after the three nights. I would not leave it running.

**Ranked asks**
1. Say why a delivery failed. On the phone, "Dawn came before any envelope reached" gave no cause (see sections 5 and 9).
2. Make movement fit a human's pace. Each arrow tap on the phone took about 3 to 7 seconds in my driver while the dawn clock ran at one second per second. I suspect that lag is the tool, not the game, but I can't separate them.
3. Give a reason to replay. The three nights end in a short summary, and I didn't see anything that changes on a second run.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.2 | TOOL note |  |  | Envelope, door or well box. Simple choice at once. Fine. |
| 7.1 | note |  |  | Lit village map, a marker at the door. Clear what I am doing: sneak an envelope. Door is farther, so riskier; I will take the door. |
| 63.4 | first_minute |  | Night 1, 18s to dawn | Real-time sneaking, nice. I hid my lantern and pushed up the street with arrow keys, but Danyal came and caught me with my envelope before I got far. I could not tell where my own figure was on the small map. The dawn clock stops for his question, good. I will keep quiet, the obvious stealth answer. |
| 90.0 | note |  | Morning 1 | Dawn came and nothing was delivered. I pressed arrow up about 15 times and cannot tell how far I got; each press may be one step and the dawn clock runs at one second per second while I act every 1.3s. The morning accounts are good: Danyal says he saw Yusuf with an envelope. That stings. Trying the closer well box next. |
| 128.4 | note |  | Night 2, ~40s to dawn | Each arrow press is one step, so the walk is learnable. Tariq stopped me with a question too. The well is close and I stood beside it; leaving the envelope with Enter. Interruptions feel like fair risk, not a form. |
| 151.9 | pulse 4 |  | Morning 2 | Delivered via the well box; the morning accounts show gossip and who believes what. The cold warning when I stalled was a nice pressure. I like that the stakes are social, and the arrow steps feel responsive. Last night next. |
| 237.3 | note |  | Morning 3 | Night 3: delivered at the door, but the cold put me out and a neighbour carried me home. Consequences are readable: Samira trusts me less, Idris wanted to choose who knew. That is a real consequence chain. Explaining to Danyal cost me time and exposure; I did not see the cold clock rising until it hit. Ending is next. |
| 243.8 | pulse 4 |  | After three nights | Finished in about four minutes. The ending summary matched what I did, which I like. It is short. I want a second try to see if I can deliver door-first without the cold catching me. |
| 335.3 | want_quit | FINISHED | Morning 1 (run 2) | Second run: door route, I overshot the door row by one, the cold and dawn took me. I have seen the shape of the three nights; the choices left are door versus well and explain versus quiet. I would leave here and try the phone. |
| 354.2 | stop | FINISHED |  | I am stopping here on desktop. Sneaking an envelope across a dark lit-up map while a dawn clock ticks is a good small idea, and the morning accounts are honest about what people believed. But I only get three nights and I do not know whether anything different happens if I replay. I selected I am stopping in Feedback and typed nothing, no Submit. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.5 | note |  |  | Second device, same evening: I know the rule now, so I take the well box and tap on-screen arrows. |
| 56.0 | first_minute |  | Night 1, 27s to dawn | On the phone the whole map and the arrow pad fit, good. But every arrow tap takes about 7 seconds in my driver while the dawn clock keeps going, so I may be unfairly slow here; I suspect that is the tool, not the game. Tariq stopped me with a question, same as the desktop. |
| 194.9 | want_quit | CONFUSED | Morning 2 | I stood next to the well, tapped Leave envelope, walked home, and morning says no envelope reached them. I do not know if my tap missed because the page had scrolled and the button moved, or because I was one square off. Nothing on screen told me why. I am leaving. |
| 218.2 | stop | CONFUSED |  | I am stopping here on the phone. The map and arrows fit and the idea works, but my envelope did not land and I could not tell why, and each tap lagging while the dawn clock runs made it feel unfair, though I suspect the lag is my tool. I opened Feedback, tapped I am confused, which opened a note box; I typed nothing and pressed nothing else. |


### Mei Tan

Would I return voluntarily? Yes, I would come back on another evening on my laptop, but only if the night's walk can be done without a keyboard and the morning report tells me what went wrong; I would not leave it running. I would not come back to it on my phone as it stands.

**Ranked asks**
1. Make the walk possible by touch: hold-to-walk, or tap a place and let Yusuf go there. Tapping one tile at a time did not fit in a 60-second night.
2. When an envelope misses, say why in the morning report. My well-box delivery with 2 seconds to dawn got the same line as a night where I never left home: "Dawn came before any envelope reached Idris and Samira."
3. Show a collection countdown on screen, and make the "your lantern is hidden, your hands are going numb" warning stand out from the other lines.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.6 | note |  | Evening 1 | Careful accountant reading: I am Yusuf, giving an envelope to Idris and Samira. Two options with stated tradeoffs: door is farther and Samira will know; well box is closer. I do not know yet how long the night is or what the cold costs. |
| 11.0 | tap Well box · closer, Danyal collects later |  |  | Map shows a route by lit tiles. Choosing the well box: closer, so less cold and less exposure, and a middleman I cannot check. I am guessing at the cost of Samira knowing. |
| 36.4 | first_minute |  | Night 1, 49s to dawn | Real-time walk, 60 seconds. Tariq stopped me and the dawn clock waits for my reply, which I liked: I can read. Options state their cost plainly (3 seconds vs none). I wonder whether the controls and message are below the fold; I had to rely on keys. I would keep quiet: a guess is not a confirmation. |
| 63.6 | key Enter |  |  | Enter is said to return home; hoping it walks me rather than me counting tiles with 28 seconds left. |
| 85.9 | tap Go inside |  |  | I am home with 7 seconds to spare. Hand-walking with one key per call is tight; a person with a keyboard would manage easily. |
| 88.8 | pulse 4 |  | Morning 1 | The morning report answers my question from last night: four people each say what they know and what is guessed. That is a legible ledger of consequences. I want to see how three nights compare. |
| 97.0 | tap Their door · farther, Samira knows it was you |  |  | Tonight I try the door to compare. I am curious what a farther walk costs and whether hiding my lantern helps. |
| 125.5 | tap Keep quiet |  |  | Tariq stopped me again even with my lantern hidden. I key-pressed seven more arrows during his question and they did nothing, which is fine. Keeping quiet again. |
| 175.4 | pulse 4 |  | Morning 2 | I hid the lantern for the whole walk, and the game said my hands were numb. I did see that text but kept walking by habit and the cold forced me to shelter just before home. That cost me: I owe a neighbour work and later nights get shorter. Fair, it did warn me, but the warning was a line among many and I was pressing keys fast. The morning report repeats the exact lines from Morning 1, which feels stale: I expected Samira to say I was the giver, since I used her door. |
| 186.7 | tap Well box · closer, Danyal collects later |  |  | Last night the cold hurt me, so tonight the well box with the lantern kept lit. |
| 212.5 | tap Explain |  |  | Tariq appears at the same spot each night. For the last night I will try Explain to see what trust costs; I have 50 seconds and the well is close. |
| 330.0 | TOOL tap |  |  | Dawn arrived a step before my front door; the Go inside button vanished under me. I suspect my slowness (one key per call) rather than the game. The result is very clear: Idris wanted to choose who knew, Samira trusts me less because I named them to Tariq. I understand why. |
| 356.1 | stop | FINISHED | After three nights | The game ended after three nights with a plain summary of what each person knows and how they feel. I pressed I am stopping in the menu (a note box appeared; I typed nothing and did not send). I would try once more another evening with a different plan: door with lantern lit, to see whether Samira knowing is worth the walk. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 12.9 | tap Their door · farther, Samira knows it was you |  |  | Second visit, on my phone. I remember the first plan: well box was safe but Samira lost trust when I explained to Tariq. Tonight I try the door, lantern lit, and tell Tariq nothing. |
| 57.4 | tap Keep quiet |  |  | Danyal caught me walking to the door. Each touch step costs me about seven real seconds through this driver, so I am much slower than a hand on a phone; I suspect the tool, not the game. Keeping quiet. |
| 68.0 | first_minute |  | Night 1, 31s to dawn | On the phone the whole scene (map, lantern, move arrows) fits on one screen, which I like. The real-time walk is where I struggle: each of my touches takes me several seconds, the 60 second night keeps running, and I am only a third of the way to the door. A human thumb would be faster; I cannot tell how much. Danyal saw me, so I paid for choosing the far door with attention. |
| 105.8 | pulse 3 |  | Morning 1 | Night 1 failed: dawn came before I reached the door and the morning says no envelope reached them, with each person saying what they know. Clear and fair. But I do not know if it is my slow touches or the 60 seconds being tight for a far door. I am still interested; it is a legible puzzle. |
| 124.2 | tap Well box · closer, Danyal collects later |  |  | The far door ran me out of time, so I choose the closer well box. |
| 232.0 | want_quit | FRUSTRATED | Morning 2 | I left the envelope in the well box with 2 seconds to dawn. The game had told me Danyal collects 3 seconds later, so I should have known, but the morning only says dawn came before any envelope reached them; it does not say I was a second short. Two nights lost, two nights of Idris and Samira still needing food. Part of this is my tool being slow (about 3 seconds per tap) but on a phone the walk is a lot of tapping. I would keep going for the last night, to see the ending; I would not come back for a fourth night. |
| 252.2 | tap Well box · closer, Danyal collects later |  |  | Last night. Well box, and I will tap straight up and not look around. |
| 346.0 | tap After three nights |  |  | This time the envelope reached them with 7 seconds spare. So last night I was one second short because collection takes three seconds. Fair rule, though the morning did not say that. |
| 366.4 | stop | FINISHED | After three nights | The game ended: the household received too little help, and Yusuf needed no rescue. That is a fair verdict on two lost nights. I pressed I am stopping in the menu; a note box appeared, I typed nothing and sent nothing. I would play again on a laptop another evening, but on the phone the walk by tapping is too much work for a 60 second night. |


### Samir Haddad

**Would you return voluntarily?** I might come back another evening on desktop, to try the door every night and see what Samira says. I would not leave it running. I would not come back on the phone if each arrow tap keeps costing real seconds.

**Ranked asks**
1. On the phone, make walking cost less real time, and keep the map and all four arrows on screen together. Night 3 pushed the arrows below the bottom edge.
2. Make the door choice match what the morning says. The button says "Samira knows it was you", but Samira said "nobody knows". Vary the Morning 3 lines too; they repeated Morning 1 word for word.
3. Tell me before the first night that the cold ends the night. On run 1, a neighbour carried me home and I owed work. The game does warn "hands are numb", but I did not understand that meant being carried home.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.3 | shot |  |  | A winter-night giving game. Yusuf, envelope, a neighbour who may see me. I want to know who Idris and Samira are before choosing. |
| 10.3 | tap Well box · closer, Danyal collects later |  |  | Giving quietly appeals; the door means Samira knows. But I do not know if Danyal can be trusted with it. Choosing well box. |
| 13.3 | shot |  |  | Real time now, 60 seconds. I will hide the lantern first. |
| 39.4 | tap Keep quiet |  |  | Good, the clock waits for me. Tariq stopped me mid-street. I am keeping quiet; a guess nobody can confirm seems kinder to Idris. |
| 56.5 | first_minute |  | Night 1, 35s to dawn | Reason to act: leave a hidden envelope for Idris and Samira before dawn. Tappable: two choices, then moving with arrows, lantern L, Leave envelope, Keep quiet. Urgent: dawn clock, 35 seconds left. Limit: lantern light lets neighbours see me. Surprise: the clock stops when Tariq asks me something. I do not yet know what the neighbours do with a guess. |
| 78.2 | TOOL tap |  |  | Shaking from cold. Cold builds fast when hidden; I felt the cost of secrecy. Going in. |
| 81.0 | note |  | Morning 1 | Morning accounts are the best part: Idris, Samira, Danyal and Tariq each say what they know, and Tariq guessing right anyway. But a neighbour carried me home and I owe work; I did not know the cold was that strict. I wish I had raised the lantern once. |
| 90.8 | tap Well box · closer, Danyal collects later |  |  | Same route again but faster: I know the way now. Rest of the trip I will relight the lantern when my hands go numb. |
| 111.1 | tap Explain |  |  | Tariq blocks me again at the same spot, so my keys were lost. This time I will explain, to see what a neighbour does when trusted. It costs Idris some privacy; I am uneasy, and guessing. |
| 133.3 | key l |  |  | Lighting the lantern this time for warmth, accepting being seen. |
| 153.5 | pulse 5 |  | Morning 2 | Explaining cost me Samira trust and Idris wanted to choose who knew. That is a real moral cost with no obvious right answer, which I like. Lantern lit meant I got home without being rescued. |
| 162.8 | tap Their door · farther, Samira knows it was you |  |  | Last night. Idris wanted to choose who knew, so the door: only Samira sees me. It is farther and colder though. |
| 178.1 | tap Keep quiet |  |  | Tariq at the same spot a third time. Keeping quiet after what Explain did last night. |
| 207.7 | tap Return home |  |  | Trying Return home from afar to see if it works. |
| 239.1 | note |  | Morning 3 | Dawn came before I got home, no penalty shown. Samira says nobody knows, though the door choice said Samira knows it was me; that confused me a little. Morning 3 repeated the Morning 1 lines word for word. |
| 254.4 | note |  | After three nights | The game ended after about 4 minutes: three nights, a verdict paragraph. The summary names what each person felt, which is what I care about. Menu offers I am stopping and I am confused. I am not stopping yet; I want to see what a different route does. Playing again. |
| 325.0 | TOOL tap |  |  | Second run: door, lantern lit the whole way, to see what being seen costs. |
| 397.8 | want_quit | BORED | Morning 1, run 2 | Second run failed because dawn came before I reached the door; I was slow, my keys cost real seconds through the driver, so I suspect that is me and not the game. Walking the same route again for lines I mostly saw is the thing that makes me want to stop. Only the first night of this run had new text: Idris says no envelope reached us. |
| 411.6 | tap I’m stopping |  |  | Opening Feedback and choosing I am stopping. I will type nothing and not submit. |
| 414.6 | stop | BORED | Morning 1, run 2 | I would stop here for tonight. Run one gave me a real moral cost (naming the family got Samira to trust me less). Run two repeated the walk. I would come back another evening to try the door every night, not leave it running. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.6 | shot |  |  | Same evening, my phone. Looks like the same game. New game here. |
| 11.2 | tap Well box · closer, Danyal collects later |  |  | The map is not on the first screen of the phone; there is empty space under the choices. Choosing the well box. |
| 57.8 | shot |  |  | Each move tap takes about 7 seconds on this phone, and the game clock lost 7 seconds per step. I suspect the driver, not the game, but I cannot tell. |
| 61.8 | first_minute |  | Night 1, 24s to dawn | Reason to act: get an envelope to Idris and Samira before dawn. Tappable: two choices, lantern, Leave envelope, four arrow buttons, Keep quiet or Explain. Urgent: the dawn clock. Limit: lantern light shows me; cold. On the phone I know the map fits, but each arrow tap costs me about 7 seconds and I am already near dawn. Unsure if that is the driver or the game. |
| 102.2 | shot |  |  | Cold took me before I delivered. I was too slow, and I suspect my driver. |
| 118.7 | tap Well box · closer, Danyal collects later |  |  | Second night on the phone. Lantern stays lit this time to avoid the cold. |
| 150.3 | tap Explain |  |  | Tariq again. I explained on desktop and it cost trust; this time I keep quiet. |
| 153.3 | note |  |  | My own slip: I wrote that I would keep quiet but tapped Explain. Two buttons side by side and I did not read my own tap. Not the game, but they are the same size and close together. |
| 213.2 | tap Well box · closer, Danyal collects later |  |  | Last try on the phone. Two failed nights; the arrow taps are slow for me. |
| 219.4 | note |  | Night 3, 51s | On this night the arrow buttons are below the bottom edge of my 690px phone screen; the map and the arrows do not fit together unless I scroll. Earlier nights they fit because the text above was shorter. |
| 281.7 | want_quit | FRUSTRATED | Morning 3 | Three nights, no delivery on the phone. Each arrow tap used about 7 real seconds and the dawn clock ran with them, so I never reached the well in time. A real thumb is faster, so I suspect my driver, but from my seat the phone version is not playable by me. |
| 307.8 | stop | FRUSTRATED | After three nights | Stopping on the phone: the game ended with The household needs more help, a fair verdict, but I never got an envelope through. I pressed I am confused in Feedback (it offered the choice), typed nothing, did not send. Another evening I would try on desktop, not this phone. |


### Tessa Williams

I would not come back to this on my own tonight. I might try it once more another evening if a friend sent me the link and I knew I could do something daft or choose when to show my lantern.

**Ranked asks**
1. Let me joke, lie or say my own thing to Tariq instead of only "Explain" or "Keep quiet".
2. Show the cold coming earlier and make the walking forgiving, so a hidden lantern is a risk I can see and not a trap.
3. Give the house I'm helping a response to the way I helped, not only the same "needs more help" verdict.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.7 | shot |  |  | A story about secret giving. I like that the choice has a tradeoff already: closer vs known. |
| 9.6 | tap Their door · farther, Samira knows it was you |  |  | A tiny village map under the text. I will take the door, the riskier one. |
| 33.8 | tap Keep quiet |  |  | Tariq caught me. Only two replies, no way to lie or joke. Keeping quiet. |
| 100.8 | first_minute |  | Morning 1 | It is a real-time delivery run on a tiny map with buttons. I hid the lantern, the numb hands warning came late, then the cold sent me home and no envelope arrived. Fair, but I did not see the cold coming until it said so. The village reacting (everyone talking, Tariq guessing) is the fun bit. |
| 108.3 | tap Well box · closer, Danyal collects later |  |  | Trying the well box this time, and I will keep the lantern lit to see what being seen does. |
| 122.8 | tap Explain |  |  | Different this time: I will tell Tariq straight, to see if it changes anything. |
| 172.7 | pulse 4 |  | Morning 2 | Explaining to Tariq made Idris say he wanted to choose who knew, and Samira trusts me less. Different act, different reply. That is what I want. |
| 184.8 | tap Their door · farther, Samira knows it was you |  |  | Last night: door, lantern lit, run straight. |
| 200.0 | tap Keep quiet |  |  | Tariq again, every night at the same place. Quiet this time. |
| 257.7 | want_quit | FINISHED | After three nights | It ended on a failure. I got one envelope across in three tries and it cost me trust. I want to retry the door properly, but I think I have seen the loop: walk, Tariq, two replies. |
| 272.0 | stop | FINISHED | After three nights | I am stopping here. The ending said the household needed more help and it was fair, but I got one envelope across in three nights and the walking was fiddly. I liked that Explain and Keep quiet got different replies. I would not come back tonight on my own. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.4 | shot |  |  | Second visit, laptop. Same opening. This time I know the walk is timed so I will use the arrow keys. |
| 59.9 | tap Keep quiet |  |  | The night clock was already at 28 seconds when I pressed my first key. Fast. |
| 92.1 | wait |  |  | Dawn took me 4 rows short. I suspect my driver being slow (about 2-3 seconds a key) rather than the game, but I cannot tell. |
| 96.2 | first_minute |  | Morning 1 | Late note. Second device, I knew what to expect, and still missed the door by a few tiles. Night one fails and the village talks anyway. I like the aftermath, I do not love the clock. |
| 182.0 | pulse 3 |  | Morning 2 | Hiding the lantern worked against me: numb, shaking, rescued, an hour of dawn clock gone. The warning came, but a few seconds before it was too late. I feel tricked by the cold, though it was explained at the start. |
| 310.3 | want_quit | FINISHED | After three nights | The game ended on the same verdict, even though this time the envelope did reach them. They needed more help anyway. I saw the whole loop twice. |
| 310.3 | stop | FINISHED | After three nights | I am stopping here. It ended with the household needing more help even though one envelope arrived. I would not come back tonight; the walk repeats and I want a way to say something silly or choose when I show the lantern. |


### Pavel Novak

**Would you return voluntarily?** Pavel: "Yes, once more on the desktop, another evening, to try the other door and see whether a different route changes what Idris and Samira say. I would not leave it running, and I would not return on the phone while taps stall."

**Ranked asks**
1. Make the Morning 3 report match what I did. It was word for word the Morning 1 report, though I went by the door the second time.
2. On the phone, make walking possible in 54 seconds, or tell me whether the stalled taps were the game. Two of three phone nights ended with no envelope.
3. Tell me earlier how the cold works. It sent me home on Night 1 with no number shown before it happened.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 4.2 | shot |  |  | A table, an envelope, two ways to deliver it. Like choosing a route: far and sure, or near and by a third man. |
| 10.2 | tap Well box · closer, Danyal collects later |  |  | The map shows lit squares around houses. I choose the shorter route, the well box. |
| 25.0 | shot |  |  | Tariq stopped me and asked a question. I did not expect a person to turn on me so soon. |
| 30.8 | tap Keep quiet |  |  | Keep quiet is the sensible answer: no time lost, and a guess is only a guess. |
| 57.4 | tap Leave envelope |  | Night 1, 28s to dawn | I think I am at the well. Hands are numb. Leaving the envelope. |
| 57.4 | first_minute |  |  | Real-time with a 60 second night, one key press is one square, and I am slow at it. A person stopped me and the dawn clock waited, which was fair. Hands numb from hiding the lantern. I understand: deliver unseen, return home. |
| 76.5 | note |  |  | Cold sent me to shelter before I got home. A neighbour had to bring me, I owe work, later nights shorter. The envelope still arrived. So hiding the lantern too long has a price I was not told in numbers. |
| 80.8 | tap Next evening |  |  | I like these morning reports from each person. Contradictions: Tariq guesses, others say nobody knows. |
| 87.3 | tap Well box · closer, Danyal collects later |  |  | Same route again, but this time I will keep the lantern lit and see what the neighbours do. |
| 105.5 | tap Explain |  |  | Danyal saw me with the lit lantern. I will try Explain to learn what it does. |
| 130.1 | tap Leave envelope |  |  | At the well now, lantern lit this time, hands warm. |
| 148.4 | tap Go inside |  |  | At home, I press Go inside. |
| 150.6 | pulse 4 |  | Morning 2 | The morning replies show what my choices cost: Idris wanted to choose who knew. I like noticing how people differ. The walking by single key presses is slow for me but works. |
| 158.5 | tap Their door · farther, Samira knows it was you |  |  | Last night I try the door. Samira will know it was me, which is the honest way. |
| 244.0 | note |  | Morning 3 | Morning 3 text is word for word the same as Morning 1, yet I went by the door this time, not the well. Idris and Samira say nothing about me coming to the door. Either it was not noticed, or the report is not about my choice. I suspect a repeated report. |
| 249.4 | want_quit | FINISHED |  | The game ended after three nights with a fair summary. Nothing further to do except play again; I would like to try the door and well differently, but not at once. |
| 260.9 | stop | FINISHED |  | I finished three nights and read the summary. I pressed I am stopping. I typed nothing and pressed nothing else. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 0.6 | shot |  |  | Second visit, my phone. I remember the table, the envelope, Tariq and the cold. |
| 5.9 | tap Their door · farther, Samira knows it was you |  |  | On the phone the map is not on this screen. I choose the door, as last time I tried it. |
| 104.6 | tap Keep quiet |  |  | The taps on the phone sometimes take 30 seconds and fail; the night went on while I waited. Danyal saw my envelope. I am shaking from cold. |
| 110.6 | note |  |  | Night one on the phone was lost: two of my taps stalled for 30 seconds each, and I barely moved. Cold sent me home, no envelope delivered. Idris says no envelope came. I suspect the driver was slow on a moving page rather than the game, but I cannot be sure. |
| 204.8 | want_quit | FRUSTRATED |  | Two nights gone and no envelope. Each key took about 3 seconds here against 1.3 on the desktop, so I could not walk in 54 seconds. I suspect my slow driver, but from my chair the game just ends the night on me. I will try the last night once more and keep the lantern lit. |
| 298.3 | tap Leave envelope |  |  | At the well with 20 seconds left. |
| 338.7 | tap After three nights |  |  | One envelope in three nights on the phone. |
| 361.0 | stop | FRUSTRATED |  | Three nights over, one envelope got through. I pressed I am stopping, typed nothing. On the phone I could not walk fast enough through the driver; I will not judge the game on that. |


### Leila Mansour

**Would you return voluntarily? Yes, but only for one more try: if the game showed me which figure on the map is me and warned me that hiding the lantern slows me down. As it is, I would not leave it running, and tonight I am done. I might come back another evening to try the door route properly.**

Ranked asks:
1. Mark the player figure clearly, so it can't be confused with a neighbour carrying a lantern ring.
2. Say before the night, or at the first lantern toggle, that hiding the lantern makes the hands numb and slows movement.
3. Make the walk easier to read: the dawn clock leaves little slack for taps, and the neighbour interruption hits at the same spot every night.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 9.5 | tap Well box · closer, Danyal collects later |  |  | Clear task: one envelope, two places. Took the nearer one. Map below the text is a surprise; page was scrolled already. |
| 33.0 | TOOL tap |  |  | Tariq stops me; the clock waits for my reply and says so. Precise, fair. Keeping quiet. |
| 33.0 | first_minute |  | Night 1, 40s to dawn | I understand the job: carry an envelope in real time before dawn, lantern shows me. Arrow buttons work but each tap costs about 2-3 real seconds of the 60. Tariq interrupt was a real choice. |
| 85.9 | wait |  |  | Delivered with 1 second left. Real-time with slow tap cost; I suspect my driver latency made this tighter than a human thumb would. |
| 88.4 | pulse 4 |  | Morning 1 | Morning accounts are precise and consequential: the envelope was in the well box but dawn beat the collection, so nothing reached them. Fair, but I did not know collection also had to finish before dawn. |
| 114.0 | tap Explain |  |  | Tariq again at the same spot. Trying Explain this time to see the difference. |
| 169.3 | pulse 5 |  | Morning 2 | Now the morning accounts hit: Idris wanted to choose who knew, Samira trusts me less, Tariq says I told him. My Explain choice cost me. That is consequential conversation. |
| 178.8 | tap Their door · farther, Samira knows it was you |  |  | Samira said she wants privacy; but the door has no wait. Going to the door, the far one. |
| 262.3 | want_quit | FINISHED | After three nights | The game ended after three nights with a clear verdict. Satisfying and short. I would replay for the other route, not now. |
| 277.6 | stop | FINISHED | After three nights | Game ended; I chose I am stopping in Feedback, typed nothing, did not send. Short and clear. I would play again to try the door first. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 39.0 | TOOL tap |  |  | Desktop, second visit. Taking the door this time to see how it differs. |
| 83.6 | tap Keep quiet |  |  | Danyal saw me in the open here; keeping quiet. Keyboard arrows work, each press about 2s of driver time. |
| 112.0 | wait |  |  | Hid the lantern with L, cold made my hands numb, and I did not even get near the door before dawn. Hiding costs movement. Learned by failing; the intro did say the cold builds, but not that it stops me moving. |
| 116.3 | first_minute |  | Night 1 | Second visit, desktop. I knew the task and picked the door. My first tap took about 33 driver seconds to apply, so the 60s clock was half gone when I could move; I suspect driver lag, not the game. Fail: dawn beat me again. |
| 116.3 | pulse 3 |  | Morning 1 | Failed night one by hiding the lantern: numbness slowed me and the game never said so until it happened. Morning accounts differ from phone: Tariq did not see me, Danyal saw but cannot say who. Good variation. |
| 244.8 | wait |  |  | I pressed ArrowUp ten times after Keep quiet and my marker barely moved from near home. Either keys were lost after the dialog closed (focus?) or I misread the map. I suspect a focus loss: the Keep quiet button vanished. Not sure. |
| 328.1 | tap Move north |  |  | After Keep quiet my arrow keys did nothing for 9 presses; trying the on-screen arrow button. |
| 341.2 | note |  | Night 3 | Correction to my last note: the keys were NOT dead. I misread the map. The lit figure is me and the ringed one is Danyal; I overshot the door going too far north both nights. The ring on a neighbour looks like the player marker to me. |
| 377.6 | want_quit | FINISHED | After three nights | Ended with the household failed: zero deliveries, partly my misreading of which marker is me and a slow driver. Mild frustration, I would try once more to get it right. |
| 393.7 | stop | FINISHED | After three nights | The game ended with the household failed. I chose I am stopping in Feedback, typed nothing, sent nothing. I wanted to be told which figure is me; I would not come back tonight. |


### Greta Holm

Would you return voluntarily: Yes, once, if a new run changes something I can see, such as a different neighbour or a different route. I would not leave it running. I would come back one more evening to try to beat the gossip, and only if the "beside the marker" rule were clearer. This is conditional, and the phone session made it weaker.

Ranked asks:
1. Show clearly which tile counts as "beside the marker", and say so in the text.
2. Tell me at the start of the night, before I move, that a lit lantern gets me seen and a hidden one costs warmth.
3. Keep the cold and the lantern button usable, or explain why they are not, so I do not lose a night to a control I cannot press.

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.5 | tap Their door · farther, Samira knows it was you |  |  | Obvious first try: the door. Not sure what the stakes are. |
| 7.0 | key ArrowUp |  |  | Real time, 60 seconds. Heading up toward the door marker. |
| 17.6 | tap Keep quiet |  |  | Seen because my lantern was lit - I did not hide it first. Rule learned by failing it, which I dislike. Keeping quiet. |
| 18.3 | key l |  |  | Hiding lantern now. |
| 30.4 | key Enter |  |  | Trying to deliver. |
| 33.8 | first_minute |  | Night 1, 42s to dawn | Delivered after being seen once. Real-time but the clock moves with my steps, which is kind. Learned lantern rule by failing it. |
| 51.8 | key Enter |  |  | Trying to return home. |
| 54.2 | note |  |  | Morning report is the best part: each neighbour tells only what they saw. That is a nice small story. I now know hide-lantern is the rule. |
| 59.1 | tap Well box · closer, Danyal collects later |  |  | Change one thing: well box, and hide lantern at once. |
| 69.8 | tap Keep quiet |  |  | Seen again even with my lantern hidden - Tariq lantern light reaches me. Fine, keep quiet. |
| 88.6 | pulse 4 |  | Morning 2 | Gossip spreading through neighbours is a good small story; I want to see if I can beat it on night 3. |
| 102.4 | tap Keep quiet |  |  | Forgot lantern again, Tariq caught me at the start. I wish the lantern was hidden by default or the start screen said so. |
| 141.3 | want_quit | FINISHED |  | Ending reached. Tidy and clear; I would not replay immediately but might try to beat the gossip. |
| 149.1 | stop | FINISHED |  | I am stopping: ending reached. Feedback shows a note box, a share checkbox, Send feedback and Cancel; I did not type or send. |

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.4 | tap Well box · closer, Danyal collects later |  |  | On the phone I choose the well box, it sounds shorter for thumbs. |
| 7.9 | tap Lantern lit · hide (L) |  |  | Hiding lantern first now. |
| 22.0 | tap Explain |  |  | Tariq caught me despite hidden lantern. This time I try Explain to see the difference. |
| 48.3 | tap Leave envelope |  |  | I think I overshot the well; trying anyway. |
| 85.2 | TOOL tap |  |  | Shaking from cold, raising the lantern to warm up. |
| 95.3 | pulse 3 |  | Morning 1 | Phone: the lantern tap timed out (control looked disabled) and then the cold sent me home before I got home. I did not see that coming; I lost the night to a button I could not press. |
| 102.3 | tap Well box · closer, Danyal collects later |  |  | Well box again; I will keep the lantern lit this time and accept being seen. |
| 161.7 | tap Go inside |  |  | Home with 5 seconds left; that was tight. |
| 239.5 | want_quit | CONFUSED |  | I could not tell which tile counts as beside the marker; I stood next to Samira and the game said stand beside the marked tile, and dawn came. That loses me. |
| 246.1 | stop | CONFUSED |  | Stopping. Chose I am confused; a note box, share checkbox, Send feedback and Cancel appeared. I did not type or send. |


### Joseph Mwangi

**Would you return voluntarily?** Yes, I would come back another evening, for one more night of choosing, but only if walking stays easy on the keyboard and the 60-second walk stays short. I would not leave it running by itself, and I would not play it on the phone again unless the buttons got bigger.

**Ranked asks**
1. Tell me why I cannot step beside the door marker (desktop, night 1, door route) and why the figure stops. I could not tell if Samira or a wall was blocking me.
2. Make the phone arrow pad bigger and quicker. Walking 12 squares took about 12 separate taps and nearly cost me the night.
3. Warn me before the cold takes over. "You are shaking from cold" came with about 15 seconds left, and then I was carried home. Also stop the map jumping down when a new line of text appears.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.6 | tap Well box · closer, Danyal collects later |  |  | Closer sounds easier on an old man; plain wording, I understand the choice. |
| 16.9 | first_minute |  |  | Real-time with a 60s dawn clock, which I did not expect, but it pauses when Tariq speaks. Map is readable, labels help. |
| 31.4 | tap Move north |  |  | I cannot tell which little figure is me. |
| 67.7 | tap Go inside |  |  | Got home with 5 seconds left; the button name changes, which helped. |
| 70.6 | pulse 4 |  |  | Liked the neighbours speaking after; I like that the story is about quiet giving. Walking took many taps. |
| 79.3 | tap Return to play |  |  | Menu pauses and offers I am stopping / I am confused. Good, plain. |
| 93.3 | tap Explain |  |  | Trying the other answer for Tariq; it costs 3 seconds, I want to see what it changes. |
| 148.5 | pulse 4 |  |  | Door route took everything; I reached it but dawn came before I got home. Samira trusts me less. That stings fairly. Frustrating that tapping is slow, but the consequence reads clearly. |
| 212.0 | stop | FINISHED |  | Story ended after three nights. I understood the ending and was satisfied; I would try the door route differently. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 5.7 | tap Their door · farther, Samira knows it was you |  |  | Same story again. This time I will try the door, with the keyboard. |
| 58.1 | key ArrowDown |  |  | I cannot tell why I do not move right; maybe a wall. Cold is building, I am guessing. |
| 63.4 | pulse 3 |  |  | Cold sent me home before I could deliver; the door route is hard and I could not get beside the marker, unsure why (maybe Samira blocks the tile). Fair warning was given, but I kept the lantern hidden too long. |
| 114.0 | key Enter |  |  | Keyboard is much easier than the phone buttons. |
| 169.9 | stop | FINISHED |  | Second evening finished. I would come back another evening, perhaps to try the door route properly. |


### Claude cold player

Yes, I would come back on my own to see whether a third route changes what Samira, Idris and the village say about me. I would want a marker on the well delivery tile, and Danyal and Tariq kept off the doorway so a night is not decided in its first four steps.

**Ranked asks**
1. Mark the well delivery tile on the map, and say "Stand beside the well" on the well route. The door has a marker. The well still has none, and the text says "marked delivery tile".
2. Stop Danyal and Tariq confronting me within about four steps of Home. This happened on all five outings where I was seen. When I leave the envelope at the well, Danyal is the collector, yet he says "I saw your envelope. Explain or keep quiet."
3. Show what counts as "beside" the door marker. On desktop I stood diagonally next to it and got "Stand beside the marked delivery tile". Directly below it worked. The "Door · deliver beside marker" label also covers the neighbouring tile.

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.0 | tap Their door · farther, Samira knows it was you |  |  | Table loads at once, same as last time. |
| 16.1 | tap Keep quiet |  |  | Tariq stopped me 4 steps out with lantern lit; fair, I moved first. |
| 17.2 | first_minute |  | night 1, 52s | Table loaded instantly. Map shows Tariq right by Home again; he stopped me after 4 steps. Lantern button clear. Door marker is drawn. |
| 63.2 | note |  | night 1, 11s | Night 1 failed: I overshot the door row by one tile north, then cold rescue sent me home. The map shifts down as cold text appears, so controls slide off-screen on the phone. No gap between orange me and the door marker was obvious. |
| 78.9 | note |  | night 2, 48s | Danyal, who is the one meant to collect my envelope, stops me with I saw your envelope. Same oddity as before; it happened again 3 steps from Home. |
| 113.6 | tap Go inside |  |  | Button changed to Go inside at home; clear. |
| 116.4 | pulse 4 |  | morning 2 | Night 1 failed from my own overshoot and cold; night 2 well worked and the morning lines reflect who saw what. Still engaged. |
| 163.4 | tap Keep quiet |  |  | Danyal again, 3 steps out, with my lantern lit. Fair since lit. |
| 274.7 | stop | FINISHED | ending | Ending read: help reached them; Yusuf needs care. Matches what I did, including the rescue. Done for this device. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 21.1 | first_minute |  | night 1, 53s | Desktop map fits now, arrow buttons still cut at the fold but keys work. I hid the lantern with L, and Tariq still stopped me 4 steps out; his own light reached me. Fair given the text, but he sits right beside Home. |
| 70.3 | note |  | night 1 end | Delivered at the door with lantern hidden but cold rescue still came at the end, a few tiles from Home. Diagonal tile beside the marker did not count; directly below worked. Lost me for a moment: the marker label covers the neighbouring tile. |
| 92.1 | tap Explain |  |  | Danyal is the well keeper and still challenges me; I will explain to see what it buys. |
| 126.2 | pulse 4 |  | morning 2 | Explaining once to Danyal shows up in the mornings straight away: Idris wanted to choose who knew, Samira trusts me less. Keeps me invested. Well tile still unmarked but I guessed it right from last visit memory. |
| 182.0 | stop | FINISHED | ending | Second ending, trust-cost version: village guessing, Samira asks Danyal to wait. Done for tonight. |
