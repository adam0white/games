# Games

Original games built with [Human Framework](https://github.com/adam0white/human-framework).

The staged move targets `https://play.adamwhite.work/<slug>/`. The central shelf and lab remain in Human Framework. Production cutover has not happened.

| Game | Workspace | Target path | Engine |
| --- | --- | --- | --- |
| The Rope | [games/rope](games/rope) | `/rope/` | HF 4.17.0 |
| Hearsay | [games/hearsay](games/hearsay) | `/hearsay/` | HF 4.17.0 |

Use Node 26.12.0 and pnpm 12.14.0. Install once with `pnpm install --frozen-lockfile`. Run a game with `pnpm --filter rope dev` or `pnpm --filter hearsay dev`. Use the root `pnpm deploy` gate for the complete bundle. Each live game has its own release manifest.

Original source history remains reachable through unsquashed subtree imports. Original repositories are retained. Old-origin saves are not transferred; play starts fresh on the new origin. [HANDOFF.md](HANDOFF.md) records remaining release gates. [AGENTS.md](AGENTS.md) records work rules.

Code is MIT licensed. Imported games retain their source history and attribution.
