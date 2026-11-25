# Paper Boat (`/boat/`)

Built 2026-11-24. A folded paper boat rides a rain gutter to the pond. The player never steers the boat. They move the water.

## Initial rules (before the revision below; fixed step 1/60 s, seeded)

- The gutter is 1 wide. The current runs at 0.3 widths/s, faster mid-stream, with a slow seeded meander. The boat's velocity relaxes to the local current (rate 5/s).
- **Swipe = ripple.** A ripple starts where the finger started, travels 0.5 widths/s the way it was drawn, lives 1.6 s and pushes water near it. Longer swipe, stronger push (full strength at a third of the gutter). At most 4 at once. One full ripple moves the boat 0.43 widths sideways.
- **Tap = pebble.** It stays 7 s (3 at once), the current parts round it, and the boat cannot pass through it. A pebble ahead-left turns the boat 0.15 widths right.
- **Drain:** a sink in the flow field. Within 0.065 of the centre the boat is lost.
- **Leaf:** slows the boat to 30% and soaks it 0.085/s faster.
- **Cat's paw:** a shadow grows for 1.3 s, then the paw lands. A boat within 0.19 takes +30% soak and a shove.
- **Downpipe gush:** a band of cross-current (0.21). **Rapids:** a band 75% faster.
- **Passengers** (ladybird, snail) wait on cork rafts. Passing within 0.125 picks one up; it bails a little water (soak -8%, -16% in the daily stream).
- **Soak** rises all the time. At 100% the boat sinks. On a street an untouched straight run arrives about 40% soaked.
- **Stars:** 1 for the pond, 2 with every passenger, 3 with every passenger and under 62% soak.
- **Ten streets**, one new thing each: ripple, drain, three drains (pebbles help), leaves, a snail on a leaf, the paw, downpipes, rapids, a slalom, everything.
- **Today's stream:** endless, generated in pieces of 2.2 widths from the UTC date, the same for everyone. Hazards get denser, the current faster (to +60%) and the soak rate rises with distance, so every run ends. Score = 10 per width + 25 per passenger. Best and the last 60 days are kept on the device. Opens from the menu after one finished street; Play goes there after street 10.

## Decisions that shaped it

- Downstream is up the screen and the boat sits at 70% of the height, so the thumb works beside the boat and the eye sees 1.7 widths ahead.
- Two tools, one thumb: movement under 14 px is a tap. A long drag lays a ripple every third of a gutter.
- Street 1 has no danger. An untouched boat reaches the pond with 1 star (22.5 s). Gold chevrons on the water show the sweep until the first touch (streets 1 and 2). The shared hint is `hold-and-move`, key `boat:hint`, after 2.5 s idle.
- Passengers bail water, so the daily stream has a reason to take risks.
- The streamlines are 95 particles carried by the same `flow()` the boat feels, so what the player sees bending is the rule itself.

## Initial bot results (`node bots.mjs`, 2026-11-24, exit 0)

- Untouched: street 1 wins (22.5 s, 37% soak, 0 passengers); street 2 is lost to the drain; the daily stream ends (drain, 23 points).
- Determinism: same seed and inputs give a byte-identical state; another seed differs; a daily piece is fixed by its date.
- **Careful bot** (tries 9 moves on a copy of the stream, 190 ticks ahead, 3 seeds per street): finishes **30/30**; 3 stars on 27/30 (it missed one passenger on street 3 once and street 4 once, and arrived 69% soaked on street 4 once). Times 11 to 54 s, 18 to 87 moves.
- **Clumsy bot** (looks 0.75 widths ahead, decides every 0.5 s, rests 0.9 s, pushes the wrong way 22% of the time, never seeks passengers; 200 runs per street): success by street **100% 94% 81% 86% 87% 81% 42% 70% 29% 28%**. Means: streets 1-3 91%, 4-7 74%, 8-10 42%.
- Daily stream, 3 dates: careful 602, 1499, 1386 points (124 to 204 s, all ended by soak); clumsy mean 142 over 20 runs per date.
- **Mutation** (`node bots.mjs --mutate`: `flow()` ignores ripples and pebbles; policies unchanged): exit 1. Careful finishes 2/10 (quick run, 1 seed), clumsy street 2 falls to 0%, daily careful 23 points; 5 checks fail including both touch checks.

## Initial phone check (`check.mjs`, 2026-11-24, both PASS)

WebKit iPhone 13: street 1 won in 12.5 s, 2 passengers, 3 stars, 15 swipes and 1 tap. Chromium Pixel 7: 14.0 s, 2 passengers, 3 stars, 10 swipes, 3 taps. Input is real mouse gestures on the canvas, chosen by the careful policy in the page. Also checked: a swipe makes a ripple and moves the boat; a tap drops a pebble; pause freezes; blur pauses; P resumes; street 2 untouched ends in the drain with Retry in one tap; save survives reload; daily seed and best; sound setting persists; one lab `run` record with a `pickup` event marked `agent`; 48 px targets, no text under 14 px, no overflow at 390, 412, 360x640 and 1280x800; arrow keys and space on desktop; zero page, console, request and HTTP errors. Screenshots: `/private/tmp/night-boat/`.

## Initial verification gaps

- Sound on a real phone. No person has played it; "a stranger finishes street 1 in under a minute with no words read" rests on the untouched boat winning in 22.5 s and on the cue, not on a person.
- The shared finger hint is wired but the check does not assert that it appears.
- The lab Worker must list the slug `boat` (human-framework `LAB_PROTOTYPES`) before any record is stored. The check answers the endpoint itself.
- `kit/check/phone.mjs` has no `boat` section and no `boat-save` / `boat:hint` seed yet (outside this folder).
- Frame rate on a slow phone (95 flow samples per frame plus the boat).

## Initial gaps and ideas

- Clumsy success is not monotone street by street (street 7, Downpipe Row, 42%, is harder for it than street 8, 70%). Either swap them or soften the first gush.
- The careful bot arrives very dry (5 to 18% typical) because pushing downstream is cheap. Soak only bites slow players; the third star may be too easy for a fast one. A cost per ripple, or a soak splash on a ripple that hits the boat head-on, would make it a real trade.
- The pebble is never taught without words; the menu line says it. A street where only a pebble works (a narrow gap held open) would teach it.
- The snail is only a second look. It could make the boat heavier (slower to turn).
- Daily board shared between players (as Seed Sling does) is not built; best is device-only as asked.
- No haptics, no colour-blind check of the paw warning (it also grows and pulses).


## 2026-11-24 — Street order, pebble lesson, and dry-paper decisions

Changes:

- Streets now run Mill Lane, Grate Street, Split Grate, Snail Corner, Cat Alley, Leaf Fall, Steep Hill, Downpipe Row, Market Slalom, Pond Road. Rapids precede cross-current. The late Pond Road drain moved from x=0.60 to x=0.50, and another side drain was added at (0.86, 15.1). The first Leaf Fall passenger moved from y=3.8 to y=4.4 so the boat can clear the leaves before turning for it.
- Street 3 replaces its first ordinary drain with a broad grate at (0.50, 2.80). Before a pebble parts it, the intake spans the gutter. The ghost finger appears within 1.3 widths and taps (0.42, 2.58). A stone within 0.13 horizontally and 0.14 vertically of that target reduces suction from 0.42 to 0.08 and opens two paths. The center retains its 0.065 capture radius. The stone lasts the existing 7 seconds. Expiry closes the paths. Water particles use the same flow as the boat. This is a game rule for the grate, not a fluid simulation.
- The clumsy policy can copy that visible ghost once, with x error up to 0.03 widths. Otherwise it remains the same late, inaccurate, passenger-indifferent policy. Its rates therefore include this new hint response. The check now requires a strict drop across all 9 adjacent street pairs, in addition to the existing grouped and final-street checks.
- A nearby full ripple adds up to 2% soak, scaled by amplitude and exp(-distance² / 0.06). Distant ripples do not wet the boat. Passive soak and pickup bailing are unchanged. A carried snail halves passive soak; leaf soak, paw splashes, bank bumps and ripple splash remain unchanged. Ladybirds retain the pickup bail without that ongoing shelter. Snails do not stack their benefit. A shell arc around the HUD rain drop shows when shelter is active.
- Third star now needs every passenger and **under 53% soak**, strengthened from under 62%. The old limit left too much margin after the splash change. The bot requirement of at least 80% three-star runs remains unchanged. The HUD marks the same limit at 47% dry paper. No check threshold was loosened.
- The phone check asserts the shared hold-and-move hint, visible hand, pointer transparency, real-input dismissal, and persisted boat:hint. It also plays the grate with a real ghost-target tap and waits for passage before resuming policy input. Captures use CSS-pixel scale to reduce capture overhead; viewport, device profile, all gameplay limits and UI checks remain unchanged. The moving target is read again after restarting the screenshot run, so capture time cannot make the click stale.

Independent references:

- One full ripple at the boat adds exactly 2.000% soak. The distant comparison adds zero.
- Identical one-second runs: ladybird 1.656% passive soak; snail 0.828%; movement states identical.
- Same street-1 two-passenger route, then different finishing strokes: spaced strokes 10.93 s / 28.81% soak / 3 stars; rapid strokes 9.53 s / 75.03% soak / 2 stars; continuous strokes sink at 100%. The rapid finishing case is a deliberately excessive-input reference, not a claim about typical phone input frequency.
- Untouched and ripple-only boats fail at the broad grate. Copying its ghost tap alone passes it; seed 5 finishes the whole street without further input. The expiry check proves the paths close again.

Verification commands use `fnm exec --using=26.12.0 node` and the supplied Playwright installation.

- The rule references above pass. The careful bot finishes 30/30, with 27/30 three-star runs (90%); arrival soak spans 24–68%. The 6 retests of the two final tuning changes all finish with 3 stars.
- `bots.mjs --mutate` exits 1 with 9 failed checks. Careful finishes 8/30 and gets 3 stars on 1/30. Daily careful scores 23, 67, 344 (mean 145 versus clumsy 98); the unchanged flow-control checks, grate passage, third-star trade and daily performance checks detect the mutation.
- Reviewed the phone screenshots of the shared hint, grate ghost, parted water, play and ending in `/private/tmp/night-boat/`. Screenshots are observations of the emulated browsers, not real phones.

Remaining gaps:

- The separate `experiments/kit/check/phone.mjs boat` run passes its ordinary Boat cases on both engines, but its hint cases fail on both. Its generic gesture moves 40 px, waits for a ripple, then releases. Boat previews that short stroke and creates the ripple on release; live repeated ripples start only after a third-gutter drag. The Boat-local check releases and verifies actual ripples plus hint dismissal. No kit files were changed in this folder-only task. Follow-up dated 2026-11-25: make the kit Boat gesture release before asserting the ripple, or use a full-length drag.
- No real phone, sound, slow-device frame-rate, human wordless-learning, or live lab-Worker delivery verification. Lab requests in the local check are intercepted. No deployment was requested.

Final phone checks, each exit 0:

- `check.mjs webkit` (iPhone 13): street 1 16.8 s, 2 passengers, 3 stars, 9 policy swipes and 1 policy tap, in addition to the initial input probes.
- `check.mjs chromium` (Pixel 7): street 1 17.5 s, 2 passengers, 3 stars, 6 policy swipes and 1 policy tap, in addition to the initial input probes.
- Both: shared hint assertions, one-tap grate passage before policy input, street-3 finish, untouched street-2 drain loss/retry, pause/blur/P, save/reload, daily/best, sound persistence, desktop keyboard, 48 px targets, 14 px minimum DOM text, 360 px width, desktop layout, zero page/console/request/HTTP errors. Phone recording requests are intercepted; the tests do not verify server storage.

Full-sample clumsy difficulty (200 seeds per street):

| Street | Wins / 200 | Success |
| --- | ---: | ---: |
| 1 — Mill Lane | 200 | 100.0% |
| 2 — Grate Street | 187 | 93.5% |
| 3 — Split Grate | 172 | 86.0% |
| 4 — Snail Corner | 171 | 85.5% |
| 5 — Cat Alley | 168 | 84.0% |
| 6 — Leaf Fall | 166 | 83.0% |
| 7 — Steep Hill | 139 | 69.5% |
| 8 — Downpipe Row | 103 | 51.5% |
| 9 — Market Slalom | 53 | 26.5% |
| 10 — Pond Road | 36 | 18.0% |

All 9 strict adjacent comparisons pass. Group means: streets 1–3 93.17%, 4–7 80.50%, 8–10 32.00%. These are reproducible measurements of the defined bot and seed set, not a claim about people or every possible seed sample.

Final `bots.mjs` exits 0: all checks pass, including all 9 adjacent difficulty comparisons, 30/30 careful finishes, and 27/30 three-star finishes. Daily streams 20261124 / 20261125 / 20261126 score 397 / 784 / 968, carry 6 / 12 / 16 passengers, and end by soak at 69 / 128 / 150 s (times rounded by the runner). Mean careful score 716 versus clumsy 116 (runner-rounded), above both unchanged performance thresholds. Generated pieces 1–59 pass the paired-drain gap check. `git diff --check -- experiments/boat/` also passes. No commits or deployment.

## 2026-11-24 — Music

The shared score (`../kit/music.js`) now plays under Paper Boat, behind a **Music: on/off** button beside Sound (key `boat-music`, `'0'` = off). Music off, or Sound off, leaves the game as it was: the original sounds only. Sound off does not suspend the audio context in this game, so the score also checks `save.sound` before it plays.

**Preset: `river`.** Water in a gutter: a thin pad and plucked notes in a wide echo. Minor chords down the street, turning major near the pond. Override (`song.js`): the river's pickup note at 0.2 instead of the kit's 0.1, for the level reason below.

**Mapping (`song.js`, used by the page and by `bots.mjs`).**
- progress: way down the street, `(y − 0.3) / (length − 0.3)`; the daily stream has no end, so it fills over 150 s and stops at 0.8 (before the turn to major).
- danger: a drain ahead within 0.8 street units that the boat is heading for (within 0.4 sideways, or any closed grate across the gutter), or a warning paw within 0.4 ahead/behind and 0.3 sideways. It drives the heartbeat.
- light: dry paper left, `1 − soak`. Low light brings the high note.
- A note (ember): each passenger taken, and each drain or paw the boat gets past (crossing y + 0.15) without sinking.
- A miss: a passenger gone past untaken (the streak ends).
- A blow: a paw swat (the music thins for two bars).
- Not mapped: kerb bumps, pebble knocks, leaves. They keep their own sounds.
- A pickup that earns a note plays the chord tone instead of its two tones; with music off it plays the original two tones.

**Volume 0.35.** Rendered offline at volume 1 (headless Chromium): bed peak 0.158, RMS 0.0239; late bed RMS 0.0244; one melody note alone peak 0.15; heartbeat peak 0.223; worst case (full danger, ending, light 0.1, a note every 0.2 s, a blow) peak 0.384. At 0.35:
- Bed RMS 0.0084 ≤ ripple tone 0.035 / 4 = 0.00875 (the quietest regular effect; the 0.006 ambient drips are ignored). Pass, narrowly.
- Melody note 0.0525 = 0.75 × the pickup tone 0.07 it replaces (window 0.5–2×). Pass. With the kit's 0.1 lead it would be 0.375×, so the lead is doubled.
- Worst 0.134 + loudest effect (swat: square 0.1 + noise 0.32) = 0.554 < 0.9. Pass.

**Checks (all 2026-11-24).**
- `node bots.mjs music`: 74 runs (each street careful seed 1 + clumsy seeds 1–6, daily 20261124/5 careful and clumsy), 38.5 min of play, 295 notes (7.7 per minute), 0 waits, 70 left-behind misses, 1 swat, 243 heartbeat pulses, a heartbeat within 2.5 s before 19 of 19 drains, 24 high notes, latest note 319 ms after its step, 0 failures.
- `node bots.mjs music --mutate`: a left-behind passenger playing a note gives 140 failures; a note every second gives 4810 failures. Both caught (exit 1).
- `node bots.mjs`: all checks pass, including the music claims (exit 0). `--mutate` (old) still fails 9 checks as intended.
- `kit/check/phone.mjs boat` (with the new `music:` entry in `pages.mjs`) and `check.mjs`: pass on WebKit and Chromium, 0 errors.
- A scripted Chromium play of street 1 by the page's own advice: won with 2 passengers; the score played 2 notes, 0 misses, pads, bass and walk.

**Words.** `words.js` holds only the music button's strings (English and Turkish: "Müzik: açık/kapalı"). The rest of the game stays English; the page's `lang` stays `en` and the button carries its own `lang`.

**Not verified.** Nobody has listened to it. The levels are measured, not heard. Not played on a real phone.

**What to listen for.**
- A plucked note on each passenger taken, and on each drain or paw got past; silence where a passenger is left behind.
- The music thinning for two bars after a swat.
- A heartbeat when heading at a drain or under a warning paw, and none on open water.
- A high note when the paper is soaked past about 72%.
- Chords brightening to major near the pond (not in the daily stream).
- The ripple's splash still clearly above the bed; the bed should sit under it, not mask it.
