# Thankful Sky

The lab's own idea: a short daily gratitude ritual, with no score or missed-day penalty.

Three looks use the same saved entries and the same places. Sky draws blue night and constellations. Lamps draws paper lanterns and amber reflections. Garden draws flowers sharing a stem. Sky is the default. The three dots select and remember a look.

Storage is `thankful:v1`: `{v:1,days:{'YYYY-MM-DD':[{k,t?}]},look,sound}`. Dates use local time. Each day accepts three entries. Optional words belong to `spark` and have at most 24 Unicode characters. Invalid saved values are discarded. The shared notes button fetches the page to identify its build when notes are enabled. No third-party dependencies are used. Demo mode generates earlier days in memory and never writes. Day override is for checks. Settings offers sound and a confirmed reset.

Every day that has a light gets a place in a field of five rows, counted from the first day, so a place never moves and the whole of the last few weeks shows at once (about 25 days on a phone; drag for older ones). A day's three lights sit round its place and are joined once the day is full. Missed days take no place and bring no prompt. When the third thanks is given the tray leaves and the field opens downward. Every seventh completed day adds a shooting star. Reduced motion removes drift, trails and the shooting star. `?demo=40` shows a grown sky without saving; `?day=YYYY-MM-DD` sets today for checks.

How it was built: Codex wrote the first version from a brief; the layout (it showed one day per screen, so a grown sky looked empty) and the three looks were then rewritten by the lab agent.

Checks: `node experiments/lab/thankful/bots.mjs`; `PLAYWRIGHT=<dir with playwright> SHOTS=<dir> node experiments/lab/thankful/check.mjs` (WebKit iPhone 13 and Chromium Pixel 7 profiles; both passed on 2026-11-24). Not verified: sound and feel on a real phone, a second real day (the day change was only checked with `?day=`), and whether a person comes back the next day. Not wired yet: lab recording (`kit/lab.js` needs the slug added in human-framework first).

Ideas not built: a soft reminder at a chosen hour, a yearly view, words of thanks from several traditions shown after the third light (needs the owner's choice of texts).

After three thanks, Keep a picture makes a PNG of the current look with the total thanks and days.
The shared notes button and phone checks cover this page.

## 2026-11-24, round two: the garden is the default

The owner picked the garden look and asked for more variation and polish. The garden is now the look a new visitor gets. A saved choice of sky or lamps still holds.

- Each kind of thanks grows its own flower (the lab's idea): bread is wheat, water a bluebell, home a tulip, family a daisy, friend a cosmos, health a rose, rain a snowdrop, rest a moonflower, work a lavender spike, tree a leafy sprig, light a sunflower, something else a star flower. A garden then shows what the days were made of.
- A day's three flowers share one root. They lean in a slow wind, a new one grows up from the ground, nearer rows are a little larger, and there is grass, three layers of hills, a low moon and fireflies.
- The page name and the done line follow the look: Thankful Garden, "Today is in your garden."
- Odd columns sit half a row lower, so the field reads less like a grid.
- "Keep a picture" appears when today is done. It draws a 1080 by 1350 picture and offers the phone's share sheet, or a download.
- The page is in the shared phone check (`kit/check/phone.mjs lab/thankful`) and carries the shared notes button.

Not checked: a real phone, sound, the share sheet itself (the check only confirms a picture is made), a real second day.

## Play recording (2026-11-24)

The page sends play records to the lab under the name `thankful` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). The page has no start card, so the recording notice sits at the foot of the page where the thanks tray is, and the off switch is on the settings card (the notice says "pause menu"; this page's menu is the settings card). A run is one day's thanks: it starts with the first thank given in a visit and ends `won` with the third. Events: `thanks` (the kind and its number) and `daily-finished`. The words typed under "something else" are never sent, only the kind `spark`. Demo mode (`?demo=`) records nothing. Existing storage keys are unchanged.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `thankful` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.

## 2026-11-25, round three: daily flowers, a young garden drawn large, Turkish

The owner's words: "Good but improve". No complaint was named, so the targets came from playing it cold at 390x844 (WebKit iPhone 13 and Chromium Pixel 7 profiles, cleared save). Numbers are from a headless play script and the page's own `check.mjs`; screenshots were looked at, not kept in the repo.

The five weakest things, and what became of each:

1. **Day one looked empty.** The first three flowers sat at the right edge (centre x 332 of 390) in a field of grass, cluster radius 17 px, 25 px across; the kept picture of day one was a small plant in a corner. Now a young garden is drawn larger and in the middle, easing back to the full field from about four columns on: centre x 170, radius 36 px, 53 px across. On a short screen the zoom gives way to the room above the words (320x568 draws at 1x).
2. **The buttons taught nothing about the garden.** Twelve line icons; nothing said which flower a thanks would grow, and a tapped flower showed the icon again. Each button now shows the flower it grows today, and a tapped flower shows its picture, date, kind and the flower's name (e.g. "oats").
3. **Flowers behind the words.** In a grown garden (`?demo=60`) 7 flowers stood behind "Today is in your garden." and the picture button, and the fading tray slid over the recording notice. The garden now stops above the words, measured from the page each frame (0 behind), and the tray folds away in place.
4. **Nothing to come back for.** The finished day said one line, with a faint "Keep a picture" (contrast about 4.5:1, greyed further by opacity) and the same twelve flowers every day. Now the finished day says "Day N · M thanks · new flowers tomorrow", the button is solid (about 11:1), and the flowers change daily (below). The picture shows the garden, the page name, the date, the day count, and today's three flowers drawn large with their names (or the player's own words for "something else").
5. **Weak feedback.** Only giving thanks made a sound; the look button, settings, a tapped flower and the picture were silent and still. Now every action has a sound through `kit/audio.js` on the one audio context (each kind has its own note, so a day is a small chord) and a motion: buttons press and spring back, cards rise in, a tapped flower nods, a look change fades through, a drag that pans rustles. `check.mjs` counts notes for 14 actions; each makes at least one. Reduced motion turns the movements off; sound off turns the sounds off.

**More from the same rule: daily flowers.** Each kind of thanks now has three flowers, 36 in all (12 before). Which one grows depends only on the date, so it is the same for everyone that day, every kind shows all three in any three days in a row, and each day's buttons are a mix. Days before 2026-11-25 always grow the first flower, so a garden saved before this change draws exactly as it did. No save format changed: the flower is worked out from the day and the kind (`sim.js` `species`). The 24 new flowers, each with one idea of its own:

| Kind | Flowers (the first is the old one) | The new idea in each new flower |
|---|---|---|
| bread | wheat, barley, oats | barley: long whiskers; oats: grains hang down and sway |
| water | bluebell, grape hyacinth, forget-me-not | grape hyacinth: a bunch of tiny beads; forget-me-not: five small flowers in one head |
| home | tulip, crocus, hollyhock | crocus: a cup open to the sky with orange threads; hollyhock: cups up a stalk with a bud on top |
| family | daisy, aster, gerbera | aster: many fine rays; gerbera: two rings of rays round a dark eye |
| friend | cosmos, zinnia, sweet pea | zinnia: tiers of petals; sweet pea: shaped like a butterfly |
| health | rose, peony, camellia | peony: a ball of petals; camellia: petals in a spiral |
| rain | snowdrop, lily of the valley, iris | lily of the valley: bells hang in a row from an arching stem; iris: petals up and petals down |
| rest | moonflower, evening primrose, lotus | evening primrose: a notch in each of four petals; lotus: a cupped fan on a leaf |
| work | lavender, foxglove, lupin | foxglove: freckled bells on one side; lupin: the colour pales up the cone |
| tree | myrtle sprig, cherry blossom, fern | cherry blossom: a petal keeps falling; fern: an uncurling spiral |
| light | sunflower, marigold, dandelion | marigold: ruffles; dandelion: a seed drifts away |
| something else | star flower, passionflower, allium | passionflower: a crown of threads; allium: a globe of tiny stars |

**Languages.** All words are in `words.js` (English and Turkish, `kit/i18n.js`); the settings card has a Türkçe / English button; dates follow the language; the title is uppercased by CSS so Turkish gets its own İ. The Turkish has not been read by a native speaker. The recording notice is the kit's and stays English.

**Recording.** Unchanged events (`thanks` ×3, `daily-finished`, one run ending `won`); the `thanks` event and the run summary now also carry the flower name, and the run start carries the language.

**Checks.** `bots.mjs`: the old claims, plus 36 different flowers each with a drawing and a name in both languages, the same word keys in both tables, 800 days before the cutoff drawn as before, 1000 days after it the same on every call with all three flowers in any three days, and parity with the rules on main at 1264f14 (5000 random thanks give the same saves, the same places and lights for 600 days, the same demo garden, and each kind's first flower has the old drawing numbers). `bots.mjs --mutate` runs the daily claims against a copy whose flowers ignore the cutoff and change by visit; it fails. `check.mjs` adds: the flower on the bread and light buttons for four dates, Turkish words after the language button, a one-day garden drawn larger, a sound for each of 14 actions, no flower behind the words in a 60-day garden, mean page work per frame under 8 ms while three thanks fly in a 60-day garden (measured 1.7 ms WebKit, 1.3 ms Chromium; max 4 ms), and at 320x568 in both languages every control inside the screen, the title at least 8 px from the look button, and no scroll. `kit/check/phone.mjs lab/thankful` adds the daily flower in Turkish and the old flower before the cutoff. Opened from the small games home (`?from=small`) the page shows the kit's way back on the settings card and under the tray (`kit/home.js`), and a finished day counts as a win there; `small/catalog.js` marks the page as playing in Turkish.

Not verified: a real phone, how the sounds feel (they were counted, not heard), the share sheet itself (headless downloads the picture instead), a real second day, Turkish wording, and whether the new flowers read as the flowers they are named after at button size (foxglove and fern are the weakest drawings).
