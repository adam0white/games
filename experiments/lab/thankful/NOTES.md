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
