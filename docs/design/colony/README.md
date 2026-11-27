# Colony game design (working name Cinderhill)

An original ant colony real-time strategy and base-building game for phone and desktop browsers, alone or with friends by link. Asked for by the owner on 2026-11-25. Genre reference: Empires of the Undergrowth. The project rule is to take the genre, not the game.

| File | What it holds |
| --- | --- |
| [01-reference-research.md](01-reference-research.md) | The reference game: story, mechanics, units, missions, modes, strategy, praise and complaints, with sources. Reference only |
| [02-spec.md](02-spec.md) | The game (round 3, the rebuild spec): what done means, the clean-room table, the pace budget and every number, the first five minutes, systems, chapters, modes |
| [03-features.md](03-features.md) | Features ranked R1 (chapter 1), R2 (Spring), R3 (friends) and later, plus lab toys |
| [04-roadmap.md](04-roadmap.md) | Milestones R0 (pace harness) to R3 in order (no dates), gates, risks |
| [05-tech.md](05-tech.md) | Engine, sim, netcode and art decisions; the rebuild's keep, extend or rewrite plan per module; prior art |
| [06-tech-research.md](06-tech-research.md) | Research behind 05: swarm sims, flow fields, netcode, terrain, engines, free assets, WebGPU status |
| [07-biology-ideas.md](07-biology-ideas.md) | Real ant biology as mechanics, ranked, with sources |
| [08-cloudflare-and-prior-art.md](08-cloudflare-and-prior-art.md) | Current Cloudflare products, limits and costs for the game; prior art by aspect, with lessons and traps |
| [09-round2-findings.md](09-round2-findings.md) | An outside review, an independent design and the research above, checked and merged: what we took, what we did not, ranked traps |
| [10-fresh-design.md](10-fresh-design.md) | The round-2 independent from-scratch design, kept as a source of ideas. Not our game |
| [11-round3-findings.md](11-round3-findings.md) | Round 3 (2026-11-26), after the owner found the M1 build too slow and too basic: the play evidence, nine reviews, findings adopted and rejected, and the owner's decisions |
| [round3/](round3/) | The nine round-3 reviews in full: three blind designs, red team, players, tech, cold builder, business, wildcards |
| [12-round4-findings.md](12-round4-findings.md) | Round 4 (2026-11-26): eight reviews from two model families (unbiased, player lens, adversarial, blind from scratch), 26 findings checked and folded into 02, 03, 04 and 07, and six new taste calls |
| [13-full-game.md](13-full-game.md) | The full game (2026-11-27), after the owner called the spec basic: campaign map with forks, mission types, the home nest, rooms, the Lineage tech tree with exclusive picks, castes, enemies, build order. Wins over 02 where they differ |
| [round4/](round4/) | The eight round-4 reviews in full and the evidence summary they read |

Roadmap items are in the todo list under epic `lab-5w7` (`bd list --label cinderhill`). The open owner decisions are listed in 11 and 12; `lab-5w7.1` (name and setting) is one of them.
