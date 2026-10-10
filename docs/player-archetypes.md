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
