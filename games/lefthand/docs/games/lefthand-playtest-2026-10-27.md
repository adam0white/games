# The Left Hand same-tester retest, 2026-10-27

- **Build tested:** live https://lefthand.adamwhite.work at `6c34992` (`/release.json` `dirty:false`), opened with `?labRunSource=agent`.
- **Tester:** the same cold Claude player as the 2026-10-26 fairness pass (`lefthand-fairness`). It was a Claude Sonnet agent that read only its own earlier notes.
  - The Left Hand has had no lab-panel round yet. This is one tester, not a panel.
- **Method:** the harness lab driver ran two sessions. Recording stayed on, and the runs are labelled as agents.
  - Session A: 360x690 phone, careful play.
  - Session B: 1280x800, careless play.
  - Both reached the night 3 ending. The endings were "Help reached them; Yusuf needs care" and "Help reached them; trust was lost".
- The agent did not log its stop lines through the driver. Its stop words below come from its report.

## Verdict: finished (no new blocking ask)

Return sentence (mixed): "Yes, I would come back on my own to see whether a third route changes what Samira and Idris say about me, as long as the well tile is marked so I do not lose a night to guessing where to stand."

The earlier top fixes are met in the tester's words:
- The lantern reads as an action.
- Concealment and cold change the ending.
- The door marker is drawn.

The well marker is a variant of the earlier door-marker fix, which the tester marked "partly" met. It is a prior ask, not a new one.

### Remaining asks (on the design Deferred list, target 2026-11-10)

1. The well route says "Stand beside the marked delivery tile, then leave the envelope," but only the door is marked. Proposed fix: draw the well marker and say "Stand beside the well".
2. "Reduce stuck moves on the way to the door. The houses east of Home cost me two attempts."
3. "Start Tariq farther from Home, or show where he is looking."
4. The "Danyal" label still overlaps "Well". The desktop arrow buttons sit at the fold.
5. Danyal says "I saw your envelope" when he is the collector the player is meant to meet.

## Tester ledger

Disposition: keep is yes with no condition; mixed is yes or maybe with a condition; quit is a sentence that opens with no or not tonight. Session times are the driver's elapsed seconds at the stop line, not the player's own estimate.

| tester | commit | sessions (device, stop reason, driver time) | return sentence | disposition |
| --- | --- | --- | --- | --- |
| Claude cold player | 6c34992 | phone no stop line, last entry at 1200 s; desktop no stop line, last entry at 1200 s | Yes, I would come back on my own to see whether a third route changes what Samira and Idris say about me, as long as the well tile is marked so I do not lose a night to guessing where to stand. | mixed |

## Player words

Each tester's return answer and ranked asks are their report's own words. The diary rows are the raw driver diary (`wall-clock.jsonl`), every line that carried words, unedited. Coordinator paths are shortened.

### Claude cold player

**Return sentence:** Yes, I would come back on my own to see whether a third route changes what Samira and Idris say about me, as long as the well tile is marked so I do not lose a night to guessing where to stand.

**New blocking problems:** none that stops a player. The nearest is on the well route. The prompt says "Stand beside the marked delivery tile, then leave the envelope." The only marker drawn is at Idris's door, not at the well. On careless night 3, "Leave envelope" from a tile beside the well icon returned that same line. I walked home with the envelope and lost about 15 seconds of a 60-second night. The tile directly above the Well icon worked.

---

#### Retest: The Left Hand, cold player (claude, 2026-10-27)

Same tester as 2026-10-26, screen only. Recording stayed ON. Session A was 360x690 touch, careful. Session B was 1280x800, careless. I used no speed control and saw none offered. The menu has Return to play, I'm stopping, I'm confused, Fullscreen, New game and All games. Both sessions reached the ending on night 3, so neither hit the ceiling. I sent keypresses a few at a time, so some stuck or dropped moves may be my slowness, not the game.

#### First minute
- The table screen appears at once. The notice reads "Play is recorded and linked across the Lab by default. Turn recording off · Privacy".
- The table text now says: "Hiding your lantern helps you stay unseen, but the cold builds." That teaches the trade before the first step.
- "Lighting the village… You can choose a route now." still shows.
- On desktop, after choosing the well box, the map was blank for a few seconds. The text read "Your route is chosen. The night begins when the village is ready." The map then appeared.
- The lantern button reads "Lantern lit · hide (L)", then "Lantern hidden · light (L)". It now reads as an action. The lantern still starts each night lit.
- A "Door · deliver beside marker" label and marker now sit at Idris's door.

#### Tension
- Yes, and clearer. In the careful run I hid the lantern and was still seen by Danyal's own lantern: "Danyal raises his lantern. “I saw your envelope.” Explain or keep quiet. The dawn clock waits for your reply."
- Cold came in two steps: "Your hands are numb. Raise the lantern to recover warmth." then "You are shaking from cold. Raise the lantern or head home before you need rescue."
- On night 3 of the careful run I was too slow and the cold forced me home: "The cold forced you to seek shelter. A neighbour missed work to bring you home. You owe that work, and exhaustion shortens later nights."

#### Can a careless player lose?
- Not by failing to deliver in my runs. Both delivered on at least two nights. I did not retest idling.
- They can lose what they keep. The careless run (lantern lit, explained every time) ended "Help reached them; trust was lost": "Repeated exposure made their need village talk. Idris keeps his distance; Samira no longer trusts Yusuf with a private delivery. Future help must be arranged with them directly."
- The careful run ended "Help reached them; Yusuf needs care". Concealment and cold now change the ending, which was my main complaint last time.

#### The moment I cared most
Night 3 of the careless run. The table text read: "After the village talk, Samira waits to meet Danyal alone, so well collection now takes 6 seconds. At the door there is no wait, but Samira sees who brings it." My earlier explaining had cost me a faster well. The morning lines showed it too: "Idris: The help is ours, but everyone discusses our need now. I will not discuss it with Yusuf."

#### Fairness and teaching items
- The seeing rules are taught before play: your lantern, a lamp or a neighbour's lantern can light you.
- I was never seen on the Home tile before my first step in the six nights I played. That old problem did not recur.
- Tariq still stops me soon after I leave. On careful night 3 he stopped me about 18 seconds in, just north of Home: "Tariq turns. “Is that for Idris?”" I had moved first, so it is fair, but his patrol still sits near the doorway.
- Well marker gap: the "marked delivery tile" prompt appears for the well route, but only the door is marked (see the blocking note above).
- When Danyal is the collector and also sees me, he says "I saw your envelope. Explain or keep quiet." That is odd when he is the person I am meant to meet. It happened both times I went to the well in the careful run.

#### Top 3 fixes (now)
1. Mark the well delivery tile. Say "Stand beside the well" on the well route.
2. Reduce stuck moves on the way to the door. The houses east of Home cost me two attempts. Show the lane, or let movement slide along walls.
3. Start Tariq farther from Home, or show where he is looking.

#### Copy bugs
- Fixed: "1 seconds of conversation remain". I saw "3 seconds of conversation remain".
- Fixed: the morning "Yusuf: You returned home. …" repeat. Mornings start "You returned home. The household keeps the help." and then the four neighbours.
- Fixed: the ending headline no longer prints twice in either ending I read.
- Not seen: the "30-second wait" versus "30 game seconds" intro line.
- Not fixed: the "Danyal" label overlaps "Well" on the canvas, in both sessions.
- Odd: careful night 2, well route, Danyal collected the envelope. Morning line: "Danyal: I saw Yusuf carrying an envelope at the lane. I cannot say who the envelope was for."
- Minor: careful morning 3 says "Samira: We managed this morning. We need help before the next one." Two nights had already succeeded.
- At 1280x800 the map fits, but the arrow buttons are cut off at the bottom edge in every desktop screenshot. Arrow keys did not scroll the page in my run.
- Not seen: the see-through Paused menu. I did not screenshot the menu.
- Not seen: the cold warning staying on the final screen.

#### Plain English
Good. Every sentence reads without Turkish. "Collection · 3s" on the button is short and clear. The Explain/Keep quiet text is long but plain. The ending paragraphs are clear.

#### Faith from the screen
The one faith line is unchanged: "Yusuf understands concealed voluntary giving as preferable; open giving is also good." It links Qur'an 2:271 and Bukhari 1423 and is framed as Yusuf's understanding. Mornings and endings report only material and social outcomes: food and fuel, trust, exhaustion, owed work. No score, merit or acceptance is shown or implied. Pass.

#### Lab note
- Endings seen: "Help reached them; Yusuf needs care" (careful) and "Help reached them; trust was lost" (careless).
- Recording stayed on. I did not touch the consent controls. I opened the menu only to read it, and submitted no feedback.
- Several Up presses were lost beside the houses east of Home on careful night 3. I cannot tell whether that was my pacing or the map.

#### Compared with my last play
Earlier top 3 fixes:
1. **Lantern control: fixed.** "Lantern lit · hide (L)" and "Lantern hidden · light (L)" now read as actions. It still starts lit. I did not see the player's own pool drawn more clearly.
2. **Make concealment and cold count: fixed.**
   - Endings: "Help reached them; Yusuf needs care" and "Help reached them; trust was lost".
   - Rescue: "The cold forced you to seek shelter. A neighbour missed work to bring you home. You owe that work, and exhaustion shortens later nights."
   - Slowdown: "well collection now takes 6 seconds".
3. **No sighting before the first move, and mark the door tile: partly.**
   - Door marker: fixed. "Door · deliver beside marker" is drawn.
   - Sightings: no sighting before my first step in six nights. Tariq still stops me soon after leaving.
   - Well route: not fixed. There is no marker there.

Earlier copy bugs:
- "1 seconds": fixed.
- Two clocks both called seconds: not seen.
- "Yusuf:" narrator repeat: fixed.
- Ending headline printed twice: fixed.
- Cold warning on the table and final screen: not seen.
- Danyal "carrying an envelope" on a night I never left home: not seen.
- "Dānya"/"Danyal" overlapping "Well": not fixed.
- See-through Paused menu: not seen.
- Desktop map below the fold: partly. The map fits, but the arrow buttons sit at the fold.
- Arrow keys scrolling the page: not seen.
- Slow dawn clock while standing still: not seen.

#### New blocking problems
None that stops a player. Closest: the missing well marker, described above.

#### Would you return voluntarily?
Yes, I would come back on my own to see whether a third route changes what Samira and Idris say about me, as long as the well tile is marked so I do not lose a night to guessing where to stand.

#### Verbatim
Session A (360x690, careful), log lines I sent:
- first_minute: "Table screen loads fast. Notice about recording and two choices: door or well box. Text now says hiding lantern helps but cold builds." (evening 1)
- note: "Danyal saw me on night 1 at about 8 tiles from the door with my lantern hidden; his own lantern lit me. I chose Keep quiet. The text before said a neighbour lantern can light you, so fair, but I had no visual of his light range beforehand." (52s to dawn)
- note: "Night 2 I chose the well box. Leave envelope said Stand beside the marked delivery tile, but the only marker drawn is still Door · deliver beside marker at Idris. No marker at the well. Confusing." (night 2, 48s)
- note: "Night 3 again a neighbour (Tariq) stopped me near Home within seconds of leaving. Home is fair-ish now because I did move first, but Tariq and the home tile are still tightly linked." (night 3, 42s)
- pulse: "Ending names the rescue, exhaustion, Tariq guess and quiet thanks. The ending now counts concealment and cold. I felt it was earned." (after three nights)

Session B (1280x800, careless), log lines I sent:
- first_minute: "Desktop: after picking well box the map area is blank dark with Your route is chosen. The night begins when the village is ready. Then it loads." (night 1 start)
- note: "On night 3 the Stand beside the marked delivery tile message appears for the well box too; the only marker drawn is at Idris door. I could not tell whether I was beside the well. I wasted about 15 seconds walking home with the envelope." (night 3, 46s)
- pulse: "Careless run: explaining every time changed morning lines and slowed the well to 6 seconds. Consequences felt real. Ending read next." (after three nights)

Screenshots are in `lefthand/cold/phone/` (a-001 to a-026) and `lefthand/cold/desktop/` (b-001 to b-015).

**Phone (360x690 touch phone)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 3.7 | first_minute |  | evening 1 | Table screen loads fast. Notice about recording and two choices: door or well box. Text now says hiding lantern helps but cold builds. |
| 19.5 | note |  | 52s to dawn | Danyal saw me on night 1 at about 8 tiles from the door with my lantern hidden; his own lantern lit me. I chose Keep quiet. The text before said a neighbour lantern can light you, so fair, but I had no visual of his light range beforehand. |
| 79.4 | note |  | night 2, 48s | Night 2 I chose the well box. Leave envelope said Stand beside the marked delivery tile, but the only marker drawn is still Door · deliver beside marker at Idris. No marker at the well. Confusing. |
| 122.0 | note |  | night 3, 42s | Night 3 again a neighbour (Tariq) stopped me near Home within seconds of leaving. Home is fair-ish now because I did move first, but Tariq and the home tile are still tightly linked. |
| 156.7 | pulse |  | after three nights | Ending names the rescue, exhaustion, Tariq guess and quiet thanks. The ending now counts concealment and cold. I felt it was earned. |

**Desktop (1280x800 keyboard and mouse)**

| elapsed s | entry | reason | game clock | words |
| --- | --- | --- | --- | --- |
| 6.9 | first_minute |  | night 1 start | Desktop: after picking well box the map area is blank dark with Your route is chosen. The night begins when the village is ready. Then it loads. |
| 166.4 | note |  | night 3, 46s | On night 3 the Stand beside the marked delivery tile message appears for the well box too; the only marker drawn is at Idris door. I could not tell whether I was beside the well. I wasted about 15 seconds walking home with the envelope. |
| 188.1 | pulse |  | after three nights | Careless run: explaining every time changed morning lines and slowed the well to 6 seconds. Consequences felt real. Ending read next. |
