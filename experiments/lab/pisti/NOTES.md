# Pişti (lab experiment)

The Turkish fishing card game for two, on a phone: one hand against a bot, a match to 51, Today's deal, two players passing one phone, or two friends playing by link. Static page at `/lab/pisti/`. Only friend tables use the network. The page uses no images or external fonts and needs no build step.

Files: `sim.js` (rules, pure, seeded), `brain.js` (the bot, pure), `main.js` + `index.html` (the page), `bots.mjs` (rules and bot checks), `check.mjs` (phone check).

## Rules used

Source: https://www.pagat.com/fishing/pishti.html (read 2026-11-24). Pagat describes four players in partnerships and says the two-player game is the same. Where the page is silent or gives options, these are the choices:

- 52 cards. The cut leaves a non-jack on the bottom of the pack; it lies face up under the stock and the dealer receives it in the last deal (pagat says this for four players; with two it is the 52nd card, which goes to the dealer).
- Four cards to the centre. They form the start of the pile: three face down, the top one face up. If the turned card is a jack, it stays face up and the next is turned. Four jacks in the centre: redeal (from a seed derived from the deal's seed).
- Two players: four cards each, the non-dealer leads, six deals in all (4 + 6 x 8 = 52).
- A card of the same rank as the top card, or any jack, takes the whole pile. The first capture therefore also takes the hidden centre cards.
- A jack played on an empty table stays there as a lone card (pagat does not say).
- Pişti: taking a pile of exactly one card with a card of the same rank scores 10; a jack taking a lone jack scores 20 (pagat's double pişti). A jack taking a lone non-jack is an ordinary capture. No pişti on the very first card of the hand (it cannot happen here, because the pile starts with four cards) or on the dealer's very last card (pagat's two exclusions).
- At the end, cards left on the table go to the last player who captured (to the dealer if nobody captured; pagat does not say).
- Scoring: each jack 1, each ace 1, 2♣ 2, 10♦ 3, most cards 3 (nobody at 26 each), each pişti 10 or 20. Card points total 13, so 16 per hand plus piştis.
- Match: first to 51 at the end of a hand, as the brief asks (pagat plays to 151). If both reach 51 level, another hand is played.
- Not used: the bluffing variant, and the variants that count jack-on-jack as 10 or nothing.

## The three twists

1. **The same deal for everyone.** Today's deal uses the seed `FNV-1a("pisti:" + UTC date)`, the Medium bot and the player leading, so every player gets the same cards and the same replies to the same plays. The first card played that day makes the attempt the scored one (quitting does not give a second try); later plays that day are marked Practice. The result card shows the margin and a strip of icons, one per capture in order (flame: pişti; flame in a ring: double pişti; crown: jack capture; stack: match capture), bright for the player and grey for the bot. Save picture draws a 1080x720 PNG with no card faces and shares it with `navigator.share` where files can be shared, or downloads it.
2. **The pile cooks.** The pile sits on a brazier drawn on canvas. Its glow grows and warms with the pile size (full at 12 cards). A one-card pile shimmers: heat lines rise from it and the card sways with a hot outline. A pişti holds for 1.1 s with a flame burst, the word "Pişti!" and a rising tone.
3. **No words needed.** For a device's first three hands, cards that would capture now glow. One tap plays a card; a drag up also plays it. The bot answers after 600 ms. During play the captured cards show as stacks that grow, and piştis as small flames; numbers appear only on the score card, which counts up row by row (jacks, aces, 2♣, 10♦, most cards, piştis, total). The kit's `tap` hint (key `pisti:hint`) shows a finger over the hand after 4 s of idle play for a first-time player.

Other choices: bot strength rises one level after a won hand (a won match in match mode) and falls one level after two losses in a row; a new device starts at Easy. Four-colour suits (clubs green, diamonds blue) are on the pause card, off by default. Save key `pisti:v1` (JSON: level, losses, hands, length choice, sound, four colours, one entry per daily date for the last 60 days).

Query options for testing: `?seed=` fixes the Play deal, `?date=YYYY-MM-DD` sets Today's date, `?speed=` divides every delay except the pişti moment, `?hint=0|hand|ring` is the kit's.

## Play a friend

Enter an optional name, then tap **New table** and share the link or the four-letter code. A friend can open the link or enter the code under **Play a friend**. The page remembers the name in `pisti:v1`. Old saves default to an empty name. The room kit keeps each seat's key in browser storage and uses it to restore the seat and hand on reload or reconnect. The server expires idle tables after 24 hours.

The room uses the version 1 Pişti protocol. The server supplies the seed and the ordered log. Seed parity selects the dealer. Both pages replay the log from the seed and apply each valid echoed card once. The screen renders the new position immediately, with the local hand face up and the friend's hand face down. Both names appear on the score card in seat order. **Deal again** starts a fresh hand when both seats vote. The table keeps no running match score.

Both pages know the seed, so a table result proves nothing for shared scoring. It never counts toward bot progression, the loss or played-hand counts, Today's deal, or a shared board. The only network transport is the kit's same-origin room WebSocket. The page sends no lab recording.

The bot suite passed. `check.mjs` joins two Playwright pages through the real server protocol module (`workers/lab-ai/src/table.mjs`) and checks both seats' hands and scores across 48 plays, held and illegal moves, host and mid-hand reloads, disconnect and catch-up, a full table, rematch votes, save isolation, touch, connection lights, code entry and layout at 360×640. (The builder also reported a Node run with a simulated DOM; that script is not in the repo.) The lab ran `check.mjs` on 2026-11-24 outside the builder's sandbox: the friend checks pass on WebKit iPhone 13 and Chromium Pixel 7, and the screenshots were looked at (two name-label faults found and fixed: the score header wrapped a long name, and WebKit cut a short name because the seat light had no width of its own). On the live site the same day, `live.mjs` played WebKit against Chromium through the deployed Worker: a 48-card hand with equal state after every card, a reload mid-hand, Deal again (one vote waits, two start a new hand) and a third page refused. The native phone share sheet was not exercised.

## Bots

- Easy: takes a pile when it can (a match before a jack), otherwise a random card.
- Medium: takes with a match at once; uses a jack only on a pile of 4 or more, a pile worth 2 or more points, or at the end of the hand. Otherwise it keeps its jacks and, on an empty table, plays the rank most of whose cards it has already seen, so its lone card is the least likely to be matched; it prefers cards without points. On a non-empty pile it now discards only by card points (plus a small random term). An earlier Medium also weighed the seen count on a non-empty pile; Hard beat that version by only 0.84 points a hand (se 0.37, 2000 hands), below the assert, and Medium was simplified rather than Hard tuned further. So the Hard-over-Medium margin below is measured against the simpler Medium.
- Hard: counts every seen card exactly. For each card it weighs the points it takes now against the chance (hypergeometric over the unseen cards and the other hand's size) that the reply takes the pile, a pişti included, and whether it keeps a jack to take the pile back. In the last deal, when there are at most 70 possible other hands, it searches each to the end of the hand (alpha-beta) and averages.
- The bot sees only `view()`: its own hand, the face-up cards, every played card, the bottom card and its own captures. A sampled-hand search (40 sampled other hands) was tried for Hard and was no better than the earlier Medium: mean margin +0.09 (se 0.57, 800 hands) at three plies and -0.55 (se 0.66, 600 hands) at two plies (about 53 ms a hand at two plies). It was dropped.

`node bots.mjs` on 2026-11-24 (Node 26.13.1):

```
rules: 5000 hands ok; 1.04 pişti and 0.022 double pişti a hand; 197 hands at 26 each
medium vs easy: 2000 hands, mean margin 4.44 (se 0.38), wins 57.5%, losses 38.5%
hard vs medium: 2000 hands, mean margin 1.45 (se 0.36), wins 52.0%, losses 42.9%
hard vs easy: 2000 hands, mean margin 6.19 (se 0.37), wins 61.7%, losses 33.2%
daily: same deal and same replies for each level; bot choice unchanged by unseen cards in 900 positions
dates: 60 consecutive dates give 60 distinct deals
ALL PASS
```

Strength hands are 1000 fixed deals played twice with seats swapped. The asserts: Medium over Easy by more than 3 standard errors and 1 point; Hard over Medium by more than 3 standard errors and 0.5 points. Hard's lead over Medium is small (1.45 points a hand, about 4 standard errors): card luck dominates a single hand. The rules are checked by an independent referee in `bots.mjs` that replays every move log with its own pile. `node bots.mjs --mutate` makes jacks unable to capture; the referee then fails ("ply 18: a match or a jack on a pile captures, nothing else does", exit 1).

## Languages

The page plays in English and Turkish through the shared kit (`../../kit/i18n.js`). All words are in `words.js` (`tables.en`, `tables.tr`); `index.html` marks static text with `data-i18n`, `data-i18n-aria` and `data-i18n-title`, and `main.js` writes the rest through `t()`. `?lang=tr` or `?lang=en` picks the language and is remembered in `kit:lang`; a small button on the menu and on the pause card switches it and redraws every open screen, the aria-labels of the cards on the table and the hint, with no reload. Card names are spoken as words ("7 of clubs", "kupa 7"); the letters on the card faces stay A J Q K. Dates shown follow the language; the daily seed still uses the ISO date. The save format, storage keys, rules and the friends' table protocol (name, `version`) did not change. The friend's name at a table still comes from the other phone, and an unnamed player is "Friend" from the server in both languages.

`check.mjs` opens every English check with `?lang=en`, compares the two key tables in Node (same keys, same `{variables}`), and plays a Turkish run on each phone and at 360x640 (menu, friend card, hint, card names, pause, switch, score card, daily at 360x640, remembered choice, no overflow, no console errors). Screenshots of the Turkish screens: `LANG_SHOTS` (default beside `SHOTS`, `i18n-shots/pisti`).

The Turkish was written by an AI and has not been read by a native speaker. Terms to confirm first: "yer" for the pile, "kart çoğunluğu", "sinek ikili", "karo onlu", "vale/vale" for a jack on a jack, "Günün eli", and the friendly forms ("Sıra sende", "{name} bir el daha istiyor").

## Phone check

`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node check.mjs` serves `experiments/` and runs WebKit iPhone 13 and Chromium Pixel 7, plus Chromium at 360x640: menu; a full hand by taps on a seed where the scripted player makes a pişti, with the page's final score compared to the same plays replayed in Node; the capture glow; the score count-up; pause on `pagehide` while the bot waits, with exactly one bot card after resume; the level rising after the won hand; Match to 51 (totals carry, the dealer swaps so the bot leads hand 2); the bot's pace at normal speed; Today's deal scored and equal to the Node mirror of the date seed, the picture, Save picture, reload, then a full Practice hand that leaves the scored margin unchanged; Today's deal at 360x640 with Menu and Save picture in view; on Chromium only, a drag up playing a card, quitting the scored daily (no second scored try, Save picture hidden) and a match played to its end (Play again starts 0-0); the pass-and-play cover with no card faces under it; no console errors, no outside requests, no overflow.

## Not verified

- A real phone: touch feel, frame rate of the brazier, sound, the share sheet (headless WebKit took the share path; no sheet was seen).
- The level falling after two losses in a row (the code path exists; no check reaches it). The default date without `?date=` (it is `new Date().toISOString()`, so UTC; every check passes `?date=`).
- A person: whether a stranger captures within twenty seconds and finishes the hand; whether the glow and the shimmer teach without words; whether the bot levels feel different.

## Open ideas

- A shared board for Today's deal (margins only; the deal is the same for everyone, so the margin compares fairly).
- Four-player tables in partnerships, as in pagat's main game.
- Okey-style tile games as a follow-on in the same style.
