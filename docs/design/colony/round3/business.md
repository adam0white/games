# Business and market review of the Cinderhill spec

1. The spec's measure of success (finish Spring, 30% of Day 2 starters, a recommend majority) is a retention target for a committed Steam-style player. The free web channel gives you the first 60 seconds, and the owner's own replays show colony mode loses people inside that window.
2. The strongest hook is already built and is not in the spec's plan as a hook. The goal-less 5,000-ant trail painter held its player for 17 minutes. Colony mode held none past 7 minutes. A strange link should open on that feeling.
3. Spec choices that hurt reach: the 24-day, 4 to 5 hour campaign as the only front door; Day 1 as a 10-minute quota with nothing to decide; first threat on Day 2; share features parked at P3; unlisted and unnamed until M3.
4. Spec choices that help reach: friends by link with no account, deterministic replays, daily seed, family tone, no ads or currencies, Turkish. Most of these are under-used as growth tools.
5. Smallest change set: a 90-second "first hill" that ends in a shareable picture or replay link, a daily 5-minute hill promoted to P0, share and replay links promoted from P3 to P1, a name and handle check now, and a monetisation rule written down (premium or supporter pack, no ads in the core).

Marking: **[checked]** means I read it in the repo or opened the page. **[search]** means a search result snippet that I did not open as a page. **[memory]** means unverified recall.

## Findings

| # | Finding | Evidence | Severity | Proposed change |
| --- | --- | --- | --- | --- |
| 1 | The success gates measure a long-session player. A stranger from a link is a different person from the one who finishes Spring. There is no gate for the first 60 seconds, the first return visit, or "sent the link to someone". | 02-spec section 0 gates (Day 1 finish 80%, Day 2 60%, season 30%) [checked]. Replays a to f: 1 to 92 s, no delivery or birth [checked, evidence.md]. | blocker | Add three top-of-funnel gates, each with denominators: reach 60 s of play (target 70%), reach the first "I decided something" moment before 3 min (50%), and next-day return or link sent (a number, measured by the lab recorder). Put them above the Day 1 gate. |
| 2 | The owner's own sessions show the hook the spec does not use. Sandbox, 5,000 ants, 17 min, 81 orders, 2,122 deliveries, left by choice. Colony mode never exceeded 427 s. | evidence.md sessions g and h [checked]. | blocker | Make the "draw a trail, thousands of ants stream along it" feeling the first 60 seconds of colony mode. Start with a visible, already-moving swarm (hundreds of ants), not 20 ants and a quota. See the first-minute rewrite below. |
| 3 | Channel mismatch. CrazyGames requires gameplay within 20 s of load, an initial download of 50 MB or less, and 20 MB or less for the mobile homepage. Its guidance says mobile sessions are "shorter and more fragmented" and to wait 3 to 5 minutes of play before the first mid-game ad. The 24-day campaign fits none of this. | CrazyGames technical and midgame-ads pages, opened [checked]. | major | Treat the portals as the Daily hill and "First hill" product, not the campaign. Size the web bundle for 20 MB initial (Cinderhill's procedural art helps; verify the WebGL and sim bundle size). Decide in the spec which channel gets which mode. |
| 4 | The shareable pieces exist as engineering assets and are ranked as extras. Share-the-bloom-picture is P3 (feature 50), daily hill is P1 (24), replays exist in the lab. A deterministic replay is a link a creator can post that reproduces the exact run. | 03-features 24, 50 [checked]; evidence.md "every session is a full replay" [checked]. | major | Promote share picture, replay link and daily hill into the first public build (M2 at latest). A replay link with a seed in the URL is the cheapest shareable object you own. |
| 5 | Day 1 has no decision and first delivery takes 73 s or never. For a stranger this is a bounce, whatever the channel. | evidence.md [checked]. | blocker (same root cause as the owner's "too slow") | Day 1 goal must be reachable and visibly met in under 3 minutes. Keep the 10-minute day for later days. Show the first birth or first stored food inside 2 minutes. |
| 6 | Audience guesses are unproven. The reference game is a PC strategy game with real depth. Its players want missions and species variety. Those players will not find a phone-browser game by that name. | Steam page shows 11,188 English reviews, 95% positive; third-party sales estimates range about 430K to 870K copies [search, not opened as a page]. | major | Do not target the reference audience by name or by comparison (also the clean-room rule). Target the people the free channel reaches: casual colony and idle players, ant-keeping hobbyists, families. Say so in the spec, then test with the three groups. |
| 7 | Family tone, Turkish and the spider toggle are real advantages for the casual and hobbyist audiences, but nothing in the plan puts a store or social page in front of them. No Turkish-language community plan exists. | 02-spec section 9 [checked]. | minor | Add one line per language: where the Turkish and English audiences will see it (see Channels). Ship the spider toggle on by default for the family framing. |
| 8 | Name. Searches I ran found no game titled exactly Cinderhill on itch.io or Steam in the indexed results, and no registered game trademark. They are not exhaustive. A UK farm shop holds a "Cinderhill Farm" mark and "Cinderhill" is also a place name (Nottingham, from memory), so search for the name alone is poor and the discovery handle is weak. The lab's own GitHub PR #314 is called "Cinderhill battle toy". | Two web searches [search]. | minor | Run the check at the start, not M3: USPTO, EUIPO and UK IPO for classes 9, 28, 41; Steam and itch.io title search; domain and handle availability; check the "Cinderhill" ant-game search results for confusion. Pick the name for searchability ("ant" in the subtitle). |
| 9 | Monetisation is undefined. The spec says nothing, so the build cannot design for it. The harm risk is real: ads in a 10-minute-day game break the calm tone, and a currency would contradict the spec's "earned, not grind" line. | 02-spec section 6.10 [checked]; no monetisation text anywhere in docs 02 to 05 [checked by reading; not grep-verified for all of 01 and 06 to 10]. | major | Add a decision note (section below). |
| 10 | The 24-day campaign is a late-game promise with no evidence it gets played to day 24. Content cost is front-loaded. Roadmap puts the name check, listing and outside testers at M3 after Summer content. | 04-roadmap M3 [checked]. | major | Outside players should see the game before any Summer content exists. See change 4. |
| 11 | Friends by link is the best growth feature and is scheduled last (M4). Gate "second phone playable in under 10 seconds with no account" is correct. | 02 section 0, 04 M4 [checked]. | major | Ship a minimal 2-player "sister nest on the same hill" or shared sandbox early. The sandbox is the one mode where friends can join with no goal to explain. |

## Who plays what (audience read)

- **Empires of the Undergrowth fans.** PC, strategy, mission campaigns. Review count and sales are above [search]. This audience is the proof that ant colony strategy sells. It is not reachable through the free web. Treat Steam as a later channel for this group.
- **SimAnt nostalgia.** Real but old and small, mostly reached through retro and "games like" posts and video essays [memory].
- **Mobile ant games.** The Ants: Underground Kingdom is a monetised strategy-city game with long sessions and a gacha-style economy [memory; I did not open its store page]. Pocket Ants is a small colony-builder aimed at casual play [memory]. They show the mobile audience exists, but they get it by paid installs and live-ops, which a free browser game cannot copy.
- **Idle and incremental ant games** (browser and Steam) [memory]. Short returning sessions, number growth, an always-moving swarm. Close to the sandbox trail painter's appeal.
- **Ant keeping hobbyists.** Reddit r/antkeeping, YouTube creators such as AntsCanada, many with large followings [memory, sizes unverified]. They reward biological accuracy (the spec's real-behaviour mechanics, gamergate note, myrmecochory are strong here) and are hostile to wrong biology. They are also the most likely to post a link.
- **Families.** Shared screen and link play, calm tone, tournaments without kills. The spec already serves them. Nothing yet tells a parent where the game is.

## Channels: what each can and cannot do

| Channel | What it gives | What it needs | Fit for Cinderhill |
| --- | --- | --- | --- |
| Poki, CrazyGames | Mass casual traffic. Basic launch is limited; CrazyGames' Basic Launch lasts 7 to 21 days and ends at 500 plays after 7 days [search, not opened]. Revenue is ads. Poki says direct traffic is 100% yours and portal traffic is split 50/50, with terms "indicative" [search, not opened] | Load to play in under 20 s, small bundle, SDK, English-first, shorter sessions [checked on CrazyGames pages] | Daily hill and First hill only. Campaign no. Ads clash with the calm tone, so decide before applying |
| itch.io | Indie and hobby audience, devlogs, game jams, pay-what-you-want, follow and comment loop | A page with a GIF, a playable embed, devlog posts | Best first home. Free web build plus supporter link, later premium campaign |
| Newgrounds | Old browser audience, a front page for new games | Moderated submission | Low cost second launch of the First hill |
| Discord | Retention, daily hill talk, friends' tables | A server with one channel and a daily seed post | Cheap and fits the daily hill |
| Reddit (r/antkeeping, ant-game and indie subs) | Biology credibility, screenshot shares | Each sub has self-promotion rules. Read them first, post a real result (a bloom map), not an ad | High risk of bounce if the game is wrong biologically, high reward if right |
| YouTube creators | The biggest single lever for an ant game: the content is visual and the swarm is the show | A trailer-quality 15-second clip; a link that opens instantly on the same seed | Prepare a creator link: seed in the URL, replay of a good run |
| Steam | Revenue and review social proof | 10 to 20 hours of content, store page assets, fee, wishlists | Later, only if web retention shows pull |

Session and hook targets by channel (my proposals, not measured):

| Channel | Hook in first | First decision by | Natural stop |
| --- | --- | --- | --- |
| Portal | 10 s | 60 s | A 3 to 5 min round ending in a score and a picture |
| itch.io / Newgrounds | 30 s | 2 min | A 10-minute day, saved |
| Link from a friend | 10 s (join) | 30 s | The friend's task ("hold this trail while I dig") |
| Creator link | 5 s | 20 s | A replay that reproduces the clip |

## What makes a web game shareable by link

- Opens in under 10 s, no sign-in, no install, works on a phone browser. The spec has this for friends; make it true for every link.
- The URL carries state: seed, daily id, replay id. "Play this hill" and "watch this run" are links.
- Link previews show a picture that is not a logo: the bloom map or the swarm. The share picture (feature 50) provides it.
- A thing to show off: the bloom map going from black to green is a very good screenshot. It is only available at feature 29, late. A small version in the first build (the founding sprout and a green patch) gives a picture early.
- A reason to send it: "hold this trail while I dig" needs two people. The daily hill gives a number to compare.
- A bad link experience costs more than no link: a stranger who joins and watches 20 ants stand still tells nobody.

## Monetisation that fits (decision note)

Realistic scale: a modest side income, not a living [memory-based judgement]. Options, in the order I recommend:

1. **Free web game, itch.io pay-what-you-want or supporter pack** (a name in the credits, a cosmetic look). Lowest risk, no harm to play. Fits the "earned, not grind" line.
2. **Cosmetic looks.** The owner liked Field and Ember. Sold as supporter looks, they change nothing in play. Safe.
3. **Premium itch.io or Steam version** of the full campaign later, if the free first hill and daily hill show return visits. Steam needs 10 to 20 hours of content to avoid bad reviews [memory].
4. **Portal ads.** Revenue is real but the CrazyGames guidance itself says ads go at death or level transitions after 3 to 5 minutes [checked]. Cinderhill's dusk card is a natural slot. It also fights the family and calm tone. Decide before applying, and never put ads in the core web build on your own domain.
5. **None.** Acceptable. Write it down as a choice so the build does not invent a currency.

Never add: energy timers, premium currency, pay-to-speed. They contradict the spec and the family audience.

## Store and name checks, now rather than M3

- Name: search USPTO, EUIPO, UK IPO (classes 9, 28, 41); Steam, itch.io, Google Play and App Store titles; domain and social handles. Result recorded in the repo.
- Clean room: the spec's table is sound. Add a check that no store text, trailer or screenshot refers to the reference game by name.
- Assets: CrazyGames and Poki require relative paths and no external requests (Poki third-party summary [search]); the lab's Google Fonts or CDN calls, if any, fail this.
- Privacy and children: if families and children play, the lab recorder and any leaderboard need a plain privacy line and no personal data. Daily board names need a filter.
- Age rating: itch.io self-labels, Steam has a questionnaire. Death is shown but not gory, which keeps the rating low.

## What helps and hurts reach, by spec choice

| Choice | Effect on reach | Verdict |
| --- | --- | --- |
| 24-day campaign, 4 to 5 hours | Cannot be sampled. Good for premium later. Bad as the front door | Hurts. Add a "First hill" front door |
| 10-minute days | Good for a deliberate player. A mobile or portal player gives up before the first dusk | Keep for later days. Add a 3-to-5-minute first day |
| Friends by link, no account | Strongest growth feature | Helps. Promote earlier |
| Daily hill (same seed, shared board) | Reason to return, cheap | Helps. Promote to P0 or P1, 5 minutes not 10 |
| Family tone, tournaments without kills | Opens parents and kids | Helps if the first minute is not a quota |
| Turkish | A small, loyal, under-served audience on itch.io and Reddit | Helps. Name a channel; ship from the first public build |
| Fixed fictional species and a setting built on a wildfire | Distinctive and searchable | Helps. Make the burn-to-green image the thumbnail |
| Unlisted until M3 | Protects, but no play evidence comes in | Hurts. Open a small invite list now |

## The smallest set of changes

1. **First hill (90 seconds to 3 minutes).** A start with 300 to 500 ants already moving, one visible food, one drawn trail, a first delivery in under 20 s, and a dusk card with a picture to share. This is the portal, creator and link product. It replaces the 20-ants-and-a-quota start. It does not replace the founding bloom: the sprout and husk can be this hill's ending.
2. **Daily hill promoted to the first public build**, 5 minutes, one seed per day, a board, a share picture and a replay link.
3. **Share picture and replay link promoted from P3 to P1.** The replay recorder already exists.
4. **Put the first outside testers at M1.5, not M3**: a closed invite on itch.io or a Discord, with the new top-of-funnel gates in finding 1.
5. **Write the monetisation decision and the name check into the repo now**, with a date.

## What the spec must say so the slow result cannot recur (business view)

The spec put its numbers into the build faithfully (Day length 10 min, brood 9.5 min, first threat Day 2). They set a pace that a stranger cannot reach. Business gates were set at the end of the funnel (Spring finish) and none at the front, so nothing in the process measured the front. Add the front gates (finding 1) to the milestone closing rule, and require each milestone to report its median time to first decision from lab records.

## Gaps

- No data on the free-web audience for colony games. The 60-second and return rates are my proposals. They need a first test with real strangers.
- Portal terms and revenue shares come from search snippets and a third-party summary, not from the portals' official terms. Read them before applying.
- Subreddit sizes, YouTube creator reach, and the mobile ant games' store pages are from memory.
