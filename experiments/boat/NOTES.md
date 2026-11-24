# Paper Boat (`/boat/`)

Built 2026-11-24. A folded paper boat rides a rain gutter to the pond. The player never steers the boat. They move the water.

## Rules (all in `sim.js`, fixed step 1/60 s, seeded)

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

## Bot results (`node bots.mjs`, 2026-11-24, exit 0)

- Untouched: street 1 wins (22.5 s, 37% soak, 0 passengers); street 2 is lost to the drain; the daily stream ends (drain, 23 points).
- Determinism: same seed and inputs give a byte-identical state; another seed differs; a daily piece is fixed by its date.
- **Careful bot** (tries 9 moves on a copy of the stream, 190 ticks ahead, 3 seeds per street): finishes **30/30**; 3 stars on 27/30 (it missed one passenger on street 3 once and street 4 once, and arrived 69% soaked on street 4 once). Times 11 to 54 s, 18 to 87 moves.
- **Clumsy bot** (looks 0.75 widths ahead, decides every 0.5 s, rests 0.9 s, pushes the wrong way 22% of the time, never seeks passengers; 200 runs per street): success by street **100% 94% 81% 86% 87% 81% 42% 70% 29% 28%**. Means: streets 1-3 91%, 4-7 74%, 8-10 42%.
- Daily stream, 3 dates: careful 602, 1499, 1386 points (124 to 204 s, all ended by soak); clumsy mean 142 over 20 runs per date.
- **Mutation** (`node bots.mjs --mutate`: `flow()` ignores ripples and pebbles; policies unchanged): exit 1. Careful finishes 2/10 (quick run, 1 seed), clumsy street 2 falls to 0%, daily careful 23 points; 5 checks fail including both touch checks.

## Phone check (`check.mjs`, 2026-11-24, both PASS)

WebKit iPhone 13: street 1 won in 12.5 s, 2 passengers, 3 stars, 15 swipes and 1 tap. Chromium Pixel 7: 14.0 s, 2 passengers, 3 stars, 10 swipes, 3 taps. Input is real mouse gestures on the canvas, chosen by the careful policy in the page. Also checked: a swipe makes a ripple and moves the boat; a tap drops a pebble; pause freezes; blur pauses; P resumes; street 2 untouched ends in the drain with Retry in one tap; save survives reload; daily seed and best; sound setting persists; one lab `run` record with a `pickup` event marked `agent`; 48 px targets, no text under 14 px, no overflow at 390, 412, 360x640 and 1280x800; arrow keys and space on desktop; zero page, console, request and HTTP errors. Screenshots: `/private/tmp/night-boat/`.

## Not verified

- Sound on a real phone. No person has played it; "a stranger finishes street 1 in under a minute with no words read" rests on the untouched boat winning in 22.5 s and on the cue, not on a person.
- The shared finger hint is wired but the check does not assert that it appears.
- The lab Worker must list the slug `boat` (human-framework `LAB_PROTOTYPES`) before any record is stored. The check answers the endpoint itself.
- `kit/check/phone.mjs` has no `boat` section and no `boat-save` / `boat:hint` seed yet (outside this folder).
- Frame rate on a slow phone (95 flow samples per frame plus the boat).

## Known gaps and ideas left open

- Clumsy success is not monotone street by street (street 7, Downpipe Row, 42%, is harder for it than street 8, 70%). Either swap them or soften the first gush.
- The careful bot arrives very dry (5 to 18% typical) because pushing downstream is cheap. Soak only bites slow players; the third star may be too easy for a fast one. A cost per ripple, or a soak splash on a ripple that hits the boat head-on, would make it a real trade.
- The pebble is never taught without words; the menu line says it. A street where only a pebble works (a narrow gap held open) would teach it.
- The snail is only a second look. It could make the boat heavier (slower to turn).
- Daily board shared between players (as Seed Sling does) is not built; best is device-only as asked.
- No haptics, no colour-blind check of the paw warning (it also grows and pulses).
