# Lantern notes

## 2026-11-22: first outside play notes

One tester played the 2026-11-22 build on a phone and gave spoken notes. The owner passed them on. The tester liked the game and wants it developed.

| Note | Done in this change | Left as a proposal |
| --- | --- | --- |
| The boat jumps to wherever the finger lands; a stray tap ends the run | A finger steers by how far it has moved since touch-down (`?gain=` sets the ratio, default 1.3). A tap does nothing. A mouse still steers by position | Tilt steering |
| Embers feel pointless; the dark always comes back | An ember gives 0.3 light (was 0.2), holds the flame for 2.5 s, and the lit circle grows more per unit of light | Embers as currency |
| A light that helps more | Blue ember: a shield that takes one hit from a rock, ice or the bank | |
| It does not get harder | Speed doubles over a night (was 1.8 times); rocks start to swing past halfway; the river pinches in the last tenth | |
| Nothing after winning | Nights: dawn opens the next night. Night 2 adds drifting ice, night 3 more swinging rocks, every night is 8% faster. The night reached is saved; `?night=1` starts over | Shop, coins, boat skins, extra life, smaller boat, hand-made levels |
| A phone call loses the run | Pause button, P or Escape, and pause when the page loses the screen | |

Checks: `node bots.mjs 200` plays three bot policies on nights 1 to 3. `node bots.mjs 200 audit` rides a ghost boat down 200 rivers per night and prints the narrowest free gap, so an impassable river shows up. Result on this change: narrowest gap 0.028 river widths (night 2, one river in 200 under 0.03), no closed river on nights 1 to 8.

Not verified: feel and sound on a real phone; pause on a real incoming call. Bot results show how runs end, not how hard the game is for a person.
