# Reference research: Empires of the Undergrowth

Compiled 2026-11-25 from public web sources. Mechanics are described in my own words. Facts marked **(from memory)** were not confirmed in a source I opened. Several primary references (the official Hooded Horse wiki, the Fandom wiki, Prima Games, TV Tropes, GameStar, Reddit) blocked automated fetching (403/402), so detailed numbers (unit stats, nursery costs, timers) are thin; treat any number without a source as unverified.

This file is reference only. Nothing here (names, story, species roster, level ideas, UI) goes into our game; the spec in `02-spec.md` takes the genre and answers the complaints. The clean-room table is in `02-spec.md`, section 1.

## 0. Fact sheet

| Item | Value | Source |
|---|---|---|
| Developer / publisher | Slug Disco Studios (UK, ~3 people per dev post) / Hooded Horse + Slug Disco | Steam store, Steam thread |
| Engine | Unreal Engine 4 | Wikipedia |
| Early access | 1 Dec 2017 | Steam store |
| 1.0 | 7 Jun 2024 | Steam store, GamingOnLinux |
| Price | $29.99; DLC Exploding Ants $4.99, Supporter Pack $9.99 | Steam store |
| Steam (English, all time) | Overwhelmingly Positive, 95% of 11,189 | Steam store, fetched 2026-11-25 |
| Steam (recent 30 days) | Very Positive, 92% of 393 | Steam store, fetched 2026-11-25 |
| Critics | OpenCritic lists only 2: Games Machine 7.6, Gaming Professors 8; Gaming.net 8/10; PC Gamer pull quote "an absolutely excellent RTS" | OpenCritic, Gaming.net, Steam store |
| Multiplayer | None. Single-player only | Steam store features; Games Machine via OpenCritic |
| Platforms | Windows, macOS, Linux (native build stale; dev recommends Proton) | Steam store, GamingOnLinux |
| Post-1.0 support | Continued: Remix arcade mode (Dec 2024), rainforest remaster + Exploding Ants DLC (Mar 2025); a pinned "Roadmap - October 2026" exists in Steam discussions | GOG changelog, Steam forum index |

## 1. Story and framing

**Two-layer frame.** The campaign interleaves two kinds of play:

1. **The Formicarium (lab colony).** You run a colony of a fictional ant, the "gene-thief" (*Formica ereptor*), kept in a lab by two scientists. The gene-thief absorbs genetic traits from other species via Royal Jelly. This colony is persistent across the whole campaign. The scientists periodically run "experiments" on it: scripted attack waves, then a rival colony, then giant "Titan" creatures in the late game (Gaming.net, Wikipedia, Steam store). The scientists provide light character comedy (one is gleeful about pitting ants against monsters, the other compliant, per Gaming.net). Steam's page hints at "brutal experiments" and a twist.
2. **Documentary missions.** Self-contained levels framed as episodes of a wildlife documentary, with a narrator voicing natural-history commentary about the real species you control. You play a fixed real species (not your gene-thief colony), and your formicarium upgrades do not carry in (Gaming.net). Completing them pays Royal Jelly and unlocks new species/traits for the lab colony (Steam store, Wikipedia).

Wikipedia notes levels have "little connected storyline"; the narrative glue is the lab and the scientists.

**Campaign structure (tiers by biome).** Content is organised into five numbered tiers, each a biome with a headline species and 2-3 documentary missions plus one formicarium experiment. Mission IDs are "tier.index" (e.g. 3.1 "The Harvest", 5.1 with the Emperor Scorpion).

| Tier | Biome | Headline species | Confidence |
|---|---|---|---|
| 1 | Temperate woodland | Black ant | Bloxodes lists black ant as woodland; tier number **(from memory)** |
| 2 | Beach / coast | Wood ant (formic-acid shooters) | Bloxodes lists wood ant as beach; level names "Rising Tide" and "Queen of the Hill" in changelog; tier number **(from memory)** |
| 3 | Ecuadorian rainforest | Leafcutter ants (4 sizes); army ants as enemy **(from memory)** | Changelog Apr 2019; Slug Disco Tier 5 post refers to "tier 3's leafcutter ants" |
| 4 | Green Swamp, North Carolina | Fire ants; first Titan (great blue skimmer dragonfly) | Slug Disco March 2021 newsletter, changelog Jul 2022 |
| 5 | Sub-Saharan savannah | Matabele ants vs. *Macrotermes* termites; Titans incl. sun spider, centipede, emperor scorpion | Slug Disco Tier 5 post, Steam thread |

The 1.0 release added the savannah tier, final story arc (three documentary missions, full voice, new art, a climactic challenge) and New Game Plus (GamingOnLinux). Each standard level has a harder "challenge" variant unlocked on completion that pays extra Royal Jelly (Prima via search snippet, +33 to +78 early on; not opened).

## 2. Core mechanics

### Resources
- **Food** is the single colony currency in missions; it is physically carried by workers back into storage tiles in the nest, and it pays for brood. An empty stockpile stops reinforcements (Steam store).
- **Food sources** have different behaviours: seeds, nectar, fungus, insect carcasses, amphibians. Some are renewable and can be disrupted (e.g. ladybugs eating the aphid honeydew source) (Steam store). Corpses of killed enemies are food, so combat is also foraging. Guides note holding Ctrl displays food values on items (guide snippet).
- **Species-specific economies:** leafcutters harvest leaves to farm fungus (a processing chain: leaves -> fungus -> food); fungus-growing termites convert lignocellulose into fungus; Matabele ants depend almost entirely on raiding termite mounds, which creates a sustainability trade-off: over-raid and the termite colony dies and stops producing (Slug Disco Tier 5 post, Bloxodes). One Steam thread estimates a termite nest is worth ~3-5k food before it decays.
- **Royal Jelly** is the meta-currency: earned from documentary and challenge missions, spent in the formicarium on traits and tile upgrades (Gaming.net, Prima snippet).

### Queen and brood
- One queen per colony sits in a central chamber; she is the only egg layer and losing her ends the mission (guide snippets, Gaming.net notes losing the queen early).
- **Nursery tiles** are the production buildings. Each nursery is set to a caste (worker, soldier, shooter, etc.); it consumes food and after a delay produces that ant. Stronger castes cost more (Gaming.net). Exact timers and costs: not confirmed.
- **Population cap** is tied to nest tiles (Slug Disco Tier 5 post refers to a "tile population limit"; Matabele medics revive ants with reduced stats, which lets the colony exceed it).
- In the gene-thief formicarium, the queen spends Royal Jelly to choose which traits future brood carry (Bloxodes).

### Nest building
- The nest is a **hex grid** of diggable soil and undiggable bedrock around a central queen chamber (Steam store). Workers dig; some must stay home to dig, build, and move eggs (Steam store).
- **Tile types:** food storage, nursery (per caste), and in later versions speed tiles and refuse tiles (changelog). There is a "quick build" tool (changelog 2022).
- **Adjacency upgrades:** a tile upgrades when surrounded by same-type tiles or walls; guides recommend compact hexagonal clusters and putting nurseries in dead-end rooms because ants move slowly over nursery tiles; keep food storage near the surface entrance to cut walking time (guide snippets).
- **Formicarium tiles** are a persistent, scarce resource: new tiles come from completing missions (Gaming.net). One negative review complains you cannot rebuild the main base, so early layout mistakes are permanent.

### Unit control model (the most distinctive design choice)
- **No individual unit control.** Ants belong to up to five **pheromone groups** (I-V). Each nursery is assigned to a group, so new brood auto-joins it (Steam store; Hooded Horse wiki via search snippet).
- **Pheromone markers:** right-click the map or minimap to place the group's marker; the group travels there and acts in context (fight what is there, pick up food there) (wiki via search snippet).
- **Rules of engagement:** per-group toggles to forage, fight, or both (Steam store). Players use an "allow attack" toggle as a workaround for stuck targets (Steam thread).
- Large groups respond more slowly; within a group, order of response follows control-group order (wiki snippet). Players reported ants ignoring move orders for 15-45 s in early access; the developer acknowledged the trail system was imperfect (search snippet of Steam thread).
- Developer intent: simplify micro to make the RTS accessible to casual players (Steam thread snippet). Vaporlens counts "less micromanagement than typical RTS" as a praise theme (25 mentions), yet negative reviews call pheromone management tedious late-game and complain there is no active pause and no way to order a retreat cleanly.

### Combat model
- Automatic melee and ranged combat when groups contact enemies; outcomes are driven by numbers, caste mix, and positioning (flanking). Several enemies have readable gimmicks you counter with positioning: a rove beetle with a stunning spray you flank; hermit crabs you isolate one at a time (Steam store). Titans have attack patterns (centipede spits only forward, so mark mid-body; emperor scorpion targets the largest ant cluster) (Steam thread).
- Status effects across species: stun, knockback, execute small targets, paralysis/DoT, confusion, slow, taunt, ally buffs (Bloxodes).
- Day/night cycle changes risk: nocturnal predators, night raids (Steam store).
- "Bigger swarm wins" is a widely cited dominant strategy (negative review).

### Upgrades / mutations
- **Formicarium adaptations:** Royal Jelly buys species traits and tile upgrades. For each skill set you pick one of two options (a binary branch); costs range widely (guide snippet cites 50 RJ for a black ant ability and 400 for a Matabele "Sustain"). Upgrades are permanent and cannot be bought during an experiment (Prima snippet).
- Species are unlocked into the formicarium via documentary missions; the lab colony becomes a multi-species mix (Royal Guard, "Larry" hybrid units per Bloxodes; bullet ant soldiers after the story).
- Leafcutter majors had four upgrade options at launch of that tier (changelog).
- Early access had a "minor improvements" purchase system (changelog 2018).

## 3. Units and enemies

### Playable colonies (Bloxodes, cross-checked with Slug Disco posts and changelog)

| Colony | Biome | Castes and roles |
|---|---|---|
| Gene-thief (story) | Lab | Queen, worker, royal guard, hybrid; jelly-driven trait selection |
| Black ant | Woodland | Worker, biting soldier (baseline) |
| Wood ant | Beach | Worker, soldier, shooter (acid mortar vs. rapid straight-line fire branch) |
| Leafcutter | Rainforest | Four size castes (minim, minor, media, major); minims tend fungus; majors tank/taunt or stun; castes walk over/under each other |
| Fire ant | Swamp | Worker, soldier; can link into floating bridges over water |
| Big-headed ant | Swamp | Minor, major, supersoldier (stun, knockback, execute); clumsy, may stumble |
| Little black ant | Swamp | Soldier sprays a debuff that increases damage taken |
| Matabele | Savannah | Worker, soldier, medic (carries wounded home to revive at reduced stats); termite-raiding economy |
| Exploding ant (DLC) | Rainforest | Minor soldiers self-destruct (damage + slow); majors buff in-nest allies |
| Fungus-growing termite | Savannah | Queen + king, minor/major workers, minor soldier (debuff), major soldier (aura buff) |
| Exploding termite (DLC) | Rainforest | Mature workers explode (confuse + DoT) |
| Unit-only | — | Bullet ant soldier (paralysing sting, execute); driver ant workers and two soldier sizes (custom games) |
| Trap-jaw | — | Melee that leaps back to regain health (Steam store) |

Pharaoh ants: I found no evidence they are in the game. Termites are playable only in custom/Remix modes, as far as I could confirm. Cancelled species: honeypot, bull, Saharan silver, crazy ants (Wikipedia).

### Enemies (examples)
- Rival ant colonies, including attacking enemy queens; army ants and driver ants as non-playable eusocial enemies (Wikipedia, Steam store).
- Arachnids (spiders incl. whip spider; sun spider Titan; emperor scorpion Titan), centipedes (Titan), amphibians (bullfrogs, pine woods tree frog), crustaceans (hermit crabs), beetles (rove beetles, tiger beetles), mantises, earwigs (two sexes), cow-killer velvet ants (flee with speed boost, sting at low HP), wasp mantidflies (ambush from plants), phorid flies (parasitoids, formicarium challenge 3), woodworms, velvet worms (Wikipedia, Slug Disco posts, changelog, custom map snippet).
- **Titans**: a class of huge bosses with bespoke behaviours introduced in tier 4 (dragonfly) and continued in tier 5 (Slug Disco).
- Enemy selection follows real ecology of the biome (Slug Disco Tier 5 post).
- Arachnophobia mode swaps spider visuals (changelog 2024).

## 4. Missions, difficulty, onboarding

**Mission archetypes** (inferred from level descriptions, threads and reviews):
- **Establish and grow**: start with queen + few ants, dig, forage, survive predators.
- **Wave survival / defence**: formicarium experiments 1-2 and extra levels (Babysitting, The Other Foot, Extremis, Excavators) (Gaming.net).
- **Rival colony / kill the queen**: later experiments and documentary levels; some "kill all" modes can soft-lock if a creature gets stuck (Steam thread).
- **Economy puzzle**: leafcutter fungus chain, Matabele termite sustainability.
- **Boss/Titan**: tier 4-5 and the final experiment.
- **Roguelite-ish**: Extremis grants points on death to unlock units for the next attempt (changelog 2020).
- Missions are long: reviewers cite 40 minutes to several hours (Vaporlens).

**Difficulty**: Easy, Medium, Hard, Extreme, Impossible (reworked Dec 2023), plus challenge variants per level and New Game Plus (changelog, GamingOnLinux). Some Impossible variants are fixed scripted sequences (negative review). Odd tuning: one player notes the nest holds more food on Impossible than easier modes.

**Scoring/progression**: rewards are Royal Jelly per mission, higher for challenge variants and difficulty; 100+ achievements (changelog). A per-mission star/grade system: not confirmed.

**Saving**: no in-mission save in story missions, by design (dev: a reliable save "would add months of work per level" for a 3-person team). Free play can save. There is no active pause for issuing orders (Steam threads, reviews). Saving is blocked during attack waves in free play (changelog 2020).

**Onboarding**: a dedicated tutorial mode, then early missions that double as tutorials; light-bulb hint pop-ups in the formicarium (Gaming.net). A positive reviewer says the tutorial covers ~80%; recent negative reviewers quit at the first experiment or could not work out food gathering (Steam reviews).

## 5. Modes

| Mode | What it is | Source |
|---|---|---|
| Story campaign | Formicarium + documentary missions, 5 tiers | Steam store, Wikipedia |
| Formicarium experiments ("challenges") | Scripted tests on the persistent lab colony | Gaming.net, changelog |
| Challenge variants | Harder version of each mission, extra RJ | Prima snippet |
| Extra / arcade levels | Babysitting, The Other Foot, Extremis, Excavators, Aggrandise, etc. | Gaming.net, changelog |
| Battle arena | Set up fights vs. creatures (preview builds used it to show Titans) | Gaming.net, Slug Disco |
| Free play / custom game | Sandbox colony on chosen map, difficulty tuning, optional victory conditions, shareable setups, custom multi-species colonies | Changelog 2020, Dec 2024 |
| Skirmish vs AI | Classic RTS vs AI rival colony | Steam store |
| Remix | Arcade mode mixing ants and termites across levels | Changelog Dec 2024 |
| New Game Plus | Replay campaign with upgrades at higher difficulty | GamingOnLinux |
| Seasonal challenges | Listed on Steam | Steam store |
| Multiplayer | **None** | Steam store |

## 6. Common strategies (from guides, threads)

- Forage surface food early before breaking into unexplored underground caverns; unknown underground creatures can wipe your workers (guide snippet).
- Avoid fights until you can win decisively; time attacks so you are not also defending (guide snippet).
- Keep soldiers near the queen; she is a single point of failure.
- Layout: food storage close to the surface exit; nurseries in dead-end side rooms; compact hex clusters for adjacency upgrades; speed tiles are cheap and worth it (guide snippets).
- Separate pheromone groups for foragers and fighters; escort foragers when starving.
- Use ranged castes (wood ant acid) for targets melee can't reach, incl. stuck enemies (Steam thread).
- Matabele: focus one termite mound, hit-and-run, kill the patrolling predators, move fast after the termite queen dies because the food decays; split soldiers+medics into two groups once large (Steam thread).
- Titans: position markers relative to their attack arc (Steam thread).
- Grind challenge variants for Royal Jelly to buy formicarium upgrades (Prima snippet; reviewers call this grindy).
- Overall meta: maximise swarm size; numbers dominate (negative review).

## 7. Reception

### Quantities
- Steam English all-time: 95% positive of 11,189; recent 30 days: 92% of 393 (Steam store, 2026-11-25).
- Vaporlens (third-party aggregator of review text) reports average playtime 22 h; its own "positive sentiment" metric is 78% (differs from Steam's 95%; methodology unknown).
- Critics: few formal reviews; 7.6, 8, 8 from minor outlets; PC Gamer and Rock Paper Shotgun quoted on the store page (RPS compares it to SimAnt). GameStar reviewed it (score not opened; snippet says "not particularly pretty, but convinces with inner values").

### Praise themes (Vaporlens mention counts where available, plus 10 top-rated positive Steam reviews)
1. **Core colony loop** (dig, forage, grow, defend) is absorbing and "hooks" players (Vaporlens 61; Gaming.net).
2. **Species variety with distinct mechanics** (51 + 38).
3. **Biological authenticity and educational value**; narrator explains real behaviour; mechanics map to real biology (medics, termite farming, bridges) (Vaporlens 17; 4/10 top reviews).
4. **Accessible RTS with low micro**; "simple yet strategic" (25).
5. **Presentation**: documentary narration, music, sound, detailed creature models (4/10 top reviews; Gaming.net; Gaming Professors).
6. **Enemy variety and boss/Titan fights** (Games Machine via Wikipedia).
7. **Spiritual successor to SimAnt** (2/10 top reviews; RPS; GamesRadar via Wikipedia).
8. **Tension**: stressful but fun, high stakes; some players defend the lack of saves as part of the appeal (Steam thread).
Also: good mid-range performance (17), plenty of post-campaign content (22).

### Complaint themes
| Theme | Evidence |
|---|---|
| **No mid-mission save / no active pause** (top complaint) | Vaporlens 38 mentions; 7/10 top-rated negative reviews; dev confirmed it is a deliberate cut |
| **Long missions** (40 min to hours) compounding the above | Vaporlens 20 |
| **Crashes, freezes, progress loss** | Vaporlens 30; 2/10 recent negatives; dev asks for crash reports |
| **Performance with large armies**, low hardware utilisation | Vaporlens 19 + 18 |
| **Short / thin content**, campaign of a handful of missions per tier, repetitive colony setup each mission | Vaporlens 21; 3/10 top negatives; "only ~20 h real content" |
| **Difficulty spikes / unbalanced difficulty**, punishing starvation spirals, first experiment as a wall | Vaporlens 17; 4/10 top negatives; recent negatives |
| **Grind for Royal Jelly** by replaying missions | 2/10 top positives' caveats |
| **Control/micro**: late-game pheromone management tedious; no retreat; orders delayed; group response slow | 3/10 top negatives; Steam threads |
| **Pathfinding**: creatures stuck at nest entrances soft-lock "kill all" missions; regressions after patches | Steam thread with dev acknowledgement |
| **Replayability / dominant strategy** ("bigger swarm wins"), no Workshop | 4/10 top negatives |
| **No multiplayer** | Vaporlens 19; Games Machine |
| **Early access length** (6.5 years), slow updates | 3/10 top negatives; GamingOnLinux commenters assumed abandonment |
| **Shallow vs. classic RTS / tactically thin** | Gaming Professors; recent negatives call it "too simple" or "generic RTS, not SimAnt" |
| **UI / onboarding clunky**; tutorial unclear on food | recent negatives; positive caveat |
| **Permanent formicarium layout** (cannot rebuild) | 1 top negative |
| Steam Deck control regressions | Vaporlens (no count) |

## 8. Comparable games

| Game | Does well | Does poorly |
|---|---|---|
| **SimAnt** (Maxis, 1991) (from memory) | Pheromone-trail recruitment, single "yellow ant" avatar you control directly, backyard-to-house conquest, educational framing; the benchmark every review invokes | Dated UI; coarse simulation; no deep combat |
| **Empire of the Ants** (Microids/Tower Five, 2024) | Photoreal UE5 miniature world; third-person ant avatar issuing orders; has multiplayer | Thin strategy and few tactical options (critics ~60/100 per search snippets of PC Gamer and others; review body not loaded); bugs (Windows Central snippet) |
| **The Ants: Underground Kingdom** (mobile F2P) | Deep-looking tunnel/resource management, strong production, varied species, alliances | Timers of 22-24 h, premium currency, pay-to-win raiding (Android Central) |
| **Pocket Ants** (mobile F2P) | Real-time foraging, many species and creatures, solid user ratings (App Store 4.3 per search snippet) | Gacha creature fusing (~7% odds per a user review in snippet), F2P pressure |
| **Ant Simulator** (2018) (from memory) | Viral trailer promised a sandbox colony sim | Notorious development collapse; essentially unfinished |
| **Ant Empire** (mobile/PC) (from memory) | Turn-based 4X with ant theme | Low production; little colony simulation |
| **Microcosmum** (from memory) | Minimal cell-swarm RTS; very readable send-a-fraction-of-units control | Abstract, little economy |
| **Hive** (board game) (from memory) | Elegant insect-themed abstract strategy | Not a colony sim; no economy |
| **Web/idle ant colony sims** (e.g. "Ant Colony Simulator" style pages; from memory) | Emergent pheromone-trail visuals with tiny rule sets | Little goal structure; usually toys |
| **Pikmin** (Nintendo) (from memory) | Gold standard for indirect swarm control: throw/whistle/recall, type-specific counters, day-limit pacing with end-of-day save (one Steam poster explicitly proposes Pikmin-style day wrap-ups for EotU) | Small unit counts; no base building |
| **"Antstream"** | Note: Antstream Arcade is a retro-game streaming service, not an ant game (from memory). Not a genre comparable. | — |
| **March of the Ants** (TechRaptor review exists; not opened) | Ant-themed 4X | — |

## 9. Design takeaways for a clean-room game in this genre (my synthesis)

- **Indirect control is the identity and the friction.** Group-level markers + rules of engagement + nursery-assigned groups works and is praised for accessibility, but players hit limits: no retreat order, slow response, no tactical pause. Add a retreat/recall verb, an active pause, and response feedback.
- **Ship save/checkpoints from day one.** The single most cited complaint in a 95%-positive game is a scoped-out feature; the dev says retrofitting costs months per level. Design state serialisation into the sim from the start, or make missions short with Pikmin-style day boundaries.
- **Biology-as-mechanic sells.** Every distinctive unit maps to a real behaviour (medic rescue, raft bridges, fungus farming, over-harvest risk). Reviewers repeatedly cite "I learned about ants".
- **Persistent home base is a strong hook**, but make it repairable and make meta-currency earnable without repetitive replays.
- **Break "bigger swarm wins"**: Titans with readable attack arcs and counter-requiring enemies (isolate, flank) are the best-liked combat moments; extend that.
- **Multiplayer is a recurring ask** the genre leader never answered; Empire of the Ants has it but is thin. A small co-op or async mode is an open niche.

## Sources (opened)

- Steam store page: https://store.steampowered.com/app/463530/Empires_of_the_Undergrowth/
- Steam top-rated negative reviews: https://steamcommunity.com/app/463530/negativereviews/?browsefilter=toprated&filterLanguage=english
- Steam most-recent negative reviews: https://steamcommunity.com/app/463530/negativereviews/?browsefilter=mostrecent&filterLanguage=english
- Steam top-rated positive reviews: https://steamcommunity.com/app/463530/positivereviews/?browsefilter=toprated&filterLanguage=english
- Steam thread, stuck beetle / pathfinding: https://steamcommunity.com/app/463530/discussions/0/1729828401707086119
- Steam thread, Matabele Impossible strategy: https://steamcommunity.com/app/463530/discussions/0/4343239329895448902
- Steam thread, no mid-mission save (dev reply): https://steamcommunity.com/app/463530/discussions/0/4337609701282447295
- Steam gameplay discussion index: https://steamcommunity.com/app/463530/discussions/0/4337609376658736435
- Wikipedia: https://en.wikipedia.org/wiki/Empires_of_the_Undergrowth
- Gaming.net review: https://www.gaming.net/reviews/empires-of-undergrowth-review-pc/
- OpenCritic: https://opencritic.com/game/16892/empires-of-the-undergrowth
- GOG changelog: https://www.gog.com/forum/empires_of_the_undergrowth/changelog
- GamingOnLinux 1.0 announcement: https://www.gamingonlinux.com/2024/05/ant-colony-rts-empires-of-the-undergrowth-hits-1-0-in-june/
- PCGamesN post-launch patch: https://pcgamesn.com/empires-of-the-undergrowth/post-launch-patch
- Slug Disco Tier 5 reveals: https://slugdisco.com/?p=3322
- Slug Disco March 2021 newsletter: https://slugdisco.com/march-2021-newsletter/
- Bloxodes playable colonies: https://bloxodes.com/wiki/empires-of-the-undergrowth/playable-colonies
- Vaporlens review summary: https://vaporlens.app/app/463530/empires_of_the_undergrowth
- Android Central, The Ants: Underground Kingdom: https://www.androidcentral.com/ants-underground-kingdom-android-game-week
- PC Gamer, Empire of the Ants review (page opened; body did not load): https://pcgamer.com/games/rts/empire-of-the-ants-review

**Search-snippet-only (not opened, lower confidence):** Hooded Horse wiki Basic Mechanics and Formicarium Adaptation pages (403), Fandom wiki (402), Prima Games royal jelly / upgrade guides (403), TV Tropes (403), GameStar review (403), guide aggregator pages on beginner tips, Empire of the Ants critic snippets (Niche Gamer, Windows Central, GOG), Pocket Ants App Store and Google Play snippets. Reddit could not be fetched; no Reddit claims are included.
