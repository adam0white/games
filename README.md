# Games

Original games built with [Human Framework](https://github.com/adam0white/human-framework).

Games move to `https://play.adamwhite.work/<slug>/`. The central shelf and lab remain in Human Framework. Rope, Hearsay and Good Hands are live on the new origin; Glance is being prepared.

| Game | Workspace | Target path | Engine |
| --- | --- | --- | --- |
| The Rope | [games/rope](games/rope) | `/rope/` | HF 4.17.0 |
| Hearsay | [games/hearsay](games/hearsay) | `/hearsay/` | HF 4.17.0 |
| Good Hands | [games/goodhands](games/goodhands) | `/goodhands/` | HF 4.17.0 |
| The Glance | [games/glance](games/glance) | `/glance/` | HF 4.17.0 |

Use Node 26.12.0 and pnpm 12.16.1. Install once with `pnpm install --frozen-lockfile`. Run a game with `pnpm --filter rope dev` or `pnpm --filter hearsay dev`. Use the root `pnpm deploy` gate for the complete bundle. Each live game has its own release manifest.

Original source history remains reachable through unsquashed subtree imports. Original repositories are retained. Old-origin saves are not transferred; play starts fresh on the new origin. [HANDOFF.md](HANDOFF.md) records remaining release gates. [AGENTS.md](AGENTS.md) records work rules.

Code is MIT licensed. Imported games retain their source history and attribution.
