# Repeatable simulated player feedback

The five bounded policies in `tests/support/player-archetypes.ts` choose only exposed actions and shelf objects from `getView`. Labels, detail, intent and their own choice history determine preference. The state is passed to the public engine only; policies cannot inspect faults, skills, progression flags or RNG. Selection is deterministic, including ties. They are deliberately simple habits, not calibrated people or optimal walkthroughs.

- Skip-everything prefers leaving, shelving and moving on over doing repairs.
- Impatient avoids waits with no visible endpoint; finite disclosed waits remain possible.
- Social-first favors conversations, tea and invitations.
- Completionist favors inspecting, comparing, checking and tinkering.
- Continuation-seeker favors explicitly labeled school transitions and garage visits over another ordinary day, while avoiding repairs. Its choice IDs remain opaque; it reads labels/details and intent only.

Every policy gradually tires of repeated choices, so none literally refuses its nonpreferred actions forever. A run ends at its explicit input budget or absence of any exposed choice. Reaching the budget does not mean finishing the story. Choosing a shelf object is an actual selection input and consumes that budget.

Run and save actual input traces and replayable final exports:

```sh
PATH=/opt/homebrew/bin:$PATH PLAYER_REPORT_DIR=/tmp/repair-player-baseline npx vitest run tests/player-archetypes.test.ts
```

Optionally set `PLAYER_STORY` to an existing export path to continue that exact story with each policy. Use a separate report directory after changes to compare actual action traces. Reports contain the story and dialogue: keep them local until publication is authorized.

Diagnostics identify repeated actions leaving the entire view unchanged, eight encounters with the same visible work/offers, and an agreed disclosed day-plan entry becoming late. The second is a review candidate: productive waiting and ordinary social play can repeat a work state. A late plan is observed from public status, not guessed from hidden time. A visible promise of reachability requires a separate human or targeted public-input traversal; this runner cannot prove an option unreachable from a finite unsuccessful run. These diagnostics are investigation prompts, not automatic defect verdicts.

Automated tests check preference isolation from opaque action IDs, finite-wait preference, bounds, repeatability, exposed-input legality and exact export replay. Source-unread playtesters complement them by interpreting the visible story and trying unexpected routes. Record simulated feedback separately from actual tester words. Neither these scores nor agent reviews accept fun; Adam does that by playing.

## Comparative check, 2026-10-10

The original four fresh 100-input policies ran before and after engine 14's school-transition work. Before, skip-everything, impatient and completionist remained fourteen; social-first reached fifteen. After, the first three reached after-school and social-first reached seventeen. Repeated-work review candidates changed from 3/1/2/1 to 3/0/0/0 respectively. This proves these particular public-input routes improved, not all routes or enjoyment. A fifth continuation-seeker selected the garage visit at input 34 and four consecutive disclosed return-to-school choices at 35–38, reaching after-school while leaving optional repair work behind.

Owner-story continuation exposed a different candidate: social-first alternated discussing Sam's stopped light, demonstrating its contact repair and supervised trying three times, interspersed with tea. Its repeated-work signal occurred at input 10. Completionist instead performed the contact repair, explained it and returned before the longer check, then explored and patched the saved shopfront. Returning early reflects this policy's scoring weakness as well as an exposed choice; it does not establish that verification is broken. Later cabinet/model/shelf cycles produced cumulative repeated-work candidates while simulated days advanced. These are useful trace excerpts for a reader to investigate, not evidence that ordinary free play must always advance the campaign.


## Delivered engine-16 checkpoint

The final five fresh and five actual-owner continuations each ran their full 100-input bound and replayed exactly. Reports remain local in `/tmp/repair-player-final-016-fresh/` and `/tmp/repair-player-final-016-owner/`. No run stopped for lack of exposed choices. In skip/impatient/social/completionist/continuation order, repeated-visible-work diagnostic counts were 3/0/0/0/1 for fresh stories and 2/3/4/3/2 for the owner story. These counts flag repeated work/offers even when time or conversation advances; they do not assert completed campaigns or prove dead ends. The separate source-unread long player established an actual supervised completion, rather than this scoring policy being treated as acceptance.

## Final engine-17 V1 candidate

Five fresh policies and five continuations of the actual 327-input owner story each used all 100 additional inputs and stopped at the budget. The local reports are `/tmp/repair-player-v1-rc-fresh/` and `/tmp/repair-player-v1-rc-owner/`; their native-17 final exports passed exact replay in the report-producing checks. These policies observe exposed choices only, and the counts below describe their particular traces.

| Policy | Fresh repeated-work candidates | Owner repeated-work candidates | Fresh endpoint | Owner endpoint |
| --- | ---: | ---: | --- | --- |
| Skip-everything | 3 | 2 | Age 16, summer day 3 | After school, summer day 13 |
| Impatient | 0 | 3 | After school, summer day 5 | After school, summer day 18 |
| Social-first | 0 | 4 | Age 17, summer day 1 | After school, summer day 15 |
| Completionist | 0 | 3 | After school, summer day 3 | After school, summer day 16 |
| Continuation-seeker | 1 | 2 | After school, summer day 2 | After school, summer day 7 |

No report recorded an unchanged-view diagnostic or a late-plan diagnostic; every report's only possible diagnostic kind was repeated-visible-state. Fresh final exports contain 100 total inputs; owner continuations contain 427, preserving the 327-input prefix. Fresh journal counts in the table's order were 99/138/142/139/125, and owner counts were 537/566/573/568/577. No report stopped for lack of exposed choices. This does not prove that every route reaches the ending, that all waits are pleasant, or that the game is enjoyable; the repeated-work candidates remain review prompts.

The separate actual keyboard/3D browser story completed Mum's reading lamp in nine recorded inputs. Its native-17 export is pinned by `tests/engine17-keyboard-ui-story.test.ts`, SHA256 `5170799d439874eeab4caab67d8a7b97d843fb1aca26214deb24191089f20439`. The test reconstructs its exact input times and packet, preserves its checked return, and confirms player-assisted work grants no independent apprentice credit. This records an observed UI route and deterministic replay, not general accessibility or owner taste acceptance.
