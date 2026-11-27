# Pass the Flame

Serve the repository’s `experiments/` directory as the static root and open `/lab/flame-a/`. Touch the river to take the flame, then slide to steer. On a keyboard, use Space to take it, the arrow keys to steer, and P to pause. A fresh flame starts at 76%. A linked flame starts at the level in its fragment. A leg lasts 60 simulation seconds, plus the initial transfer. Actual distance depends on the seed.

At the buoy the carrier can sign with a nickname or leave it blank. Passing tries the native share sheet, then the clipboard. The kit returns “shown” when the sheet is dismissed or automatic copying is unavailable. In that case the game selects the link for manual copying. Sharing again uses the same next seed.

## Link

The fragment has the form `#f=1~count~flame~total~seed~distance:name[~distance:name…]`. Example for the first player to receive Sam’s flame:

    #f=1~1~47~1840~23~1840:Sam

The count is the number of previous legs. Total and individual distances are whole metres. The flame ranges from 1 to 100. The seed and count are unsigned 32-bit integers. Up to eight carrier entries appear, oldest first. Earlier distances remain in the total. Names use canonical URI percent encoding and contain at most 16 Unicode letters, ASCII digits, spaces, underscores, dots or hyphens. A blank name is valid. The decoder checks lengths, characters, canonical spelling, integer bounds and distance consistency. Invalid fragments start a fresh flame.

## Rules and settings

Paper, Thermal and Storm share one seeded simulation. Paper is the default. The default drop rule lets the carrier pass an 18% ember. The alternative ends that branch. Retry is independently configurable and replays the same seed and incoming flame. Lighting a new flame discards that branch and makes the player the first carrier of the new one. Leaving the page pauses a leg.

## Storage and recording

| Key | Value |
| --- | --- |
| `flame:name` | Optional nickname from the last pass |
| `flame:set:look` | `paper`, `thermal`, `storm` |
| `flame:set:drop` | `dims`, `ends` |
| `flame:set:retryRule` | `allow`, `once` |
| `flame:set:sound`, `flame:set:haptics` | `on`, `off` |
| `kit:lang` | Shared English or Turkish preference |

The standard kit recorder uses its shared player, recording-off and queue keys and its per-game session and privacy keys. Its notice appears on arrival. Its switch is in Settings. Runs carry the five settings, incoming count, link-arrival flag, ember/hit events and outcome. A share records the kit’s result in `pass_send`. Carrier names and link fragments are omitted from these event payloads. Assets load from the static host. When enabled, lab recording uses its usual external endpoint. The relay itself uses no server.

## What is simulated

The river, boats, wakes, light, rain and sounds are generated. The approaching boat is a reenactment. No previous player is connected. The named lights come from the link. Beyond its eight names the river shows anonymous lights, with up to 64 individual lights in view. Links can be copied, edited and played more than once. A branch ending applies to that play. There is no global chain, identity check or revocation.

## Verification

Run `node experiments/lab/flame-a/check.mjs` from the repository root. The check covers canonical and hostile links, retention of the last eight carriers, numeric limits, finish-to-next-start light, first-ember placement, rock timing, idle survival and a deliberate bank drop. Across seeds 0–199, the ember-following policy finished 200 legs. The shortest idle run lasted 46.9 seconds with a fresh flame and 21.3 seconds with a 1% incoming flame.

A separate integration exercise drove the actual handlers and renderer with DOM and canvas test doubles. It completed a handoff, reopened the generated manual-copy link, hit the bank, passed a weak flame, retried the incoming chain and started a fresh one. It also exercised pause and resume. Each look was drawn and inspected with a native Canvas 2D implementation.

This session could not start the shared phone test’s local HTTP listener, launch an isolated browser, or reach the browser host. Static-server browser load, real touch, native share, clipboard permissions, audio, vibration, load time on a phone connection and 60 fps on a midrange phone still need device verification. The live recording endpoint and its game registration also remain unverified.
