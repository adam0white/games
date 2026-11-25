# A home for the small games: three drafts (`hub-a`, `hub-b`, `hub-c`)

## 2026-11-24 — three clickable variants

The owner kept eleven small lab games and said: "We should collect small games into 1-2 URLs, maybe split by single/multi player, or open to other ideas." This is a taste pick, so there are three working pages that differ in structure, not in colour. Open any one of them. The strip at the top ("A · B · C") flips between them and keeps `?lang` and `?day`. The EN/TR button switches the page's language in place (`kit/i18n.js`, the shared `kit:lang` key).

Games behind the hubs: `night-bells`, `wild-pour`, `night-podwire`, `wild2-face-shift`, `night-channels`, `night-sand`, `night-splitlight`, `ring`, `pitch`, `night-saltplate`, `night-rubbing` (undecided, included as asked) and `thankful`. A also links `/duel/` and `/crumbwar/`. No game file was edited.

### A — two shelves (`/lab/hub-a/`)

- "On your own": the eleven one-player small games, two per row. Each tile has a drawn preview, the name, one line, a play time and a mark.
- "With a friend": Paper Pitch (by link or two on one phone, or against the bot), then games from the main shelf. Only Paper Pitch of the small games has friend play. Checked against each live game's NOTES.md and code: Thumb Duel is two on one phone, and Crumbwar is online rooms with strangers and bots. Good Match and the other live games are one player. Pişti also has friend play by link, but it is not in the owner's kept list, so it is not shown.
- Weakness: the friend shelf is thin and half borrowed from the main shelf. The split answers "who with" before "what is it", and a newcomer needs the second answer first.

### B — a pocket of small games (`/lab/hub-b/`)

- One page that plays like a deck: one big card per game, swipe (CSS scroll-snap) or tap the arrows. Each card has a large animated preview, name, line, time, mark and a Play button.
- "Today's pick" is the first card. It is seeded by the UTC date, so it is the same for everyone. "Surprise me" jumps to a game you have not played (any game once all are played). "Share this pocket" uses the kit's `shareLink` (share sheet, else copy).
- Strength: one link to give a person outside; the first screen is one game, not a menu. Weakness: no reason to come back tomorrow except the pick, and twelve cards is about the limit for a swipe deck.

### C — three tonight (`/lab/hub-c/`)

- Each night (UTC date) everyone gets the same three: a warm-up (Pour, Night Bells, Podwire or Face Shift), a game to think about (Channels, Night Sand, Splitlight, Firefly Ring or Paper Pitch) and a calm one to end on (Saltplate, Carbon Cabinet or Thankful Garden). B's pick of the day is left out, so the drafts do not open on the same game.
- The three stops sit on a path. The next stop is large with a Play button. After you come back, the stop shows ○ (opened) or ✦ (the game's own save moved forward while you were away). When all three are opened, a result card shows the three marks, a streak of nights in a row and a Share button (text such as `Three tonight · 24 Nov · ✦○○`). All twelve games stay one tap away in a list below.
- Weakness: the hub cannot see a win or a score, only "opened" and "your progress number went up" (see below). The streak asks only that all three were opened.

### Recommendation: C, with B's deck as its "all games" view

I would bet on C for "people outside choose to play and come back". The small games are each one to two minutes and mostly one idea deep. Alone, each is easy to try once and forget. A nightly set turns twelve thin games into one thing with a reason to return (tomorrow's three are new), a shape (warm up, think, wind down) and a result you can share without explaining anything. Daily puzzle sites keep players with the same three parts. Thankful Garden already works this way. A's split leaves one game on the friend shelf; B is the best first impression, so B's swipe deck would replace C's plain list of all games if C is picked.

### Back path from a game

Games open in the same tab, with `?from=hub-a` (or `hub-b`, `hub-c`) on the address. No game reads `from` (checked by grep on 2026-11-24), so it changes nothing today. The way back is the browser's back button or the iPhone's swipe from the left edge. On return, each hub reads the saves again on `pageshow`, because Safari often restores a page from its back-forward cache without running its scripts again.

A real integration needs one small change per game: a "back to small games" button on the menu and end card, shown when `from` names a hub, that goes to that hub's address. For C to show wins rather than progress, each game would also report its result to the hub, for example a `kit` call that writes `hub:result:<slug>` with the day, outcome and score when a level or run ends.

### What the marks read (read-only)

The hubs never write a game's key. Their own keys are `hub:opened` (`{slug: day}`), `hub:c:night` (`{day, stops: {slug: {before}}}`) and `hub:c:streak` (`{last, run, best}`), plus `hub:b:at` in sessionStorage. Each game's progress is read from its own save in `hub-a/hub.js` (`P`):

| Game | Read | Mark |
| --- | --- | --- |
| Night Bells, Pour | levels with stars (`stars`) | n / 8 |
| Channels | `unlocked - 1`, or 10 when `completed` | n / 10 |
| Night Sand | `completed` | n / 10 |
| Podwire | `next - 1`, or 6 when `complete` | n / 6 |
| Saltplate | `cleared` | n / 6 |
| Splitlight | `night-splitlight:plate - 1` (a plain number) | n / 6; the last plate's clear is not visible |
| Carbon Cabinet | `unlocked - 1` | n / 6; the sixth print's filing is not visible |
| Firefly Ring | `nights` (runs), finished when `dawns > 0` | Played / Finished |
| Face Shift | `runs`, finished when all four rounds have stars | Played / Finished |
| Paper Pitch | `played` plus daily days | Played |
| Thankful Garden | days with a thanks; today with three | Played / Done today |
| Thumb Duel | `duel-save.matches` | Played |

A key that exists is not used as "played", because some games write defaults on load. "Opened" comes from the hub's own key.

### Previews

Each tile has a small SVG picture drawn in the game's own colours, with a slow CSS animation (stopped under reduced motion). They are not screenshots, so they cost nothing to load and do not go stale when a builder changes a game's art. Live game iframes were ruled out: twelve running simulations and audio contexts on a phone.

### Look and language

The site's `/` sends visitors to the Human Framework shelf on another host, and there is no `experiments/index.html`, so the hubs match the lab index (`experiments/lab/index.html`): night background, Georgia, warm gold. The hub pages are in English and Turkish. Behind them, only Paper Pitch and Firefly Ring play in Turkish; in Turkish the other tiles say "İngilizce" and keep their English names.

### Moving the games to a final address

If the owner picks a variant, the hub moves to its final path (for example `/small/`) and each game moves out of `/lab/`. Each move is a `git mv`, a `labMoved` entry in `worker-settings.mjs` (the lead's job) and a new `href` in `SMALL` in `hub.js`. The folder names must not change: they are the slugs that any later play records (`kit/lab.js`) and the hubs' own `hub:opened` key use. A game that leaves `/lab/` for `/<slug>/` also needs a `games.json` entry, or the phone check fails. Saves are per origin and per key, not per path, so a player's progress survives the move.

### Checks

- `experiments/kit/check/lab-pages.mjs` exports `labHubs`, and `phone.mjs` registers them with one line. Run: `node experiments/kit/check/phone.mjs lab/hub-a,lab/hub-b,lab/hub-c`. Each run loads the page with an old Night Bells save, checks every game link resolves to a page in this checkout (Crumbwar to `workers/crumbwar/public/crumbwar/`) and carries `from`, checks the strip links, checks there is no sideways scroll in either language, switches to Turkish and back (no empty strings, remembered on reload) and confirms the hub wrote no game key. It then opens a game and comes back with the browser's back. A: the tile reads 1 / 8 and the opened game reads Opened. B: the deck opens on the pick, next and Surprise me move it, and the opened card's mark changes. C: all three stops are opened and come back marked, then the result card shows `○○○`, the streak starts at 1, a `pageshow` from the cache redraws, and a moved game shows ✦. The runner fails on any page error, console error or failed request.
- Known bad cases: a tile pointed at a missing folder fails (`/lab/night-sandx/?from=hub-a is a page in this checkout`); C without its `pageshow` handler fails (`a page restored from the cache redraws its marks`).
- Results, 2026-11-24: all six runs pass (three pages × WebKit iPhone 13 and Chromium Pixel 7). `npm test`: 73 pass.

### Not verified

- A real phone, the real back-forward cache (headless Playwright reloads on back), and the share sheet.
- Whether people choose any of these; the recommendation is a judgement, not a measurement.
- Play times are taken from each game's NOTES.md where given (level lengths of about 60 s) and rounded. Paper Pitch's 3 minutes and Thumb Duel's 3 minutes are estimates.
