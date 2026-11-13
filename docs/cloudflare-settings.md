# Cloudflare settings outside the repository

Read-only audit, 2026-11-13, from the owner's Mac with the local `wrangler` and `cf` logins. Nothing was changed. Secret values were not read; names only. DNS records and Access were not checked.

## Not in any repository config

| Worker            | Setting                 | Value on 2026-11-13                                                                                                                                                       |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games-static`    | Workers Builds          | As created 2026-11-13, before the changes below. Repository `adam0white/games`, branch `main`, root `/`, build `pnpm run build`, deploy `npx wrangler deploy`, previews on (`npx wrangler preview`), watch paths `*`, no build variables. No build had run. |
| `human-framework` | Secret `WAI_BUDGET_KEY` | Present. Its only caller was the Mac's daily job; see `workers/wai-daily/README.md`.                                                                                      |
| `human-framework` | Workers Builds          | None. Deployed by hand with `wrangler`.                                                                                                                                   |
| 16 old per-game Workers and `repair-game` | Existence, custom domains | Still present. Routes on `games-static` take precedence for the old hosts.                                                                              |

Owner decision, 2026-11-13: Workers Builds serves pull request previews only; the guarded deploy in `.github/workflows/deploy.yml` is the only production deployer. Changes made that day with `cf builds workers update` (Worker tag `26188500443f4ca59b5e0d3033ee2ffa`):

| Setting                   | Before                | After                                                              |
| ------------------------- | --------------------- | ------------------------------------------------------------------ |
| Production deploy command | `npx wrangler deploy` | `npx wrangler versions upload`                                     |
| Preview build command     | `pnpm run build`      | `git fetch --unshallow origin \|\| git fetch origin; pnpm run build` |

The first two preview builds failed at the redirect preflight, which needs full Git history; their logs do not state the clone depth. The new preview build command fetches full history first. Not yet observed as of this commit: a passing preview build.

Cloudflare documents no switch that stops production-branch builds while keeping previews; `versions upload` is its documented way to build without deploying. A push to `main` therefore still starts a Workers Builds run, which uploads an inactive version or fails. Neither changes what is served. The production build command is unchanged, so it fails at the redirect preflight like the first preview build did, which needs full Git history. Not verified by observation: a push to `main` after the change.

The `cf` CLI can read the Builds API; `wrangler` OAuth cannot.

## In repository config already

`games-static`: name, routes, custom domain, assets binding, `workers_dev` and `preview_urls` off (`wrangler.jsonc`). It has no secrets, variables or cron triggers.

## Deferred

Settings that can live in `wrangler.jsonc` but are unset or dashboard-defaulted today (observability and logs, placement, limits, version and preview settings) are left as they are. **Review by 2026-11-27**: decide which to pin in config, for both `games-static` and Human Framework's Worker.
