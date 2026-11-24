# Game ideas shortlist, 2026-11-24

The owner asked for a scan of forums and the wider internet for game ideas, and for old games worth bringing back. This is the ranked result. The first two picks are being built as lab pages (`/lab/pitch/`, `/lab/ring/`).

## The owner's question: can a classic come back with very little change?

Yes, for traditional games. Their rules belong to nobody, and several fit a phone as they are: paper soccer, Pişti, Dara, mangala. For those the work is not new rules. It is teaching without words, a bot at the right strength, a daily position, a picture to share and a room for friends.

No, for a specific published game. Its name, characters, art, levels and look stay out. From those we take only the genre (a snake that grows, falling blocks, a ball and a paddle) and build a different game on it.

## How the picks were ranked

1. A stranger can play with one thumb and no reading.
2. A run ends in minutes, with a clear result.
3. There is a reason to show someone else: a picture, a shared daily, or a seat for a friend.
4. It fits what the lab has: `experiments/kit/` (touch, sound, pause, save, hint), the `Board` object in `workers/lab-ai` for shared daily scores, and the Crumbwar `Room` for live rooms.
5. Low effort ranks higher when the evidence is equal.

Already built, so left out or merged in: thumb duels (`duel`), slinging (`sling`), harvest, matching helpers (`matchmaker`), smoke tower (`breath`), rumour routing (`grapevine`), repair stall (`fixit`), follow-the-leader (`ducklings`), lifespan powers (`borrowed`), gratitude sky (`lab/thankful`), paper boat (`boat`).

## Ranked shortlist

Effort is agent working time to a playable lab page with bots and a phone check, not to a finished game. "Opened" means the link was fetched during this scan on 2026-11-24.

| # | Pick | One-line pitch | Our twist | Source (opened) | Why now | Effort | Fit |
|---|---|---|---|---|---|---|---|
| 1 | **Paper Pitch** (paper soccer, traditional pencil game) | Take turns drawing the ball's path across squared paper; bounce off old ink to move again; reach the far goal. | The match is a drawing: animated ink, and the finished pitch is the picture you share. A daily "score in one turn" position. | [Rules](https://en.wikipedia.org/wiki/Paper_soccer) | Almost unknown to English-speaking phone players, five-minute games, and tapping a neighbouring point is the whole control. | 1 day; friend rooms +2 days | Static lab page on the kit. Rooms later on the Crumbwar `Room`; daily on `Board`. **Being built: `/lab/pitch/`.** |
| 2 | **Firefly Ring** (draw-a-loop arcade, generic gesture) | Drag a glowing thread around fireflies; close the ring to catch them. | One-colour rings score n squared, mixed rings scatter; the thread is short and moths snap it; a night of 8 levels that ends at dawn. | [2025 jam favourites](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game) (entries built on closing a loop around enemies are praised) | "The gesture is the verb" recurs among jam picks, and a drag is the most natural phone input. | 1 day | Static lab page on the kit; Lantern's palette. **Being built: `/lab/ring/`.** |
| 3 | **Friends room for Thumb Duel** | Open a room, share a code, 2 to 8 phones play the duel kinds in a quick bracket; bots fill empty seats. | Uses the seven duel kinds the lab already has; no account, no install. | [Party-room thread, 437 points](https://news.ycombinator.com/item?id=46344573); [daily golf thread, 320 points](https://news.ycombinator.com/item?id=48510341), where players asked for private rooms | The strongest demand signal in the scan is "play with my friends by link". The lab's tester asked the same of Crumbwar. | 3 to 5 days | Crumbwar `Room` and `Directory`; `experiments/duel/sim.js` already resolves both sides on one tick. Needs a hand-deployed Worker. |
| 4 | **Pişti, same deal for everyone** (traditional Turkish fishing card game) | Play a card; match the top card or play a jack to take the pile; a one-card pile taken by a match is a pişti. | Duplicate scoring: each day every player gets the same shuffled pack against the same bot, so the board compares play, not luck. Two-minute hands, one tap per turn. | [Rules](https://www.pagat.com/fishing/pishti.html) | A much-loved game with no good small web version in English; the duplicate daily removes the usual complaint about card luck. | 1 to 2 days; live tables +2 days | Kit and `Board`. Live tables on `Room`. |
| 5 | **Ghosts on the daily** (for Lantern's Today's river and Seed Sling) | See faint traces of other players' runs on the same daily course. | Not a new game: an addition to two the lab has. | [Daily golf thread](https://news.ycombinator.com/item?id=48510341): seeing others' shots made it feel social | Cheapest way to make a daily feel shared. | Half a day per game | `Board` already takes Lantern daily scores; it would store a short path too. For the Lantern and Sling threads to take or leave. |
| 6 | **Burrow** (dig-a-grid run) | Tap a tile to dig; each dig spends daylight; find tools and food before dark. | Reuses The Warren's dig grid and the ant world; a run that ends in three minutes. | [Jam entry page](https://cruise-elroy.itch.io/moleduggery) (tap-to-dig roguelike, rated 4.52 in its jam) | Tap-only, deep for its size; the archive names the Warren grid as worth reusing. | 1 to 2 days | Kit; ideas from `archive/README.md`. |
| 7 | **Dara** (West African three-in-a-row game) | Drop 12 stones each on a 5 by 6 board, then slide; three in a row removes an enemy stone. | Daily "take a stone in two moves" positions; sand-and-stones look drawn in code. | [Rules](https://en.wikipedia.org/wiki/Dara_(game)) | Little known outside West Africa; tap and slide; three to five minutes. | 1 to 1.5 days | Kit; bot by search in `sim.js`. |
| 8 | **One Candle** (an idle game that ends) | Numbers grow while a candle burns down; in ten minutes it is over and you see what you made. | It ends, on purpose, with a result to compare. | [A reviewer's jam top ten](https://potbanksoftware.github.io/blog/2025/favourite-games-gmtk-2025) (a collect-and-upgrade entry that escalates to a finish, defended there as a full game) | The lab's own goal is a game outsiders finish; most idle games never end. | 1 to 2 days; balance is the risk | Kit, `save.js`. |
| 9 | **Mangala or Toguz Korgool** (Turkish and Central Asian sowing games) | Sow stones round the pits; capture on the right count. | Physical stones that pour; a daily "best sow" position; toguz's permanent captured pit shown as territory. | [Mangala](https://en.wikipedia.org/wiki/Mangala_(game)), [Toguz korgool](https://en.wikipedia.org/wiki/Toguz_korgool) | Old, deep, quick. Weaker pick because sowing games are common in app stores. | 1 day | Kit. |
| 10 | **Royal Game of Ur** | Race seven pieces along a shared lane with four two-sided dice. | Honest about the reconstructed rules; dice as tossed sticks. | [Rules and history](https://en.wikipedia.org/wiki/Royal_Game_of_Ur) | 4,600 years old and still plays well; several apps exist, so it needs a strong look. | 1 day | Kit. |

### Smaller ideas for the games the lab already has

- **Your earlier runs become the danger.** A 2025 jam favourite has the player dodging shots from their own earlier loops ([same roundup](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game)). In Lantern: last night's boat drifts down the river as an obstacle.
- **Daily format rules** from [an article on newspaper games](https://gamedeveloper.com/design/the-rise-of-newspaper-games): one puzzle a day, about three minutes, and a result picture that gives nothing away. The lab's dailies (Lantern, Grapevine, Fix-It Stall, Hold Your Breath) do not yet all produce a picture to share.

## What players complain about (and the lab should check in every game)

From the comment threads of eleven web-game launches on Hacker News, 2025 to 2026, read through the site's public search API (for example [a word game, 513 points](https://news.ycombinator.com/item?id=43593789), [a daily district puzzle, 244 points](https://news.ycombinator.com/item?id=48585739), [an ear-training game, 565 points](https://news.ycombinator.com/item?id=46556210)):

- Phone input: missed fast taps, a thumb covering the aim, drags failing on iOS, small targets.
- No way to tell how to start, when you have won, or how to give up.
- Losing everything after one mistake; a first level that is too hard.
- Rooms that lag or lose a player who reconnects.
- No sound on some iPhones; dark low-contrast text.
- Art that looks machine-generated (the lab draws in code, which avoids this).
- Wishes: play with friends by link, compare results, past days, hints, undo, no timer.

## What the big web-game sites show

Read from the popular and new lists of two large portals ([one](https://poki.com/en/popular), [two](https://www.crazygames.com/hot)) by title only, so the genre reading is an inference: growth and territory arenas, endless runners, "undo the tangle" physics puzzles, place-guessing, idle tycoons, quick sports, hide-and-seek rounds. No daily games appeared on those lists. A [trade report](https://www.pocketgamer.biz/report-hypercasual-and-puzzle-games-dominate-the-browser-gaming-space/) on one portal's US data for May 2025 to May 2026 says quick-skill and puzzle games lead.

## Names to stay away from

Traditional rules are free, but some names are not. Use "sowing game", "mangala" or "oware", not Kalah (patented in the 1950s, per [its article](https://en.wikipedia.org/wiki/Kalah)). Use "rummy tiles" or "okey", "code-guessing" or "bulls and cows", "falling blocks", "light trails" and "connection game" in place of the well-known trade names. Mū tōrere and Kōnane are living cultural games; name the people they come from if the lab ever builds them. This is not legal advice; check a name before anything is published beyond the lab.

## Gaps in this scan

- **Reddit was not read.** Every route tried was refused (the fetch tools, two archives, and the in-app browser). So r/gamedesign, r/gameideas, r/incremental_games and r/WebGames are missing. Reading them needs a signed-in browser.
- Hacker News launch threads show what builders and early visitors liked, not what players finish.
- 2026 jam results were thin: one 2026 entry was read; the mechanics above are mostly from 2025 jams.
- Appetite for the traditional games is an argument from fit, not measured demand. No 2025 to 2026 article or community data was found.
- The ranking is a judgement. Rows 1 and 2 were chosen to build first because they need no server; row 3 has the strongest demand evidence and the most work.
