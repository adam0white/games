# Cloudflare settings outside the repository

Read-only audit, 2026-11-13, from the owner's Mac with the local `wrangler` and `cf` logins. Nothing was changed. Secret values were not read; names only. DNS records and Access were not checked.

## Not in any repository config

| Worker            | Setting                 | Value on 2026-11-13                                                                                                                                                       |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games-static`    | Workers Builds          | Created 2026-11-13. Repository `adam0white/games`, branch `main`, root `/`, build `pnpm run build`, deploy `npx wrangler deploy`, previews on (`npx wrangler preview`), watch paths `*`, no build variables. No build had run. |
| `human-framework` | Secret `WAI_BUDGET_KEY` | Present. Its only caller was the Mac's daily job; see `workers/wai-daily/README.md`.                                                                                      |
| `human-framework` | Workers Builds          | None. Deployed by hand with `wrangler`.                                                                                                                                   |
| 16 old per-game Workers and `repair-game` | Existence, custom domains | Still present. Routes on `games-static` take precedence for the old hosts.                                                                              |

Workers Builds on `games-static` conflicts with the guarded deploy in `.github/workflows/deploy.yml`: it would upload on every push to `main` without green CI, the live-manifest check or the retained artifact. **Open owner decision, 2026-11-13:** one production deployer per Worker.

The `cf` CLI can read the Builds API; `wrangler` OAuth cannot.

## In repository config already

`games-static`: name, routes, custom domain, assets binding, `workers_dev` and `preview_urls` off (`wrangler.jsonc`). It has no secrets, variables or cron triggers.

## Deferred

Settings that can live in `wrangler.jsonc` but are unset or dashboard-defaulted today (observability and logs, placement, limits, version and preview settings) are left as they are. **Review by 2026-11-27**: decide which to pin in config, for both `games-static` and Human Framework's Worker.
