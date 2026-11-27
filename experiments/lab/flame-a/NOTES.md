# Pass the Flame

Serve the repository’s `experiments/` directory as the static root and open `/lab/flame-a/`. Touch the river to take the flame, then slide to steer. On a keyboard, use Space to take it, the arrow keys to steer, and P to pause. A fresh flame starts at 76%. A linked flame starts at the level in its fragment. A leg lasts 60 simulation seconds, plus the initial transfer. Actual distance depends on the seed.

At the buoy the carrier can sign with a nickname or leave it blank. The result lists each retained name and distance, the current leg, and the total through all hands. Earlier carriers share a row with their combined distance. The native share sheet receives the pitch and URL. Clipboard and manual-copy fallbacks include both on separate lines. Opening the link starts the recipient at the sender’s outgoing light. Sharing the same result again keeps the next seed.

## Link

New fragments use `#f=2~checksum~count~flame~total~seed~distance:name[~distance:name…]`. For example, Sam’s first handoff could be:

    #f=2~d66770cc~1~47~1840~23~1840:Sam

The eight lowercase hex digits are FNV-1a over the public prefix `river.coals.v2/` and the canonical payload starting with the count. This only deters casual editing. Anyone with the code can calculate a checksum or construct a plausible legacy link. There is no server signature.

The count describes previous legs. Count and seed fit unsigned 32-bit integers. Light is a whole percentage from 1 to 100. Each leg contributes 16–2,040 whole metres. The fragment holds the last eight carriers, oldest first, or everyone in a shorter chain. Names have at most 16 Unicode letters, ASCII digits, spaces, underscores, dots or hyphens, with canonical URI encoding. An anonymous row ends in a colon. Either link version recovers that final colon if a chat app strips it.

Old `#f=1~count~flame~total~seed~…` fragments have no checksum. Both formats check field lengths, canonical spelling, ranges, names and distance arithmetic. For a legacy link, fewer than eight entries support only that many carriers. With eight entries, the distance left after subtracting their legs bounds the number of earlier carriers. The decoder reduces an inflated legacy count to the supported count and refuses an inconsistent total. A refused fragment displays an explanation and opens a fresh flame.

## Rules and settings

Paper, Thermal and Storm share a seeded river. Paper is the default. An idle boat takes the first central ember and misses the later embers. The drain rises after the sheltered first 21 seconds. Steering toward off-centre embers lets a weak flame survive the faster drain.

On a first drop, `dims` (default) allows a carrier to pass an 18% ember. With `ends`, that option is absent. The existing `retryRule=allow` gives one relight on the same river at 25% light. A second drop ends that branch even under `dims`. The existing `retryRule=once` gives one attempt. Starting a new flame makes the player carrier 1. Leaving the page pauses a leg.

## Storage and recording

| Key | Value |
| --- | --- |
| `flame:name` | Optional nickname from the last pass |
| `flame:set:look` | `paper`, `thermal`, `storm` |
| `flame:set:drop` | `dims`, `ends` |
| `flame:set:retryRule` | `allow`, `once` |
| `flame:set:sound`, `flame:set:haptics` | `on`, `off` |
| `kit:lang` | Shared English or Turkish preference |

The standard kit recorder uses its shared player, recording-off and queue keys and its per-game session and privacy keys. This page records under its own lab slug, `flame-a` (flame-b records under `flame-b`). Its notice appears on arrival. Its switch is in Settings. Runs carry the five settings, incoming count, link-arrival flag, ember/hit events and outcome. A share records the kit’s result in `pass_send`. Carrier names and link fragments are omitted from these event payloads. Assets load from the static host. When enabled, lab recording uses its usual external endpoint. The relay itself uses no server.

## What is simulated

The river, boats, wakes, light, rain and sounds are generated. The approaching boat is a reenactment. No previous player is connected. The named lights come from the link. Beyond its eight names the river shows anonymous lights, with up to 64 individual lights in view. Links can be copied, edited and played more than once. A branch ending applies to that play. There is no global chain, identity check or revocation.

## Verification

Run `node experiments/lab/flame-a/check.mjs`. Across seeds 0–199, steering toward embers finished 200/200 fresh legs and 121/200 legs received at 18%. Idle runs at 1%, 18%, 76% and 100% all dropped between 21.3 and 38.2 simulation seconds. The check also covers a deliberate bank drop, incoming light after a handoff, legacy count inflation, invalid fields, checksum edits, and recovery of a stripped final separator.

Round 2 exercised the actual page handlers with Happy DOM, pointer events, a controlled frame clock and a clipboard double. A fresh run reached handoff, filtered a pasted nickname and produced a pitch plus link. Reopening that link restored the name, carrier number and light. A refused link showed its explanation. An idle run dropped, relit at 25% on the identical course, dropped again, then started a fresh flame. A separate 23-carrier arrival reached a 24-hand result and produced English and Turkish share text. The painter ran against native Canvas 2D at 320 px across all three looks, the transfer, and full and low light.

The round 2 phone runner was blocked from binding its localhost server. Browser launches were also denied by the sandbox. The earlier round passed the Pixel 7 Chromium and iPhone 13 WebKit profiles. Current browser layout, native sharing and clipboard permissions, audible playback, haptics, physical-phone frame rate and load time, and live recording remain unverified. The 320 px title clearance comes from the CSS dimensions. Outside-player response to this revision remains unmeasured.
