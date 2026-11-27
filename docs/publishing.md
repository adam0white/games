# Publishing: getting a game in front of outside players

Written 2026-11-27. The lab's own plan; the owner decides the open items at the end. Portal facts below come from one research
pass over the portals' developer pages on 2026-11-27. Several pages could not be read in full, so treat every portal fact here
as a lead and read the portal's own page before an upload.

## What goes out first

**Lantern** (`experiments/lantern/`, `play.adamwhite.work/lantern/`). Reasons: it had the most player ids in the lab
records of 2026-11-22 to 27 (twelve; the owner's, testers' and any unmarked agent ids are not separated); it is one thumb on a phone with no install; it is 0.6 MB; it has English and Turkish, a daily
river, a shared board and a dare link; nobody else is rebuilding it. **Sky Kitchen** is second, once its current round settles.

## The gate: strangers finish without help

Of player ids first seen after 2026-11-27, the share that reach a dawn in their first session. Before the gentle river it was
0 of 10. Read it in the "First session of each player id" section of `node scripts/lab-mine.mjs <from> <to> --game=lantern`. A player
who arrives by a dare link starts on a dare, which has no dawn; that section lists the first run's mode so they are counted apart. A second number, for "recommend": dare links made per
100 endless runs (`dare_send` events) and dare runs played (`mode: 'dare'`).

## What is ready (2026-11-27)

| Piece | State |
| --- | --- |
| First minute | Gentle river on story nights for a new player, a spare heart, tutorial offer. `lantern/NOTES.md` |
| Options | Settings card on `kit/settings.js`; every change and every run's values are recorded |
| Friends | Dare a friend by link, no account (`kit/dare.js`) |
| Link preview | Title, description and a 1200x630 picture (`lantern/share.jpg`) |
| Copy for other sites | `node scripts/portal-zip.mjs lantern` makes `dist/portal/lantern-itch.zip` (about 0.2 MB) |
| Privacy | Read for Lantern, one point open, below |

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
mode and the 3D view, and asked for nothing outside its folder. A second pass put the copy in a frame on a page from
another origin, as a portal does: it played, kept its save across a reload, and the dare link was copied or shown (the share
sheet is refused inside such a frame unless the portal allows it). A real portal's frame is not tested until an upload.

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

## Privacy read for Lantern (todo item lab-0fv; one point open)

- **Open for the owner:** play recording is on by default, with the notice on the menu and a switch to stop it. The todo item
  asks that nothing is sent before the player chooses. Either the notice-and-switch form is accepted for public traffic, or
  recording must wait for a yes.

- The menu carries the recording notice and a link to the privacy page; the card after a run has the "Record this play"
  switch. `kit/lab.js` sends nothing with Do Not Track or Global Privacy Control set unless the player switches it on.
- The shared board is opt-in: nothing is sent until the player says yes once and gives a name; "no" removes the entry.
- New on 2026-11-27: a settings change and a dare send are recorded as play events (no name, no link). A dare link holds the
  seed, the score and the name the player typed; the card says so. It is sent only by the player's own share.
- The tester notes button appears only in a browser that opened a tester's private link.
- Not checked: the other listed games.

## Review rounds (owner direction, 2026-11-27)

The owner asked for early, frequent, independent reviews from several models, some blinded, and for bold versions built
beside the current game. Each round: screenshots and the diff go to reviewers that did not build it, findings go to
builders as a numbered brief, and the lead checks the result with the phone check on Chromium and WebKit, the bots and
its own screenshots.

- **Round 1 (five reviewers).** Lantern's first open was an options menu, the opening killed a passive player
  (median 12.7 s on the gentle river), rocks were unreadable, there was no flame gauge, and the dare lost its sender.
  Result: the first minute was rebuilt and the share loop repaired.
- **Round 2 (four reviewers).** Eleven bugs (arrow keys, tutorial skip while paused, a dare reply the parser refused,
  and others) and eleven readability changes (rock silhouette, lit route ahead, first embers, labelled flame gauge,
  the goal on the first screen, result-first end cards, a unit on every dare). All built and checked.
- **Pass the Flame** (`experiments/lab/flame-a/`, `flame-b/`): a wildcard direction from round 1. The link is the
  flame; each player carries it one leg and passes it on. Two builds of one brief so the owner can compare. A blinded
  art review and a playtest both preferred version A with the paper look; version B had the better rules, which A then
  took (idling drops the flame, one relight from the coals, carrier number, distances). Open: the owner's pick of build
  and look, and whether this becomes its own game or a Lantern mode.
- **Not verified by any round:** a person on a real phone, sound, the share sheet, vibration, frame rate, and the
  Turkish wording.

## Open, for the owner

1. Whether public posts and portal uploads may go ahead (todo item lab-f83), and the recording point above.
2. Portal accounts are the owner's to create; an agent can prepare the page text, pictures and zip.
3. The first public post: where and when (todo item lab-t64).

## Not done yet

- A real phone pass by a person on the gentle river and on a share sheet.
- Portal cover pictures other than the 1200x630 one.
- Records from portal copies (see above).
