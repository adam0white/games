# Publishing: getting a game in front of outside players

Written 2026-11-27. The lab's own plan; the owner decides the open items at the end. Portal facts below were read from each
portal's own developer pages on 2026-11-27 unless marked "not confirmed". Read the portal's page again before an upload.

## What goes out first

**Lantern** (`experiments/lantern/`, `play.adamwhite.work/lantern/`). Reasons: it had the most outside player ids in the lab
records of 2026-11-22 to 27; it is one thumb on a phone with no install; it is 0.6 MB; it has English and Turkish, a daily
river, a shared board and a dare link; nobody else is rebuilding it. **Sky Kitchen** is second, once its current round settles.

## The gate: strangers finish without help

Of player ids first seen after 2026-11-27, the share that reach a dawn in their first session. Before the gentle river it was
0 of 10. Read it with `node scripts/lab-mine.mjs <day> --game=lantern`. A second number, for "recommend": dare links made per
100 endless runs (`dare_send` events) and dare runs played (`mode: 'dare'`).

## What is ready (2026-11-27)

| Piece | State |
| --- | --- |
| First minute | Gentle river on story nights for a new player, a spare heart, tutorial offer. `lantern/NOTES.md` |
| Options | Settings card on `kit/settings.js`; every change and every run's values are recorded |
| Friends | Dare a friend by link, no account (`kit/dare.js`) |
| Link preview | Title, description and a 1200x630 picture (`lantern/share.jpg`) |
| Copy for other sites | `node scripts/portal-zip.mjs lantern` makes `dist/portal/lantern-itch.zip` (about 0.2 MB) |
| Privacy | Checked for Lantern, below |

## A copy on another site

`scripts/portal-zip.mjs <experiment> [--portal=itch|strict]` builds a folder with `index.html` at its root and zips it. It sets
`window.PORTAL`. With it set:

- `kit/lab.js` records nothing and shows no notice. So play on a portal is **not** in the lab records. To change that, the lab
  endpoint would have to accept other origins and the portal page would need its own notice; not done.
- Lantern asks for no shared board (only the board on the phone), loads no tester notes button and has no Race rooms.
- `itch`: a dare link points at `play.adamwhite.work/lantern/`, so a friend lands on the full game. `strict`: no dare button,
  for portals that allow no links out.

The script fails if an import in the copy points outside it. `scripts/portal-zip.test.mjs` checks the Lantern copy. A browser
pass on 2026-11-27 served the copy from its own root on another port: it loaded, played a story night, the endless river, a
mode and the 3D view, and asked for nothing outside its folder.

## Where to publish, in order

| Order | Where | Why | Needs |
| --- | --- | --- | --- |
| 1 | Own site | Full game: board, daily river, dare links, records | Nothing. Live |
| 2 | itch.io | Self-serve zip upload, links out allowed, no review wait | An account; the zip; a cover picture; a short page text |
| 3 | Newgrounds | Self-serve zip upload, an audience that rates and comments | An account. Rules page not confirmed (it refused an automated read) |
| 4 | CrazyGames (basic launch) | Largest audience of the four. No SDK needed for a basic launch, no exclusivity | An account; covers at 1920x1080, 800x1200 and 800x800; the `strict` copy; a privacy notice if anything is collected (the copy collects nothing). Content aimed at children is refused |
| Later | Poki | Asks for web exclusivity for its main deal and blocks outside requests | Only after the game has numbers to show |
| Skip | Yandex Games, GameSnacks | No links out; GameSnacks allows no local storage, which the saves need | |

A post to a forum (for example Show HN) needs only the own-site link, which must open without a sign-up. It does.

## Privacy check for Lantern (todo item lab-0fv)

- The menu carries the recording notice and a link to the privacy page; the card after a run has the "Record this play"
  switch. `kit/lab.js` sends nothing with Do Not Track or Global Privacy Control set unless the player switches it on.
- The shared board is opt-in: nothing is sent until the player says yes once and gives a name; "no" removes the entry.
- New on 2026-11-27: a settings change and a dare send are recorded as play events (no name, no link). A dare link holds the
  seed, the score and the name the player typed; the card says so. It is sent only by the player's own share.
- The tester notes button appears only in a browser that opened a tester's private link.
- Not checked: the other listed games.

## Open, for the owner

1. Whether public posts and portal uploads may go ahead (todo item lab-f83).
2. Portal accounts are the owner's to create; an agent can prepare the page text, pictures and zip.
3. The first public post: where and when (todo item lab-t64).

## Not done yet

- A real phone pass by a person on the gentle river and on a share sheet.
- Portal cover pictures other than the 1200x630 one.
- Records from portal copies (see above).
