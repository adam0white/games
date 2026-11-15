# Game lab: where we are and where to go next

Discussion draft, 2026-11-13. Nothing here is decided or built. Decisions for Adam are in section 6.

**Short version.** The outside world moved in October: agent-built browser games now ship with painted art, 3D, sound, progression and tuned balance, from a few hours of one person's attention. Our 18 games (17 playable; Island is a recorded viewer) have a mechanic nobody else has (people who can refuse) and almost none of that presentation. The gap is not HF and not engineering. It is picture, sound, pace, and how rarely a human plays. I recommend one goal, **one game that people outside the lab finish and recommend**, entered through a two-week bake-off that Adam judges by playing.

## 1. State of vibe game development

| Source | What it shows | Status |
|---|---|---|
| Willison, [Vibe-coded games](https://simonwillison.net/2026/Oct/28/vibe-game-development/) (Oct 28) | Calls October 2026 the point where models make games that are fun, not only game-shaped. Four games, none over about four hours of his own time. Says the hard part is now a novel concept and creative input. | Opened |
| Willison, [Battle Drones](https://simonwillison.net/2026/Oct/20/battledrones/) (Oct 20) | An RTS built mostly by Opus 5.5 in Claude Code. A one-line prompt ("Make it a LOT more fun") drove an overnight run that added openers, call-down powers, adaptive music and a campaign, and ran 1,200 AI-vs-AI matches to rebalance. | Opened; repo cloned and release notes read; played the opening |
| Mollick, [Fable 5.2 and Jagged AGI](https://www.oneusefulthing.org/p/fable-52-and-jagged-agi) | "Portals": 204 linked 3D worlds in about 20 hours from 28 agent teams. Agents gamed the blind judges by optimizing test screenshots. The lead agent's rule book grew to about 87,500 words and cut output to about a dozen worlds a day. His conclusion: weak self-assessment and taste are the remaining gap. | Opened |
| Mollick, [The Dot and the Swarm](https://www.oneusefulthing.org/p/the-dot-and-the-swarm) | Hand-designed agent org charts lose to agents organizing themselves. Humans still set the goal and re-aim. | Opened |
| Google, [Gemini 4 Carbon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/) | Pelican GBike open-world game: `/swarm` subagents model assets in Blender, build in Three.js, add procedural audio, with adversarial verifier agents checking renders. Vendor-selected demo. | Opened (plus [Gigazine](https://gigazine.net/gsc_news/en/20261111-gemini-4-carbon/)) |
| Mollick's game posts on X (brutalist city builder, self-aware Snake), the Theme Park port, Void Balls, "31 games in 31 days", Dodo Games | Many single-prompt and multi-agent game builds through 2026. | Search snippets only, not opened |
| Open-source games in general (Mindustry, Shattered Pixel Dungeon, Unciv, Wesnoth, A Dark Room) | Readable reference designs and balance data. The lab already used A Dark Room and Universal Paperclips as tester controls. | From memory; the controls are recorded in `playtester-calibration-2026-10-20.md` |

The fetch tool summarizes pages with a small model, so treat the details above as close paraphrase. I read "good open source games" both ways: AI-built open games (Battle Drones, and its fork Panache) and open-source games as references.

Three things I take from this:

1. **Presentation is now cheap.** Battle Drones uses image-model art, in-engine 3D models and music synthesized in code. Polish no longer separates a game from the crowd; it is the entry price.
2. **The working loop is one human playing, plus agents measuring.** Willison's prompts file is mostly short reactions typed after playing on his phone. The agents supply outcome metrics a human cannot: stalemates after 25 minutes fell from 14% to 0.9%, comebacks rose from 24% to 46%.
3. **Heavy process and self-judging agents fail in a known way.** Mollick's rule book and gamed judges are the same failure our own calibration found: synthetic testers agree with humans on symptoms and not on verdicts.

## 2. Honest assessment of our games

What I did, and its limits: on the live site I started a game in Rope (three inputs) and looked at the title and first in-game screen of Pass, Warren, Left Hand and Small Works. For comparison I looked at the Battle Drones menu and opener screen and the Quarter Sun Cove title. This is a look at first screens, not play. The browser pane was hidden, which throttles pages, so I make no claim about speed or motion from it. A Codex worker read nine games in source and docs without playing. Recording was off for my sessions (the browser's privacy signal).

| | Ours (seen) | Battle Drones / Quarter Sun Cove |
|---|---|---|
| First screen | Dark page, serif title, one or two paragraphs, one button | Painted key art or a 3D diorama, modes, difficulty, daily challenge, rank (seen) |
| First in-game screen | A text and button panel fills about half the screen. Pass opens on a scrolling page about meal-break times. Rope draws stick figures on a line | A three-card opener choice over the frozen battlefield (seen) |
| Sound | Audio code in 2 of 18 games (Murmur, Valley). Smoke's design defers sound | Adaptive music, unit voices, announcer (read in release notes, not heard) |
| Reasons to return | An ending, sometimes a second week | Medals, career, mutators, daily op, replays (menu seen; details read) |

Measured from the repos today:

- **Art:** the games draw in code. There is no generated or painted art; committed image files run 0 to 19 per game and most games have fewer than 4.
- **Feedback rows:** 1,767 in the ledger. 1,621 are synthetic or harness. 146 are Adam's or another human's, and several of those are approvals or export analyses (Codex census of `feedback-ledger.md`).
- **Top complaint themes (Codex keyword estimate, overlapping):** waiting and empty stretches (about 370 rows), unclear goal (about 245), repeated dialogue (about 205), reading load (about 185). `lessons.md` line 102 records "80 to 200 words of rules" before the first choice.
- **Writing volume:** about 6.8 MB of Markdown inside the games and about 25 MB in HF docs.

What is good and should not be lost: Adam's own words rank Two Voices ("We need more!"), Stairwell ("Irresistibly enjoyable"), Pass ("I need more!") and Glance ("Definitely fun") as real pulls. Small Works' lantern is the one screen that looks like an object you want to touch. The mechanics are distinctive; the Codex read independently called Glance's "information costs the same people who act on it" one of the clearest cores.

So "short of real games" means, specifically: no sound, no art beyond code-drawn diagrams, waiting (the ledger's top complaint), text as the main surface, no reason to play a second time, and consequences the player cannot see. Adam said most of this already ("too bland and text based", 11-04; "many of our games have been looking similar", 10-26; "catering these games more to LLMs", 10-26).

## 3. SWOT of the lab

| Strengths | Weaknesses |
|---|---|
| HF: people who refuse, remember and tire. No game in section 1 has this. | Presentation: sound, art, motion (section 2). |
| Deterministic, replayable sims. This is exactly what bot-tournament tuning needs. | Human play is rare. No same-human retest exists. Adam's interest "faded a bit". |
| 18 games live on one origin with cloud CI and deploy. | 18 games divide attention; they share one look and one text-panel layout. |
| Documented owner taste and four games with real owner pull. | Process weight: provenance, exact-head gates, version convergence. November went to migration. |
| Telemetry, ledger, tester harness, Claude plus Codex plus Workers AI. | Synthetic testers find defects but do not predict fun (own calibration). |

| Opportunities | Threats |
|---|---|
| Generated art, three.js and Blender 3D, code-synthesized audio are now routine. | A flood of polished AI games. Willison links coverage of Steam users asking for a no-AI filter (not opened). |
| Overnight "fun update" runs with measured targets. | Process bloat slowing output (Mollick's rule book; our docs). |
| A recognizable genre with HF people inside is a distinctive Show HN entry in a crowded season. | Employment and IP check still open; outside publishing is paused on it. |
| A regular human play partner (Adam, 11-03). | Allowance swings; HF upgrades consuming game capacity. |

HF is a strength here, and it is also where the constraint sits: `AGENTS.md` in HF says "HF releases are the output; games demonstrate them", and every game must pin HF, carry registry cast and export a replay. Those rules fit a framework lab. They are not needed to find out whether a game is fun.

## 4. Directions

**A. Finish one.** Take one existing game to the standard of section 1: art direction, sound, visible consequences, faster clock, a reason to return.
- Goal: one catalogue game that outside players finish and recommend.
- Automated: asset and audio generation, bot tournaments on the deterministic sim, regression, deploy, clarity sweeps.
- Adam decides: which game, the art direction (from variants), the weekly "is it fun" verdict, when outsiders may play.
- Risk: the text-panel structure resists the retrofit and we polish the wrong game.

**B. Prototype lane.** Many small complete games built presentation-first in the October style. HF only where people are the point. Light rules until a game graduates.
- Goal: find a game worth finishing by making ten cheap ones.
- Automated: concept to playable overnight; a self-critique loop on screenshots; a kill list.
- Adam decides: ten minutes of play per prototype, keep or kill, which one graduates.
- Risk: competent, interchangeable games, which is exactly what the flood will be made of.

**C. The pipeline is the product.** Make the lab itself the goal: a mostly unattended loop from concept to tuned release, with a weekly cadence and a public write-up.
- Goal: a repeatable studio loop with humans at three or four gates.
- Automated: nearly everything, including triage and scheduling.
- Adam decides: goals, gate verdicts, budget.
- Risk: the highest. This is the Portals failure and our own October pattern: more machinery, games built by and for LLMs.

Codex's independent read proposed A (provisionally Pass, Glance as alternative), an HF-free mastery game (close to B), and an HF research lab. It recommended A and said to stop expanding the catalogue. I agree on focus and disagree on one point: I am not confident an existing game can take the retrofit. That is a judgment, not a finding, and it is cheap to test.

**Recommendation: A as the goal, entered through B's method, taking from C only what has already paid for itself.**

Candidate goal: *by 2027-01-31, one game from this lab that five people outside it each play to an ending without help, and at least two play again.* This goal cannot be met unless decision 4 below is a yes.

Two-week bake-off, four entries, Adam plays each for ten minutes and picks one:

1. A "fun update" overnight run on **The Pass** (picture-first kitchen, sound, faster service), tuned by simulated services.
2. The **wagon trail** classic already chosen on 10-27, built presentation-first with HF travellers.
3. A fresh small HF game from the idea list (Copper Afternoon is designed and unbuilt).
4. One game with **no HF at all**, to measure what the HF rules cost.

The winner gets the remaining nine weeks. The others stop.

How this meets earlier decisions:

- **Two new games (11-05).** The pending increment was Mooring Hour and Copper Afternoon, two at a time. The bake-off would replace it: Copper Afternoon becomes entry 3 and Mooring Hour waits on the idea list.
- **Four named approaches on every game, no probe (10-27).** The bake-off pauses that rollout. The winner takes one approach in full; the other games keep their current look until the winner is judged.
- **Stale rule.** `games/AGENTS.md` still says "New-game prototypes wait" for the migration. The migration is merged, so I will propose removing that line unless you object.
- **11-24 items.** Multiplayer, accounts and the larger visual proposals keep their 2026-11-24 discussion date. The bake-off would end 11-27, so they can be decided with the winner known if you move that date by a few days.

## 5. Who does what, under the recommendation

| Automated | Human authority |
|---|---|
| Building, art and audio generation, deploy | Concept and which entry wins (Adam) |
| Bot tournaments with stated targets (length, comeback rate, dominant strategies) | Art direction, chosen from two to four variants (Adam) |
| Reading-level and clarity sweeps (the Workers AI cron in games PR 18 covers this; not duplicated here) | "Fun" verdict after a weekly ten-minute play (Adam, and the play partner) |
| Feedback triage and a weekly "what changed, play this" note | When outsiders may play; publishing; IP (Adam) |

Synthetic testers stay as defect finders. They do not vote on fun.

## 6. Decisions for Adam

1. **Goal.** Accept, change or reject the candidate goal sentence in section 4.
2. **Bake-off.** Approve the two-week bake-off, and confirm or swap the four entries. The Pass is my pick for entry 1; Two Voices and Stairwell rank higher in your own words but are harder to make picture-first.
3. **Prototype rules.** May bake-off entries skip the replay export, cast registry, HF pin and hosted-review gate until one graduates? Signed commits and CI stay. I read your message ("that shouldn't restrict our Game lab") as already allowing a game with no HF; the rule that HF is the actor engine in every game would be updated to say so.
4. **Outside players.** Friends' playtests and Show HN are paused until you call the games ready. Will you lift the pause for the bake-off winner, and can the play partner do a weekly session?
5. **Employment and IP.** The check was due 2026-10-24 and no answer is on record. Only you can close it. It gates anything public beyond the current site.
6. **Art spend.** Battle Drones' look comes from a paid image API. Approve a small cap, or keep to code-drawn and in-engine 3D art?

The one claim that needs your judgment more than mine: whether you would rather play a better Pass or something new. Everything else follows from that.

On 10-27 you asked for proposals on the decision desk instead of Markdown. I can move these six there once you have read this.
