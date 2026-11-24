# Thankful Sky

The lab's own idea: a short daily gratitude ritual, with no score or missed-day penalty.

Three looks use the same saved entries and the same places. Sky draws blue night and constellations. Lamps draws paper lanterns and amber reflections. Garden draws flowers sharing a stem. Sky is the default. The three dots select and remember a look.

Storage is `thankful:v1`: `{v:1,days:{'YYYY-MM-DD':[{k,t?}]},look,sound}`. Dates use local time. Each day accepts three entries. Optional words belong to `spark` and have at most 24 Unicode characters. Invalid saved values are discarded. No network calls or third-party dependencies are used. Demo mode generates earlier days in memory and never writes. Day override is for checks. Settings offers sound and a confirmed reset.

Every day that has a light gets a place in a field of five rows, counted from the first day, so a place never moves and the whole of the last few weeks shows at once (about 25 days on a phone; drag for older ones). A day's three lights sit round its place and are joined once the day is full. Missed days take no place and bring no prompt. When the third thanks is given the tray leaves and the field opens downward. Every seventh completed day adds a shooting star. Reduced motion removes drift, trails and the shooting star. `?demo=40` shows a grown sky without saving; `?day=YYYY-MM-DD` sets today for checks.

How it was built: Codex wrote the first version from a brief; the layout (it showed one day per screen, so a grown sky looked empty) and the three looks were then rewritten by the lab agent.

Checks: `node experiments/lab/thankful/bots.mjs`; `PLAYWRIGHT=<dir with playwright> SHOTS=<dir> node experiments/lab/thankful/check.mjs` (WebKit iPhone 13 and Chromium Pixel 7 profiles; both passed on 2026-11-24). Not verified: sound and feel on a real phone, a second real day (the day change was only checked with `?day=`), and whether a person comes back the next day. Not wired yet: lab recording (`kit/lab.js` needs the slug added in human-framework first) an entry in `kit/check/phone.mjs`, and the shared notes button (`/notes/button.js`; the page makes its own link for now).

Ideas not built: a soft reminder at a chosen hour, a yearly view, sharing a picture of the sky, words of thanks from several traditions shown after the third light (needs the owner's choice of texts).
