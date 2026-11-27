# Cinderhill, the game page (`/cinderhill/game/`)

The new client for the same sim as the trail painter one folder up. It reads `../host.js` and `../sim/` and changes
neither; no game rule lives here. The painter at `/cinderhill/` is untouched until the sim work hands over.

- `gl.js`: the surface as lit relief (WebGL2). One sun, a twelve-minute day, an ember night; stones stand up and cast
  shadows; the camera tilts (`k` squeezes the ground, `lift` raises what stands on it).
- `nest.js`: the nest as a cutaway panel (Canvas 2D) over the lower part of the screen.
- `main.js`: host, gestures, orders, HUD, route card, effects, sound, settings, recording.

## Settings

Every taste choice is a setting with a default: view (tilted, top down), light (day and night, day, ember), style
(painted, ink), ant size, sound. `?view=`, `?light=`, `?style=`, `?size=`, `?sound=` set them from a link. Recording
uses the painter's lab slug: the run's `look` is `game:<view>/<light>/<style>`, a `client` event lists the settings
that differ from the defaults, and each change in play is a `setting` event `{ k, v, from, at }`.

## Checks (2026-11-26, emulated only: Chromium, Pixel 5 viewport, CPU slowed four times, a desktop graphics chip)

| Page | Ready for input | Frame mean / p95 | Work mean / p95 |
|---|---|---|---|
| `?free=2000` | 0.33 s | 16.7 / 16.7 ms | 3.4 / 10.1 ms |
| `?free=5000` | 0.25 s | 16.7 / 16.7 ms | 4.1 / 12.5 ms |
| colony game | 0.32 s | 16.7 / 16.7 ms | 3.5 / 8.9 ms |

Not measured: a real phone's graphics chip. The ground shader is heavy per pixel, so the page lowers its pixel
ratio in steps (2, 1.5, 1) when the mean frame goes over 24 ms, and records a `dpr` event when it does.

## Not here yet

The bird, the husk, sprouts, the chapter script and its end card, the ledger and saved games: the page will draw
them from sim state and events once the sim has them.

## Round 2 (after the first review round)

Decisions taken:
- One perspective camera serves every view. `View` is a setting with `tilt` (default), `top` and `low`; the low view
  shows the sky, a far ridge and distance fog. The menu uses the low view. The same arithmetic lives in the GLSL
  `CAM` snippet (gl.js) and in `pose/toWorld/toScreen` (main.js); change both together.
- Each trail slot has its own colour (ribbon, badge, route dot).
- An order gets its success feedback only after the sim applies it. A refused or late trail gets a red dashed
  pulse, a low tone and one line of text; the first-run ghost finger stays until a trail is accepted.
- The route card hides itself after a few seconds. Level labels read "a few / more / most".
- The first-run hint is the game's own ghost drag; it keeps the kit hint's key and format (`cinderhill:game:hint`).
- The recording switch shows on the menu as well as the pause card.
- The alarm renews itself from the game loop on sim ticks, so it holds at 4x speed.

Checked on an emulated phone (desktop GPU): refused trail, accepted trail, nest, low view at night, 2000 and 5000
free ants at 4x CPU throttle hold 16.7 ms frames. Not checked: a real phone GPU with the per-pixel sky and fog,
alarm hold at 4x, context loss, picking against raised stones (a tap on a stone's side picks the ground behind it).

Deferred (tracked in beads under the Cinderhill item): dusk time-lapse replay, GPU nest, ambient sound bed, births
shown in the nest, nest cutaway over the door, double-tap to centre and pan inertia, baked ash textures, i18n,
and everything the sim does not emit yet (bird, husk, sprouts, chapter card, ledger, saves).
