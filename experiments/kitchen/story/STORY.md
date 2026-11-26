# Sky Kitchen: story and missions

Revision 2, 2026-11-26, after three reviews (arc, comedy, pacing). The text is English only; `words.js` also carries Turkish, so every line will need a Turkish version. Ranks 6 to 10, the wheel action ids, the `quick_serve` goal type and the new beat fields are proposals.

Files:
- `beats.json`: 44 beats, 27 missions.
- `specials.json`: 9 repeatable daily specials.

## Premise

**Puddleford** sits under a fat, permanent cloud the town calls **the Lid**. Every morning, food falls out of it. Nobody asks why.

**Kid**, the chef, is the grandchild of **Nana Wren**. Nana once ran **the Top Table**, the best restaurant anyone remembers. Then she was gone, with no goodbye. Kid inherits her squeaky cart and her dented tray.

**Kid's flaw:** Kid cooks for stars and for Nana's approval. Kid pins the first review up high, "where Nana would see it". Kid cooks "like she's reading".

**The question:** "Why didn't she say goodbye?" It opens at the bistro, when Kid learns the crate notes are Nana's.

**The answer** comes in the fine-dining letter. Nana went *up*. She tied her garden to the clouds so the whole town would eat, and if she lets go, the cloud drifts. So she couldn't come down. The tray was her goodbye, and Kid has held it every day.

**The rival:** **Sterling Vane** of Vane & Gleam grew up in Puddleford before the Lid, when the town "shared ONE turnip". He vows never to share again. He builds **the Siphon**, a funnel on his tower that sucks up sky food and spits his trash out of the top. **This is why bones, cans and broken plates fall from the restaurant rank on.** He is laughable as well as greedy: each rank ends one of his schemes in a pratfall.

**Kid's choice (rank 5, day 3):** Vane's tower is flooded with soup, and he hasn't eaten in two days. Feeding him earns no stars, and nobody is watching. Either way, Vane asks for the job *after he is fed*, not after a humiliation.

**What it means:** food is something you hand on, not something you grab. The last rank ends with Kid packing a crate for a new kid in Hillbrook and signing it with one letter.

### The Manners Wheel (all seven owner actions kept)

Nana sends the wheel down in a crate at the bistro, with her rule: **"Feed everyone. Throw food? Spin first. THEN feed."** The wheel does not punish people out of the restaurant. It sorts them out, and then they eat. Every action has a one-line payoff (`payoffs` on beat `r2d1_wheel`). In each one the guest comes back singed, shivering or sheepish, and orders:

| Action | Payoff |
|---|---|
| `kick_out` | Booted into the hedge. Back in a minute, leaves in his hair, asking for the menu. |
| `slap` | A slap with a wet fish. He blinks, says sorry, orders the soup. |
| `fridge` | Out he comes, shivering: "Something warm, please." |
| `pan` | Sizzle, hop, hop, hop. Singed eyebrows. Very polite now. |
| `microwave` | Ding! Hair straight up. "One salad, please." |
| `cook_self` | It catches fire. They eat it anyway, humbly. |
| `lock_out` | Nose on the glass for an hour. Let back in, fed, very quiet. |

Guests can throw bad food in Kid's face; the rank 2 heckler and Vane at rank 3 do. Vane's own beats override the payoffs for `pan` and `cook_self`.

## Cast

| Who | Voice | Running thread |
|---|---|---|
| **Nana Wren** | Short orders, then a P.S. that undoes them. Signs "-- N." | Cooking rules that are life rules. Seen only from rank 5. |
| **Gus**, sweet regular | Always starts "Same as always." | Was Nana's dishwasher. Stays quiet because he promised her. Always leaves his fork standing up in the plate (planted at rank 2). At rank 5 a Gazette press card sits under that fork: he is The Fork. |
| **Marigold**, picky regular | Score first, reason second. | 4, then 6 ("I gave my own mother a three"), then 7, then 7.5 once you frame it. |
| **Sterling Vane**, rude and sneaky guest | Booming, ends on "Ha!" | Pratfalls: mop bucket (1), mustache in the soup (2), megaphone feedback (3), cabbage in the funnel (4), tower full of soup (5). After that: fed, then dishwasher, then he rebuilds the Siphon as Kid's balloon (7). |
| **Crumb**, pigeon (toasts only) | "Coo." | Moves in (0), rings the register (1), hatches from a calzone (2), files bones under "Vane" (3), bow tie (4), a 412-fry tab that Nana pays with one seed (5). The seed becomes a fry tree (6). |
| **The Fork**, critic | Gazette voice, forks out of five. | Names the place Sky Kitchen (3). Five forks (5). |

## Arc by rank

| Rank | Kid wants | What happens | Ends on |
|---|---|---|---|
| 0 Food cart | Feed people | Food falls; Gus knew Nana; the first note signed "N." | Who is N? |
| 1 Diner | Approval | Two forks, pinned up for Nana. Vane and his one turnip. | Vane wants the sky. |
| 2 Bistro | Nana | The Wheel; the rude heckler; Gus admits it's Nana's handwriting; the fork habit. | "Why didn't she say goodbye?" |
| 3 Restaurant | Stars | The Siphon and the junk; Sky Kitchen is named; Nana is "fine. Mostly." | Nana is in trouble. |
| 4 Fine dining | Answers | The letter answers the goodbye question. Vane fails to catch and fails to cook. Gus: the Lid is her garden. The blank card: "Not for stars. Yours." | Your dish? |
| 5 Five stars | To cook for others | Siphon clogs; Nana comes down and orders "Your dish". Five forks. Kid's choice about Vane. Gus's fork. | "Who's going to fix it, with my knees?" (question only) |

### Proposed ranks 6 to 10

The conflict is **repairing the cloud the Siphon tore**. Scraps tossed with "Pay to toss it" become seeds up there.

| # | Name | Beat |
|---|---|---|
| 6 | Rooftop Garden | Plant Crumb's seed and the scraps. "Grow it, don't grab it." The fry tree. |
| 7 | Balloon Galley | Vane rebuilds the Siphon as a balloon that only blows *out*. |
| 8 | Cloud Kitchen | Nana's stove inside the Lid. Every perfect plate stitches the cloud. |
| 9 | Starlight Room | The mended cloud drifts over Hillbrook. A kid with a squeaky cart looks up. |
| 10 | The Top Table | Kid packs the crate for Hillbrook and signs it with one letter. |

## Reveal schedule

Plot beats carry `"spine": true`. The game queues a missed spine beat into the next day. Every beat is on days 1 to 4 of its rank.

| Rank/day | Kind | Reveal |
|---|---|---|
| 0/1 | scene | Food falls; the tray was Nana's. |
| 0/2 | guest | Gus knew Nana ("ends cut square"). |
| 0/3 | note | The first "N." note. |
| 1/2 | review | The Fork exists; Kid's flaw (pins the review up high). |
| 1/4 | guest | Vane, and his motive (the one turnip). |
| 2/1 | note | The Wheel and Nana's rule. |
| 2/3 | guest | The notes are Nana's; Gus promised; the fork habit. |
| 2/4 | scene | "Why didn't she say goodbye?" |
| 3/1 | scene | The Siphon; the junk comes from it. |
| 3/2 | review | The name Sky Kitchen. |
| 3/3 | note | Nana is alive and under strain. |
| 4/1 | note | The answer: the cloud drifts if she lets go; the tray was her goodbye. |
| 4/3 | guest | The Lid is her garden. |
| 4/4 | note | The blank card: "Your dish". |
| 5/1 | scene | Siphon clogs; Nana comes down. |
| 5/2 | guest | Nana orders "Your dish" (pays off 4/4). |
| 5/3 | review + choice | Five forks. Kid takes the plate to Vane, or lets him come. |
| 5/4 | guest + scene | The press card under Gus's fork. Then the cloud-hole question. |
| 6/1 to 10/1 | scene/note | Repair, seeds, Hillbrook (9), the handoff (10). |

## Format for the loader

```
beat:    { id, rank, day, kind, speaker, lines[], reward,
           spine?, mission?, payoffs?, choice? }
kind:    scene | guest | note | review  (modal, max 2 lines)
         toast                          (1 line, no modal, no mission)
mission: { id, text, goal, needsMood? }
goal:    { type, n } | { type:"dish", dish, n } | { type:"wheel_use", action, n }
payoffs: { <wheel action>: line }   // shown after that action on this beat's guest
choice:  [ { id, text, lines[] } ]  // two buttons; both continue the story
```

- `rank` is the 0-based `TIERS` index; `day` is `dayAtTier + 1`, from 1 to 4.
- Each day has at most 2 modal beats and 1 toast, shown in array order.
- Show each beat once, and store shown ids in the save.
- A mission counts from the moment its beat shows and stays open until done. `reward` is paid when it is done. Beats without a mission have reward 0.
- `needsMood` (`rude`, `sneaky`, `picky`) tells the game to spawn such a guest while the mission is open. Dish missions rely on the game forcing that dish into the day plan.
- **Rewards** are a multiple of day income. Day income is 28, 55, 100, 180, 300 and 450 at ranks 0 to 5, then 620, 800, 1000, 1250 and 1500.

  | Multiple | Missions |
  |---|---|
  | 0.4 | wheel use, one dish |
  | 0.7 | several perfects, tips, no-extra day, two dishes |
  | 1.0 | clean catches, big perfect counts |
  | 1.5 | climax missions |
- **Mission types used:** perfect_cook ×10, dish ×8, wheel_use ×4, clean_catch ×3, tips ×2, no_extra_day ×1. There are no passive serve or coins missions.
- `no_extra_day` appears only at rank 0. `clean_catch` counts stay at 3 to 6, because clean rates fall to 0.2 to 0.33 from rank 3 up.
- **specials.json:** `n` scales by rank through `nPerRank`, and `pay` is a multiple of that rank's day income. `quick_serve` (served before the patience timer runs out) is a new goal type the game would need to add. `neat_day` stops after rank 1; `neat_catches` replaces it from rank 2.
