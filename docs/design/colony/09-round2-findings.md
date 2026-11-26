# Cinderhill: round-2 findings and what we did with them

Status: 2026-11-25. After the first spec, the owner asked for early outside reviews, an unbiased from-scratch design to compare against, current Cloudflare practice, more prior art, and no dates in the roadmap. Three sources came back:

| Source | What it is | Where |
| --- | --- | --- |
| Review | A different model (Codex, `gpt-6.2-astra`, read-only) reviewed docs 01 to 07 against the repo's code | Summarised below; its repo claims were checked by hand |
| Fresh design | The same model, given only the genre and our constraints and no spec, designed its own game ("The Weight of Clover") | [10-fresh-design.md](10-fresh-design.md) |
| Cloudflare and prior art | Research on current Cloudflare products and limits, and prior art by aspect | [08-cloudflare-and-prior-art.md](08-cloudflare-and-prior-art.md) |

## Claims checked against the repo

The round-1 reviewer had been wrong about a file once, so each repo claim was checked before it changed a doc.

| Claim | Checked | Result |
| --- | --- | --- |
| `kit/lockstep.js` steps a tick only when it holds both phones' inputs | Header comment, line 1 | True. A sleeping phone would freeze every colony, so Cinderhill's room must not copy it |
| `kit/save.js` is localStorage strings and JSON | Source | True. 05-tech had implied the kit gives IndexedDB saves; corrected |
| `rig.js` uses native `Math` and a frame step | Lines 4, 16 to 77 | True. Rigs are cosmetic only and stay outside the sim |
| `look3d.js` stops adding shapes at capacity without telling anyone | `ball`, `rod`, `tri` return at `MAX` | True. The port counts dropped shapes |
| Crumbwar's later bench: 0.820 ms Classic, 1.085 ms Rush at 240 ants | `workers/crumbwar/DECISIONS.md` | True. Round 1 quoted only the earlier 0.56 to 0.76 ms |
| The lab board has a game allowlist and run tickets | `workers/lab-ai/src/board.mjs` line 9 | True. Cinderhill needs an allowlist entry and a scoring rule |

## What we adopted, changed or rejected

| Finding | Source | Decision | Where it landed |
| --- | --- | --- | --- |
| Spring can be won without ever testing the premise (regrowing the hill); bloom arrived only at feature 29 | Review | Adopted. A founding bloom (seed husks, two midden spots, a sprout that shelters foragers at dawn) is in the vertical slice | 02 §8, feature 53, M1 |
| Day 1 had two endings (first larva fed; the dusk goal) | Review | Adopted: one end, at dusk | 02 §8 |
| Hour three may reward the same plan on every hill | Review | Adopted: a depth gate of two late-campaign test hills before more seasons are written | Feature 54, roadmap depth gate |
| The first finger of a pinch looks like the start of a trail | Review | Adopted: strokes preview and commit on release; a second touch cancels. One-finger camera, zoom buttons, undo, tap-start/tap-end trails. Pass line is zero unintended orders in the command log | 02 §6.4, features 5 and 26 |
| Orders per minute is the wrong measure of control | Review | Adopted: the gate is whether a player can reroute a forager and tell whether it worked | 02 §6.4, §6.9 |
| Crew counts on every order; tap an ant to see why she waits | Fresh design | Adopted | 02 §6.4 |
| The room must not wait for a slow phone; command ids; durable before acknowledged; seat token separate from invite link | Review and fresh design agree | Adopted as protocol rules that hold whatever the room's role | 05 "Room protocol" |
| Relay-only room vs an authority room vs a server that moves aggregated worker groups | 08, review, fresh design disagree | Not decided. Relay-only is the cheapest default; spike S1 measures relay and authority. The fresh design's group model is close to our option B fallback | 05, S1 |
| A code deploy restarts live Durable Objects within minutes | 08 (its reading of the docs) | Adopted: SQLite checkpoints, version in the handshake, a deploy-then-resume test at M4 | 05, M4 gate, risks |
| CPU allowance counts from the last incoming message | 08 | Adopted: clients send a hash each second, which also catches desyncs | 05 |
| Saves: 30 s autosave leaves no headroom; no committed cursor; two tabs undefined | Review | Adopted: 20 s checkpoints, command suffix, committed cursor, previous good save, Web Locks for one tab | 05 Saves, feature 8 |
| Flow fields and scent fields need different invalidation; 8-bit decay can round to never fading | Review | Adopted: measured half-life test, double buffering, no leaks through walls; S1 budgets fields for all live goals | Features 3 and 4, S1 |
| A planted `Math.sin` may round to the same integer and not fail | Review | Adopted: a mutation shown to diverge, a flipped state byte, a lint for forbidden calls, a 60-minute soak | S2 |
| Defending aphids from ladybirds is the reference publisher's advertised decision | Review | Adopted: the choice is which plant gets the herd (route length against exposure); ladybirds are ambient | 02 §6.8, feature 35 |
| One fixed giant per season reads as a boss tier | Review | Adopted: large animals come because of what the colony built and return across days | 02 §6.5 |
| Named bands rebuild the reference game's group-selection rhythm | Review | Adopted: bands moved to P3, only if crews prove too coarse | 02 §6.4, feature 47b |
| Re-rank rescue of wounded ants (the reference's medic mechanic) | Review | Already P3 with a caution; left there | Feature 47 |
| Friend-join gate sat in M3 though friends' play is M4; name check sat at M6 though M3 lists the game | Review | Adopted: friend-join measured at M4; name check before listing at M3 | 02 §0, roadmap |
| Replace the whole roadmap with five evidence gates | Review | Partly. The milestone order stays (the owner called it smart); the gates were added inside it | Roadmap |
| An end-card "recommend" majority samples only those who stayed | Review | Adopted: denominators and early exits reported | 02 §0 |
| Living bridges: ants that hold a span cannot work | Fresh design | Wildcard toy first | Features, wildcards |
| TypeScript and a build step | Fresh design | Rejected: the lab's games are plain ES modules with no build step, and the kit is shared that way | 05 |
| Two art treatments for the owner to pick | Fresh design | Adopted as a practice for M1's look (variants for taste picks) | M1 |
| Compare the production pathing with a simple independent solver on tiny maps | Fresh design | Adopted for the bot harness | Roadmap, "How we know it works" |
| Workers static assets, SQLite DOs, hibernation, R2 for shared replays, Analytics Engine for aggregates, `@cloudflare/vitest-plugin`; no Containers or Realtime yet | 08, review | Adopted | 05 Cloudflare table |

## Traps, merged and ranked

From all three sources, most damaging first.

1. **Building seasons before the core choice is proven fun.** Depth gate before Summer content.
2. **A friend's sleeping phone freezes the hill.** The room seals ticks on its own clock.
3. **A deploy or eviction loses a co-op hill.** SQLite checkpoints, versioned handshake, eviction test.
4. **A pinch draws a trail.** Commit on release; command-log check on real phones.
5. **Saves that look safe and are not.** Checkpoint plus cursor, kill tests before, during and after a write.
6. **A determinism test that cannot fail.** Show the planted fault diverges; flip a byte; lint.
7. **Scent that never fades or leaks through walls.** Measured half-life; double buffer.
8. **Benchmarks that pass while the game fails.** Phone tests with the full scene, p95 frame time and input latency, WebGL context loss.
9. **Indirect control that reads as disobedience.** Crew counts and "why waiting" on every order.
10. **Agent-built days that feel interchangeable.** Each day must pose a choice the day before could not; the owner names it from the play link.
11. **An idle tab burns room hours.** The tick stops when the room is empty; abandoned-phone test in preview.
12. **Ants appear or vanish with zoom.** One labour ledger, the same at every zoom.

## Gaps

- Every Cloudflare limit and price above is 08's reading of the docs; the design does not depend on the exact figures.
- No measured instancing numbers on phones yet (S3).
- No primary source found on ritualised contests in games or on touch selection of swarms.
- Fun, real-phone feel and live recovery stay unmeasured until there is something to play.
