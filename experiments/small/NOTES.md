# Small games home (`/small/`)

The home for the small games, picked by the owner on 2026-11-24 from three drafts (now `archive/lab/hub-a`, `hub-b`, `hub-c`): draft C ("Three tonight") on top, with draft B's swipe deck in place of C's plain list. English and Turkish.

## Files

| File | What |
| --- | --- |
| `catalog.js` | The twelve small games in deck order: slug, address, name, line, time, kind, `tr`, `of`. The only place that knows a game's address and its number of levels. |
| `art.js` | A drawn preview per game. Drawn without CSS, so the share picture can use the same drawings. |
| `marks.js` | Today's pick, tonight's three, progress read from each game's own save (read only), the stops, results and streak. |
| `words.js` | Every string, English and Turkish. |
| `main.js`, `style.css`, `index.html` | The page. |

## Decisions

- **Games live at `/small/<slug>/`** (`experiments/small/<slug>/`, moved from `/lab/<slug>/` on 2026-11-25; the old addresses are 302s in `labMoved`, query kept). When a game moves again, change its `href` in `catalog.js` and add a redirect. The slug never changes: it is the folder name, the recording name and the key in the home's saves.
- **`tr: true`** on a catalogue entry means the game itself plays in Turkish (it has a `words.js` with an English and a Turkish table). Without it, a Turkish player sees "İngilizce" on its card. On 2026-11-25 every game but Carbon Cabinet (`night-rubbing`, no `words.js`) has it, checked in each game's code.
- **`of`** on a catalogue entry is the game's number of levels, for the card's "n / of". `scripts/small-catalog.test.mjs` (in `npm test`) reads each game's own count from its code (Night Bells 24, Night Channels 30, Podwire 18, Saltplate 18, Night Sand 10, Splitlight 18, Pour 8, Carbon Cabinet 6) and fails when they differ; it also reads a finished save of each through `marks.js`. Thankful Garden, Face Shift, Paper Pitch and Firefly Ring have no fixed count and no `of`. Changing a count in a game means changing `of` here.
- **Seeds.** Today's pick is `seeded('pocket ' + day)` over the catalogue; tonight is `seeded('tonight ' + day)`, one quick, one think, one calm, never the pick. Days are UTC dates, the same for everyone. `?day=YYYY-MM-DD` sets the day for checks. These are the drafts' seeds, so a night begun on a draft is the same night here. Adding or reordering games in `catalog.js` changes future picks; that is fine.
- **Keys.** The drafts' keys are kept, so marks and a streak made there carry over: `hub:opened`, `hub:c:night`, `hub:c:streak`. New: `hub:results` (written by `kit/home.js`), `hub:small:intro` (the first-visit card was dismissed). Session only: `hub:small:at` (deck position), `hub:small:open` (an open waiting to be recorded). The home never writes a game's own keys (checked).
- **Signs.** ★ the game reported a win through `kit/home.js` after the stop was opened; ✦ its progress grew after the stop was opened; ○ opened. A stop opened on a draft has no time, so it can only be ✦ or ○.
- **Streak.** A night counts when all three stops are opened, not won: the games differ too much in length for a win to be a fair bar. The streak survives one day (yesterday or today).
- **Share.** "Share tonight" makes a 1080 × 1350 PNG (the three previews, signs, the streak and the address) when the result card first shows, so the share sheet can open straight from the tap. Where the browser cannot share files it shares or copies the text `Three tonight · Nov 24 · ★✦○`.
- **The deck under a thumb.** Scroll snap with the browser's own momentum; the card nearest the middle is the current one. Only the middle card's Play opens a game. A tap on the next card's edge brings it to the middle (on release, because WebKit sent no click for that tap). A tap ends as nothing when the finger or the deck moved more than a few pixels. `overscroll-behavior-x: contain` keeps a swipe on the deck from going back in history. When the page scrolls the deck (arrows, Surprise me, a side card), the current card is the one it is going to, not the cards the glide passes, and the deck lands on it even when WebKit drops a smooth scroll asked for mid-glide (seen as a CI flake, 2026-11-25; reproduced 1 in 15 with a probe, then 0 in 45).
- **Recording.** `kit/lab.js` under slug `small`: a finished night (`night-done` with the signs and the streak), Surprise me, Share, and each game opened (sent when the player comes back, so the page leaving does not cut the send). `small` is in human-framework `LAB_PROTOTYPES` on its default branch (read 2026-11-25); whether that is deployed was not checked.

## 2026-11-25: the catalogue made true, every game wired back

Each game's code was read after the improve passes of 2026-11-24. Changed in `catalog.js`: Night Channels is called by its own name (it was "Channels"); Night Bells, Face Shift and Night Sand have new lines (24 nights; sitters who lose patience; ten beds and an endless garden); Pour and Face Shift now play in Turkish (`tr: true`); `of` added (above). Paper Pitch and Firefly Ring were left as they were: another builder had them open. `marks.js` takes totals from `of`, counts Night Bells' nights 9 on (`night-bells:more`), Face Shift's booth runs (`wild2-face-shift:booth`) and Carbon Cabinet's sixth print (its `night-rubbing:proof:6`, so a finished cabinet now reads "Finished").

Every small game now has the way back (`kit/home.js`); Paper Pitch and Firefly Ring brought theirs in their own pull requests (#270, #278), merged while this one was open. Added here: Podwire, Saltplate, Night Sand, Pour, Face Shift and Carbon Cabinet; each game's `check.mjs` asserts it. The small run in `kit/check/pages.mjs` now expects "1 / 24" for Night Bells and checks Pour's own link instead of adding one itself.

After that merge, Pitch and Ring got the language hook, and new card lines: Pitch names its three ways to play (the computer, a friend, a puzzle), Ring its three nights. Both stay without `of`: Pitch's eighteen puzzles are one part of a game whose matches have no end, and a Ring night has many levels with no finished mark in the save, so their cards keep saying played or finished (`UNCOUNTED` in the test).

## 2026-11-26: moving previews and hooks

Evidence: on 2026-11-26 the owner's phone opened the home once and then went straight to Carbon Cabinet; nine of the twelve games had no opens. On a cold open the first screen showed one game (iPhone 13) or two (Pixel 7), each as a still drawing with a long line of text.

- **Live previews** (`art.js`, `LIVE`): each game has a few seconds of its own play on a canvas, looping: a ghost finger does the game's gesture and the scene answers (the bell's ring closes and it peals, drops arc into the glass, the wire snaps and the pod bursts, salt settles into the plate's nodal figure, and so on). Drawn in the 160 × 120 box of the drawings and in the same colours, checked against screenshots of each live game on 2026-11-26. The whole scene fits above the hook; the margin is the drawing's ground colour (`groundOf`).
- **Which ones run** (`main.js`): one `requestAnimationFrame` loop paints the deck's middle card and tonight's next stop, only while on screen and the page is visible. A preview starts from its beginning each time it comes into view. The canvas shows only after its first frame, so a browser that runs no frame keeps the drawing; nothing on the page waits for a frame. Reduced motion: none run.
- **Hooks** (`words.js`, `hook:<slug>`): a few words over each moving preview that name the gesture and what it does. They are the home's own words, not `catalog.js` lines, so a game's builder can change its line without touching the hook.
- The first-visit card's three lines light up in 0.75 s instead of 2.1 s.
- Check: `small live` in `kit/check/phone.mjs` (runs with `small`). It checks that the preview paints and changes between frames, that the stop shows its hook, that the deck's middle card moves, and that nothing moves under reduced motion. When the loop is switched off, the check fails (tried).

## 2026-11-26: the collection, untried games first, sound

- **The collection** (under "All the small games"): every game as a small tile, grey until tried, in colour with a tick after. "You have tried 3 of 12". A tile brings its card to the middle of the deck. "Tried" means the card's mark is not New (`mark()`), so old saves and opens from the drafts count with no new save format.
- **Deck order**: today's pick, then the games this player has not tried, then the rest, each in catalogue order from the pick. The order is kept for the session in `hub:small:order` (`{ day, slugs }`), so the deck does not reshuffle when a game is tried during a visit. `pickFor`/`threeFor` are unchanged: tonight's three stay the same for everyone.
- **A first try is marked**: a game opened from the home while still New is recorded with `fresh: true` in `hub:small:open` (and in the `open` lab event). On the way back its tile pops, a note plays and a toast says "New one tried · 4 of 12".
- **Sound and buzz**: short notes from `kit/audio.js` when a card comes to the middle (one note of a pentatonic scale per position), when a game opens, on Surprise me and on a first try. A short `navigator.vibrate` goes with them where the browser has it, only after the player has touched the page. One switch (♪ in the header, `hub:small:sound`, '0' is off) covers both. Default on.
- Check: `small tried` in `kit/check/phone.mjs` (runs with `small`). It covers the order, the count, a tile tap, the first-try note after back, the order kept through the visit, the remembered switch and the Turkish count. With the first-try code switched off, the check fails (tried).

## 2026-11-26: a grid to pick from (taste call)

`?v=grid` shows "All the small games" as a grid, two to a row: every game's preview moving while on screen (at most eight at once), its hook, name, time and Play. Any card's Play opens its game. The default stays the deck (`?v=deck`), the owner's pick of 2026-11-24. The grid puts every game on the first two screens of a phone and the deck shows one at a time, which is the reason to offer it; the owner picks. Check: `small grid` in `kit/check/phone.mjs`.

## Not verified

- How the previews read to a person, and their cost on a slow Android phone (Firefox): only headless Chromium and WebKit ran them.
- Sound on a real phone. `kit/audio.js` asks iOS for the 'playback' audio session, which plays through the silent switch and pauses other apps' music once the home makes its first note. That is the kit's rule for games; a home page might want the default session (kit change proposed, not made). `navigator.vibrate`: Android Chrome has it; whether Android Firefox buzzes was not checked.
- A real phone: the checks run headless WebKit (iPhone 13) and Chromium (Pixel 7). The thumb feel (snap, momentum, the edge tap) is checked only as far as a headless tap goes.
- The share sheet with a picture: `navigator.share` with files was not opened in a check; the PNG itself was made and looked at in both browsers.
- Back-forward cache: headless back reloads the page, so the check fires `pageshow` with `persisted` itself.
