# Small games home (`/small/`)

The home for the small games, picked by the owner on 2026-11-24 from three drafts (now `archive/lab/hub-a`, `hub-b`, `hub-c`): draft C ("Three tonight") on top, with draft B's swipe deck in place of C's plain list. English and Turkish.

## Files

| File | What |
| --- | --- |
| `catalog.js` | The twelve small games in deck order: slug, address, name, line, time, kind, `tr`. The only place that knows a game's address. |
| `art.js` | A drawn preview per game. Drawn without CSS, so the share picture can use the same drawings. |
| `marks.js` | Today's pick, tonight's three, progress read from each game's own save (read only), the stops, results and streak. |
| `words.js` | Every string, English and Turkish. |
| `main.js`, `style.css`, `index.html` | The page. |

## Decisions

- **Games stay at `/lab/<slug>/`.** When the lead moves a game, change its `href` in `catalog.js`. The slug never changes: it is the folder name, the recording name and the key in the home's saves.
- **`tr: true`** on a catalogue entry means the game itself plays in Turkish (it has a `words.js`). Without it, a Turkish player sees "İngilizce" on its card. On 2026-11-24 the flag is set for Night Sand, Firefly Ring and Paper Pitch, checked by which of the twelve pages have a `words.js`.
- **Seeds.** Today's pick is `seeded('pocket ' + day)` over the catalogue; tonight is `seeded('tonight ' + day)`, one quick, one think, one calm, never the pick. Days are UTC dates, the same for everyone. `?day=YYYY-MM-DD` sets the day for checks. These are the drafts' seeds, so a night begun on a draft is the same night here. Adding or reordering games in `catalog.js` changes future picks; that is fine.
- **Keys.** The drafts' keys are kept, so marks and a streak made there carry over: `hub:opened`, `hub:c:night`, `hub:c:streak`. New: `hub:results` (written by `kit/home.js`), `hub:small:intro` (the first-visit card was dismissed). Session only: `hub:small:at` (deck position), `hub:small:open` (an open waiting to be recorded). The home never writes a game's own keys (checked).
- **Signs.** ★ the game reported a win through `kit/home.js` after the stop was opened; ✦ its progress grew after the stop was opened; ○ opened. A stop opened on a draft has no time, so it can only be ✦ or ○.
- **Streak.** A night counts when all three stops are opened, not won: the games differ too much in length for a win to be a fair bar. The streak survives one day (yesterday or today).
- **Share.** "Share tonight" makes a 1080 × 1350 PNG (the three previews, signs, the streak and the address) when the result card first shows, so the share sheet can open straight from the tap. Where the browser cannot share files it shares or copies the text `Three tonight · Nov 24 · ★✦○`.
- **The deck under a thumb.** Scroll snap with the browser's own momentum; the card nearest the middle is the current one. Only the middle card's Play opens a game. A tap on the next card's edge brings it to the middle (on release, because WebKit sent no click for that tap). A tap ends as nothing when the finger or the deck moved more than a few pixels. `overscroll-behavior-x: contain` keeps a swipe on the deck from going back in history.
- **Recording.** `kit/lab.js` under slug `small`: a finished night (`night-done` with the signs and the streak), Surprise me, Share, and each game opened (sent when the player comes back, so the page leaving does not cut the send). `small` is not in human-framework `LAB_PROTOTYPES` yet, so the server refuses these records until it is added.

## Not verified

- A real phone: the checks run headless WebKit (iPhone 13) and Chromium (Pixel 7). The thumb feel (snap, momentum, the edge tap) is checked only as far as a headless tap goes.
- The share sheet with a picture: `navigator.share` with files was not opened in a check; the PNG itself was made and looked at in both browsers.
- Back-forward cache: headless back reloads the page, so the check fires `pageshow` with `persisted` itself.
