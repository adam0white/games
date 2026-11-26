# Cinderhill: round 4 findings

Round 4, 2026-11-26. The owner asked for more reviews of the round-3 spec before the rebuild: unbiased, blind, lensed, adversarial and from scratch, from two different model families. This file lists what they found, what was checked, what changed in 02, 03, 04 and 07, and the taste calls that only the owner can make.

## How the reviews were run

Eight reviews, four from each of two model families. Reviewer A is one family and reviewer B the other. Each review is kept in full in [round4/](round4/).

| Review | Lens | What the reviewer saw |
| --- | --- | --- |
| [A](round4/review-a-unbiased.md), [B](round4/review-b-unbiased.md) unbiased | Cold read: does the spec do what it says? | 01, 02, 03, 04, 05, 07, the sim code, and [an anonymized evidence summary](round4/evidence.md). Not 11 or round3 |
| [A](round4/review-a-player.md), [B](round4/review-b-player.md) player lens | Four players: colony veteran, two-minute phone player, parent with a child, economy designer | The same |
| [A](round4/review-a-adversarial.md), [B](round4/review-b-adversarial.md) adversarial | Pre-mortem: the game shipped and failed; why? | The same |
| [A](round4/review-a-scratch.md), [B](round4/review-b-scratch.md) blind from scratch | Design a game for the same brief without seeing our spec | The brief and the evidence summary only |

The reviewers did not see file 11, so their notes that the owner decisions are missing are wrong and are not counted.

## Findings adopted

"Checked" means the arithmetic was redone against 02 section 3.2 for this file. "Reported" means a reviewer's claim taken on judgment.

| # | Finding | Raised by | Status | Change |
| --- | --- | --- | --- | --- |
| 1 | **The chapter 1 door jam cannot happen.** At 3 to 5 min Surge is about 100 to 190 ants, sending about 9 to 12 a second through a door that passes 18 | A unbiased, A player, B unbiased, B adversarial, B player | Checked | Jam moved to chapter 4 (already in its skeleton); congestion tested in its own fixture; chapter 1 script rewritten after 2:00 (02 s3.2, s4, s8.1; 03 #5) |
| 2 | **Auto-forage makes crew size moot.** Rule 4 sent every free ant to the nearest route: 100 ants on an 8 s cycle empty both opening piles by about 20 s | B player | Checked | Free ants wait by the door as a visible count and do not forage on their own (02 s6.2). Taste call B |
| 3 | **The crew base was circular.** A percentage of a pool that excludes crews settles Steady near 20% and Surge near 33% | B unbiased, B player | Checked | Base is now the whole outside workforce, crews included (02 s3.2) |
| 4 | **The bird barely matters.** At most 5 of 300 ants (1.7%); good and bad husk placement can both show 5 deaths; the script allowed 75 s against a 60 s gate | All four lensed reviews of both families | Checked | Cost scales with exposed ants, carriers drop loads, the route scatters 10 s; paired replays must differ by 60 s; the script ends the strike by 60 s (02 s3.2, s4; 03 #6). Taste call A |
| 5 | **Recall had two rules.** 3.2 said nearest shelter; 6.7 said every ant home; neither said when it ends | A player, A adversarial, B unbiased | Checked | Nearest shelter everywhere; ends when the threat passes or on a second tap |
| 6 | **"Nursery full at 3:00" could not happen** with a fed colony: about 60 brood in 80 cells | A unbiased, B unbiased, B player | Checked | Nursery 64 cells; the beat fires on the event; a protein-short colony sees that beat instead |
| 7 | **The idle bot did not lose as written.** Its larvae starve by about 3 min, before any lethal rain, so "the brood all drowns" was empty; under 50 ants by starvation takes about 30 min | B unbiased, B adversarial, B player | Checked | Loss also when the queen drowns or after 2 min with no brood and no sugar; the idle bot's queen chamber floods at the storm peak (02 s8.2) |
| 8 | **The chapter 3 bill had no numbers** and "ends when the bill is paid" conflicted with "short, the weakest die" | A unbiased, A player, A adversarial, B player | Checked against A player's worked dusk | 0.2 sugar a load per adult, due during dusk, seeds crack to 2 sugar, projected deficit from mid-chapter, shortfall costs adults (at most a quarter) and the colony advances (02 s3.2, s6.1, s8.1; 03 #18). The coefficient is a starting value: 0.25 turns the same play from surplus to default |
| 9 | **Gate staging was undefined.** Which pace lines block which pull request? | A unbiased | Reported | "Which lines block what" under the 3.1 table |
| 10 | **The telegraph line clashed with chapter 2,** whose rain warning comes at 2:00 | A unbiased | Checked | The ≤ 60 s line is chapter 1 only |
| 11 | **No gate checks that a choice changed anything.** A decision every 30 s can be met with choices that make no difference | A scratch, B adversarial | Reported | New line: 4 consequential choices per chapter by paired replay; a quiet-stretch line for the first 2 min (02 s3.1) |
| 12 | **"Finish chapter 1 without help" passes by waiting** | B adversarial | Checked (the passive bot finishes by design) | R1 counts a finish only with at least 5 orders (03 #12, 04 R1) |
| 13 | **No player is asked about recommending until R2c; no retention metric** | A adversarial, A unbiased, B adversarial | Reported | R1 asks about continuing, recommending and next-day return; R2c measures 20 active minutes and unprompted return over all starters (04) |
| 14 | **The R1 real-phone fixture includes rain and a rival,** which arrive in R2a and R2b | A unbiased | Checked (05 stress fixture) | Those parts are measured when they exist (04) |
| 15 | **Chapter 1 births are mostly pre-made pupae,** so the player cannot see their protein made an ant | A unbiased, A adversarial | Reported | The cutaway follows the load to a marked larva and the marked adult (02 s4; 03 #12) |
| 16 | **The first rain is unfair:** a structure takes 5 to 20 s, brood drowns in 10 s, and the first pulse came before a plug was offered | A unbiased, A player | Checked | Warning draws the waterline; the first pulse floods an empty passage; the second is the first that can reach brood (02 s3.2) |
| 17 | **Dusk gives no reason to return** | A unbiased, A adversarial | Reported | The chapter card shows tomorrow's hill (02 s4; 03 #11) |
| 18 | **The decoy has no one-thumb gesture** | A player | Checked (6.7 modes) | A Make decoy button on the route card of a trail that ends on nothing |
| 19 | **Depth check can pass with no reversal** | A player | Reported | Bots must first show the hill-A winner loses on hill B (04) |
| 20 | **Combat tuned on equal headcount, and the 20 s wander rule frees a door-holder** | A player | Checked | Equal-protein test; holders and fighters exempt (02 s6.4) |
| 21 | **Sugar is loose:** one forager feeds about 80 ants | B player | Checked (8 loads a minute at a 7 s trip) | Tuning target: 20 to 30% of outside workers on sugar for the median bot (02 s3.2) |
| 22 | **The queen chamber adds no ants** when the nursery caps births | A player, B player | Checked | Chapter 3 offers it with a nursery dig (02 s3.2) |
| 23 | **Nothing pauses or saves when the tab is hidden** | A player, B player | Reported | Solo time pauses and saves on hide (02 s3.2) |
| 24 | **07 still carries reference-roster ideas:** exploding workers, bullet ants, trap-jaw knockback, ladybirds thinning aphids, Matabele rescue (rated 5/5 original), living bridges, a field guide | A adversarial, B adversarial | Checked | Flagged [excluded] in 07 with a note; 02 uses none of them |
| 25 | **Route readouts:** show waiting, carrying and unloading counts on the ground, and preview a trail's first trip in seconds | A scratch | Reported | 02 s7 |
| 26 | **Guided against free is untested.** The owner's longest session was free play; the spec bets on chapters | A adversarial, A player, B unbiased, B adversarial, B player | Reported | Counterbalanced guided-versus-free test at R1 (04). Taste call C |

## Not adopted

- **Wipe-out from 3:00 (B scratch).** Stakes are owner decision 5 in 11; this round does not reopen them.
- **Three-day runs ending in a mating flight, traits drafted at dawn (B scratch).** Kept as ideas for After Spring; the 03 "Later" list already holds the wedding flight and traits.
- **Watershed of six sites with founding transfers (A scratch).** Close to the founding runs toy in 03; that toy answers it.
- **Raising sugar upkeep now.** Left as a bot-tuned target (finding 21) so the numbers in 3.2 stay one source.

## Taste calls for the owner

**The owner answered on 2026-11-26** (in words, since the table's option letters differ from the order the calls were put): A, the bird's cost scales with exposed ants and drops loads. B, free ants gather food on their own "but with some fun and decisions left": built as free ants foraging only the nearest drawn trail at a low rate, so crews still decide where and how fast (02 section 6.2). C, an unlisted free hill beside chapter 1 at R1. D, chapter 1 keeps its scope. E, a failed night bill costs ants and the colony carries on smaller. F, both a chapter score with a best-run replay at release and a persistent free hill with a long-running rival next.

These are new. Calls the owner already has open (session shape, looks, start size, tone, stakes, name) are in 11 and in todo `lab-5w7.32`; where this round added evidence to them it is noted at the end.

| Call | Options | Recommended | Why |
| --- | --- | --- | --- |
| **A. What the bird costs** | (a) a flat 5 ants; (b) a share of the exposed ants, plus dropped loads and a 10 s scatter; (c) 20 to 25 ants, about 5% | **(b)**, now in 02 | It ties crew size and cover into one choice and shows on the store counter |
| **B. What free ants do** | (a) forage the nearest route on their own; (b) wait by the door as a visible free count; (c) outflow set by return rate, as harvester ants do | **(b)**, now in 02; (c) as a lab toy | (a) makes crew size moot |
| **C. Free hill timing** | (a) at R2c as written; (b) unlisted beside chapter 1 at R1, and the R1 test compares them; (c) the first menu leads with it | **(b)** | Five of eight reviews point at the owner's 17-minute free-play session as the strongest pull |
| **D. Chapter 1 scope** | (a) as now: trail, crews, husk, bird, births, sprout, dig, sources; (b) five ideas (trail, births, husk and cover, bird, sources run out), with crews and dig in chapter 2 | **(a)** with the door jam already moved out; (b) if R1 players stall | (b) is safer for strangers; (a) keeps more to do in five minutes |
| **E. What a bad outcome leaves** | (a) ants die at the card; (b) the bill comes due during dusk, shortfall costs adults, the colony advances smaller; on Gentle a visible rescue keeps the queen and brood | **(b)**, bill part now in 02 | The player keeps the colony they raised and sees why it shrank |
| **F. What keeps a veteran after Spring** | (a) Hard and the daily score; (b) a chapter score (ants, bloom, losses) with a best-run replay; (c) a persistent free hill with a lasting rival; (d) a skirmish against the chapter 5 rival | **(b)** at release, (c) next | A score gives replay a target; a lasting rival gives trails a history |

**New evidence on open calls.** Start size (11 decision 6): reviewer B adversarial recommends about 100 ants with 2 eggs a second, so births and losses both show; the 300 start makes a 5-ant loss invisible. Words (11 decision 4): reviewers split between wordless (A unbiased, B unbiased) and one short control hint per beat with no narrator (B adversarial); natural-history one-liners were flagged by both families as near the reference game's voice.
